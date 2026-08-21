/**
 * TimhirtHub Club Management Router
 * Complete endpoints for clubs, memberships, leadership,
 * meetings, events, RSVPs, attendance, activities, announcements,
 * documents, goals, and academic renewal.
 */

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as ClubService from "./clubs.service";
import { sendSuccess, sendCreated } from "../../utils/response";
import { AppError } from "../../middleware/errorHandler";
import { Role } from "@prisma/client";

const router = Router();

// ── 1. CLUBS DIRECTORY & OVERVIEW ─────────────────────────────────────────────

router.get("/overview", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const overview = await ClubService.getClubOverview(
      req.user.schoolId,
      req.user.id,
      req.user.role,
    );
    sendSuccess(res, overview);
  } catch (e) {
    next(e);
  }
});

router.get("/my", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const myClubs = await ClubService.getMyClubs(req.user.schoolId, req.user.id);
    sendSuccess(res, myClubs);
  } catch (e) {
    next(e);
  }
});

router.get("/faculty-candidates", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teachers = await ClubService.getFacultyCandidates(req.user.schoolId);
    sendSuccess(res, teachers);
  } catch (e) {
    next(e);
  }
});

router.get("/student-candidates", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = req.query.search as string | undefined;
    const students = await ClubService.getStudentCandidates(req.user.schoolId, search);
    sendSuccess(res, students);
  } catch (e) {
    next(e);
  }
});

router.get("/events/upcoming", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await ClubService.getUpcomingClubEvents(req.user.schoolId);
    sendSuccess(res, data);
  } catch (e) {
    next(e);
  }
});

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = req.query.search as string | undefined;
    const category = req.query.category as string | undefined;
    const status = req.query.status as string | undefined;
    const academicYear = req.query.academicYear as string | undefined;

    const clubs = await ClubService.getClubs(
      req.user.schoolId,
      req.user.id,
      req.user.role,
      { search, category, status, academicYear },
    );
    sendSuccess(res, clubs);
  } catch (e) {
    next(e);
  }
});

router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const club = await ClubService.getClubById(
      req.user.schoolId,
      req.params.id,
      req.user.id,
      req.user.role,
    );
    sendSuccess(res, club);
  } catch (e) {
    next(e);
  }
});

// ── 2. CREATE & MANAGE CLUBS ──────────────────────────────────────────────────

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      name: z.string().min(2),
      description: z.string().min(5),
      purpose: z.string().min(5),
      category: z.enum([
        "ACADEMIC",
        "SCIENCE",
        "TECHNOLOGY",
        "MATHEMATICS",
        "ARTS",
        "MUSIC",
        "SPORTS",
        "DEBATE",
        "CULTURE",
        "ENTREPRENEURSHIP",
        "COMMUNITY_SERVICE",
        "ENVIRONMENT",
        "OTHER",
      ]),
      academicYear: z.string().min(4),
      advisorId: z.string().optional().nullable(),
      expectedMembership: z.number().optional(),
      preferredMeetingSchedule: z.string().optional(),
      meetingLocation: z.string().optional(),
      logoUrl: z.string().optional().nullable(),
      bannerUrl: z.string().optional().nullable(),
      initialLeaderId: z.string().optional().nullable(),
    });

    const data = schema.parse(req.body);
    const club = await ClubService.createClubProposal(
      req.user.schoolId,
      req.user.id,
      req.user.role,
      data as any,
    );
    sendCreated(res, club, "Club proposal created successfully");
  } catch (e) {
    next(e);
  }
});

router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      name: z.string().optional(),
      description: z.string().optional(),
      purpose: z.string().optional(),
      category: z.any().optional(),
      advisorId: z.string().optional().nullable(),
      expectedMembership: z.number().optional(),
      preferredMeetingSchedule: z.string().optional(),
      meetingLocation: z.string().optional(),
      logoUrl: z.string().optional().nullable(),
      bannerUrl: z.string().optional().nullable(),
    });

    const data = schema.parse(req.body);
    const club = await ClubService.updateClub(req.user.schoolId, req.params.id, data);
    sendSuccess(res, club, "Club profile updated successfully");
  } catch (e) {
    next(e);
  }
});

router.patch("/:id/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isAdmin =
      (req.user.role as any) === "ADMIN" ||
      (req.user.role as any) === "SUPER_ADMIN";
    if (!isAdmin) {
      throw new AppError("Only administrators can update club approval status", 403);
    }

    const schema = z.object({
      status: z.enum([
        "DRAFT",
        "PENDING_APPROVAL",
        "ACTIVE",
        "SUSPENDED",
        "RENEWAL_REQUIRED",
        "ARCHIVED",
        "REJECTED",
      ]),
      reason: z.string().optional(),
    });

    const { status, reason } = schema.parse(req.body);
    const club = await ClubService.updateClubStatus(
      req.user.schoolId,
      req.params.id,
      status as any,
      reason,
    );
    sendSuccess(res, club, `Club status updated to ${status}`);
  } catch (e) {
    next(e);
  }
});

