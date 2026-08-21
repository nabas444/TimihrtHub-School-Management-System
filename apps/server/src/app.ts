import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import morgan from "morgan";

import { connectDatabase } from "./config/database";
import { connectRedis } from "./config/redis";
import { initSocket } from "./config/socket";
import { logger } from "./utils/logger";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { apiLimiter } from "./middleware/rateLimiter";
import { authenticate } from "./middleware/auth";
import { tenantGuard } from "./middleware/tenancy";

// ── Route imports ────────────────────────────────────────────────────────────
import authRoutes from "./modules/auth/auth.routes";
import userRoutes from "./modules/users/users.routes";
import schoolRoutes from "./modules/schools/schools.routes";
import academicsRoutes from "./modules/academics/academics.routes";
import attendanceRoutes from "./modules/attendance/attendance.routes";
import behaviourRoutes from "./modules/behaviour/behaviour.routes";
import timetableRoutes from "./modules/timetable/timetable.routes";
import chatRoutes from "./modules/chat/chat.routes";
import announcementRoutes from "./modules/announcements/announcements.routes";
import meetingRoutes from "./modules/meetings/meetings.routes";
import feeRoutes from "./modules/fees/fees.routes";
import aiRoutes from "./modules/ai/ai.routes";
import notificationRoutes from "./modules/notifications/notifications.routes";
import libraryRoutes from "./modules/library/library.routes";
import staffRoutes from "./modules/staff/staff.routes";
import fileRoutes from "./modules/files/files.routes";
import billingRoutes, { handleStripeWebhook } from "./modules/billing/billing.routes";
import deadlineRoutes from "./modules/deadlines/deadlines.routes";
import clubRoutes from "./modules/clubs/clubs.routes";
import lookupRoutes from "./modules/lookup/lookup.routes";
import idCardRoutes from "./modules/id-cards/id-cards.routes";
import reportCardRoutes from "./modules/report-cards/report-cards.routes";
import certificateRoutes from "./modules/certificates/certificates.routes";
import annualPlanRoutes from "./modules/annual-plans/annual-plans.routes";
import studentSupportRoutes from "./modules/student-support/student-support.routes";
import tutorialRoutes from "./modules/tutorials/tutorials.routes";
import externalExamRoutes from "./modules/external-exams/external-exams.routes";
import ceremonyRoutes from "./modules/ceremonies/ceremonies.routes";
import employeeRoutes from "./modules/employees/employees.routes";
import { protectedRecruitingRouter as recruitingRoutes, publicRecruitingRouter } from "./modules/recruiting/recruiting.routes";
import parentRoutes from "./modules/parents/parents.routes";
import curriculumRoutes from "./modules/curriculum/curriculum.routes";
import policyRoutes, { publicPoliciesRouter } from "./modules/policies/policies.routes";
import { protectedAdmissionsRouter as admissionsRoutes, publicAdmissionsRouter } from "./modules/admissions/admissions.routes";
import auditLogRoutes from "./modules/audit-logs/audit-logs.routes";
import hostelRoutes from "./modules/hostel/hostel.routes";

// ── Background job workers ───────────────────────────────────────────────────
// Importing these starts their BullMQ Worker instances (side effect on import).
// Done explicitly here — rather than relying on some other module happening to
// import them first — so it's obvious the queue consumers are actually running.
import "./jobs/emailWorker";
import "./jobs/notifWorker";
import "./jobs/telegramWorker";
import { startDeadlineEngine } from "./jobs/deadlineEngine";

const app = express();
const httpServer = http.createServer(app);

// ── Trust proxy (needed behind nginx/load balancer) ──────────────────────────
app.set("trust proxy", 1);

// ── Core middleware ──────────────────────────────────────────────────────────
app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = (process.env.CLIENT_URL ?? "http://localhost:3000")
        .split(",")
        .map((url) => url.trim());
      if (!origin || allowed.includes(origin)) callback(null, true);
      else callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// Stripe webhook needs raw body and no JWT auth — register BEFORE json middleware and auth
app.post(
  "/api/v1/billing/webhook",
  express.raw({ type: "application/json" }),
  handleStripeWebhook,
);

app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

if (process.env.NODE_ENV !== "test") {
  app.use(
    morgan("combined", {
      stream: { write: (msg) => logger.http(msg.trim()) },
    }),
  );
}

