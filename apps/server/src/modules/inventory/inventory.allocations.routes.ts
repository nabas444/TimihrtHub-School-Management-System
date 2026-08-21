import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Role, CustodianType, ItemCondition } from "@prisma/client";
import { authorize } from "../../middleware/auth";
import { sendSuccess, sendCreated, paginationMeta } from "../../utils/response";
import {
  issueAllocation,
  returnAllocation,
  transferAllocation,
  getAllocations,
  getAllocationById,
  getMyAllocations,
  getOverdueAllocations,
} from "./inventory.service";

const router = Router();
const staffGuard = authorize(Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER, Role.FINANCE);
const managerGuard = authorize(Role.ADMIN, Role.SUPER_ADMIN);

const issueAllocationSchema = z.object({
  itemId: z.string().uuid("Item ID must be a valid UUID"),
  quantity: z.number().int().positive().optional(),
  requestId: z.string().uuid().optional().nullable(),
  custodianType: z.nativeEnum(CustodianType),
  custodianUserId: z.string().uuid().optional().nullable(),
  custodianRoomId: z.string().uuid().optional().nullable(),
  custodianLabel: z.string().optional().nullable(),
  dueBackAt: z.string().optional().nullable(),
  conditionAtIssue: z.nativeEnum(ItemCondition).optional(),
  notes: z.string().optional().nullable(),
});

const returnAllocationSchema = z.object({
  conditionAtReturn: z.nativeEnum(ItemCondition),
  returnLocationId: z.string().uuid().optional().nullable(),
  quantityReturned: z.number().int().positive().optional(),
  notes: z.string().optional().nullable(),
});

const transferAllocationSchema = z.object({
  newCustodianType: z.nativeEnum(CustodianType),
  newCustodianUserId: z.string().uuid().optional().nullable(),
  newCustodianRoomId: z.string().uuid().optional().nullable(),
  newCustodianLabel: z.string().optional().nullable(),
  newLocationId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
});

/**
 * @openapi
 * /api/v1/inventory/allocations/mine:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: Custodian self-service - View items currently or previously assigned to the authenticated user
 */
router.get("/mine", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const allocations = await getMyAllocations(req.user.schoolId, req.user.id);
    return sendSuccess(res, allocations, "Assigned inventory allocations retrieved");
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/allocations/overdue:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: List all active allocations that have passed their dueBackAt date
 */
router.get("/overdue", staffGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const overdue = await getOverdueAllocations(req.user.schoolId);
    return sendSuccess(res, overdue, "Overdue allocations retrieved");
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/allocations:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: List allocations with filters, search, and pagination
 */
router.get("/", staffGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, itemId, custodianUserId, custodianType, search, page, limit } = req.query;
    const result = await getAllocations(req.user.schoolId, {
      status: status as string | undefined,
      itemId: itemId as string | undefined,
      custodianUserId: custodianUserId as string | undefined,
      custodianType: custodianType as CustodianType | undefined,
      search: search as string | undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
    return sendSuccess(
      res,
      result.allocations,
      "Allocations retrieved successfully",
      200,
      paginationMeta(result.page, result.limit, result.total),
    );
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/allocations/{id}:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: Get single allocation details
 */
router.get("/:id", staffGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const allocation = await getAllocationById(req.user.schoolId, req.params.id);
    return sendSuccess(res, allocation, "Allocation details retrieved");
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/allocations:
 *   post:
 *     tags:
 *       - Inventory
 *     summary: Issue / allocate an asset or consumable to a staff, student, room, or department
 */
router.post("/", managerGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = issueAllocationSchema.parse(req.body);
    const allocation = await issueAllocation(req.user.schoolId, data, req.user.id, req);
    return sendCreated(res, allocation, "Item allocated successfully");
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/allocations/{id}/return:
 *   patch:
 *     tags:
 *       - Inventory
 *     summary: Process allocation return (auto-opens maintenance ticket if condition is DAMAGED)
 */
router.patch("/:id/return", managerGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = returnAllocationSchema.parse(req.body);
    const result = await returnAllocation(req.user.schoolId, req.params.id, data, req.user.id, req);
    return sendSuccess(res, result, "Allocation return recorded successfully");
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/allocations/{id}/transfer:
 *   patch:
 *     tags:
 *       - Inventory
 *     summary: Transfer active allocation to a new custodian or room without a full return cycle
 */
router.patch("/:id/transfer", managerGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = transferAllocationSchema.parse(req.body);
    const updated = await transferAllocation(req.user.schoolId, req.params.id, data, req.user.id, req);
    return sendSuccess(res, updated, "Allocation transfer recorded successfully");
  } catch (err) {
    next(err);
  }
});

export default router;
