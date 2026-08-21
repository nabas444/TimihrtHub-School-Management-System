import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  Role,
  CeremonyType,
  CertificateType,
  CertificateRecipientType,
  StudentStatus,
  MilestoneType,
} from "@prisma/client";
import { db } from "../../config/database";
import { AppError } from "../../middleware/errorHandler";
import { sendSuccess } from "../../utils/response";
import { authorize } from "../../middleware/auth";
import { emitToUser } from "../../config/socket";
import {
  generateCeremonyProgramPdf,
  CeremonyProgramPdfData,
} from "../../utils/pdf";

const router = Router();
const isAdmin = [Role.ADMIN, Role.SUPER_ADMIN];
const isStaff = [Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER];

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /api/v1/ceremony-events
// List ceremony & graduation events with filters and counts
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  "/events",
  authorize(...isStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const academicYear = req.query.academicYear as string | undefined;
      const gradeLevelId = req.query.gradeLevelId as string | undefined;
      const type = req.query.type as CeremonyType | undefined;
      const search = req.query.search as string | undefined;

      const where: any = { schoolId };
      if (academicYear) where.academicYear = academicYear;
      if (gradeLevelId) where.gradeLevelId = gradeLevelId;
      if (type) where.type = type;
      if (search) {
        where.OR = [
          { title: { contains: search, mode: "insensitive" } },
          { venue: { contains: search, mode: "insensitive" } },
        ];
      }

      const events = await db.ceremonyEvent.findMany({
        where,
        orderBy: [{ academicYear: "desc" }, { ceremonyDate: "desc" }, { createdAt: "desc" }],
        include: {
          gradeLevel: { select: { id: true, name: true, level: true, milestoneType: true } },
          _count: {
            select: { participants: true },
          },
        },
      });

      sendSuccess(res, events);
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 2. POST /api/v1/ceremony-events
// Create a new ceremony / graduation event (ADMIN only)
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/events",
  authorize(...isAdmin),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;

      const data = z
        .object({
          gradeLevelId: z.string().optional().nullable(),
          type: z.nativeEnum(CeremonyType).optional().default(CeremonyType.GRADUATION),
          academicYear: z.string().min(1, "Academic year is required"),
          title: z.string().min(1, "Title is required"),
          ceremonyDate: z.string().datetime().optional().nullable(),
          venue: z.string().optional().nullable(),
          attireNote: z.string().optional().nullable(),
          program: z.string().optional().nullable(),
        })
        .parse(req.body);

      if (data.gradeLevelId) {
        const gradeLevel = await db.gradeLevel.findFirst({
          where: { id: data.gradeLevelId, schoolId },
        });
        if (!gradeLevel) throw new AppError("Grade level not found", 404);
      }

      const event = await db.ceremonyEvent.create({
        data: {
          schoolId,
          gradeLevelId: data.gradeLevelId,
          type: data.type,
          academicYear: data.academicYear,
          title: data.title,
          ceremonyDate: data.ceremonyDate ? new Date(data.ceremonyDate) : null,
          venue: data.venue,
          attireNote: data.attireNote,
          program: data.program,
        },
        include: {
          gradeLevel: true,
        },
      });

      sendSuccess(res, event, "Ceremony event created successfully", 201);
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. GET /api/v1/ceremony-events/:id
// Get single ceremony event details and full participant list
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  "/events/:id",
  authorize(...isStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const schoolId = req.user.schoolId;

      const event = await db.ceremonyEvent.findFirst({
        where: { id, schoolId },
        include: {
          gradeLevel: true,
          participants: {
            orderBy: [
              { studentProfile: { user: { lastName: "asc" } } },
              { studentProfile: { user: { firstName: "asc" } } },
            ],
            include: {
              studentProfile: {
                include: {
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      middleName: true,
                      lastName: true,
                      avatar: true,
                      gender: true,
                    },
                  },
                  class: { select: { id: true, name: true } },
                  gradeLevel: { select: { id: true, name: true, milestoneType: true } },
                  academicYearSummaries: {
                    where: { academicYear: req.query.academicYear as string || undefined },
                    take: 1,
                  },
                },
              },
              certificate: {
                select: {
                  id: true,
                  title: true,
                  issueDate: true,
                  layout: true,
                },
              },
            },
          },
        },
      });

      if (!event) throw new AppError("Ceremony event not found", 404);

      sendSuccess(res, event);
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 4. PATCH /api/v1/ceremony-events/:id
// Update ceremony event details (ADMIN only)
// ─────────────────────────────────────────────────────────────────────────────
router.patch(
  "/events/:id",
  authorize(...isAdmin),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const schoolId = req.user.schoolId;

      const data = z
        .object({
          gradeLevelId: z.string().optional().nullable(),
          type: z.nativeEnum(CeremonyType).optional(),
          academicYear: z.string().optional(),
          title: z.string().optional(),
          ceremonyDate: z.string().datetime().optional().nullable(),
          venue: z.string().optional().nullable(),
          attireNote: z.string().optional().nullable(),
          program: z.string().optional().nullable(),
        })
        .parse(req.body);

      const existing = await db.ceremonyEvent.findFirst({
        where: { id, schoolId },
      });
      if (!existing) throw new AppError("Ceremony event not found", 404);

      const updated = await db.ceremonyEvent.update({
        where: { id },
        data: {
          gradeLevelId: data.gradeLevelId !== undefined ? data.gradeLevelId : existing.gradeLevelId,
          type: data.type || existing.type,
          academicYear: data.academicYear || existing.academicYear,
          title: data.title || existing.title,
          ceremonyDate:
            data.ceremonyDate !== undefined
              ? data.ceremonyDate
                ? new Date(data.ceremonyDate)
                : null
              : existing.ceremonyDate,
          venue: data.venue !== undefined ? data.venue : existing.venue,
          attireNote: data.attireNote !== undefined ? data.attireNote : existing.attireNote,
          program: data.program !== undefined ? data.program : existing.program,
        },
        include: { gradeLevel: true },
      });

      sendSuccess(res, updated, "Ceremony event updated successfully");
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 5. DELETE /api/v1/ceremony-events/:id
// Delete ceremony event & participant enrollments (ADMIN only)
// ─────────────────────────────────────────────────────────────────────────────
router.delete(
  "/events/:id",
  authorize(...isAdmin),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const schoolId = req.user.schoolId;

      const existing = await db.ceremonyEvent.findFirst({
        where: { id, schoolId },
      });
      if (!existing) throw new AppError("Ceremony event not found", 404);

      await db.ceremonyEvent.delete({ where: { id } });
      sendSuccess(res, null, "Ceremony event deleted successfully");
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 6. POST /api/v1/ceremony-events/:id/participants/bulk
// Bulk enroll eligible students into ceremony
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/events/:id/participants/bulk",
  authorize(...isAdmin),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const schoolId = req.user.schoolId;

      const { classId, studentProfileIds, gradeLevelId } = z
        .object({
          classId: z.string().optional(),
          gradeLevelId: z.string().optional(),
          studentProfileIds: z.array(z.string()).optional(),
        })
        .parse(req.body);

      const event = await db.ceremonyEvent.findFirst({
        where: { id, schoolId },
      });
      if (!event) throw new AppError("Ceremony event not found", 404);

      let targetStudents: { id: string }[] = [];

      if (studentProfileIds && studentProfileIds.length > 0) {
        targetStudents = await db.studentProfile.findMany({
          where: { id: { in: studentProfileIds }, user: { schoolId, isActive: true } },
          select: { id: true },
        });
      } else {
        const targetGradeId = gradeLevelId || event.gradeLevelId;
        let studentWhere: any = { user: { schoolId, isActive: true } };

        if (classId) {
          studentWhere.classId = classId;
        } else if (targetGradeId) {
          studentWhere.OR = [
            { gradeLevelId: targetGradeId },
            { class: { is: { gradeLevelId: targetGradeId } } },
          ];
        }

        targetStudents = await db.studentProfile.findMany({
          where: studentWhere,
          select: { id: true },
        });
      }

      let addedCount = 0;
      let skippedCount = 0;

      for (const student of targetStudents) {
        const exists = await db.ceremonyParticipant.findUnique({
          where: {
            ceremonyEventId_studentProfileId: {
              ceremonyEventId: id,
              studentProfileId: student.id,
            },
          },
        });

        if (exists) {
          skippedCount++;
        } else {
          await db.ceremonyParticipant.create({
            data: {
              ceremonyEventId: id,
              studentProfileId: student.id,
              attendanceConfirmed: false,
            },
          });
          addedCount++;
        }
      }

      sendSuccess(
        res,
        {
          totalCandidates: targetStudents.length,
          addedCount,
          skippedCount,
        },
        `Successfully enrolled ${addedCount} participants (${skippedCount} already enrolled)`,
        201,
      );
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 7. POST /api/v1/ceremony-events/:id/participants
// Add single participant manually
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/events/:id/participants",
  authorize(...isAdmin),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const schoolId = req.user.schoolId;

      const { studentProfileId } = z
        .object({ studentProfileId: z.string().min(1) })
        .parse(req.body);

      const event = await db.ceremonyEvent.findFirst({
        where: { id, schoolId },
      });
      if (!event) throw new AppError("Ceremony event not found", 404);

      const student = await db.studentProfile.findFirst({
        where: { id: studentProfileId, user: { schoolId } },
      });
      if (!student) throw new AppError("Student not found", 404);

      const existing = await db.ceremonyParticipant.findUnique({
        where: {
          ceremonyEventId_studentProfileId: {
            ceremonyEventId: id,
            studentProfileId,
          },
        },
      });
      if (existing) {
        throw new AppError("Student is already enrolled in this ceremony", 400);
      }

      const participant = await db.ceremonyParticipant.create({
        data: {
          ceremonyEventId: id,
          studentProfileId,
          attendanceConfirmed: false,
        },
        include: {
          studentProfile: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true } },
              class: { select: { id: true, name: true } },
            },
          },
        },
      });

      sendSuccess(res, participant, "Participant added successfully", 201);
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 8. DELETE /api/v1/ceremony-participants/:id
// Remove a participant from the ceremony
// ─────────────────────────────────────────────────────────────────────────────
router.delete(
  "/participants/:id",
  authorize(...isAdmin),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const schoolId = req.user.schoolId;

      const participant = await db.ceremonyParticipant.findFirst({
        where: { id, ceremonyEvent: { schoolId } },
      });
      if (!participant) throw new AppError("Participant not found", 404);

      await db.ceremonyParticipant.delete({ where: { id } });
      sendSuccess(res, null, "Participant removed from ceremony");
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 9. PATCH /api/v1/ceremony-participants/:id
// Toggle attendance confirmation or update participant status
// ─────────────────────────────────────────────────────────────────────────────
router.patch(
  "/participants/:id",
  authorize(...isStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const schoolId = req.user.schoolId;

      const data = z
        .object({
          attendanceConfirmed: z.boolean().optional(),
        })
        .parse(req.body);

      const participant = await db.ceremonyParticipant.findFirst({
        where: { id, ceremonyEvent: { schoolId } },
      });
      if (!participant) throw new AppError("Participant not found", 404);

      const updated = await db.ceremonyParticipant.update({
        where: { id },
        data,
      });

      sendSuccess(res, updated, "Participant attendance updated");
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 10. POST /api/v1/ceremony-events/:id/issue-certificates
// Batch issue official GRADUATION certificates for all unissued participants
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/events/:id/issue-certificates",
  authorize(...isAdmin),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const schoolId = req.user.schoolId;
      const signerId = req.user.id;

      const event = await db.ceremonyEvent.findFirst({
        where: { id, schoolId },
        include: {
          gradeLevel: true,
          participants: {
            where: { certificateId: null },
            include: {
              studentProfile: {
                include: {
                  user: true,
                  class: {
                    include: {
                      gradeLevel: true,
                    },
                  },
                  gradeLevel: true,
                  academicYearSummaries: {
                    orderBy: { generatedAt: "desc" },
                    take: 5,
                  },
                },
              },
            },
          },
        },
      });

      if (!event) throw new AppError("Ceremony event not found", 404);

      const createdCertificates: any[] = [];
      const skippedDetails: { id: string; name: string; reason: string }[] = [];

      for (const participant of event.participants) {
        const student = participant.studentProfile;
        const studentName = [
          student.user.firstName,
          student.user.middleName,
          student.user.lastName,
        ]
          .filter(Boolean)
          .join(" ");

        // Check internal status
        const isArchivedOrGraduated =
          student.status === StudentStatus.ARCHIVE || student.graduatedAt != null;
        const summary =
          student.academicYearSummaries.find(
            (s) => s.academicYear === event.academicYear,
          ) || student.academicYearSummaries[0];

        if (!isArchivedOrGraduated) {
          skippedDetails.push({
            id: participant.id,
            name: studentName,
            reason: "Student status is not ARCHIVE (Graduated)",
          });
          continue;
        }

        if (!summary || !summary.isPassing) {
          skippedDetails.push({
            id: participant.id,
            name: studentName,
            reason: `Academic average is not passing or summary missing for year ${event.academicYear}`,
          });
          continue;
        }

        // Check External Exam Milestone requirement if applicable
        const effectiveGradeLevel = student.gradeLevel || student.class?.gradeLevel || event.gradeLevel;
        if (effectiveGradeLevel && effectiveGradeLevel.milestoneType === MilestoneType.EXTERNAL_EXAM) {
          const checkpoint = await db.externalExamCheckpoint.findFirst({
            where: {
              schoolId,
              gradeLevelId: effectiveGradeLevel.id,
              academicYear: event.academicYear,
            },
          });

          if (checkpoint) {
            const examRecord = await db.externalExamRecord.findUnique({
              where: {
                checkpointId_studentProfileId: {
                  checkpointId: checkpoint.id,
                  studentProfileId: student.id,
                },
              },
            });

            if (!examRecord || examRecord.isPassing !== true) {
              skippedDetails.push({
                id: participant.id,
                name: studentName,
                reason: `External exam (${checkpoint.name}) result is not passing or not recorded`,
              });
              continue;
            }
          }
        }

        // Issue Certificate
        const certificate = await db.certificate.create({
          data: {
            schoolId,
            type: CertificateType.GRADUATION,
            recipientType: CertificateRecipientType.STUDENT,
            studentProfileId: student.id,
            academicYear: event.academicYear,
            title: event.title,
            reason: `Successfully completed all academic requirements and ceremony milestone for ${event.title}`,
            layout: "ONE_SIDED",
            signedById: signerId,
          },
        });

        // Link certificate to ceremony participant
        await db.ceremonyParticipant.update({
          where: { id: participant.id },
          data: { certificateId: certificate.id },
        });

        createdCertificates.push(certificate);

        // Send in-app notification
        emitToUser(student.user.id, "notification:new", {
          type: "GENERAL",
          title: "Graduation Certificate Issued",
          body: `Congratulations! Your graduation certificate for ${event.title} has been officially issued.`,
        });
      }

      sendSuccess(
        res,
        {
          totalProcessed: event.participants.length,
          issuedCount: createdCertificates.length,
          skippedCount: skippedDetails.length,
          skippedDetails,
          certificates: createdCertificates,
        },
        `Issued ${createdCertificates.length} certificates (${skippedDetails.length} skipped)`,
        201,
      );
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 11. GET & POST /api/v1/ceremony-events/:id/program-pdf
// Generate printable A4 Ceremony Program PDF
// ─────────────────────────────────────────────────────────────────────────────
const handleGenerateCeremonyProgramPdf = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;

    const event = await db.ceremonyEvent.findFirst({
      where: { id, schoolId },
      include: {
        school: true,
        gradeLevel: true,
        participants: {
          orderBy: [
            { studentProfile: { user: { lastName: "asc" } } },
            { studentProfile: { user: { firstName: "asc" } } },
          ],
          include: {
            studentProfile: {
              include: {
                user: { select: { firstName: true, middleName: true, lastName: true } },
                class: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (!event) throw new AppError("Ceremony event not found", 404);

    const pdfData: CeremonyProgramPdfData = {
      school: {
        name: event.school.name,
        address: event.school.address,
        phone: event.school.phone,
        email: event.school.email,
      },
      ceremony: {
        title: event.title,
        type: event.type,
        academicYear: event.academicYear,
        ceremonyDate: event.ceremonyDate,
        venue: event.venue,
        attireNote: event.attireNote,
        program: event.program,
        gradeLevelName: event.gradeLevel?.name || null,
      },
      participants: event.participants.map((p) => ({
        name: [
          p.studentProfile.user.firstName,
          p.studentProfile.user.middleName,
          p.studentProfile.user.lastName,
        ]
          .filter(Boolean)
          .join(" "),
        admissionNumber: p.studentProfile.admissionNumber,
        className: p.studentProfile.class?.name || null,
        attendanceConfirmed: p.attendanceConfirmed,
        certificateIssued: !!p.certificateId,
      })),
    };

    const pdfBuffer = await generateCeremonyProgramPdf(pdfData);

    const safeTitle = event.title.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const filename = `ceremony-program-${safeTitle}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
};

router.get("/events/:id/program-pdf", isStaff[0] ? authorize(...isStaff) : (req, res, next) => next(), handleGenerateCeremonyProgramPdf);
router.post("/events/:id/program-pdf", isStaff[0] ? authorize(...isStaff) : (req, res, next) => next(), handleGenerateCeremonyProgramPdf);

export default router;
