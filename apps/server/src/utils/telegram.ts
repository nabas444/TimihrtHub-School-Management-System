import { logger } from "./logger";

export interface TelegramJobPostingData {
  title: string;
  companyTagline?: string | null;
  employmentType?: string | null;
  location?: string | null;
  salaryType?: string | null;
  salaryRange?: string | null;
  salaryFixedAmount?: number | null;
  salaryCurrency?: string | null;
  closingDate?: Date | string | null;
  bannerImageUrl?: string | null;
  publicJobUrl: string;
  schoolName?: string | null;
}

export function isTelegramPostingConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHANNEL_ID);
}

export function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatJobPostingTelegramHtml(posting: TelegramJobPostingData): string {
  const lines: string[] = [];

  // Title & Tagline
  lines.push(`🚀 <b>NEW JOB OPENING</b>`);
  lines.push(`<b>${escapeHtml(posting.title)}</b>`);

  if (posting.companyTagline) {
    lines.push(`<i>${escapeHtml(posting.companyTagline)}</i>`);
  }

  if (posting.schoolName) {
    lines.push(`🏛 <b>${escapeHtml(posting.schoolName)}</b>`);
  }

  lines.push(""); // empty line

  // Key facts
  if (posting.employmentType) {
    const formattedType = posting.employmentType
      .toLowerCase()
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join("-");
    lines.push(`💼 <b>Type:</b> ${escapeHtml(formattedType)}`);
  }

  if (posting.location) {
    lines.push(`📍 <b>Location:</b> ${escapeHtml(posting.location)}`);
  }

  // Salary Display Logic
  if (posting.salaryType !== "UNDISCLOSED") {
    let salaryText: string | null = null;
    if (posting.salaryType === "FIXED" && posting.salaryFixedAmount) {
      salaryText = `${posting.salaryFixedAmount.toLocaleString()} ${posting.salaryCurrency || "USD"}`;
    } else if (posting.salaryType === "RANGE" && posting.salaryRange) {
      salaryText = posting.salaryRange;
    } else if (posting.salaryType === "NEGOTIABLE") {
      salaryText = "Negotiable";
    }

    if (salaryText) {
      lines.push(`💰 <b>Compensation:</b> ${escapeHtml(salaryText)}`);
    }
  }

  // Closing Date
  if (posting.closingDate) {
    const formattedDate = new Date(posting.closingDate).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    lines.push(`📅 <b>Apply Before:</b> ${escapeHtml(formattedDate)}`);
  }

  lines.push("");
  lines.push(`👉 <b>Apply Online:</b> <a href="${posting.publicJobUrl}">View Job &amp; Apply Here</a>`);
  lines.push(`🌐 <b>Direct Link:</b> <a href="${posting.publicJobUrl}">${posting.publicJobUrl}</a>`);

  return lines.join("\n");
}

export async function postJobToTelegram(
  posting: TelegramJobPostingData,
): Promise<{ success: boolean; skipped?: boolean; messageId?: number; channelId?: string; error?: string }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const channelId = process.env.TELEGRAM_CHANNEL_ID;

  if (!botToken || !channelId) {
    logger.debug("Telegram job announcement skipped: TELEGRAM_BOT_TOKEN or TELEGRAM_CHANNEL_ID not configured");
    return { success: false, skipped: true };
  }

  const messageText = formatJobPostingTelegramHtml(posting);
  const baseUrl = `https://api.telegram.org/bot${botToken}`;

  try {
    let endpoint = `${baseUrl}/sendMessage`;
    let body: Record<string, any> = {
      chat_id: channelId,
      text: messageText,
      parse_mode: "HTML",
      disable_web_page_preview: false,
    };

    // If banner image is provided and caption fits within Telegram's 1024 char limit
    if (posting.bannerImageUrl) {
      if (messageText.length <= 1024) {
        endpoint = `${baseUrl}/sendPhoto`;
        body = {
          chat_id: channelId,
          photo: posting.bannerImageUrl,
          caption: messageText,
          parse_mode: "HTML",
        };
      } else {
        logger.warn(
          `Telegram caption exceeds 1024 chars (${messageText.length} chars). Falling back to sendMessage text without photo.`,
        );
      }
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data: any = await response.json().catch(() => null);

    if (!response.ok || !data?.ok) {
      logger.error("Failed to post job announcement to Telegram:", {
        status: response.status,
        statusText: response.statusText,
        error: data,
      });
      return {
        success: false,
        error: data?.description || `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    logger.info(`Successfully posted job "${posting.title}" to Telegram channel ${channelId}`);
    return {
      success: true,
      messageId: data.result?.message_id,
      channelId,
    };
  } catch (err: any) {
    logger.error("Unexpected error posting job announcement to Telegram:", err);
    return {
      success: false,
      error: err?.message || "Unknown error connecting to Telegram API",
    };
  }
}

export async function deleteTelegramMessage(
  channelId?: string | null,
  messageId?: number | null,
): Promise<{ success: boolean; error?: string }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const targetChannel = channelId || process.env.TELEGRAM_CHANNEL_ID;

  if (!botToken || !targetChannel || !messageId) {
    return { success: false, error: "Missing botToken, channelId, or messageId" };
  }

  try {
    const endpoint = `https://api.telegram.org/bot${botToken}/deleteMessage`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: targetChannel,
        message_id: messageId,
      }),
    });

    const data: any = await response.json().catch(() => null);

    if (!response.ok || !data?.ok) {
      logger.warn(`Failed to delete Telegram message ${messageId} in channel ${targetChannel}:`, data);
      return { success: false, error: data?.description || `HTTP ${response.status}` };
    }

    logger.info(`Successfully deleted Telegram message ${messageId} from channel ${targetChannel}`);
    return { success: true };
  } catch (err: any) {
    logger.error(`Error deleting Telegram message ${messageId}:`, err);
    return { success: false, error: err?.message };
  }
}
