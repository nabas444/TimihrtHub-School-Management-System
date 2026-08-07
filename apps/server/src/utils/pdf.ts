// ─────────────────────────────────────────────────────────────────────────────
// PDF / printable document generation
//
// Phase 2 of the continuation blueprint: the requirement document calls for
// printable report cards, fee receipts, attendance sheets, master mark sheets,
// and ID cards (thermal or desktop printer). Nothing generated an actual PDF
// before this file — data existed only as database rows.
//
// Library: pdf-lib (pure JS, no native/binary dependencies — safe on any host,
// including constrained or containerized deploy targets like Render).
// ─────────────────────────────────────────────────────────────────────────────

let PDFDocument: any;
let StandardFonts: any;
let rgb: any;
let COLOR: any = {};

async function loadPdfLib() {
  if (!PDFDocument) {
    const pdfLib = await import("pdf-lib");
    PDFDocument = pdfLib.PDFDocument;
    StandardFonts = pdfLib.StandardFonts;
    rgb = pdfLib.rgb;

    // Initialize colors after loading
    COLOR = {
      navy: rgb(0.12, 0.22, 0.39),
      gray: rgb(0.4, 0.4, 0.4),
      lightGray: rgb(0.93, 0.93, 0.93),
      black: rgb(0, 0, 0),
      white: rgb(1, 1, 1),
      green: rgb(0.12, 0.44, 0.27),
      red: rgb(0.64, 0.15, 0.15),
    };
  }
}

const PAGE = { width: 595.28, height: 841.89 }; // A4 in points

interface SchoolHeader {
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}

async function newDoc() {
  await loadPdfLib();
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  return { doc, font, bold };
}

function drawHeader(
  page: any,
  bold: any,
  font: any,
  school: SchoolHeader,
  title: string,
) {
  const { height } = page.getSize();
  page.drawRectangle({
    x: 0,
    y: height - 90,
    width: page.getWidth(),
    height: 90,
    color: COLOR.navy,
  });
  page.drawText(school.name, {
    x: 40,
    y: height - 40,
    size: 18,
    font: bold,
    color: COLOR.white,
  });
  const contactLine = [school.address, school.phone, school.email]
    .filter(Boolean)
    .join("  ·  ");
  if (contactLine) {
    page.drawText(contactLine, {
      x: 40,
      y: height - 60,
      size: 9,
      font,
      color: rgb(0.85, 0.88, 0.93),
    });
  }
  page.drawText(title, {
    x: 40,
    y: height - 78,
    size: 11,
    font,
    color: rgb(0.8, 0.83, 0.9),
  });
  return height - 120; // y-cursor for body content
}

function drawFooter(page: any, font: any, text: string) {
  page.drawText(text, { x: 40, y: 30, size: 8, font, color: COLOR.gray });
  page.drawText(
    `Generated ${new Date().toLocaleString("en-GB", { timeZone: "Africa/Addis_Ababa" })}`,
    {
      x: page.getWidth() - 220,
      y: 30,
      size: 8,
      font,
      color: COLOR.gray,
    },
  );
}

function labelValue(
  page: any,
  font: any,
  bold: any,
  x: number,
  y: number,
  label: string,
  value: string,
) {
  page.drawText(label, { x, y, size: 9, font, color: COLOR.gray });
  page.drawText(value, {
    x,
    y: y - 14,
    size: 11,
    font: bold,
    color: COLOR.black,
  });
}

// ── 1. Report card ────────────────────────────────────────────────────────────
export interface ReportCardData {
  school: SchoolHeader;
  student: { name: string; admissionNumber: string; className: string };
  term: { name: string; academicYear: string };
  subjects: {
    subjectName: string;
    marksObtained: number;
    totalMarks: number;
    grade?: string | null;
  }[];
  totalMarks: number;
  maxMarks: number;
  percentage: number;
  gpa: number | null;
  rank: number | null;
  classSize?: number | null;
  teacherComment?: string | null;
}

