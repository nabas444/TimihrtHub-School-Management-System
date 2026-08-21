import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { FeeType, FeeStatus } from "@prisma/client";
import { db } from "../../config/database";
import { AppError } from "../../middleware/errorHandler";
import { emitToUser } from "../../config/socket";
import { sendSuccess, sendCreated, paginationMeta } from "../../utils/response";
import { authorize } from "../../middleware/auth";
import { Role } from "@prisma/client";
import { recordAuditEvent } from "../../utils/auditLog";

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
    discountType?: string;
    taxRate?: number;
    notes?: string;
  },
) => {
  const student = await db.studentProfile.findFirst({
    where: { id: data.studentProfileId, user: { schoolId } },
  });
  if (!student) throw new AppError("Student not found", 404);

  const discountVal =
    data.discountType === "PERCENT"
      ? (data.amount * (data.discount || 0)) / 100
      : data.discount || 0;
  const baseTaxable = Math.max(0, data.amount - discountVal);
  const taxRate = data.taxRate || 0;
  const taxAmount = Math.round(((baseTaxable * taxRate) / 100) * 100) / 100;

  const invoice = await db.feeInvoice.create({
    data: {
      schoolId,
      studentProfileId: data.studentProfileId,
      title: data.title,
      type: data.type,
      amount: data.amount,
      discount: data.discount ?? 0,
      discountType: data.discountType ?? "AMOUNT",
      taxRate,
      taxAmount,
      dueDate: data.dueDate,
      notes: data.notes,
    },
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
  data: {
    amount: number;
    method: string;
    reference?: string;
    provisionalReceipt?: string;
    receiptCopies?: number;
  },
) => {
  const invoice = await db.feeInvoice.findFirst({
    where: { id: invoiceId, schoolId },
  });
  if (!invoice) throw new AppError("Invoice not found", 404);
  if (invoice.status === "PAID")
    throw new AppError("Invoice already paid", 400);

  const payment = await db.feePayment.create({
    data: {
      invoiceId,
      amount: data.amount,
      method: data.method,
      reference: data.reference,
      provisionalReceipt: data.provisionalReceipt,
      receiptCopies: data.receiptCopies ?? 1,
    },
  });

  const newPaidAmount = invoice.paidAmount + data.amount;
  const discountVal =
    invoice.discountType === "PERCENT"
      ? (invoice.amount * (invoice.discount ?? 0)) / 100
      : invoice.discount ?? 0;
  const effectiveAmount = Math.max(0, invoice.amount - discountVal) + (invoice.taxAmount ?? 0);

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
    discountType?: string;
    discount?: number;
    taxRate?: number;
  },
) => {
  const where = {
    user: { schoolId, isActive: true },
    ...(data.classId && { classId: data.classId }),
  };
  const students = await db.studentProfile.findMany({ where });

  const discountVal =
    data.discountType === "PERCENT"
      ? (data.amount * (data.discount || 0)) / 100
      : data.discount || 0;
  const baseTaxable = Math.max(0, data.amount - discountVal);
  const taxRate = data.taxRate || 0;
  const taxAmount = Math.round(((baseTaxable * taxRate) / 100) * 100) / 100;

  const invoices = await db.feeInvoice.createMany({
    data: students.map((s) => ({
      schoolId,
      studentProfileId: s.id,
      title: data.title,
      type: data.type,
      amount: data.amount,
      dueDate: data.dueDate,
      discount: data.discount ?? 0,
      discountType: data.discountType ?? "AMOUNT",
      taxRate,
      taxAmount,
      status: "PENDING" as FeeStatus,
    })),
    skipDuplicates: true,
  });

  return { created: invoices.count };
};

// Receipt PDF helper
const getReceiptPdf = async (
  paymentId: string,
  schoolId: string,
  requestedCopies?: number,
) => {
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
  const discountVal =
    invoice.discountType === "PERCENT"
      ? (invoice.amount * (invoice.discount ?? 0)) / 100
      : invoice.discount ?? 0;
  const effectiveAmount =
    Math.max(0, invoice.amount - discountVal) + (invoice.taxAmount ?? 0);
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
      discountType: invoice.discountType,
      taxRate: invoice.taxRate,
      taxAmount: invoice.taxAmount,
      dueDate: invoice.dueDate,
    },
    payment: {
      amount: payment.amount,
      method: payment.method,
      reference: payment.reference,
      paidAt: payment.paidAt,
      receiptCopies: requestedCopies ?? payment.receiptCopies,
    },
    copies: requestedCopies ?? payment.receiptCopies,
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
          discountType: z.enum(["AMOUNT", "PERCENT"]).optional(),
          taxRate: z.number().min(0).max(100).optional(),
          notes: z.string().optional(),
        })
        .parse(req.body);

      const invoice = await createInvoice(req.user.schoolId, {
        ...data,
        dueDate: new Date(data.dueDate),
      });

      await recordAuditEvent({
        schoolId: req.user.schoolId,
        actorId: req.user.id,
        actorEmail: req.user.email,
        actorRole: req.user.role,
        action: "FEE_RECORD_CREATED",
        targetType: "FeeInvoice",
        targetId: invoice.id,
        metadata: { title: data.title, amount: data.amount, type: data.type },
        req,
      });

      sendCreated(res, invoice);
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
          discount: z.number().optional(),
          discountType: z.enum(["AMOUNT", "PERCENT"]).optional(),
          taxRate: z.number().min(0).max(100).optional(),
        })
        .parse(req.body);

      const result = await bulkGenerateInvoices(req.user.schoolId, {
        ...data,
        dueDate: new Date(data.dueDate),
      });

      await recordAuditEvent({
        schoolId: req.user.schoolId,
        actorId: req.user.id,
        actorEmail: req.user.email,
        actorRole: req.user.role,
        action: "FEE_RECORD_CREATED",
        targetType: "FeeInvoice",
        metadata: {
          bulk: true,
          createdCount: result.created,
          title: data.title,
          amount: data.amount,
          classId: data.classId,
        },
        req,
      });

      sendCreated(res, result);
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
          provisionalReceipt: z.string().optional(),
          receiptCopies: z.number().int().min(1).max(2).optional(),
        })
        .parse(req.body);

      const payment = await recordPayment(req.params.invoiceId, req.user.schoolId, data);

      await recordAuditEvent({
        schoolId: req.user.schoolId,
        actorId: req.user.id,
        actorEmail: req.user.email,
        actorRole: req.user.role,
        action: "FEE_RECORD_UPDATED",
        targetType: "FeeInvoice",
        targetId: req.params.invoiceId,
        metadata: {
          paymentRecorded: true,
          paymentId: (payment as any).payment?.id || (payment as any).id,
          amount: data.amount,
          method: data.method,
        },
        req,
      });

      sendCreated(res, payment, "Payment recorded");
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/payments/:paymentId/receipt",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const copiesParam = req.query.copies
        ? parseInt(req.query.copies as string)
        : undefined;

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
        copiesParam,
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

