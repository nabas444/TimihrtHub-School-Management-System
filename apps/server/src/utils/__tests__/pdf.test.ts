import { describe, it, expect } from 'vitest';
const { PDFDocument } = require('pdf-lib/dist/pdf-lib.js');
import { generateAttendanceSheetPdf } from '../pdf';

// Session-2 regression: a 60-student roster used to only render 24 students
// (silently dropped past page 1). This test was already run for real in the
// authoring sandbox with tsx (pdf-lib is available there without a full
// `npm install`) — 60 students -> 3 pages, 5 students -> 1 page, both
// confirmed. Reproduced here as a Vitest test so it's part of `npm test`
// once a real install exists.
describe('generateAttendanceSheetPdf — pagination regression', () => {
  const dates = ['2026-08-01', '2026-08-02', '2026-08-03'];

  it('paginates a large roster instead of dropping students past page 1', async () => {
    const students = Array.from({ length: 60 }, (_, i) => ({
      name: `Student ${i + 1}`,
      admissionNumber: `ADM-${1000 + i}`,
      statusesByDate: Object.fromEntries(dates.map((d) => [d, 'P'])),
    }));

    const pdfBytes = await generateAttendanceSheetPdf({
      school: { name: 'Test School', address: 'Addis Ababa', phone: '0911000000', email: 'x@test.com' },
      className: 'Grade 7A',
      dateRange: { from: dates[0], to: dates[dates.length - 1] },
      dates,
      students,
    });

    const doc = await PDFDocument.load(pdfBytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });

  it('keeps a small roster on a single page', async () => {
    const students = Array.from({ length: 5 }, (_, i) => ({
      name: `Student ${i + 1}`,
      admissionNumber: `ADM-${1000 + i}`,
      statusesByDate: Object.fromEntries(dates.map((d) => [d, 'P'])),
    }));

    const pdfBytes = await generateAttendanceSheetPdf({
      school: { name: 'Test School' },
      className: 'Grade 1A',
      dateRange: { from: dates[0], to: dates[dates.length - 1] },
      dates,
      students,
    });

    const doc = await PDFDocument.load(pdfBytes);
    expect(doc.getPageCount()).toBe(1);
  });
});
