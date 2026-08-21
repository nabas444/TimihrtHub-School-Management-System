import { describe, it, expect } from "vitest";
import { z } from "zod";

const createParentSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  middleName: z.string().optional().nullable(),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional().nullable(),
  password: z.string().min(6, "Password must be at least 6 characters").default("Welcome@123"),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  occupation: z.string().optional().nullable(),
  relation: z.string().optional().nullable(),
  annualIncome: z.string().optional().nullable(),
  education: z.string().optional().nullable(),
  linkedStudentIds: z.array(z.string().uuid()).optional(),
});

describe("Parent Module Dedicated Validations", () => {
  it("validates parent profile creation with linked students", () => {
    const validParent = {
      firstName: "Tewodros",
      lastName: "Kassaye",
      email: "tewodros.k@gmail.com",
      phone: "+251911445566",
      occupation: "Civil Engineer",
      relation: "Father",
      city: "Addis Ababa",
      linkedStudentIds: ["123e4567-e89b-12d3-a456-426614174000"],
    };

    const parsed = createParentSchema.parse(validParent);
    expect(parsed.firstName).toBe("Tewodros");
    expect(parsed.relation).toBe("Father");
    expect(parsed.linkedStudentIds?.length).toBe(1);
  });
});
