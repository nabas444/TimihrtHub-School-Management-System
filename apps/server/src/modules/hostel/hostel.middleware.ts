import { Request, Response, NextFunction } from "express";
import { Role, HostelStaffRole } from "@prisma/client";
import { sendForbidden, sendNotFound } from "../../utils/response";
import { db } from "../../config/database";

/**
 * Middleware to restrict non-SUPER_ADMIN users to hostels/blocks they are
 * actively assigned to via HostelStaffAssignment.
 */
export function hostelScope(allowedStaffRoles?: HostelStaffRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        sendForbidden(res, "Authentication required");
        return;
      }

      // SUPER_ADMIN has global authority across all hostels
      if (user.role === Role.SUPER_ADMIN) {
        return next();
      }

      // Must be at least ADMIN or TEACHER to access staff-scoped routes
      if (user.role !== Role.ADMIN && user.role !== Role.TEACHER) {
        sendForbidden(res, "Hostel staff access restricted to administrative staff");
        return;
      }

      const schoolId = user.schoolId;

      // Extract hostelId / blockId / roomId / bedId from params or body
      let targetHostelId: string | null =
        req.params.hostelId ||
        req.body?.hostelId ||
        (req.baseUrl?.includes("hostels") ? req.params.id : null) ||
        null;

      let targetBlockId: string | null =
        req.params.blockId ||
        req.body?.blockId ||
        (req.baseUrl?.includes("blocks") ? req.params.id : null) ||
        null;

      const targetRoomId: string | null =
        req.params.roomId ||
        req.body?.roomId ||
        (req.baseUrl?.includes("rooms") ? req.params.id : null) ||
        null;

      const targetBedId: string | null =
        req.params.bedId ||
        req.body?.bedId ||
        (req.baseUrl?.includes("beds") ? req.params.id : null) ||
        null;

      // If we only have bedId, resolve roomId -> blockId -> hostelId
      if (!targetHostelId && targetBedId) {
        const bed = await db.hostelBed.findFirst({
          where: { id: targetBedId, room: { block: { hostel: { schoolId } } } },
          select: { roomId: true, room: { select: { blockId: true, block: { select: { hostelId: true } } } } },
        });
        if (!bed) {
          sendNotFound(res, "Hostel bed not found");
          return;
        }
        targetBlockId = bed.room.blockId;
        targetHostelId = bed.room.block.hostelId;
      }

      // If we only have roomId, resolve blockId -> hostelId
      if (!targetHostelId && targetRoomId) {
        const room = await db.hostelRoom.findFirst({
          where: { id: targetRoomId, block: { hostel: { schoolId } } },
          select: { blockId: true, block: { select: { hostelId: true } } },
        });
        if (!room) {
          sendNotFound(res, "Hostel room not found");
          return;
        }
        targetBlockId = room.blockId;
        targetHostelId = room.block.hostelId;
      }

      // If we only have blockId, resolve hostelId
      if (!targetHostelId && targetBlockId) {
        const block = await db.hostelBlock.findFirst({
          where: { id: targetBlockId, hostel: { schoolId } },
          select: { hostelId: true },
        });
        if (!block) {
          sendNotFound(res, "Hostel block not found");
          return;
        }
        targetHostelId = block.hostelId;
      }

      if (!targetHostelId) {
        // If route has no hostel target, allow if user is an ADMIN
        return next();
      }

      // Find user's employee profile
      const employee = await db.employee.findFirst({
        where: { userId: user.id, schoolId },
        select: { id: true },
      });

      if (!employee) {
        sendForbidden(
          res,
          "No employee profile found for user. Hostel management requires an active staff profile.",
        );
        return;
      }

      // Check active staff assignment for this hostel
      const assignment = await db.hostelStaffAssignment.findFirst({
        where: {
          hostelId: targetHostelId,
          employeeId: employee.id,
          isActive: true,
          ...(targetBlockId ? { OR: [{ blockId: null }, { blockId: targetBlockId }] } : {}),
        },
      });

      if (!assignment) {
        sendForbidden(res, "You are not assigned as staff to this hostel or block");
        return;
      }

      // If specific staff roles are required (e.g. WARDEN, ASSISTANT_WARDEN)
      if (allowedStaffRoles && allowedStaffRoles.length > 0) {
        if (!allowedStaffRoles.includes(assignment.staffRole)) {
          sendForbidden(
            res,
            `This action requires one of the following staff roles: ${allowedStaffRoles.join(", ")}`,
          );
          return;
        }
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
