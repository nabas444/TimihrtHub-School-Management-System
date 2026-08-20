import { describe, it, expect } from "vitest";
import {
  generateCumulativeReportCardPdf,
  generateCertificatePdf,
  CumulativeReportCardData,
  CertificatePdfData,
} from "../pdf";

describe("Cumulative Report Card & Certificate PDF Generators", () => {
  const school = {
    name: "TimhirtHub International Academy",
    address: "Addis Ababa, Ethiopia",
    phone: "+251 11 123 4567",
    email: "admin@timhirthub.edu.et",
  };

  it("generates a valid One-Sided Cumulative Report Card PDF buffer", async () => {
    const data: CumulativeReportCardData = {
      school,
      student: {
        name: "Abel Kebede",
        admissionNumber: "ADM-2026-001",
        rollNumber: "12",
        className: "Grade 10-A",
        gradeLevelName: "Secondary",
        gender: "MALE",
      },
      academicYear: "2024/2025",
      summary: {
        overallAverage: 88.5,
        overallRank: 1,
        classSize: 35,
        isPassing: true,
        passMarkPercentage: 50,
        termBreakdown: [
          {
            termName: "Term 1",
            percentage: 86.0,
            gpa: 3.7,
            rank: 2,
          },
          {
            termName: "Term 2",
            percentage: 91.0,
            gpa: 4.0,
            rank: 1,
          },
        ],
      },
      homeroomTeacherName: "Tigist Haile",
      principalName: "Dr. Almaz Bekele",
      layout: "ONE_SIDED",
    };

    const buffer = await generateCumulativeReportCardPdf(data);
    expect(buffer).toBeDefined();
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it("generates a valid Two-Sided Expanded Cumulative Report Card PDF buffer", async () => {
    const data: CumulativeReportCardData = {
      school,
      student: {
        name: "Bethlehem Tadesse",
        admissionNumber: "ADM-2026-042",
        className: "Grade 11-B",
      },
      academicYear: "2024/2025",
      summary: {
        overallAverage: 78.2,
        overallRank: 5,
        classSize: 32,
        isPassing: true,
        termBreakdown: [
          { termName: "Semester 1", percentage: 76.5, gpa: 3.3, rank: 6 },
          { termName: "Semester 2", percentage: 80.0, gpa: 3.7, rank: 4 },
        ],
      },
      layout: "TWO_SIDED",
      backSideDetails: {
        recentTermName: "Semester 2",
        subjects: [
          { subjectName: "Mathematics", marksObtained: 88, totalMarks: 100, grade: "A" },
          { subjectName: "Physics", marksObtained: 74, totalMarks: 100, grade: "B" },
          { subjectName: "English", marksObtained: 82, totalMarks: 100, grade: "A" },
        ],
        teacherComments: "Excellent participation and analytical problem-solving skills throughout the semester.",
        attendanceSummary: {
          totalDays: 120,
          presentDays: 118,
          absentDays: 2,
          lateDays: 1,
          attendancePercentage: 98,
        },
      },
    };

    const buffer = await generateCumulativeReportCardPdf(data);
    expect(buffer).toBeDefined();
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1500);
  });

  it("generates a valid Certificate of Recognition PDF buffer", async () => {
    const certData: CertificatePdfData = {
      school,
      certificate: {
        id: "cert-recog-12345",
        type: "RECOGNITION",
        recipientType: "STUDENT",
        recipientName: "Dawit Yohannes",
        recipientIdNumber: "ADM-2026-088",
        className: "Grade 12-A",
        academicYear: "2024/2025",
        title: "Certificate of Academic Excellence",
        reason: "For achieving highest cumulative average in mathematics and natural sciences.",
        issueDate: new Date(),
        layout: "ONE_SIDED",
        signerName: "Dr. Almaz Bekele",
        signerTitle: "Head of School",
        homeroomTeacherName: "Yared Molla",
      },
    };

    const buffer = await generateCertificatePdf(certData);
    expect(buffer).toBeDefined();
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it("generates a valid Certificate of Graduation PDF buffer with two-sided attestation", async () => {
    const certData: CertificatePdfData = {
      school,
      certificate: {
        id: "cert-grad-67890",
        type: "GRADUATION",
        recipientType: "STUDENT",
        recipientName: "Selamawit Alemayehu",
        recipientIdNumber: "ADM-2026-015",
        className: "Grade 12-Science",
        academicYear: "2024/2025",
        title: "Certificate of Graduation",
        issueDate: new Date(),
        layout: "TWO_SIDED",
        signerName: "Dr. Almaz Bekele",
        signerTitle: "Director",
      },
      backSideDetails: {
        academicSummary: {
          overallAverage: 92.4,
          overallRank: 1,
          classSize: 45,
          termBreakdown: [
            { termName: "Semester 1", percentage: 91.5, rank: 2 },
            { termName: "Semester 2", percentage: 93.3, rank: 1 },
          ],
        },
        extendedCitation: "Completed secondary education curriculum with distinction honours.",
      },
    };

    const buffer = await generateCertificatePdf(certData);
    expect(buffer).toBeDefined();
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1500);
  });
});
