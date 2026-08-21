import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  Role,
  HostelType,
  HostelRoomType,
  RoomStatus,
  BedStatus,
  HostelStaffRole,
  HostelApplicationStatus,
  OutpassType,
  OutpassStatus,
  NightAttendanceStatus,
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceStatus,
  IncidentSeverity,
  TransferRequestStatus,
} from "@prisma/client";
import { authorize } from "../../middleware/auth";
import { hostelScope } from "./hostel.middleware";
import * as HostelService from "./hostel.service";
import { sendSuccess, sendCreated } from "../../utils/response";
import { AppError } from "../../middleware/errorHandler";

const router = Router();

// ── ZOD SCHEMAS ───────────────────────────────────────────────────────────────

const createHostelSchema = z.object({
  name: z.string().min(2, "Hostel name is required"),
  type: z.nativeEnum(HostelType),
  wardenId: z.string().uuid().optional().nullable(),
  address: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

const updateHostelSchema = z.object({
  name: z.string().min(2).optional(),
  type: z.nativeEnum(HostelType).optional(),
  wardenId: z.string().uuid().optional().nullable(),
  address: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

const createBlockSchema = z.object({
  name: z.string().min(1, "Block name is required"),
  floorCount: z.number().int().min(1).default(1),
  gradeMin: z.string().optional().nullable(),
  gradeMax: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

const updateBlockSchema = z.object({
  name: z.string().min(1).optional(),
  floorCount: z.number().int().min(1).optional(),
  gradeMin: z.string().optional().nullable(),
  gradeMax: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

const createRoomSchema = z.object({
  roomNumber: z.string().min(1, "Room number is required"),
  floor: z.number().int().min(0).default(1),
  roomType: z.nativeEnum(HostelRoomType),
  capacity: z.number().int().min(1, "Capacity must be at least 1"),
  status: z.nativeEnum(RoomStatus).default(RoomStatus.AVAILABLE),
  amenities: z.array(z.string()).optional().nullable(),
  isAccessible: z.boolean().default(false),
  autoCreateBeds: z.boolean().default(true),
});

const updateRoomSchema = z.object({
  roomNumber: z.string().min(1).optional(),
  floor: z.number().int().min(0).optional(),
  roomType: z.nativeEnum(HostelRoomType).optional(),
  capacity: z.number().int().min(1).optional(),
  status: z.nativeEnum(RoomStatus).optional(),
  amenities: z.array(z.string()).optional().nullable(),
  isAccessible: z.boolean().optional(),
});

const createBedSchema = z.object({
  bedNumber: z.string().min(1, "Bed number is required"),
  status: z.nativeEnum(BedStatus).default(BedStatus.VACANT),
});

const bulkCreateBedsSchema = z.object({
  bedNumbers: z.array(z.string().min(1)).optional(),
  count: z.number().int().min(1).max(50).optional(),
  prefix: z.string().optional(),
});

const updateBedSchema = z.object({
  bedNumber: z.string().min(1).optional(),
  status: z.nativeEnum(BedStatus).optional(),
});

const assignStaffSchema = z.object({
  employeeId: z.string().uuid("Valid employee ID required"),
  staffRole: z.nativeEnum(HostelStaffRole),
  blockId: z.string().uuid().optional().nullable(),
  shift: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

const updateStaffAssignmentSchema = z.object({
  staffRole: z.nativeEnum(HostelStaffRole).optional(),
  blockId: z.string().uuid().optional().nullable(),
  shift: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

const submitApplicationSchema = z.object({
  studentProfileId: z.string().uuid("Valid student profile ID required"),
  hostelId: z.string().uuid().optional().nullable(),
  academicTermId: z.string().uuid().optional().nullable(),
  preferredRoomType: z.nativeEnum(HostelRoomType).optional().nullable(),
  medicalNotes: z.string().optional().nullable(),
  specialRequests: z.string().optional().nullable(),
  roommatePreference: z.string().optional().nullable(),
  guardianConsent: z.boolean().default(false),
});

const reviewApplicationSchema = z.object({
  status: z.nativeEnum(HostelApplicationStatus),
  reviewNotes: z.string().optional().nullable(),
  hostelId: z.string().uuid().optional().nullable(),
});

const runAllocationSchema = z.object({
  academicTermId: z.string().uuid().optional(),
  defaultBoardingFee: z.number().positive().optional(),
  matchRoommatePreferences: z.boolean().default(true),
});

const manualAllocationSchema = z.object({
  applicationId: z.string().uuid().optional().nullable(),
  hostelId: z.string().uuid(),
  bedId: z.string().uuid(),
  studentProfileId: z.string().uuid(),
  academicTermId: z.string().uuid().optional().nullable(),
  boardingFeeAmount: z.number().positive().optional(),
  forceGenderOverride: z.boolean().default(false),
});

const checkOutSchema = z.object({
  vacateReason: z.string().optional(),
});

const recordNightAttendanceSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD"),
  records: z.array(
    z.object({
      allocationId: z.string().uuid(),
      status: z.nativeEnum(NightAttendanceStatus),
      remarks: z.string().optional().nullable(),
    }),
  ).min(1, "At least one attendance record required"),
});

const createOutpassSchema = z.object({
  allocationId: z.string().uuid(),
  type: z.nativeEnum(OutpassType),
  fromDateTime: z.string().datetime(),
  expectedReturnAt: z.string().datetime(),
  destination: z.string().min(2),
  contactAtDestination: z.string().optional().nullable(),
  reason: z.string().min(3),
});

const decideOutpassSchema = z.object({
  status: z.enum([OutpassStatus.APPROVED, OutpassStatus.REJECTED]),
});

const createVisitorLogSchema = z.object({
  studentProfileId: z.string().uuid(),
  visitorName: z.string().min(2),
  relationToStudent: z.string().min(2),
  idProofType: z.string().optional().nullable(),
  idProofNumber: z.string().optional().nullable(),
  purpose: z.string().optional().nullable(),
});

const createMaintenanceTicketSchema = z.object({
  roomId: z.string().uuid(),
  category: z.nativeEnum(MaintenanceCategory),
  priority: z.nativeEnum(MaintenancePriority).default(MaintenancePriority.MEDIUM),
  description: z.string().min(5),
  assignedToId: z.string().uuid().optional().nullable(),
});

const updateMaintenanceTicketSchema = z.object({
  category: z.nativeEnum(MaintenanceCategory).optional(),
  priority: z.nativeEnum(MaintenancePriority).optional(),
  status: z.nativeEnum(MaintenanceStatus).optional(),
  description: z.string().min(5).optional(),
  assignedToId: z.string().uuid().optional().nullable(),
  cost: z.number().nonnegative().optional().nullable(),
});

const createIncidentReportSchema = z.object({
  allocationId: z.string().uuid(),
  severity: z.nativeEnum(IncidentSeverity),
  description: z.string().min(5),
  actionTaken: z.string().optional().nullable(),
  linkedBehaviourId: z.string().uuid().optional().nullable(),
});

const createTransferRequestSchema = z.object({
  fromAllocationId: z.string().uuid(),
  toBedId: z.string().uuid().optional().nullable(),
  reason: z.string().min(5),
});

const decideTransferRequestSchema = z.object({
  status: z.enum([TransferRequestStatus.APPROVED, TransferRequestStatus.REJECTED]),
  toBedId: z.string().uuid().optional().nullable(),
  decisionNotes: z.string().optional().nullable(),
});

// ── 1. GLOBAL / LIST ROUTES (placed before /:id) ──────────────────────────────

// Applications
router.post(
  "/applications",
  authorize(Role.SUPER_ADMIN, Role.ADMIN, Role.STUDENT, Role.PARENT),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = submitApplicationSchema.parse(req.body);
      const application = await HostelService.submitHostelApplication(
        req.user.schoolId,
        parsed,
        req.user,
      );
      sendCreated(res, application, "Hostel application submitted successfully");
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/applications",
  authorize(Role.SUPER_ADMIN, Role.ADMIN, Role.TEACHER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const applications = await HostelService.getHostelApplications(
        req.user.schoolId,
        req.query as any,
      );
      sendSuccess(res, applications);
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/applications/:id/review",
  authorize(Role.SUPER_ADMIN, Role.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = reviewApplicationSchema.parse(req.body);
      const updated = await HostelService.reviewHostelApplication(
        req.user.schoolId,
        req.params.id,
        parsed,
        req.user,
      );
      sendSuccess(res, updated, "Hostel application reviewed successfully");
    } catch (e) {
      next(e);
    }
  },
);

// Allocations
router.post(
  "/allocations",
  authorize(Role.SUPER_ADMIN, Role.ADMIN),
  hostelScope([HostelStaffRole.WARDEN, HostelStaffRole.ASSISTANT_WARDEN]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = manualAllocationSchema.parse(req.body);
      const allocation = await HostelService.manualAllocate(
        req.user.schoolId,
        parsed,
        req.user,
      );
      sendCreated(res, allocation, "Bed allocated successfully");
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/allocations/:id/check-in",
  authorize(Role.SUPER_ADMIN, Role.ADMIN, Role.TEACHER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await HostelService.checkInResident(
        req.user.schoolId,
        req.params.id,
        req.user,
      );
      sendSuccess(res, updated, "Resident checked in successfully");
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/allocations/:id/check-out",
  authorize(Role.SUPER_ADMIN, Role.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = checkOutSchema.parse(req.body);
      const result = await HostelService.checkOutResident(
        req.user.schoolId,
        req.params.id,
        parsed.vacateReason,
        req.user,
      );
      sendSuccess(res, result, "Resident checked out and bed vacated");
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/students/:studentId/allocations",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const history = await HostelService.getStudentAllocationHistory(
        req.user.schoolId,
        req.params.studentId,
      );
      sendSuccess(res, history);
    } catch (e) {
      next(e);
    }
  },
);

// Outpasses
router.post(
  "/outpasses",
  authorize(Role.SUPER_ADMIN, Role.ADMIN, Role.STUDENT, Role.PARENT),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createOutpassSchema.parse(req.body);
      const outpass = await HostelService.createOutpass(
        req.user.schoolId,
        parsed,
        req.user,
      );
      sendCreated(res, outpass, "Outpass request created");
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/outpasses",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const outpasses = await HostelService.getOutpasses(
        req.user.schoolId,
        req.query as any,
      );
      sendSuccess(res, outpasses);
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/outpasses/:id/decide",
  authorize(Role.SUPER_ADMIN, Role.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = decideOutpassSchema.parse(req.body);
      const updated = await HostelService.decideOutpass(
        req.user.schoolId,
        req.params.id,
        parsed.status as any,
        req.user,
      );
      sendSuccess(res, updated, `Outpass ${parsed.status.toLowerCase()}`);
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/outpasses/:id/gate-out",
  authorize(Role.SUPER_ADMIN, Role.ADMIN, Role.TEACHER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await HostelService.scanGateOut(
        req.user.schoolId,
        req.params.id,
        req.user,
      );
      sendSuccess(res, updated, "Student gated OUT");
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/outpasses/:id/gate-in",
  authorize(Role.SUPER_ADMIN, Role.ADMIN, Role.TEACHER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await HostelService.scanGateIn(
        req.user.schoolId,
        req.params.id,
        req.user,
      );
      sendSuccess(res, updated, "Student gated IN (Returned)");
    } catch (e) {
      next(e);
    }
  },
);

// Visitor Logs
router.post(
  "/visitor-logs",
  authorize(Role.SUPER_ADMIN, Role.ADMIN, Role.TEACHER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createVisitorLogSchema.parse(req.body);
      const log = await HostelService.logVisitorCheckIn(
        req.user.schoolId,
        parsed,
        req.user,
      );
      sendCreated(res, log, "Visitor check-in logged");
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/visitor-logs",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const openOnly = req.query.openOnly === "true";
      const logs = await HostelService.getVisitorLogs(req.user.schoolId, {
        studentProfileId: req.query.studentProfileId as string,
        openOnly,
      });
      sendSuccess(res, logs);
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/visitor-logs/:id/checkout",
  authorize(Role.SUPER_ADMIN, Role.ADMIN, Role.TEACHER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await HostelService.logVisitorCheckOut(
        req.user.schoolId,
        req.params.id,
        req.user,
      );
      sendSuccess(res, updated, "Visitor checked out");
    } catch (e) {
      next(e);
    }
  },
);

// Maintenance Tickets
router.post(
  "/maintenance-tickets",
  authorize(Role.SUPER_ADMIN, Role.ADMIN, Role.TEACHER, Role.STUDENT),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createMaintenanceTicketSchema.parse(req.body);
      const ticket = await HostelService.createMaintenanceTicket(
        req.user.schoolId,
        parsed,
        req.user,
      );
      sendCreated(res, ticket, "Maintenance ticket created");
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/maintenance-tickets",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tickets = await HostelService.getMaintenanceTickets(
        req.user.schoolId,
        req.query as any,
      );
      sendSuccess(res, tickets);
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/maintenance-tickets/:id",
  authorize(Role.SUPER_ADMIN, Role.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = updateMaintenanceTicketSchema.parse(req.body);
      const updated = await HostelService.updateMaintenanceTicket(
        req.user.schoolId,
        req.params.id,
        parsed,
        req.user,
      );
      sendSuccess(res, updated, "Maintenance ticket updated");
    } catch (e) {
      next(e);
    }
  },
);

// Incident Reports
router.post(
  "/incident-reports",
  authorize(Role.SUPER_ADMIN, Role.ADMIN, Role.TEACHER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createIncidentReportSchema.parse(req.body);
      const report = await HostelService.createIncidentReport(
        req.user.schoolId,
        parsed,
        req.user,
      );
      sendCreated(res, report, "Incident report filed");
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/incident-reports",
  authorize(Role.SUPER_ADMIN, Role.ADMIN, Role.TEACHER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reports = await HostelService.getIncidentReports(
        req.user.schoolId,
        req.query as any,
      );
      sendSuccess(res, reports);
    } catch (e) {
      next(e);
    }
  },
);

// Transfer Requests
router.post(
  "/transfer-requests",
  authorize(Role.SUPER_ADMIN, Role.ADMIN, Role.STUDENT, Role.PARENT),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createTransferRequestSchema.parse(req.body);
      const request = await HostelService.createTransferRequest(
        req.user.schoolId,
        parsed,
        req.user,
      );
      sendCreated(res, request, "Transfer request submitted");
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/transfer-requests",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requests = await HostelService.getTransferRequests(
        req.user.schoolId,
        req.query as any,
      );
      sendSuccess(res, requests);
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/transfer-requests/:id/decide",
  authorize(Role.SUPER_ADMIN, Role.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = decideTransferRequestSchema.parse(req.body);
      const result = await HostelService.decideTransferRequest(
        req.user.schoolId,
        req.params.id,
        parsed as any,
        req.user,
      );
      sendSuccess(res, result, "Transfer request decided");
    } catch (e) {
      next(e);
    }
  },
);

// ── 2. HOSTEL SPECIFIC /:id ROUTES ───────────────────────────────────────────

router.post(
  "/",
  authorize(Role.SUPER_ADMIN, Role.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createHostelSchema.parse(req.body);
      const hostel = await HostelService.createHostel(
        req.user.schoolId,
        parsed,
        req.user,
      );
      sendCreated(res, hostel, "Hostel created successfully");
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const type = req.query.type as HostelType | undefined;
      const isActive = req.query.isActive !== undefined ? req.query.isActive === "true" : undefined;
      const search = req.query.search as string | undefined;

      const hostels = await HostelService.getHostels(req.user.schoolId, {
        type,
        isActive,
        search,
      });
      sendSuccess(res, hostels);
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const hostel = await HostelService.getHostelById(
        req.user.schoolId,
        req.params.id,
      );
      sendSuccess(res, hostel);
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/:id",
  authorize(Role.SUPER_ADMIN, Role.ADMIN),
  hostelScope([HostelStaffRole.WARDEN]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = updateHostelSchema.parse(req.body);
      const updated = await HostelService.updateHostel(
        req.user.schoolId,
        req.params.id,
        parsed,
        req.user,
      );
      sendSuccess(res, updated, "Hostel updated successfully");
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  "/:id",
  authorize(Role.SUPER_ADMIN, Role.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await HostelService.deleteHostel(
        req.user.schoolId,
        req.params.id,
        req.user,
      );
      sendSuccess(res, null, "Hostel deleted successfully");
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/:id/occupancy",
  authorize(Role.SUPER_ADMIN, Role.ADMIN, Role.TEACHER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const occupancy = await HostelService.getHostelOccupancy(
        req.user.schoolId,
        req.params.id,
      );
      sendSuccess(res, occupancy);
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/:id/allocate/run",
  authorize(Role.SUPER_ADMIN, Role.ADMIN),
  hostelScope([HostelStaffRole.WARDEN]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = runAllocationSchema.parse(req.body);
      const result = await HostelService.runAutoAllocation(
        req.user.schoolId,
        req.params.id,
        parsed,
        req.user,
      );
      sendSuccess(res, result, `Auto-allocation completed: ${result.allocatedCount} residents placed`);
    } catch (e) {
      next(e);
    }
  },
);

// Night roll call
router.post(
  "/:id/night-attendance",
  authorize(Role.SUPER_ADMIN, Role.ADMIN, Role.TEACHER),
  hostelScope([HostelStaffRole.WARDEN, HostelStaffRole.ASSISTANT_WARDEN, HostelStaffRole.MATRON, HostelStaffRole.CARETAKER]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = recordNightAttendanceSchema.parse(req.body);
      const result = await HostelService.recordNightAttendance(
        req.user.schoolId,
        req.params.id,
        parsed.date,
        parsed.records,
        req.user,
      );
      sendSuccess(res, result, `Recorded night roll call for ${result.length} residents`);
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/:id/night-attendance",
  authorize(Role.SUPER_ADMIN, Role.ADMIN, Role.TEACHER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dateStr = (req.query.date as string) || new Date().toISOString().split("T")[0];
      const grid = await HostelService.getHostelNightAttendance(
        req.user.schoolId,
        req.params.id,
        dateStr,
      );
      sendSuccess(res, grid);
    } catch (e) {
      next(e);
    }
  },
);

// Blocks in hostel
router.post(
  "/:id/blocks",
  authorize(Role.SUPER_ADMIN, Role.ADMIN),
  hostelScope([HostelStaffRole.WARDEN, HostelStaffRole.ASSISTANT_WARDEN]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createBlockSchema.parse(req.body);
      const block = await HostelService.createBlock(
        req.user.schoolId,
        req.params.id,
        parsed,
        req.user,
      );
      sendCreated(res, block, "Hostel block created successfully");
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/:id/blocks",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const blocks = await HostelService.getBlocks(
        req.user.schoolId,
        req.params.id,
      );
      sendSuccess(res, blocks);
    } catch (e) {
      next(e);
    }
  },
);

// Staff assigned to hostel
router.post(
  "/:id/staff",
  authorize(Role.SUPER_ADMIN, Role.ADMIN),
  hostelScope([HostelStaffRole.WARDEN]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = assignStaffSchema.parse(req.body);
      const assignment = await HostelService.assignHostelStaff(
        req.user.schoolId,
        req.params.id,
        parsed,
        req.user,
      );
      sendCreated(res, assignment, "Staff assigned to hostel successfully");
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/:id/staff",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const staff = await HostelService.getHostelStaff(
        req.user.schoolId,
        req.params.id,
      );
      sendSuccess(res, staff);
    } catch (e) {
      next(e);
    }
  },
);

// ── 3. BLOCK ROUTES ───────────────────────────────────────────────────────────

router.get(
  "/blocks/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const block = await HostelService.getBlockById(
        req.user.schoolId,
        req.params.id,
      );
      sendSuccess(res, block);
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/blocks/:id",
  authorize(Role.SUPER_ADMIN, Role.ADMIN),
  hostelScope([HostelStaffRole.WARDEN, HostelStaffRole.ASSISTANT_WARDEN]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = updateBlockSchema.parse(req.body);
      const updated = await HostelService.updateBlock(
        req.user.schoolId,
        req.params.id,
        parsed,
        req.user,
      );
      sendSuccess(res, updated, "Hostel block updated successfully");
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  "/blocks/:id",
  authorize(Role.SUPER_ADMIN, Role.ADMIN),
  hostelScope([HostelStaffRole.WARDEN]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await HostelService.deleteBlock(
        req.user.schoolId,
        req.params.id,
        req.user,
      );
      sendSuccess(res, null, "Hostel block deleted successfully");
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/blocks/:id/rooms",
  authorize(Role.SUPER_ADMIN, Role.ADMIN),
  hostelScope([HostelStaffRole.WARDEN, HostelStaffRole.ASSISTANT_WARDEN]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createRoomSchema.parse(req.body);
      const room = await HostelService.createRoom(
        req.user.schoolId,
        req.params.id,
        parsed,
        req.user,
      );
      sendCreated(res, room, "Hostel room created successfully");
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/blocks/:id/rooms",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = req.query.status as RoomStatus | undefined;
      const floor = req.query.floor ? parseInt(req.query.floor as string) : undefined;
      const rooms = await HostelService.getRooms(req.user.schoolId, req.params.id, {
        status,
        floor,
      });
      sendSuccess(res, rooms);
    } catch (e) {
      next(e);
    }
  },
);

// ── 4. ROOM ROUTES ────────────────────────────────────────────────────────────

router.get(
  "/rooms/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const room = await HostelService.getRoomById(
        req.user.schoolId,
        req.params.id,
      );
      sendSuccess(res, room);
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/rooms/:id",
  authorize(Role.SUPER_ADMIN, Role.ADMIN),
  hostelScope([HostelStaffRole.WARDEN, HostelStaffRole.ASSISTANT_WARDEN]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = updateRoomSchema.parse(req.body);
      const updated = await HostelService.updateRoom(
        req.user.schoolId,
        req.params.id,
        parsed,
        req.user,
      );
      sendSuccess(res, updated, "Hostel room updated successfully");
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  "/rooms/:id",
  authorize(Role.SUPER_ADMIN, Role.ADMIN),
  hostelScope([HostelStaffRole.WARDEN]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await HostelService.deleteRoom(
        req.user.schoolId,
        req.params.id,
        req.user,
      );
      sendSuccess(res, null, "Hostel room deleted successfully");
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/rooms/:id/beds",
  authorize(Role.SUPER_ADMIN, Role.ADMIN),
  hostelScope([HostelStaffRole.WARDEN, HostelStaffRole.ASSISTANT_WARDEN]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createBedSchema.parse(req.body);
      const bed = await HostelService.createBed(
        req.user.schoolId,
        req.params.id,
        parsed,
        req.user,
      );
      sendCreated(res, bed, "Bed created successfully");
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/rooms/:id/beds/bulk",
  authorize(Role.SUPER_ADMIN, Role.ADMIN),
  hostelScope([HostelStaffRole.WARDEN, HostelStaffRole.ASSISTANT_WARDEN]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = bulkCreateBedsSchema.parse(req.body);
      const result = await HostelService.bulkCreateBeds(
        req.user.schoolId,
        req.params.id,
        parsed,
        req.user,
      );
      sendCreated(res, result, `Successfully created ${result.addedCount} beds`);
    } catch (e) {
      next(e);
    }
  },
);

// ── 5. BED & STAFF-ASSIGNMENT ROUTES ──────────────────────────────────────────

router.patch(
  "/beds/:id",
  authorize(Role.SUPER_ADMIN, Role.ADMIN),
  hostelScope([HostelStaffRole.WARDEN, HostelStaffRole.ASSISTANT_WARDEN, HostelStaffRole.CARETAKER]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = updateBedSchema.parse(req.body);
      const updated = await HostelService.updateBed(
        req.user.schoolId,
        req.params.id,
        parsed,
        req.user,
      );
      sendSuccess(res, updated, "Bed updated successfully");
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  "/beds/:id",
  authorize(Role.SUPER_ADMIN, Role.ADMIN),
  hostelScope([HostelStaffRole.WARDEN]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await HostelService.deleteBed(
        req.user.schoolId,
        req.params.id,
        req.user,
      );
      sendSuccess(res, null, "Bed deleted successfully");
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/staff-assignments/:id",
  authorize(Role.SUPER_ADMIN, Role.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = updateStaffAssignmentSchema.parse(req.body);
      const updated = await HostelService.updateStaffAssignment(
        req.user.schoolId,
        req.params.id,
        parsed,
        req.user,
      );
      sendSuccess(res, updated, "Staff assignment updated successfully");
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  "/staff-assignments/:id",
  authorize(Role.SUPER_ADMIN, Role.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await HostelService.removeStaffAssignment(
        req.user.schoolId,
        req.params.id,
        req.user,
      );
      sendSuccess(res, null, "Staff assignment removed successfully");
    } catch (e) {
      next(e);
    }
  },
);

export default router;
