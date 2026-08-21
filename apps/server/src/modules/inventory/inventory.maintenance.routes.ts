import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Role, MaintenanceStatus, ItemCondition } from "@prisma/client";
import { authorize } from "../../middleware/auth";
import { sendSuccess, sendCreated, paginationMeta } from "../../utils/response";
import {
  createMaintenanceTicket,
  updateMaintenanceTicket,
  resolveMaintenanceTicket,
  getMaintenanceRecords,
  getMaintenanceRecordById,
} from "./inventory.service";

const router = Router();
const staffGuard = authorize(Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER, Role.FINANCE);
const managerGuard = authorize(Role.ADMIN, Role.SUPER_ADMIN);

const createMaintenanceSchema = z.object({
  itemId: z.string().uuid("Item ID must be a valid UUID"),
  faultDescription: z.string().min(1, "Fault description is required"),
  externalVendor: z.string().optional().nullable(),
  assignedToStaffId: z.string().uuid().optional().nullable(),
  cost: z.number().nonnegative().optional(),
});

const updateMaintenanceSchema = z.object({
  status: z.nativeEnum(MaintenanceStatus).optional(),
  assignedToStaffId: z.string().uuid().optional().nullable(),
  externalVendor: z.string().optional().nullable(),
  cost: z.number().nonnegative().optional(),
  faultDescription: z.string().optional(),
  resolutionNotes: z.string().optional().nullable(),
});

const resolveMaintenanceSchema = z.object({
  status: z.enum(["RESOLVED", "UNRESOLVABLE", "CLOSED"]),
  resolutionNotes: z.string().optional().nullable(),
  cost: z.number().nonnegative().optional(),
  conditionAfterRepair: z.nativeEnum(ItemCondition).optional(),
  returnLocationId: z.string().uuid().optional().nullable(),
});

/**
 * @openapi
 * /api/v1/inventory/maintenance:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: List maintenance tickets with status and item filters
 */
router.get("/", staffGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { itemId, status, page, limit } = req.query;
    const result = await getMaintenanceRecords(req.user.schoolId, {
      itemId: itemId as string | undefined,
      status: status as MaintenanceStatus | undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
    return sendSuccess(
      res,
      result.records,
      "Maintenance records retrieved",
      200,
      paginationMeta(result.page, result.limit, result.total),
    );
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/maintenance/{id}:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: Get single maintenance ticket details
 */
router.get("/:id", staffGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const record = await getMaintenanceRecordById(req.user.schoolId, req.params.id);
    return sendSuccess(res, record, "Maintenance record details retrieved");
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/maintenance:
 *   post:
 *     tags:
 *       - Inventory
 *     summary: Report a fault and create a maintenance ticket (transitions item to UNDER_MAINTENANCE)
 */
router.post("/", staffGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createMaintenanceSchema.parse(req.body);
    const maint = await createMaintenanceTicket(req.user.schoolId, data, req.user.id, req);
    return sendCreated(res, maint, "Maintenance ticket created and item status updated");
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/maintenance/{id}:
 *   patch:
 *     tags:
 *       - Inventory
 *     summary: Update maintenance ticket details or assign service provider
 */
router.patch("/:id", managerGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateMaintenanceSchema.parse(req.body);
    const updated = await updateMaintenanceTicket(req.user.schoolId, req.params.id, data, req.user.id, req);
    return sendSuccess(res, updated, "Maintenance ticket updated successfully");
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/maintenance/{id}/resolve:
 *   patch:
 *     tags:
 *       - Inventory
 *     summary: Resolve or close a maintenance ticket (restores asset to IN_STOCK upon resolution)
 */
router.patch("/:id/resolve", managerGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = resolveMaintenanceSchema.parse(req.body);
    const result = await resolveMaintenanceTicket(req.user.schoolId, req.params.id, data, req.user.id, req);
    return sendSuccess(res, result, "Maintenance ticket resolution recorded");
  } catch (err) {
    next(err);
  }
});

export default router;
