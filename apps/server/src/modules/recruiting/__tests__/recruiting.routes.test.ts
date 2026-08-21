import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import {
  EmploymentType,
  RequisitionStatus,
  PostingStatus,
  SalaryType,
  ApplicationStage,
  InterviewFormat,
  InterviewRecommendation,
  OfferStatus,
} from "@prisma/client";
import { generateJobPostingFlyerPdf, JobPostingFlyerData } from "../../../utils/pdf";

const ALLOWED_PLATFORMS = [
  "linkedin",
  "whatsapp",
  "telegram",
  "facebook",
  "x",
  "instagram",
  "website",
  "other",
] as const;

const socialLinkSchema = z.object({
  platform: z.enum(ALLOWED_PLATFORMS),
  label: z.string().optional().nullable(),
  url: z.string().url("Must be a valid URL"),
});

const createPostingSchema = z.object({
  title: z.string().min(2, "Title is required"),
  requisitionId: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  positionId: z.string().optional().nullable(),
  employmentType: z.nativeEnum(EmploymentType).default(EmploymentType.FULL_TIME),
  location: z.string().optional().nullable(),
  description: z.string().min(10, "Job description is required"),
  requirements: z.string().optional().nullable(),
  benefits: z.string().optional().nullable(),
  salaryType: z.nativeEnum(SalaryType).default(SalaryType.RANGE),
  salaryRange: z.string().optional().nullable(),
  salaryFixedAmount: z.number().positive().optional().nullable(),
  salaryCurrency: z.string().default("USD").optional().nullable(),
  closingDate: z.string().optional().nullable(),
  publishNow: z.boolean().default(false),

  // Marketing Flyer Fields
  bannerImageUrl: z.string().optional().nullable(),
  companyTagline: z.string().optional().nullable(),
  applicationDeadlineNote: z.string().optional().nullable(),
  socialLinks: z.array(socialLinkSchema).optional().nullable(),
  flyerTheme: z.string().default("default").optional().nullable(),
  contactEmail: z.string().email().optional().nullable().or(z.literal("")),
  contactPhone: z.string().optional().nullable(),
});

