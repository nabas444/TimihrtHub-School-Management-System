import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { FeeType, FeeStatus } from "@prisma/client";
import { db } from "../../config/database";
import { AppError } from "../../middleware/errorHandler";
import { emitToUser } from "../../config/socket";
import { sendSuccess, sendCreated, paginationMeta } from "../../utils/response";
import { authorize } from "../../middleware/auth";
import { Role } from "@prisma/client";

// ── Service ───────────────────────────────────────────────────────────────────
const listInvoices = async (
  schoolId: string,
  params: {
    studentProfileId?: string;
    status?: FeeStatus;
    page: number;
    limit: number;
  },
) => {
  const { page, limit, studentProfileId, status } = params;
  const skip = (page - 1) * limit;

  const [invoices, total] = await Promise.all([
    db.feeInvoice.findMany({
      where: {
        schoolId,
        ...(studentProfileId && { studentProfileId }),
        ...(status && { status }),
      },
      skip,
      take: limit,
      orderBy: { dueDate: "asc" },
      include: {
        studentProfile: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        feePayments: { orderBy: { paidAt: "desc" }, take: 5 },
      },
    }),
    db.feeInvoice.count({
      where: {
        schoolId,
        ...(studentProfileId && { studentProfileId }),
        ...(status && { status }),
      },
    }),
  ]);

  return { invoices, total };
};

const createInvoice = async (
  schoolId: string,
  data: {
    studentProfileId: string;
    title: string;
    type: FeeType;
    amount: number;
    dueDate: Date;
    discount?: number;
    notes?: string;
  },
) => {
  const student = await db.studentProfile.findFirst({
    where: { id: data.studentProfileId, user: { schoolId } },
  });
  if (!student) throw new AppError("Student not found", 404);

  const invoice = await db.feeInvoice.create({
    data: { schoolId, ...data },
    include: {
      studentProfile: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });

  // Notify student and parents
  emitToUser(invoice.studentProfile.user.id, "notification:new", {
    type: "FEE",
    title: "Fee Invoice",
    body: `New invoice: ${data.title} — ETB ${data.amount}`,
  });

  return invoice;
};

export const recordPayment = async (
  invoiceId: string,
  schoolId: string,
  data: { amount: number; method: string; reference?: string },
) => {
  const invoice = await db.feeInvoice.findFirst({
    where: { id: invoiceId, schoolId },
  });
  if (!invoice) throw new AppError("Invoice not found", 404);
  if (invoice.status === "PAID")
    throw new AppError("Invoice already paid", 400);

  const payment = await db.feePayment.create({ data: { invoiceId, ...data } });

  const newPaidAmount = invoice.paidAmount + data.amount;
  const effectiveAmount = invoice.amount - (invoice.discount ?? 0);
  const newStatus: FeeStatus =
    newPaidAmount >= effectiveAmount
      ? "PAID"
      : newPaidAmount > 0
        ? "PARTIAL"
        : "PENDING";

  const updatedInvoice = await db.feeInvoice.update({
    where: { id: invoiceId },
    data: { paidAmount: newPaidAmount, status: newStatus },
  });

  return { payment, invoice: updatedInvoice };
};

const getFinancialOverview = async (schoolId: string) => {
  const [totalInvoiced, totalPaid, overdueCount, pendingCount] =
    await Promise.all([
      db.feeInvoice.aggregate({ where: { schoolId }, _sum: { amount: true } }),
      db.feeInvoice.aggregate({
        where: { schoolId },
        _sum: { paidAmount: true },
      }),
      db.feeInvoice.count({ where: { schoolId, status: "OVERDUE" } }),
      db.feeInvoice.count({
        where: { schoolId, status: { in: ["PENDING", "PARTIAL"] } },
      }),
    ]);

  const outstanding =
    (totalInvoiced._sum.amount ?? 0) - (totalPaid._sum.paidAmount ?? 0);
  return {
    totalInvoiced: totalInvoiced._sum.amount ?? 0,
    totalCollected: totalPaid._sum.paidAmount ?? 0,
    outstanding,
    collectionRate: totalInvoiced._sum.amount
      ? Math.round(
          ((totalPaid._sum.paidAmount ?? 0) / totalInvoiced._sum.amount) * 100,
        )
      : 0,
    overdueCount,
    pendingCount,
  };
};

const bulkGenerateInvoices = async (
  schoolId: string,
  data: {
    title: string;
    type: FeeType;
    amount: number;
    dueDate: Date;
    classId?: string;
  },
) => {
  const where = {
    user: { schoolId, isActive: true },
    ...(data.classId && { classId: data.classId }),
  };
  const students = await db.studentProfile.findMany({ where });

  const invoices = await db.feeInvoice.createMany({
    data: students.map((s) => ({
      schoolId,
      studentProfileId: s.id,
      ...data,
      status: "PENDING" as FeeStatus,
    })),
    skipDuplicates: true,
  });

  return { created: invoices.count };
};

// Requirement doc: "Generate digital payment receipts" — nothing produced an
// actual downloadable document before this; payments existed only as rows.
const getReceiptPdf = async (paymentId: string, schoolId: string) => {
  const payment = await db.feePayment.findFirst({
    where: { id: paymentId, invoice: { schoolId } },
    include: {
      invoice: {
        include: {
          studentProfile: {
            include: {
              user: { select: { firstName: true, lastName: true } },
              class: true,
            },
          },
        },
      },
    },
  });
  if (!payment) throw new AppError("Payment not found", 404);

  const school = await db.school.findUnique({ where: { id: schoolId } });
  if (!school) throw new AppError("School not found", 404);

  const invoice = payment.invoice;
  const effectiveAmount = invoice.amount - (invoice.discount ?? 0);
  const balanceRemaining = Math.max(effectiveAmount - invoice.paidAmount, 0);

  const { generateFeeReceiptPdf } = await import("../../utils/pdf");
  const pdf = await generateFeeReceiptPdf({
    school: {
      name: school.name,
      address: school.address,
      phone: school.phone,
      email: school.email,
    },
    receiptNumber: payment.id.slice(0, 8).toUpperCase(),
    student: {
      name: `${invoice.studentProfile.user.firstName} ${invoice.studentProfile.user.lastName}`,
      admissionNumber: invoice.studentProfile.admissionNumber,
      className: invoice.studentProfile.class?.name ?? "—",
    },
    invoice: {
      title: invoice.title,
      type: invoice.type,
      amount: invoice.amount,
      discount: invoice.discount,
      dueDate: invoice.dueDate,
    },
    payment: {
      amount: payment.amount,
      method: payment.method,
      reference: payment.reference,
      paidAt: payment.paidAt,
    },
    balanceRemaining,
  });

  return { pdf, fileName: `receipt-${payment.id.slice(0, 8)}.pdf` };
};

// ── Router ────────────────────────────────────────────────────────────────────
const router = Router();
const isAdmin = [Role.ADMIN, Role.SUPER_ADMIN];

router.get(
  "/",
  authorize(...isAdmin),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const { studentProfileId, status } = req.query as Record<string, string>;
      const { invoices, total } = await listInvoices(req.user.schoolId, {
        studentProfileId,
        status: status as FeeStatus,
        page,
        limit,
      });
      sendSuccess(res, invoices, "OK", 200, paginationMeta(total, page, limit));
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/overview",
  authorize(...isAdmin),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await getFinancialOverview(req.user.schoolId));
    } catch (e) {
      next(e);
    }
  },
);