export async function generateReportCardPdf(
  data: ReportCardData,
): Promise<Buffer> {
  const { doc, font, bold } = await newDoc();
  let page = doc.addPage([PAGE.width, PAGE.height]);
  let y = drawHeader(
    page,
    bold,
    font,
    data.school,
    "Official Term Report Card",
  );

  page.drawText(`${data.student.name}`, {
    x: 40,
    y,
    size: 16,
    font: bold,
    color: COLOR.black,
  });
  y -= 22;

  labelValue(
    page,
    font,
    bold,
    40,
    y,
    "Admission No.",
    data.student.admissionNumber,
  );
  labelValue(page, font, bold, 200, y, "Class", data.student.className);
  labelValue(
    page,
    font,
    bold,
    360,
    y,
    "Term",
    `${data.term.name} (${data.term.academicYear})`,
  );
  y -= 40;

  // Table header
  const colX = { subject: 40, obtained: 300, total: 380, grade: 460 };
  page.drawRectangle({
    x: 40,
    y: y - 4,
    width: PAGE.width - 80,
    height: 20,
    color: COLOR.lightGray,
  });
  page.drawText("Subject", {
    x: colX.subject + 6,
    y,
    size: 10,
    font: bold,
    color: COLOR.black,
  });
  page.drawText("Marks", {
    x: colX.obtained,
    y,
    size: 10,
    font: bold,
    color: COLOR.black,
  });
  page.drawText("Out of", {
    x: colX.total,
    y,
    size: 10,
    font: bold,
    color: COLOR.black,
  });
  page.drawText("Grade", {
    x: colX.grade,
    y,
    size: 10,
    font: bold,
    color: COLOR.black,
  });
  y -= 24;

  for (const s of data.subjects) {
    page.drawText(s.subjectName, {
      x: colX.subject + 6,
      y,
      size: 10,
      font,
      color: COLOR.black,
    });
    page.drawText(String(s.marksObtained), {
      x: colX.obtained,
      y,
      size: 10,
      font,
      color: COLOR.black,
    });
    page.drawText(String(s.totalMarks), {
      x: colX.total,
      y,
      size: 10,
      font,
      color: COLOR.black,
    });
    page.drawText(s.grade ?? "—", {
      x: colX.grade,
      y,
      size: 10,
      font,
      color: COLOR.black,
    });
    y -= 18;
    if (y < 140) {
      // simple pagination guard for very long subject lists
      page = doc.addPage([PAGE.width, PAGE.height]);
      y = drawHeader(
        page,
        bold,
        font,
        data.school,
        "Official Term Report Card — continued",
      );
    }
  }

  y -= 10;
  page.drawLine({
    start: { x: 40, y },
    end: { x: PAGE.width - 40, y },
    thickness: 0.5,
    color: COLOR.gray,
  });
  y -= 30;

  labelValue(
    page,
    font,
    bold,
    40,
    y,
    "Total Marks",
    `${data.totalMarks} / ${data.maxMarks}`,
  );
  labelValue(
    page,
    font,
    bold,
    200,
    y,
    "Percentage",
    `${data.percentage.toFixed(1)}%`,
  );
  labelValue(
    page,
    font,
    bold,
    340,
    y,
    "GPA (4.0 scale)",
    data.gpa != null ? data.gpa.toFixed(2) : "—",
  );
  labelValue(
    page,
    font,
    bold,
    460,
    y,
    "Class Rank",
    data.rank != null
      ? `#${data.rank}${data.classSize ? ` / ${data.classSize}` : ""}`
      : "—",
  );
  y -= 50;

  if (data.teacherComment) {
    page.drawText("Class Teacher Comment", {
      x: 40,
      y,
      size: 9,
      font,
      color: COLOR.gray,
    });
    y -= 16;
    page.drawText(data.teacherComment, {
      x: 40,
      y,
      size: 10,
      font,
      color: COLOR.black,
      maxWidth: PAGE.width - 80,
    });
    y -= 40;
  }

  page.drawText("Signature: ______________________", {
    x: 40,
    y: 90,
    size: 10,
    font,
    color: COLOR.gray,
  });
  page.drawText("Date: ______________________", {
    x: 340,
    y: 90,
    size: 10,
    font,
    color: COLOR.gray,
  });
  drawFooter(page, font, `${data.school.name} — Report Card`);

  return Buffer.from(await doc.save());
}

