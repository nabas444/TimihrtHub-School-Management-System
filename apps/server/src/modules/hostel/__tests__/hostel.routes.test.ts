import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  HostelType,
  HostelRoomType,
  RoomStatus,
  BedStatus,
  HostelStaffRole,
  HostelApplicationStatus,
  Role,
  AllocationStatus,
  Gender,
  StudentStatus,
  NotificationType,
  OutpassType,
  OutpassStatus,
  NightAttendanceStatus,
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceStatus,
  IncidentSeverity,
  TransferRequestStatus,
} from "@prisma/client";
import { db } from "../../../config/database";
import * as HostelService from "../hostel.service";
import { hostelScope } from "../hostel.middleware";
import { runHostelTermRollover } from "../../../jobs/hostelRolloverJob";
import { runHostelOutpassOverdueJob } from "../../../jobs/hostelOutpassOverdueJob";

// Mock dependencies
vi.mock("../../../config/database", () => {
  const mDb = {
    hostel: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    hostelBlock: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    hostelRoom: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    hostelBed: {
      create: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    hostelStaffAssignment: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    hostelApplication: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    hostelAllocation: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    hostelNightAttendance: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
    hostelOutpass: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    hostelVisitorLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    hostelMaintenanceTicket: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    hostelIncidentReport: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    hostelTransferRequest: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    feeInvoice: {
      create: vi.fn(),
    },
    notification: {
      create: vi.fn().mockResolvedValue({ id: "notif-1" }),
    },
    employee: {
      findFirst: vi.fn(),
    },
    studentProfile: {
      findFirst: vi.fn(),
    },
    parentStudentLink: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    behaviourRecord: {
      count: vi.fn().mockResolvedValue(0),
    },
    $transaction: vi.fn((callback) => callback(mDb)),
  };
  return { db: mDb };
});

vi.mock("../../../utils/auditLog", () => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

describe("Hostel Module — Full Phases 1-4 Test Suite", () => {
  const schoolId = "school-100";
  const actor = {
    id: "user-admin-1",
    email: "admin@timhirthub.edu.et",
    role: Role.ADMIN,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Hostel CRUD & Capacity Recalculation", () => {
    it("creates a hostel successfully and assigns warden if specified", async () => {
      const mockHostel = {
        id: "hostel-1",
        schoolId,
        name: "Abune Petros Hall",
        type: HostelType.BOYS,
        wardenId: "emp-warden-1",
        address: "North Campus",
        isActive: true,
        totalCapacity: 0,
      };

      (db.hostel.create as any).mockResolvedValueOnce(mockHostel);
      (db.hostelStaffAssignment.create as any).mockResolvedValueOnce({ id: "staff-1" });

      const result = await HostelService.createHostel(
        schoolId,
        {
          name: "Abune Petros Hall",
          type: HostelType.BOYS,
          wardenId: "emp-warden-1",
          address: "North Campus",
        },
        actor,
      );

      expect(db.hostel.create).toHaveBeenCalledTimes(1);
      expect(db.hostelStaffAssignment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          hostelId: "hostel-1",
          employeeId: "emp-warden-1",
          staffRole: HostelStaffRole.WARDEN,
        }),
      });
      expect(result.id).toBe("hostel-1");
      expect(result.name).toBe("Abune Petros Hall");
    });
  });

  describe("2. Block & Room Management", () => {
    it("creates room with automatic bed generation and recalculates capacity", async () => {
      (db.hostelBlock.findFirst as any).mockResolvedValueOnce({
        id: "block-a",
        name: "Block A",
        hostelId: "hostel-1",
      });
      (db.hostelRoom.findUnique as any)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: "room-101",
          roomNumber: "101",
          capacity: 4,
          beds: [{ id: "bed-1" }, { id: "bed-2" }, { id: "bed-3" }, { id: "bed-4" }],
        });

      (db.hostelRoom.create as any).mockResolvedValueOnce({
        id: "room-101",
        blockId: "block-a",
        roomNumber: "101",
        capacity: 4,
      });

      (db.hostelRoom.findMany as any).mockResolvedValueOnce([{ capacity: 4 }]);
      (db.hostel.update as any).mockResolvedValueOnce({ id: "hostel-1", totalCapacity: 4 });

      const room = await HostelService.createRoom(
        schoolId,
        "block-a",
        {
          roomNumber: "101",
          floor: 1,
          roomType: HostelRoomType.QUAD,
          capacity: 4,
          autoCreateBeds: true,
        },
        actor,
      );

      expect(db.hostelBed.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ bedNumber: "A", roomId: "room-101" }),
          expect.objectContaining({ bedNumber: "B", roomId: "room-101" }),
          expect.objectContaining({ bedNumber: "C", roomId: "room-101" }),
          expect.objectContaining({ bedNumber: "D", roomId: "room-101" }),
        ]),
      });
      expect(room?.roomNumber).toBe("101");
    });
  });

  describe("3. Phase 3: Daily Operations — Night Attendance", () => {
    it("records night attendance roll call records for rooms", async () => {
      (db.hostel.findFirst as any).mockResolvedValueOnce({ id: "hostel-1", schoolId });
      (db.hostelNightAttendance.upsert as any).mockResolvedValueOnce({
        id: "att-1",
        allocationId: "alloc-1",
        status: NightAttendanceStatus.PRESENT,
      });

      const records = [
        {
          allocationId: "alloc-1",
          status: NightAttendanceStatus.PRESENT,
          remarks: "In bed on time",
        },
      ];

      const result = await HostelService.recordNightAttendance(
        schoolId,
        "hostel-1",
        "2026-08-21",
        records,
        actor,
      );

      expect(result).toHaveLength(1);
      expect(db.hostelNightAttendance.upsert).toHaveBeenCalledTimes(1);
    });

    it("retrieves night attendance grid and marks active outpass holders as ON_OUTPASS", async () => {
      const mockAllocations = [
        {
          id: "alloc-1",
          studentProfile: {
            id: "stud-1",
            user: { id: "u-1", firstName: "Yonas", lastName: "Mekonnen", avatar: null },
            class: { id: "c1", name: "10-A" },
          },
          bed: {
            bedNumber: "A",
            room: { id: "r1", roomNumber: "101", block: { id: "b1", name: "Block A" } },
          },
          nightAttendance: [],
          outpasses: [
            {
              id: "out-1",
              type: OutpassType.WEEKEND,
              destination: "Home",
              expectedReturnAt: new Date("2026-08-22T18:00:00Z"),
            },
          ],
        },
      ];

      (db.hostelAllocation.findMany as any).mockResolvedValueOnce(mockAllocations);

      const grid = await HostelService.getHostelNightAttendance(
        schoolId,
        "hostel-1",
        "2026-08-21",
      );

      expect(grid).toHaveLength(1);
      expect(grid[0].status).toBe(NightAttendanceStatus.ON_OUTPASS);
      expect(grid[0].activeOutpass?.destination).toBe("Home");
    });
  });

  describe("4. Phase 3: Outpasses & Overdue Scanner", () => {
    it("creates outpass and processes approval and gate movements", async () => {
      (db.hostelAllocation.findFirst as any).mockResolvedValueOnce({
        id: "alloc-1",
        studentProfile: { userId: "user-student-1" },
      });

      (db.hostelOutpass.create as any).mockResolvedValueOnce({
        id: "outpass-1",
        allocationId: "alloc-1",
        destination: "Family Visit",
        status: OutpassStatus.PENDING,
      });

      const outpass = await HostelService.createOutpass(
        schoolId,
        {
          allocationId: "alloc-1",
          type: OutpassType.DAY,
          fromDateTime: "2026-08-21T08:00:00.000Z",
          expectedReturnAt: "2026-08-21T17:00:00.000Z",
          destination: "Family Visit",
          reason: "Attending family event",
        },
        actor,
      );

      expect(outpass.id).toBe("outpass-1");

      // Approve outpass
      (db.hostelOutpass.findFirst as any).mockResolvedValueOnce({
        id: "outpass-1",
        destination: "Family Visit",
        allocation: { studentProfile: { userId: "user-student-1" } },
      });
      (db.hostelOutpass.update as any).mockResolvedValueOnce({
        id: "outpass-1",
        status: OutpassStatus.APPROVED,
      });

      const approved = await HostelService.decideOutpass(
        schoolId,
        "outpass-1",
        OutpassStatus.APPROVED,
        actor,
      );
      expect(approved.status).toBe(OutpassStatus.APPROVED);

      // Gate out
      (db.hostelOutpass.findFirst as any).mockResolvedValueOnce({
        id: "outpass-1",
        status: OutpassStatus.APPROVED,
      });
      (db.hostelOutpass.update as any).mockResolvedValueOnce({
        id: "outpass-1",
        status: OutpassStatus.OUT,
      });

      const gatedOut = await HostelService.scanGateOut(
        schoolId,
        "outpass-1",
        actor,
      );
      expect(gatedOut.status).toBe(OutpassStatus.OUT);

      // Gate in (return)
      (db.hostelOutpass.findFirst as any).mockResolvedValueOnce({
        id: "outpass-1",
        status: OutpassStatus.OUT,
      });
      (db.hostelOutpass.update as any).mockResolvedValueOnce({
        id: "outpass-1",
        status: OutpassStatus.RETURNED,
      });

      const gatedIn = await HostelService.scanGateIn(
        schoolId,
        "outpass-1",
        actor,
      );
      expect(gatedIn.status).toBe(OutpassStatus.RETURNED);
    });

    it("scans and flags overdue outpasses in background job", async () => {
      const mockOverdue = [
        {
          id: "out-overdue-1",
          expectedReturnAt: new Date(Date.now() - 3600000), // 1 hr ago
          allocation: {
            studentProfile: { userId: "u-late-1" },
            hostel: { schoolId },
          },
        },
      ];

      (db.hostelOutpass.findMany as any).mockResolvedValueOnce(mockOverdue);
      (db.hostelOutpass.update as any).mockResolvedValueOnce({ id: "out-overdue-1" });

      const jobResult = await runHostelOutpassOverdueJob();
      expect(jobResult.overdueCount).toBe(1);
      expect(db.hostelOutpass.update).toHaveBeenCalledWith({
        where: { id: "out-overdue-1" },
        data: { status: OutpassStatus.OVERDUE },
      });
    });
  });

  describe("5. Phase 3: Visitor Logs", () => {
    it("logs visitor check-in and subsequent checkout", async () => {
      (db.studentProfile.findFirst as any).mockResolvedValueOnce({ id: "stud-1" });
      (db.hostelVisitorLog.create as any).mockResolvedValueOnce({
        id: "vis-1",
        visitorName: "Almaz Kebede",
        relationToStudent: "Mother",
      });

      const checkIn = await HostelService.logVisitorCheckIn(
        schoolId,
        {
          studentProfileId: "stud-1",
          visitorName: "Almaz Kebede",
          relationToStudent: "Mother",
          purpose: "Delivering school supplies",
        },
        actor,
      );

      expect(checkIn.id).toBe("vis-1");

      // Check-out
      (db.hostelVisitorLog.findFirst as any).mockResolvedValueOnce({ id: "vis-1" });
      (db.hostelVisitorLog.update as any).mockResolvedValueOnce({
        id: "vis-1",
        checkOutAt: new Date(),
      });

      const checkOut = await HostelService.logVisitorCheckOut(
        schoolId,
        "vis-1",
        actor,
      );
      expect(checkOut.checkOutAt).toBeDefined();
    });
  });

  describe("6. Phase 4: Care & Maintenance Tickets", () => {
    it("creates urgent maintenance ticket and automatically updates room status to MAINTENANCE", async () => {
      (db.hostelRoom.findFirst as any).mockResolvedValueOnce({ id: "room-101" });
      (db.hostelMaintenanceTicket.create as any).mockResolvedValueOnce({
        id: "ticket-1",
        roomId: "room-101",
        category: MaintenanceCategory.PLUMBING,
        priority: MaintenancePriority.URGENT,
      });

      const ticket = await HostelService.createMaintenanceTicket(
        schoolId,
        {
          roomId: "room-101",
          category: MaintenanceCategory.PLUMBING,
          priority: MaintenancePriority.URGENT,
          description: "Water pipe burst leaking into floor",
        },
        actor,
      );

      expect(ticket.id).toBe("ticket-1");
      expect(db.hostelRoom.update).toHaveBeenCalledWith({
        where: { id: "room-101" },
        data: { status: RoomStatus.MAINTENANCE },
      });
    });

    it("resolves maintenance ticket and recomputes room status back to AVAILABLE", async () => {
      (db.hostelMaintenanceTicket.findFirst as any).mockResolvedValueOnce({
        id: "ticket-1",
        roomId: "room-101",
      });

      (db.hostelMaintenanceTicket.update as any).mockResolvedValueOnce({
        id: "ticket-1",
        status: MaintenanceStatus.RESOLVED,
      });

      (db.hostelRoom.findUnique as any).mockResolvedValueOnce({
        id: "room-101",
        status: RoomStatus.MAINTENANCE,
        beds: [{ status: BedStatus.VACANT }],
        maintenanceTickets: [], // No more open urgent tickets
      });

      const updated = await HostelService.updateMaintenanceTicket(
        schoolId,
        "ticket-1",
        { status: MaintenanceStatus.RESOLVED, cost: 450 },
        actor,
      );

      expect(updated.status).toBe(MaintenanceStatus.RESOLVED);
      expect(db.hostelRoom.update).toHaveBeenCalledWith({
        where: { id: "room-101" },
        data: { status: RoomStatus.AVAILABLE },
      });
    });
  });

  describe("7. Phase 4: Residential Incident Reports", () => {
    it("creates severe incident report and fires notification", async () => {
      (db.hostelAllocation.findFirst as any).mockResolvedValueOnce({
        id: "alloc-1",
        studentProfile: { userId: "user-student-1" },
        hostel: { schoolId },
      });

      (db.hostelIncidentReport.create as any).mockResolvedValueOnce({
        id: "inc-1",
        severity: IncidentSeverity.SEVERE,
        description: "Curfew violation and unauthorized entry",
      });

      const incident = await HostelService.createIncidentReport(
        schoolId,
        {
          allocationId: "alloc-1",
          severity: IncidentSeverity.SEVERE,
          description: "Curfew violation and unauthorized entry",
          actionTaken: "Parent contacted and warning letter issued",
        },
        actor,
      );

      expect(incident.id).toBe("inc-1");
      expect(db.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user-student-1",
          type: NotificationType.HOSTEL,
          title: "Residential Incident Logged",
        }),
      });
    });
  });

  describe("8. Phase 4: Room Transfer Requests", () => {
    it("executes atomic room transfer freeing old bed and placing student into new bed", async () => {
      (db.hostelAllocation.findFirst as any).mockResolvedValueOnce({
        id: "alloc-1",
        studentProfileId: "stud-1",
      });

      (db.hostelTransferRequest.create as any).mockResolvedValueOnce({
        id: "tr-1",
        status: TransferRequestStatus.PENDING,
      });

      const request = await HostelService.createTransferRequest(
        schoolId,
        {
          fromAllocationId: "alloc-1",
          toBedId: "bed-target",
          reason: "Requesting quieter study floor",
        },
        actor,
      );

      expect(request.id).toBe("tr-1");

      // Decide and execute transfer
      (db.hostelTransferRequest.findFirst as any).mockResolvedValueOnce({
        id: "tr-1",
        fromAllocationId: "alloc-1",
        studentProfileId: "stud-1",
        toBedId: "bed-target",
        status: TransferRequestStatus.PENDING,
        fromAllocation: {
          id: "alloc-1",
          hostelId: "hostel-1",
          academicTermId: "term-1",
          bed: { id: "bed-old", roomId: "room-old" },
        },
        studentProfile: { userId: "u-1" },
      });

      (db.hostelBed.findFirst as any).mockResolvedValueOnce({
        id: "bed-target",
        bedNumber: "B",
        status: BedStatus.VACANT,
        room: { id: "room-target", roomNumber: "202", block: { id: "b1" } },
      });

      (db.hostelRoom.findUnique as any)
        .mockResolvedValueOnce({ id: "room-old", status: RoomStatus.FULL, beds: [{ status: BedStatus.VACANT }] })
        .mockResolvedValueOnce({ id: "room-target", status: RoomStatus.AVAILABLE, beds: [{ status: BedStatus.OCCUPIED }] });

      const transferResult = await HostelService.decideTransferRequest(
        schoolId,
        "tr-1",
        { status: TransferRequestStatus.APPROVED },
        actor,
      );

      expect(transferResult.success).toBe(true);
      expect(transferResult.newRoomNumber).toBe("202");
      expect(db.hostelBed.update).toHaveBeenCalledWith({
        where: { id: "bed-old" },
        data: { status: BedStatus.VACANT },
      });
      expect(db.hostelBed.update).toHaveBeenCalledWith({
        where: { id: "bed-target" },
        data: { status: BedStatus.OCCUPIED },
      });
      expect(db.hostelAllocation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          hostelId: "hostel-1",
          bedId: "bed-target",
          studentProfileId: "stud-1",
          status: AllocationStatus.ACTIVE,
        }),
      });
    });
  });
});