// ── 4. INSTALLMENT PLANS ──────────────────────────────────────────────────────

// POST /fees/installment-plans — Create a new installment plan & split installments
router.post(
  "/installment-plans",
  authorize(...isAdmin),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = z
        .object({
          studentProfileId: z.string(),
          invoiceId: z.string().optional().nullable(),
          totalAmount: z.number().positive(),
          numInstallments: z.number().int().min(2).max(24),
          taxRate: z.number().min(0).max(100).optional().default(0),
          discount: z.number().min(0).optional().default(0),
        })
        .parse(req.body);

      const student = await db.studentProfile.findFirst({
        where: { id: data.studentProfileId, user: { schoolId: req.user.schoolId } },
      });
      if (!student) throw new AppError("Student not found", 404);

      const discountedBase = Math.max(0, data.totalAmount - data.discount);
      const basePerInstallment = Math.floor((discountedBase / data.numInstallments) * 100) / 100;
      const remainder = Math.round((discountedBase - basePerInstallment * data.numInstallments) * 100) / 100;

      const plan = await db.installmentPlan.create({
        data: {
          studentProfileId: data.studentProfileId,
          invoiceId: data.invoiceId ?? null,
          totalAmount: data.totalAmount,
          numInstallments: data.numInstallments,
          taxRate: data.taxRate,
          discount: data.discount,
        },
      });

      const installmentsData = [];
      for (let i = 1; i <= data.numInstallments; i++) {
        const dueDate = new Date();
        dueDate.setMonth(dueDate.getMonth() + i);

        // Adjust penny rounding on first or last installment
        const baseAmount = i === data.numInstallments ? basePerInstallment + remainder : basePerInstallment;
        const tax = Math.round(((baseAmount * data.taxRate) / 100) * 100) / 100;
        const total = Math.round((baseAmount + tax) * 100) / 100;

        installmentsData.push({
          planId: plan.id,
          installmentNo: i,
          dueDate,
          amount: baseAmount,
          tax,
          total,
          noCarryForward: false,
        });
      }

      await db.installment.createMany({
        data: installmentsData,
      });

      const fullPlan = await db.installmentPlan.findUnique({
        where: { id: plan.id },
        include: {
          studentProfile: {
            include: {
              user: { select: { firstName: true, lastName: true, email: true } },
              class: true,
            },
          },
          installments: { orderBy: { installmentNo: "asc" } },
        },
      });

      sendCreated(res, fullPlan, "Installment plan created successfully");
    } catch (e) {
      next(e);
    }
  },
);

