import { db } from "../../config/database";
import { AppError } from "../../middleware/errorHandler";
import {
  HostelType,
  HostelRoomType,
  RoomStatus,
  BedStatus,
  HostelStaffRole,
  HostelApplicationStatus,
  AllocationStatus,
  TransferRequestStatus,
  OutpassType,
  OutpassStatus,
  NightAttendanceStatus,
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceStatus,
  IncidentSeverity,
  FeeType,
  FeeStatus,
  NotificationType,
  Role,
  Gender,
} from "@prisma/client";
import { recordAuditEvent } from "../../utils/auditLog";
import { logger } from "../../utils/logger";

// ── Types & Interfaces ────────────────────────────────────────────────────────

export interface CreateHostelInput {
  name: string;
  type: HostelType;
  wardenId?: string | null;
  address?: string | null;
  isActive?: boolean;
}

export interface UpdateHostelInput {
  name?: string;
  type?: HostelType;
  wardenId?: string | null;
  address?: string | null;
  isActive?: boolean;
}

export interface CreateBlockInput {
  name: string;
  floorCount?: number;
  gradeMin?: string | null;
  gradeMax?: string | null;
  isActive?: boolean;
}

export interface UpdateBlockInput {
  name?: string;
  floorCount?: number;
  gradeMin?: string | null;
  gradeMax?: string | null;
  isActive?: boolean;
}

export interface CreateRoomInput {
  roomNumber: string;
  floor?: number;
  roomType: HostelRoomType;
  capacity: number;
  status?: RoomStatus;
  amenities?: string[] | null;
  isAccessible?: boolean;
  autoCreateBeds?: boolean;
}

export interface UpdateRoomInput {
  roomNumber?: string;
  floor?: number;
  roomType?: HostelRoomType;
  capacity?: number;
  status?: RoomStatus;
  amenities?: string[] | null;
  isAccessible?: boolean;
}

export interface CreateBedInput {
  bedNumber: string;
  status?: BedStatus;
}

export interface BulkCreateBedsInput {
  bedNumbers?: string[];
  count?: number;
  prefix?: string;
}

export interface StaffAssignmentInput {
  employeeId: string;
  staffRole: HostelStaffRole;
  blockId?: string | null;
  shift?: string | null;
  isActive?: boolean;
}

export interface SubmitHostelApplicationInput {
  hostelId?: string | null;
  studentProfileId: string;
  academicTermId?: string | null;
  preferredRoomType?: HostelRoomType | null;
  medicalNotes?: string | null;
  specialRequests?: string | null;
  roommatePreference?: string | null;
  guardianConsent?: boolean;
}

export interface ReviewHostelApplicationInput {
  status: HostelApplicationStatus;
  reviewNotes?: string | null;
  hostelId?: string | null;
}

export interface ManualAllocationInput {
  applicationId?: string | null;
  hostelId: string;
  bedId: string;
  studentProfileId: string;
  academicTermId?: string | null;
  boardingFeeAmount?: number;
  forceGenderOverride?: boolean;
}

export interface NightAttendanceItem {
  allocationId: string;
  status: NightAttendanceStatus;
  remarks?: string | null;
}

export interface CreateOutpassInput {
  allocationId: string;
  type: OutpassType;
  fromDateTime: Date | string;
  expectedReturnAt: Date | string;
  destination: string;
  contactAtDestination?: string | null;
  reason: string;
}

export interface CreateVisitorLogInput {
  studentProfileId: string;
  visitorName: string;
  relationToStudent: string;
  idProofType?: string | null;
  idProofNumber?: string | null;
  purpose?: string | null;
}

export interface CreateMaintenanceTicketInput {
  roomId: string;
  category: MaintenanceCategory;
  priority?: MaintenancePriority;
  description: string;
  assignedToId?: string | null;
}

export interface UpdateMaintenanceTicketInput {
  category?: MaintenanceCategory;
  priority?: MaintenancePriority;
  status?: MaintenanceStatus;
  description?: string;
  assignedToId?: string | null;
  cost?: number | null;
}

export interface CreateIncidentReportInput {
  allocationId: string;
  severity: IncidentSeverity;
  description: string;
  actionTaken?: string | null;
  linkedBehaviourId?: string | null;
}

export interface CreateTransferRequestInput {
  fromAllocationId: string;
  toBedId?: string | null;
  reason: string;
}

// ── Helpers: Recalculate Capacity and Status ──────────────────────────────────

export async function recalculateHostelCapacity(hostelId: string): Promise<number> {
  const rooms = await db.hostelRoom.findMany({
    where: { block: { hostelId } },
    select: { capacity: true },
  });

  const totalCapacity = rooms.reduce((sum, r) => sum + (r.capacity || 0), 0);

  await db.hostel.update({
    where: { id: hostelId },
    data: { totalCapacity },
  });

  return totalCapacity;
}

export async function recalculateRoomStatus(roomId: string): Promise<RoomStatus> {
  const room = await db.hostelRoom.findUnique({
    where: { id: roomId },
    include: {
      beds: true,
      maintenanceTickets: {
        where: {
          status: { in: [MaintenanceStatus.OPEN, MaintenanceStatus.ASSIGNED, MaintenanceStatus.IN_PROGRESS] },
          priority: MaintenancePriority.URGENT,
        },
      },
    },
  });

  if (!room) return RoomStatus.AVAILABLE;

  // If urgent maintenance ticket is active on this room
  if (room.maintenanceTickets && room.maintenanceTickets.length > 0) {
    if (room.status !== RoomStatus.MAINTENANCE) {
      await db.hostelRoom.update({
        where: { id: roomId },
        data: { status: RoomStatus.MAINTENANCE },
      });
    }
    return RoomStatus.MAINTENANCE;
  }

  if (
    room.status === RoomStatus.CLOSED ||
    room.status === RoomStatus.RESERVED
  ) {
    return room.status;
  }

  const bedsList = room.beds || [];
  const occupiedOrReservedBeds = bedsList.filter(
    (b) => b.status === BedStatus.OCCUPIED || b.status === BedStatus.RESERVED,
  ).length;

  const newStatus =
    bedsList.length > 0 && occupiedOrReservedBeds >= bedsList.length
      ? RoomStatus.FULL
      : RoomStatus.AVAILABLE;

  if (room.status !== newStatus) {
    await db.hostelRoom.update({
      where: { id: roomId },
      data: { status: newStatus },
    });
  }

  return newStatus;
}

// ── Priority Scoring Calculation ──────────────────────────────────────────────

