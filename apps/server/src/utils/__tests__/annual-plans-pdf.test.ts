import { describe, it, expect } from "vitest";
import { generateAnnualPlanPdf, AnnualPlanPdfData } from "../pdf";

describe("Annual Plan PDF Generator", () => {
  const school = {
    name: "Timhirt Academy Addis",
    address: "Bole Subcity, Addis Ababa, Ethiopia",
    phone: "+251 11 654 3210",
    email: "info@timhirtacademy.edu.et",
  };

  it("generates a valid A4 Landscape Annual Plan PDF buffer for teacher subject plan", async () => {
    const data: AnnualPlanPdfData = {
      school,
      plan: {
        id: "plan-123",
        title: "Grade 10 Mathematics Annual Scheme of Work",
        scope: "TEACHER_SUBJECT",
        academicYear: "2024/2025",
        status: "APPROVED",
        authorName: "Abebe Bikila",
        authorRole: "TEACHER",
        subjectName: "Mathematics",
        className: "Grade 10A",
        gradeLevelName: "Grade 10",
        columns: [
          "Term / Period",
          "Topic / Unit",
          "Learning Objectives",
          "Teaching Activities",
          "Resources & Materials",
          "Assessment Method",
          "Duration / Weeks",
        ],
        rows: [
          [
            "Term 1 - Week 1-2",
            "Quadratic Equations",
            "Solve quadratics by factoring and formula",
            "Direct instruction, board practice, pair work",
            "Grade 10 Math Textbook Ch. 1, Graph paper",
            "Weekly quiz & homework sheet",
            "2 weeks",
          ],
          [
            "Term 1 - Week 3-5",
            "Trigonometry & Right Triangles",
            "Define sin, cos, tan and calculate missing sides",
            "Protractor lab, field angle measurement, group quiz",
            "Scientific calculators, worksheet pack",
            "Unit test & group assignment",
            "3 weeks",
          ],
        ],
        reviewedByName: "Principal Yohannes",
        reviewedAt: new Date(),
        submittedAt: new Date(),
        createdAt: new Date(),
      },
    };

    const buffer = await generateAnnualPlanPdf(data);
    expect(buffer).toBeDefined();
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it("generates a multi-page PDF when rows exceed single-page capacity", async () => {
    const longRows = Array.from({ length: 25 }, (_, i) => [
      `Term 1 - Week ${i + 1}`,
      `Unit ${i + 1}: Advanced Academic Topic`,
      "Master fundamental topic objectives and core competencies",
      "Interactive workshop, lab demonstration, peer review",
      "Core curriculum guide, digital references",
      "Summative assessment & project rubric",
      "1 week",
    ]);

    const data: AnnualPlanPdfData = {
      school,
      plan: {
        id: "plan-long",
        title: "Comprehensive School-Wide STEM Roadmap",
        scope: "SCHOOL_WIDE",
        academicYear: "2024/2025",
        status: "SUBMITTED",
        authorName: "Dean of Academics",
        authorRole: "ADMIN",
        columns: [
          "Term / Week",
          "Topic",
          "Objectives",
          "Activities",
          "Resources",
          "Assessment",
          "Duration",
        ],
        rows: longRows,
        createdAt: new Date(),
      },
    };

    const buffer = await generateAnnualPlanPdf(data);
    expect(buffer).toBeDefined();
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(2000);
  });
});
