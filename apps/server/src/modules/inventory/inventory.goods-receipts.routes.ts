import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Role, ItemCondition } from "@prisma/client";
import { authorize } from "../../middleware/auth";
import { sendSuccess, sendCreated, paginationMeta } from "../../utils/response";
import {
  createGoodsReceipt,
  getGoodsReceipts,
} from "./inventory.service";

const router = Router();
const staffGuard = authorize(Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER, Role.FINANCE);
const managerGuard = authorize(Role.ADMIN, Role.SUPER_ADMIN, Role.FINANCE);

const goodsReceiptLineSchema = z.object({
  poLineId: z.string().uuid().optional().nullable(),
  itemId: z.string().uuid().optional().nullable(),
  quantityReceived: z.number().int().positive("Quantity received must be positive"),
  conditionOnArrival: z.nativeEnum(ItemCondition).optional(),
  serialNumbers: z.array(z.string()).optional(),
  unitCost: z.number().nonnegative().optional(),
});

const createGoodsReceiptSchema = z.object({
  poId: z.string().uuid().optional().nullable(),
  locationId: z.string().uuid("Receiving location ID must be a valid UUID"),
  notes: z.string().optional().nullable(),
  discrepancyNotes: z.string().optional().nullable(),
  lines: z.array(goodsReceiptLineSchema).min(1, "At least one goods receipt line is required"),
});

/**
 * @openapi
 * /api/v1/inventory/goods-receipts:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: List goods receipts (GRNs) with pagination
 */
router.get("/", staffGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit } = req.query;
    const result = await getGoodsReceipts(req.user.schoolId, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
    return sendSuccess(
      res,
      result.receipts,
      "Goods receipts retrieved successfully",
      200,
      paginationMeta(result.page, result.limit, result.total),
    );
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/goods-receipts:
 *   post:
 *     tags:
 *       - Inventory
 *     summary: Record goods received (stock-in) at a receiving store location (manual or PO-linked)
 */
router.post("/", managerGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createGoodsReceiptSchema.parse(req.body);
    const receipt = await createGoodsReceipt(req.user.schoolId, data, req.user.id, req);
    return sendCreated(res, receipt, "Goods receipt recorded and stock updated");
  } catch (err) {
    next(err);
  }
});

export default router;
