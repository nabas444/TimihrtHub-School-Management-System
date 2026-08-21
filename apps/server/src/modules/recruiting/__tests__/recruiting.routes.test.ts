import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  EmploymentType,
  RequisitionStatus,
  PostingStatus,
  ApplicationStage,
  InterviewFormat,
  InterviewRecommendation,
  OfferStatus,
} from "@prisma/client";

const createRequisitionSchema = z.object({
  title: z.string().min(2, "Job title is required"),
  departmentId: z.string().optional().nullable(),
  positionId: z.string().optional().nullable(),
  vacanciesCount: z.number().min(1).default(1),
  employmentType: z.nativeEnum(EmploymentType).default(EmploymentType.FULL_TIME),
  reason: z.string().optional().nullable(),
  salaryMin: z.number().optional().nullable(),
  salaryMax: z.number().optional().nullable(),
  description: z.string().optional().nullable(),
  justification: z.string().optional().nullable(),
  targetStartDate: z.string().optional().nullable(),
  autoApprove: z.boolean().default(false),
});

const applyJobSchema = z.object({
  candidateName: z.string().min(2, "Full name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional().nullable(),
  resumeUrl: z.string().optional().nullable(),
  coverLetter: z.string().optional().nullable(),
  portfolioUrl: z.string().optional().nullable(),
  experienceYears: z.number().optional().nullable(),
  currentEmployer: z.string().optional().nullable(),
  highestEducation: z.string().optional().nullable(),
});

const submitFeedbackSchema = z.object({
  score: z.number().min(1).max(5),
  recommendation: z.nativeEnum(InterviewRecommendation).default(InterviewRecommendation.HOLD),
  criteriaScores: z.any().optional(),
  strengths: z.string().optional().nullable(),
  concerns: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const createOfferSchema = z.object({
  positionTitle: z.string().min(1, "Position title required"),
  departmentName: z.string().optional().nullable(),
  employmentType: z.nativeEnum(EmploymentType).default(EmploymentType.FULL_TIME),
  offeredSalary: z.number().min(0, "Salary required"),
  salaryPeriod: z.enum(["MONTHLY", "ANNUAL"]).default("MONTHLY"),
  startDate: z.string().min(1, "Start date required"),
  probationMonths: z.number().default(3),
  benefits: z.string().optional().nullable(),
  conditions: z.string().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

describe("Recruiting Pipeline Validations", () => {
  it("validates job requisition creation", () => {
    const valid = {
      title: "Senior Physics Teacher",
      vacanciesCount: 2,
      employmentType: EmploymentType.FULL_TIME,
      salaryMin: 20000,
      salaryMax: 28000,
      reason: "EXPANSION",
      description: "Looking for experienced high school physics instructor",
    };

    const parsed = createRequisitionSchema.parse(valid);
    expect(parsed.title).toBe("Senior Physics Teacher");
    expect(parsed.vacanciesCount).toBe(2);
    expect(parsed.autoApprove).toBe(false);
  });

  it("validates public application submission without user login", () => {
    const validApp = {
      candidateName: "Almaz Kebede",
      email: "almaz.kebede@gmail.com",
      phone: "+251922334455",
      experienceYears: 6.5,
      highestEducation: "Master of Education in Physics",
      currentEmployer: "St. Joseph School",
      resumeUrl: "https://storage.timhirthub.com/resumes/almaz-cv.pdf",
    };

    const parsed = applyJobSchema.parse(validApp);
    expect(parsed.candidateName).toBe("Almaz Kebede");
    expect(parsed.email).toBe("almaz.kebede@gmail.com");
  });

  it("validates interview feedback and job offer terms", () => {
    const feedback = {
      score: 4.8,
      recommendation: InterviewRecommendation.STRONG_HIRE,
      criteriaScores: { subjectKnowledge: 5, pedagogy: 5, communication: 4.5 },
      strengths: "Excellent demonstration lecture on thermodynamics",
    };

    const parsedFeedback = submitFeedbackSchema.parse(feedback);
    expect(parsedFeedback.recommendation).toBe("STRONG_HIRE");

    const offer = {
      positionTitle: "Senior Physics Teacher",
      departmentName: "Science & Technology",
      employmentType: EmploymentType.FULL_TIME,
      offeredSalary: 26000,
      startDate: "2026-09-01",
      probationMonths: 3,
      benefits: "Health insurance, housing allowance, tuition waiver for children",
    };

    const parsedOffer = createOfferSchema.parse(offer);
    expect(parsedOffer.offeredSalary).toBe(26000);
    expect(parsedOffer.probationMonths).toBe(3);
  });
});
