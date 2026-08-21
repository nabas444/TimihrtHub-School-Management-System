import { describe, it, expect } from "vitest";
import { z } from "zod";
import { EmploymentType, EmployeeStatus, EmployeeDocumentType, StaffDisciplinaryType } from "@prisma/client";

const createEmployeeSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  middleName: z.string().optional().nullable(),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  nationalId: z.string().optional().nullable(),
  hireDate: z.string().optional().nullable(),
  employmentType: z.nativeEnum(EmploymentType).default(EmploymentType.FULL_TIME),
  status: z.nativeEnum(EmployeeStatus).default(EmployeeStatus.ACTIVE),
  departmentId: z.string().optional().nullable(),
  positionId: z.string().optional().nullable(),
  managerId: z.string().optional().nullable(),
  salary: z.number().optional().nullable(),
  contractStart: z.string().optional().nullable(),
  contractEnd: z.string().optional().nullable(),
  probationEnd: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  emergencyContact: z.string().optional().nullable(),
  emergencyPhone: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  bankAccountNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  employeeNumber: z.string().optional().nullable(),
  createOnboardingChecklist: z.boolean().default(true),
});

const createDocumentSchema = z.object({
  type: z.nativeEnum(EmployeeDocumentType).default(EmployeeDocumentType.OTHER),
  title: z.string().min(1, "Document title is required"),
  documentNumber: z.string().optional().nullable(),
  fileUrl: z.string().min(1, "Document file URL is required"),
  fileSize: z.number().optional().nullable(),
  mimeType: z.string().optional().nullable(),
  issueDate: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  reminderDays: z.number().default(30),
  notes: z.string().optional().nullable(),
});

describe("Employee HR Schema and Workflow Validations", () => {
  it("validates employee creation with non-portal employee (no user account required)", () => {
    const validStaff = {
      firstName: "Abebe",
      lastName: "Bekele",
      email: "abebe.nurse@timhirthub.edu.et",
      phone: "+251911223344",
      employmentType: EmploymentType.FULL_TIME,
      status: EmployeeStatus.ACTIVE,
      salary: 18500,
      hireDate: "2026-09-01",
    };

    const parsed = createEmployeeSchema.parse(validStaff);
    expect(parsed.firstName).toBe("Abebe");
    expect(parsed.employmentType).toBe("FULL_TIME");
    expect(parsed.status).toBe("ACTIVE");
    expect(parsed.createOnboardingChecklist).toBe(true);
  });

  it("validates document vault schema with expiry tracking", () => {
    const validDoc = {
      type: EmployeeDocumentType.TEACHING_LICENSE,
      title: "National Professional Teaching License",
      documentNumber: "LIC-ETH-2026-889",
      fileUrl: "https://storage.timhirthub.com/docs/license-abebe.pdf",
      expiryDate: "2028-09-01",
      reminderDays: 60,
    };

    const parsed = createDocumentSchema.parse(validDoc);
    expect(parsed.type).toBe("TEACHING_LICENSE");
    expect(parsed.reminderDays).toBe(60);
  });
});
