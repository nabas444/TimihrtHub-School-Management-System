import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Role, DisposalReason } from "@prisma/client";
import { authorize } from "../../middleware/auth";
import { sendSuccess, sendCreated, paginationMeta } from "../../utils/response";
import {
  createDisposalRecord,
  getDisposalRecords,
  calculateItemDepreciation,
  getItemById,
} from "./inventory.service";

const router = Router();
const staffGuard = authorize(Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER, Role.FINANCE);
const managerGuard = authorize(Role.ADMIN, Role.SUPER_ADMIN, Role.FINANCE);

const createDisposalSchema = z.object({
  itemId: z.string().uuid("Item ID must be a valid UUID"),
  reason: z.nativeEnum(DisposalReason),
  saleValue: z.number().nonnegative().optional(),
  disposalMethod: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

/**
 * @openapi
 * /api/v1/inventory/disposal:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: List decommissioned and disposed asset records
 */
router.get("/", staffGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit } = req.query;
    const result = await getDisposalRecords(req.user.schoolId, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
    return sendSuccess(
      res,
      result.disposals,
      "Disposal records retrieved",
      200,
      paginationMeta(result.page, result.limit, result.total),
    );
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/disposal/items/{id}/depreciation:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: Compute straight-line asset depreciation and current book value
 */
router.get("/items/:id/depreciation", staffGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await getItemById(req.user.schoolId, req.params.id);
    const dep = calculateItemDepreciation(item);
    return sendSuccess(res, dep, "Asset depreciation calculation retrieved");
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/disposal:
 *   post:
 *     tags:
 *       - Inventory
 *     summary: Decommission, write-off, or dispose an asset (freezes asset and records book value)
 */
router.post("/", managerGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createDisposalSchema.parse(req.body);
    const disposal = await createDisposalRecord(req.user.schoolId, data, req.user.id, req);
    return sendCreated(res, disposal, "Asset decommissioned and disposal record created");
  } catch (err) {
    next(err);
  }
});

export default router;