// ── 2. Fee receipt ────────────────────────────────────────────────────────────
export interface FeeReceiptData {
  school: SchoolHeader;
  receiptNumber: string;
  student: { name: string; admissionNumber: string; className: string };
  invoice: {
    title: string;
    type: string;
    amount: number;
    discount: number;
    dueDate: Date;
  };
  payment: {
    amount: number;
    method: string;
    reference?: string | null;
    paidAt: Date;
  };
  balanceRemaining: number;
}

export async function generateFeeReceiptPdf(
  data: FeeReceiptData,
): Promise<Buffer> {
  const { doc, font, bold } = await newDoc();
  const page = doc.addPage([PAGE.width, 420]); // receipts are short — no need for a full A4 page
  let y = drawHeader(page, bold, font, data.school, "Fee Payment Receipt");

  page.drawText(`Receipt #${data.receiptNumber}`, {
    x: 40,
    y,
    size: 13,
    font: bold,
    color: COLOR.black,
  });
  page.drawText(new Date(data.payment.paidAt).toLocaleDateString("en-GB"), {
    x: PAGE.width - 160,
    y,
    size: 11,
    font,
    color: COLOR.gray,
  });
  y -= 30;

  labelValue(page, font, bold, 40, y, "Student", data.student.name);
  labelValue(
    page,
    font,
    bold,
    260,
    y,
    "Admission No.",
    data.student.admissionNumber,
  );
  labelValue(page, font, bold, 420, y, "Class", data.student.className);
  y -= 40;

  labelValue(
    page,
    font,
    bold,
    40,
    y,
    "Fee",
    `${data.invoice.title} (${data.invoice.type})`,
  );
  labelValue(page, font, bold, 300, y, "Payment Method", data.payment.method);
  y -= 40;

  if (data.payment.reference) {
    labelValue(page, font, bold, 40, y, "Reference", data.payment.reference);
    y -= 40;
  }

  page.drawLine({
    start: { x: 40, y },
    end: { x: PAGE.width - 40, y },
    thickness: 0.5,
    color: COLOR.gray,
  });
  y -= 26;

  page.drawText("Amount Paid", { x: 40, y, size: 11, font, color: COLOR.gray });
  page.drawText(`ETB ${data.payment.amount.toLocaleString()}`, {
    x: PAGE.width - 160,
    y,
    size: 14,
    font: bold,
    color: COLOR.green,
  });
  y -= 24;

  page.drawText("Balance Remaining", {
    x: 40,
    y,
    size: 11,
    font,
    color: COLOR.gray,
  });
  page.drawText(`ETB ${data.balanceRemaining.toLocaleString()}`, {
    x: PAGE.width - 160,
    y,
    size: 12,
    font: bold,
    color: data.balanceRemaining > 0 ? COLOR.red : COLOR.green,
  });

  drawFooter(
    page,
    font,
    `${data.school.name} — Official Receipt. Keep for your records.`,
  );
  return Buffer.from(await doc.save());
}

// ── 3. ID card ────────────────────────────────────────────────────────────────
// Sized to a standard CR80 card (85.6mm x 54mm ≈ 242.6 x 153.4 points) so it
// prints correctly on ID card printers as well as a normal desktop/thermal one.
export interface IdCardData {
  school: SchoolHeader;
  person: {
    name: string;
    role: string;
    idNumber: string;
    className?: string | null;
    validThrough?: string | null;
  };
}

