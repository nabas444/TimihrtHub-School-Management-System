import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { authorize } from "../../middleware/auth";
import { sendSuccess, sendCreated } from "../../utils/response";
import * as PolicyService from "./policies.service";

const router = Router();
export const publicPoliciesRouter = Router();

const isStaff = [Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER, Role.FINANCE];
const isAdmin = [Role.ADMIN, Role.SUPER_ADMIN];

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

const createPolicySchema = z.object({
  category: z.enum([
    "SAFEGUARDING",
    "CODE_OF_CONDUCT",
    "ASSESSMENT",
    "ADMISSIONS",
    "HEALTH_SAFETY",
    "DATA_PROTECTION",
    "ANTI_BULLYING",
    "HR_EMPLOYMENT",
    "OTHER",
  ]),
  title: z.string().min(1, "Title is required"),
  summary: z.string().optional().nullable(),
  ownerId: z.string().min(1, "Policy owner is required"),
  targetAudience: z.enum(["ALL", "ALL_STAFF", "TEACHERS", "STUDENTS", "PARENTS"]).default("ALL_STAFF"),
  isPubliclyVisible: z.boolean().optional().default(false),
  nextReviewDate: z.string().optional().nullable(),
  reviewIntervalMonths: z.number().int().positive().optional().default(12),
  initialContent: z.string().min(1, "Initial policy content is required"),
  attachmentUrl: z.string().optional().nullable(),
  attachmentFileId: z.string().optional().nullable(),
});

const updatePolicySchema = z.object({
  category: z
    .enum([
      "SAFEGUARDING",
      "CODE_OF_CONDUCT",
      "ASSESSMENT",
      "ADMISSIONS",
      "HEALTH_SAFETY",
      "DATA_PROTECTION",
      "ANTI_BULLYING",
      "HR_EMPLOYMENT",
      "OTHER",
    ])
    .optional(),
  title: z.string().min(1).optional(),
  summary: z.string().optional().nullable(),
  ownerId: z.string().optional(),
  targetAudience: z.enum(["ALL", "ALL_STAFF", "TEACHERS", "STUDENTS", "PARENTS"]).optional(),
  isPubliclyVisible: z.boolean().optional(),
  nextReviewDate: z.string().optional().nullable(),
  reviewIntervalMonths: z.number().int().positive().optional(),
});

const createVersionSchema = z.object({
  versionNumber: z.string().min(1, "Version number is required (e.g. 1.1, 2.0)"),
  content: z.string().min(1, "Policy content is required"),
  attachmentUrl: z.string().optional().nullable(),
  attachmentFileId: z.string().optional().nullable(),
  changeSummary: z.string().min(1, "Change summary is required"),
});

const reviewVersionSchema = z.object({
  decision: z.enum(["APPROVED", "REVISION_REQUESTED"]),
  notes: z.string().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTHENTICATED POLICY ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

router.get("/my-acknowledgments", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user.schoolId;
    const userId = req.user.id;

    const pending = await PolicyService.getMyPendingAcknowledgments(schoolId, userId);
    sendSuccess(res, pending);
  } catch (err) {
    next(err);
  }
});

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user.schoolId;
    const { category, status, targetAudience, search, reviewDueSoon, isPubliclyVisible } = req.query;

    const policies = await PolicyService.listPolicies(schoolId, {
      category: category as string | undefined,
      status: status as string | undefined,
      targetAudience: targetAudience as string | undefined,
      search: search as string | undefined,
      reviewDueSoon: reviewDueSoon === "true",
      isPubliclyVisible: isPubliclyVisible !== undefined ? isPubliclyVisible === "true" : undefined,
    });

    sendSuccess(res, policies);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user.schoolId;
    const { id } = req.params;

    const policy = await PolicyService.getPolicy(schoolId, id);
    sendSuccess(res, policy);
  } catch (err) {
    next(err);
  }
});

router.post("/", authorize(...isStaff), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user.schoolId;
    const userId = req.user.id;
    const body = createPolicySchema.parse(req.body);

    const policy = await PolicyService.createPolicy(schoolId, userId, body);
    sendCreated(res, policy, "Policy document created successfully");
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", authorize(...isStaff), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user.schoolId;
    const { id } = req.params;
    const userId = req.user.id;
    const body = updatePolicySchema.parse(req.body);

    const policy = await PolicyService.updatePolicy(schoolId, id, userId, body);
    sendSuccess(res, policy, "Policy updated successfully");
  } catch (err) {
    next(err);
  }
});

router.post("/:id/versions", authorize(...isStaff), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user.schoolId;
    const { id } = req.params;
    const userId = req.user.id;
    const body = createVersionSchema.parse(req.body);

    const policy = await PolicyService.createPolicyVersion(schoolId, id, userId, body);
    sendCreated(res, policy, "New policy version drafted successfully");
  } catch (err) {
    next(err);
  }
});

router.post("/versions/:versionId/submit", authorize(...isStaff), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user.schoolId;
    const { versionId } = req.params;
    const userId = req.user.id;

    const policy = await PolicyService.submitPolicyVersion(schoolId, versionId, userId);
    sendSuccess(res, policy, "Policy version submitted for administrative approval");
  } catch (err) {
    next(err);
  }
});

router.post("/versions/:versionId/review", authorize(...isAdmin), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user.schoolId;
    const { versionId } = req.params;
    const reviewerId = req.user.id;
    const body = reviewVersionSchema.parse(req.body);

    const policy = await PolicyService.reviewPolicyVersion(
      schoolId,
      versionId,
      reviewerId,
      body.decision,
      body.notes,
    );

    sendSuccess(
      res,
      policy,
      body.decision === "APPROVED"
        ? "Policy version approved"
        : "Policy revision requested and returned to author",
    );
  } catch (err) {
    next(err);
  }
});

router.post("/:id/publish", authorize(...isAdmin), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user.schoolId;
    const { id } = req.params;
    const publisherId = req.user.id;
    const { versionId } = req.body;

    if (!versionId) {
      return res.status(400).json({ status: "error", message: "versionId is required in request body" });
    }

    const policy = await PolicyService.publishPolicy(schoolId, id, versionId, publisherId);
    sendSuccess(res, policy, "Policy published and distributed for recipient acknowledgment");
  } catch (err) {
    next(err);
  }
});

router.post("/versions/:versionId/acknowledge", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user.schoolId;
    const { versionId } = req.params;
    const userId = req.user.id;

    const metadata = {
      ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress,
      userAgent: req.headers["user-agent"],
    };

    const result = await PolicyService.acknowledgePolicy(schoolId, versionId, userId, metadata);
    sendSuccess(res, result, "Policy acknowledgment recorded");
  } catch (err) {
    next(err);
  }
});

router.get("/:id/acknowledgment-report", authorize(...isAdmin), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user.schoolId;
    const { id } = req.params;

    const report = await PolicyService.getAcknowledgmentReport(schoolId, id);
    sendSuccess(res, report);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ENDPOINTS (No Authentication Required)
// ─────────────────────────────────────────────────────────────────────────────

publicPoliciesRouter.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const policy = await PolicyService.getPublicPolicy(id);
    sendSuccess(res, policy);
  } catch (err) {
    next(err);
  }
});

export default router;
