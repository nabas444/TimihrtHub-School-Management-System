import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Role, Gender } from "@prisma/client";
import { db } from "../../config/database";
import { AppError } from "../../middleware/errorHandler";
import { sendSuccess } from "../../utils/response";
import { authorize } from "../../middleware/auth";
import {
  generateBatchIdCardsPdf,
  generateIdCardPdf,
  IdCardPerson,
} from "../../utils/pdf";

const router = Router();
const isAdmin = [Role.ADMIN, Role.SUPER_ADMIN];

// ── GET /api/v1/id-cards/preview-list ─────────────────────────────────────────
// Preview students/staff matching selection before generating PDF
router.get(
  "/preview-list",
  authorize(...isAdmin),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scope = (req.query.scope as string) || "STUDENT";
      const studentId = req.query.studentId as string | undefined;
      const classId = req.query.classId as string | undefined;
      const gradeLevelId = req.query.gradeLevelId as string | undefined;
      const role = req.query.role as Role | undefined;

      const where: any = {
        schoolId: req.user.schoolId,
        isActive: true,
      };

      if (scope === "STUDENT" && studentId) {
        where.id = studentId;
        where.role = Role.STUDENT;
      } else if (scope === "CLASS" && classId) {
        where.role = Role.STUDENT;
        where.studentProfile = { is: { classId } };
      } else if (scope === "SECTION" && gradeLevelId) {
        where.role = Role.STUDENT;
        where.studentProfile = {
          is: {
            OR: [
              { gradeLevelId },
              { class: { is: { gradeLevelId } } },
            ],
          },
        };
      } else if (scope === "STAFF") {
        if (role) {
          where.role = role;
        } else {
          where.role = { in: [Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN] };
        }
      } else if (scope === "ALL") {
        where.role = Role.STUDENT;
      }

      const users = await db.user.findMany({
        where,
        take: 200,
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        select: {
          id: true,
          firstName: true,
          middleName: true,
          lastName: true,
          role: true,
          email: true,
          phone: true,
          gender: true,
          dateOfBirth: true,
          studentProfile: {
            select: {
              admissionNumber: true,
              rollNumber: true,
              bloodGroup: true,
              class: { select: { id: true, name: true } },
              gradeLevel: { select: { id: true, name: true } },
              house: { select: { id: true, value: true, colorHex: true } },
            },
          },
          teacherProfile: {
            select: {
              employeeId: true,
              designation: true,
              house: { select: { id: true, value: true, colorHex: true } },
            },
          },
          adminProfile: {
            select: {
              employeeId: true,
              department: true,
              designation: true,
            },
          },
        },
      });

      sendSuccess(res, {
        total: users.length,
        users,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /api/v1/id-cards/generate ───────────────────────────────────────────
// Generate ID card PDF for students or staff
router.post(
  "/generate",
  authorize(...isAdmin),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = z
        .object({
          scope: z.enum(["STUDENT", "CLASS", "SECTION", "STAFF", "ALL"]),
          studentId: z.string().optional(),
          classId: z.string().optional(),
          gradeLevelId: z.string().optional(),
          role: z.nativeEnum(Role).optional(),
          userIds: z.array(z.string()).optional(),
          layout: z.enum(["HORIZONTAL", "VERTICAL"]).optional().default("HORIZONTAL"),
          colorMode: z.enum(["NONE", "BACKGROUND", "STRIP"]).optional().default("STRIP"),
          validUpto: z.string().optional(),
          printBack: z.boolean().optional().default(true),
        })
        .parse(req.body);

      const school = await db.school.findUnique({
        where: { id: req.user.schoolId },
        select: { name: true, address: true, phone: true, email: true },
      });
      if (!school) throw new AppError("School not found", 404);

      let where: any = {
        schoolId: req.user.schoolId,
        isActive: true,
      };

      if (data.userIds && data.userIds.length > 0) {
        where.id = { in: data.userIds };
      } else if (data.scope === "STUDENT" && data.studentId) {
        where.id = data.studentId;
      } else if (data.scope === "CLASS" && data.classId) {
        where.role = Role.STUDENT;
        where.studentProfile = { is: { classId: data.classId } };
      } else if (data.scope === "SECTION" && data.gradeLevelId) {
        where.role = Role.STUDENT;
        where.studentProfile = {
          is: {
            OR: [
              { gradeLevelId: data.gradeLevelId },
              { class: { is: { gradeLevelId: data.gradeLevelId } } },
            ],
          },
        };
      } else if (data.scope === "STAFF") {
        if (data.role) {
          where.role = data.role;
        } else {
          where.role = { in: [Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN] };
        }
      } else if (data.scope === "ALL") {
        where.role = Role.STUDENT;
      }

      const users = await db.user.findMany({
        where,
        take: 300,
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        include: {
          studentProfile: {
            include: {
              class: { include: { gradeLevel: true } },
              gradeLevel: true,
              house: true,
            },
          },
          teacherProfile: {
            include: {
              house: true,
            },
          },
          adminProfile: true,
        },
      });

      if (users.length === 0) {
        throw new AppError("No matching users found to generate ID cards", 404);
      }

      const currentYear = new Date().getFullYear();
      const defaultValid = data.validUpto || `${currentYear} - ${currentYear + 1}`;

      const persons: IdCardPerson[] = users.map((u) => {
        const idNumber =
          u.studentProfile?.admissionNumber ??
          u.teacherProfile?.employeeId ??
          u.adminProfile?.employeeId ??
          u.id.slice(0, 8).toUpperCase();

        const roleLabel = u.role.charAt(0) + u.role.slice(1).toLowerCase();

        const className = u.studentProfile?.class?.name ?? null;
        const gradeLevelName =
          u.studentProfile?.class?.gradeLevel?.name ??
          u.studentProfile?.gradeLevel?.name ??
          null;

        const house = u.studentProfile?.house ?? u.teacherProfile?.house ?? null;

        return {
          name: [u.firstName, u.middleName, u.lastName].filter(Boolean).join(" "),
          role: roleLabel,
          idNumber,
          className,
          gradeLevelName,
          gender: u.gender ?? null,
          dateOfBirth: u.dateOfBirth
            ? u.dateOfBirth.toISOString().split("T")[0]
            : null,
          phone: u.phone ?? null,
          email: u.email ?? null,
          rollNumber: u.studentProfile?.rollNumber ?? null,
          bloodGroup: u.studentProfile?.bloodGroup ?? null,
          emergencyPhone: u.emergencyPhone ?? null,
          validThrough: defaultValid,
          houseName: house?.value ?? null,
          houseColor: house?.colorHex ?? null,
          department: u.adminProfile?.department ?? u.teacherProfile?.specialization ?? null,
        };
      });

      const pdf = await generateBatchIdCardsPdf({
        school: {
          name: school.name,
          address: school.address,
          phone: school.phone,
          email: school.email,
        },
        persons,
        layout: data.layout,
        colorMode: data.colorMode,
        validUpto: defaultValid,
        printBack: data.printBack,
      });

      const filename = `id-cards-${data.scope.toLowerCase()}-${Date.now()}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(pdf);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
