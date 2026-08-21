import { Router, Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { authorize } from "../../middleware/auth";
import { sendSuccess } from "../../utils/response";
import {
  getInventorySummaryReport,
  getCategoryValuationReport,
  getLocationUtilizationReport,
  getDepreciationScheduleReport,
} from "./inventory.service";

const router = Router();
const staffGuard = authorize(Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER, Role.FINANCE);

/**
 * @openapi
 * /api/v1/inventory/reports/summary:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: Overall inventory valuation, asset counts, maintenance status, and low stock metrics
 */
router.get("/summary", staffGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const summary = await getInventorySummaryReport(req.user.schoolId);
    return sendSuccess(res, summary, "Inventory summary report retrieved");
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/reports/category-valuation:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: Inventory valuation breakdown aggregated by category
 */
router.get("/category-valuation", staffGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await getCategoryValuationReport(req.user.schoolId);
    return sendSuccess(res, report, "Category valuation report retrieved");
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/reports/location-utilization:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: Inventory distribution, storage volume, and valuation breakdown by physical location
 */
router.get("/location-utilization", staffGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await getLocationUtilizationReport(req.user.schoolId);
    return sendSuccess(res, report, "Location utilization report retrieved");
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/inventory/reports/depreciation-schedule:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: Fixed asset straight-line depreciation schedule with current book values
 */
router.get("/depreciation-schedule", staffGuard, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await getDepreciationScheduleReport(req.user.schoolId);
    return sendSuccess(res, report, "Depreciation schedule report retrieved");
  } catch (err) {
    next(err);
  }
});

export default router;
