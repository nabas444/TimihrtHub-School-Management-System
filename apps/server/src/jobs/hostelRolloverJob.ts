import { db } from "../config/database";
import { AllocationStatus, BedStatus, RoomStatus, HostelApplicationStatus, StudentStatus } from "@prisma/client";
import { logger } from "../utils/logger";
import { recordAuditEvent } from "../utils/auditLog";

/**
 * Hostel Term / Academic Year Rollover Job
 * - Expires active allocations for graduated or withdrawn students and frees their beds.
 * - For continuing active residents, creates pre-filled renewal applications for the new term.
 */
export async function runHostelTermRollover(params: {
  schoolId: string;
  newAcademicTermId?: string;
  actorId?: string;
}) {
  const { schoolId, newAcademicTermId, actorId } = params;
  logger.info(`Starting hostel rollover for school ${schoolId}...`);

  // 1. Fetch active allocations in this school
  const activeAllocations = await db.hostelAllocation.findMany({
    where: {
      hostel: { schoolId },
      status: AllocationStatus.ACTIVE,
    },
    include: {
      studentProfile: {
        select: {
          id: true,
          status: true,
          userId: true,
          graduatedAt: true,
        },
      },
      bed: {
        select: {
          id: true,
          roomId: true,
        },
      },
    },
  });

  let expiredCount = 0;
  let renewedAppCount = 0;

  for (const alloc of activeAllocations) {
    const isDeparting =
      alloc.studentProfile.status === StudentStatus.INACTIVE ||
      alloc.studentProfile.status === StudentStatus.ARCHIVE ||
      Boolean(alloc.studentProfile.graduatedAt);

    if (isDeparting) {
      // Free bed and expire allocation
      await db.$transaction(async (tx) => {
        await tx.hostelAllocation.update({
          where: { id: alloc.id },
          data: {
            status: AllocationStatus.EXPIRED,
            checkedOutAt: new Date(),
            vacateReason: `Academic Status Rollover (${alloc.studentProfile.status})`,
          },
        });

        await tx.hostelBed.update({
          where: { id: alloc.bed.id },
          data: { status: BedStatus.VACANT },
        });

        await tx.hostelRoom.update({
          where: { id: alloc.bed.roomId },
          data: { status: RoomStatus.AVAILABLE },
        });
      });
      expiredCount++;
    } else {
      // Continuing resident: optionally generate renewal application for next term
      if (newAcademicTermId) {
        const existingApp = await db.hostelApplication.findFirst({
          where: {
            studentProfileId: alloc.studentProfile.id,
            academicTermId: newAcademicTermId,
          },
        });

        if (!existingApp) {
          await db.hostelApplication.create({
            data: {
              schoolId,
              studentProfileId: alloc.studentProfile.id,
              hostelId: alloc.hostelId,
              academicTermId: newAcademicTermId,
              priorityScore: 35, // Base returning resident priority
              status: HostelApplicationStatus.PENDING,
            },
          });
          renewedAppCount++;
        }
      }
    }
  }

  await recordAuditEvent({
    schoolId,
    actorId: actorId || "system",
    actorEmail: "system@timhirthub.edu.et",
    actorRole: "SYSTEM",
    action: "HOSTEL_ROLLOVER_EXECUTED",
    targetType: "Hostel",
    metadata: { expiredCount, renewedAppCount, newAcademicTermId },
  });

  logger.info(
    `Hostel rollover completed for school ${schoolId}: ${expiredCount} expired, ${renewedAppCount} renewal applications generated.`,
  );

  return { expiredCount, renewedAppCount };
}