describe("Recruiting Module — Rich Marketing & Flyer Enhancements", () => {
  describe("SalaryType and Posting Validation", () => {
    it("validates FIXED salaryType with positive amount", () => {
      const payload = {
        title: "Head of Primary Mathematics",
        description: "Leading the primary math instructional curriculum and mentoring teachers.",
        salaryType: SalaryType.FIXED,
        salaryFixedAmount: 35000,
        salaryCurrency: "ETB",
        companyTagline: "Nurturing tomorrow's mathematicians",
        bannerImageUrl: "https://res.cloudinary.com/demo/image/upload/banner.png",
      };

      const parsed = createPostingSchema.parse(payload);
      expect(parsed.salaryType).toBe(SalaryType.FIXED);
      expect(parsed.salaryFixedAmount).toBe(35000);
      expect(parsed.salaryCurrency).toBe("ETB");
      expect(parsed.bannerImageUrl).toBe("https://res.cloudinary.com/demo/image/upload/banner.png");
    });

    it("validates RANGE salaryType", () => {
      const payload = {
        title: "High School Chemistry Instructor",
        description: "AP and General Chemistry teacher for Grade 9-12 classes.",
        salaryType: SalaryType.RANGE,
        salaryRange: "28,000 - 38,000 ETB / month",
      };

      const parsed = createPostingSchema.parse(payload);
      expect(parsed.salaryType).toBe(SalaryType.RANGE);
      expect(parsed.salaryRange).toBe("28,000 - 38,000 ETB / month");
    });

    it("validates NEGOTIABLE and UNDISCLOSED salaryType without amount constraints", () => {
      const negotiable = createPostingSchema.parse({
        title: "Executive School Director",
        description: "Overall leadership and strategic direction for international academy.",
        salaryType: SalaryType.NEGOTIABLE,
      });
      expect(negotiable.salaryType).toBe(SalaryType.NEGOTIABLE);

      const undisclosed = createPostingSchema.parse({
        title: "School Nurse & Health Officer",
        description: "First aid, emergency response, and preventative health checks for students.",
        salaryType: SalaryType.UNDISCLOSED,
      });
      expect(undisclosed.salaryType).toBe(SalaryType.UNDISCLOSED);
    });

    it("validates socialLinks allowed platforms and rejects invalid platforms", () => {
      const validLinks = [
        { platform: "linkedin", url: "https://linkedin.com/school/timhirthub" },
        { platform: "telegram", url: "https://t.me/timhirthub" },
        { platform: "whatsapp", url: "https://wa.me/251911223344" },
        { platform: "website", url: "https://timhirthub.edu.et" },
      ];

      const parsed = createPostingSchema.parse({
        title: "Biology Teacher",
        description: "Teaching IGCSE Biology to secondary students.",
        socialLinks: validLinks,
      });
      expect(parsed.socialLinks).toHaveLength(4);

      // Invalid platform
      expect(() => {
        createPostingSchema.parse({
          title: "Biology Teacher",
          description: "Teaching IGCSE Biology to secondary students.",
          socialLinks: [{ platform: "myspace", url: "https://myspace.com/test" }],
        });
      }).toThrow();

      // Invalid URL
      expect(() => {
        createPostingSchema.parse({
          title: "Biology Teacher",
          description: "Teaching IGCSE Biology to secondary students.",
          socialLinks: [{ platform: "linkedin", url: "not-a-valid-url" }],
        });
      }).toThrow();
    });
  });

  describe("Public Job Board & Detail Salary Display Logic", () => {
    const formatPublicSalary = (p: {
      salaryType: string;
      salaryFixedAmount?: number | null;
      salaryCurrency?: string | null;
      salaryRange?: string | null;
    }) => {
      if (p.salaryType === "FIXED") {
        return `${p.salaryFixedAmount?.toLocaleString()} ${p.salaryCurrency || "USD"}`;
      }
      if (p.salaryType === "RANGE") {
        return p.salaryRange || "Competitive";
      }
      if (p.salaryType === "NEGOTIABLE") {
        return "Negotiable";
      }
      return null; // UNDISCLOSED is omitted
    };

    it("correctly hides salary for UNDISCLOSED postings", () => {
      const res = formatPublicSalary({
        salaryType: "UNDISCLOSED",
        salaryRange: "Secret 50k",
        salaryFixedAmount: 50000,
      });
      expect(res).toBeNull();
    });

    it("displays 'Negotiable' for NEGOTIABLE postings", () => {
      const res = formatPublicSalary({ salaryType: "NEGOTIABLE" });
      expect(res).toBe("Negotiable");
    });

    it("displays formatted amount + currency for FIXED postings", () => {
      const res = formatPublicSalary({
        salaryType: "FIXED",
        salaryFixedAmount: 32500,
        salaryCurrency: "ETB",
      });
      expect(res).toBe("32,500 ETB");
    });

    it("displays range text for RANGE postings", () => {
      const res = formatPublicSalary({
        salaryType: "RANGE",
        salaryRange: "20,000 - 30,000 ETB",
      });
      expect(res).toBe("20,000 - 30,000 ETB");
    });
  });

  describe("Public Posting Availability (404 Logic)", () => {
    const isPostingAvailable = (posting: {
      status: string;
      closingDate: Date | null;
    }) => {
      if (posting.status !== PostingStatus.PUBLISHED) return false;
      if (posting.closingDate && posting.closingDate < new Date()) return false;
      return true;
    };

    it("rejects DRAFT postings with 404 condition", () => {
      expect(
        isPostingAvailable({
          status: PostingStatus.DRAFT,
          closingDate: null,
        }),
      ).toBe(false);
    });

    it("rejects closed/expired postings with 404 condition", () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      expect(
        isPostingAvailable({
          status: PostingStatus.PUBLISHED,
          closingDate: pastDate,
        }),
      ).toBe(false);
    });

    it("accepts active published postings", () => {
      const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      expect(
        isPostingAvailable({
          status: PostingStatus.PUBLISHED,
          closingDate: futureDate,
        }),
      ).toBe(true);
    });
  });

  describe("Marketing Flyer PDF Generator", () => {
    it("generates a valid PDF buffer with embedded QR code", async () => {
      const school = {
        name: "TimhirtHub International Academy",
        address: "Bole Sub-City, Addis Ababa",
        phone: "+251 96 608 0363",
        email: "careers@timhirthub.edu.et",
      };

      const posting: JobPostingFlyerData = {
        title: "Lead ICT & Computer Science Instructor",
        slug: "lead-ict-instructor-a1b2",
        companyTagline: "Pioneering STEM Excellence in East Africa",
        employmentType: "FULL_TIME",
        location: "Main Campus, Building B",
        description:
          "We are seeking an inspiring Lead Computer Science Instructor to teach algorithms, web development, and computational thinking across grades 9 through 12. The candidate will lead our state-of-the-art robotics lab.",
        requirements:
          "• Bachelor's or Master's degree in Computer Science or Software Engineering\n• Minimum 3 years teaching experience\n• Proficiency in Python and JavaScript",
        benefits:
          "• Competitive salary + Annual performance bonus\n• Comprehensive health insurance for employee and dependents\n• 100% tuition discount for up to two children",
        salaryType: "RANGE",
        salaryRange: "30,000 - 45,000 ETB / month",
        closingDate: new Date("2026-10-31"),
        applicationDeadlineNote: "Interviews scheduled on rolling basis",
        socialLinks: [
          { platform: "linkedin", url: "https://linkedin.com/school/timhirthub" },
          { platform: "telegram", url: "https://t.me/timhirthub" },
        ],
        contactEmail: "careers@timhirthub.edu.et",
        contactPhone: "+251 96 608 0363",
      };

      const publicUrl = "https://timhirthub.edu.et/careers/timhirthub-academy/lead-ict-instructor-a1b2";

      const pdfBuffer = await generateJobPostingFlyerPdf(school, posting, publicUrl);

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(1000);

      // Verify PDF magic header %PDF
      const header = pdfBuffer.slice(0, 4).toString("utf-8");
      expect(header).toBe("%PDF");
    });
  });

  describe("Telegram Announcement Trigger Logic", () => {
    it("fires telegram enqueue only when transitioning from non-PUBLISHED to PUBLISHED", () => {
      const shouldEnqueueTelegram = (
        existingStatus: PostingStatus | null,
        newPublishNow: boolean,
        newStatus?: PostingStatus,
      ) => {
        if (!existingStatus) {
          // Brand new posting
          return newPublishNow === true;
        }
        // Updating existing posting
        const isTransitioning =
          existingStatus !== PostingStatus.PUBLISHED &&
          (newPublishNow === true || newStatus === PostingStatus.PUBLISHED);
        return isTransitioning;
      };

      // 1. Newly created with publishNow: true -> SHOULD fire
      expect(shouldEnqueueTelegram(null, true)).toBe(true);

      // 2. Newly created as DRAFT (publishNow: false) -> SHOULD NOT fire
      expect(shouldEnqueueTelegram(null, false)).toBe(false);

      // 3. Updating a DRAFT to PUBLISHED -> SHOULD fire
      expect(shouldEnqueueTelegram(PostingStatus.DRAFT, true)).toBe(true);
      expect(shouldEnqueueTelegram(PostingStatus.DRAFT, false, PostingStatus.PUBLISHED)).toBe(true);

      // 4. Updating an already PUBLISHED posting -> SHOULD NOT fire again
      expect(shouldEnqueueTelegram(PostingStatus.PUBLISHED, true)).toBe(false);
      expect(shouldEnqueueTelegram(PostingStatus.PUBLISHED, false, PostingStatus.PUBLISHED)).toBe(false);
    });
  });
});