router.post("/:id/renew", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      newAcademicYear: z.string().min(4),
      newAdvisorId: z.string().optional().nullable(),
      newPresidentId: z.string().optional().nullable(),
      updatedPurpose: z.string().optional().nullable(),
      meetingSchedule: z.string().optional().nullable(),
    });

    const data = schema.parse(req.body);
    const renewed = await ClubService.renewClubForNewYear(
      req.user.schoolId,
      req.params.id,
      req.user.id,
      data as any,
    );
    sendSuccess(res, renewed, "Club renewed for new academic year");
  } catch (e) {
    next(e);
  }
});

// ── 3. MEMBERSHIPS & LEADERSHIP ───────────────────────────────────────────────

router.post("/:id/members/register", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      studentId: z.string().min(1),
      role: z.enum([
        "MEMBER",
        "PRESIDENT",
        "VICE_PRESIDENT",
        "SECRETARY",
        "TREASURER",
        "PUBLIC_RELATIONS",
        "OTHER",
      ]).optional(),
      academicYear: z.string().optional(),
    });

    const data = schema.parse(req.body);
    const mem = await ClubService.registerClubMemberDirectly(
      req.user.schoolId,
      req.params.id,
      req.user.id,
      data as any,
    );
    sendCreated(res, mem, "Student member successfully registered into club");
  } catch (e) {
    next(e);
  }
});

router.post("/:id/members/join", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      requestNotes: z.string().optional(),
    });
    const { requestNotes } = schema.parse(req.body);

    const mem = await ClubService.requestClubMembership(
      req.user.schoolId,
      req.params.id,
      req.user.id,
      requestNotes,
    );
    sendCreated(res, mem, "Membership request submitted successfully");
  } catch (e) {
    next(e);
  }
});

router.patch("/:id/members/:memberId/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      status: z.enum(["REQUESTED", "ACTIVE", "REJECTED", "LEFT", "REMOVED"]),
    });
    const { status } = schema.parse(req.body);

    const mem = await ClubService.updateMembershipStatus(
      req.user.schoolId,
      req.params.id,
      req.params.memberId,
      status as any,
    );
    sendSuccess(res, mem, `Membership status updated to ${status}`);
  } catch (e) {
    next(e);
  }
});

router.post("/:id/leaders", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      studentId: z.string(),
      role: z.enum([
        "PRESIDENT",
        "VICE_PRESIDENT",
        "SECRETARY",
        "TREASURER",
        "PUBLIC_RELATIONS",
        "OTHER",
      ]),
      academicYear: z.string().min(4),
    });

    const data = schema.parse(req.body);
    const leader = await ClubService.assignStudentLeadership(
      req.user.schoolId,
      req.params.id,
      req.user.id,
      data as any,
    );
    sendCreated(res, leader, "Student leadership role assigned successfully");
  } catch (e) {
    next(e);
  }
});

// ── 4. MEETINGS & ATTENDANCE ─────────────────────────────────────────────────

router.post("/:id/meetings", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      title: z.string().min(2),
      description: z.string().optional(),
      date: z.string(), // YYYY-MM-DD
      startTime: z.string(), // HH:mm
      endTime: z.string(), // HH:mm
      location: z.string().min(2),
      recurrence: z.string().optional(),
    });

    const data = schema.parse(req.body);
    const meeting = await ClubService.scheduleClubMeeting(
      req.user.schoolId,
      req.params.id,
      req.user.id,
      data,
    );
    sendCreated(res, meeting, "Club meeting scheduled successfully");
  } catch (e) {
    next(e);
  }
});

router.get("/:id/meetings/:meetingId/attendance", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roster = await ClubService.getClubMeetingAttendance(
      req.params.id,
      req.params.meetingId,
    );
    sendSuccess(res, roster);
  } catch (e) {
    next(e);
  }
});

router.post("/:id/meetings/:meetingId/attendance", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      records: z.array(
        z.object({
          studentId: z.string(),
          status: z.enum(["PRESENT", "ABSENT", "EXCUSED"]),
          notes: z.string().optional(),
        }),
      ),
    });

    const { records } = schema.parse(req.body);
    const results = await ClubService.recordClubMeetingAttendance(
      req.user.schoolId,
      req.params.id,
      req.params.meetingId,
      req.user.id,
      records,
    );
    sendSuccess(res, results, "Meeting attendance recorded successfully");
  } catch (e) {
    next(e);
  }
});

// ── 5. EVENTS & RSVPS ─────────────────────────────────────────────────────────

