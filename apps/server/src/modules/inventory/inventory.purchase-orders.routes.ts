import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Role, PurchaseOrderStatus } from "@prisma/client";
import { authorize } from "../../middleware/auth";
import { sendSuccess, sendCreated, paginationMeta } from "../../utils/response";
import {
  createPurchaseOrder,
  updatePurchaseOrder,
  approvePurchaseOrder,
  orderPurchaseOrder,
  cancelPurchaseOrder,
  getPurchaseOrders,
  getPurchaseOrderById,
} from "./inventory.service";

const router = Router();
const staffGuard = authorize(Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER, Role.FINANCE);
const managerGuard = authorize(Role.ADMIN, Role.SUPER_ADMIN, Role.FINANCE);

const poLineSchema = z.object({
  itemId: z.string().uuid().optional().nullable(),
  description: z.string().min(1, "Item description is required"),
  quantityOrdered: z.number().int().positive("Quantity ordered must be positive"),
  unitCost: z.number().nonnegative("Unit cost must be non-negative"),
});

const createPurchaseOrderSchema = z.object({
  supplierId: z.string().uuid("Supplier ID must be a valid UUID"),
  requestId: z.string().uuid().optional().nullable(),
  status: z.nativeEnum(PurchaseOrderStatus).optional(),
  expectedDeliveryDate: z.string().optional().nullable(),
  currency: z.string().optional(),
  notes: z.string().optional().nullable(),
  lines: z.array(poLineSchema).min(1, "At least one purchase order line is required"),
});

const updatePurchaseOrderSchema = createPurchaseOrderSchema.partial();

/**
 * @openapi
 * /api/v1/inventory/purchase-orders:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: List purchase orders with filters, search, and pagination
 */
router.get("/", staffGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { supplierId, status, search, page, limit } = req.query;
    const result = await getPurchaseOrders(req.user.schoolId, {
      supplierId: supplierId as string | undefined,
      status: status as PurchaseOrderStatus | undefined,
      search: search as string | undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
    return sendSuccess(
      res,
      result.purchaseOrders,
      "Purchase orders retrieved",
      200,
      paginationMeta(result.page, result.limit, result.total),
    );
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/purchase-orders/{id}:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: Get single purchase order with line items, supplier, and receipts
 */
router.get("/:id", staffGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const po = await getPurchaseOrderById(req.user.schoolId, req.params.id);
    return sendSuccess(res, po, "Purchase order details retrieved");
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/purchase-orders:
 *   post:
 *     tags:
 *       - Inventory
 *     summary: Create new purchase order in DRAFT or SUBMITTED status
 */
router.post("/", managerGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createPurchaseOrderSchema.parse(req.body);
    const po = await createPurchaseOrder(req.user.schoolId, data, req.user.id, req);
    return sendCreated(res, po, "Purchase order created successfully");
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/purchase-orders/{id}:
 *   put:
 *     tags:
 *       - Inventory
 *     summary: Update a draft or submitted purchase order
 */
router.put("/:id", managerGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updatePurchaseOrderSchema.parse(req.body);
    const po = await updatePurchaseOrder(req.user.schoolId, req.params.id, data, req.user.id, req);
    return sendSuccess(res, po, "Purchase order updated successfully");
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/purchase-orders/{id}/approve:
 *   patch:
 *     tags:
 *       - Inventory
 *     summary: Approve a purchase order (routes high-value POs to FINANCE or SUPER_ADMIN)
 */
router.patch("/:id/approve", managerGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const approved = await approvePurchaseOrder(
      req.user.schoolId,
      req.params.id,
      { id: req.user.id, role: req.user.role as Role, email: req.user.email },
      req,
    );
    return sendSuccess(res, approved, "Purchase order approved successfully");
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/purchase-orders/{id}/order:
 *   patch:
 *     tags:
 *       - Inventory
 *     summary: Mark an approved purchase order as ORDERED (sent to supplier)
 */
router.patch("/:id/order", managerGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ordered = await orderPurchaseOrder(req.user.schoolId, req.params.id, req.user.id, req);
    return sendSuccess(res, ordered, "Purchase order marked as ORDERED");
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/purchase-orders/{id}/cancel:
 *   patch:
 *     tags:
 *       - Inventory
 *     summary: Cancel a purchase order
 */
router.patch("/:id/cancel", managerGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cancelled = await cancelPurchaseOrder(req.user.schoolId, req.params.id, req.user.id, req);
    return sendSuccess(res, cancelled, "Purchase order cancelled");
  } catch (err) {
    next(err);
  }
});

export default router;