export async function generateIdCardPdf(data: IdCardData): Promise<Buffer> {
  const { doc, font, bold } = await newDoc();
  const width = 242.6,
    height = 153.4;
  const page = doc.addPage([width, height]);

  page.drawRectangle({ x: 0, y: 0, width, height, color: COLOR.white });
  page.drawRectangle({
    x: 0,
    y: height - 34,
    width,
    height: 34,
    color: COLOR.navy,
  });
  page.drawText(data.school.name, {
    x: 10,
    y: height - 22,
    size: 10,
    font: bold,
    color: COLOR.white,
    maxWidth: width - 20,
  });

  // Photo placeholder box — actual photo embedding needs a stored image URL;
  // left as a bordered box so the card is still usable/printable without one.
  page.drawRectangle({
    x: 10,
    y: height - 110,
    width: 60,
    height: 66,
    borderColor: COLOR.gray,
    borderWidth: 1,
  });
  page.drawText("PHOTO", {
    x: 20,
    y: height - 80,
    size: 8,
    font,
    color: COLOR.gray,
  });

  const textX = 80;
  page.drawText(data.person.name, {
    x: textX,
    y: height - 52,
    size: 11,
    font: bold,
    color: COLOR.black,
    maxWidth: width - textX - 10,
  });
  page.drawText(data.person.role, {
    x: textX,
    y: height - 66,
    size: 8,
    font,
    color: COLOR.gray,
  });
  if (data.person.className) {
    page.drawText(`Class: ${data.person.className}`, {
      x: textX,
      y: height - 80,
      size: 8,
      font,
      color: COLOR.black,
    });
  }
  page.drawText(`ID: ${data.person.idNumber}`, {
    x: textX,
    y: height - 94,
    size: 8,
    font,
    color: COLOR.black,
  });
  if (data.person.validThrough) {
    page.drawText(`Valid through: ${data.person.validThrough}`, {
      x: textX,
      y: height - 108,
      size: 7,
      font,
      color: COLOR.gray,
    });
  }

  page.drawLine({
    start: { x: 10, y: 14 },
    end: { x: width - 10, y: 14 },
    thickness: 0.5,
    color: COLOR.gray,
  });
  page.drawText("If found, please return to the school office.", {
    x: 10,
    y: 5,
    size: 6,
    font,
    color: COLOR.gray,
  });

  return Buffer.from(await doc.save());
}

// ── 4. Attendance sheet (printable, per class + date range) ──────────────────
export interface AttendanceSheetData {
  school: SchoolHeader;
  className: string;
  dateRange: { from: string; to: string };
  dates: string[]; // column headers, e.g. each school day in range
  students: {
    name: string;
    admissionNumber: string;
    statusesByDate: Record<string, string>;
  }[]; // 'P' | 'A' | 'L' | 'X'
}

export async function generateAttendanceSheetPdf(
  data: AttendanceSheetData,
): Promise<Buffer> {
  const { doc, font, bold } = await newDoc();
  const nameColWidth = 160;
  const admColWidth = 90;

  const drawTableHeader = (page: any, title: string, yStart: number) => {
    let y = yStart;
    if (title === "first") {
      page.drawText(`${data.dateRange.from} to ${data.dateRange.to}`, {
        x: 40,
        y,
        size: 10,
        font,
        color: COLOR.gray,
      });
      y -= 24;
    }
    const availableWidth = page.getWidth() - 80 - nameColWidth - admColWidth;
    const dateColWidth = Math.max(
      availableWidth / Math.max(data.dates.length, 1),
      24,
    );
    page.drawRectangle({
      x: 40,
      y: y - 4,
      width: page.getWidth() - 80,
      height: 18,
      color: COLOR.lightGray,
    });
    page.drawText("Student", {
      x: 44,
      y,
      size: 8,
      font: bold,
      color: COLOR.black,
    });
    page.drawText("Admission No.", {
      x: 44 + nameColWidth,
      y,
      size: 8,
      font: bold,
      color: COLOR.black,
    });
    data.dates.forEach((d, i) => {
      page.drawText(d.slice(5), {
        x: 44 + nameColWidth + admColWidth + i * dateColWidth,
        y,
        size: 7,
        font: bold,
        color: COLOR.black,
      });
    });
    return { y: y - 20, dateColWidth };
  };

  let page = doc.addPage([PAGE.height, PAGE.width]); // landscape — more room for date columns
  let y = drawHeader(
    page,
    bold,
    font,
    data.school,
    `Attendance Sheet — ${data.className}`,
  );
  let head = drawTableHeader(page, "first", y);
  y = head.y;
  let dateColWidth = head.dateColWidth;

  for (const student of data.students) {
    if (y < 60) {
      // Paginate instead of silently dropping remaining students (bug found
      // during Phase 2 verification: a 60-student roster only rendered 24).
      page = doc.addPage([PAGE.height, PAGE.width]);
      y = drawHeader(
        page,
        bold,
        font,
        data.school,
        `Attendance Sheet — ${data.className} (continued)`,
      );
      const h = drawTableHeader(page, "continued", y);
      y = h.y;
      dateColWidth = h.dateColWidth;
    }
    page.drawText(student.name, {
      x: 44,
      y,
      size: 8,
      font,
      color: COLOR.black,
      maxWidth: nameColWidth - 4,
    });
    page.drawText(student.admissionNumber, {
      x: 44 + nameColWidth,
      y,
      size: 8,
      font,
      color: COLOR.black,
    });
    data.dates.forEach((d, i) => {
      const status = student.statusesByDate[d] ?? "";
      page.drawText(status, {
        x: 44 + nameColWidth + admColWidth + i * dateColWidth,
        y,
        size: 8,
        font,
        color: COLOR.black,
      });
    });
    y -= 16;
  }

  drawFooter(
    page,
    font,
    `${data.school.name} — Attendance Sheet (P=Present, A=Absent, L=Late, X=Permitted)`,
  );
  return Buffer.from(await doc.save());
}

