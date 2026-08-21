import { Router, Request, Response, NextFunction } from "express";
import { Role, MovementType } from "@prisma/client";
import { authorize } from "../../middleware/auth";
import { sendSuccess, paginationMeta } from "../../utils/response";
import { getMovements } from "./inventory.service";

const router = Router();
const staffGuard = authorize(Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER, Role.FINANCE);

/**
 * @openapi
 * /api/v1/inventory/movements:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: Retrieve immutable movement ledger entries with filters and pagination
 */
router.get("/", staffGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { itemId, type, fromLocationId, toLocationId, page, limit } = req.query;
    const result = await getMovements(req.user.schoolId, {
      itemId: itemId as string | undefined,
      type: type as MovementType | undefined,
      fromLocationId: fromLocationId as string | undefined,
      toLocationId: toLocationId as string | undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
    return sendSuccess(
      res,
      result.movements,
      "Movement ledger entries retrieved",
      200,
      paginationMeta(result.page, result.limit, result.total),
    );
  } catch (err) {
    next(err);
  }
});

export default router;
