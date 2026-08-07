import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = {
  feeInvoice: { findFirst: vi.fn(), update: vi.fn() },
  feePayment: { create: vi.fn() },
};
vi.mock("../../../config/database", () => ({ db: mockDb }));
vi.mock("../../../config/socket", () => ({ emitToUser: vi.fn() }));
vi.mock("../../../utils/pdf", () => ({ generateFeeReceiptPdf: vi.fn() }));

import { recordPayment } from "../fees.routes";

describe("recordPayment — invoice status transitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws 404 if the invoice does not exist (or belongs to another school)", async () => {
    mockDb.feeInvoice.findFirst.mockResolvedValueOnce(null);
    await expect(
      recordPayment("inv1", "s1", { amount: 100, method: "cash" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("refuses to record a payment against an already-PAID invoice", async () => {
    mockDb.feeInvoice.findFirst.mockResolvedValueOnce({
      id: "inv1",
      schoolId: "s1",
      status: "PAID",
      paidAmount: 500,
      amount: 500,
      discount: 0,
    });
    await expect(
      recordPayment("inv1", "s1", { amount: 100, method: "cash" }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mockDb.feePayment.create).not.toHaveBeenCalled();
  });

  it("a first partial payment moves PENDING -> PARTIAL", async () => {
    mockDb.feeInvoice.findFirst.mockResolvedValueOnce({
      id: "inv1",
      schoolId: "s1",
      status: "PENDING",
      paidAmount: 0,
      amount: 1000,
      discount: 0,
    });
    mockDb.feePayment.create.mockResolvedValueOnce({ id: "p1" });
    mockDb.feeInvoice.update.mockImplementationOnce(async ({ data }: any) => ({
      id: "inv1",
      ...data,
    }));

    const { invoice } = await recordPayment("inv1", "s1", {
      amount: 400,
      method: "cash",
    });

    expect(invoice.status).toBe("PARTIAL");
    expect(invoice.paidAmount).toBe(400);
  });

  it("a payment that exactly covers the remaining balance moves the invoice to PAID", async () => {
    mockDb.feeInvoice.findFirst.mockResolvedValueOnce({
      id: "inv1",
      schoolId: "s1",
      status: "PARTIAL",
      paidAmount: 400,
      amount: 1000,
      discount: 0,
    });
    mockDb.feePayment.create.mockResolvedValueOnce({ id: "p2" });
    mockDb.feeInvoice.update.mockImplementationOnce(async ({ data }: any) => ({
      id: "inv1",
      ...data,
    }));

    const { invoice } = await recordPayment("inv1", "s1", {
      amount: 600,
      method: "cash",
    });

    expect(invoice.status).toBe("PAID");
    expect(invoice.paidAmount).toBe(1000);
  });

  it("honors a discount when deciding whether the invoice is fully paid", async () => {
    // amount 1000, discount 200 -> effective amount due is 800.
    mockDb.feeInvoice.findFirst.mockResolvedValueOnce({
      id: "inv1",
      schoolId: "s1",
      status: "PENDING",
      paidAmount: 0,
      amount: 1000,
      discount: 200,
    });
    mockDb.feePayment.create.mockResolvedValueOnce({ id: "p3" });
    mockDb.feeInvoice.update.mockImplementationOnce(async ({ data }: any) => ({
      id: "inv1",
      ...data,
    }));

    const { invoice } = await recordPayment("inv1", "s1", {
      amount: 800,
      method: "cash",
    });

    expect(invoice.status).toBe("PAID");
  });

  it("a payment of 0 (edge case) leaves the invoice PENDING, not PARTIAL", async () => {
    mockDb.feeInvoice.findFirst.mockResolvedValueOnce({
      id: "inv1",
      schoolId: "s1",
      status: "PENDING",
      paidAmount: 0,
      amount: 1000,
      discount: 0,
    });
    mockDb.feePayment.create.mockResolvedValueOnce({ id: "p4" });
    mockDb.feeInvoice.update.mockImplementationOnce(async ({ data }: any) => ({
      id: "inv1",
      ...data,
    }));

    const { invoice } = await recordPayment("inv1", "s1", {
      amount: 0,
      method: "cash",
    });

    expect(invoice.status).toBe("PENDING");
  });
});