// ── 5. Master mark sheet (per exam, all students) ─────────────────────────────
export interface MarkSheetData {
  school: SchoolHeader;
  examTitle: string;
  subjectName: string;
  className: string;
  totalMarks: number;
  rows: {
    rollNumber: string | null;
    name: string;
    marksObtained: number;
    grade?: string | null;
    isAbsent: boolean;
  }[];
}

export async function generateMarkSheetPdf(
  data: MarkSheetData,
): Promise<Buffer> {
  const { doc, font, bold } = await newDoc();
  let page = doc.addPage([PAGE.width, PAGE.height]);
  let y = drawHeader(
    page,
    bold,
    font,
    data.school,
    `Master Mark Sheet — ${data.subjectName}`,
  );

  page.drawText(
    `${data.examTitle}  ·  ${data.className}  ·  Out of ${data.totalMarks}`,
    { x: 40, y, size: 10, font, color: COLOR.gray },
  );
  y -= 24;

  const colX = { roll: 40, name: 110, marks: 380, grade: 460 };
  page.drawRectangle({
    x: 40,
    y: y - 4,
    width: PAGE.width - 80,
    height: 18,
    color: COLOR.lightGray,
  });
  page.drawText("Roll No.", {
    x: colX.roll + 4,
    y,
    size: 9,
    font: bold,
    color: COLOR.black,
  });
  page.drawText("Student Name", {
    x: colX.name,
    y,
    size: 9,
    font: bold,
    color: COLOR.black,
  });
  page.drawText("Marks", {
    x: colX.marks,
    y,
    size: 9,
    font: bold,
    color: COLOR.black,
  });
  page.drawText("Grade", {
    x: colX.grade,
    y,
    size: 9,
    font: bold,
    color: COLOR.black,
  });
  y -= 20;

  for (const r of data.rows) {
    page.drawText(r.rollNumber ?? "—", {
      x: colX.roll + 4,
      y,
      size: 9,
      font,
      color: COLOR.black,
    });
    page.drawText(r.name, {
      x: colX.name,
      y,
      size: 9,
      font,
      color: COLOR.black,
    });
    page.drawText(r.isAbsent ? "ABS" : String(r.marksObtained), {
      x: colX.marks,
      y,
      size: 9,
      font,
      color: r.isAbsent ? COLOR.red : COLOR.black,
    });
    page.drawText(r.grade ?? "—", {
      x: colX.grade,
      y,
      size: 9,
      font,
      color: COLOR.black,
    });
    y -= 16;
    if (y < 60) {
      page = doc.addPage([PAGE.width, PAGE.height]);
      y = drawHeader(
        page,
        bold,
        font,
        data.school,
        `Master Mark Sheet — ${data.subjectName} (continued)`,
      );
    }
  }

  drawFooter(page, font, `${data.school.name} — Master Mark Sheet`);
  return Buffer.from(await doc.save());
}
