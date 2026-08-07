// ─────────────────────────────────────────────────────────────────────────────
// SMS notification channel — Phase 5 of the continuation blueprint.
//
// Requirement doc: parent alerts (attendance, fees) may be delivered by push
// OR SMS; push/in-app already existed (Socket.IO). This adds SMS as a second
// channel, since SMS is realistically the more reliable option for parents
// without the app installed or without a data connection — the common case
// for the target users in Ethiopia.
//
// Provider: Africa's Talking — has first-class Ethiopian/East African
// coverage (unlike Twilio, which is not guaranteed to route to all local
// carriers). REST API, called here with the Node 20+ global `fetch` so no
// new npm dependency is required (unlike pdf-lib/react-i18next in earlier
// phases, `fetch` is already part of the runtime this project already
// requires — see package.json "engines": { "node": ">=20.0.0" }).
//
// Safe-by-default: if AT_USERNAME/AT_API_KEY aren't set, sendSms() logs and
// no-ops rather than throwing, so attendance marking / fee reminders never
// fail because SMS isn't configured yet (same defensive pattern the rest of
// this codebase already uses for optional integrations).
// ─────────────────────────────────────────────────────────────────────────────

import { logger } from './logger';

const AT_USERNAME = process.env.AT_USERNAME;
const AT_API_KEY = process.env.AT_API_KEY;
const AT_SENDER_ID = process.env.AT_SENDER_ID; // optional — falls back to AT's shared shortcode if unset
const AT_BASE_URL = process.env.AT_ENV === 'sandbox'
  ? 'https://api.sandbox.africastalking.com/version1/messaging'
  : 'https://api.africastalking.com/version1/messaging';

export function isSmsConfigured(): boolean {
  return Boolean(AT_USERNAME && AT_API_KEY);
}

export interface SmsResult {
  sent: boolean;
  reason?: string;
}

// Sends a single SMS. Never throws — callers (attendance/fee alert flows)
// should not fail an otherwise-successful operation just because SMS
// delivery had a problem; the in-app/push notification already covers the
// same alert regardless of SMS outcome.
export async function sendSms(toPhone: string | null | undefined, message: string): Promise<SmsResult> {
  if (!toPhone) return { sent: false, reason: 'No phone number on file' };
  if (!isSmsConfigured()) {
    logger.warn('[sms] AT_USERNAME/AT_API_KEY not set — skipping SMS send (would have sent to ' + toPhone + ')');
    return { sent: false, reason: 'SMS provider not configured' };
  }

  try {
    const body = new URLSearchParams({
      username: AT_USERNAME!,
      to: toPhone,
      message,
      ...(AT_SENDER_ID ? { from: AT_SENDER_ID } : {}),
    });

    const res = await fetch(AT_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        apiKey: AT_API_KEY!,
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.error(`[sms] Africa's Talking request failed (${res.status}): ${text}`);
      return { sent: false, reason: `Provider error ${res.status}` };
    }

    const data: any = await res.json().catch(() => null);
    const recipient = data?.SMSMessageData?.Recipients?.[0];
    if (recipient && recipient.status !== 'Success') {
      logger.warn(`[sms] delivery not confirmed for ${toPhone}: ${recipient.status}`);
      return { sent: false, reason: recipient.status };
    }

    return { sent: true };
  } catch (err) {
    logger.error('[sms] send failed:', err);
    return { sent: false, reason: 'Network/unexpected error' };
  }
}

// Sends to multiple recipients, opt-in filtering left to the caller (callers
// already have the User rows with smsOptIn loaded — see attendance.service.ts
// and jobs/notifWorker.ts). Runs sends concurrently but independently: one
// failure never blocks the others.
export async function sendSmsBulk(recipients: { phone: string | null; message: string }[]): Promise<SmsResult[]> {
  return Promise.all(recipients.map((r) => sendSms(r.phone, r.message)));
}