// ── Rate limiting ────────────────────────────────────────────────────────────
app.use("/api/", apiLimiter);

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (_, res) => {
  res.json({
    status: "ok",
    service: "TimhirtHub API",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

app.get("/", (_, res) => {
  res.json({
    success: true,
    message:
      "TimhirtHub API is running. Visit the frontend at http://localhost:3000.",
    frontend: "http://localhost:3000",
    health: "/health",
  });
});

// ── API Routes ───────────────────────────────────────────────────────────────
// Public (no auth required)
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/recruiting/public", publicRecruitingRouter);
app.use("/api/v1/policies/public", publicPoliciesRouter);
app.use("/api/v1/admissions/public", publicAdmissionsRouter);

// Protected (auth + tenant guard applied globally)
app.use("/api/v1", authenticate, tenantGuard);

// Protected route modules
app.use("/api/v1/audit-logs", auditLogRoutes);
app.use("/api/v1/admissions", admissionsRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/schools", schoolRoutes);
app.use("/api/v1/academics", academicsRoutes);
app.use("/api/v1/attendance", attendanceRoutes);
app.use("/api/v1/behaviour", behaviourRoutes);
app.use("/api/v1/timetable", timetableRoutes);
app.use("/api/v1/chat", chatRoutes);
app.use("/api/v1/announcements", announcementRoutes);
app.use("/api/v1/meetings", meetingRoutes);
app.use("/api/v1/fees", feeRoutes);
app.use("/api/v1/ai", aiRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/library", libraryRoutes);
app.use("/api/v1/staff", staffRoutes);
app.use("/api/v1/employees", employeeRoutes);
app.use("/api/v1/recruiting", recruitingRoutes);
app.use("/api/v1/parents", parentRoutes);
app.use("/api/v1/files", fileRoutes);
app.use("/api/v1/billing", billingRoutes);
app.use("/api/v1/deadlines", deadlineRoutes);
app.use("/api/v1/clubs", clubRoutes);
app.use("/api/v1/lookup-values", lookupRoutes);
app.use("/api/v1/id-cards", idCardRoutes);
app.use("/api/v1/academic-year-summaries", reportCardRoutes);
app.use("/api/v1/report-cards", reportCardRoutes);
app.use("/api/v1/certificates", certificateRoutes);
app.use("/api/v1/annual-plans", annualPlanRoutes);
app.use("/api/v1/student-support", studentSupportRoutes);
app.use("/api/v1/tutorial-sessions", tutorialRoutes);
app.use("/api/v1/external-exams", externalExamRoutes);
app.use("/api/v1/external-exam-checkpoints", externalExamRoutes);
app.use("/api/v1/external-exam-records", externalExamRoutes);
app.use("/api/v1/ceremonies", ceremonyRoutes);
app.use("/api/v1/ceremony-events", ceremonyRoutes);
app.use("/api/v1/ceremony-participants", ceremonyRoutes);
app.use("/api/v1/curriculum", curriculumRoutes);
app.use("/api/v1/curriculum-standards", curriculumRoutes);
app.use("/api/v1/curriculum-units", curriculumRoutes);
app.use("/api/v1/policies", policyRoutes);
app.use("/api/v1/policy-versions", policyRoutes);
app.use("/api/v1/hostels", hostelRoutes);

// ── 404 + Error handlers ─────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ── Socket.IO ────────────────────────────────────────────────────────────────
initSocket(httpServer);

// ── Startup ───────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? "5000");

const start = async () => {
  try {
    await connectDatabase();
    await connectRedis();

    // Start background deadline engine (periodic offline evaluation & notification dispatch)
    startDeadlineEngine(5);

    httpServer.listen(PORT, () => {
      logger.info(`
╔══════════════════════════════════════════════════╗
║         TimhirtHub API Server                    ║
╠══════════════════════════════════════════════════╣
║  Port     : ${PORT}                               
║  Mode     : ${process.env.NODE_ENV ?? "development"}
║  API Base : http://localhost:${PORT}/api/v1
║  Health   : http://localhost:${PORT}/health
╚══════════════════════════════════════════════════╝
      `);
    });
  } catch (err) {
    logger.error("Failed to start server:", err);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info(`${signal} received — shutting down gracefully`);
  httpServer.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start();

export default app;
