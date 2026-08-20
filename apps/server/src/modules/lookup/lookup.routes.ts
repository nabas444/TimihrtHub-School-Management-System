import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { db } from "../../config/database";
import { AppError } from "../../middleware/errorHandler";
import { sendSuccess, sendCreated } from "../../utils/response";
import { authorize } from "../../middleware/auth";

const router = Router();
const isAdmin = [Role.ADMIN, Role.SUPER_ADMIN];

const LookupValueTypeEnum = z.enum([
  "RELIGION",
  "CATEGORY",
  "FEE_CATEGORY",
  "SOURCE",
  "HOUSE",
  "CURRICULUM",
  "PREVIOUS_SCHOOL",
]);

// ── GET /api/v1/lookup-values ────────────────────────────────────────────────
// List all lookup values for the tenant school, with optional type & active filter
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, isActive } = req.query;

    const where: any = {
      schoolId: req.user.schoolId,
    };

    if (type && typeof type === "string") {
      where.type = type.toUpperCase();
    }

    if (isActive !== undefined) {
      where.isActive = isActive === "true";
    }

    const items = await db.lookupValue.findMany({
      where,
      orderBy: [{ type: "asc" }, { value: "asc" }],
    });

    sendSuccess(res, items);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/lookup-values ───────────────────────────────────────────────
// Create new lookup value (Admin only)
router.post(
  "/",
  authorize(...isAdmin),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = z
        .object({
          type: z.string().min(1),
          value: z.string().min(1).max(100),
          colorHex: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional().nullable(),
          isActive: z.boolean().optional().default(true),
        })
        .parse(req.body);

      const normalizedType = data.type.toUpperCase().trim();
      const normalizedValue = data.value.trim();

      // Check if already exists in this school
      const existing = await db.lookupValue.findFirst({
        where: {
          schoolId: req.user.schoolId,
          type: normalizedType,
          value: { equals: normalizedValue, mode: "insensitive" },
        },
      });

      if (existing) {
        // If inactive, reactivate it
        if (!existing.isActive) {
          const updated = await db.lookupValue.update({
            where: { id: existing.id },
            data: { isActive: true, colorHex: data.colorHex ?? existing.colorHex },
          });
          return sendSuccess(res, updated, "Lookup value reactivated", 200);
        }
        return sendSuccess(res, existing, "Lookup value already exists", 200);
      }

      const lookup = await db.lookupValue.create({
        data: {
          schoolId: req.user.schoolId,
          type: normalizedType,
          value: normalizedValue,
          colorHex: data.colorHex ?? null,
          isActive: data.isActive,
        },
      });

      sendCreated(res, lookup, "Lookup value created successfully");
    } catch (err) {
      next(err);
    }
  },
);

// ── PATCH /api/v1/lookup-values/:id ──────────────────────────────────────────
// Update lookup value (Admin only)
router.patch(
  "/:id",
  authorize(...isAdmin),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = z
        .object({
          value: z.string().min(1).max(100).optional(),
          colorHex: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional().nullable(),
          isActive: z.boolean().optional(),
        })
        .parse(req.body);

      const existing = await db.lookupValue.findFirst({
        where: { id: req.params.id, schoolId: req.user.schoolId },
      });

      if (!existing) {
        throw new AppError("Lookup value not found", 404);
      }

      const updated = await db.lookupValue.update({
        where: { id: req.params.id },
        data: {
          ...(data.value !== undefined && { value: data.value.trim() }),
          ...(data.colorHex !== undefined && { colorHex: data.colorHex }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });

      sendSuccess(res, updated, "Lookup value updated");
    } catch (err) {
      next(err);
    }
  },
);

// ── DELETE /api/v1/lookup-values/:id ─────────────────────────────────────────
// Delete lookup value (Admin only)
router.delete(
  "/:id",
  authorize(...isAdmin),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await db.lookupValue.findFirst({
        where: { id: req.params.id, schoolId: req.user.schoolId },
      });

      if (!existing) {
        throw new AppError("Lookup value not found", 404);
      }

      await db.lookupValue.delete({
        where: { id: req.params.id },
      });

      sendSuccess(res, null, "Lookup value deleted successfully");
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /api/v1/lookup-values/bus-routes ─────────────────────────────────────
router.get(
  "/bus-routes",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const routes = await db.busRoute.findMany({
        where: { schoolId: req.user.schoolId, isActive: true },
        orderBy: { name: "asc" },
      });
      sendSuccess(res, routes);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
