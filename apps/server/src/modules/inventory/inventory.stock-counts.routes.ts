import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { authorize } from "../../middleware/auth";
import { sendSuccess, sendCreated, paginationMeta } from "../../utils/response";
import {
  createStockCount,
  updateStockCountLines,
  reconcileStockCount,
  getStockCounts,
  getStockCountById,
} from "./inventory.service";

const router = Router();
const staffGuard = authorize(Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER, Role.FINANCE);
const managerGuard = authorize(Role.ADMIN, Role.SUPER_ADMIN, Role.FINANCE);

const createStockCountSchema = z.object({
  locationId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const stockCountLineUpdateSchema = z.object({
  lineId: z.string().uuid("Line ID must be a valid UUID"),
  countedQty: z.number().int().nonnegative("Counted quantity must be non-negative"),
  notes: z.string().optional().nullable(),
});

const updateLinesSchema = z.object({
  lines: z.array(stockCountLineUpdateSchema).min(1, "At least one count line is required"),
});

/**
 * @openapi
 * /api/v1/inventory/stock-counts:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: List physical stock count / audit events
 */
router.get("/", staffGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit } = req.query;
    const result = await getStockCounts(req.user.schoolId, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
    return sendSuccess(
      res,
      result.stockCounts,
      "Stock count events retrieved",
      200,
      paginationMeta(result.page, result.limit, result.total),
    );
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/stock-counts/{id}:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: Get single stock count event with items, counted values, and variances
 */
router.get("/:id", staffGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sc = await getStockCountById(req.user.schoolId, req.params.id);
    return sendSuccess(res, sc, "Stock count details retrieved");
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/stock-counts:
 *   post:
 *     tags:
 *       - Inventory
 *     summary: Initiate a new physical stock count / cycle count event
 */
router.post("/", managerGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createStockCountSchema.parse(req.body);
    const stockCount = await createStockCount(req.user.schoolId, data, req.user.id, req);
    return sendCreated(res, stockCount, "Stock count initiated");
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/stock-counts/{id}/lines:
 *   patch:
 *     tags:
 *       - Inventory
 *     summary: Record counted quantities and compute variance per line
 */
router.patch("/:id/lines", staffGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateLinesSchema.parse(req.body);
    const updated = await updateStockCountLines(req.user.schoolId, req.params.id, data.lines);
    return sendSuccess(res, updated, "Stock count lines updated");
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/stock-counts/{id}/reconcile:
 *   patch:
 *     tags:
 *       - Inventory
 *     summary: Complete stock count and auto-adjust stock quantities writing ADJUSTED ledger movements
 */
router.patch("/:id/reconcile", managerGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reconciled = await reconcileStockCount(req.user.schoolId, req.params.id, req.user.id, req);
    return sendSuccess(res, reconciled, "Stock count reconciled and inventory adjusted");
  } catch (err) {
    next(err);
  }
});

export default router;
