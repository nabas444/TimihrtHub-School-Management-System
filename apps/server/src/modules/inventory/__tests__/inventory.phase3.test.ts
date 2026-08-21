import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  RequestStatus,
  PurchaseOrderStatus,
  Role,
} from "@prisma/client";
import {
  createInventoryRequest,
  approveInventoryRequest,
  rejectInventoryRequest,
  createPurchaseOrder,
  approvePurchaseOrder,
  orderPurchaseOrder,
  cancelPurchaseOrder,
} from "../inventory.service";
import { db } from "../../../config/database";
import { AppError } from "../../../middleware/errorHandler";

vi.mock("../../../config/database", () => ({
  db: {
    inventoryRequest: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    purchaseOrder: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    purchaseOrderLine: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    supplier: {
      findFirst: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (cb) => cb(db)),
  },
}));

vi.mock("../../../utils/auditLog", () => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

describe("Feature 8: Inventory & Asset Management — Phase 3 Test Suite (Procurement)", () => {
  const schoolId = "school-uuid-1111";
  const teacherId = "user-uuid-teacher";
  const adminId = "user-uuid-admin";
  const financeId = "user-uuid-finance";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Inventory Requisitions (Requests)", () => {
    it("creates a multi-line inventory request in PENDING status", async () => {
      const mockReq = {
        id: "req-101",
        schoolId,
        requestedById: teacherId,
        reason: "Chemistry lab glass beakers for Grade 11 practicals",
        status: RequestStatus.PENDING,
        lines: [
          { id: "line-1", itemId: "item-beaker-250", quantityRequested: 15 },
          { id: "line-2", freeTextName: "Safety Goggles Set", quantityRequested: 20 },
        ],
      };

      (db.inventoryRequest.create as any).mockResolvedValue(mockReq);

      const result = await createInventoryRequest(
        schoolId,
        {
          departmentOrRoom: "Science Dept / Chem Lab",
          reason: "Chemistry lab glass beakers for Grade 11 practicals",
          lines: [
            { itemId: "item-beaker-250", quantityRequested: 15 },
            { freeTextName: "Safety Goggles Set", quantityRequested: 20 },
          ],
        },
        teacherId,
      );

      expect(result.id).toBe("req-101");
      expect(result.status).toBe(RequestStatus.PENDING);
      expect(result.lines).toHaveLength(2);
      expect(db.inventoryRequest.create).toHaveBeenCalled();
    });

    it("approves a pending requisition and notifies the requester", async () => {
      (db.inventoryRequest.findFirst as any).mockResolvedValue({
        id: "req-101",
        schoolId,
        status: RequestStatus.PENDING,
        requestedById: teacherId,
        reason: "Lab supplies",
      });

      (db.inventoryRequest.update as any).mockResolvedValue({
        id: "req-101",
        status: RequestStatus.APPROVED,
        approvedById: adminId,
      });
      (db.notification.create as any).mockResolvedValue({});

      const approved = await approveInventoryRequest(schoolId, "req-101", adminId);
      expect(approved.status).toBe(RequestStatus.APPROVED);
      expect(db.inventoryRequest.update).toHaveBeenCalledWith({
        where: { id: "req-101" },
        data: expect.objectContaining({
          status: RequestStatus.APPROVED,
          approvedById: adminId,
        }),
        include: expect.any(Object),
      });
    });

    it("rejects a pending requisition with a mandatory reason", async () => {
      (db.inventoryRequest.findFirst as any).mockResolvedValue({
        id: "req-102",
        schoolId,
        status: RequestStatus.PENDING,
        requestedById: teacherId,
      });

      (db.inventoryRequest.update as any).mockResolvedValue({
        id: "req-102",
        status: RequestStatus.REJECTED,
        rejectionReason: "Budget fully allocated for this quarter",
      });

      const rejected = await rejectInventoryRequest(
        schoolId,
        "req-102",
        "Budget fully allocated for this quarter",
        adminId,
      );

      expect(rejected.status).toBe(RequestStatus.REJECTED);
      expect(db.inventoryRequest.update).toHaveBeenCalledWith({
        where: { id: "req-102" },
        data: expect.objectContaining({
          status: RequestStatus.REJECTED,
          rejectionReason: "Budget fully allocated for this quarter",
        }),
        include: expect.any(Object),
      });
    });
  });

  describe("2. Purchase Orders & Financial Threshold Routing", () => {
    it("creates a Purchase Order, auto-generates PO Number, and calculates totalAmount", async () => {
      (db.supplier.findFirst as any).mockResolvedValue({
        id: "supp-1",
        schoolId,
        name: "Ethio Lab Supplies",
        isActive: true,
      });
      (db.purchaseOrder.count as any).mockResolvedValue(14);

      const createdPo = {
        id: "po-1",
        poNumber: `PO-${new Date().getFullYear()}-00015`,
        supplierId: "supp-1",
        totalAmount: 18000,
        currency: "ETB",
        status: PurchaseOrderStatus.DRAFT,
      };

      (db.purchaseOrder.create as any).mockResolvedValue(createdPo);

      const po = await createPurchaseOrder(
        schoolId,
        {
          supplierId: "supp-1",
          currency: "ETB",
          lines: [
            { description: "Microscope Slides 100pk", quantityOrdered: 10, unitCost: 300 }, // 3,000
            { description: "Digital pH Meter", quantityOrdered: 5, unitCost: 3000 },       // 15,000
          ],
        },
        adminId,
      );

      expect(po.poNumber).toMatch(/^PO-\d{4}-\d{5}$/);
      expect(po.totalAmount).toBe(18000);
      expect(po.status).toBe(PurchaseOrderStatus.DRAFT);
    });

    it("allows ADMIN approval for POs below or equal to threshold (<= 50,000 ETB)", async () => {
      (db.purchaseOrder.findFirst as any).mockResolvedValue({
        id: "po-low-val",
        schoolId,
        poNumber: "PO-2026-00001",
        totalAmount: 25000, // <= 50,000 threshold
        currency: "ETB",
        status: PurchaseOrderStatus.SUBMITTED,
        orderedById: adminId,
      });

      (db.purchaseOrder.update as any).mockResolvedValue({
        id: "po-low-val",
        status: PurchaseOrderStatus.APPROVED,
      });
      (db.notification.create as any).mockResolvedValue({});

      const approved = await approvePurchaseOrder(
        schoolId,
        "po-low-val",
        { id: adminId, role: Role.ADMIN, email: "admin@school.et" },
      );

      expect(approved.status).toBe(PurchaseOrderStatus.APPROVED);
    });

    it("blocks ADMIN approval and requires FINANCE / SUPER_ADMIN for POs exceeding 50,000 ETB", async () => {
      (db.purchaseOrder.findFirst as any).mockResolvedValue({
        id: "po-high-val",
        schoolId,
        poNumber: "PO-2026-00002",
        totalAmount: 180000, // > 50,000 threshold
        currency: "ETB",
        status: PurchaseOrderStatus.SUBMITTED,
        orderedById: adminId,
      });

      // Attempt with ADMIN role -> should fail with 403 Forbidden
      await expect(
        approvePurchaseOrder(
          schoolId,
          "po-high-val",
          { id: adminId, role: Role.ADMIN, email: "admin@school.et" },
        ),
      ).rejects.toThrow(/exceeds threshold.*Approval requires FINANCE or SUPER_ADMIN/);

      // Attempt with FINANCE role -> should succeed
      (db.purchaseOrder.update as any).mockResolvedValue({
        id: "po-high-val",
        status: PurchaseOrderStatus.APPROVED,
      });
      (db.notification.create as any).mockResolvedValue({});

      const financeApproved = await approvePurchaseOrder(
        schoolId,
        "po-high-val",
        { id: financeId, role: Role.FINANCE, email: "finance@school.et" },
      );

      expect(financeApproved.status).toBe(PurchaseOrderStatus.APPROVED);
    });

    it("transitions approved PO to ORDERED status", async () => {
      (db.purchaseOrder.findFirst as any).mockResolvedValue({
        id: "po-app",
        schoolId,
        status: PurchaseOrderStatus.APPROVED,
      });
      (db.purchaseOrder.update as any).mockResolvedValue({
        id: "po-app",
        status: PurchaseOrderStatus.ORDERED,
      });

      const ordered = await orderPurchaseOrder(schoolId, "po-app", adminId);
      expect(ordered.status).toBe(PurchaseOrderStatus.ORDERED);
    });

    it("prevents cancelling a PO that has already received stock", async () => {
      (db.purchaseOrder.findFirst as any).mockResolvedValue({
        id: "po-received",
        schoolId,
        status: PurchaseOrderStatus.PARTIALLY_RECEIVED,
      });

      await expect(cancelPurchaseOrder(schoolId, "po-received", adminId)).rejects.toThrow(
        /Cannot cancel a purchase order that has already received goods/,
      );
    });
  });
});
