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
    let pdfLib: any;
    try {
      pdfLib = require("pdf-lib/dist/pdf-lib.js");
    } catch {
      try {
        // @ts-ignore
        pdfLib = await import("pdf-lib/dist/pdf-lib.js");
      } catch {
        pdfLib = await import("pdf-lib");
      }
    }
    PDFDocument = pdfLib.PDFDocument || pdfLib.default?.PDFDocument;
    StandardFonts = pdfLib.StandardFonts || pdfLib.default?.StandardFonts;
    rgb = pdfLib.rgb || pdfLib.default?.rgb;

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
    discount?: number | null;
    discountType?: string | null;
    taxRate?: number | null;
    taxAmount?: number | null;
    dueDate: Date;
  };
  payment: {
    amount: number;
    method: string;
    reference?: string | null;
    paidAt: Date;
    receiptCopies?: number;
  };
  balanceRemaining: number;
  copies?: number;
  isInstallment?: boolean;
  installmentInfo?: {
    installmentNo: number;
    numInstallments?: number;
    dueDate?: Date;
  };
}

export async function generateFeeReceiptPdf(
  data: FeeReceiptData,
): Promise<Buffer> {
  const { doc, font, bold } = await newDoc();
  const numCopies = Math.max(1, Math.min(data.copies ?? data.payment.receiptCopies ?? 1, 2));

  const copyLabels = [
    numCopies === 1 ? "Official Receipt" : "Official Receipt [School Copy]",
    "Official Receipt [Student / Parent Copy]",
  ];

  for (let c = 0; c < numCopies; c++) {
    const page = doc.addPage([PAGE.width, 450]);
    let y = drawHeader(page, bold, font, data.school, copyLabels[c]);

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
    y -= 28;

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
    y -= 38;

    const feeDescription = data.isInstallment && data.installmentInfo
      ? `${data.invoice.title} — Installment #${data.installmentInfo.installmentNo}${data.installmentInfo.numInstallments ? ` of ${data.installmentInfo.numInstallments}` : ""}`
      : `${data.invoice.title} (${data.invoice.type})`;

    labelValue(
      page,
      font,
      bold,
      40,
      y,
      "Fee Description",
      feeDescription,
    );
    labelValue(page, font, bold, 300, y, "Payment Method", data.payment.method);
    y -= 38;

    if (data.payment.reference) {
      labelValue(page, font, bold, 40, y, "Reference", data.payment.reference);
      y -= 32;
    }

    // Breakdown details (Discount / Tax if present)
    const discountVal = data.invoice.discount ?? 0;
    const taxRateVal = data.invoice.taxRate ?? 0;
    const taxAmtVal = data.invoice.taxAmount ?? 0;

    if (discountVal > 0 || taxRateVal > 0) {
      const discountText = data.invoice.discountType === "PERCENT"
        ? `${discountVal}% (ETB ${((data.invoice.amount * discountVal) / 100).toLocaleString()})`
        : `ETB ${discountVal.toLocaleString()}`;

      page.drawText(`Base Fee: ETB ${data.invoice.amount.toLocaleString()}   |   Discount: ${discountText}   |   Tax (${taxRateVal}%): ETB ${taxAmtVal.toLocaleString()}`, {
        x: 40,
        y: y + 8,
        size: 8.5,
        font,
        color: COLOR.gray,
      });
      y -= 14;
    }

    page.drawLine({
      start: { x: 40, y },
      end: { x: PAGE.width - 40, y },
      thickness: 0.5,
      color: COLOR.gray,
    });
    y -= 22;

    page.drawText("Amount Paid", { x: 40, y, size: 11, font, color: COLOR.gray });
    page.drawText(`ETB ${data.payment.amount.toLocaleString()}`, {
      x: PAGE.width - 160,
      y,
      size: 13,
      font: bold,
      color: COLOR.green,
    });
    y -= 20;

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
      `${data.school.name} — ${copyLabels[c]}. Keep for your records.`,
    );
  }

  return Buffer.from(await doc.save());
}

// ── 3. ID card ────────────────────────────────────────────────────────────────
// Sized to a standard CR80 card (85.6mm x 54mm ≈ 242.6 x 153.4 points) so it
// prints correctly on ID card printers as well as a normal desktop/thermal one.

export interface IdCardPerson {
  name: string;
  role: string;
  idNumber: string;
  className?: string | null;
  gradeLevelName?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  phone?: string | null;
  email?: string | null;
  rollNumber?: string | null;
  bloodGroup?: string | null;
  emergencyPhone?: string | null;
  validThrough?: string | null;
  houseName?: string | null;
  houseColor?: string | null;
  department?: string | null;
}

export interface IdCardData {
  school: SchoolHeader;
  person: IdCardPerson;
  layout?: "HORIZONTAL" | "VERTICAL";
  colorMode?: "NONE" | "BACKGROUND" | "STRIP";
  validUpto?: string | null;
  printBack?: boolean;
}

export interface BatchIdCardsData {
  school: SchoolHeader;
  persons: IdCardPerson[];
  layout?: "HORIZONTAL" | "VERTICAL";
  colorMode?: "NONE" | "BACKGROUND" | "STRIP";
  validUpto?: string | null;
  printBack?: boolean;
}

