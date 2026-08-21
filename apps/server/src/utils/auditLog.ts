import { Request } from "express";
import { db } from "../config/database";
import { logger } from "./logger";

export interface RecordAuditEventParams {
  schoolId: string;
  actorId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, any> | null;
  req?: Request;
  ipAddress?: string | null;
  userAgent?: string | null;
}

const SENSITIVE_KEY_SUBSTRINGS = [
  "password",
  "temppassword",
  "currentpassword",
  "newpassword",
  "secret",
  "mfasecret",
  "backupcodes",
  "token",
  "refreshtoken",
  "accesstoken",
  "stripetoken",
  "authorization",
  "cookie",
];

function sanitizeMetadata(data: any): any {
  if (!data || typeof data !== "object") return data;
  if (Array.isArray(data)) return data.map(sanitizeMetadata);

  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const lower = key.toLowerCase();
    const isSensitive = SENSITIVE_KEY_SUBSTRINGS.some((s) => lower.includes(s));
    if (isSensitive) {
      clean[key] = "[REDACTED]";
    } else if (value && typeof value === "object") {
      clean[key] = sanitizeMetadata(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

export const recordAuditEvent = async (
  params: RecordAuditEventParams,
): Promise<void> => {
  try {
    if (!params.schoolId) {
      logger.warn("recordAuditEvent called without schoolId; skipping");
      return;
    }

    let ipAddress = params.ipAddress ?? null;
    let userAgent = params.userAgent ?? null;

    if (params.req) {
      if (!ipAddress) {
        ipAddress =
          params.req.ip ||
          (params.req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
          params.req.socket?.remoteAddress ||
          null;
      }
      if (!userAgent) {
        userAgent = (params.req.headers["user-agent"] as string) || null;
      }
    }

    const metadata = params.metadata ? sanitizeMetadata(params.metadata) : undefined;

    await db.auditLog.create({
      data: {
        schoolId: params.schoolId,
        actorId: params.actorId ?? null,
        actorEmail: params.actorEmail ?? null,
        actorRole: params.actorRole ?? null,
        action: params.action,
        targetType: params.targetType ?? null,
        targetId: params.targetId ?? null,
        metadata,
        ipAddress,
        userAgent,
      },
    });
  } catch (err) {
    logger.warn(`Failed to record audit event [${params.action}]:`, err);
  }
};
