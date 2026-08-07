import { Router } from 'express';
import * as AcademicsController from './academics.controller';
import { authorize } from '../../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();
const isAdmin = [Role.ADMIN, Role.SUPER_ADMIN];
const isStaff = [Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER];

// Subjects
router.get('/subjects', AcademicsController.listSubjects);
router.post('/subjects', authorize(...isAdmin), AcademicsController.createSubject);

// Classes
router.get('/classes', AcademicsController.listClasses);
router.post('/classes', authorize(...isAdmin), AcademicsController.createClass);

// Terms
router.get('/terms', AcademicsController.listTerms);
router.post('/terms', authorize(...isAdmin), AcademicsController.createTerm);

// Assignments
router.get('/assignments', AcademicsController.listAssignments);
router.post('/assignments', authorize(...isStaff), AcademicsController.createAssignment);
router.get('/assignments/:id', AcademicsController.getAssignment);
router.patch('/assignments/:id', authorize(...isStaff), AcademicsController.updateAssignment);
router.delete('/assignments/:id', authorize(...isStaff), AcademicsController.deleteAssignment);
router.post('/assignments/:id/submit', authorize(Role.STUDENT), AcademicsController.submitAssignment);
router.patch('/assignments/submissions/:submissionId/grade', authorize(...isStaff), AcademicsController.gradeSubmission);

// Exams
router.get('/exams', AcademicsController.listExams);
router.post('/exams', authorize(...isStaff), AcademicsController.createExam);
router.patch('/exams/:id/publish', authorize(...isAdmin), AcademicsController.publishExam);
router.post('/exams/:id/results', authorize(...isStaff), AcademicsController.recordResults);

// Results
router.get('/results', AcademicsController.getStudentResults);                   // own results
router.get('/results/:studentId', authorize(...isStaff), AcademicsController.getStudentResults); // any student (staff)

// Grade reports
router.post('/reports/generate', authorize(...isStaff), AcademicsController.generateReport);
router.post('/reports/publish', authorize(...isAdmin), AcademicsController.publishReport);
router.post('/reports/rankings', authorize(...isStaff), AcademicsController.computeRankings);
router.get('/insights/performance', authorize(...isStaff), AcademicsController.getPerformanceInsights);

// Printable documents
router.get('/reports/pdf', AcademicsController.downloadReportCard);                          // own report card (student/parent viewing own child would need studentId, see below)
router.get('/reports/:studentId/pdf', authorize(...isStaff), AcademicsController.downloadReportCard); // any student (staff)
router.get('/exams/:id/marksheet', authorize(...isStaff), AcademicsController.downloadMarkSheet);

export default router;
