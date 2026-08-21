import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Role, ItemType } from "@prisma/client";
import { authorize } from "../../middleware/auth";
import { sendSuccess, sendCreated } from "../../utils/response";
import {
  getCategoryTree,
  getCategoriesList,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from "./inventory.service";

const router = Router();
const staffGuard = authorize(Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER, Role.FINANCE);
const managerGuard = authorize(Role.ADMIN, Role.SUPER_ADMIN);

const createCategorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
  parentId: z.string().uuid().optional().nullable(),
  defaultItemType: z.nativeEnum(ItemType).optional(),
  defaultUnit: z.string().optional(),
  defaultReorderPoint: z.number().int().nonnegative().optional().nullable(),
  defaultReorderQty: z.number().int().positive().optional().nullable(),
});

const updateCategorySchema = createCategorySchema.partial();

/**
 * @openapi
 * /api/v1/inventory/categories/tree:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: Get hierarchical category tree
 */
router.get("/tree", staffGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tree = await getCategoryTree(req.user.schoolId);
    return sendSuccess(res, tree, "Category tree retrieved successfully");
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/categories:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: Get flat list of inventory categories
 */
router.get("/", staffGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await getCategoriesList(req.user.schoolId);
    return sendSuccess(res, list, "Categories retrieved successfully");
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/categories/{id}:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: Get category details
 */
router.get("/:id", staffGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = await getCategoryById(req.user.schoolId, req.params.id);
    return sendSuccess(res, category, "Category details retrieved");
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/categories:
 *   post:
 *     tags:
 *       - Inventory
 *     summary: Create new inventory category
 */
router.post("/", managerGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createCategorySchema.parse(req.body);
    const category = await createCategory(req.user.schoolId, data, req);
    return sendCreated(res, category, "Category created successfully");
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/categories/{id}:
 *   put:
 *     tags:
 *       - Inventory
 *     summary: Update inventory category
 */
router.put("/:id", managerGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateCategorySchema.parse(req.body);
    const category = await updateCategory(req.user.schoolId, req.params.id, data, req);
    return sendSuccess(res, category, "Category updated successfully");
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/categories/{id}:
 *   delete:
 *     tags:
 *       - Inventory
 *     summary: Delete category (if no items or subcategories attached)
 */
router.delete("/:id", managerGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await deleteCategory(req.user.schoolId, req.params.id, req);
    return sendSuccess(res, result, "Category deleted successfully");
  } catch (err) {
    next(err);
  }
});

export default router;