function parseHexRgb(hex?: string | null) {
  if (!hex) return rgb(0.12, 0.22, 0.39);
  const clean = hex.replace("#", "").trim();
  if (clean.length !== 3 && clean.length !== 6) return rgb(0.12, 0.22, 0.39);
  const fullHex = clean.length === 3
    ? clean.split("").map((c) => c + c).join("")
    : clean;
  const num = parseInt(fullHex, 16);
  if (isNaN(num)) return rgb(0.12, 0.22, 0.39);
  return rgb(((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255);
}

function renderSingleIdCard(
  doc: any,
  font: any,
  bold: any,
  school: SchoolHeader,
  person: IdCardPerson,
  options: {
    layout?: "HORIZONTAL" | "VERTICAL";
    colorMode?: "NONE" | "BACKGROUND" | "STRIP";
    validUpto?: string | null;
    printBack?: boolean;
  }
) {
  const isVertical = options.layout === "VERTICAL";
  const colorMode = options.colorMode || (person.houseColor ? "STRIP" : "NONE");
  const printBack = options.printBack !== false;

  const width = isVertical ? 153.4 : 242.6;
  const height = isVertical ? 242.6 : 153.4;

  const houseRgb = parseHexRgb(person.houseColor);

  // ══════════════════════════════════════════════════════════════
  // PAGE 1: FRONT SIDE
  // ══════════════════════════════════════════════════════════════
  const frontPage = doc.addPage([width, height]);

  // Card Background
  let bgColor = rgb(0.98, 0.98, 0.99);
  if (colorMode === "BACKGROUND" && person.houseColor) {
    bgColor = rgb(0.95, 0.96, 0.98);
  }
  frontPage.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: bgColor,
  });
  frontPage.drawRectangle({
    x: 1,
    y: 1,
    width: width - 2,
    height: height - 2,
    borderColor: rgb(0.8, 0.84, 0.9),
    borderWidth: 1,
  });

  if (isVertical) {
    // ──────── VERTICAL LAYOUT ────────
    const headerHeight = 44;
    frontPage.drawRectangle({
      x: 0,
      y: height - headerHeight,
      width,
      height: headerHeight,
      color: rgb(0.08, 0.16, 0.32),
    });

    // Accent Strip
    const stripColor = colorMode === "STRIP" && person.houseColor ? houseRgb : rgb(0.88, 0.72, 0.22);
    frontPage.drawRectangle({
      x: 0,
      y: height - headerHeight - 3,
      width,
      height: 3,
      color: stripColor,
    });

    frontPage.drawText(school.name, {
      x: 10,
      y: height - 20,
      size: 9,
      font: bold,
      color: COLOR.white,
      maxWidth: width - 20,
    });
    frontPage.drawText(`${person.role.toUpperCase()} IDENTITY CARD`, {
      x: 10,
      y: height - 34,
      size: 6,
      font: bold,
      color: stripColor,
    });

    // Photo Box centered
    const photoW = 54;
    const photoH = 62;
    const photoX = (width - photoW) / 2;
    const photoY = height - 120;

    frontPage.drawRectangle({
      x: photoX,
      y: photoY,
      width: photoW,
      height: photoH,
      color: rgb(0.93, 0.95, 0.98),
      borderColor: rgb(0.2, 0.35, 0.55),
      borderWidth: 1.2,
    });

    const initials = person.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    frontPage.drawRectangle({
      x: photoX + 11,
      y: photoY + 18,
      width: 32,
      height: 32,
      color: rgb(0.82, 0.88, 0.95),
    });
    frontPage.drawText(initials || "ID", {
      x: photoX + 18,
      y: photoY + 28,
      size: 13,
      font: bold,
      color: rgb(0.12, 0.25, 0.45),
    });
    frontPage.drawText("OFFICIAL PHOTO", {
      x: photoX + 6,
      y: photoY + 5,
      size: 5,
      font: bold,
      color: rgb(0.4, 0.5, 0.65),
    });

    // Name & Details
    frontPage.drawText(person.name, {
      x: 10,
      y: photoY - 14,
      size: 10,
      font: bold,
      color: rgb(0.08, 0.12, 0.2),
      maxWidth: width - 20,
    });

    let textY = photoY - 28;
    const drawFieldV = (label: string, value: string) => {
      frontPage.drawText(label, {
        x: 10,
        y: textY,
        size: 6,
        font: bold,
        color: rgb(0.45, 0.5, 0.6),
      });
      frontPage.drawText(value, {
        x: 48,
        y: textY,
        size: 6,
        font: bold,
        color: rgb(0.1, 0.15, 0.25),
        maxWidth: width - 52,
      });
      textY -= 8.5;
    };

    drawFieldV("ID / Adm:", person.idNumber);
    if (person.className || person.gradeLevelName) {
      drawFieldV("Class:", [person.className, person.gradeLevelName ? `(${person.gradeLevelName})` : null].filter(Boolean).join(" "));
    } else if (person.department) {
      drawFieldV("Dept:", person.department);
    }
    if (person.rollNumber) drawFieldV("Roll No:", person.rollNumber);
    if (person.bloodGroup) drawFieldV("Blood Grp:", person.bloodGroup);
    if (person.houseName) drawFieldV("House:", person.houseName);
    if (person.emergencyPhone) drawFieldV("Emerg Tel:", person.emergencyPhone);

    // Bottom barcode band
    frontPage.drawRectangle({
      x: 0,
      y: 0,
      width,
      height: 18,
      color: rgb(0.94, 0.95, 0.97),
    });
    frontPage.drawLine({
      start: { x: 0, y: 18 },
      end: { x: width, y: 18 },
      thickness: 0.5,
      color: rgb(0.82, 0.85, 0.9),
    });

    for (let i = 0; i < 20; i++) {
      const isThick = i % 3 === 0 || i % 7 === 0;
      frontPage.drawLine({
        start: { x: 10 + i * 2.6, y: 4 },
        end: { x: 10 + i * 2.6, y: 14 },
        thickness: isThick ? 1.5 : 0.8,
        color: rgb(0.15, 0.15, 0.2),
      });
    }

    frontPage.drawText(`EXP: ${options.validUpto || person.validThrough || "2026-2027"}`, {
      x: width - 68,
      y: 6.5,
      size: 5.5,
      font: bold,
      color: rgb(0.3, 0.35, 0.45),
    });

  } else {
    // ──────── HORIZONTAL LAYOUT ────────
    frontPage.drawRectangle({
      x: 0,
      y: height - 38,
      width,
      height: 38,
      color: rgb(0.08, 0.16, 0.32),
    });

    const stripColor = colorMode === "STRIP" && person.houseColor ? houseRgb : rgb(0.88, 0.72, 0.22);
    frontPage.drawRectangle({
      x: 0,
      y: height - 40,
      width,
      height: 2,
      color: stripColor,
    });

    frontPage.drawText(school.name, {
      x: 10,
      y: height - 18,
      size: 10,
      font: bold,
      color: COLOR.white,
      maxWidth: width - 20,
    });
    frontPage.drawText(`${person.role.toUpperCase()} IDENTITY CARD`, {
      x: 10,
      y: height - 30,
      size: 6.5,
      font: bold,
      color: stripColor,
    });

    // Photo frame on Left
    const photoX = 10;
    const photoY = height - 118;
    const photoW = 58;
    const photoH = 70;

    frontPage.drawRectangle({
      x: photoX,
      y: photoY,
      width: photoW,
      height: photoH,
      color: rgb(0.93, 0.95, 0.98),
      borderColor: rgb(0.2, 0.35, 0.55),
      borderWidth: 1.5,
    });

    const initials = person.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    frontPage.drawRectangle({
      x: photoX + 11,
      y: photoY + 24,
      width: 36,
      height: 36,
      color: rgb(0.82, 0.88, 0.95),
    });
    frontPage.drawText(initials || "ID", {
      x: photoX + 18,
      y: photoY + 36,
      size: 14,
      font: bold,
      color: rgb(0.12, 0.25, 0.45),
    });
    frontPage.drawText("OFFICIAL PHOTO", {
      x: photoX + 6,
      y: photoY + 8,
      size: 5.5,
      font: bold,
      color: rgb(0.4, 0.5, 0.65),
    });

    // Details Column
    const textX = 76;
    let textY = height - 54;

    frontPage.drawText(person.name, {
      x: textX,
      y: textY,
      size: 10.5,
      font: bold,
      color: rgb(0.08, 0.12, 0.2),
      maxWidth: width - textX - 8,
    });
    textY -= 12;

    // Role Pill Badge
    frontPage.drawRectangle({
      x: textX,
      y: textY - 2,
      width: 54,
      height: 11,
      color: rgb(0.9, 0.95, 1),
      borderColor: rgb(0.65, 0.8, 0.98),
      borderWidth: 0.5,
    });
    frontPage.drawText(person.role.toUpperCase(), {
      x: textX + 6,
      y: textY + 1,
      size: 6,
      font: bold,
      color: rgb(0.1, 0.35, 0.75),
    });
    textY -= 13;

    const drawFieldH = (label: string, value: string) => {
      frontPage.drawText(label, {
        x: textX,
        y: textY,
        size: 6.5,
        font: bold,
        color: rgb(0.45, 0.5, 0.6),
      });
      frontPage.drawText(value, {
        x: textX + 44,
        y: textY,
        size: 6.5,
        font: bold,
        color: rgb(0.1, 0.15, 0.25),
        maxWidth: width - (textX + 46),
      });
      textY -= 9;
    };

    drawFieldH("ID / Adm:", person.idNumber);

    if (person.className || person.gradeLevelName) {
      const classLabel = person.className
        ? `${person.className}${person.gradeLevelName ? ` (${person.gradeLevelName})` : ""}`
        : person.gradeLevelName || "—";
      drawFieldH("Class:", classLabel);
    } else if (person.department) {
      drawFieldH("Dept:", person.department);
    }

    if (person.rollNumber) drawFieldH("Roll No:", person.rollNumber);
    if (person.bloodGroup) drawFieldH("Blood Grp:", person.bloodGroup);
    if (person.houseName) drawFieldH("House:", person.houseName);
    if (person.dateOfBirth) drawFieldH("DOB:", person.dateOfBirth);

    // Bottom Barcode Band
    frontPage.drawRectangle({
      x: 0,
      y: 0,
      width,
      height: 18,
      color: rgb(0.94, 0.95, 0.97),
    });
    frontPage.drawLine({
      start: { x: 0, y: 18 },
      end: { x: width, y: 18 },
      thickness: 0.5,
      color: rgb(0.82, 0.85, 0.9),
    });

    const barStartX = 10;
    for (let i = 0; i < 28; i++) {
      const isThick = i % 3 === 0 || i % 7 === 0;
      frontPage.drawLine({
        start: { x: barStartX + i * 2.8, y: 4 },
        end: { x: barStartX + i * 2.8, y: 14 },
        thickness: isThick ? 1.5 : 0.8,
        color: rgb(0.15, 0.15, 0.2),
      });
    }

    frontPage.drawText(`EXP: ${options.validUpto || person.validThrough || "2026-2027"}`, {
      x: width - 82,
      y: 7,
      size: 6.5,
      font: bold,
      color: rgb(0.3, 0.35, 0.45),
    });
  }

  // ══════════════════════════════════════════════════════════════
  // PAGE 2: BACK SIDE
  // ══════════════════════════════════════════════════════════════
  if (printBack) {
    const backPage = doc.addPage([width, height]);
    backPage.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: rgb(0.98, 0.98, 0.99),
    });
    backPage.drawRectangle({
      x: 1,
      y: 1,
      width: width - 2,
      height: height - 2,
      borderColor: rgb(0.8, 0.84, 0.9),
      borderWidth: 1,
    });

    backPage.drawRectangle({
      x: 0,
      y: height - 16,
      width,
      height: 16,
      color: rgb(0.08, 0.16, 0.32),
    });
    backPage.drawText("TERMS & CONDITIONS", {
      x: 10,
      y: height - 11,
      size: 6.5,
      font: bold,
      color: COLOR.white,
    });

    let backY = height - 28;
    const terms = [
      "1. Property of " + school.name + ".",
      "2. Must be carried and displayed on campus at all times.",
      "3. Non-transferable. Loss must be reported immediately.",
      "4. If found, please return to the school administration office.",
    ];

    for (const t of terms) {
      backPage.drawText(t, {
        x: 10,
        y: backY,
        size: isVertical ? 5 : 5.5,
        font,
        color: rgb(0.3, 0.35, 0.4),
        maxWidth: width - 20,
      });
      backY -= isVertical ? 7.5 : 8;
    }

    if (person.emergencyPhone) {
      backPage.drawText(`Emergency Contact: ${person.emergencyPhone}`, {
        x: 10,
        y: backY - 2,
        size: 5.5,
        font: bold,
        color: rgb(0.8, 0.2, 0.2),
      });
      backY -= 10;
    }

    // Campus Contact Box
    backY -= 2;
    const boxHeight = isVertical ? 28 : 22;
    backPage.drawRectangle({
      x: 10,
      y: backY - boxHeight,
      width: width - 20,
      height: boxHeight,
      color: rgb(0.93, 0.95, 0.98),
      borderColor: rgb(0.85, 0.88, 0.93),
      borderWidth: 0.5,
    });

    const contactText = [
      school.address ? `Address: ${school.address}` : null,
      school.phone ? `Tel: ${school.phone}` : null,
      school.email ? `Email: ${school.email}` : null,
    ]
      .filter(Boolean)
      .join("  |  ");

    backPage.drawText("CAMPUS CONTACT INFO", {
      x: 14,
      y: backY - 7,
      size: 5,
      font: bold,
      color: rgb(0.12, 0.25, 0.45),
    });
    backPage.drawText(contactText || "School Administration Office", {
      x: 14,
      y: backY - 16,
      size: 4.8,
      font,
      color: rgb(0.35, 0.4, 0.48),
      maxWidth: width - 28,
    });

    // Principal Signature Line
    backPage.drawLine({
      start: { x: width - 85, y: 18 },
      end: { x: width - 15, y: 18 },
      thickness: 0.8,
      color: rgb(0.2, 0.25, 0.35),
    });
    backPage.drawText("Principal Signature", {
      x: width - 78,
      y: 11,
      size: 5.5,
      font: bold,
      color: rgb(0.3, 0.35, 0.45),
    });
  }
}

export async function generateIdCardPdf(data: IdCardData): Promise<Buffer> {
  const { doc, font, bold } = await newDoc();
  renderSingleIdCard(doc, font, bold, data.school, data.person, {
    layout: data.layout,
    colorMode: data.colorMode,
    validUpto: data.validUpto,
    printBack: data.printBack,
  });
  return Buffer.from(await doc.save());
}