router.get("/my", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = 20;
    let studentProfileId: string | undefined;
    if (req.user.role === Role.STUDENT) {
      const sp = await db.studentProfile.findUnique({
        where: { userId: req.user.id },
        select: { id: true },
      });
      studentProfileId = sp?.id;
    }
    const { invoices, total } = await listInvoices(req.user.schoolId, {
      studentProfileId,
      page,
      limit,
    });
    sendSuccess(res, invoices, "OK", 200, paginationMeta(total, page, limit));
  } catch (e) {
    next(e);
  }
});

router.post(
  "/",
  authorize(...isAdmin),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = z
        .object({
          studentProfileId: z.string(),
          title: z.string(),
          type: z.nativeEnum(FeeType),
          amount: z.number().positive(),
          dueDate: z.string().datetime(),
          discount: z.number().optional(),
          notes: z.string().optional(),
        })
        .parse(req.body);
      sendCreated(
        res,
        await createInvoice(req.user.schoolId, {
          ...data,
          dueDate: new Date(data.dueDate),
        }),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/bulk",
  authorize(...isAdmin),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = z
        .object({
          title: z.string(),
          type: z.nativeEnum(FeeType),
          amount: z.number().positive(),
          dueDate: z.string().datetime(),
          classId: z.string().optional(),
        })
        .parse(req.body);
      sendCreated(
        res,
        await bulkGenerateInvoices(req.user.schoolId, {
          ...data,
          dueDate: new Date(data.dueDate),
        }),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/:invoiceId/pay",
  authorize(...isAdmin),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = z
        .object({
          amount: z.number().positive(),
          method: z.string(),
          reference: z.string().optional(),
        })
        .parse(req.body);
      sendCreated(
        res,
        await recordPayment(req.params.invoiceId, req.user.schoolId, data),
        "Payment recorded",
      );
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/payments/:paymentId/receipt",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user.role === Role.STUDENT) {
        const sp = await db.studentProfile.findUnique({
          where: { userId: req.user.id },
          select: { id: true },
        });
        const payment = await db.feePayment.findUnique({
          where: { id: req.params.paymentId },
          select: { invoice: { select: { studentProfileId: true } } },
        });
        if (!payment || payment.invoice.studentProfileId !== sp?.id)
          throw new AppError("Receipt not found", 404);
      }
      const { pdf, fileName } = await getReceiptPdf(
        req.params.paymentId,
        req.user.schoolId,
      );
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"`,
      );
      res.send(pdf);
    } catch (e) {
      next(e);
    }
  },
);

export default router;
