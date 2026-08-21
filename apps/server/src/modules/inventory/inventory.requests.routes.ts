import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Role, RequestStatus } from "@prisma/client";
import { authorize } from "../../middleware/auth";
import { sendSuccess, sendCreated, paginationMeta } from "../../utils/response";
import {
  createInventoryRequest,
  approveInventoryRequest,
  rejectInventoryRequest,
  getInventoryRequests,
  getInventoryRequestById,
} from "./inventory.service";

const router = Router();
const staffGuard = authorize(Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER, Role.FINANCE);
const approverGuard = authorize(Role.ADMIN, Role.SUPER_ADMIN);

const requestLineSchema = z.object({
  itemId: z.string().uuid().optional().nullable(),
  freeTextName: z.string().optional().nullable(),
  quantityRequested: z.number().int().positive("Quantity requested must be positive"),
});

const createRequestSchema = z.object({
  departmentOrRoom: z.string().optional().nullable(),
  reason: z.string().min(1, "Reason for requisition is required"),
  neededBy: z.string().optional().nullable(),
  lines: z.array(requestLineSchema).min(1, "At least one item line is required"),
});

const rejectRequestSchema = z.object({
  rejectionReason: z.string().min(1, "Rejection reason is required"),
});

/**
 * @openapi
 * /api/v1/inventory/requests:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: List inventory requests (requisitions) with status and requester filters
 */
router.get("/", staffGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, requestedById, myRequests, search, page, limit } = req.query;
    const filterRequester = myRequests === "true" ? req.user.id : (requestedById as string | undefined);

    const result = await getInventoryRequests(req.user.schoolId, {
      status: status as RequestStatus | undefined,
      requestedById: filterRequester,
      search: search as string | undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });

    return sendSuccess(
      res,
      result.requests,
      "Inventory requests retrieved",
      200,
      paginationMeta(result.page, result.limit, result.total),
    );
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/requests/{id}:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: Get single inventory requisition details
 */
router.get("/:id", staffGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const request = await getInventoryRequestById(req.user.schoolId, req.params.id);
    return sendSuccess(res, request, "Inventory request details retrieved");
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/requests:
 *   post:
 *     tags:
 *       - Inventory
 *     summary: Submit a new inventory requisition request
 */
router.post("/", staffGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createRequestSchema.parse(req.body);
    const request = await createInventoryRequest(req.user.schoolId, data, req.user.id, req);
    return sendCreated(res, request, "Inventory requisition submitted successfully");
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/requests/{id}/approve:
 *   patch:
 *     tags:
 *       - Inventory
 *     summary: Approve an inventory requisition request
 */
router.patch("/:id/approve", approverGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await approveInventoryRequest(req.user.schoolId, req.params.id, req.user.id, req);
    return sendSuccess(res, updated, "Requisition approved successfully");
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/requests/{id}/reject:
 *   patch:
 *     tags:
 *       - Inventory
 *     summary: Reject an inventory requisition request with reason
 */
router.patch("/:id/reject", approverGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = rejectRequestSchema.parse(req.body);
    const updated = await rejectInventoryRequest(
      req.user.schoolId,
      req.params.id,
      data.rejectionReason,
      req.user.id,
      req,
    );
    return sendSuccess(res, updated, "Requisition rejected");
  } catch (err) {
    next(err);
  }
});

export default router;
