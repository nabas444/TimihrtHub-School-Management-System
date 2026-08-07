import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { BookStatus } from '@prisma/client';
import { db } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { sendSuccess, sendCreated, paginationMeta } from '../../utils/response';
import { authorize } from '../../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();
const isAdmin = [Role.ADMIN, Role.SUPER_ADMIN];
const isStaff = [Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER];

// ── List books ────────────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const search = req.query.search as string | undefined;
    const category = req.query.category as string | undefined;

    const where = {
      schoolId: req.user.schoolId,
      ...(category && { category }),
      ...(search && { OR: [
        { title: { contains: search, mode: 'insensitive' as const } },
        { author: { contains: search, mode: 'insensitive' as const } },
        { isbn: { contains: search, mode: 'insensitive' as const } },
      ]}),
    };

    const [books, total] = await Promise.all([
      db.libraryBook.findMany({ where, skip, take: limit, orderBy: { title: 'asc' }, include: { _count: { select: { issues: true } } } }),
      db.libraryBook.count({ where }),
    ]);
    sendSuccess(res, books, 'OK', 200, paginationMeta(total, page, limit));
  } catch (e) { next(e); }
});

// ── Add book ──────────────────────────────────────────────────────────────────
router.post('/', authorize(...isAdmin), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z.object({
      title: z.string(), author: z.string(), isbn: z.string().optional(),
      category: z.string(), publisher: z.string().optional(), year: z.number().optional(),
      copies: z.number().int().positive().default(1), coverUrl: z.string().optional(), location: z.string().optional(),
    }).parse(req.body);
    const book = await db.libraryBook.create({ data: { schoolId: req.user.schoolId, ...data, available: data.copies } });
    sendCreated(res, book);
  } catch (e) { next(e); }
});

// Extracted as named functions (session-6 hardening) so the tenancy fixes
// from Section 4.4 are unit-testable without needing Express/Prisma to run —
// logic is unchanged from the inline version, just named and exported.

// ── Issue book ────────────────────────────────────────────────────────────────
export const issueBook = async (
  schoolId: string,
  bookId: string,
  data: { studentProfileId: string; dueDate: string },
) => {
  const book = await db.libraryBook.findFirst({ where: { id: bookId, schoolId } });
  if (!book) throw new AppError('Book not found', 404);
  if (book.available <= 0) throw new AppError('No copies available', 400);

  // Tenancy-isolation fix (session 4): studentProfileId must belong to the
  // same school as the book, not just exist anywhere in the DB.
  const student = await db.studentProfile.findFirst({ where: { id: data.studentProfileId, user: { schoolId } } });
  if (!student) throw new AppError('Student not found', 404);

  // Check student doesn't have an existing active issue
  const activeIssue = await db.libraryIssue.findFirst({ where: { bookId, studentProfileId: data.studentProfileId, returnedAt: null } });
  if (activeIssue) throw new AppError('Student already has this book issued', 409);

  const [issue] = await db.$transaction([
    db.libraryIssue.create({ data: { bookId, studentProfileId: data.studentProfileId, dueDate: new Date(data.dueDate) } }),
    db.libraryBook.update({ where: { id: bookId }, data: { available: { decrement: 1 }, status: book.available - 1 <= 0 ? BookStatus.ISSUED : BookStatus.AVAILABLE } }),
  ]);
  return issue;
};

router.post('/:bookId/issue', authorize(...isStaff), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z.object({ studentProfileId: z.string(), dueDate: z.string().datetime() }).parse(req.body);
    sendCreated(res, await issueBook(req.user.schoolId, req.params.bookId, data), 'Book issued');
  } catch (e) { next(e); }
});

// ── Return book ───────────────────────────────────────────────────────────────
export const returnBook = async (schoolId: string, bookId: string, issueId: string) => {
  // Tenancy-isolation fix (session 4): the book must belong to the
  // requesting staff member's own school.
  const issue = await db.libraryIssue.findFirst({
    where: { id: issueId, bookId, returnedAt: null, book: { schoolId } },
  });
  if (!issue) throw new AppError('Active issue not found', 404);

  // Calculate fine (1 ETB per day overdue)
  const now = new Date();
  const fine = now > issue.dueDate ? Math.floor((now.getTime() - issue.dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;

  const [updated] = await db.$transaction([
    db.libraryIssue.update({ where: { id: issueId }, data: { returnedAt: now, fine } }),
    db.libraryBook.update({ where: { id: bookId }, data: { available: { increment: 1 }, status: BookStatus.AVAILABLE } }),
  ]);
  return { ...updated, fine };
};

router.patch('/:bookId/return/:issueId', authorize(...isStaff), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await returnBook(req.user.schoolId, req.params.bookId, req.params.issueId);
    sendSuccess(res, result, result.fine > 0 ? `Returned with fine: ${result.fine} ETB` : 'Returned successfully');
  } catch (e) { next(e); }
});

// ── My borrowed books (student) ───────────────────────────────────────────────
router.get('/my', authorize(Role.STUDENT), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await db.studentProfile.findUnique({ where: { userId: req.user.id } });
    if (!profile) throw new AppError('Student profile not found', 404);
    const issues = await db.libraryIssue.findMany({
      where: { studentProfileId: profile.id },
      include: { book: { select: { title: true, author: true, coverUrl: true } } },
      orderBy: { issuedAt: 'desc' },
    });
    sendSuccess(res, issues);
  } catch (e) { next(e); }
});

// ── Overdue report ────────────────────────────────────────────────────────────
router.get('/overdue', authorize(...isStaff), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const overdue = await db.libraryIssue.findMany({
      where: { book: { schoolId: req.user.schoolId }, returnedAt: null, dueDate: { lt: new Date() } },
      include: {
        book: { select: { title: true, author: true } },
        studentProfile: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
      },
      orderBy: { dueDate: 'asc' },
    });
    sendSuccess(res, overdue);
  } catch (e) { next(e); }
});

export default router;
