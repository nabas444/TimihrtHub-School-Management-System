import { Router } from "express";
import * as AcademicsController from "./academics.controller";
import { authorize } from "../../middleware/auth";
import { Role } from "@prisma/client";

const router = Router();
const isAdmin = [Role.ADMIN, Role.SUPER_ADMIN];
const isStaff = [Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER];

// Subjects
router.get("/subjects", AcademicsController.listSubjects);
router.post(
  "/subjects",
  authorize(...isAdmin),
  AcademicsController.createSubject,
);
router.patch(
  "/subjects/:id",
  authorize(...isAdmin),
  AcademicsController.updateSubject,
);
router.delete(
  "/subjects/:id",
  authorize(...isAdmin),
  AcademicsController.deleteSubject,
);

// Classes
router.get("/classes", AcademicsController.listClasses);
router.get("/classes/:id", authorize(...isAdmin), AcademicsController.getClass);
router.post("/classes", authorize(...isAdmin), AcademicsController.createClass);
router.patch(
  "/classes/:id",
  authorize(...isAdmin),
  AcademicsController.updateClass,
);
router.delete(
  "/classes/:id",
  authorize(...isAdmin),
  AcademicsController.deleteClass,
);

// Terms
router.get("/terms", AcademicsController.listTerms);
router.post("/terms", authorize(...isAdmin), AcademicsController.createTerm);

// Assignments
router.get("/assignments", AcademicsController.listAssignments);
router.post(
  "/assignments",
  authorize(...isStaff),
  AcademicsController.createAssignment,
);
router.get("/assignments/:id", AcademicsController.getAssignment);
router.patch(
  "/assignments/:id",
  authorize(...isStaff),
  AcademicsController.updateAssignment,
);
router.delete(
  "/assignments/:id",
  authorize(...isStaff),
  AcademicsController.deleteAssignment,
);
router.post(
  "/assignments/:id/submit",
  authorize(Role.STUDENT),
  AcademicsController.submitAssignment,
);
router.patch(
  "/assignments/submissions/:submissionId/grade",
  authorize(...isStaff),
  AcademicsController.gradeSubmission,
);

// Exams
router.get("/exams", AcademicsController.listExams);
router.post("/exams", authorize(...isStaff), AcademicsController.createExam);
router.patch(
  "/exams/:id",
  authorize(...isStaff),
  AcademicsController.updateExam,
);
router.delete(
  "/exams/:id",
  authorize(...isAdmin),
  AcademicsController.deleteExam,
);
router.patch(
  "/exams/:id/publish",
  authorize(...isAdmin),
  AcademicsController.publishExam,
);
router.post(
  "/exams/:id/results",
  authorize(...isStaff),
  AcademicsController.recordResults,
);

// Results
router.get("/results", AcademicsController.getStudentResults); // own results (student) or first child (parent)
router.get(
  "/results/:studentId",
  authorize(...isStaff, Role.PARENT),
  AcademicsController.getStudentResults,
); // any student (staff) or linked child (parent)

// Parent's linked children
router.get(
  "/parent/children",
  authorize(Role.PARENT),
  AcademicsController.getParentChildren,
);

// Grade reports
router.post(
  "/reports/generate",
  authorize(...isStaff),
  AcademicsController.generateReport,
);
router.post(
  "/reports/publish",
  authorize(...isAdmin),
  AcademicsController.publishReport,
);
router.post(
  "/reports/rankings",
  authorize(...isStaff),
  AcademicsController.computeRankings,
);
router.get(
  "/insights/performance",
  authorize(...isStaff),
  AcademicsController.getPerformanceInsights,
);

// Printable documents
router.get("/reports/pdf", AcademicsController.downloadReportCard); // own report card (student/parent viewing own child)
router.get(
  "/reports/:studentId/pdf",
  authorize(...isStaff, Role.PARENT),
  AcademicsController.downloadReportCard,
); // student report card (staff or parent)
router.get(
  "/exams/:id/marksheet",
  authorize(...isStaff),
  AcademicsController.downloadMarkSheet,
);

// Teacher Class Roster & Results Recording
router.get(
  "/teacher-assignments",
  authorize(...isStaff),
  AcademicsController.getTeacherAssignments,
);
router.get(
  "/roster",
  authorize(...isStaff),
  AcademicsController.getClassGradeRoster,
);
router.post(
  "/roster",
  authorize(...isStaff),
  AcademicsController.saveClassGradeRoster,
);
router.post(
  "/roster/submit",
  authorize(...isStaff),
  AcademicsController.submitClassRosterToAdmin,
);

// Comprehensive Master Cumulative Roster & Report Card Distribution
router.get(
  "/master-roster",
  authorize(...isStaff),
  AcademicsController.getMasterClassRoster,
);
router.post(
  "/master-roster/distribute",
  authorize(...isAdmin),
  AcademicsController.distributeClassGradeReports,
);

export default router;

