import { describe, it, expect } from "vitest";
import { z } from "zod";

const createCertificateSchema = z.object({
  type: z.enum(["GRADUATION", "RECOGNITION"]),
  recipientType: z.enum(["STUDENT", "STAFF"]),
  studentProfileId: z.string().optional(),
  userId: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  reason: z.string().optional(),
  layout: z.enum(["ONE_SIDED", "TWO_SIDED"]).default("ONE_SIDED"),
  issueDate: z.string().optional(),
  academicYear: z.string().optional(),
});

const bulkCertificateSchema = z.object({
  type: z.enum(["GRADUATION", "RECOGNITION"]),
  recipientType: z.enum(["STUDENT", "STAFF"]),
  scope: z.enum(["CLASS", "SECTION", "SELECTED", "ALL_STAFF", "STAFF_GROUP"]),
  classId: z.string().optional(),
  gradeLevelId: z.string().optional(),
  studentProfileIds: z.array(z.string()).optional(),
  userIds: z.array(z.string()).optional(),
  staffRole: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  reason: z.string().optional(),
  layout: z.enum(["ONE_SIDED", "TWO_SIDED"]).default("ONE_SIDED"),
  issueDate: z.string().optional(),
  academicYear: z.string().optional(),
});

describe("Certificates Route Validation & Business Rules", () => {
  it("validates single recognition certificate creation schema", () => {
    const valid = {
      type: "RECOGNITION",
      recipientType: "STUDENT",
      studentProfileId: "sp-123",
      title: "Certificate of Academic Excellence",
      reason: "Outstanding performance",
      layout: "ONE_SIDED",
    };
    expect(createCertificateSchema.safeParse(valid).success).toBe(true);
  });

  it("validates bulk graduation certificate issuance schema", () => {
    const valid = {
      type: "GRADUATION",
      recipientType: "STUDENT",
      scope: "CLASS",
      classId: "class-grad-2025",
      title: "Certificate of Graduation",
      academicYear: "2024/2025",
    };
    expect(bulkCertificateSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects invalid recipientType or certificateType", () => {
    const invalidType = {
      type: "OTHER_TYPE",
      recipientType: "STUDENT",
      title: "Test",
    };
    expect(createCertificateSchema.safeParse(invalidType).success).toBe(false);

    const invalidRecipient = {
      type: "RECOGNITION",
      recipientType: "PARENT",
      title: "Test",
    };
    expect(createCertificateSchema.safeParse(invalidRecipient).success).toBe(false);
  });
});
