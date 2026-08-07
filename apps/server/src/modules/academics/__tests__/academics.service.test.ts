import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDb = {
  studentProfile: { findUnique: vi.fn() },
  examResult: { findMany: vi.fn() },
  gradeReport: { upsert: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  class: { findFirst: vi.fn() },
  parentStudentLink: { findMany: vi.fn() },
};
vi.mock('../../../config/database', () => ({ db: mockDb }));
vi.mock('../../../config/socket', () => ({ emitToUser: vi.fn() }));

import { generateGradeReport, computeClassRankings } from '../academics.service';

describe('generateGradeReport — session-2 regression: unassigned-class guard', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('refuses to generate a report for a student with no assigned class, instead of silently writing classId: "" (the original bug)', async () => {
    mockDb.studentProfile.findUnique.mockResolvedValueOnce({ id: 'sp1', classId: null });
    mockDb.examResult.findMany.mockResolvedValueOnce([
      { marksObtained: 80, exam: { totalMarks: 100 } },
    ]);

    await expect(generateGradeReport('u1', 'term1', 's1')).rejects.toMatchObject({ statusCode: 400 });
    expect(mockDb.gradeReport.upsert).not.toHaveBeenCalled();
  });

  it('still throws 404 (not the classId error) when there are no exam results at all', async () => {
    mockDb.studentProfile.findUnique.mockResolvedValueOnce({ id: 'sp1', classId: 'c1' });
    mockDb.examResult.findMany.mockResolvedValueOnce([]);

    await expect(generateGradeReport('u1', 'term1', 's1')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('succeeds and writes the report when the student does have an assigned class', async () => {
    mockDb.studentProfile.findUnique.mockResolvedValueOnce({ id: 'sp1', classId: 'c1' });
    mockDb.examResult.findMany.mockResolvedValueOnce([
      { marksObtained: 90, exam: { totalMarks: 100 } },
    ]);
    mockDb.gradeReport.upsert.mockResolvedValueOnce({ id: 'gr1', percentage: 90, gpa: 4.0, classId: 'c1' });

    const report = await generateGradeReport('u1', 'term1', 's1');

    expect(mockDb.gradeReport.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ classId: 'c1' }),
      }),
    );
    expect(report.percentage).toBe(90);
  });
});

describe('computeClassRankings — standard competition ranking (1224)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('assigns tied scores the same rank and skips the next rank accordingly', async () => {
    mockDb.class.findFirst.mockResolvedValueOnce({ id: 'c1' });
    // Already sorted desc by percentage/gpa as Prisma's orderBy would return.
    mockDb.gradeReport.findMany.mockResolvedValueOnce([
      { id: 'r1', studentId: 's1', percentage: 95, gpa: 4.0 },
      { id: 'r2', studentId: 's2', percentage: 90, gpa: 3.7 },
      { id: 'r3', studentId: 's3', percentage: 90, gpa: 3.7 }, // tied with r2
      { id: 'r4', studentId: 's4', percentage: 80, gpa: 3.3 },
    ]);
    mockDb.gradeReport.update.mockImplementation(async ({ where, data }: any) => ({
      id: where.id,
      rank: data.rank,
      studentId: { r1: 's1', r2: 's2', r3: 's3', r4: 's4' }[where.id as string],
      percentage: { r1: 95, r2: 90, r3: 90, r4: 80 }[where.id as string],
      gpa: { r1: 4.0, r2: 3.7, r3: 3.7, r4: 3.3 }[where.id as string],
    }));

    const result = await computeClassRankings('c1', 'term1', 's1');

    expect(result.map((r) => r.rank)).toEqual([1, 2, 2, 4]); // 1,2,2,4 — not 1,2,2,3
  });

  it('throws 404 if no grade reports exist yet for that class/term', async () => {
    mockDb.class.findFirst.mockResolvedValueOnce({ id: 'c1' });
    mockDb.gradeReport.findMany.mockResolvedValueOnce([]);

    await expect(computeClassRankings('c1', 'term1', 's1')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 404 for a class that does not belong to the requesting school (tenancy)', async () => {
    mockDb.class.findFirst.mockResolvedValueOnce(null);
    await expect(computeClassRankings('other-schools-class', 'term1', 's1')).rejects.toMatchObject({ statusCode: 404 });
  });
});
