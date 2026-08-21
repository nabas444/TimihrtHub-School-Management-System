import { Router, Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { db } from "../../config/database";
import { sendSuccess, paginationMeta } from "../../utils/response";
import { authorize } from "../../middleware/auth";

const router = Router();

// Restricted to ADMIN and SUPER_ADMIN
router.use(authorize(Role.ADMIN, Role.SUPER_ADMIN));

// GET /api/v1/audit-logs — list audit logs scoped to schoolId
router.get(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const skip = (page - 1) * limit;

      const action = req.query.action as string | undefined;
      const actorId = req.query.actorId as string | undefined;
      const targetType = req.query.targetType as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      const where: any = {
        schoolId: req.user.schoolId,
        ...(action && action !== "ALL" && { action }),
        ...(actorId && actorId !== "ALL" && { actorId }),
        ...(targetType && targetType !== "ALL" && { targetType }),
      };

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          where.createdAt.gte = new Date(startDate);
        }
        if (endDate) {
          where.createdAt.lte = new Date(endDate);
        }
      }

      const [logs, total] = await Promise.all([
        db.auditLog.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        db.auditLog.count({ where }),
      ]);

      sendSuccess(res, {
        logs,
        ...paginationMeta(total, page, limit),
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