router.post("/:id/events", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      title: z.string().min(2),
      description: z.string().optional(),
      eventType: z.string().default("WORKSHOP"),
      date: z.string(),
      startTime: z.string(),
      endTime: z.string(),
      location: z.string().min(2),
      capacity: z.number().optional(),
      audience: z.string().optional(),
      attachmentUrl: z.string().optional().nullable(),
    });

    const data = schema.parse(req.body);
    const event = await ClubService.createClubEvent(
      req.user.schoolId,
      req.params.id,
      req.user.id,
      req.user.role,
      data,
    );
    sendCreated(res, event, "Club event created successfully");
  } catch (e) {
    next(e);
  }
});

router.patch("/:id/events/:eventId/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      status: z.enum([
        "DRAFT",
        "SUBMITTED",
        "UNDER_REVIEW",
        "APPROVED",
        "PUBLISHED",
        "COMPLETED",
        "CANCELLED",
      ]),
    });

    const { status } = schema.parse(req.body);
    const event = await ClubService.updateClubEventStatus(
      req.user.schoolId,
      req.params.id,
      req.params.eventId,
      status as any,
    );
    sendSuccess(res, event, `Event status updated to ${status}`);
  } catch (e) {
    next(e);
  }
});

router.post("/events/:eventId/rsvp", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      status: z.enum(["REGISTERED", "CANCELLED"]),
      notes: z.string().optional(),
    });

    const { status, notes } = schema.parse(req.body);
    const rsvp = await ClubService.rsvpClubEvent(
      req.params.eventId,
      req.user.id,
      status,
      notes,
    );
    sendSuccess(res, rsvp, "RSVP updated successfully");
  } catch (e) {
    next(e);
  }
});

// ── 6. ACTIVITIES, ANNOUNCEMENTS, DOCUMENTS & GOALS ──────────────────────────

router.post("/:id/activities", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      title: z.string().min(2),
      description: z.string().optional(),
      date: z.string(),
      outcome: z.string().optional(),
      participantsCount: z.number().optional(),
      attachmentUrl: z.string().optional().nullable(),
      mediaUrls: z.array(z.string()).optional(),
      eventId: z.string().optional().nullable(),
    });

    const data = schema.parse(req.body);
    const activity = await ClubService.recordClubActivity(
      req.user.schoolId,
      req.params.id,
      req.user.id,
      data,
    );
    sendCreated(res, activity, "Club activity recorded in portfolio");
  } catch (e) {
    next(e);
  }
});

router.post("/:id/announcements", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      title: z.string().min(2),
      content: z.string().min(5),
      priority: z.enum(["NORMAL", "URGENT"]).optional(),
      isPinned: z.boolean().optional(),
    });

    const data = schema.parse(req.body);
    const announcement = await ClubService.createClubAnnouncement(
      req.user.schoolId,
      req.params.id,
      req.user.id,
      data,
    );
    sendCreated(res, announcement, "Announcement broadcast to club members");
  } catch (e) {
    next(e);
  }
});

router.post("/:id/documents", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      name: z.string().min(2),
      category: z.string().optional(),
      fileUrl: z.string().url(),
      fileSize: z.number().optional(),
      mimeType: z.string().optional(),
    });

    const data = schema.parse(req.body);
    const doc = await ClubService.addClubDocument(
      req.user.schoolId,
      req.params.id,
      req.user.id,
      data,
    );
    sendCreated(res, doc, "Document uploaded to club repository");
  } catch (e) {
    next(e);
  }
});

router.delete("/:id/documents/:docId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await ClubService.deleteClubDocument(
      req.user.schoolId,
      req.params.id,
      req.params.docId,
    );
    sendSuccess(res, null, "Document deleted");
  } catch (e) {
    next(e);
  }
});

router.post("/:id/goals", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      title: z.string().min(2),
      description: z.string().optional(),
      targetCount: z.number().min(1),
      currentCount: z.number().optional(),
      unit: z.string().optional(),
      academicYear: z.string().min(4),
    });

    const data = schema.parse(req.body);
    const goal = await ClubService.createClubGoal(
      req.user.schoolId,
      req.params.id,
      data,
    );
    sendCreated(res, goal, "Club milestone goal created");
  } catch (e) {
    next(e);
  }
});

router.patch("/:id/goals/:goalId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      currentCount: z.number().optional(),
      status: z.enum(["IN_PROGRESS", "ACHIEVED", "MISSED"]).optional(),
    });

    const data = schema.parse(req.body);
    const goal = await ClubService.updateClubGoalProgress(
      req.user.schoolId,
      req.params.id,
      req.params.goalId,
      data,
    );
    sendSuccess(res, goal, "Goal progress updated");
  } catch (e) {
    next(e);
  }
});

export default router;