// GET /fees/installment-plans — List installment plans
router.get(
  "/installment-plans",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const skip = (page - 1) * limit;
      let studentProfileId = req.query.studentProfileId as string | undefined;

      if (req.user.role === Role.STUDENT) {
        const sp = await db.studentProfile.findUnique({
          where: { userId: req.user.id },
          select: { id: true },
        });
        studentProfileId = sp?.id;
      }

      const where: any = {
        studentProfile: {
          user: { schoolId: req.user.schoolId },
          ...(studentProfileId && { id: studentProfileId }),
        },
      };

      const [plans, total] = await Promise.all([
        db.installmentPlan.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            studentProfile: {
              include: {
                user: { select: { firstName: true, lastName: true, email: true } },
                class: true,
              },
            },
            installments: { orderBy: { installmentNo: "asc" } },
          },
        }),
        db.installmentPlan.count({ where }),
      ]);

      sendSuccess(res, plans, "OK", 200, paginationMeta(total, page, limit));
    } catch (e) {
      next(e);
    }
  },
);

// GET /fees/installment-plans/:id — Single installment plan
router.get(
  "/installment-plans/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plan = await db.installmentPlan.findFirst({
        where: {
          id: req.params.id,
          studentProfile: { user: { schoolId: req.user.schoolId } },
        },
        include: {
          studentProfile: {
            include: {
              user: { select: { firstName: true, lastName: true, email: true } },
              class: true,
            },
          },
          invoice: true,
          installments: { orderBy: { installmentNo: "asc" } },
        },
      });

      if (!plan) throw new AppError("Installment plan not found", 404);
      sendSuccess(res, plan);
    } catch (e) {
      next(e);
    }
  },
);

// POST /fees/installments/:id/pay — Pay an installment
router.post(
  "/installments/:id/pay",
  authorize(...isAdmin),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = z
        .object({
          amount: z.number().positive(),
          method: z.string(),
          reference: z.string().optional(),
          provisionalReceipt: z.string().optional(),
          receiptCopies: z.number().int().min(1).max(2).optional().default(1),
        })
        .parse(req.body);

      const installment = await db.installment.findFirst({
        where: { id: req.params.id },
        include: {
          plan: {
            include: {
              studentProfile: {
                include: { user: true, class: true },
              },
            },
          },
        },
      });

      if (!installment) throw new AppError("Installment not found", 404);
      if (installment.plan.studentProfile.user.schoolId !== req.user.schoolId) {
        throw new AppError("Not authorized", 403);
      }

      const receiptNumber = `INST-${Date.now().toString().slice(-6)}`;
      const currentPaid = (installment.payAmount || 0) + data.amount;

      const updatedInstallment = await db.installment.update({
        where: { id: installment.id },
        data: {
          payDate: new Date(),
          payAmount: currentPaid,
          receiptNo: receiptNumber,
        },
      });

      // Shortfall carry-forward logic:
      // If payment is short and noCarryForward is false, add the shortfall to the next unpaid installment
      if (currentPaid < installment.total && !installment.noCarryForward) {
        const shortfall = installment.total - currentPaid;

        const nextInstallment = await db.installment.findFirst({
          where: {
            planId: installment.planId,
            installmentNo: { gt: installment.installmentNo },
            OR: [
              { payAmount: null },
              { payAmount: { lt: db.installment.fields.total } },
            ],
          },
          orderBy: { installmentNo: "asc" },
        });

        if (nextInstallment) {
          const newBaseAmount = nextInstallment.amount + shortfall;
          const newTax = Math.round(((newBaseAmount * installment.plan.taxRate) / 100) * 100) / 100;
          const newTotal = Math.round((newBaseAmount + newTax) * 100) / 100;

          await db.installment.update({
            where: { id: nextInstallment.id },
            data: {
              amount: newBaseAmount,
              tax: newTax,
              total: newTotal,
            },
          });
        }
      }

      sendSuccess(res, updatedInstallment, "Installment payment recorded");
    } catch (e) {
      next(e);
    }
  },
);

