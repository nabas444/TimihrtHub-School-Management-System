import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Role, ItemType, ItemLifecycleStatus, ItemCondition, DepreciationMethod } from "@prisma/client";
import { authorize } from "../../middleware/auth";
import { sendSuccess, sendCreated, paginationMeta } from "../../utils/response";
import {
  getInventoryItems,
  getLowStockItems,
  getItemById,
  getItemHistory,
  generateItemQRCode,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
} from "./inventory.service";

const router = Router();
const staffGuard = authorize(Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER, Role.FINANCE);
const managerGuard = authorize(Role.ADMIN, Role.SUPER_ADMIN);

const createItemSchema = z.object({
  categoryId: z.string().uuid("Category ID must be a valid UUID"),
  name: z.string().min(1, "Item name is required"),
  itemType: z.nativeEnum(ItemType),
  sku: z.string().optional().nullable(),
  barcodeNumber: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  unit: z.string().optional(),
  imageUrl: z.string().optional().nullable(),
  currentLocationId: z.string().uuid().optional().nullable(),
  preferredSupplierId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),

  // Fixed Asset fields
  serialNumber: z.string().optional().nullable(),
  assetTagNumber: z.string().optional().nullable(),
  purchaseDate: z.string().optional().nullable(),
  purchaseCost: z.number().nonnegative().optional().nullable(),
  warrantyExpiresAt: z.string().optional().nullable(),
  depreciationMethod: z.nativeEnum(DepreciationMethod).optional(),
  usefulLifeMonths: z.number().int().positive().optional().nullable(),
  salvageValue: z.number().nonnegative().optional().nullable(),

  // Consumable fields
  quantityOnHand: z.number().int().nonnegative().optional(),
  reorderPoint: z.number().int().nonnegative().optional().nullable(),
  reorderQty: z.number().int().positive().optional().nullable(),
  unitCost: z.number().nonnegative().optional().nullable(),
});

const updateItemSchema = createItemSchema.partial();

/**
 * @openapi
 * /api/v1/inventory/items/low-stock:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: Retrieve consumable items currently at or below their reorder threshold
 */
router.get("/low-stock", staffGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const lowStockItems = await getLowStockItems(req.user.schoolId);
    return sendSuccess(res, lowStockItems, "Low-stock inventory items retrieved");
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/items:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: List inventory catalog items with rich filtering and pagination
 */
router.get("/", staffGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, categoryId, itemType, status, condition, locationId, page, limit } = req.query;
    const result = await getInventoryItems(req.user.schoolId, {
      search: search as string | undefined,
      categoryId: categoryId as string | undefined,
      itemType: itemType as ItemType | undefined,
      status: status as ItemLifecycleStatus | undefined,
      condition: condition as ItemCondition | undefined,
      locationId: locationId as string | undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
    return sendSuccess(
      res,
      result.items,
      "Inventory catalog retrieved successfully",
      200,
      paginationMeta(result.page, result.limit, result.total),
    );
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/items/{id}/history:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: Get complete ledger timeline (movements, allocations, maintenance, disposals) for an asset
 */
router.get("/:id/history", staffGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const history = await getItemHistory(req.user.schoolId, req.params.id);
    return sendSuccess(res, history, "Item ledger history retrieved");
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/items/{id}/qrcode:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: Generate lightweight QR code on-demand for barcode/assetTag
 */
router.get("/:id/qrcode", staffGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const qrResult = await generateItemQRCode(req.user.schoolId, req.params.id);
    return sendSuccess(res, qrResult, "Asset QR code generated");
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/items/{id}:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: Get single inventory item details
 */
router.get("/:id", staffGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await getItemById(req.user.schoolId, req.params.id);
    return sendSuccess(res, item, "Inventory item details retrieved");
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/items:
 *   post:
 *     tags:
 *       - Inventory
 *     summary: Create new item in catalog and initialize stock in movement ledger
 */
router.post("/", managerGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createItemSchema.parse(req.body);
    const item = await createInventoryItem(req.user.schoolId, data, req.user.id, req);
    return sendCreated(res, item, "Inventory item created and stock-in recorded");
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/items/{id}:
 *   put:
 *     tags:
 *       - Inventory
 *     summary: Update inventory item specifications
 */
router.put("/:id", managerGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateItemSchema.parse(req.body);
    const item = await updateInventoryItem(req.user.schoolId, req.params.id, data, req.user.id, req);
    return sendSuccess(res, item, "Inventory item updated successfully");
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/items/{id}:
 *   delete:
 *     tags:
 *       - Inventory
 *     summary: Deactivate catalog item (blocks if active allocation exists)
 */
router.delete("/:id", managerGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await deleteInventoryItem(req.user.schoolId, req.params.id, req);
    return sendSuccess(res, result, "Inventory item deactivated successfully");
  } catch (err) {
    next(err);
  }
});

export default router;
