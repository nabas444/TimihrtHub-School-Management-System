import { describe, it, expect } from "vitest";
import { z } from "zod";

const generateSchema = z.object({
  classId: z.string().min(1, "Class ID is required"),
  academicYear: z.string().optional(),
});

const publishSchema = z.object({
  isPublished: z.boolean(),
});

describe("Report Cards & Academic Year Summaries Schema Validation", () => {
  it("validates summary generation payload", () => {
    const valid = { classId: "class-123", academicYear: "2024/2025" };
    expect(generateSchema.safeParse(valid).success).toBe(true);

    const invalid = { classId: "" };
    expect(generateSchema.safeParse(invalid).success).toBe(false);
  });

  it("validates publish status payload", () => {
    const validTrue = { isPublished: true };
    expect(publishSchema.safeParse(validTrue).success).toBe(true);

    const validFalse = { isPublished: false };
    expect(publishSchema.safeParse(validFalse).success).toBe(true);

    const invalid = { isPublished: "yes" };
    expect(publishSchema.safeParse(invalid).success).toBe(false);
  });
});