// PATCH /fees/installments/:id — Update installment (toggle noCarryForward, update due date)
router.patch(
  "/installments/:id",
  authorize(...isAdmin),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = z
        .object({
          noCarryForward: z.boolean().optional(),
          dueDate: z.string().datetime().optional(),
        })
        .parse(req.body);

      const installment = await db.installment.findFirst({
        where: { id: req.params.id },
        include: {
          plan: {
            include: {
              studentProfile: { include: { user: true } },
            },
          },
        },
      });

      if (!installment) throw new AppError("Installment not found", 404);
      if (installment.plan.studentProfile.user.schoolId !== req.user.schoolId) {
        throw new AppError("Not authorized", 403);
      }

      const updated = await db.installment.update({
        where: { id: installment.id },
        data: {
          ...(data.noCarryForward !== undefined && { noCarryForward: data.noCarryForward }),
          ...(data.dueDate && { dueDate: new Date(data.dueDate) }),
        },
      });

      sendSuccess(res, updated, "Installment updated");
    } catch (e) {
      next(e);
    }
  },
);

// GET /fees/installments/:id/receipt — Download installment receipt PDF
router.get(
  "/installments/:id/receipt",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const copiesParam = req.query.copies
        ? parseInt(req.query.copies as string)
        : 1;

      const installment = await db.installment.findFirst({
        where: { id: req.params.id },
        include: {
          plan: {
            include: {
              studentProfile: {
                include: {
                  user: { select: { firstName: true, lastName: true, schoolId: true } },
                  class: true,
                },
              },
            },
          },
        },
      });

      if (!installment) throw new AppError("Installment not found", 404);
      if (installment.plan.studentProfile.user.schoolId !== req.user.schoolId) {
        throw new AppError("Not authorized", 403);
      }
      if (!installment.payDate || !installment.payAmount) {
        throw new AppError("Installment has no recorded payment", 400);
      }

      const school = await db.school.findUnique({
        where: { id: req.user.schoolId },
      });
      if (!school) throw new AppError("School not found", 404);

      const balanceRemaining = Math.max(0, installment.total - installment.payAmount);

      const { generateFeeReceiptPdf } = await import("../../utils/pdf");
      const pdf = await generateFeeReceiptPdf({
        school: {
          name: school.name,
          address: school.address,
          phone: school.phone,
          email: school.email,
        },
        receiptNumber: installment.receiptNo || installment.id.slice(0, 8).toUpperCase(),
        student: {
          name: `${installment.plan.studentProfile.user.firstName} ${installment.plan.studentProfile.user.lastName}`,
          admissionNumber: installment.plan.studentProfile.admissionNumber,
          className: installment.plan.studentProfile.class?.name ?? "—",
        },
        invoice: {
          title: `Fee Installment Plan (${installment.plan.numInstallments} Months)`,
          type: "TUITION",
          amount: installment.amount,
          discount: installment.plan.discount,
          discountType: "AMOUNT",
          taxRate: installment.plan.taxRate,
          taxAmount: installment.tax,
          dueDate: installment.dueDate,
        },
        payment: {
          amount: installment.payAmount,
          method: "CASH",
          paidAt: installment.payDate,
          receiptCopies: copiesParam,
        },
        isInstallment: true,
        installmentInfo: {
          installmentNo: installment.installmentNo,
          numInstallments: installment.plan.numInstallments,
          dueDate: installment.dueDate,
        },
        copies: copiesParam,
        balanceRemaining,
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="installment-receipt-${installment.installmentNo}.pdf"`,
      );
      res.send(pdf);
    } catch (e) {
      next(e);
    }
  },
);

export default router;