export async function generateBatchIdCardsPdf(data: BatchIdCardsData): Promise<Buffer> {
  const { doc, font, bold } = await newDoc();
  for (const person of data.persons) {
    renderSingleIdCard(doc, font, bold, data.school, person, {
      layout: data.layout,
      colorMode: data.colorMode,
      validUpto: data.validUpto,
      printBack: data.printBack,
    });
  }
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

// ── 6. Cumulative Annual Report Card ─────────────────────────────────────────
export interface CumulativeReportCardData {
  school: SchoolHeader;
  student: {
    name: string;
    admissionNumber: string;
    rollNumber?: string | null;
    className: string;
    gradeLevelName?: string | null;
    gender?: string | null;
  };
  academicYear: string;
  summary: {
    overallAverage: number | null;
    overallRank: number | null;
    classSize?: number | null;
    isPassing: boolean;
    passMarkPercentage?: number;
    termBreakdown: {
      termId?: string;
      termName: string;
      gpa?: number | null;
      percentage?: number | null;
      rank?: number | null;
      totalMarks?: number | null;
    }[];
  };
  homeroomTeacherName?: string | null;
  principalName?: string | null;
  issueDate?: string | null;
  layout?: "ONE_SIDED" | "TWO_SIDED";
  backSideDetails?: {
    recentTermName?: string | null;
    subjects?: {
      subjectName: string;
      marksObtained: number;
      totalMarks: number;
      grade?: string | null;
    }[];
    teacherComments?: string | null;
    attendanceSummary?: {
      totalDays?: number;
      presentDays?: number;
      absentDays?: number;
      lateDays?: number;
      attendancePercentage?: number;
    } | null;
  };
}

export async function generateCumulativeReportCardPdf(
  data: CumulativeReportCardData,
): Promise<Buffer> {
  const { doc, font, bold } = await newDoc();
  let page = doc.addPage([PAGE.width, PAGE.height]);
  let y = drawHeader(
    page,
    bold,
    font,
    data.school,
    `Annual Academic Year Report Card — ${data.academicYear}`,
  );

  // Student details section
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
  labelValue(
    page,
    font,
    bold,
    180,
    y,
    "Class",
    [data.student.className, data.student.gradeLevelName ? `(${data.student.gradeLevelName})` : null]
      .filter(Boolean)
      .join(" "),
  );
  labelValue(
    page,
    font,
    bold,
    340,
    y,
    "Academic Year",
    data.academicYear,
  );
  if (data.student.rollNumber) {
    labelValue(page, font, bold, 460, y, "Roll No.", data.student.rollNumber);
  }
  y -= 42;

  // Section Header: Term-by-Term Performance
  page.drawText("ACADEMIC TERM BREAKDOWN", {
    x: 40,
    y,
    size: 10,
    font: bold,
    color: COLOR.navy,
  });
  y -= 14;

  // Table header
  const colX = { term: 40, gpa: 220, percentage: 320, rank: 440 };
  page.drawRectangle({
    x: 40,
    y: y - 4,
    width: PAGE.width - 80,
    height: 22,
    color: COLOR.lightGray,
  });
  page.drawText("Term / Semester", {
    x: colX.term + 8,
    y: y + 2,
    size: 9.5,
    font: bold,
    color: COLOR.black,
  });
  page.drawText("GPA (4.0)", {
    x: colX.gpa,
    y: y + 2,
    size: 9.5,
    font: bold,
    color: COLOR.black,
  });
  page.drawText("Score (%)", {
    x: colX.percentage,
    y: y + 2,
    size: 9.5,
    font: bold,
    color: COLOR.black,
  });
  page.drawText("Term Rank", {
    x: colX.rank,
    y: y + 2,
    size: 9.5,
    font: bold,
    color: COLOR.black,
  });
  y -= 26;

  const terms = data.summary.termBreakdown || [];
  if (terms.length === 0) {
    page.drawText("No term grade reports recorded for this academic year yet.", {
      x: 48,
      y,
      size: 9.5,
      font,
      color: COLOR.gray,
    });
    y -= 22;
  } else {
    for (const t of terms) {
      page.drawText(t.termName || "Academic Term", {
        x: colX.term + 8,
        y,
        size: 9.5,
        font: bold,
        color: COLOR.black,
      });
      page.drawText(t.gpa != null ? Number(t.gpa).toFixed(2) : "—", {
        x: colX.gpa,
        y,
        size: 9.5,
        font,
        color: COLOR.black,
      });
      page.drawText(
        t.percentage != null ? `${Number(t.percentage).toFixed(1)}%` : "—",
        {
          x: colX.percentage,
          y,
          size: 9.5,
          font: bold,
          color: COLOR.black,
        },
      );
      page.drawText(t.rank != null ? `#${t.rank}` : "—", {
        x: colX.rank,
        y,
        size: 9.5,
        font,
        color: COLOR.black,
      });

      y -= 8;
      page.drawLine({
        start: { x: 40, y },
        end: { x: PAGE.width - 40, y },
        thickness: 0.5,
        color: rgb(0.9, 0.9, 0.9),
      });
      y -= 16;
    }
  }

  y -= 10;

  // Cumulative Summary Box
  const summaryBoxHeight = 85;
  page.drawRectangle({
    x: 40,
    y: y - summaryBoxHeight,
    width: PAGE.width - 80,
    height: summaryBoxHeight,
    color: rgb(0.96, 0.97, 0.99),
    borderColor: rgb(0.8, 0.85, 0.93),
    borderWidth: 1,
  });

  page.drawText("CUMULATIVE ANNUAL SUMMARY", {
    x: 55,
    y: y - 18,
    size: 10,
    font: bold,
    color: COLOR.navy,
  });

  const avgStr =
    data.summary.overallAverage != null
      ? `${Number(data.summary.overallAverage).toFixed(1)}%`
      : "—";
  const rankStr =
    data.summary.overallRank != null
      ? `#${data.summary.overallRank}${data.summary.classSize ? ` / ${data.summary.classSize}` : ""}`
      : "—";
  const statusStr = data.summary.isPassing ? "PASSED / PROMOTED" : "RETAINED / UNDER REVIEW";
  const statusColor = data.summary.isPassing ? COLOR.green : COLOR.red;

  labelValue(page, font, bold, 55, y - 36, "Overall Average", avgStr);
  labelValue(page, font, bold, 210, y - 36, "Overall Class Rank", rankStr);
  labelValue(page, font, bold, 360, y - 36, "Academic Standing", statusStr);

  // Status Badge
  page.drawRectangle({
    x: 360,
    y: y - 72,
    width: 140,
    height: 18,
    color: data.summary.isPassing ? rgb(0.9, 0.97, 0.92) : rgb(0.99, 0.92, 0.92),
    borderColor: statusColor,
    borderWidth: 0.8,
  });
  page.drawText(statusStr, {
    x: 366,
    y: y - 66,
    size: 7.5,
    font: bold,
    color: statusColor,
  });

  y -= summaryBoxHeight + 35;

  // Signatures Section
  const dateText = data.issueDate || new Date().toLocaleDateString("en-GB");

  page.drawText("Class Teacher / Homeroom Signatory:", {
    x: 40,
    y,
    size: 8.5,
    font: bold,
    color: COLOR.gray,
  });
  page.drawText("Principal / School Authority:", {
    x: 320,
    y,
    size: 8.5,
    font: bold,
    color: COLOR.gray,
  });
  y -= 26;

  page.drawLine({
    start: { x: 40, y },
    end: { x: 250, y },
    thickness: 0.8,
    color: COLOR.gray,
  });
  page.drawLine({
    start: { x: 320, y },
    end: { x: 530, y },
    thickness: 0.8,
    color: COLOR.gray,
  });
  y -= 14;

  page.drawText(data.homeroomTeacherName || "Homeroom Teacher", {
    x: 40,
    y,
    size: 9.5,
    font: bold,
    color: COLOR.black,
  });
  page.drawText(data.principalName || "School Principal", {
    x: 320,
    y,
    size: 9.5,
    font: bold,
    color: COLOR.black,
  });
  y -= 12;

  page.drawText(`Date: ${dateText}`, {
    x: 40,
    y,
    size: 8,
    font,
    color: COLOR.gray,
  });
  page.drawText(`Date: ${dateText}`, {
    x: 320,
    y,
    size: 8,
    font,
    color: COLOR.gray,
  });

  drawFooter(page, font, `${data.school.name} — Cumulative Annual Report Card (Page 1 of ${data.layout === "TWO_SIDED" ? "2" : "1"})`);

  // ══════════════════════════════════════════════════════════════
  // BACK SIDE (TWO_SIDED LAYOUT)
  // ══════════════════════════════════════════════════════════════
  if (data.layout === "TWO_SIDED") {
    const backPage = doc.addPage([PAGE.width, PAGE.height]);
    let by = drawHeader(
      backPage,
      bold,
      font,
      data.school,
      `Annual Report Card — Supplementary Notes & Breakdown`,
    );

    // Subject Breakdown if provided
    if (data.backSideDetails?.subjects && data.backSideDetails.subjects.length > 0) {
      backPage.drawText(
        `SUBJECT ASSESSMENT DETAILS (${data.backSideDetails.recentTermName || "Latest Term"})`,
        {
          x: 40,
          y: by,
          size: 10,
          font: bold,
          color: COLOR.navy,
        },
      );
      by -= 16;

      const subCol = { name: 40, obtained: 300, total: 380, grade: 460 };
      backPage.drawRectangle({
        x: 40,
        y: by - 4,
        width: PAGE.width - 80,
        height: 18,
        color: COLOR.lightGray,
      });
      backPage.drawText("Subject", {
        x: subCol.name + 6,
        y: by,
        size: 9,
        font: bold,
        color: COLOR.black,
      });
      backPage.drawText("Marks", {
        x: subCol.obtained,
        y: by,
        size: 9,
        font: bold,
        color: COLOR.black,
      });
      backPage.drawText("Out of", {
        x: subCol.total,
        y: by,
        size: 9,
        font: bold,
        color: COLOR.black,
      });
      backPage.drawText("Grade", {
        x: subCol.grade,
        y: by,
        size: 9,
        font: bold,
        color: COLOR.black,
      });
      by -= 20;

      for (const s of data.backSideDetails.subjects) {
        backPage.drawText(s.subjectName, {
          x: subCol.name + 6,
          y: by,
          size: 9,
          font,
          color: COLOR.black,
        });
        backPage.drawText(String(s.marksObtained), {
          x: subCol.obtained,
          y: by,
          size: 9,
          font,
          color: COLOR.black,
        });
        backPage.drawText(String(s.totalMarks), {
          x: subCol.total,
          y: by,
          size: 9,
          font,
          color: COLOR.black,
        });
        backPage.drawText(s.grade ?? "—", {
          x: subCol.grade,
          y: by,
          size: 9,
          font,
          color: COLOR.black,
        });
        by -= 16;
      }
      by -= 15;
    }

    // Attendance Summary
    if (data.backSideDetails?.attendanceSummary) {
      const att = data.backSideDetails.attendanceSummary;
      backPage.drawText("ANNUAL ATTENDANCE SUMMARY", {
        x: 40,
        y: by,
        size: 10,
        font: bold,
        color: COLOR.navy,
      });
      by -= 16;

      backPage.drawRectangle({
        x: 40,
        y: by - 36,
        width: PAGE.width - 80,
        height: 36,
        color: rgb(0.97, 0.98, 0.99),
        borderColor: rgb(0.85, 0.88, 0.93),
        borderWidth: 0.8,
      });

      labelValue(backPage, font, bold, 55, by - 12, "Total Days", String(att.totalDays ?? "—"));
      labelValue(backPage, font, bold, 180, by - 12, "Present", String(att.presentDays ?? "—"));
      labelValue(backPage, font, bold, 300, by - 12, "Absent", String(att.absentDays ?? "—"));
      labelValue(
        backPage,
        font,
        bold,
        420,
        by - 12,
        "Attendance Rate",
        att.attendancePercentage != null ? `${att.attendancePercentage}%` : "—",
      );

      by -= 56;
    }

    // Teacher Comments
    if (data.backSideDetails?.teacherComments) {
      backPage.drawText("HOMEROOM TEACHER ANNUAL REMARKS", {
        x: 40,
        y: by,
        size: 10,
        font: bold,
        color: COLOR.navy,
      });
      by -= 16;

      backPage.drawRectangle({
        x: 40,
        y: by - 60,
        width: PAGE.width - 80,
        height: 60,
        color: rgb(0.98, 0.98, 0.99),
        borderColor: rgb(0.88, 0.9, 0.94),
        borderWidth: 0.8,
      });

      backPage.drawText(data.backSideDetails.teacherComments, {
        x: 52,
        y: by - 18,
        size: 9.5,
        font,
        color: rgb(0.15, 0.18, 0.25),
        maxWidth: PAGE.width - 104,
      });

      by -= 80;
    }

    drawFooter(backPage, font, `${data.school.name} — Cumulative Annual Report Card (Page 2 of 2)`);
  }

  return Buffer.from(await doc.save());
}

// ── 7. Certificate of Recognition & Graduation ────────────────────────────────
export interface CertificatePdfData {
  school: SchoolHeader;
  certificate: {
    id: string;
    type: "GRADUATION" | "RECOGNITION";
    recipientType: "STUDENT" | "STAFF";
    recipientName: string;
    recipientIdNumber?: string | null;
    recipientRole?: string | null;
    className?: string | null;
    academicYear?: string | null;
    title: string;
    reason?: string | null;
    issueDate: Date | string;
    layout?: "ONE_SIDED" | "TWO_SIDED";
    signerName?: string | null;
    signerTitle?: string | null;
    homeroomTeacherName?: string | null;
  };
  backSideDetails?: {
    academicSummary?: {
      overallAverage?: number | null;
      overallRank?: number | null;
      classSize?: number | null;
      termBreakdown?: {
        termName: string;
        percentage?: number | null;
        rank?: number | null;
      }[];
    } | null;
    extendedCitation?: string | null;
    commendations?: {
      date: string;
      title: string;
      points?: number;
    }[];
  };
}

export async function generateCertificatePdf(
  data: CertificatePdfData,
): Promise<Buffer> {
  const { doc, font, bold } = await newDoc();
  const timesFont = await doc.embedFont(StandardFonts.TimesRoman);
  const timesBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const timesItalic = await doc.embedFont(StandardFonts.TimesRomanItalic);

  // Landscape A4 dimensions: 841.89 x 595.28
  const width = PAGE.height;
  const height = PAGE.width;

  // ══════════════════════════════════════════════════════════════
  // PAGE 1: FRONT SIDE CERTIFICATE
  // ══════════════════════════════════════════════════════════════
  const page = doc.addPage([width, height]);

  // Background
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: rgb(0.99, 0.99, 0.98),
  });

  // Outer Border (Navy)
  const outerMargin = 22;
  page.drawRectangle({
    x: outerMargin,
    y: outerMargin,
    width: width - outerMargin * 2,
    height: height - outerMargin * 2,
    borderColor: rgb(0.08, 0.16, 0.32),
    borderWidth: 3.5,
  });

  // Inner Border (Gold)
  const innerMargin = 28;
  page.drawRectangle({
    x: innerMargin,
    y: innerMargin,
    width: width - innerMargin * 2,
    height: height - innerMargin * 2,
    borderColor: rgb(0.85, 0.68, 0.22),
    borderWidth: 1.2,
  });

  // Top Corner Accents
  const cornerSize = 16;
  const drawCorner = (cx: number, cy: number) => {
    page.drawRectangle({
      x: cx - 4,
      y: cy - 4,
      width: 8,
      height: 8,
      color: rgb(0.85, 0.68, 0.22),
    });
  };
  drawCorner(innerMargin, innerMargin);
  drawCorner(width - innerMargin, innerMargin);
  drawCorner(innerMargin, height - innerMargin);
  drawCorner(width - innerMargin, height - innerMargin);

  // School Header
  let cy = height - 75;
  const schoolName = data.school.name.toUpperCase();
  const schoolNameWidth = bold.widthOfTextAtSize(schoolName, 15);
  page.drawText(schoolName, {
    x: (width - schoolNameWidth) / 2,
    y: cy,
    size: 15,
    font: bold,
    color: rgb(0.08, 0.16, 0.32),
  });
  cy -= 16;

  const schoolContact = [data.school.address, data.school.phone, data.school.email]
    .filter(Boolean)
    .join("  •  ");
  if (schoolContact) {
    const contactWidth = font.widthOfTextAtSize(schoolContact, 8);
    page.drawText(schoolContact, {
      x: (width - contactWidth) / 2,
      y: cy,
      size: 8,
      font,
      color: COLOR.gray,
    });
    cy -= 16;
  }

  // Decorative Golden Line
  page.drawLine({
    start: { x: width / 2 - 160, y: cy + 4 },
    end: { x: width / 2 + 160, y: cy + 4 },
    thickness: 1.2,
    color: rgb(0.85, 0.68, 0.22),
  });
  cy -= 20;

  // Certificate Type / Title
  const isGraduation = data.certificate.type === "GRADUATION";
  const certHeader = isGraduation
    ? "CERTIFICATE OF GRADUATION"
    : "CERTIFICATE OF RECOGNITION";
  const headerWidth = timesBold.widthOfTextAtSize(certHeader, 14);
  page.drawText(certHeader, {
    x: (width - headerWidth) / 2,
    y: cy,
    size: 14,
    font: timesBold,
    color: rgb(0.72, 0.55, 0.15),
  });
  cy -= 24;

  // Specific Title (e.g. "Academic Excellence Award")
  const specificTitle = data.certificate.title.toUpperCase();
  const titleWidth = bold.widthOfTextAtSize(specificTitle, 17);
  page.drawText(specificTitle, {
    x: (width - titleWidth) / 2,
    y: cy,
    size: 17,
    font: bold,
    color: rgb(0.08, 0.16, 0.32),
  });
  cy -= 28;

  // "PROUDLY PRESENTED TO"
  const presentText = "THIS CERTIFICATE IS PROUDLY PRESENTED TO";
  const presentWidth = font.widthOfTextAtSize(presentText, 9.5);
  page.drawText(presentText, {
    x: (width - presentWidth) / 2,
    y: cy,
    size: 9.5,
    font,
    color: rgb(0.4, 0.45, 0.55),
  });
  cy -= 36;

  // Recipient Name
  const recipientName = data.certificate.recipientName;
  const nameWidth = timesBold.widthOfTextAtSize(recipientName, 26);
  page.drawText(recipientName, {
    x: (width - nameWidth) / 2,
    y: cy,
    size: 26,
    font: timesBold,
    color: rgb(0.08, 0.16, 0.32),
  });
  cy -= 6;

  // Underline beneath recipient name
  const underLineWidth = Math.max(nameWidth + 60, 300);
  page.drawLine({
    start: { x: (width - underLineWidth) / 2, y: cy },
    end: { x: (width + underLineWidth) / 2, y: cy },
    thickness: 1,
    color: rgb(0.85, 0.68, 0.22),
  });
  cy -= 22;

  // Recipient Subtitle (Class, Role, or ID)
  const subInfo = [
    data.certificate.className ? `Class: ${data.certificate.className}` : null,
    data.certificate.recipientRole ? `Role: ${data.certificate.recipientRole}` : null,
    data.certificate.recipientIdNumber ? `ID: ${data.certificate.recipientIdNumber}` : null,
    data.certificate.academicYear ? `Academic Year: ${data.certificate.academicYear}` : null,
  ]
    .filter(Boolean)
    .join("  |  ");

  if (subInfo) {
    const subWidth = font.widthOfTextAtSize(subInfo, 9);
    page.drawText(subInfo, {
      x: (width - subWidth) / 2,
      y: cy,
      size: 9,
      font,
      color: COLOR.gray,
    });
    cy -= 22;
  }

  // Reason / Citation Paragraph
  const defaultReason = isGraduation
    ? `For successfully meeting and exceeding all academic curriculum requirements and demonstrating outstanding character, dedication, and scholarship throughout the academic year.`
    : `In sincere recognition of exemplary performance, noteworthy leadership, and valuable contributions to our school community.`;
  const reasonText = data.certificate.reason || defaultReason;

  const citationWidth = timesItalic.widthOfTextAtSize(reasonText, 11);
  if (citationWidth < width - 180) {
    page.drawText(reasonText, {
      x: (width - citationWidth) / 2,
      y: cy,
      size: 11,
      font: timesItalic,
      color: rgb(0.2, 0.22, 0.28),
    });
  } else {
    page.drawText(reasonText, {
      x: 90,
      y: cy,
      size: 10.5,
      font: timesItalic,
      color: rgb(0.2, 0.22, 0.28),
      maxWidth: width - 180,
    });
  }

  // Bottom Signatures & Seal
  const sigY = 90;
  const leftSigX = 90;
  const rightSigX = width - 290;
  const lineLen = 200;

  // Left Signer Line
  page.drawLine({
    start: { x: leftSigX, y: sigY },
    end: { x: leftSigX + lineLen, y: sigY },
    thickness: 1,
    color: rgb(0.3, 0.35, 0.45),
  });
  page.drawText(data.certificate.homeroomTeacherName || data.certificate.signerName || "Authorized Signatory", {
    x: leftSigX + 10,
    y: sigY - 14,
    size: 9.5,
    font: bold,
    color: rgb(0.1, 0.15, 0.25),
  });
  page.drawText(data.certificate.homeroomTeacherName ? "Class Teacher / Homeroom" : "Department Head / Signatory", {
    x: leftSigX + 10,
    y: sigY - 26,
    size: 8,
    font,
    color: COLOR.gray,
  });

  // Right Signer Line
  page.drawLine({
    start: { x: rightSigX, y: sigY },
    end: { x: rightSigX + lineLen, y: sigY },
    thickness: 1,
    color: rgb(0.3, 0.35, 0.45),
  });
  page.drawText(data.certificate.signerName || "School Principal", {
    x: rightSigX + 10,
    y: sigY - 14,
    size: 9.5,
    font: bold,
    color: rgb(0.1, 0.15, 0.25),
  });
  page.drawText(data.certificate.signerTitle || "Head of School / Director", {
    x: rightSigX + 10,
    y: sigY - 26,
    size: 8,
    font,
    color: COLOR.gray,
  });

  // Center Seal Emblem
  const sealCenterX = width / 2;
  const sealY = sigY - 10;
  page.drawCircle({
    x: sealCenterX,
    y: sealY,
    size: 24,
    color: rgb(0.96, 0.92, 0.8),
    borderColor: rgb(0.85, 0.68, 0.22),
    borderWidth: 1.5,
  });
  page.drawText("OFFICIAL", {
    x: sealCenterX - 14,
    y: sealY + 2,
    size: 6,
    font: bold,
    color: rgb(0.65, 0.48, 0.12),
  });
  page.drawText("SEAL", {
    x: sealCenterX - 8,
    y: sealY - 7,
    size: 6,
    font: bold,
    color: rgb(0.65, 0.48, 0.12),
  });

  // Date & Certificate ID Footer
  const issueDateStr = new Date(data.certificate.issueDate).toLocaleDateString("en-GB");
  page.drawText(`Issued: ${issueDateStr}`, {
    x: 40,
    y: 35,
    size: 7.5,
    font,
    color: COLOR.gray,
  });
  page.drawText(`Certificate ID: ${data.certificate.id.slice(0, 13).toUpperCase()}`, {
    x: width - 200,
    y: 35,
    size: 7.5,
    font,
    color: COLOR.gray,
  });

  // ══════════════════════════════════════════════════════════════
  // PAGE 2: BACK SIDE (TWO_SIDED LAYOUT)
  // ══════════════════════════════════════════════════════════════
  if (data.certificate.layout === "TWO_SIDED") {
    const backPage = doc.addPage([width, height]);
    backPage.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: rgb(0.99, 0.99, 0.98),
    });

    backPage.drawRectangle({
      x: outerMargin,
      y: outerMargin,
      width: width - outerMargin * 2,
      height: height - outerMargin * 2,
      borderColor: rgb(0.8, 0.84, 0.9),
      borderWidth: 1.5,
    });

    let bcy = height - 60;
    backPage.drawText("CERTIFICATE ATTESTATION & OFFICIAL RECORD", {
      x: 50,
      y: bcy,
      size: 13,
      font: bold,
      color: COLOR.navy,
    });
    bcy -= 16;
    backPage.drawText(
      `Permanent Record for ${data.certificate.recipientName}  •  ${data.school.name}`,
      { x: 50, y: bcy, size: 9, font, color: COLOR.gray },
    );
    bcy -= 30;

    // Academic Record for Graduation
    if (data.backSideDetails?.academicSummary) {
      const summ = data.backSideDetails.academicSummary;
      backPage.drawText("ANNUAL ACADEMIC PERFORMANCE SUMMARY", {
        x: 50,
        y: bcy,
        size: 10,
        font: bold,
        color: COLOR.navy,
      });
      bcy -= 16;

      backPage.drawRectangle({
        x: 50,
        y: bcy - 40,
        width: width - 100,
        height: 40,
        color: rgb(0.96, 0.97, 0.99),
        borderColor: rgb(0.85, 0.88, 0.93),
        borderWidth: 0.8,
      });

      const avgText = summ.overallAverage != null ? `${Number(summ.overallAverage).toFixed(1)}%` : "—";
      const rankText = summ.overallRank != null ? `#${summ.overallRank}${summ.classSize ? ` of ${summ.classSize}` : ""}` : "—";

      labelValue(backPage, font, bold, 70, bcy - 14, "Cumulative Average", avgText);
      labelValue(backPage, font, bold, 260, bcy - 14, "Class Rank", rankText);
      labelValue(backPage, font, bold, 450, bcy - 14, "Graduation Eligibility", "PASSED & CONFIRMED");

      bcy -= 60;

      if (summ.termBreakdown && summ.termBreakdown.length > 0) {
        backPage.drawText("TERM PERFORMANCE RECORD", {
          x: 50,
          y: bcy,
          size: 9.5,
          font: bold,
          color: COLOR.navy,
        });
        bcy -= 14;

        for (const tb of summ.termBreakdown) {
          backPage.drawText(`• ${tb.termName}: ${tb.percentage != null ? `${Number(tb.percentage).toFixed(1)}%` : "—"} (Rank: ${tb.rank != null ? `#${tb.rank}` : "—"})`, {
            x: 60,
            y: bcy,
            size: 9,
            font,
            color: COLOR.black,
          });
          bcy -= 14;
        }
        bcy -= 16;
      }
    }

    // Extended Citation / Commendations
    if (data.backSideDetails?.extendedCitation) {
      backPage.drawText("OFFICIAL CITATION & COMMENDATIONS", {
        x: 50,
        y: bcy,
        size: 10,
        font: bold,
        color: COLOR.navy,
      });
      bcy -= 16;

      backPage.drawRectangle({
        x: 50,
        y: bcy - 80,
        width: width - 100,
        height: 80,
        color: rgb(0.98, 0.98, 0.99),
        borderColor: rgb(0.88, 0.9, 0.94),
        borderWidth: 0.8,
      });

      backPage.drawText(data.backSideDetails.extendedCitation, {
        x: 65,
        y: bcy - 20,
        size: 9.5,
        font,
        color: rgb(0.2, 0.22, 0.28),
        maxWidth: width - 130,
      });
      bcy -= 100;
    }

    // Verification Footer
    backPage.drawText(
      `This document is an authentic certified academic record issued by ${data.school.name}. Verification available upon request with Certificate ID ${data.certificate.id}.`,
      {
        x: 50,
        y: 40,
        size: 7.5,
        font,
        color: COLOR.gray,
        maxWidth: width - 100,
      },
    );
  }

  return Buffer.from(await doc.save());
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. ANNUAL SCHEME OF WORK & CURRICULUM PLAN PDF (A4 Landscape)
// ─────────────────────────────────────────────────────────────────────────────

