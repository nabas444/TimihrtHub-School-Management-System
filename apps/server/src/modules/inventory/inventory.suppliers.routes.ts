import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { authorize } from "../../middleware/auth";
import { sendSuccess, sendCreated, paginationMeta } from "../../utils/response";
import {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from "./inventory.service";

const router = Router();
const staffGuard = authorize(Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER, Role.FINANCE);
const managerGuard = authorize(Role.ADMIN, Role.SUPER_ADMIN, Role.FINANCE);

const createSupplierSchema = z.object({
  name: z.string().min(1, "Supplier name is required"),
  contactName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  address: z.string().optional().nullable(),
  taxId: z.string().optional().nullable(),
  paymentTerms: z.string().optional().nullable(),
  rating: z.number().int().min(1).max(5).optional().nullable(),
});

const updateSupplierSchema = createSupplierSchema.partial().extend({
  isActive: z.boolean().optional(),
});

/**
 * @openapi
 * /api/v1/inventory/suppliers:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: List suppliers with search and pagination
 */
router.get("/", staffGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, isActive, page, limit } = req.query;
    const result = await getSuppliers(req.user.schoolId, {
      search: search as string | undefined,
      isActive: isActive !== undefined ? isActive === "true" : undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
    return sendSuccess(
      res,
      result.suppliers,
      "Suppliers retrieved successfully",
      200,
      paginationMeta(result.page, result.limit, result.total),
    );
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/suppliers/{id}:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: Get single supplier details and PO history
 */
router.get("/:id", staffGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supplier = await getSupplierById(req.user.schoolId, req.params.id);
    return sendSuccess(res, supplier, "Supplier details retrieved");
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/suppliers:
 *   post:
 *     tags:
 *       - Inventory
 *     summary: Register a new supplier / vendor
 */
router.post("/", managerGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createSupplierSchema.parse(req.body);
    const supplier = await createSupplier(req.user.schoolId, data, req);
    return sendCreated(res, supplier, "Supplier registered successfully");
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/suppliers/{id}:
 *   put:
 *     tags:
 *       - Inventory
 *     summary: Update supplier profile
 */
router.put("/:id", managerGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateSupplierSchema.parse(req.body);
    const supplier = await updateSupplier(req.user.schoolId, req.params.id, data, req);
    return sendSuccess(res, supplier, "Supplier updated successfully");
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/suppliers/{id}:
 *   delete:
 *     tags:
 *       - Inventory
 *     summary: Delete or deactivate supplier
 */
router.delete("/:id", managerGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await deleteSupplier(req.user.schoolId, req.params.id, req);
    return sendSuccess(res, result, "Supplier removed successfully");
  } catch (err) {
    next(err);
  }
});

export default router;
