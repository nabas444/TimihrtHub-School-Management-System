import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Role, CertificateType, CertificateRecipientType, StudentStatus, BehaviourType } from "@prisma/client";
import { db } from "../../config/database";
import { AppError } from "../../middleware/errorHandler";
import { sendSuccess } from "../../utils/response";
import { authorize } from "../../middleware/auth";
import { emitToUser } from "../../config/socket";
import {
  generateCertificatePdf,
  CertificatePdfData,
} from "../../utils/pdf";

const router = Router();
const isAdmin = [Role.ADMIN, Role.SUPER_ADMIN];
const isStaff = [Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER];

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /api/v1/certificates/mine
// Returns certificates issued to the current logged-in user (student or staff)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/mine", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user.schoolId;
    const userId = req.user.id;
    const role = req.user.role;

    let where: any = { schoolId };

    if (role === Role.STUDENT) {
      const studentProfile = await db.studentProfile.findUnique({
        where: { userId },
      });
      if (!studentProfile) {
        return sendSuccess(res, { certificates: [], total: 0 });
      }
      where.recipientType = CertificateRecipientType.STUDENT;
      where.studentProfileId = studentProfile.id;
    } else if (role === Role.PARENT) {
      // Return certificates for all linked children
      const links = await db.parentStudentLink.findMany({
        where: { parentProfile: { userId } },
        select: { studentProfileId: true },
      });
      const childProfileIds = links.map((l) => l.studentProfileId);
      where.recipientType = CertificateRecipientType.STUDENT;
      where.studentProfileId = { in: childProfileIds };
    } else {
      // Staff user
      where.recipientType = CertificateRecipientType.STAFF;
      where.userId = userId;
    }

    const certificates = await db.certificate.findMany({
      where,
      orderBy: { createdAt: "desc" },
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
              },
            },
            class: { select: { id: true, name: true } },
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            role: true,
          },
        },
        signedBy: {
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    sendSuccess(res, {
      total: certificates.length,
      certificates,
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /api/v1/certificates/preview-recipients
// Previews eligible and non-eligible candidates before issuing certificates
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  "/preview-recipients",
  authorize(...isStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const type = (req.query.type as CertificateType) || CertificateType.RECOGNITION;
      const recipientType =
        (req.query.recipientType as CertificateRecipientType) ||
        CertificateRecipientType.STUDENT;
      const scope = (req.query.scope as string) || "CLASS";
      const classId = req.query.classId as string | undefined;
      const gradeLevelId = req.query.gradeLevelId as string | undefined;
      const academicYear = req.query.academicYear as string | undefined;

      if (recipientType === CertificateRecipientType.STAFF) {
        // Staff recipients preview
        const staffUsers = await db.user.findMany({
          where: {
            schoolId,
            role: { in: [Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN, Role.FINANCE] },
            isActive: true,
          },
          orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            role: true,
            email: true,
            phone: true,
            teacherProfile: {
              select: {
                id: true,
                employeeId: true,
                designation: true,
                specialization: true,
              },
            },
            adminProfile: {
              select: {
                id: true,
                employeeId: true,
                department: true,
                designation: true,
              },
            },
          },
        });

        return sendSuccess(res, {
          total: staffUsers.length,
          recipients: staffUsers.map((u) => ({
            id: u.id,
            name: [u.firstName, u.middleName, u.lastName].filter(Boolean).join(" "),
            role: u.role,
            employeeId: u.teacherProfile?.employeeId || u.adminProfile?.employeeId || null,
            department: u.adminProfile?.department || u.teacherProfile?.specialization || null,
            isEligible: true,
          })),
        });
      }

      // Student recipients preview
      let studentWhere: any = {
        user: { schoolId, isActive: true },
      };

      if (scope === "CLASS" && classId) {
        studentWhere.classId = classId;
      } else if (scope === "SECTION" && gradeLevelId) {
        studentWhere.OR = [
          { gradeLevelId },
          { class: { is: { gradeLevelId } } },
        ];
      }

      const students = await db.studentProfile.findMany({
        where: studentWhere,
        orderBy: [
          { class: { name: "asc" } },
          { user: { firstName: "asc" } },
          { user: { lastName: "asc" } },
        ],
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              middleName: true,
              lastName: true,
              avatar: true,
            },
          },
          class: { select: { id: true, name: true } },
          gradeLevel: { select: { id: true, name: true } },
          academicYearSummaries: academicYear
            ? { where: { academicYear }, take: 1 }
            : { orderBy: { generatedAt: "desc" }, take: 1 },
        },
      });

      // Commendations context (BehaviourRecord with type COMMENDATION)
      const commendationCounts = await db.behaviourRecord.groupBy({
        by: ["studentId"],
        where: {
          schoolId,
          type: BehaviourType.COMMENDATION,
        },
        _count: { id: true },
      });
      const commendationMap = Object.fromEntries(
        commendationCounts.map((c) => [c.studentId, c._count.id]),
      );

      const mappedRecipients = students.map((s) => {
        const summary = s.academicYearSummaries[0] || null;
        const name = [s.user.firstName, s.user.middleName, s.user.lastName]
          .filter(Boolean)
          .join(" ");

        let isEligible = true;
        let eligibilityReason = "Eligible";

        if (type === CertificateType.GRADUATION) {
          const isArchivedOrGraduated =
            s.status === StudentStatus.ARCHIVE || s.graduatedAt != null;
          const isPassing = summary?.isPassing === true;

          if (!isArchivedOrGraduated) {
            isEligible = false;
            eligibilityReason = "Student status is not ARCHIVE/Graduated";
          } else if (!summary) {
            isEligible = false;
            eligibilityReason = "Academic year summary not generated yet";
          } else if (!isPassing) {
            isEligible = false;
            eligibilityReason = `Academic average (${summary.overallAverage ?? 0}%) does not meet passing threshold`;
          }
        }

        return {
          studentProfileId: s.id,
          userId: s.user.id,
          name,
          admissionNumber: s.admissionNumber,
          rollNumber: s.rollNumber,
          className: s.class?.name || "—",
          status: s.status,
          graduatedAt: s.graduatedAt,
          commendationCount: commendationMap[s.user.id] || 0,
          overallAverage: summary?.overallAverage ?? null,
          overallRank: summary?.overallRank ?? null,
          isPassing: summary?.isPassing ?? false,
          isEligible,
          eligibilityReason,
        };
      });

      sendSuccess(res, {
        total: mappedRecipients.length,
        eligibleCount: mappedRecipients.filter((r) => r.isEligible).length,
        recipients: mappedRecipients,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. POST /api/v1/certificates
// Create a single certificate (Graduation or Recognition)
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/",
  authorize(...isStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;

      const data = z
        .object({
          type: z.nativeEnum(CertificateType),
          recipientType: z.nativeEnum(CertificateRecipientType),
          studentProfileId: z.string().optional(),
          userId: z.string().optional(),
          academicYear: z.string().optional(),
          title: z.string().min(1, "Title is required"),
          reason: z.string().optional(),
          layout: z.enum(["ONE_SIDED", "TWO_SIDED"]).optional().default("ONE_SIDED"),
          signedById: z.string().optional(),
        })
        .parse(req.body);

      // Validate Signer if provided or default to current user
      const signerId = data.signedById || req.user.id;

      if (data.type === CertificateType.GRADUATION) {
        if (data.recipientType !== CertificateRecipientType.STUDENT) {
          throw new AppError("Graduation certificates can only be issued to students", 400);
        }
        if (!data.studentProfileId) {
          throw new AppError("studentProfileId is required for graduation certificate", 400);
        }

        const student = await db.studentProfile.findFirst({
          where: { id: data.studentProfileId, user: { schoolId } },
          include: {
            user: true,
            academicYearSummaries: data.academicYear
              ? { where: { academicYear: data.academicYear }, take: 1 }
              : { orderBy: { generatedAt: "desc" }, take: 1 },
          },
        });

        if (!student) throw new AppError("Student not found", 404);

        const isArchived = student.status === StudentStatus.ARCHIVE || student.graduatedAt != null;
        const summary = student.academicYearSummaries[0];

        if (!isArchived) {
          throw new AppError(
            "Student is not eligible for a graduation certificate: Student must have completed status (ARCHIVE) before graduation certificate issuance.",
            400,
          );
        }

        if (!summary || !summary.isPassing) {
          throw new AppError(
            `Student is not eligible for a graduation certificate: Passing academic year summary for ${data.academicYear || "the academic year"} is required.`,
            400,
          );
        }
      } else {
        // Recognition certificate
        if (data.recipientType === CertificateRecipientType.STUDENT && !data.studentProfileId) {
          throw new AppError("studentProfileId is required for student recognition", 400);
        }
        if (data.recipientType === CertificateRecipientType.STAFF && !data.userId) {
          throw new AppError("userId is required for staff recognition", 400);
        }
        if (!data.reason && !data.title) {
          throw new AppError("Title and reason are required for recognition certificate", 400);
        }
      }

      const certificate = await db.certificate.create({
        data: {
          schoolId,
          type: data.type,
          recipientType: data.recipientType,
          studentProfileId:
            data.recipientType === CertificateRecipientType.STUDENT
              ? data.studentProfileId
              : null,
          userId:
            data.recipientType === CertificateRecipientType.STAFF
              ? data.userId
              : null,
          academicYear: data.academicYear || null,
          title: data.title,
          reason: data.reason || null,
          layout: data.layout,
          signedById: signerId,
        },
        include: {
          studentProfile: {
            include: {
              user: true,
              class: true,
            },
          },
          user: true,
          signedBy: true,
        },
      });

      // Send in-app notification to recipient
      const recipientUserId =
        certificate.recipientType === CertificateRecipientType.STUDENT
          ? certificate.studentProfile?.user.id
          : certificate.user?.id;

      if (recipientUserId) {
        emitToUser(recipientUserId, "notification:new", {
          type: "GENERAL",
          title: "New Certificate Awarded",
          body: `You have been awarded: ${certificate.title}. Check your certificates to view and download.`,
        });
      }

      sendSuccess(res, certificate, "Certificate created successfully", 201);
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 4. POST /api/v1/certificates/bulk
// Bulk issue certificates for a class, section, or staff group
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/bulk",
  authorize(...isAdmin),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;

      const data = z
        .object({
          scope: z.enum(["CLASS", "SECTION", "STAFF_GROUP", "SELECTED_STUDENTS"]),
          classId: z.string().optional(),
          gradeLevelId: z.string().optional(),
          studentProfileIds: z.array(z.string()).optional(),
          userIds: z.array(z.string()).optional(),
          type: z.nativeEnum(CertificateType),
          recipientType: z.nativeEnum(CertificateRecipientType),
          title: z.string().min(1, "Title is required"),
          reason: z.string().optional(),
          layout: z.enum(["ONE_SIDED", "TWO_SIDED"]).optional().default("ONE_SIDED"),
          academicYear: z.string().optional(),
          signedById: z.string().optional(),
        })
        .parse(req.body);

      const signerId = data.signedById || req.user.id;
      const createdCertificates: any[] = [];
      const skippedDetails: { id: string; name: string; reason: string }[] = [];

      if (data.recipientType === CertificateRecipientType.STAFF) {
        // Staff bulk issuance
        let staffUsers: any[] = [];
        if (data.userIds && data.userIds.length > 0) {
          staffUsers = await db.user.findMany({
            where: { id: { in: data.userIds }, schoolId, isActive: true },
          });
        } else {
          staffUsers = await db.user.findMany({
            where: {
              schoolId,
              role: { in: [Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN, Role.FINANCE] },
              isActive: true,
            },
          });
        }

        for (const staff of staffUsers) {
          const cert = await db.certificate.create({
            data: {
              schoolId,
              type: data.type,
              recipientType: CertificateRecipientType.STAFF,
              userId: staff.id,
              academicYear: data.academicYear || null,
              title: data.title,
              reason: data.reason || null,
              layout: data.layout,
              signedById: signerId,
            },
          });
          createdCertificates.push(cert);

          emitToUser(staff.id, "notification:new", {
            type: "GENERAL",
            title: "New Certificate Awarded",
            body: `You have been awarded: ${data.title}. Check your certificates to download.`,
          });
        }
      } else {
        // Student bulk issuance
        let studentWhere: any = {
          user: { schoolId, isActive: true },
        };

        if (data.studentProfileIds && data.studentProfileIds.length > 0) {
          studentWhere.id = { in: data.studentProfileIds };
        } else if (data.scope === "CLASS" && data.classId) {
          studentWhere.classId = data.classId;
        } else if (data.scope === "SECTION" && data.gradeLevelId) {
          studentWhere.OR = [
            { gradeLevelId: data.gradeLevelId },
            { class: { is: { gradeLevelId: data.gradeLevelId } } },
          ];
        }

        const students = await db.studentProfile.findMany({
          where: studentWhere,
          include: {
            user: true,
            academicYearSummaries: data.academicYear
              ? { where: { academicYear: data.academicYear }, take: 1 }
              : { orderBy: { generatedAt: "desc" }, take: 1 },
          },
        });

        for (const student of students) {
          const studentName = [
            student.user.firstName,
            student.user.middleName,
            student.user.lastName,
          ]
            .filter(Boolean)
            .join(" ");

          if (data.type === CertificateType.GRADUATION) {
            const isArchived =
              student.status === StudentStatus.ARCHIVE || student.graduatedAt != null;
            const summary = student.academicYearSummaries[0];

            if (!isArchived) {
              skippedDetails.push({
                id: student.id,
                name: studentName,
                reason: "Student status is not ARCHIVE (Graduated)",
              });
              continue;
            }

            if (!summary || !summary.isPassing) {
              skippedDetails.push({
                id: student.id,
                name: studentName,
                reason: "No passing academic year summary found for this academic year",
              });
              continue;
            }
          }

          const cert = await db.certificate.create({
            data: {
              schoolId,
              type: data.type,
              recipientType: CertificateRecipientType.STUDENT,
              studentProfileId: student.id,
              academicYear: data.academicYear || null,
              title: data.title,
              reason: data.reason || null,
              layout: data.layout,
              signedById: signerId,
            },
          });
          createdCertificates.push(cert);

          emitToUser(student.user.id, "notification:new", {
            type: "GENERAL",
            title: "New Certificate Awarded",
            body: `You have been awarded: ${data.title}. Check your certificates to download.`,
          });
        }
      }

      sendSuccess(
        res,
        {
          totalProcessed: createdCertificates.length + skippedDetails.length,
          createdCount: createdCertificates.length,
          skippedCount: skippedDetails.length,
          skippedDetails,
          certificates: createdCertificates,
        },
        `Successfully issued ${createdCertificates.length} certificates (${skippedDetails.length} skipped)`,
        201,
      );
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 5. GET /api/v1/certificates
// Search & filter certificates for admin history / re-download
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  "/",
  authorize(...isStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const type = req.query.type as CertificateType | undefined;
      const recipientType = req.query.recipientType as CertificateRecipientType | undefined;
      const search = req.query.search as string | undefined;
      const academicYear = req.query.academicYear as string | undefined;
      const classId = req.query.classId as string | undefined;

      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 30));
      const skip = (page - 1) * limit;

      let where: any = { schoolId };

      if (type) where.type = type;
      if (recipientType) where.recipientType = recipientType;
      if (academicYear) where.academicYear = academicYear;
      if (classId) {
        where.studentProfile = { classId };
      }

      if (search) {
        where.OR = [
          { title: { contains: search, mode: "insensitive" } },
          { reason: { contains: search, mode: "insensitive" } },
          {
            studentProfile: {
              user: {
                OR: [
                  { firstName: { contains: search, mode: "insensitive" } },
                  { lastName: { contains: search, mode: "insensitive" } },
                ],
              },
            },
          },
          {
            user: {
              OR: [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
              ],
            },
          },
        ];
      }

      const [total, certificates] = await Promise.all([
        db.certificate.count({ where }),
        db.certificate.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
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
                gradeLevel: { select: { id: true, name: true } },
              },
            },
            user: {
              select: {
                id: true,
                firstName: true,
                middleName: true,
                lastName: true,
                role: true,
                avatar: true,
              },
            },
            signedBy: {
              select: {
                id: true,
                firstName: true,
                middleName: true,
                lastName: true,
                role: true,
              },
            },
          },
        }),
      ]);

      sendSuccess(res, {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        certificates,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 6. GET /api/v1/certificates/:id
// Get single certificate details
// ─────────────────────────────────────────────────────────────────────────────
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const certificate = await db.certificate.findUnique({
      where: { id },
      include: {
        studentProfile: {
          include: {
            user: true,
            class: true,
            gradeLevel: true,
          },
        },
        user: true,
        signedBy: true,
        school: true,
      },
    });

    if (!certificate || certificate.schoolId !== req.user.schoolId) {
      throw new AppError("Certificate not found", 404);
    }

    sendSuccess(res, certificate);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. POST & GET /api/v1/certificates/:id/pdf
// Generates official printable PDF Certificate
// ─────────────────────────────────────────────────────────────────────────────
const handleGenerateCertificatePdf = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;

    const cert = await db.certificate.findFirst({
      where: { id, schoolId },
      include: {
        school: true,
        studentProfile: {
          include: {
            user: true,
            class: {
              include: {
                classTeacher: {
                  include: { user: true },
                },
              },
            },
            gradeLevel: true,
            academicYearSummaries: {
              orderBy: { generatedAt: "desc" },
              take: 5,
            },
          },
        },
        user: {
          include: {
            teacherProfile: true,
            adminProfile: true,
          },
        },
        signedBy: {
          include: {
            teacherProfile: true,
            adminProfile: true,
          },
        },
      },
    });

    if (!cert) throw new AppError("Certificate not found", 404);

    // Permission checks:
    if (req.user.role === Role.STUDENT) {
      if (cert.studentProfile?.user.id !== req.user.id) {
        throw new AppError("Forbidden: You can only download your own certificate", 403);
      }
    } else if (req.user.role === Role.PARENT) {
      const link = await db.parentStudentLink.findFirst({
        where: {
          studentProfileId: cert.studentProfileId || "",
          parentProfile: { userId: req.user.id },
        },
      });
      if (!link) {
        throw new AppError("Forbidden: You are not linked to this student", 403);
      }
    }

    // Determine recipient details
    const isStudent = cert.recipientType === CertificateRecipientType.STUDENT;
    const recipientUser = isStudent ? cert.studentProfile?.user : cert.user;
    const recipientName = recipientUser
      ? [recipientUser.firstName, recipientUser.middleName, recipientUser.lastName]
          .filter(Boolean)
          .join(" ")
      : "Recipient";

    const recipientIdNumber = isStudent
      ? cert.studentProfile?.admissionNumber
      : cert.user?.teacherProfile?.employeeId || cert.user?.adminProfile?.employeeId || null;

    const recipientRole = isStudent
      ? "Student"
      : recipientUser?.role
        ? recipientUser.role.charAt(0) + recipientUser.role.slice(1).toLowerCase()
        : "Staff";

    const className = cert.studentProfile?.class?.name || null;

    const signerName = cert.signedBy
      ? [cert.signedBy.firstName, cert.signedBy.middleName, cert.signedBy.lastName]
          .filter(Boolean)
          .join(" ")
      : "School Principal";

    const signerTitle =
      cert.signedBy?.adminProfile?.designation ||
      (cert.signedBy?.role === Role.SUPER_ADMIN ? "School Director" : "Principal");

    const classTeacherUser = cert.studentProfile?.class?.classTeacher?.[0]?.user;
    const homeroomTeacherName = classTeacherUser
      ? [
          classTeacherUser.firstName,
          classTeacherUser.middleName,
          classTeacherUser.lastName,
        ]
          .filter(Boolean)
          .join(" ")
      : null;

    // Supplementary back side details if TWO_SIDED
    let backSideDetails: CertificatePdfData["backSideDetails"] = undefined;
    if (cert.layout === "TWO_SIDED") {
      let academicSummary = null;
      const summaries = cert.studentProfile?.academicYearSummaries || [];
      const summ = cert.academicYear
        ? summaries.find((s) => s.academicYear === cert.academicYear) || summaries[0]
        : summaries[0];

      if (isStudent && summ) {
        const breakdown = Array.isArray(summ.termBreakdown)
          ? (summ.termBreakdown as any[]).map((t) => ({
              termName: t.termName || "Term",
              percentage: t.percentage,
              rank: t.rank,
            }))
          : [];

        academicSummary = {
          overallAverage: summ.overallAverage,
          overallRank: summ.overallRank,
          termBreakdown: breakdown,
        };
      }

      backSideDetails = {
        academicSummary,
        extendedCitation: cert.reason,
      };
    }

    const pdfData: CertificatePdfData = {
      school: {
        name: cert.school.name,
        address: cert.school.address,
        phone: cert.school.phone,
        email: cert.school.email,
      },
      certificate: {
        id: cert.id,
        type: cert.type,
        recipientType: cert.recipientType,
        recipientName,
        recipientIdNumber,
        recipientRole,
        className,
        academicYear: cert.academicYear,
        title: cert.title,
        reason: cert.reason,
        issueDate: cert.issueDate,
        layout: cert.layout as "ONE_SIDED" | "TWO_SIDED",
        signerName,
        signerTitle,
        homeroomTeacherName,
      },
      backSideDetails,
    };

    const pdfBuffer = await generateCertificatePdf(pdfData);

    const safeTitle = cert.title.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const safeName = recipientName.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const filename = `certificate-${safeTitle}-${safeName}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
};

router.post("/:id/pdf", handleGenerateCertificatePdf);
router.get("/:id/pdf", handleGenerateCertificatePdf);

// ─────────────────────────────────────────────────────────────────────────────
// 8. DELETE /api/v1/certificates/:id
// Delete an issued certificate
// ─────────────────────────────────────────────────────────────────────────────
router.delete(
  "/:id",
  authorize(...isAdmin),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const schoolId = req.user.schoolId;

      const cert = await db.certificate.findFirst({
        where: { id, schoolId },
      });
      if (!cert) throw new AppError("Certificate not found", 404);

      await db.certificate.delete({ where: { id } });
      sendSuccess(res, null, "Certificate deleted successfully");
    } catch (err) {
      next(err);
    }
  },
);

export default router;