export interface AnnualPlanPdfData {
  school: {
    name: string;
    logo?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  plan: {
    id: string;
    title: string;
    scope: "TEACHER_SUBJECT" | "SCHOOL_WIDE";
    academicYear: string;
    status: string;
    authorName: string;
    authorRole?: string | null;
    subjectName?: string | null;
    className?: string | null;
    gradeLevelName?: string | null;
    columns: string[];
    rows: any[];
    reviewedByName?: string | null;
    reviewNotes?: string | null;
    submittedAt?: Date | string | null;
    reviewedAt?: Date | string | null;
    createdAt?: Date | string | null;
  };
}

export async function generateAnnualPlanPdf(
  data: AnnualPlanPdfData,
): Promise<Buffer> {
  await loadPdfLib();
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  // A4 Landscape: 841.89 x 595.28 points
  const width = 841.89;
  const height = 595.28;
  const margin = 40;
  const contentWidth = width - margin * 2;

  const rawColumns = Array.isArray(data.plan.columns) && data.plan.columns.length > 0
    ? data.plan.columns
    : ["Term", "Topic / Unit", "Learning Objectives", "Teaching Activities", "Resources", "Assessment", "Duration"];

  const rawRows = Array.isArray(data.plan.rows) ? data.plan.rows : [];

  // Determine column widths
  const numCols = rawColumns.length;
  const colWidth = contentWidth / numCols;

  const rowsPerPage = 12;
  const totalPages = Math.max(1, Math.ceil(rawRows.length / rowsPerPage));

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const page = doc.addPage([width, height]);
    let y = height - margin;

    // Header on every page
    // School Name & Header Title
    page.drawText(data.school.name.toUpperCase(), {
      x: margin,
      y,
      size: 14,
      font: bold,
      color: COLOR.navy,
    });

    const pageStr = `Page ${pageIdx + 1} of ${totalPages}`;
    page.drawText(pageStr, {
      x: width - margin - font.widthOfTextAtSize(pageStr, 8),
      y,
      size: 8,
      font,
      color: COLOR.gray,
    });

    y -= 14;

    page.drawText(
      `ANNUAL SCHEME OF WORK & CURRICULUM PLAN — ACADEMIC YEAR ${data.plan.academicYear}`,
      {
        x: margin,
        y,
        size: 9,
        font: bold,
        color: COLOR.gray,
      },
    );

    y -= 18;

    // Plan Title Banner (Only on page 1)
    if (pageIdx === 0) {
      page.drawRectangle({
        x: margin,
        y: y - 36,
        width: contentWidth,
        height: 36,
        color: rgb(0.96, 0.97, 0.99),
        borderColor: rgb(0.85, 0.88, 0.93),
        borderWidth: 0.8,
      });

      page.drawText(data.plan.title, {
        x: margin + 12,
        y: y - 16,
        size: 11,
        font: bold,
        color: COLOR.navy,
        maxWidth: contentWidth - 160,
      });

      // Metadata items
      const metaLine1 = [
        data.plan.scope === "TEACHER_SUBJECT" ? `Subject: ${data.plan.subjectName || "—"}` : "Scope: School-Wide Plan",
        data.plan.className ? `Class: ${data.plan.className}` : data.plan.gradeLevelName ? `Grade: ${data.plan.gradeLevelName}` : null,
        `Teacher / Author: ${data.plan.authorName}`,
      ]
        .filter(Boolean)
        .join("  |  ");

      page.drawText(metaLine1, {
        x: margin + 12,
        y: y - 28,
        size: 8,
        font,
        color: COLOR.gray,
      });

      // Status Badge
      const statusText = data.plan.status;
      const statusBg =
        statusText === "APPROVED"
          ? rgb(0.85, 0.95, 0.88)
          : statusText === "SUBMITTED"
            ? rgb(0.88, 0.92, 0.98)
            : rgb(0.98, 0.92, 0.85);
      const statusColor =
        statusText === "APPROVED"
          ? rgb(0.1, 0.5, 0.2)
          : statusText === "SUBMITTED"
            ? rgb(0.1, 0.3, 0.7)
            : rgb(0.7, 0.4, 0.1);

      page.drawRectangle({
        x: width - margin - 100,
        y: y - 26,
        width: 88,
        height: 18,
        color: statusBg,
        borderRadius: 4,
      });

      page.drawText(statusText, {
        x: width - margin - 90,
        y: y - 19,
        size: 7.5,
        font: bold,
        color: statusColor,
      });

      y -= 46;
    }

    // ── Table Header ──
    const tableHeaderHeight = 22;
    page.drawRectangle({
      x: margin,
      y: y - tableHeaderHeight,
      width: contentWidth,
      height: tableHeaderHeight,
      color: COLOR.navy,
    });

    rawColumns.forEach((colName, colIdx) => {
      const cx = margin + colIdx * colWidth + 6;
      page.drawText(String(colName).toUpperCase(), {
        x: cx,
        y: y - 15,
        size: 7.5,
        font: bold,
        color: COLOR.white,
        maxWidth: colWidth - 10,
      });
    });

    y -= tableHeaderHeight;

    // ── Table Rows for this page ──
    const pageRows = rawRows.slice(
      pageIdx * rowsPerPage,
      (pageIdx + 1) * rowsPerPage,
    );

    const rowHeight = 22;

    pageRows.forEach((row, rowIdx) => {
      const isEven = rowIdx % 2 === 0;
      page.drawRectangle({
        x: margin,
        y: y - rowHeight,
        width: contentWidth,
        height: rowHeight,
        color: isEven ? COLOR.white : rgb(0.97, 0.98, 0.99),
        borderColor: rgb(0.88, 0.9, 0.93),
        borderWidth: 0.5,
      });

      rawColumns.forEach((colKey, colIdx) => {
        let cellVal = "";
        if (Array.isArray(row)) {
          cellVal = row[colIdx] != null ? String(row[colIdx]) : "";
        } else if (typeof row === "object" && row !== null) {
          cellVal =
            row[colKey] != null
              ? String(row[colKey])
              : row[colIdx] != null
                ? String(row[colIdx])
                : "";
        }

        const cx = margin + colIdx * colWidth + 6;
        page.drawText(cellVal, {
          x: cx,
          y: y - 14,
          size: 7.5,
          font,
          color: rgb(0.15, 0.18, 0.22),
          maxWidth: colWidth - 10,
        });
      });

      y -= rowHeight;
    });

    // ── Bottom Signatures (On final page) ──
    if (pageIdx === totalPages - 1) {
      const sigY = 60;

      // Teacher / Author Signature Line
      page.drawLine({
        start: { x: margin + 30, y: sigY },
        end: { x: margin + 220, y: sigY },
        thickness: 0.8,
        color: COLOR.gray,
      });
      page.drawText(`Author / Subject Teacher: ${data.plan.authorName}`, {
        x: margin + 30,
        y: sigY - 12,
        size: 7.5,
        font: bold,
        color: COLOR.navy,
      });
      page.drawText("Signature & Date", {
        x: margin + 30,
        y: sigY - 22,
        size: 6.5,
        font,
        color: COLOR.gray,
      });

      // Reviewer / Academic Principal Line
      page.drawLine({
        start: { x: width - margin - 220, y: sigY },
        end: { x: width - margin - 30, y: sigY },
        thickness: 0.8,
        color: COLOR.gray,
      });
      page.drawText(
        `Academic Supervisor / Principal: ${data.plan.reviewedByName || "Academic Reviewer"}`,
        {
          x: width - margin - 220,
          y: sigY - 12,
          size: 7.5,
          font: bold,
          color: COLOR.navy,
        },
      );
      page.drawText(
        data.plan.status === "APPROVED"
          ? `APPROVED${data.plan.reviewedAt ? ` on ${new Date(data.plan.reviewedAt).toLocaleDateString()}` : ""}`
          : "Review Stamp & Date",
        {
          x: width - margin - 220,
          y: sigY - 22,
          size: 6.5,
          font,
          color: COLOR.gray,
        },
      );
    }
  }

