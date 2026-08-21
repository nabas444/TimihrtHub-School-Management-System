import { describe, it, expect } from "vitest";
import { z } from "zod";

const createCheckpointSchema = z.object({
  gradeLevelId: z.string().min(1, "Grade level is required"),
  academicYear: z.string().min(1, "Academic year is required"),
  name: z.string().min(1, "Name is required"),
  administeringBody: z.string().optional().nullable(),
  examWindowStart: z.string().datetime().optional().nullable(),
  examWindowEnd: z.string().datetime().optional().nullable(),
  passCutoff: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const bulkRegisterSchema = z.object({
  excludeStudentProfileIds: z.array(z.string()).optional().default([]),
  classId: z.string().optional(),
});

const recordResultSchema = z.object({
  score: z.number().optional().nullable(),
  grade: z.string().optional().nullable(),
  isPassing: z.boolean().optional().nullable(),
  resultDocumentUrl: z.string().optional().nullable(),
  resultPublishedAt: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
  registrationNumber: z.string().optional().nullable(),
  examCenter: z.string().optional().nullable(),
});

const bulkResultSchema = z.object({
  results: z.array(
    z.object({
      recordId: z.string().optional(),
      studentProfileId: z.string().optional(),
      registrationNumber: z.string().optional().nullable(),
      examCenter: z.string().optional().nullable(),
      score: z.number().optional().nullable(),
      grade: z.string().optional().nullable(),
      isPassing: z.boolean().optional().nullable(),
      resultDocumentUrl: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
      status: z.enum([
        "NOT_REGISTERED",
        "REGISTERED",
        "SAT",
        "ABSENT",
        "RESULT_PENDING",
        "RESULT_RECORDED",
      ]).optional(),
    }),
  ),
});

describe("External Exam Checkpoint & Record Validations", () => {
  it("validates external exam checkpoint creation", () => {
    const valid = {
      gradeLevelId: "gl-grade-6",
      academicYear: "2025/2026",
      name: "Grade 6 Regional Examination",
      administeringBody: "Regional Education Bureau",
      examWindowStart: new Date("2026-06-01T08:00:00.000Z").toISOString(),
      examWindowEnd: new Date("2026-06-05T17:00:00.000Z").toISOString(),
      passCutoff: 50,
      notes: "Mandatory regional exam for junior middle school placement",
    };

    const res = createCheckpointSchema.safeParse(valid);
    expect(res.success).toBe(true);
  });

  it("rejects checkpoint creation missing required gradeLevelId or academicYear", () => {
    const invalid = {
      name: "National Exam",
      academicYear: "2025/2026",
    };
    const res = createCheckpointSchema.safeParse(invalid);
    expect(res.success).toBe(false);
  });

  it("validates single candidate result recording", () => {
    const validResult = {
      score: 84.5,
      grade: "A",
      isPassing: true,
      registrationNumber: "REG-2026-0042",
      examCenter: "Bole Exam Center Hall B",
      notes: "Official certificate received",
    };
    expect(recordResultSchema.safeParse(validResult).success).toBe(true);
  });

  it("validates bulk results payload", () => {
    const validBulk = {
      results: [
        {
          studentProfileId: "sp-1",
          registrationNumber: "REG-001",
          score: 78,
          grade: "B",
          isPassing: true,
          status: "RESULT_RECORDED" as const,
        },
        {
          studentProfileId: "sp-2",
          registrationNumber: "REG-002",
          score: 42,
          grade: "D",
          isPassing: false,
          status: "RESULT_RECORDED" as const,
        },
      ],
    };
    expect(bulkResultSchema.safeParse(validBulk).success).toBe(true);
  });
});
