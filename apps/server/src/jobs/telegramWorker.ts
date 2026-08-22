import { Queue, Worker, Job } from "bullmq";
import { redisSub } from "../config/redis";
import { db } from "../config/database";
import { logger } from "../utils/logger";
import { postJobToTelegram, TelegramJobPostingData } from "../utils/telegram";
import { recordAuditEvent } from "../utils/auditLog";

export const telegramQueue = new Queue("telegram-post", { connection: redisSub });

export interface TelegramPostJobData {
  postingId: string;
  schoolId: string;
  actorId?: string;
  actorEmail?: string;
  actorRole?: any;
  posting: TelegramJobPostingData;
}

// ── Worker ────────────────────────────────────────────────────────────────────
export const telegramWorker = new Worker<TelegramPostJobData>(
  "telegram-post",
  async (job: Job<TelegramPostJobData>) => {
    const { postingId, schoolId, actorId, actorEmail, actorRole, posting } = job.data;

    const result = await postJobToTelegram(posting);

    if (result.success) {
      // Mark telegramPostedAt, telegramMessageId, and telegramChannelId in DB
      await db.jobPosting.update({
        where: { id: postingId },
        data: {
          telegramPostedAt: new Date(),
          telegramMessageId: result.messageId || null,
          telegramChannelId: result.channelId || null,
        },
      });

      // Record Audit Event
      await recordAuditEvent({
        schoolId,
        actorId: actorId || "system",
        actorEmail: actorEmail || "system@timhirthub.com",
        actorRole: actorRole || "ADMIN",
        action: "JOB_POSTING_TELEGRAM_POSTED",
        targetType: "JobPosting",
        targetId: postingId,
        metadata: {
          title: posting.title,
          messageId: result.messageId,
          publicJobUrl: posting.publicJobUrl,
        },
      });

      logger.info(`Recorded telegram post timestamp and audit log for posting ${postingId}`);
    } else if (result.skipped) {
      logger.debug(`Telegram posting skipped for posting ${postingId} (unconfigured)`);
    } else {
      logger.warn(`Telegram posting failed for job ${job.id}: ${result.error}`);
    }
  },
  { connection: redisSub, concurrency: 1 },
);

telegramWorker.on("failed", (job, err) => logger.error(`Telegram job ${job?.id} failed:`, err));
telegramWorker.on("error", (err) => logger.debug(`TelegramWorker notice: ${err.message}`));
telegramQueue.on("error", (err) => logger.debug(`TelegramQueue notice: ${err.message}`));

// ── Helper to enqueue Telegram job posts ──────────────────────────────────────
export const enqueueTelegramJobPost = async (
  data: TelegramPostJobData,
  options?: { delay?: number; attempts?: number },
) => {
  try {
    await telegramQueue.add("post", data, {
      delay: options?.delay,
      attempts: options?.attempts ?? 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    });
  } catch (err: any) {
    logger.warn(`Telegram queue unavailable, skipped background post for ${data.postingId}:`, err.message);
  }
};
