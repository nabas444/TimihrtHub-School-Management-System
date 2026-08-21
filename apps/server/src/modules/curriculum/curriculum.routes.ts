import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { authorize } from "../../middleware/auth";
import { sendSuccess, sendCreated } from "../../utils/response";
import * as CurriculumService from "./curriculum.service";

const router = Router();
const isStaff = [Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER];
const isAdmin = [Role.ADMIN, Role.SUPER_ADMIN];

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

const createStandardSchema = z.object({
  subjectId: z.string().min(1, "Subject is required"),
  gradeLevelId: z.string().optional().nullable(),
  curriculumId: z.string().optional().nullable(),
  code: z.string().min(1, "Standard code is required"),
  title: z.string().min(1, "Standard title is required"),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
});

const updateStandardSchema = z.object({
  code: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  gradeLevelId: z.string().optional().nullable(),
  curriculumId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

const createUnitSchema = z.object({
  subjectId: z.string().min(1, "Subject is required"),
  gradeLevelId: z.string().min(1, "Grade level is required"),
  curriculumId: z.string().optional().nullable(),
  academicYear: z.string().min(1, "Academic year is required"),
  unitNumber: z.number().int().positive().optional(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().nullable(),
  durationWeeks: z.number().int().positive().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  learningObjectives: z.array(z.any()).optional().default([]),
  assessmentMethod: z.string().optional().nullable(),
  keyResources: z.array(z.any()).optional().default([]),
  standardIds: z.array(z.string()).optional().default([]),
});

const updateUnitSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  unitNumber: z.number().int().positive().optional(),
  durationWeeks: z.number().int().positive().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  learningObjectives: z.array(z.any()).optional(),
  assessmentMethod: z.string().optional().nullable(),
  keyResources: z.array(z.any()).optional(),
  standardIds: z.array(z.string()).optional(),
  changeSummary: z.string().optional(),
});

const reviewUnitSchema = z.object({
  decision: z.enum(["APPROVED", "REVISION_REQUESTED"]),
  notes: z.string().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// STANDARDS CATALOG ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

router.get("/standards", authorize(...isStaff), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user.schoolId;
    const { subjectId, gradeLevelId, curriculumId, category, search, isActive } = req.query;

    const standards = await CurriculumService.listStandards(schoolId, {
      subjectId: subjectId as string | undefined,
      gradeLevelId: gradeLevelId as string | undefined,
      curriculumId: curriculumId as string | undefined,
      category: category as string | undefined,
      search: search as string | undefined,
      isActive: isActive !== undefined ? isActive === "true" : undefined,
    });

    sendSuccess(res, standards);
  } catch (err) {
    next(err);
  }
});

router.post("/standards", authorize(...isStaff), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user.schoolId;
    const body = createStandardSchema.parse(req.body);

    const standard = await CurriculumService.createStandard(schoolId, body);
    sendCreated(res, standard, "Curriculum standard created successfully");
  } catch (err) {
    next(err);
  }
});

router.patch("/standards/:id", authorize(...isStaff), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user.schoolId;
    const { id } = req.params;
    const body = updateStandardSchema.parse(req.body);

    const updated = await CurriculumService.updateStandard(schoolId, id, body);
    sendSuccess(res, updated, "Curriculum standard updated successfully");
  } catch (err) {
    next(err);
  }
});

router.delete("/standards/:id", authorize(...isAdmin), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user.schoolId;
    const { id } = req.params;

    const result = await CurriculumService.deleteStandard(schoolId, id);
    sendSuccess(res, result, "Curriculum standard deleted successfully");
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CURRICULUM UNITS & SCOPE & SEQUENCE ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

router.get("/units", authorize(...isStaff), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user.schoolId;
    const {
      subjectId,
      gradeLevelId,
      curriculumId,
      academicYear,
      status,
      search,
      teacherProfileId,
      createdById,
    } = req.query;

    const units = await CurriculumService.listUnits(schoolId, {
      subjectId: subjectId as string | undefined,
      gradeLevelId: gradeLevelId as string | undefined,
      curriculumId: curriculumId as string | undefined,
      academicYear: academicYear as string | undefined,
      status: status as string | undefined,
      search: search as string | undefined,
      teacherProfileId: teacherProfileId as string | undefined,
      createdById: createdById as string | undefined,
      userRole: req.user.role,
      userId: req.user.id,
    });

    sendSuccess(res, units);
  } catch (err) {
    next(err);
  }
});

router.get("/units/:id", authorize(...isStaff), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user.schoolId;
    const { id } = req.params;

    const unit = await CurriculumService.getUnit(schoolId, id);
    sendSuccess(res, unit);
  } catch (err) {
    next(err);
  }
});

router.post("/units", authorize(...isStaff), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user.schoolId;
    const userId = req.user.id;
    const userRole = req.user.role;
    const body = createUnitSchema.parse(req.body);

    const unit = await CurriculumService.createUnit(schoolId, userId, userRole, body);
    sendCreated(res, unit, "Curriculum unit created successfully");
  } catch (err) {
    next(err);
  }
});

router.patch("/units/:id", authorize(...isStaff), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user.schoolId;
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    const body = updateUnitSchema.parse(req.body);

    const updated = await CurriculumService.updateUnit(schoolId, id, userId, userRole, body);
    sendSuccess(res, updated, "Curriculum unit updated successfully");
  } catch (err) {
    next(err);
  }
});

router.delete("/units/:id", authorize(...isStaff), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user.schoolId;
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const result = await CurriculumService.deleteUnit(schoolId, id, userId, userRole);
    sendSuccess(res, result, "Curriculum unit deleted successfully");
  } catch (err) {
    next(err);
  }
});

router.post("/units/:id/submit", authorize(...isStaff), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user.schoolId;
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const unit = await CurriculumService.submitUnit(schoolId, id, userId, userRole);
    sendSuccess(res, unit, "Curriculum unit submitted for review");
  } catch (err) {
    next(err);
  }
});

router.post("/units/:id/review", authorize(...isAdmin), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user.schoolId;
    const { id } = req.params;
    const reviewerId = req.user.id;
    const body = reviewUnitSchema.parse(req.body);

    const unit = await CurriculumService.reviewUnit(
      schoolId,
      id,
      reviewerId,
      body.decision,
      body.notes,
    );

    sendSuccess(
      res,
      unit,
      body.decision === "APPROVED"
        ? "Curriculum unit approved successfully"
        : "Revision requested and returned to author",
    );
  } catch (err) {
    next(err);
  }
});

router.get("/units/:id/versions", authorize(...isStaff), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user.schoolId;
    const { id } = req.params;

    const versions = await CurriculumService.getUnitVersions(schoolId, id);
    sendSuccess(res, versions);
  } catch (err) {
    next(err);
  }
});

export default router;
