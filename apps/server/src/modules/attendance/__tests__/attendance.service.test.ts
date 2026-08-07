import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDb = {
  class: { findFirst: vi.fn() },
  attendanceRecord: { upsert: vi.fn(), findMany: vi.fn() },
  studentProfile: { findMany: vi.fn() },
  parentStudentLink: { findMany: vi.fn() },
  user: { findUnique: vi.fn() },
  notification: { create: vi.fn(() => ({ catch: vi.fn() })) },
  $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
};
vi.mock('../../../config/database', () => ({ db: mockDb }));
vi.mock('../../../config/socket', () => ({ emitToUser: vi.fn() }));
vi.mock('../../../utils/sms', () => ({ sendSms: vi.fn(() => Promise.resolve()) }));
vi.mock('../../../utils/pdf', () => ({ generateAttendanceSheetPdf: vi.fn() }));

import { markAttendance, getClassAttendance } from '../attendance.service';

describe('markAttendance — tenancy isolation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('rejects marking attendance for a class that does not belong to the requester\'s school', async () => {
    // Scoped lookup (classId + schoolId) returns nothing because the class
    // belongs to a different school.
    mockDb.class.findFirst.mockResolvedValueOnce(null);

    await expect(markAttendance('school-A', 'teacher1', {
      classId: 'class-from-school-B', termId: 'term1', date: new Date(), records: [],
    })).rejects.toMatchObject({ statusCode: 404 });

    expect(mockDb.class.findFirst).toHaveBeenCalledWith({ where: { id: 'class-from-school-B', schoolId: 'school-A' } });
    expect(mockDb.attendanceRecord.upsert).not.toHaveBeenCalled();
  });

  it('writes each attendance record scoped to the requester\'s schoolId, not just the classId', async () => {
    mockDb.class.findFirst.mockResolvedValueOnce({ id: 'class1', schoolId: 'school-A' });
    mockDb.attendanceRecord.upsert.mockReturnValue(Promise.resolve({ id: 'ar1' }));
    mockDb.parentStudentLink.findMany.mockResolvedValue([]);

    await markAttendance('school-A', 'teacher1', {
      classId: 'class1', termId: 'term1', date: new Date('2026-08-01'),
      records: [{ studentId: 'student1', status: 'PRESENT' }],
    });

    const call = mockDb.attendanceRecord.upsert.mock.calls[0][0];
    expect(call.create.schoolId).toBe('school-A');
  });
});

describe('getClassAttendance — summary counts', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('only counts records scoped to the given classId + schoolId', async () => {
    mockDb.attendanceRecord.findMany.mockResolvedValueOnce([
      { status: 'PRESENT', studentId: 's1' },
      { status: 'PRESENT', studentId: 's2' },
      { status: 'ABSENT', studentId: 's3' },
      { status: 'LATE', studentId: 's4' },
    ]);
    mockDb.studentProfile.findMany.mockResolvedValueOnce([
      { userId: 's1' }, { userId: 's2' }, { userId: 's3' }, { userId: 's4' }, { userId: 's5' }, // s5 unmarked
    ]);

    const result = await getClassAttendance('class1', 'school-A', new Date('2026-08-01'));

    expect(mockDb.attendanceRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ classId: 'class1', schoolId: 'school-A' }) }),
    );
    expect(result.present).toBe(2);
    expect(result.absent).toBe(1);
    expect(result.late).toBe(1);
    expect(result.unmarked).toBe(1); // s5 has no record
  });
});