  return Buffer.from(await doc.save());
}

// ─────────────────────────────────────────────────────────────────────────────
// CEREMONY & GRADUATION PROGRAM PDF GENERATION
// ─────────────────────────────────────────────────────────────────────────────

export interface CeremonyProgramPdfData {
  school: SchoolHeader;
  ceremony: {
    title: string;
    type: string;
    academicYear: string;
    ceremonyDate?: Date | string | null;
    venue?: string | null;
    attireNote?: string | null;
    program?: string | null;
    gradeLevelName?: string | null;
  };
  participants: Array<{
    name: string;
    admissionNumber?: string | null;
    className?: string | null;
    attendanceConfirmed?: boolean;
    certificateIssued?: boolean;
  }>;
}

export async function generateCeremonyProgramPdf(
  data: CeremonyProgramPdfData,
): Promise<Buffer> {
  await loadPdfLib();
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const oblique = await doc.embedFont(StandardFonts.HelveticaOblique);

  // A4 Portrait
  const width = PAGE.width;
  const height = PAGE.height;
  const margin = 40;
  const contentWidth = width - margin * 2;

  const participants = data.participants || [];
  const participantsPerPage = 22;
  const totalPages = Math.max(1, Math.ceil(participants.length / participantsPerPage));

  const formatCeremonyDate = (d: Date | string | null | undefined) => {
    if (!d) return "Date to be announced";
    const dateObj = typeof d === "string" ? new Date(d) : d;
    return dateObj.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const page = doc.addPage([width, height]);
    let y = height - margin;

    // ── Page Border & Decorative Accents ──
    page.drawRectangle({
      x: margin - 15,
      y: margin - 15,
      width: contentWidth + 30,
      height: height - (margin - 15) * 2,
      borderColor: COLOR.navy,
      borderWidth: 1.5,
    });
    page.drawRectangle({
      x: margin - 11,
      y: margin - 11,
      width: contentWidth + 22,
      height: height - (margin - 11) * 2,
      borderColor: rgb(0.85, 0.75, 0.5), // Gold-tinted inner frame
      borderWidth: 0.75,
    });

    // ── Header (Every Page) ──
    page.drawText(data.school.name.toUpperCase(), {
      x: width / 2 - bold.widthOfTextAtSize(data.school.name.toUpperCase(), 15) / 2,
      y,
      size: 15,
      font: bold,
      color: COLOR.navy,
    });
    y -= 14;

    const subHeader = [data.school.address, data.school.phone, data.school.email]
      .filter(Boolean)
      .join("  •  ");
    if (subHeader) {
      page.drawText(subHeader, {
        x: width / 2 - font.widthOfTextAtSize(subHeader, 7.5) / 2,
        y,
        size: 7.5,
        font,
        color: COLOR.gray,
      });
      y -= 14;
    }

    // Page Number
    const pageStr = `Page ${pageIdx + 1} of ${totalPages}`;
    page.drawText(pageStr, {
      x: width - margin - font.widthOfTextAtSize(pageStr, 7.5),
      y: height - margin + 2,
      size: 7.5,
      font,
      color: COLOR.gray,
    });

    // ── Title Banner (Page 1 Only) ──
    if (pageIdx === 0) {
      y -= 6;
      page.drawRectangle({
        x: margin,
        y: y - 56,
        width: contentWidth,
        height: 56,
        color: rgb(0.95, 0.96, 0.98),
        borderColor: COLOR.navy,
        borderWidth: 1,
      });

      const titleText = data.ceremony.title.toUpperCase();
      page.drawText(titleText, {
        x: width / 2 - bold.widthOfTextAtSize(titleText, 13) / 2,
        y: y - 18,
        size: 13,
        font: bold,
        color: COLOR.navy,
      });

      const metaText = `OFFICIAL CEREMONY PROGRAM  |  ACADEMIC YEAR: ${data.ceremony.academicYear}${
        data.ceremony.gradeLevelName ? `  |  ${data.ceremony.gradeLevelName.toUpperCase()}` : ""
      }`;
      page.drawText(metaText, {
        x: width / 2 - bold.widthOfTextAtSize(metaText, 8.5) / 2,
        y: y - 34,
        size: 8.5,
        font: bold,
        color: rgb(0.3, 0.35, 0.45),
      });

      const eventDetails = `Date: ${formatCeremonyDate(data.ceremony.ceremonyDate)}   •   Venue: ${data.ceremony.venue || "School Main Auditorium"}`;
      page.drawText(eventDetails, {
        x: width / 2 - font.widthOfTextAtSize(eventDetails, 8) / 2,
        y: y - 48,
        size: 8,
        font,
        color: COLOR.gray,
      });

      y -= 70;

      // Attire Note if provided
      if (data.ceremony.attireNote) {
        const attireText = `Attire Note: ${data.ceremony.attireNote}`;
        page.drawText(attireText, {
          x: margin + 4,
          y,
          size: 8,
          font: oblique,
          color: rgb(0.2, 0.4, 0.3),
        });
        y -= 14;
      }

      // Order of Program / Agenda
      if (data.ceremony.program) {
        page.drawText("ORDER OF PROGRAM & AGENDA", {
          x: margin,
          y,
          size: 8.5,
          font: bold,
          color: COLOR.navy,
        });
        y -= 12;

        const programLines = data.ceremony.program.split("\n").filter((l) => l.trim().length > 0);
        for (const line of programLines.slice(0, 4)) {
          page.drawText(`• ${line.trim()}`, {
            x: margin + 8,
            y,
            size: 7.5,
            font,
            color: COLOR.black,
            maxWidth: contentWidth - 16,
          });
          y -= 11;
        }
        y -= 6;
      }
    } else {
      y -= 10;
    }

    // ── Participants Roster Section ──
    page.drawText(
      `HONORED CANDIDATES & PARTICIPANTS (${participants.length} Total)`,
      {
        x: margin,
        y,
        size: 9,
        font: bold,
        color: COLOR.navy,
      },
    );
    y -= 14;

    // Table Header
    const colX = {
      no: margin + 6,
      name: margin + 35,
      admNo: margin + 240,
      className: margin + 335,
      status: margin + 430,
    };

    page.drawRectangle({
      x: margin,
      y: y - 16,
      width: contentWidth,
      height: 16,
      color: COLOR.navy,
    });

    page.drawText("#", { x: colX.no, y: y - 12, size: 7.5, font: bold, color: COLOR.white });
    page.drawText("STUDENT FULL NAME", { x: colX.name, y: y - 12, size: 7.5, font: bold, color: COLOR.white });
    page.drawText("ADMISSION NO.", { x: colX.admNo, y: y - 12, size: 7.5, font: bold, color: COLOR.white });
    page.drawText("CLASS / SECTION", { x: colX.className, y: y - 12, size: 7.5, font: bold, color: COLOR.white });
    page.drawText("STATUS", { x: colX.status, y: y - 12, size: 7.5, font: bold, color: COLOR.white });

    y -= 20;

    const pageStart = pageIdx * participantsPerPage;
    const pageParticipants = participants.slice(pageStart, pageStart + participantsPerPage);

    pageParticipants.forEach((p, idx) => {
      const globalIndex = pageStart + idx + 1;
      const isEven = idx % 2 === 0;

      if (isEven) {
        page.drawRectangle({
          x: margin,
          y: y - 13,
          width: contentWidth,
          height: 15,
          color: rgb(0.97, 0.98, 0.99),
        });
      }

      page.drawText(`${globalIndex}`, {
        x: colX.no,
        y: y - 9,
        size: 7.5,
        font,
        color: COLOR.gray,
      });

      page.drawText(p.name, {
        x: colX.name,
        y: y - 9,
        size: 8,
        font: bold,
        color: COLOR.black,
        maxWidth: 200,
      });

      page.drawText(p.admissionNumber || "—", {
        x: colX.admNo,
        y: y - 9,
        size: 7.5,
        font,
        color: COLOR.gray,
      });

      page.drawText(p.className || "—", {
        x: colX.className,
        y: y - 9,
        size: 7.5,
        font,
        color: COLOR.black,
      });

      const statusText = p.certificateIssued
        ? "CERTIFICATE ISSUED"
        : p.attendanceConfirmed
        ? "CONFIRMED"
        : "ENROLLED";

      page.drawText(statusText, {
        x: colX.status,
        y: y - 9,
        size: 7,
        font: bold,
        color: p.certificateIssued ? COLOR.green : COLOR.navy,
      });

      y -= 16;
    });

    // ── Signatures & Seal on Final Page ──
    if (pageIdx === totalPages - 1) {
      const sigY = margin + 35;

      page.drawLine({
        start: { x: margin + 20, y: sigY },
        end: { x: margin + 200, y: sigY },
        thickness: 0.8,
        color: COLOR.gray,
      });
      page.drawText("Head of Academic Committee", {
        x: margin + 20,
        y: sigY - 12,
        size: 7.5,
        font: bold,
        color: COLOR.navy,
      });
      page.drawText("Signature & Date", {
        x: margin + 20,
        y: sigY - 22,
        size: 6.5,
        font,
        color: COLOR.gray,
      });

      page.drawLine({
        start: { x: width - margin - 200, y: sigY },
        end: { x: width - margin - 20, y: sigY },
        thickness: 0.8,
        color: COLOR.gray,
      });
      page.drawText("School Director / Principal", {
        x: width - margin - 200,
        y: sigY - 12,
        size: 7.5,
        font: bold,
        color: COLOR.navy,
      });
      page.drawText("Official School Seal & Signature", {
        x: width - margin - 200,
        y: sigY - 22,
        size: 6.5,
        font,
        color: COLOR.gray,
      });
    }
  }

  return Buffer.from(await doc.save());
}

