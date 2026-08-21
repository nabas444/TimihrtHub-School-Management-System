import { describe, it, expect } from "vitest";
import { z } from "zod";

const createCeremonyEventSchema = z.object({
  gradeLevelId: z.string().optional().nullable(),
  type: z.enum(["GRADUATION", "COMPLETION", "OTHER"]).default("GRADUATION"),
  academicYear: z.string().min(1, "Academic year is required"),
  title: z.string().min(1, "Title is required"),
  ceremonyDate: z.string().datetime().optional().nullable(),
  venue: z.string().optional().nullable(),
  attireNote: z.string().optional().nullable(),
  program: z.string().optional().nullable(),
});

const bulkEnrollSchema = z.object({
  classId: z.string().optional(),
  gradeLevelId: z.string().optional(),
  studentProfileIds: z.array(z.string()).optional(),
});

describe("Ceremony & Graduation Event Validations", () => {
  it("validates ceremony event creation payload", () => {
    const valid = {
      gradeLevelId: "gl-kg-final",
      type: "GRADUATION" as const,
      academicYear: "2025/2026",
      title: "Kindergarten Cap & Gown Graduation 2026",
      ceremonyDate: new Date("2026-06-20T09:00:00.000Z").toISOString(),
      venue: "Grand Hall, Main Campus",
      attireNote: "Cap and gown provided by school",
      program: "1. Welcome Address\n2. Principal Keynote\n3. Award of Certificates\n4. Closing Photo",
    };

    expect(createCeremonyEventSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects ceremony event missing academicYear or title", () => {
    const invalid = {
      venue: "Main Hall",
    };
    expect(createCeremonyEventSchema.safeParse(invalid).success).toBe(false);
  });

  it("validates bulk participant enrollment payload", () => {
    const valid = {
      classId: "class-kg-a",
      studentProfileIds: ["sp-1", "sp-2", "sp-3"],
    };
    expect(bulkEnrollSchema.safeParse(valid).success).toBe(true);
  });
});
