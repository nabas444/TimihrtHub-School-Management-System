import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    libraryBook: { findFirst: vi.fn(), update: vi.fn() },
    studentProfile: { findFirst: vi.fn() },
    libraryIssue: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));
vi.mock('../../../config/database', () => ({ db: mockDb }));

import { issueBook, returnBook } from '../library.routes';

describe('issueBook — tenancy isolation (session-4 fix)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('rejects issuing a book that does not belong to the requester\'s school', async () => {
    mockDb.libraryBook.findFirst.mockResolvedValueOnce(null); // scoped lookup found nothing
    await expect(issueBook('school-A', 'book1', { studentProfileId: 'sp1', dueDate: '2026-09-01T00:00:00Z' }))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  it('rejects when there are no copies available', async () => {
    mockDb.libraryBook.findFirst.mockResolvedValueOnce({ id: 'book1', available: 0 });
    await expect(issueBook('school-A', 'book1', { studentProfileId: 'sp1', dueDate: '2026-09-01T00:00:00Z' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('REJECTS issuing to a studentProfileId that exists but belongs to a different school (the cross-tenant bug)', async () => {
    mockDb.libraryBook.findFirst.mockResolvedValueOnce({ id: 'book1', available: 2 });
    // Scoped lookup (id + user.schoolId=school-A) correctly returns nothing,
    // because this studentProfileId actually belongs to school-B.
    mockDb.studentProfile.findFirst.mockResolvedValueOnce(null);

    await expect(issueBook('school-A', 'book1', { studentProfileId: 'student-from-school-B', dueDate: '2026-09-01T00:00:00Z' }))
      .rejects.toMatchObject({ statusCode: 404 });

    expect(mockDb.studentProfile.findFirst).toHaveBeenCalledWith({
      where: { id: 'student-from-school-B', user: { schoolId: 'school-A' } },
    });
    expect(mockDb.libraryIssue.create).not.toHaveBeenCalled();
  });

  it('rejects issuing when the student already has an active issue for this book', async () => {
    mockDb.libraryBook.findFirst.mockResolvedValueOnce({ id: 'book1', available: 2 });
    mockDb.studentProfile.findFirst.mockResolvedValueOnce({ id: 'sp1' });
    mockDb.libraryIssue.findFirst.mockResolvedValueOnce({ id: 'existing-issue' });

    await expect(issueBook('school-A', 'book1', { studentProfileId: 'sp1', dueDate: '2026-09-01T00:00:00Z' }))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  it('succeeds for a same-school student with an available copy', async () => {
    mockDb.libraryBook.findFirst.mockResolvedValueOnce({ id: 'book1', available: 2 });
    mockDb.studentProfile.findFirst.mockResolvedValueOnce({ id: 'sp1' });
    mockDb.libraryIssue.findFirst.mockResolvedValueOnce(null);
    mockDb.libraryIssue.create.mockReturnValueOnce(Promise.resolve({ id: 'issue1' }));
    mockDb.libraryBook.update.mockReturnValueOnce(Promise.resolve({ id: 'book1' }));

    const issue = await issueBook('school-A', 'book1', { studentProfileId: 'sp1', dueDate: '2026-09-01T00:00:00Z' });
    expect(issue).toEqual({ id: 'issue1' });
  });
});

describe('returnBook — tenancy isolation (session-4 fix)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('REJECTS returning a book whose school does not match the requester\'s school (the original gap: no schoolId check at all)', async () => {
    // Scoped lookup (book.schoolId=school-A) finds nothing because the book
    // actually belongs to school-B — this is exactly what was missing before.
    mockDb.libraryIssue.findFirst.mockResolvedValueOnce(null);

    await expect(returnBook('school-A', 'book-from-school-B', 'issue1'))
      .rejects.toMatchObject({ statusCode: 404 });

    expect(mockDb.libraryIssue.findFirst).toHaveBeenCalledWith({
      where: { id: 'issue1', bookId: 'book-from-school-B', returnedAt: null, book: { schoolId: 'school-A' } },
    });
  });

  it('calculates no fine for an on-time return', async () => {
    const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // due tomorrow
    mockDb.libraryIssue.findFirst.mockResolvedValueOnce({ id: 'issue1', dueDate });
    mockDb.libraryIssue.update.mockReturnValueOnce(Promise.resolve({ id: 'issue1', returnedAt: new Date(), fine: 0 }));
    mockDb.libraryBook.update.mockReturnValueOnce(Promise.resolve({ id: 'book1' }));

    const result = await returnBook('school-A', 'book1', 'issue1');
    expect(result.fine).toBe(0);
  });

  it('calculates a fine of 1 ETB/day for an overdue return', async () => {
    const dueDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days overdue
    mockDb.libraryIssue.findFirst.mockResolvedValueOnce({ id: 'issue1', dueDate });
    mockDb.libraryIssue.update.mockReturnValueOnce(Promise.resolve({ id: 'issue1', returnedAt: new Date(), fine: 3 }));
    mockDb.libraryBook.update.mockReturnValueOnce(Promise.resolve({ id: 'book1' }));

    const result = await returnBook('school-A', 'book1', 'issue1');
    expect(result.fine).toBe(3);
  });
});
