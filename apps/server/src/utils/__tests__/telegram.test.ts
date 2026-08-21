import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  postJobToTelegram,
  deleteTelegramMessage,
  isTelegramPostingConfigured,
  formatJobPostingTelegramHtml,
  escapeHtml,
  TelegramJobPostingData,
} from "../telegram";

describe("Telegram Posting Utility", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("Configuration Check (isTelegramPostingConfigured)", () => {
    it("returns true when both TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID are present", () => {
      process.env.TELEGRAM_BOT_TOKEN = "123456:ABC-DEF";
      process.env.TELEGRAM_CHANNEL_ID = "@my_channel";
      expect(isTelegramPostingConfigured()).toBe(true);
    });

    it("returns false when TELEGRAM_BOT_TOKEN is missing", () => {
      delete process.env.TELEGRAM_BOT_TOKEN;
      process.env.TELEGRAM_CHANNEL_ID = "@my_channel";
      expect(isTelegramPostingConfigured()).toBe(false);
    });

    it("returns false when TELEGRAM_CHANNEL_ID is missing", () => {
      process.env.TELEGRAM_BOT_TOKEN = "123456:ABC-DEF";
      delete process.env.TELEGRAM_CHANNEL_ID;
      expect(isTelegramPostingConfigured()).toBe(false);
    });

    it("returns false when both are missing", () => {
      delete process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.TELEGRAM_CHANNEL_ID;
      expect(isTelegramPostingConfigured()).toBe(false);
    });
  });

  describe("HTML Formatting and Escaping", () => {
    it("escapes special HTML characters correctly", () => {
      expect(escapeHtml("<script>alert('x & y')</script>")).toBe(
        "&lt;script&gt;alert('x &amp; y')&lt;/script&gt;",
      );
    });

    it("formats message with fixed salary", () => {
      const posting: TelegramJobPostingData = {
        title: "Senior Physics Teacher",
        companyTagline: "Inspiring future scientists",
        schoolName: "TimhirtHub International Academy",
        employmentType: "FULL_TIME",
        location: "Main Campus",
        salaryType: "FIXED",
        salaryFixedAmount: 32000,
        salaryCurrency: "ETB",
        closingDate: new Date("2026-11-15"),
        publicJobUrl: "https://timhirthub.edu.et/careers/timhirthub-academy/senior-physics-teacher",
      };

      const html = formatJobPostingTelegramHtml(posting);
      expect(html).toContain("<b>Senior Physics Teacher</b>");
      expect(html).toContain("<i>Inspiring future scientists</i>");
      expect(html).toContain("🏛 <b>TimhirtHub International Academy</b>");
      expect(html).toContain("💼 <b>Type:</b> Full-Time");
      expect(html).toContain("💰 <b>Compensation:</b> 32,000 ETB");
      expect(html).toContain("📅 <b>Apply Before:</b> Nov 15, 2026");
      expect(html).toContain("👉 <b>Apply Online:</b>");
      expect(html).toContain("🌐 <b>Direct Link:</b>");
    });

    it("formats message with range salary", () => {
      const posting: TelegramJobPostingData = {
        title: "ICT Coordinator",
        employmentType: "FULL_TIME",
        location: "Tech Center",
        salaryType: "RANGE",
        salaryRange: "25,000 - 35,000 ETB",
        publicJobUrl: "https://timhirthub.edu.et/careers/timhirthub-academy/ict-coordinator",
      };

      const html = formatJobPostingTelegramHtml(posting);
      expect(html).toContain("💰 <b>Compensation:</b> 25,000 - 35,000 ETB");
    });

    it("formats message with negotiable salary", () => {
      const posting: TelegramJobPostingData = {
        title: "School Principal",
        salaryType: "NEGOTIABLE",
        publicJobUrl: "https://timhirthub.edu.et/careers/timhirthub-academy/school-principal",
      };

      const html = formatJobPostingTelegramHtml(posting);
      expect(html).toContain("💰 <b>Compensation:</b> Negotiable");
    });

    it("omits salary completely when salaryType is UNDISCLOSED", () => {
      const posting: TelegramJobPostingData = {
        title: "School Nurse",
        salaryType: "UNDISCLOSED",
        salaryRange: "Secret Amount",
        salaryFixedAmount: 99999,
        publicJobUrl: "https://timhirthub.edu.et/careers/timhirthub-academy/school-nurse",
      };

      const html = formatJobPostingTelegramHtml(posting);
      expect(html).not.toContain("Compensation");
      expect(html).not.toContain("Secret Amount");
      expect(html).not.toContain("99999");
    });
  });

  describe("API Calling & Payload Handling (postJobToTelegram)", () => {
    it("no-ops cleanly when TELEGRAM_BOT_TOKEN or TELEGRAM_CHANNEL_ID is missing", async () => {
      delete process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.TELEGRAM_CHANNEL_ID;

      const fetchSpy = vi.spyOn(global, "fetch");

      const result = await postJobToTelegram({
        title: "Math Teacher",
        publicJobUrl: "https://timhirthub.edu.et/careers/demo/math-teacher",
      });

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("sends message via sendMessage when no bannerImageUrl is provided", async () => {
      process.env.TELEGRAM_BOT_TOKEN = "test_bot_token_123";
      process.env.TELEGRAM_CHANNEL_ID = "@timhirthub_careers";

      const mockResponse = {
        ok: true,
        result: { message_id: 8891 },
      };

      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as any);

      const result = await postJobToTelegram({
        title: "English Teacher",
        employmentType: "PART_TIME",
        publicJobUrl: "https://timhirthub.edu.et/careers/demo/english-teacher",
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe(8891);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe("https://api.telegram.org/bottest_bot_token_123/sendMessage");
      const parsedBody = JSON.parse((options?.body as string) || "{}");
      expect(parsedBody.chat_id).toBe("@timhirthub_careers");
      expect(parsedBody.parse_mode).toBe("HTML");
      expect(parsedBody.text).toContain("English Teacher");
    });

    it("sends photo via sendPhoto when bannerImageUrl is present and caption is <= 1024 chars", async () => {
      process.env.TELEGRAM_BOT_TOKEN = "test_bot_token_123";
      process.env.TELEGRAM_CHANNEL_ID = "-1001234567890";

      const mockResponse = {
        ok: true,
        result: { message_id: 9912 },
      };

      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as any);

      const result = await postJobToTelegram({
        title: "Biology Teacher",
        bannerImageUrl: "https://res.cloudinary.com/demo/image/upload/banner.png",
        publicJobUrl: "https://timhirthub.edu.et/careers/demo/biology-teacher",
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe(9912);

      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe("https://api.telegram.org/bottest_bot_token_123/sendPhoto");
      const parsedBody = JSON.parse((options?.body as string) || "{}");
      expect(parsedBody.chat_id).toBe("-1001234567890");
      expect(parsedBody.photo).toBe("https://res.cloudinary.com/demo/image/upload/banner.png");
      expect(parsedBody.caption).toContain("Biology Teacher");
    });

    it("falls back to sendMessage if message exceeds 1024 chars even when bannerImageUrl is present", async () => {
      process.env.TELEGRAM_BOT_TOKEN = "test_bot_token_123";
      process.env.TELEGRAM_CHANNEL_ID = "@timhirthub_careers";

      const longTagline = "A".repeat(1100);

      const mockResponse = {
        ok: true,
        result: { message_id: 9955 },
      };

      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as any);

      const result = await postJobToTelegram({
        title: "Dean of Academic Affairs",
        companyTagline: longTagline,
        bannerImageUrl: "https://res.cloudinary.com/demo/image/upload/banner.png",
        publicJobUrl: "https://timhirthub.edu.et/careers/demo/dean",
      });

      expect(result.success).toBe(true);
      const [url] = fetchSpy.mock.calls[0];
      // Should fall back to sendMessage
      expect(url).toBe("https://api.telegram.org/bottest_bot_token_123/sendMessage");
    });

    it("handles non-2xx or ok:false API responses gracefully without throwing", async () => {
      process.env.TELEGRAM_BOT_TOKEN = "test_bot_token_123";
      process.env.TELEGRAM_CHANNEL_ID = "@invalid_channel";

      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({ ok: false, error_code: 400, description: "chat not found" }),
      } as any);

      const result = await postJobToTelegram({
        title: "Art Teacher",
        publicJobUrl: "https://timhirthub.edu.et/careers/demo/art-teacher",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("chat not found");
    });

    it("handles fetch network exceptions gracefully without throwing", async () => {
      process.env.TELEGRAM_BOT_TOKEN = "test_bot_token_123";
      process.env.TELEGRAM_CHANNEL_ID = "@timhirthub_careers";

      vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Connection timeout"));

      const result = await postJobToTelegram({
        title: "Music Teacher",
        publicJobUrl: "https://timhirthub.edu.et/careers/demo/music-teacher",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Connection timeout");
    });
  });

  describe("Telegram Deletion Utility (deleteTelegramMessage)", () => {
    it("returns error when botToken is not configured", async () => {
      delete process.env.TELEGRAM_BOT_TOKEN;
      process.env.TELEGRAM_CHANNEL_ID = "@timhirthub_careers";

      const result = await deleteTelegramMessage("@timhirthub_careers", 1234);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing botToken, channelId, or messageId");
    });

    it("returns error when messageId is missing", async () => {
      process.env.TELEGRAM_BOT_TOKEN = "test_bot_token_123";
      process.env.TELEGRAM_CHANNEL_ID = "@timhirthub_careers";

      const result = await deleteTelegramMessage("@timhirthub_careers", null);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing botToken, channelId, or messageId");
    });

    it("returns error when targetChannel is missing and process.env.TELEGRAM_CHANNEL_ID is unset", async () => {
      process.env.TELEGRAM_BOT_TOKEN = "test_bot_token_123";
      delete process.env.TELEGRAM_CHANNEL_ID;

      const result = await deleteTelegramMessage(null, 1234);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing botToken, channelId, or messageId");
    });

    it("successfully deletes message when valid channelId and messageId are provided", async () => {
      process.env.TELEGRAM_BOT_TOKEN = "test_bot_token_123";

      const mockResponse = { ok: true, result: true };
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as any);

      const result = await deleteTelegramMessage("@custom_channel", 4567);
      expect(result.success).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe("https://api.telegram.org/bottest_bot_token_123/deleteMessage");
      const parsedBody = JSON.parse((options?.body as string) || "{}");
      expect(parsedBody.chat_id).toBe("@custom_channel");
      expect(parsedBody.message_id).toBe(4567);
    });

    it("falls back to process.env.TELEGRAM_CHANNEL_ID when channelId argument is omitted", async () => {
      process.env.TELEGRAM_BOT_TOKEN = "test_bot_token_123";
      process.env.TELEGRAM_CHANNEL_ID = "@default_channel";

      const mockResponse = { ok: true, result: true };
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as any);

      const result = await deleteTelegramMessage(undefined, 7890);
      expect(result.success).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const [, options] = fetchSpy.mock.calls[0];
      const parsedBody = JSON.parse((options?.body as string) || "{}");
      expect(parsedBody.chat_id).toBe("@default_channel");
      expect(parsedBody.message_id).toBe(7890);
    });

    it("handles Telegram API delete error (e.g. message not found) gracefully", async () => {
      process.env.TELEGRAM_BOT_TOKEN = "test_bot_token_123";
      process.env.TELEGRAM_CHANNEL_ID = "@default_channel";

      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({
          ok: false,
          error_code: 400,
          description: "Bad Request: message to delete not found",
        }),
      } as any);

      const result = await deleteTelegramMessage("@default_channel", 9999);
      expect(result.success).toBe(false);
      expect(result.error).toContain("message to delete not found");
    });

    it("handles network error gracefully when deleting message", async () => {
      process.env.TELEGRAM_BOT_TOKEN = "test_bot_token_123";
      process.env.TELEGRAM_CHANNEL_ID = "@default_channel";

      vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Network disconnect"));

      const result = await deleteTelegramMessage("@default_channel", 9999);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Network disconnect");
    });
  });
});

