import { describe, it, expect } from 'vitest';
import { Role } from '@prisma/client';
import { canViewBehaviourSummary } from '../behaviour.routes';

// Regression coverage for the session-4 IDOR fix (Section 4.4): before the
// fix, GET /behaviour/student/:studentId/summary had no authorization check
// at all, so any logged-in user — including an unrelated student — could
// pull any other student's disciplinary summary.
describe('canViewBehaviourSummary', () => {
  it('allows staff (teacher/admin/super_admin) regardless of whose record it is', () => {
    for (const role of [Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN]) {
      expect(canViewBehaviourSummary({ id: 'staff-1', role }, 'some-other-student', false)).toBe(true);
    }
  });

  it('allows a student to view their own summary', () => {
    expect(canViewBehaviourSummary({ id: 'student-1', role: Role.STUDENT }, 'student-1', false)).toBe(true);
  });

  it('DENIES a student trying to view a different student\'s summary (the original IDOR)', () => {
    expect(canViewBehaviourSummary({ id: 'student-1', role: Role.STUDENT }, 'student-2', false)).toBe(false);
  });

  it('allows a parent only when a verified ParentStudentLink exists', () => {
    expect(canViewBehaviourSummary({ id: 'parent-1', role: Role.PARENT }, 'child-1', true)).toBe(true);
  });

  it('DENIES a parent with no linked-parent relationship to that student', () => {
    expect(canViewBehaviourSummary({ id: 'parent-1', role: Role.PARENT }, 'unrelated-student', false)).toBe(false);
  });
});