export interface JobOfferPdfData {
  offerNumber: string;
  candidateName: string;
  candidateEmail?: string | null;
  candidatePhone?: string | null;
  positionTitle: string;
  departmentName?: string | null;
  employmentType: string;
  offeredSalary: number;
  salaryPeriod?: string;
  startDate: Date | string;
  probationMonths?: number;
  benefits?: string | null;
  conditions?: string | null;
  expiresAt?: Date | string | null;
}

export async function generateJobOfferLetterPdf(
  school: SchoolHeader,
  offer: JobOfferPdfData,
): Promise<Buffer> {
  const { doc, font, bold } = await newDoc();
  const page = doc.addPage([PAGE.width, PAGE.height]);
  const { width, height } = page.getSize();
  const margin = 45;

  // Header banner
  page.drawRectangle({
    x: 0,
    y: height - 100,
    width,
    height: 100,
    color: COLOR.navy,
  });

  page.drawText(school.name, {
    x: margin,
    y: height - 42,
    size: 20,
    font: bold,
    color: COLOR.white,
  });

  const contactLine = [school.address, school.phone, school.email]
    .filter(Boolean)
    .join("  ·  ");
  if (contactLine) {
    page.drawText(contactLine, {
      x: margin,
      y: height - 60,
      size: 9,
      font,
      color: rgb(0.85, 0.88, 0.93),
    });
  }

  page.drawText("OFFICIAL APPOINTMENT & JOB OFFER LETTER", {
    x: margin,
    y: height - 85,
    size: 11,
    font: bold,
    color: rgb(0.95, 0.77, 0.06), // Gold accent
  });

  let y = height - 130;

  // Ref & Date row
  const formattedDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  page.drawText(`Ref: ${offer.offerNumber}`, {
    x: margin,
    y,
    size: 9.5,
    font: bold,
    color: COLOR.navy,
  });
  page.drawText(`Date: ${formattedDate}`, {
    x: width - margin - 130,
    y,
    size: 9.5,
    font,
    color: COLOR.gray,
  });

  y -= 30;

  // Recipient info
  page.drawText("To Candidate:", {
    x: margin,
    y,
    size: 9.5,
    font: bold,
    color: COLOR.navy,
  });
  y -= 14;
  page.drawText(offer.candidateName, {
    x: margin,
    y,
    size: 13,
    font: bold,
    color: COLOR.black,
  });
  y -= 14;
  if (offer.candidateEmail || offer.candidatePhone) {
    const candContact = [offer.candidateEmail, offer.candidatePhone]
      .filter(Boolean)
      .join("  |  ");
    page.drawText(candContact, {
      x: margin,
      y,
      size: 9,
      font,
      color: COLOR.gray,
    });
    y -= 14;
  }

  y -= 10;

  // Greeting & Opening
  page.drawText(`Dear ${offer.candidateName},`, {
    x: margin,
    y,
    size: 10.5,
    font: bold,
    color: COLOR.black,
  });
  y -= 18;

  const introText =
    `We are delighted to extend to you this formal offer of employment with ${school.name}. ` +
    `Following your application and successful interview evaluations, our leadership and academic board ` +
    `were thoroughly impressed by your credentials, character, and dedication to excellence in education.`;

  // Draw wrapped paragraph
  const words = introText.split(" ");
  let currentLine = "";
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const lineWidth = font.widthOfTextAtSize(testLine, 9.5);
    if (lineWidth > width - margin * 2) {
      page.drawText(currentLine, { x: margin, y, size: 9.5, font, color: COLOR.black });
      y -= 14;
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    page.drawText(currentLine, { x: margin, y, size: 9.5, font, color: COLOR.black });
    y -= 20;
  }

  // Key Terms Card Box
  const cardHeight = 150;
  page.drawRectangle({
    x: margin,
    y: y - cardHeight,
    width: width - margin * 2,
    height: cardHeight,
    color: rgb(0.97, 0.98, 1.0),
    borderColor: rgb(0.8, 0.85, 0.95),
    borderWidth: 1,
  });

  let cardY = y - 22;
  page.drawText("Summary of Employment Terms", {
    x: margin + 15,
    y: cardY,
    size: 11,
    font: bold,
    color: COLOR.navy,
  });
  cardY -= 22;

  const startFormatted = new Date(offer.startDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const terms = [
    { label: "Position / Job Title:", val: offer.positionTitle },
    { label: "Department / Section:", val: offer.departmentName || "General School Operations" },
    { label: "Employment Basis:", val: offer.employmentType.replace(/_/g, " ") },
    {
      label: "Compensation / Remuneration:",
      val: `ETB ${offer.offeredSalary.toLocaleString()} / ${(offer.salaryPeriod || "MONTHLY").toLowerCase()}`,
    },
    { label: "Official Start Date:", val: startFormatted },
    {
      label: "Probationary Period:",
      val: `${offer.probationMonths ?? 3} Months with structured performance review`,
    },
  ];

  for (const term of terms) {
    page.drawText(term.label, {
      x: margin + 15,
      y: cardY,
      size: 9,
      font: bold,
      color: COLOR.navy,
    });
    page.drawText(term.val, {
      x: margin + 185,
      y: cardY,
      size: 9,
      font,
      color: COLOR.black,
    });
    cardY -= 17;
  }

  y -= cardHeight + 25;

  // Benefits & Additional Conditions
  if (offer.benefits) {
    page.drawText("Benefits & Entitlements:", {
      x: margin,
      y,
      size: 9.5,
      font: bold,
      color: COLOR.navy,
    });
    y -= 14;
    page.drawText(offer.benefits, {
      x: margin + 10,
      y,
      size: 9,
      font,
      color: COLOR.black,
    });
    y -= 18;
  }

  if (offer.conditions) {
    page.drawText("Conditions of Appointment:", {
      x: margin,
      y,
      size: 9.5,
      font: bold,
      color: COLOR.navy,
    });
    y -= 14;
    page.drawText(offer.conditions, {
      x: margin + 10,
      y,
      size: 9,
      font,
      color: COLOR.black,
    });
    y -= 18;
  }

  // Acceptance clause
  const expiryFormatted = offer.expiresAt
    ? new Date(offer.expiresAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "within 14 days of receipt";

  const closingMsg =
    `Please review this offer carefully. To confirm your acceptance, please sign and return a copy of this letter ` +
    `by ${expiryFormatted}. We look forward to welcoming you to our school community and working together toward educational excellence.`;

  const closingWords = closingMsg.split(" ");
  let closeLine = "";
  for (const word of closingWords) {
    const testLine = closeLine ? `${closeLine} ${word}` : word;
    const lineWidth = font.widthOfTextAtSize(testLine, 9);
    if (lineWidth > width - margin * 2) {
      page.drawText(closeLine, { x: margin, y, size: 9, font, color: COLOR.black });
      y -= 13;
      closeLine = word;
    } else {
      closeLine = testLine;
    }
  }
  if (closeLine) {
    page.drawText(closeLine, { x: margin, y, size: 9, font, color: COLOR.black });
    y -= 15;
  }

  // Signature Block
  const sigY = 90;
  // School representative
  page.drawLine({
    start: { x: margin, y: sigY },
    end: { x: margin + 200, y: sigY },
    thickness: 0.8,
    color: COLOR.gray,
  });
  page.drawText("Authorized School Representative / Principal", {
    x: margin,
    y: sigY - 12,
    size: 8,
    font: bold,
    color: COLOR.navy,
  });
  page.drawText(`${school.name} — Stamp & Signature`, {
    x: margin,
    y: sigY - 22,
    size: 7,
    font,
    color: COLOR.gray,
  });

  // Candidate acceptance signature
  page.drawLine({
    start: { x: width - margin - 200, y: sigY },
    end: { x: width - margin, y: sigY },
    thickness: 0.8,
    color: COLOR.gray,
  });
  page.drawText("Candidate Acceptance Signature", {
    x: width - margin - 200,
    y: sigY - 12,
    size: 8,
    font: bold,
    color: COLOR.navy,
  });
  page.drawText(`I accept the terms stated above  |  Date: ____________`, {
    x: width - margin - 200,
    y: sigY - 22,
    size: 7,
    font,
    color: COLOR.gray,
  });

  return Buffer.from(await doc.save());
}

// ─────────────────────────────────────────────────────────────────────────────
// 19. JOB POSTING MARKETING FLYER (PDF)
// ─────────────────────────────────────────────────────────────────────────────

export interface JobPostingFlyerData {
  title: string;
  slug: string;
  companyTagline?: string | null;
  employmentType?: string | null;
  location?: string | null;
  description: string;
  requirements?: string | null;
  benefits?: string | null;
  salaryType?: "FIXED" | "NEGOTIABLE" | "RANGE" | "UNDISCLOSED" | string | null;
  salaryRange?: string | null;
  salaryFixedAmount?: number | null;
  salaryCurrency?: string | null;
  closingDate?: Date | string | null;
  applicationDeadlineNote?: string | null;
  socialLinks?: Array<{ platform: string; url: string; label?: string }> | any | null;
  bannerImageUrl?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  department?: string | null;
  position?: string | null;
}

export async function generateJobPostingFlyerPdf(
  school: SchoolHeader & { logo?: string | null },
  posting: JobPostingFlyerData,
  publicUrl: string,
): Promise<Buffer> {
  const { doc, font, bold } = await newDoc();
  let page = doc.addPage([PAGE.width, PAGE.height]);
  let { width, height } = page.getSize();
  const margin = 40;
  const contentWidth = width - margin * 2;

  // Helper for multi-page overflow
  const ensureSpace = (needed: number) => {
    if (y - needed < 70) {
      page = doc.addPage([PAGE.width, PAGE.height]);
      y = height - 50;
      // Draw minimal top banner on continuation page
      page.drawRectangle({
        x: 0,
        y: height - 35,
        width,
        height: 35,
        color: COLOR.navy,
      });
      page.drawText(`${school.name} — ${posting.title}`, {
        x: margin,
        y: height - 24,
        size: 9,
        font: bold,
        color: COLOR.white,
      });
      y = height - 60;
    }
  };

  // Helper to wrap text into lines
  const wrapText = (text: string, maxWidth: number, fontSize: number, useFont = font) => {
    const lines: string[] = [];
    const paragraphs = text.split("\n");
    for (const paragraph of paragraphs) {
      if (!paragraph.trim()) {
        lines.push("");
        continue;
      }
      const words = paragraph.split(" ");
      let currentLine = "";
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const testWidth = useFont.widthOfTextAtSize(testLine, fontSize);
        if (testWidth > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);
    }
    return lines;
  };

  // 1. Top Header Banner
  page.drawRectangle({
    x: 0,
    y: height - 90,
    width,
    height: 90,
    color: COLOR.navy,
  });

  page.drawText(school.name.toUpperCase(), {
    x: margin,
    y: height - 38,
    size: 18,
    font: bold,
    color: COLOR.white,
  });

  const contactLine = [
    school.address,
    school.phone || posting.contactPhone,
    school.email || posting.contactEmail,
  ]
    .filter(Boolean)
    .join("  ·  ");

  if (contactLine) {
    page.drawText(contactLine, {
      x: margin,
      y: height - 55,
      size: 8.5,
      font,
      color: rgb(0.85, 0.88, 0.93),
    });
  }

  page.drawText("CAREER OPPORTUNITY — WE ARE HIRING", {
    x: margin,
    y: height - 76,
    size: 10,
    font: bold,
    color: rgb(0.95, 0.77, 0.06), // Gold accent
  });

  let y = height - 105;

  // 2. Banner Image (if available)
  if (posting.bannerImageUrl) {
    try {
      const imgRes = await fetch(posting.bannerImageUrl);
      if (imgRes.ok) {
        const imgBytes = await imgRes.arrayBuffer();
        let embeddedImg: any;
        const contentType = imgRes.headers.get("content-type") || "";
        if (contentType.includes("png") || posting.bannerImageUrl.toLowerCase().endsWith(".png")) {
          embeddedImg = await doc.embedPng(imgBytes);
        } else {
          embeddedImg = await doc.embedJpg(imgBytes);
        }
        if (embeddedImg) {
          const bannerHeight = 110;
          page.drawImage(embeddedImg, {
            x: margin,
            y: y - bannerHeight,
            width: contentWidth,
            height: bannerHeight,
          });
          y -= bannerHeight + 15;
        }
      }
    } catch {
      // Gracefully continue without banner image
    }
  }

  // 3. Job Title & Tagline Box
  y -= 5;
  page.drawRectangle({
    x: margin,
    y: y - 55,
    width: contentWidth,
    height: 55,
    color: rgb(0.96, 0.97, 0.99),
    borderColor: rgb(0.85, 0.88, 0.93),
    borderWidth: 1,
  });

  page.drawText(posting.title, {
    x: margin + 14,
    y: y - 24,
    size: 15,
    font: bold,
    color: COLOR.navy,
  });

  if (posting.companyTagline) {
    page.drawText(posting.companyTagline, {
      x: margin + 14,
      y: y - 42,
      size: 9.5,
      font,
      color: rgb(0.3, 0.35, 0.45),
    });
  }

  y -= 70;

  // 4. Key Details Row (Badges / Info Strip)
  const salaryDisplay = (() => {
    if (posting.salaryType === "FIXED") {
      const cur = posting.salaryCurrency || "USD";
      return `${posting.salaryFixedAmount?.toLocaleString()} ${cur}`;
    }
    if (posting.salaryType === "RANGE") {
      return posting.salaryRange || "Competitive";
    }
    if (posting.salaryType === "NEGOTIABLE") {
      return "Negotiable";
    }
    return "Undisclosed";
  })();

  const keyFacts = [
    `Type: ${posting.employmentType?.replace(/_/g, " ") || "Full-Time"}`,
    `Location: ${posting.location || "Campus"}`,
    ...(posting.salaryType !== "UNDISCLOSED" ? [`Salary: ${salaryDisplay}`] : []),
    ...(posting.closingDate
      ? [`Deadline: ${new Date(posting.closingDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`]
      : []),
  ];

  page.drawRectangle({
    x: margin,
    y: y - 24,
    width: contentWidth,
    height: 24,
    color: COLOR.lightGray,
  });

  page.drawText(keyFacts.join("    |    "), {
    x: margin + 10,
    y: y - 16,
    size: 8.5,
    font: bold,
    color: COLOR.navy,
  });

  y -= 40;

  // 5. Job Description Section
  ensureSpace(60);
  page.drawText("ABOUT THE ROLE & RESPONSIBILITIES", {
    x: margin,
    y,
    size: 10.5,
    font: bold,
    color: COLOR.navy,
  });
  page.drawLine({
    start: { x: margin, y: y - 4 },
    end: { x: margin + contentWidth, y: y - 4 },
    thickness: 1,
    color: rgb(0.85, 0.88, 0.93),
  });
  y -= 18;

  const descLines = wrapText(posting.description, contentWidth, 8.5, font);
  for (const line of descLines) {
    ensureSpace(14);
    if (!line) {
      y -= 6;
      continue;
    }
    page.drawText(line, {
      x: margin,
      y,
      size: 8.5,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
    y -= 12.5;
  }

  y -= 10;

  // 6. Requirements Section (if present)
  if (posting.requirements) {
    ensureSpace(50);
    page.drawText("QUALIFICATIONS & REQUIREMENTS", {
      x: margin,
      y,
      size: 10.5,
      font: bold,
      color: COLOR.navy,
    });
    page.drawLine({
      start: { x: margin, y: y - 4 },
      end: { x: margin + contentWidth, y: y - 4 },
      thickness: 1,
      color: rgb(0.85, 0.88, 0.93),
    });
    y -= 18;

    const reqLines = wrapText(posting.requirements, contentWidth, 8.5, font);
    for (const line of reqLines) {
      ensureSpace(14);
      if (!line) {
        y -= 6;
        continue;
      }
      page.drawText(line, {
        x: margin,
        y,
        size: 8.5,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
      y -= 12.5;
    }
    y -= 10;
  }

  // 7. Benefits Section (if present)
  if (posting.benefits) {
    ensureSpace(45);
    page.drawText("WHAT WE OFFER / BENEFITS", {
      x: margin,
      y,
      size: 10.5,
      font: bold,
      color: COLOR.navy,
    });
    page.drawLine({
      start: { x: margin, y: y - 4 },
      end: { x: margin + contentWidth, y: y - 4 },
      thickness: 1,
      color: rgb(0.85, 0.88, 0.93),
    });
    y -= 18;

    const benefitLines = wrapText(posting.benefits, contentWidth, 8.5, font);
    for (const line of benefitLines) {
      ensureSpace(14);
      if (!line) {
        y -= 6;
        continue;
      }
      page.drawText(line, {
        x: margin,
        y,
        size: 8.5,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
      y -= 12.5;
    }
    y -= 15;
  }

  // 8. Application & QR Code Call-to-Action Box
  ensureSpace(120);
  const qrBoxHeight = 95;
  page.drawRectangle({
    x: margin,
    y: y - qrBoxHeight,
    width: contentWidth,
    height: qrBoxHeight,
    color: rgb(0.94, 0.96, 0.99),
    borderColor: COLOR.navy,
    borderWidth: 1.2,
  });

  // Generate QR Code PNG Buffer
  try {
    let QRCode: any;
    try {
      QRCode = require("qrcode");
    } catch {
      QRCode = (await import("qrcode")).default || (await import("qrcode"));
    }
    const qrDataUrl = await QRCode.toDataURL(publicUrl, {
      margin: 1,
      width: 200,
      color: {
        dark: "#1e3a8a", // Navy
        light: "#f1f5f9",
      },
    });
    const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, "");
    const qrBuffer = Buffer.from(base64Data, "base64");
    const embeddedQr = await doc.embedPng(qrBuffer);

    const qrSize = 75;
    page.drawImage(embeddedQr, {
      x: margin + 12,
      y: y - qrBoxHeight + 10,
      width: qrSize,
      height: qrSize,
    });
  } catch {
    // Fallback if QR fails: Draw placeholder text
    page.drawText("[ QR Code ]", {
      x: margin + 20,
      y: y - qrBoxHeight + 40,
      size: 9,
      font: bold,
      color: COLOR.gray,
    });
  }

  // Text inside CTA box
  const ctaX = margin + 98;
  page.drawText("HOW TO APPLY", {
    x: ctaX,
    y: y - 22,
    size: 11,
    font: bold,
    color: COLOR.navy,
  });

  page.drawText("Scan the QR code with your mobile camera or visit the link below to apply online:", {
    x: ctaX,
    y: y - 38,
    size: 8,
    font,
    color: rgb(0.2, 0.25, 0.35),
  });

  page.drawText(publicUrl, {
    x: ctaX,
    y: y - 52,
    size: 8.5,
    font: bold,
    color: rgb(0.1, 0.4, 0.7),
  });

  if (posting.applicationDeadlineNote) {
    page.drawText(`Note: ${posting.applicationDeadlineNote}`, {
      x: ctaX,
      y: y - 68,
      size: 7.5,
      font,
      color: COLOR.red,
    });
  } else if (posting.contactEmail || school.email) {
    page.drawText(`Inquiries: ${posting.contactEmail || school.email}`, {
      x: ctaX,
      y: y - 68,
      size: 7.5,
      font,
      color: COLOR.gray,
    });
  }

  y -= qrBoxHeight + 15;

  // 9. Social Links & Footer
  if (Array.isArray(posting.socialLinks) && posting.socialLinks.length > 0) {
    ensureSpace(35);
    const socialText = posting.socialLinks
      .map((s: any) => `${s.platform.toUpperCase()}: ${s.url}`)
      .join("   ·   ");
    const socialLines = wrapText(`Connect: ${socialText}`, contentWidth, 7, font);
    for (const sLine of socialLines) {
      page.drawText(sLine, {
        x: margin,
        y,
        size: 7,
        font,
        color: COLOR.gray,
      });
      y -= 9;
    }
  }

  // Bottom watermark footer
  page.drawText(`Generated by TimhirtHub School System  ·  ${new Date().toLocaleDateString()}`, {
    x: margin,
    y: 20,
    size: 7,
    font,
    color: rgb(0.6, 0.6, 0.6),
  });

  return Buffer.from(await doc.save());
}