export async function calculateApplicationPriorityScore(
  schoolId: string,
  studentProfileId: string,
  medicalNotes?: string | null,
  specialRequests?: string | null,
  submittedAt: Date = new Date(),
): Promise<number> {
  let score = 0;

  // 1. Medical notes (+50)
  if (medicalNotes && medicalNotes.trim().length > 0) {
    score += 50;
  }

  // 2. Special requests / mobility (+10)
  if (specialRequests && specialRequests.trim().length > 0) {
    score += 10;
  }

  // 3. Sibling already actively allocated in hostel (+30)
  try {
    const parentLinks = await db.parentStudentLink.findMany({
      where: { studentProfileId },
      include: {
        parentProfile: {
          include: {
            studentLinks: {
              where: { studentProfileId: { not: studentProfileId } },
              include: {
                studentProfile: {
                  include: {
                    hostelAllocations: {
                      where: { status: AllocationStatus.ACTIVE },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const hasActiveSibling = parentLinks.some((pl: any) =>
      pl.parentProfile?.studentLinks?.some((sl: any) => sl.studentProfile?.hostelAllocations?.length > 0),
    );
    if (hasActiveSibling) score += 30;
  } catch (err) {
    logger.warn("Failed to check sibling hostel allocations:", err);
  }

  // 4. Returning resident in good standing (+15)
  try {
    const pastAllocations = await db.hostelAllocation.count({
      where: {
        studentProfileId,
        status: { in: [AllocationStatus.CHECKED_OUT, AllocationStatus.EXPIRED] },
      },
    });
    if (pastAllocations > 0) score += 15;
  } catch (err) {
    logger.warn("Failed to check past hostel allocations:", err);
  }

  // 5. Disciplinary penalty check (-100 for high/critical records)
  try {
    const studentProf = await db.studentProfile.findUnique({
      where: { id: studentProfileId },
      select: { userId: true },
    });
    if (studentProf?.userId) {
      const disciplinaryCount = await db.behaviourRecord.count({
        where: {
          studentId: studentProf.userId,
          type: { in: ["SUSPENSION", "WARNING", "INCIDENT"] },
          severity: { in: ["HIGH", "CRITICAL"] },
        },
      });
      if (disciplinaryCount > 0) score -= 100;
    }
  } catch (err) {
    logger.warn("Failed to check student behaviour records:", err);
  }

  // 6. Days since submission slight FIFO tiebreaker (max 20)
  const daysSince = Math.min(
    20,
    Math.max(0, Math.floor((Date.now() - submittedAt.getTime()) / (1000 * 60 * 60 * 24))),
  );
  score += daysSince;

  return score;
}

// ── 1. HOSTEL CRUD ─────────────────────────────────────────────────────────────

export async function createHostel(
  schoolId: string,
  input: CreateHostelInput,
  actor: { id: string; email: string; role: string },
) {
  const hostel = await db.hostel.create({
    data: {
      schoolId,
      name: input.name,
      type: input.type,
      wardenId: input.wardenId || null,
      address: input.address || null,
      isActive: input.isActive ?? true,
      totalCapacity: 0,
    },
    include: {
      warden: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  if (input.wardenId) {
    await db.hostelStaffAssignment.create({
      data: {
        hostelId: hostel.id,
        employeeId: input.wardenId,
        staffRole: HostelStaffRole.WARDEN,
        shift: "24h",
        isActive: true,
      },
    });
  }

  await recordAuditEvent({
    schoolId,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "HOSTEL_CREATED",
    targetType: "Hostel",
    targetId: hostel.id,
    metadata: { name: hostel.name, type: hostel.type },
  });

  return hostel;
}

export async function getHostels(
  schoolId: string,
  filters?: {
    type?: HostelType;
    isActive?: boolean;
    search?: string;
  },
) {
  const where: any = { schoolId };

  if (filters?.type) where.type = filters.type;
  if (filters?.isActive !== undefined) where.isActive = filters.isActive;
  if (filters?.search) {
    where.name = { contains: filters.search, mode: "insensitive" };
  }

  return db.hostel.findMany({
    where,
    include: {
      warden: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      blocks: {
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          floorCount: true,
          _count: { select: { rooms: true } },
        },
      },
      _count: {
        select: {
          blocks: true,
          allocations: { where: { status: AllocationStatus.ACTIVE } },
          applications: { where: { status: HostelApplicationStatus.PENDING } },
        },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function getHostelById(schoolId: string, hostelId: string) {
  const hostel = await db.hostel.findFirst({
    where: { id: hostelId, schoolId },
    include: {
      warden: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      blocks: {
        include: {
          rooms: {
            include: {
              beds: {
                include: {
                  allocations: {
                    where: { status: AllocationStatus.ACTIVE },
                    include: {
                      studentProfile: {
                        include: {
                          user: {
                            select: {
                              id: true,
                              firstName: true,
                              lastName: true,
                              avatar: true,
                              gender: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      staff: {
        where: { isActive: true },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          block: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!hostel) {
    throw new AppError("Hostel not found", 404);
  }

  return hostel;
}

export async function updateHostel(
  schoolId: string,
  hostelId: string,
  input: UpdateHostelInput,
  actor: { id: string; email: string; role: string },
) {
  const existing = await db.hostel.findFirst({
    where: { id: hostelId, schoolId },
  });

  if (!existing) {
    throw new AppError("Hostel not found", 404);
  }

  const updated = await db.hostel.update({
    where: { id: hostelId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.type !== undefined && { type: input.type }),
      ...(input.wardenId !== undefined && { wardenId: input.wardenId }),
      ...(input.address !== undefined && { address: input.address }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
    include: {
      warden: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  if (input.wardenId !== undefined && input.wardenId !== existing.wardenId) {
    if (existing.wardenId) {
      await db.hostelStaffAssignment.updateMany({
        where: {
          hostelId,
          employeeId: existing.wardenId,
          staffRole: HostelStaffRole.WARDEN,
        },
        data: { isActive: false },
      });
    }
    if (input.wardenId) {
      await db.hostelStaffAssignment.create({
        data: {
          hostelId,
          employeeId: input.wardenId,
          staffRole: HostelStaffRole.WARDEN,
          shift: "24h",
          isActive: true,
        },
      });
    }
  }

  await recordAuditEvent({
    schoolId,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "HOSTEL_UPDATED",
    targetType: "Hostel",
    targetId: hostelId,
    metadata: { changes: input },
  });

  return updated;
}

export async function deleteHostel(
  schoolId: string,
  hostelId: string,
  actor: { id: string; email: string; role: string },
) {
  const existing = await db.hostel.findFirst({
    where: { id: hostelId, schoolId },
    include: {
      allocations: { where: { status: AllocationStatus.ACTIVE } },
    },
  });

  if (!existing) {
    throw new AppError("Hostel not found", 404);
  }

  if (existing.allocations.length > 0) {
    throw new AppError(
      `Cannot delete hostel with ${existing.allocations.length} active resident allocations. Vacate residents first.`,
      400,
    );
  }

  await db.hostel.delete({ where: { id: hostelId } });

  await recordAuditEvent({
    schoolId,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "HOSTEL_DELETED",
    targetType: "Hostel",
    targetId: hostelId,
    metadata: { name: existing.name },
  });

  return { success: true };
}

// ── 2. BLOCK CRUD ──────────────────────────────────────────────────────────────

export async function createBlock(
  schoolId: string,
  hostelId: string,
  input: CreateBlockInput,
  actor: { id: string; email: string; role: string },
) {
  const hostel = await db.hostel.findFirst({
    where: { id: hostelId, schoolId },
  });
  if (!hostel) throw new AppError("Hostel not found", 404);

  const block = await db.hostelBlock.create({
    data: {
      hostelId,
      name: input.name,
      floorCount: input.floorCount || 1,
      gradeMin: input.gradeMin || null,
      gradeMax: input.gradeMax || null,
      isActive: input.isActive ?? true,
    },
  });

  await recordAuditEvent({
    schoolId,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "HOSTEL_BLOCK_CREATED",
    targetType: "HostelBlock",
    targetId: block.id,
    metadata: { hostelId, blockName: block.name },
  });

  return block;
}

export async function getBlocks(schoolId: string, hostelId: string) {
  const hostel = await db.hostel.findFirst({
    where: { id: hostelId, schoolId },
  });
  if (!hostel) throw new AppError("Hostel not found", 404);

  return db.hostelBlock.findMany({
    where: { hostelId },
    include: {
      rooms: {
        include: {
          beds: true,
        },
      },
      staff: {
        where: { isActive: true },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function getBlockById(schoolId: string, blockId: string) {
  const block = await db.hostelBlock.findFirst({
    where: { id: blockId, hostel: { schoolId } },
    include: {
      hostel: true,
      rooms: {
        include: {
          beds: {
            include: {
              allocations: {
                where: { status: AllocationStatus.ACTIVE },
                include: {
                  studentProfile: {
                    include: {
                      user: {
                        select: {
                          id: true,
                          firstName: true,
                          lastName: true,
                          avatar: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!block) throw new AppError("Hostel block not found", 404);
  return block;
}

export async function updateBlock(
  schoolId: string,
  blockId: string,
  input: UpdateBlockInput,
  actor: { id: string; email: string; role: string },
) {
  const existing = await db.hostelBlock.findFirst({
    where: { id: blockId, hostel: { schoolId } },
  });
  if (!existing) throw new AppError("Hostel block not found", 404);

  const updated = await db.hostelBlock.update({
    where: { id: blockId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.floorCount !== undefined && { floorCount: input.floorCount }),
      ...(input.gradeMin !== undefined && { gradeMin: input.gradeMin }),
      ...(input.gradeMax !== undefined && { gradeMax: input.gradeMax }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
  });

  await recordAuditEvent({
    schoolId,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "HOSTEL_BLOCK_UPDATED",
    targetType: "HostelBlock",
    targetId: blockId,
    metadata: { changes: input },
  });

  return updated;
}

export async function deleteBlock(
  schoolId: string,
  blockId: string,
  actor: { id: string; email: string; role: string },
) {
  const existing = await db.hostelBlock.findFirst({
    where: { id: blockId, hostel: { schoolId } },
    include: {
      rooms: {
        include: {
          beds: {
            include: {
              allocations: { where: { status: AllocationStatus.ACTIVE } },
            },
          },
        },
      },
    },
  });

  if (!existing) throw new AppError("Hostel block not found", 404);

  const activeAllocations = existing.rooms.flatMap((r) =>
    r.beds.flatMap((b) => b.allocations),
  );

  if (activeAllocations.length > 0) {
    throw new AppError(
      `Cannot delete block with ${activeAllocations.length} active resident allocations. Vacate residents first.`,
      400,
    );
  }

  const hostelId = existing.hostelId;
  await db.hostelBlock.delete({ where: { id: blockId } });
  await recalculateHostelCapacity(hostelId);

  await recordAuditEvent({
    schoolId,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "HOSTEL_BLOCK_DELETED",
    targetType: "HostelBlock",
    targetId: blockId,
    metadata: { blockName: existing.name },
  });

  return { success: true };
}

// ── 3. ROOM CRUD ───────────────────────────────────────────────────────────────

export async function createRoom(
  schoolId: string,
  blockId: string,
  input: CreateRoomInput,
  actor: { id: string; email: string; role: string },
) {
  const block = await db.hostelBlock.findFirst({
    where: { id: blockId, hostel: { schoolId } },
  });
  if (!block) throw new AppError("Hostel block not found", 404);

  const duplicate = await db.hostelRoom.findUnique({
    where: {
      blockId_roomNumber: {
        blockId,
        roomNumber: input.roomNumber,
      },
    },
  });
  if (duplicate) {
    throw new AppError(
      `Room number "${input.roomNumber}" already exists in ${block.name}`,
      400,
    );
  }

  const room = await db.hostelRoom.create({
    data: {
      blockId,
      roomNumber: input.roomNumber,
      floor: input.floor || 1,
      roomType: input.roomType,
      capacity: input.capacity,
      status: input.status || RoomStatus.AVAILABLE,
      amenities: input.amenities || [],
      isAccessible: input.isAccessible ?? false,
    },
  });

  if (input.autoCreateBeds !== false && input.capacity > 0) {
    const bedLetters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
    const bedsData = Array.from({ length: input.capacity }).map((_, i) => ({
      roomId: room.id,
      bedNumber: bedLetters[i] || `${i + 1}`,
      status: BedStatus.VACANT,
    }));

    await db.hostelBed.createMany({ data: bedsData });
  }

  await recalculateHostelCapacity(block.hostelId);

  const fullRoom = await db.hostelRoom.findUnique({
    where: { id: room.id },
    include: { beds: true },
  });

  await recordAuditEvent({
    schoolId,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "HOSTEL_ROOM_CREATED",
    targetType: "HostelRoom",
    targetId: room.id,
    metadata: {
      blockId,
      roomNumber: room.roomNumber,
      capacity: room.capacity,
      type: room.roomType,
    },
  });

  return fullRoom;
}

export async function getRooms(
  schoolId: string,
  blockId: string,
  filters?: { status?: RoomStatus; floor?: number },
) {
  const block = await db.hostelBlock.findFirst({
    where: { id: blockId, hostel: { schoolId } },
  });
  if (!block) throw new AppError("Hostel block not found", 404);

  const where: any = { blockId };
  if (filters?.status) where.status = filters.status;
  if (filters?.floor !== undefined) where.floor = filters.floor;

  return db.hostelRoom.findMany({
    where,
    include: {
      beds: {
        include: {
          allocations: {
            where: { status: AllocationStatus.ACTIVE },
            include: {
              studentProfile: {
                include: {
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      avatar: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      maintenanceTickets: {
        where: { status: { in: [MaintenanceStatus.OPEN, MaintenanceStatus.ASSIGNED, MaintenanceStatus.IN_PROGRESS] } },
        select: { id: true, category: true, priority: true, status: true },
      },
    },
    orderBy: [{ floor: "asc" }, { roomNumber: "asc" }],
  });
}

export async function getRoomById(schoolId: string, roomId: string) {
  const room = await db.hostelRoom.findFirst({
    where: { id: roomId, block: { hostel: { schoolId } } },
    include: {
      block: { include: { hostel: true } },
      beds: {
        include: {
          allocations: {
            where: { status: AllocationStatus.ACTIVE },
            include: {
              studentProfile: {
                include: {
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      avatar: true,
                      gender: true,
                    },
                  },
                  class: { select: { id: true, name: true } },
                  gradeLevel: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!room) throw new AppError("Hostel room not found", 404);
  return room;
}

export async function updateRoom(
  schoolId: string,
  roomId: string,
  input: UpdateRoomInput,
  actor: { id: string; email: string; role: string },
) {
  const existing = await db.hostelRoom.findFirst({
    where: { id: roomId, block: { hostel: { schoolId } } },
    include: { block: true },
  });
  if (!existing) throw new AppError("Hostel room not found", 404);

  if (input.roomNumber && input.roomNumber !== existing.roomNumber) {
    const duplicate = await db.hostelRoom.findUnique({
      where: {
        blockId_roomNumber: {
          blockId: existing.blockId,
          roomNumber: input.roomNumber,
        },
      },
    });
    if (duplicate) {
      throw new AppError(
        `Room number "${input.roomNumber}" already exists in ${existing.block.name}`,
        400,
      );
    }
  }

  const updated = await db.hostelRoom.update({
    where: { id: roomId },
    data: {
      ...(input.roomNumber !== undefined && { roomNumber: input.roomNumber }),
      ...(input.floor !== undefined && { floor: input.floor }),
      ...(input.roomType !== undefined && { roomType: input.roomType }),
      ...(input.capacity !== undefined && { capacity: input.capacity }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.amenities !== undefined && { amenities: input.amenities ?? [] }),
      ...(input.isAccessible !== undefined && { isAccessible: input.isAccessible }),
    },
    include: { beds: true },
  });

  if (input.capacity !== undefined && input.capacity !== existing.capacity) {
    await recalculateHostelCapacity(existing.block.hostelId);
  }

  await recordAuditEvent({
    schoolId,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "HOSTEL_ROOM_UPDATED",
    targetType: "HostelRoom",
    targetId: roomId,
    metadata: { changes: input },
  });

  return updated;
}

export async function deleteRoom(
  schoolId: string,
  roomId: string,
  actor: { id: string; email: string; role: string },
) {
  const existing = await db.hostelRoom.findFirst({
    where: { id: roomId, block: { hostel: { schoolId } } },
    include: {
      block: true,
      beds: {
        include: {
          allocations: { where: { status: AllocationStatus.ACTIVE } },
        },
      },
    },
  });

  if (!existing) throw new AppError("Hostel room not found", 404);

  const activeAllocations = existing.beds.flatMap((b) => b.allocations);
  if (activeAllocations.length > 0) {
    throw new AppError(
      `Cannot delete room with ${activeAllocations.length} active resident allocations. Vacate residents first.`,
      400,
    );
  }

  const hostelId = existing.block.hostelId;
  await db.hostelRoom.delete({ where: { id: roomId } });
  await recalculateHostelCapacity(hostelId);

  await recordAuditEvent({
    schoolId,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "HOSTEL_ROOM_DELETED",
    targetType: "HostelRoom",
    targetId: roomId,
    metadata: { roomNumber: existing.roomNumber },
  });

  return { success: true };
}

// ── 4. BED CRUD & BULK CREATION ────────────────────────────────────────────────

export async function createBed(
  schoolId: string,
  roomId: string,
  input: CreateBedInput,
  actor: { id: string; email: string; role: string },
) {
  const room = await db.hostelRoom.findFirst({
    where: { id: roomId, block: { hostel: { schoolId } } },
    include: { block: true, beds: true },
  });
  if (!room) throw new AppError("Hostel room not found", 404);

  const duplicate = await db.hostelBed.findUnique({
    where: {
      roomId_bedNumber: {
        roomId,
        bedNumber: input.bedNumber,
      },
    },
  });
  if (duplicate) {
    throw new AppError(
      `Bed "${input.bedNumber}" already exists in room ${room.roomNumber}`,
      400,
    );
  }

  const bed = await db.hostelBed.create({
    data: {
      roomId,
      bedNumber: input.bedNumber,
      status: input.status || BedStatus.VACANT,
    },
  });

  if (room.beds.length + 1 > room.capacity) {
    await db.hostelRoom.update({
      where: { id: roomId },
      data: { capacity: room.beds.length + 1 },
    });
    await recalculateHostelCapacity(room.block.hostelId);
  }

  await recalculateRoomStatus(roomId);

  await recordAuditEvent({
    schoolId,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "HOSTEL_BED_CREATED",
    targetType: "HostelBed",
    targetId: bed.id,
    metadata: { roomId, bedNumber: bed.bedNumber },
  });

  return bed;
}

export async function bulkCreateBeds(
  schoolId: string,
  roomId: string,
  input: BulkCreateBedsInput,
  actor: { id: string; email: string; role: string },
) {
  const room = await db.hostelRoom.findFirst({
    where: { id: roomId, block: { hostel: { schoolId } } },
    include: { block: true, beds: true },
  });
  if (!room) throw new AppError("Hostel room not found", 404);

  const existingBedNumbers = new Set(room.beds.map((b) => b.bedNumber.toUpperCase()));

  let bedNumbersToAdd: string[] = [];
  if (input.bedNumbers && input.bedNumbers.length > 0) {
    bedNumbersToAdd = input.bedNumbers;
  } else if (input.count && input.count > 0) {
    const prefix = input.prefix || "Bed-";
    bedNumbersToAdd = Array.from({ length: input.count }).map(
      (_, i) => `${prefix}${i + 1}`,
    );
  } else {
    throw new AppError("Either bedNumbers array or count must be provided", 400);
  }

  const validBedsToAdd = bedNumbersToAdd.filter(
    (b) => !existingBedNumbers.has(b.toUpperCase()),
  );

  if (validBedsToAdd.length === 0) {
    throw new AppError("All specified bed numbers already exist in this room", 400);
  }

  await db.hostelBed.createMany({
    data: validBedsToAdd.map((bedNumber) => ({
      roomId,
      bedNumber,
      status: BedStatus.VACANT,
    })),
  });

  const totalBedsCount = room.beds.length + validBedsToAdd.length;
  if (totalBedsCount > room.capacity) {
    await db.hostelRoom.update({
      where: { id: roomId },
      data: { capacity: totalBedsCount },
    });
    await recalculateHostelCapacity(room.block.hostelId);
  }

  await recalculateRoomStatus(roomId);

  const updatedBeds = await db.hostelBed.findMany({
    where: { roomId },
    orderBy: { bedNumber: "asc" },
  });

  await recordAuditEvent({
    schoolId,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "HOSTEL_BEDS_BULK_CREATED",
    targetType: "HostelRoom",
    targetId: roomId,
    metadata: { addedCount: validBedsToAdd.length, beds: validBedsToAdd },
  });

  return {
    addedCount: validBedsToAdd.length,
    beds: updatedBeds,
  };
}

export async function updateBed(
  schoolId: string,
  bedId: string,
  input: { bedNumber?: string; status?: BedStatus },
  actor: { id: string; email: string; role: string },
) {
  const existing = await db.hostelBed.findFirst({
    where: { id: bedId, room: { block: { hostel: { schoolId } } } },
    include: {
      room: { include: { block: true } },
      allocations: { where: { status: AllocationStatus.ACTIVE } },
    },
  });

  if (!existing) throw new AppError("Hostel bed not found", 404);

  if (
    input.status === BedStatus.VACANT &&
    existing.allocations.length > 0
  ) {
    throw new AppError(
      "Cannot mark bed VACANT while an active student allocation exists. Vacate the allocation first.",
      400,
    );
  }

  if (input.bedNumber && input.bedNumber !== existing.bedNumber) {
    const duplicate = await db.hostelBed.findUnique({
      where: {
        roomId_bedNumber: {
          roomId: existing.roomId,
          bedNumber: input.bedNumber,
        },
      },
    });
    if (duplicate) {
      throw new AppError(
        `Bed "${input.bedNumber}" already exists in room ${existing.room.roomNumber}`,
        400,
      );
    }
  }

  const updated = await db.hostelBed.update({
    where: { id: bedId },
    data: {
      ...(input.bedNumber !== undefined && { bedNumber: input.bedNumber }),
      ...(input.status !== undefined && { status: input.status }),
    },
  });

  await recalculateRoomStatus(existing.roomId);

  await recordAuditEvent({
    schoolId,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "HOSTEL_BED_UPDATED",
    targetType: "HostelBed",
    targetId: bedId,
    metadata: { changes: input },
  });

  return updated;
}

export async function deleteBed(
  schoolId: string,
  bedId: string,
  actor: { id: string; email: string; role: string },
) {
  const existing = await db.hostelBed.findFirst({
    where: { id: bedId, room: { block: { hostel: { schoolId } } } },
    include: {
      room: { include: { block: true } },
      allocations: { where: { status: AllocationStatus.ACTIVE } },
    },
  });

  if (!existing) throw new AppError("Hostel bed not found", 404);

  if (existing.allocations.length > 0) {
    throw new AppError(
      "Cannot delete bed with an active resident allocation. Vacate resident first.",
      400,
    );
  }

  const roomId = existing.roomId;
  const hostelId = existing.room.block.hostelId;

  await db.hostelBed.delete({ where: { id: bedId } });
  await recalculateRoomStatus(roomId);
  await recalculateHostelCapacity(hostelId);

  await recordAuditEvent({
    schoolId,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "HOSTEL_BED_DELETED",
    targetType: "HostelBed",
    targetId: bedId,
    metadata: { bedNumber: existing.bedNumber, roomId },
  });

  return { success: true };
}

// ── 5. STAFF ASSIGNMENT ────────────────────────────────────────────────────────

export async function assignHostelStaff(
  schoolId: string,
  hostelId: string,
  input: StaffAssignmentInput,
  actor: { id: string; email: string; role: string },
) {
  const hostel = await db.hostel.findFirst({
    where: { id: hostelId, schoolId },
  });
  if (!hostel) throw new AppError("Hostel not found", 404);

  const employee = await db.employee.findFirst({
    where: { id: input.employeeId, schoolId },
  });
  if (!employee) throw new AppError("Employee not found", 404);

  if (input.blockId) {
    const block = await db.hostelBlock.findFirst({
      where: { id: input.blockId, hostelId },
    });
    if (!block) throw new AppError("Hostel block not found in this hostel", 404);
  }

  const assignment = await db.hostelStaffAssignment.create({
    data: {
      hostelId,
      employeeId: input.employeeId,
      staffRole: input.staffRole,
      blockId: input.blockId || null,
      shift: input.shift || "Day",
      isActive: input.isActive ?? true,
    },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      block: { select: { id: true, name: true } },
    },
  });

  await recordAuditEvent({
    schoolId,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "HOSTEL_STAFF_ASSIGNED",
    targetType: "HostelStaffAssignment",
    targetId: assignment.id,
    metadata: {
      hostelId,
      employeeId: input.employeeId,
      role: input.staffRole,
    },
  });

  return assignment;
}

export async function getHostelStaff(schoolId: string, hostelId: string) {
  const hostel = await db.hostel.findFirst({
    where: { id: hostelId, schoolId },
  });
  if (!hostel) throw new AppError("Hostel not found", 404);

  return db.hostelStaffAssignment.findMany({
    where: { hostelId },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          avatar: true,
        },
      },
      block: { select: { id: true, name: true } },
    },
    orderBy: { assignedAt: "desc" },
  });
}

export async function updateStaffAssignment(
  schoolId: string,
  assignmentId: string,
  input: Partial<StaffAssignmentInput>,
  actor: { id: string; email: string; role: string },
) {
  const existing = await db.hostelStaffAssignment.findFirst({
    where: { id: assignmentId, hostel: { schoolId } },
  });
  if (!existing) throw new AppError("Staff assignment not found", 404);

  const updated = await db.hostelStaffAssignment.update({
    where: { id: assignmentId },
    data: {
      ...(input.staffRole !== undefined && { staffRole: input.staffRole }),
      ...(input.blockId !== undefined && { blockId: input.blockId }),
      ...(input.shift !== undefined && { shift: input.shift }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      block: { select: { id: true, name: true } },
    },
  });

  await recordAuditEvent({
    schoolId,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "HOSTEL_STAFF_ASSIGNMENT_UPDATED",
    targetType: "HostelStaffAssignment",
    targetId: assignmentId,
    metadata: { changes: input },
  });

  return updated;
}

export async function removeStaffAssignment(
  schoolId: string,
  assignmentId: string,
  actor: { id: string; email: string; role: string },
) {
  const existing = await db.hostelStaffAssignment.findFirst({
    where: { id: assignmentId, hostel: { schoolId } },
  });
  if (!existing) throw new AppError("Staff assignment not found", 404);

  await db.hostelStaffAssignment.delete({ where: { id: assignmentId } });

  await recordAuditEvent({
    schoolId,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "HOSTEL_STAFF_ASSIGNMENT_REMOVED",
    targetType: "HostelStaffAssignment",
    targetId: assignmentId,
    metadata: { employeeId: existing.employeeId, hostelId: existing.hostelId },
  });

  return { success: true };
}

// ── 6. OCCUPANCY DASHBOARD & ANALYTICS ─────────────────────────────────────────

export async function getHostelOccupancy(schoolId: string, hostelId: string) {
  const hostel = await db.hostel.findFirst({
    where: { id: hostelId, schoolId },
    include: {
      blocks: {
        include: {
          rooms: {
            include: {
              beds: {
                include: {
                  allocations: {
                    where: { status: AllocationStatus.ACTIVE },
                    include: {
                      studentProfile: {
                        include: {
                          user: {
                            select: {
                              id: true,
                              firstName: true,
                              lastName: true,
                              avatar: true,
                              gender: true,
                            },
                          },
                          class: { select: { id: true, name: true } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!hostel) throw new AppError("Hostel not found", 404);

  let totalBeds = 0;
  let occupiedBeds = 0;
  let vacantBeds = 0;
  let reservedBeds = 0;
  let outOfServiceBeds = 0;

  const blocksSummary = hostel.blocks.map((block) => {
    let blockTotalBeds = 0;
    let blockOccupiedBeds = 0;
    let blockVacantBeds = 0;
    let blockReservedBeds = 0;
    let blockOutOfServiceBeds = 0;

    const roomsSummary = block.rooms.map((room) => {
      const roomTotalBeds = room.beds.length;
      const roomOccupied = room.beds.filter(
        (b) => b.status === BedStatus.OCCUPIED || b.allocations.length > 0,
      ).length;
      const roomVacant = room.beds.filter(
        (b) => b.status === BedStatus.VACANT && b.allocations.length === 0,
      ).length;
      const roomReserved = room.beds.filter(
        (b) => b.status === BedStatus.RESERVED,
      ).length;
      const roomOutOfService = room.beds.filter(
        (b) => b.status === BedStatus.OUT_OF_SERVICE,
      ).length;

      blockTotalBeds += roomTotalBeds;
      blockOccupiedBeds += roomOccupied;
      blockVacantBeds += roomVacant;
      blockReservedBeds += roomReserved;
      blockOutOfServiceBeds += roomOutOfService;

      const occupants = room.beds.flatMap((b) =>
        b.allocations.map((a) => ({
          allocationId: a.id,
          bedNumber: b.bedNumber,
          studentId: a.studentProfile.id,
          studentName: `${a.studentProfile.user.firstName} ${a.studentProfile.user.lastName}`,
          avatar: a.studentProfile.user.avatar,
          gender: a.studentProfile.user.gender,
          className: a.studentProfile.class?.name || null,
          allocatedAt: a.allocatedAt,
          checkedInAt: a.checkedInAt,
        })),
      );

      return {
        roomId: room.id,
        roomNumber: room.roomNumber,
        floor: room.floor,
        roomType: room.roomType,
        capacity: room.capacity,
        status: room.status,
        isAccessible: room.isAccessible,
        totalBeds: roomTotalBeds,
        occupiedBeds: roomOccupied,
        vacantBeds: roomVacant,
        reservedBeds: roomReserved,
        outOfServiceBeds: roomOutOfService,
        occupancyRate:
          roomTotalBeds > 0
            ? Math.round((roomOccupied / roomTotalBeds) * 100)
            : 0,
        occupants,
      };
    });

    totalBeds += blockTotalBeds;
    occupiedBeds += blockOccupiedBeds;
    vacantBeds += blockVacantBeds;
    reservedBeds += blockReservedBeds;
    outOfServiceBeds += blockOutOfServiceBeds;

    return {
      blockId: block.id,
      name: block.name,
      floorCount: block.floorCount,
      gradeMin: block.gradeMin,
      gradeMax: block.gradeMax,
      roomsCount: block.rooms.length,
      totalBeds: blockTotalBeds,
      occupiedBeds: blockOccupiedBeds,
      vacantBeds: blockVacantBeds,
      reservedBeds: blockReservedBeds,
      outOfServiceBeds: blockOutOfServiceBeds,
      occupancyRate:
        blockTotalBeds > 0
          ? Math.round((blockOccupiedBeds / blockTotalBeds) * 100)
          : 0,
      rooms: roomsSummary,
    };
  });

  const overallOccupancyRate =
    totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  return {
    hostelId: hostel.id,
    name: hostel.name,
    type: hostel.type,
    totalCapacity: hostel.totalCapacity,
    totalBeds,
    occupiedBeds,
    vacantBeds,
    reservedBeds,
    outOfServiceBeds,
    overallOccupancyRate,
    blocks: blocksSummary,
  };
}

// ── 7. PHASE 2: INTAKE & HOSTEL APPLICATIONS ──────────────────────────────────

export async function submitHostelApplication(
  schoolId: string,
  input: SubmitHostelApplicationInput,
  actor: { id: string; email: string; role: string },
) {
  const student = await db.studentProfile.findFirst({
    where: { id: input.studentProfileId, user: { schoolId } },
    include: { user: true },
  });

  if (!student) {
    throw new AppError("Student profile not found", 404);
  }

  const existingActiveAlloc = await db.hostelAllocation.findFirst({
    where: {
      studentProfileId: input.studentProfileId,
      status: AllocationStatus.ACTIVE,
    },
  });
  if (existingActiveAlloc) {
    throw new AppError(
      "Student already has an active hostel allocation. Submit a transfer request instead.",
      400,
    );
  }

  const existingPendingApp = await db.hostelApplication.findFirst({
    where: {
      studentProfileId: input.studentProfileId,
      status: { in: [HostelApplicationStatus.PENDING, HostelApplicationStatus.UNDER_REVIEW] },
    },
  });
  if (existingPendingApp) {
    throw new AppError(
      "An active hostel application is already pending review for this student.",
      400,
    );
  }

  const priorityScore = await calculateApplicationPriorityScore(
    schoolId,
    input.studentProfileId,
    input.medicalNotes,
    input.specialRequests,
  );

  const application = await db.hostelApplication.create({
    data: {
      schoolId,
      hostelId: input.hostelId || null,
      studentProfileId: input.studentProfileId,
      academicTermId: input.academicTermId || null,
      preferredRoomType: input.preferredRoomType || null,
      medicalNotes: input.medicalNotes || null,
      specialRequests: input.specialRequests || null,
      roommatePreference: input.roommatePreference || null,
      guardianConsent: input.guardianConsent ?? false,
      priorityScore,
      status: HostelApplicationStatus.PENDING,
    },
    include: {
      studentProfile: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              gender: true,
            },
          },
        },
      },
      hostel: { select: { id: true, name: true, type: true } },
    },
  });

  await recordAuditEvent({
    schoolId,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "HOSTEL_APPLICATION_SUBMITTED",
    targetType: "HostelApplication",
    targetId: application.id,
    metadata: {
      studentProfileId: input.studentProfileId,
      priorityScore,
      preferredRoomType: input.preferredRoomType,
    },
  });

  return application;
}

export async function getHostelApplications(
  schoolId: string,
  filters?: {
    hostelId?: string;
    status?: HostelApplicationStatus;
    academicTermId?: string;
    studentProfileId?: string;
    search?: string;
  },
) {
  const where: any = { schoolId };

  if (filters?.hostelId) where.hostelId = filters.hostelId;
  if (filters?.status) where.status = filters.status;
  if (filters?.academicTermId) where.academicTermId = filters.academicTermId;
  if (filters?.studentProfileId) where.studentProfileId = filters.studentProfileId;
  if (filters?.search) {
    where.studentProfile = {
      user: {
        OR: [
          { firstName: { contains: filters.search, mode: "insensitive" } },
          { lastName: { contains: filters.search, mode: "insensitive" } },
        ],
      },
    };
  }

  return db.hostelApplication.findMany({
    where,
    include: {
      studentProfile: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              gender: true,
              avatar: true,
            },
          },
          class: { select: { id: true, name: true } },
          gradeLevel: { select: { id: true, name: true } },
        },
      },
      hostel: { select: { id: true, name: true, type: true } },
      reviewedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
    orderBy: [{ priorityScore: "desc" }, { submittedAt: "asc" }],
  });
}

export async function reviewHostelApplication(
  schoolId: string,
  applicationId: string,
  input: ReviewHostelApplicationInput,
  reviewer: { id: string; email: string; role: string },
) {
  const application = await db.hostelApplication.findFirst({
    where: { id: applicationId, schoolId },
    include: { studentProfile: { include: { user: true } } },
  });

  if (!application) {
    throw new AppError("Hostel application not found", 404);
  }

  const updated = await db.hostelApplication.update({
    where: { id: applicationId },
    data: {
      status: input.status,
      reviewNotes: input.reviewNotes !== undefined ? input.reviewNotes : application.reviewNotes,
      hostelId: input.hostelId !== undefined ? input.hostelId : application.hostelId,
      reviewedById: reviewer.id,
      reviewedAt: new Date(),
    },
    include: {
      studentProfile: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
      hostel: { select: { id: true, name: true } },
    },
  });

  try {
    await db.notification.create({
      data: {
        schoolId,
        userId: application.studentProfile.userId,
        type: NotificationType.HOSTEL,
        title: "Hostel Application Status Update",
        body: `Your hostel application status is now ${input.status}. ${input.reviewNotes || ""}`,
        data: { applicationId, status: input.status },
      },
    });
  } catch (err) {
    logger.warn("Failed to create in-app notification:", err);
  }

  await recordAuditEvent({
    schoolId,
    actorId: reviewer.id,
    actorEmail: reviewer.email,
    actorRole: reviewer.role,
    action: "HOSTEL_APPLICATION_REVIEWED",
    targetType: "HostelApplication",
    targetId: applicationId,
    metadata: { newStatus: input.status, notes: input.reviewNotes },
  });

  return updated;
}

// ── 8. PHASE 2: AUTOMATED ALLOCATION ENGINE ───────────────────────────────────

export interface AutoAllocationRunOptions {
  academicTermId?: string;
  defaultBoardingFee?: number;
  matchRoommatePreferences?: boolean;
}

export async function runAutoAllocation(
  schoolId: string,
  hostelId: string,
  options: AutoAllocationRunOptions = {},
  actor: { id: string; email: string; role: string },
) {
  const hostel = await db.hostel.findFirst({
    where: { id: hostelId, schoolId },
    include: {
      blocks: {
        where: { isActive: true },
        include: {
          rooms: {
            where: {
              status: { in: [RoomStatus.AVAILABLE, RoomStatus.FULL] },
            },
            include: {
              beds: {
                where: { status: BedStatus.VACANT },
              },
            },
          },
        },
      },
    },
  });

  if (!hostel) throw new AppError("Hostel not found", 404);

  const applications = await db.hostelApplication.findMany({
    where: {
      schoolId,
      OR: [{ hostelId }, { hostelId: null }],
      status: { in: [HostelApplicationStatus.PENDING, HostelApplicationStatus.UNDER_REVIEW, HostelApplicationStatus.WAITLISTED] },
      ...(options.academicTermId ? { academicTermId: options.academicTermId } : {}),
    },
    include: {
      studentProfile: {
        include: {
          user: true,
          class: true,
          gradeLevel: true,
          hostelAllocations: { where: { status: AllocationStatus.ACTIVE } },
        },
      },
    },
  });

  const eligibleApps = applications.filter(
    (app) => app.studentProfile.hostelAllocations.length === 0,
  );

  const genderMatchedApps = eligibleApps.filter((app) => {
    const studentGender = app.studentProfile.user.gender;
    if (hostel.type === HostelType.BOYS) return studentGender === Gender.MALE;
    if (hostel.type === HostelType.GIRLS) return studentGender === Gender.FEMALE;
    return true;
  });

  genderMatchedApps.sort((a, b) => b.priorityScore - a.priorityScore);

  type RoomWithVacantBeds = {
    roomId: string;
    blockId: string;
    roomNumber: string;
    roomType: HostelRoomType;
    capacity: number;
    isAccessible: boolean;
    occupiedCount: number;
    vacantBeds: { id: string; bedNumber: string }[];
  };

  const availableRooms: RoomWithVacantBeds[] = [];

  for (const block of hostel.blocks) {
    for (const room of block.rooms) {
      if (room.beds.length > 0) {
        availableRooms.push({
          roomId: room.id,
          blockId: block.id,
          roomNumber: room.roomNumber,
          roomType: room.roomType,
          capacity: room.capacity,
          isAccessible: room.isAccessible,
          occupiedCount: room.capacity - room.beds.length,
          vacantBeds: room.beds.map((b) => ({ id: b.id, bedNumber: b.bedNumber })),
        });
      }
    }
  }

  availableRooms.sort((a, b) => b.occupiedCount - a.occupiedCount);

  const successfulAllocations: Array<{
    applicationId: string;
    studentProfileId: string;
    studentName: string;
    bedId: string;
    bedNumber: string;
    roomNumber: string;
  }> = [];

  const waitlistedApplications: string[] = [];

  for (const app of genderMatchedApps) {
    const requiresAccessibility = Boolean(
      app.specialRequests?.toLowerCase().includes("wheelchair") ||
        app.specialRequests?.toLowerCase().includes("ground") ||
        app.specialRequests?.toLowerCase().includes("mobility"),
    );

    let assignedRoom: RoomWithVacantBeds | null = null;
    let assignedBed: { id: string; bedNumber: string } | null = null;

    for (const room of availableRooms) {
      if (requiresAccessibility && !room.isAccessible) continue;
      if (room.vacantBeds.length > 0) {
        assignedRoom = room;
        assignedBed = room.vacantBeds.shift()!;
        room.occupiedCount++;
        break;
      }
    }

    if (assignedRoom && assignedBed) {
      try {
        await db.$transaction(async (tx) => {
          await tx.hostelBed.update({
            where: { id: assignedBed!.id },
            data: { status: BedStatus.OCCUPIED },
          });

          let feeInvoiceId: string | null = null;
          const feeAmount = options.defaultBoardingFee || 15000;

          const invoice = await tx.feeInvoice.create({
            data: {
              schoolId,
              studentProfileId: app.studentProfileId,
              title: `Hostel Accommodation Fee — ${hostel.name}`,
              type: FeeType.BOARDING,
              amount: feeAmount,
              dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              status: FeeStatus.PENDING,
              notes: `Room ${assignedRoom!.roomNumber} Bed ${assignedBed!.bedNumber}`,
            },
          });
          feeInvoiceId = invoice.id;

          await tx.hostelAllocation.create({
            data: {
              applicationId: app.id,
              hostelId,
              bedId: assignedBed!.id,
              studentProfileId: app.studentProfileId,
              academicTermId: app.academicTermId || options.academicTermId || null,
              status: AllocationStatus.ACTIVE,
              allocatedById: actor.id,
              feeInvoiceId,
            },
          });

          await tx.hostelApplication.update({
            where: { id: app.id },
            data: {
              status: HostelApplicationStatus.APPROVED,
              hostelId,
              reviewedById: actor.id,
              reviewedAt: new Date(),
            },
          });

          const remainingBeds = await tx.hostelBed.count({
            where: { roomId: assignedRoom!.roomId, status: BedStatus.VACANT },
          });
          if (remainingBeds === 0) {
            await tx.hostelRoom.update({
              where: { id: assignedRoom!.roomId },
              data: { status: RoomStatus.FULL },
            });
          }
        });

        successfulAllocations.push({
          applicationId: app.id,
          studentProfileId: app.studentProfileId,
          studentName: `${app.studentProfile.user.firstName} ${app.studentProfile.user.lastName}`,
          bedId: assignedBed.id,
          bedNumber: assignedBed.bedNumber,
          roomNumber: assignedRoom.roomNumber,
        });

        await db.notification.create({
          data: {
            schoolId,
            userId: app.studentProfile.userId,
            type: NotificationType.HOSTEL,
            title: "Hostel Allocation Confirmed! 🏠",
            body: `You have been allocated Bed ${assignedBed.bedNumber} in Room ${assignedRoom.roomNumber} at ${hostel.name}.`,
            data: { hostelId, roomNumber: assignedRoom.roomNumber },
          },
        }).catch((err) => logger.warn("Failed to create notification:", err));
      } catch (err) {
        logger.error(`Error allocating bed to application ${app.id}:`, err);
      }
    } else {
      await db.hostelApplication.update({
        where: { id: app.id },
        data: { status: HostelApplicationStatus.WAITLISTED },
      });
      waitlistedApplications.push(app.id);

      await db.notification.create({
        data: {
          schoolId,
          userId: app.studentProfile.userId,
          type: NotificationType.HOSTEL,
          title: "Hostel Application Waitlisted",
          body: `Hostel capacity is currently full. Your application has been waitlisted with priority score ${app.priorityScore}.`,
          data: { applicationId: app.id },
        },
      }).catch((err) => logger.warn("Failed to create notification:", err));
    }
  }

  await recordAuditEvent({
    schoolId,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "HOSTEL_AUTO_ALLOCATION_RUN",
    targetType: "Hostel",
    targetId: hostelId,
    metadata: {
      allocatedCount: successfulAllocations.length,
      waitlistedCount: waitlistedApplications.length,
    },
  });

  return {
    hostelId,
    allocatedCount: successfulAllocations.length,
    waitlistedCount: waitlistedApplications.length,
    allocations: successfulAllocations,
  };
}

// ── 9. PHASE 2: MANUAL ALLOCATION & RESIDENT LIFECYCLE ────────────────────────

export async function manualAllocate(
  schoolId: string,
  input: ManualAllocationInput,
  actor: { id: string; email: string; role: string },
) {
  const hostel = await db.hostel.findFirst({
    where: { id: input.hostelId, schoolId },
  });
  if (!hostel) throw new AppError("Hostel not found", 404);

  const student = await db.studentProfile.findFirst({
    where: { id: input.studentProfileId, user: { schoolId } },
    include: {
      user: true,
      hostelAllocations: { where: { status: AllocationStatus.ACTIVE } },
    },
  });
  if (!student) throw new AppError("Student profile not found", 404);

  if (student.hostelAllocations.length > 0) {
    throw new AppError(
      "Student already has an active hostel allocation. Must check out or transfer.",
      400,
    );
  }

  if (
    !input.forceGenderOverride &&
    ((hostel.type === HostelType.BOYS && student.user.gender !== Gender.MALE) ||
      (hostel.type === HostelType.GIRLS && student.user.gender !== Gender.FEMALE))
  ) {
    throw new AppError(
      `Cannot allocate student of gender ${student.user.gender} to a ${hostel.type} hostel.`,
      400,
    );
  }

  const bed = await db.hostelBed.findFirst({
    where: { id: input.bedId, room: { block: { hostelId: input.hostelId } } },
    include: { room: true },
  });
  if (!bed) throw new AppError("Hostel bed not found in this hostel", 404);

  if (bed.status !== BedStatus.VACANT) {
    throw new AppError(`Bed "${bed.bedNumber}" is currently ${bed.status}`, 400);
  }

  let createdAllocation: any = null;

  await db.$transaction(async (tx) => {
    await tx.hostelBed.update({
      where: { id: bed.id },
      data: { status: BedStatus.OCCUPIED },
    });

    const invoice = await tx.feeInvoice.create({
      data: {
        schoolId,
        studentProfileId: input.studentProfileId,
        title: `Hostel Accommodation Fee — ${hostel.name}`,
        type: FeeType.BOARDING,
        amount: input.boardingFeeAmount || 15000,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: FeeStatus.PENDING,
        notes: `Manual allocation: Room ${bed.room.roomNumber} Bed ${bed.bedNumber}`,
      },
    });

    createdAllocation = await tx.hostelAllocation.create({
      data: {
        applicationId: input.applicationId || null,
        hostelId: input.hostelId,
        bedId: input.bedId,
        studentProfileId: input.studentProfileId,
        academicTermId: input.academicTermId || null,
        status: AllocationStatus.ACTIVE,
        allocatedById: actor.id,
        feeInvoiceId: invoice.id,
      },
      include: {
        bed: { include: { room: true } },
        studentProfile: { include: { user: true } },
      },
    });

    if (input.applicationId) {
      await tx.hostelApplication.update({
        where: { id: input.applicationId },
        data: {
          status: HostelApplicationStatus.APPROVED,
          reviewedById: actor.id,
          reviewedAt: new Date(),
        },
      });
    }

    const remaining = await tx.hostelBed.count({
      where: { roomId: bed.roomId, status: BedStatus.VACANT },
    });
    if (remaining === 0) {
      await tx.hostelRoom.update({
        where: { id: bed.roomId },
        data: { status: RoomStatus.FULL },
      });
    }
  });

  await recordAuditEvent({
    schoolId,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "HOSTEL_MANUAL_ALLOCATION",
    targetType: "HostelAllocation",
    targetId: createdAllocation.id,
    metadata: {
      studentProfileId: input.studentProfileId,
      hostelId: input.hostelId,
      bedId: input.bedId,
    },
  });

  return createdAllocation;
}

export async function checkInResident(
  schoolId: string,
  allocationId: string,
  actor: { id: string; email: string; role: string },
) {
  const allocation = await db.hostelAllocation.findFirst({
    where: { id: allocationId, hostel: { schoolId } },
  });
  if (!allocation) throw new AppError("Hostel allocation not found", 404);

  const updated = await db.hostelAllocation.update({
    where: { id: allocationId },
    data: { checkedInAt: new Date() },
    include: {
      studentProfile: { include: { user: true } },
      bed: { include: { room: true } },
    },
  });

  await recordAuditEvent({
    schoolId,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "HOSTEL_RESIDENT_CHECKED_IN",
    targetType: "HostelAllocation",
    targetId: allocationId,
    metadata: { studentProfileId: allocation.studentProfileId },
  });

  return updated;
}

export async function checkOutResident(
  schoolId: string,
  allocationId: string,
  vacateReason: string | undefined,
  actor: { id: string; email: string; role: string },
) {
  const allocation = await db.hostelAllocation.findFirst({
    where: { id: allocationId, hostel: { schoolId } },
    include: { bed: true },
  });
  if (!allocation) throw new AppError("Hostel allocation not found", 404);

  if (allocation.status !== AllocationStatus.ACTIVE) {
    throw new AppError("Allocation is not in ACTIVE state", 400);
  }

  await db.$transaction(async (tx) => {
    await tx.hostelAllocation.update({
      where: { id: allocationId },
      data: {
        status: AllocationStatus.CHECKED_OUT,
        checkedOutAt: new Date(),
        vacateReason: vacateReason || "Voluntary Checkout",
      },
    });

    await tx.hostelBed.update({
      where: { id: allocation.bedId },
      data: { status: BedStatus.VACANT },
    });

    await tx.hostelRoom.update({
      where: { id: allocation.bed.roomId },
      data: { status: RoomStatus.AVAILABLE },
    });
  });

  await recalculateRoomStatus(allocation.bed.roomId);

  await recordAuditEvent({
    schoolId,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "HOSTEL_RESIDENT_CHECKED_OUT",
    targetType: "HostelAllocation",
    targetId: allocationId,
    metadata: { reason: vacateReason },
  });

  return { success: true };
}

export async function getStudentAllocationHistory(
  schoolId: string,
  studentProfileId: string,
) {
  return db.hostelAllocation.findMany({
    where: { studentProfileId, hostel: { schoolId } },
    include: {
      hostel: { select: { id: true, name: true, type: true } },
      bed: {
        include: {
          room: {
            include: {
              block: { select: { id: true, name: true } },
            },
          },
        },
      },
      feeInvoice: { select: { id: true, amount: true, paidAmount: true, status: true } },
    },
    orderBy: { allocatedAt: "desc" },
  });
}

// ── 10. PHASE 3: DAILY OPERATIONS (NIGHT ATTENDANCE) ──────────────────────────

export async function recordNightAttendance(
  schoolId: string,
  hostelId: string,
  dateStr: string,
  records: NightAttendanceItem[],
  actor: { id: string; email: string; role: string },
) {
  const hostel = await db.hostel.findFirst({
    where: { id: hostelId, schoolId },
  });
  if (!hostel) throw new AppError("Hostel not found", 404);

  const parsedDate = new Date(dateStr);

  const results: any[] = [];

  for (const item of records) {
    const attendance = await db.hostelNightAttendance.upsert({
      where: {
        allocationId_date: {
          allocationId: item.allocationId,
          date: parsedDate,
        },
      },
      update: {
        status: item.status,
        remarks: item.remarks || null,
        markedById: actor.id,
        markedAt: new Date(),
      },
      create: {
        allocationId: item.allocationId,
        date: parsedDate,
        status: item.status,
        remarks: item.remarks || null,
        markedById: actor.id,
      },
    });
    results.push(attendance);
  }

  await recordAuditEvent({
    schoolId,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "HOSTEL_NIGHT_ATTENDANCE_RECORDED",
    targetType: "Hostel",
    targetId: hostelId,
    metadata: { date: dateStr, count: records.length },
  });

  return results;
}

export async function getHostelNightAttendance(
  schoolId: string,
  hostelId: string,
  dateStr: string,
) {
  const parsedDate = new Date(dateStr);

  const allocations = await db.hostelAllocation.findMany({
    where: {
      hostelId,
      hostel: { schoolId },
      status: AllocationStatus.ACTIVE,
    },
    include: {
      studentProfile: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
          class: { select: { id: true, name: true } },
        },
      },
      bed: {
        include: {
          room: { select: { id: true, roomNumber: true, block: { select: { id: true, name: true } } } },
        },
      },
      nightAttendance: {
        where: { date: parsedDate },
      },
      outpasses: {
        where: {
          status: { in: [OutpassStatus.APPROVED, OutpassStatus.OUT] },
          fromDateTime: { lte: parsedDate },
          expectedReturnAt: { gte: parsedDate },
        },
      },
    },
  });

  return allocations.map((alloc) => {
    const currentAttendance = alloc.nightAttendance[0] || null;
    const activeOutpass = alloc.outpasses[0] || null;

    let defaultStatus: NightAttendanceStatus = NightAttendanceStatus.PRESENT;
    if (activeOutpass) {
      defaultStatus = NightAttendanceStatus.ON_OUTPASS;
    }

    return {
      allocationId: alloc.id,
      studentId: alloc.studentProfile.id,
      studentName: `${alloc.studentProfile.user.firstName} ${alloc.studentProfile.user.lastName}`,
      avatar: alloc.studentProfile.user.avatar,
      className: alloc.studentProfile.class?.name || null,
      blockName: alloc.bed.room.block.name,
      roomNumber: alloc.bed.room.roomNumber,
      bedNumber: alloc.bed.bedNumber,
      status: currentAttendance?.status || defaultStatus,
      remarks: currentAttendance?.remarks || null,
      activeOutpass: activeOutpass
        ? {
            id: activeOutpass.id,
            type: activeOutpass.type,
            destination: activeOutpass.destination,
            expectedReturnAt: activeOutpass.expectedReturnAt,
          }
        : null,
    };
  });
}

// ── 11. PHASE 3: OUTPASS WORKFLOW & OVERDUE CHECK ─────────────────────────────

export async function createOutpass(
  schoolId: string,
  input: CreateOutpassInput,
  actor: { id: string; email: string; role: string },
) {
  const allocation = await db.hostelAllocation.findFirst({
    where: { id: input.allocationId, hostel: { schoolId }, status: AllocationStatus.ACTIVE },
    include: { studentProfile: { include: { user: true } } },
  });

  if (!allocation) throw new AppError("Active hostel allocation not found", 404);

  const fromDate = new Date(input.fromDateTime);
  const returnDate = new Date(input.expectedReturnAt);

  if (returnDate <= fromDate) {
    throw new AppError("Expected return datetime must be after start datetime", 400);
  }

  const outpass = await db.hostelOutpass.create({
    data: {
      allocationId: input.allocationId,
      type: input.type,
      fromDateTime: fromDate,
      expectedReturnAt: returnDate,
      destination: input.destination,
      contactAtDestination: input.contactAtDestination || null,
      reason: input.reason,
      status: OutpassStatus.PENDING,
    },
    include: {
      allocation: {
        include: {
          studentProfile: { include: { user: true } },
          bed: { include: { room: true } },
        },
      },
    },
  });

  await recordAuditEvent({
    schoolId,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "HOSTEL_OUTPASS_REQUESTED",
    targetType: "HostelOutpass",
    targetId: outpass.id,
    metadata: {
      allocationId: input.allocationId,
      destination: input.destination,
      type: input.type,
    },
  });

  return outpass;
}

export async function getOutpasses(
  schoolId: string,
  filters?: {
    hostelId?: string;
    status?: OutpassStatus;
    studentProfileId?: string;
    type?: OutpassType;
  },
) {
  const where: any = {
    allocation: { hostel: { schoolId } },
  };

  if (filters?.hostelId) where.allocation.hostelId = filters.hostelId;
  if (filters?.status) where.status = filters.status;
  if (filters?.studentProfileId) where.allocation.studentProfileId = filters.studentProfileId;
  if (filters?.type) where.type = filters.type;

  return db.hostelOutpass.findMany({
    where,
    include: {
      allocation: {
        include: {
          studentProfile: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
              class: { select: { id: true, name: true } },
            },
          },
          bed: {
            include: {
              room: { select: { roomNumber: true, block: { select: { name: true } } } },
            },
          },
        },
      },
      approvedBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function decideOutpass(
  schoolId: string,
  outpassId: string,
  status: "APPROVED" | "REJECTED",
  actor: { id: string; email: string; role: string },
) {
  const outpass = await db.hostelOutpass.findFirst({
    where: { id: outpassId, allocation: { hostel: { schoolId } } },
    include: { allocation: { include: { studentProfile: true } } },
  });

  if (!outpass) throw new AppError("Outpass not found", 404);

  const updated = await db.hostelOutpass.update({
    where: { id: outpassId },
    data: {
      status,
      approvedById: actor.id,
    },
    include: {
      allocation: {
        include: {
          studentProfile: { include: { user: true } },
        },
      },
    },
  });

  // Notify student
  await db.notification.create({
    data: {
      schoolId,
      userId: outpass.allocation.studentProfile.userId,
      type: NotificationType.HOSTEL,
      title: `Outpass Request ${status}`,
      body: `Your outpass to ${outpass.destination} has been ${status.toLowerCase()}.`,
      data: { outpassId, status },
    },
  }).catch((err) => logger.warn("Failed to create outpass notification:", err));

  await recordAuditEvent({
    schoolId,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: `HOSTEL_OUTPASS_${status}`,
    targetType: "HostelOutpass",
    targetId: outpassId,
    metadata: { status },
  });

  return updated;
}

export async function scanGateOut(
  schoolId: string,
  outpassId: string,
  actor: { id: string; email: string; role: string },
) {
  const outpass = await db.hostelOutpass.findFirst({
    where: { id: outpassId, allocation: { hostel: { schoolId } } },
  });

  if (!outpass) throw new AppError("Outpass not found", 404);
  if (outpass.status !== OutpassStatus.APPROVED) {
    throw new AppError(`Cannot gate-out: outpass is currently ${outpass.status}`, 400);
  }

  const updated = await db.hostelOutpass.update({
    where: { id: outpassId },
    data: {
      status: OutpassStatus.OUT,
      gateOutAt: new Date(),
    },
  });

  await recordAuditEvent({
    schoolId,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "HOSTEL_OUTPASS_GATE_OUT",
    targetType: "HostelOutpass",
    targetId: outpassId,
  });

  return updated;
}

export async function scanGateIn(
  schoolId: string,
  outpassId: string,
  actor: { id: string; email: string; role: string },
) {
  const outpass = await db.hostelOutpass.findFirst({
    where: { id: outpassId, allocation: { hostel: { schoolId } } },
  });

  if (!outpass) throw new AppError("Outpass not found", 404);
  if (outpass.status !== OutpassStatus.OUT && outpass.status !== OutpassStatus.OVERDUE) {
    throw new AppError(`Cannot gate-in: outpass is currently ${outpass.status}`, 400);
  }

  const updated = await db.hostelOutpass.update({
    where: { id: outpassId },
    data: {
      status: OutpassStatus.RETURNED,
      gateInAt: new Date(),
      actualReturnAt: new Date(),
    },
  });

  await recordAuditEvent({
    schoolId,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "HOSTEL_OUTPASS_GATE_IN",
    targetType: "HostelOutpass",
    targetId: outpassId,
  });

  return updated;
}

export async function checkOverdueOutpasses(schoolId?: string) {
  const where: any = {
    status: OutpassStatus.OUT,
    expectedReturnAt: { lt: new Date() },
  };
  if (schoolId) {
    where.allocation = { hostel: { schoolId } };
  }

  const overdueList = await db.hostelOutpass.findMany({
    where,
    include: {
      allocation: {
        include: {
          studentProfile: { include: { user: true } },
          hostel: true,
        },
      },
    },
  });

  for (const outpass of overdueList) {
    await db.hostelOutpass.update({
      where: { id: outpass.id },
      data: { status: OutpassStatus.OVERDUE },
    });

    // Alert student & warden
    await db.notification.create({
      data: {
        schoolId: outpass.allocation.hostel.schoolId,
        userId: outpass.allocation.studentProfile.userId,
        type: NotificationType.HOSTEL,
        title: "⚠️ Outpass Overdue Alert",
        body: `Your expected return time (${outpass.expectedReturnAt.toLocaleTimeString()}) has passed. Please return and check in immediately.`,
        data: { outpassId: outpass.id, status: OutpassStatus.OVERDUE },
      },
    }).catch((err) => logger.warn("Failed to create overdue notification:", err));
  }

  return { overdueCount: overdueList.length };
}

// ── 12. PHASE 3: VISITOR LOGS ──────────────────────────────────────────────────

export async function logVisitorCheckIn(
  schoolId: string,
  input: CreateVisitorLogInput,
  actor: { id: string; email: string; role: string },
) {
  const student = await db.studentProfile.findFirst({
    where: { id: input.studentProfileId, user: { schoolId } },
  });
  if (!student) throw new AppError("Student profile not found", 404);

  const log = await db.hostelVisitorLog.create({
    data: {
      studentProfileId: input.studentProfileId,
      visitorName: input.visitorName,
      relationToStudent: input.relationToStudent,
      idProofType: input.idProofType || null,
      idProofNumber: input.idProofNumber || null,
      purpose: input.purpose || null,
      checkInAt: new Date(),
      loggedById: actor.id,
    },
    include: {
      studentProfile: {
        include: {
          user: { select: { firstName: true, lastName: true } },
          class: { select: { name: true } },
        },
      },
      loggedBy: { select: { firstName: true, lastName: true } },
    },
  });

  await recordAuditEvent({
    schoolId,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "HOSTEL_VISITOR_CHECK_IN",
    targetType: "HostelVisitorLog",
    targetId: log.id,
    metadata: { visitorName: input.visitorName, studentId: input.studentProfileId },
  });

  return log;
}

export async function getVisitorLogs(
  schoolId: string,
  filters?: {
    studentProfileId?: string;
    openOnly?: boolean;
  },
) {
  const where: any = {
    studentProfile: { user: { schoolId } },
  };

  if (filters?.studentProfileId) where.studentProfileId = filters.studentProfileId;
  if (filters?.openOnly) where.checkOutAt = null;

  return db.hostelVisitorLog.findMany({
    where,
    include: {
      studentProfile: {
        include: {
          user: { select: { firstName: true, lastName: true, avatar: true } },
          class: { select: { name: true } },
        },
      },
      loggedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { checkInAt: "desc" },
  });
}

export async function logVisitorCheckOut(
  schoolId: string,
  visitorLogId: string,
  actor: { id: string; email: string; role: string },
) {
  const log = await db.hostelVisitorLog.findFirst({
    where: { id: visitorLogId, studentProfile: { user: { schoolId } } },
  });
  if (!log) throw new AppError("Visitor log not found", 404);

  const updated = await db.hostelVisitorLog.update({
    where: { id: visitorLogId },
    data: { checkOutAt: new Date() },
  });

  await recordAuditEvent({
    schoolId,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "HOSTEL_VISITOR_CHECK_OUT",
    targetType: "HostelVisitorLog",
    targetId: visitorLogId,
  });

  return updated;
}

// ── 13. PHASE 4: CARE & MAINTENANCE TICKETS ───────────────────────────────────

export async function createMaintenanceTicket(
  schoolId: string,
  input: CreateMaintenanceTicketInput,
  actor: { id: string; email: string; role: string },
) {
  const room = await db.hostelRoom.findFirst({
    where: { id: input.roomId, block: { hostel: { schoolId } } },
  });
  if (!room) throw new AppError("Hostel room not found", 404);

  const ticket = await db.hostelMaintenanceTicket.create({
    data: {
      roomId: input.roomId,
      category: input.category,
      priority: input.priority || MaintenancePriority.MEDIUM,
      status: MaintenanceStatus.OPEN,
      description: input.description,
      reportedById: actor.id,
      assignedToId: input.assignedToId || null,
    },
    include: {
      room: { select: { roomNumber: true, block: { select: { name: true } } } },
      reportedBy: { select: { firstName: true, lastName: true } },
    },
  });

  if (ticket.priority === MaintenancePriority.URGENT) {
    await db.hostelRoom.update({
      where: { id: input.roomId },
      data: { status: RoomStatus.MAINTENANCE },
    });
  }

  await recordAuditEvent({
    schoolId,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "HOSTEL_MAINTENANCE_TICKET_CREATED",
    targetType: "HostelMaintenanceTicket",
    targetId: ticket.id,
    metadata: { roomId: input.roomId, category: input.category, priority: ticket.priority },
  });

  return ticket;
}

export async function getMaintenanceTickets(
  schoolId: string,
  filters?: {
    roomId?: string;
    category?: MaintenanceCategory;
    status?: MaintenanceStatus;
    priority?: MaintenancePriority;
  },
) {
  const where: any = {
    room: { block: { hostel: { schoolId } } },
  };

  if (filters?.roomId) where.roomId = filters.roomId;
  if (filters?.category) where.category = filters.category;
  if (filters?.status) where.status = filters.status;
  if (filters?.priority) where.priority = filters.priority;

  return db.hostelMaintenanceTicket.findMany({
    where,
    include: {
      room: {
        select: {
          id: true,
          roomNumber: true,
          block: { select: { id: true, name: true, hostel: { select: { name: true } } } },
        },
      },
      reportedBy: { select: { id: true, firstName: true, lastName: true } },
      assignedTo: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ priority: "desc" }, { reportedAt: "desc" }],
  });
}

export async function updateMaintenanceTicket(
  schoolId: string,
  ticketId: string,
  input: UpdateMaintenanceTicketInput,
  actor: { id: string; email: string; role: string },
) {
  const ticket = await db.hostelMaintenanceTicket.findFirst({
    where: { id: ticketId, room: { block: { hostel: { schoolId } } } },
  });
  if (!ticket) throw new AppError("Maintenance ticket not found", 404);

  const updated = await db.hostelMaintenanceTicket.update({
    where: { id: ticketId },
    data: {
      ...(input.category !== undefined && { category: input.category }),
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.status !== undefined && {
        status: input.status,
        ...(input.status === MaintenanceStatus.RESOLVED || input.status === MaintenanceStatus.CLOSED
          ? { resolvedAt: new Date() }
          : {}),
      }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.assignedToId !== undefined && { assignedToId: input.assignedToId }),
      ...(input.cost !== undefined && { cost: input.cost }),
    },
  });

  // Recompute room status if ticket was resolved
  if (input.status === MaintenanceStatus.RESOLVED || input.status === MaintenanceStatus.CLOSED) {
    await recalculateRoomStatus(ticket.roomId);
  }

  await recordAuditEvent({
    schoolId,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "HOSTEL_MAINTENANCE_TICKET_UPDATED",
    targetType: "HostelMaintenanceTicket",
    targetId: ticketId,
    metadata: { changes: input },
  });

  return updated;
}

// ── 14. PHASE 4: RESIDENTIAL INCIDENT REPORTS ─────────────────────────────────

export async function createIncidentReport(
  schoolId: string,
  input: CreateIncidentReportInput,
  actor: { id: string; email: string; role: string },
) {
  const allocation = await db.hostelAllocation.findFirst({
    where: { id: input.allocationId, hostel: { schoolId } },
    include: { studentProfile: { include: { user: true } }, hostel: true },
  });
  if (!allocation) throw new AppError("Hostel allocation not found", 404);

  const incident = await db.hostelIncidentReport.create({
    data: {
      allocationId: input.allocationId,
      severity: input.severity,
      description: input.description,
      actionTaken: input.actionTaken || null,
      reportedById: actor.id,
      linkedBehaviourId: input.linkedBehaviourId || null,
    },
    include: {
      allocation: {
        include: {
          studentProfile: { include: { user: true } },
          bed: { include: { room: true } },
        },
      },
      reportedBy: { select: { firstName: true, lastName: true } },
    },
  });

  // If severe or critical, notify school admins / parent
  if (incident.severity === IncidentSeverity.SEVERE || incident.severity === IncidentSeverity.CRITICAL) {
    await db.notification.create({
      data: {
        schoolId,
        userId: allocation.studentProfile.userId,
        type: NotificationType.HOSTEL,
        title: "Residential Incident Logged",
        body: `A residential incident with severity ${incident.severity} has been recorded.`,
        data: { incidentId: incident.id, severity: incident.severity },
      },
    }).catch((err) => logger.warn("Failed to create incident notification:", err));
  }

  await recordAuditEvent({
    schoolId,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "HOSTEL_INCIDENT_REPORTED",
    targetType: "HostelIncidentReport",
    targetId: incident.id,
    metadata: { severity: incident.severity, allocationId: input.allocationId },
  });

  return incident;
}

export async function getIncidentReports(
  schoolId: string,
  filters?: {
    hostelId?: string;
    severity?: IncidentSeverity;
    studentProfileId?: string;
  },
) {
  const where: any = {
    allocation: { hostel: { schoolId } },
  };

  if (filters?.hostelId) where.allocation.hostelId = filters.hostelId;
  if (filters?.severity) where.severity = filters.severity;
  if (filters?.studentProfileId) where.allocation.studentProfileId = filters.studentProfileId;

  return db.hostelIncidentReport.findMany({
    where,
    include: {
      allocation: {
        include: {
          studentProfile: {
            include: {
              user: { select: { firstName: true, lastName: true, avatar: true } },
              class: { select: { name: true } },
            },
          },
          bed: {
            include: {
              room: { select: { roomNumber: true, block: { select: { name: true } } } },
            },
          },
        },
      },
      reportedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { occurredAt: "desc" },
  });
}

// ── 15. PHASE 4: ROOM TRANSFERS ────────────────────────────────────────────────

export async function createTransferRequest(
  schoolId: string,
  input: CreateTransferRequestInput,
  actor: { id: string; email: string; role: string },
) {
  const allocation = await db.hostelAllocation.findFirst({
    where: { id: input.fromAllocationId, hostel: { schoolId }, status: AllocationStatus.ACTIVE },
    include: { studentProfile: true },
  });

  if (!allocation) throw new AppError("Active hostel allocation not found", 404);

  const request = await db.hostelTransferRequest.create({
    data: {
      studentProfileId: allocation.studentProfileId,
      fromAllocationId: input.fromAllocationId,
      toBedId: input.toBedId || null,
      reason: input.reason,
      status: TransferRequestStatus.PENDING,
    },
    include: {
      studentProfile: {
        include: { user: { select: { firstName: true, lastName: true } } },
      },
      fromAllocation: {
        include: {
          bed: { include: { room: true } },
          hostel: true,
        },
      },
    },
  });

  await recordAuditEvent({
    schoolId,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "HOSTEL_TRANSFER_REQUESTED",
    targetType: "HostelTransferRequest",
    targetId: request.id,
    metadata: { reason: input.reason, toBedId: input.toBedId },
  });

  return request;
}

export async function getTransferRequests(
  schoolId: string,
  filters?: {
    status?: TransferRequestStatus;
    studentProfileId?: string;
  },
) {
  const where: any = {
    studentProfile: { user: { schoolId } },
  };

  if (filters?.status) where.status = filters.status;
  if (filters?.studentProfileId) where.studentProfileId = filters.studentProfileId;

  return db.hostelTransferRequest.findMany({
    where,
    include: {
      studentProfile: {
        include: {
          user: { select: { firstName: true, lastName: true, avatar: true } },
          class: { select: { name: true } },
        },
      },
      fromAllocation: {
        include: {
          bed: { include: { room: { select: { roomNumber: true, block: { select: { name: true } } } } } },
          hostel: { select: { id: true, name: true } },
        },
      },
      decidedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { requestedAt: "desc" },
  });
}

export async function decideTransferRequest(
  schoolId: string,
  requestId: string,
  input: {
    status: "APPROVED" | "REJECTED";
    toBedId?: string | null;
    decisionNotes?: string | null;
  },
  actor: { id: string; email: string; role: string },
) {
  const request = await db.hostelTransferRequest.findFirst({
    where: { id: requestId, studentProfile: { user: { schoolId } } },
    include: {
      fromAllocation: { include: { bed: true, hostel: true } },
      studentProfile: { include: { user: true } },
    },
  });

  if (!request) throw new AppError("Transfer request not found", 404);
  if (request.status !== TransferRequestStatus.PENDING) {
    throw new AppError("Transfer request has already been decided", 400);
  }

  if (input.status === TransferRequestStatus.REJECTED) {
    const updated = await db.hostelTransferRequest.update({
      where: { id: requestId },
      data: {
        status: TransferRequestStatus.REJECTED,
        decisionNotes: input.decisionNotes || null,
        decidedById: actor.id,
        decidedAt: new Date(),
      },
    });

    await recordAuditEvent({
      schoolId,
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: "HOSTEL_TRANSFER_REJECTED",
      targetType: "HostelTransferRequest",
      targetId: requestId,
    });

    return updated;
  }

  // If approved, execute the atomic bed transfer
  const targetBedId = input.toBedId || request.toBedId;
  if (!targetBedId) {
    throw new AppError("A target bed (toBedId) must be specified to approve the transfer", 400);
  }

  const targetBed = await db.hostelBed.findFirst({
    where: { id: targetBedId, room: { block: { hostel: { schoolId } } } },
    include: { room: { include: { block: true } } },
  });

  if (!targetBed) throw new AppError("Target bed not found", 404);
  if (targetBed.status !== BedStatus.VACANT) {
    throw new AppError(`Target bed "${targetBed.bedNumber}" is currently ${targetBed.status}`, 400);
  }

  const oldBed = request.fromAllocation.bed;
  const hostelId = request.fromAllocation.hostelId;

  await db.$transaction(async (tx) => {
    // 1. Mark old allocation TRANSFERRED and old bed VACANT
    await tx.hostelAllocation.update({
      where: { id: request.fromAllocationId },
      data: {
        status: AllocationStatus.TRANSFERRED,
        checkedOutAt: new Date(),
        vacateReason: `Transferred to Room ${targetBed.room.roomNumber} Bed ${targetBed.bedNumber}`,
      },
    });

    await tx.hostelBed.update({
      where: { id: oldBed.id },
      data: { status: BedStatus.VACANT },
    });

    // 2. Mark new bed OCCUPIED and create new ACTIVE allocation
    await tx.hostelBed.update({
      where: { id: targetBed.id },
      data: { status: BedStatus.OCCUPIED },
    });

    await tx.hostelAllocation.create({
      data: {
        hostelId,
        bedId: targetBed.id,
        studentProfileId: request.studentProfileId,
        academicTermId: request.fromAllocation.academicTermId,
        status: AllocationStatus.ACTIVE,
        allocatedById: actor.id,
      },
    });

    // 3. Mark TransferRequest COMPLETED
    await tx.hostelTransferRequest.update({
      where: { id: requestId },
      data: {
        status: TransferRequestStatus.COMPLETED,
        toBedId: targetBed.id,
        decisionNotes: input.decisionNotes || "Transfer executed successfully",
        decidedById: actor.id,
        decidedAt: new Date(),
      },
    });
  });

  await recalculateRoomStatus(oldBed.roomId);
  await recalculateRoomStatus(targetBed.roomId);

  // In-app notification
  await db.notification.create({
    data: {
      schoolId,
      userId: request.studentProfile.userId,
      type: NotificationType.HOSTEL,
      title: "Hostel Room Transfer Approved! 🚚",
      body: `Your transfer to Room ${targetBed.room.roomNumber} Bed ${targetBed.bedNumber} is approved and active.`,
      data: { requestId },
    },
  }).catch((err) => logger.warn("Failed to create transfer notification:", err));

  await recordAuditEvent({
    schoolId,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "HOSTEL_TRANSFER_COMPLETED",
    targetType: "HostelTransferRequest",
    targetId: requestId,
    metadata: {
      fromBedId: oldBed.id,
      toBedId: targetBed.id,
      studentProfileId: request.studentProfileId,
    },
  });

  return { success: true, newBedNumber: targetBed.bedNumber, newRoomNumber: targetBed.room.roomNumber };
}
