import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Role, InventoryLocationType } from "@prisma/client";
import { authorize } from "../../middleware/auth";
import { sendSuccess, sendCreated } from "../../utils/response";
import {
  getLocationTree,
  getLocationsList,
  getLocationById,
  createLocation,
  updateLocation,
  deleteLocation,
} from "./inventory.service";

const router = Router();
const staffGuard = authorize(Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER, Role.FINANCE);
const managerGuard = authorize(Role.ADMIN, Role.SUPER_ADMIN);

const createLocationSchema = z.object({
  name: z.string().min(1, "Location name is required"),
  type: z.nativeEnum(InventoryLocationType),
  parentId: z.string().uuid().optional().nullable(),
  isStoreRoom: z.boolean().optional(),
  isDisposalHold: z.boolean().optional(),
});

const updateLocationSchema = createLocationSchema.partial().extend({
  isActive: z.boolean().optional(),
});

/**
 * @openapi
 * /api/v1/inventory/locations/tree:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: Get hierarchical location tree (Campus -> Block -> Floor -> Room -> Bin)
 */
router.get("/tree", staffGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tree = await getLocationTree(req.user.schoolId);
    return sendSuccess(res, tree, "Location tree retrieved successfully");
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/locations:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: Get list of locations with optional filters
 */
router.get("/", staffGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, parentId, isStoreRoom } = req.query;
    const locations = await getLocationsList(req.user.schoolId, {
      type: type as InventoryLocationType | undefined,
      parentId: parentId as string | undefined,
      isStoreRoom: isStoreRoom !== undefined ? isStoreRoom === "true" : undefined,
    });
    return sendSuccess(res, locations, "Locations retrieved successfully");
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/locations/{id}:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: Get single location details and stored inventory items
 */
router.get("/:id", staffGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const location = await getLocationById(req.user.schoolId, req.params.id);
    return sendSuccess(res, location, "Location details retrieved");
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/locations:
 *   post:
 *     tags:
 *       - Inventory
 *     summary: Create new location node in hierarchy
 */
router.post("/", managerGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createLocationSchema.parse(req.body);
    const location = await createLocation(req.user.schoolId, data, req);
    return sendCreated(res, location, "Location created successfully");
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/locations/{id}:
 *   put:
 *     tags:
 *       - Inventory
 *     summary: Update location details
 */
router.put("/:id", managerGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateLocationSchema.parse(req.body);
    const location = await updateLocation(req.user.schoolId, req.params.id, data, req);
    return sendSuccess(res, location, "Location updated successfully");
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/locations/{id}:
 *   delete:
 *     tags:
 *       - Inventory
 *     summary: Deactivate / Delete empty location node
 */
router.delete("/:id", managerGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await deleteLocation(req.user.schoolId, req.params.id, req);
    return sendSuccess(res, result, "Location deleted successfully");
  } catch (err) {
    next(err);
  }
});

export default router;
