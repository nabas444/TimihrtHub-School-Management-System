import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ItemType,
  ItemCondition,
  ItemLifecycleStatus,
  MovementType,
  DisposalReason,
} from "@prisma/client";
import {
  createMaintenanceTicket,
  resolveMaintenanceTicket,
  calculateItemDepreciation,
  createDisposalRecord,
  createStockCount,
  updateStockCountLines,
  reconcileStockCount,
} from "../inventory.service";
import { db } from "../../../config/database";
import { AppError } from "../../../middleware/errorHandler";

vi.mock("../../../config/database", () => ({
  db: {
    maintenanceRecord: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    inventoryItem: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    inventoryMovement: {
      create: vi.fn(),
    },
    disposalRecord: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    stockCount: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    stockCountLine: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(async (cb) => cb(db)),
  },
}));

vi.mock("../../../utils/auditLog", () => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

describe("Feature 8: Inventory & Asset Management — Phase 4 Test Suite (Lifecycle & Compliance)", () => {
  const schoolId = "school-uuid-1111";
  const userId = "user-uuid-admin";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Maintenance Workflow", () => {
    it("creates a maintenance ticket, transitions item to UNDER_MAINTENANCE, and logs movement", async () => {
      (db.inventoryItem.findFirst as any).mockResolvedValue({
        id: "item-printer-1",
        schoolId,
        name: "HP LaserJet Pro",
        status: ItemLifecycleStatus.IN_STOCK,
        isActive: true,
        currentLocationId: "loc-office",
      });

      (db.maintenanceRecord.create as any).mockResolvedValue({
        id: "maint-1",
        itemId: "item-printer-1",
        status: "REPORTED",
      });
      (db.inventoryItem.update as any).mockResolvedValue({});
      (db.inventoryMovement.create as any).mockResolvedValue({});

      const ticket = await createMaintenanceTicket(
        schoolId,
        {
          itemId: "item-printer-1",
          faultDescription: "Paper roller jam and squeaking noise",
          cost: 1500,
        },
        userId,
      );

      expect(ticket.id).toBe("maint-1");
      expect(db.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: "item-printer-1" },
        data: expect.objectContaining({
          status: ItemLifecycleStatus.UNDER_MAINTENANCE,
        }),
      });
      expect(db.inventoryMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: MovementType.SENT_FOR_MAINTENANCE,
          itemId: "item-printer-1",
        }),
      });
    });

    it("resolves maintenance ticket, restores item to IN_STOCK with GOOD condition, and logs movement", async () => {
      (db.maintenanceRecord.findFirst as any).mockResolvedValue({
        id: "maint-1",
        schoolId,
        itemId: "item-printer-1",
        item: { id: "item-printer-1", currentLocationId: "loc-office" },
        cost: 1500,
      });

      (db.maintenanceRecord.update as any).mockResolvedValue({
        id: "maint-1",
        status: "COMPLETED",
      });
      (db.inventoryItem.update as any).mockResolvedValue({});
      (db.inventoryMovement.create as any).mockResolvedValue({});

      const res = await resolveMaintenanceTicket(
        schoolId,
        "maint-1",
        {
          status: "COMPLETED",
          resolutionNotes: "Replaced rubber pickup rollers; tested 50 pages ok",
          conditionAfterRepair: ItemCondition.GOOD,
        },
        userId,
      );

      expect(res.status).toBe("COMPLETED");
      expect(db.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: "item-printer-1" },
        data: expect.objectContaining({
          status: ItemLifecycleStatus.IN_STOCK,
          condition: ItemCondition.GOOD,
        }),
      });
      expect(db.inventoryMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: MovementType.RETURNED_FROM_MAINTENANCE,
        }),
      });
    });
  });

  describe("2. Depreciation Calculation", () => {
    it("computes straight-line depreciation correctly", () => {
      const purchaseDate = new Date();
      purchaseDate.setMonth(purchaseDate.getMonth() - 12); // 12 months ago

      const item = {
        purchaseCost: 60000,
        salvageValue: 0,
        usefulLifeMonths: 60, // 5 years = 1,000 / month
        createdAt: purchaseDate,
      };

      const dep = calculateItemDepreciation(item);
      expect(dep.monthsElapsed).toBe(12);
      expect(dep.monthlyDepreciation).toBe(1000);
      expect(dep.accumulatedDepreciation).toBe(12000);
      expect(dep.currentBookValue).toBe(48000);
    });
  });

  describe("3. Asset Disposal & Write-off", () => {
    it("disposes an asset, sets isActive to false, and records DISPOSED movement", async () => {
      (db.inventoryItem.findFirst as any).mockResolvedValue({
        id: "item-server-old",
        schoolId,
        name: "Dell PowerEdge R710",
        status: ItemLifecycleStatus.UNDER_MAINTENANCE,
        itemType: ItemType.FIXED_ASSET,
        purchaseCost: 80000,
        salvageValue: 5000,
        usefulLifeMonths: 36,
        createdAt: new Date("2020-01-01"),
        allocations: [],
      });

      (db.disposalRecord.create as any).mockResolvedValue({
        id: "disp-1",
        reason: DisposalReason.OBSOLETE,
      });
      (db.inventoryItem.update as any).mockResolvedValue({});
      (db.inventoryMovement.create as any).mockResolvedValue({});

      const disposal = await createDisposalRecord(
        schoolId,
        {
          itemId: "item-server-old",
          reason: DisposalReason.OBSOLETE,
          saleValue: 4000,
          disposalMethod: "Electronic waste recycling auction",
          notes: "Decommissioned after server upgrade",
        },
        userId,
      );

      expect(disposal.id).toBe("disp-1");
      expect(db.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: "item-server-old" },
        data: expect.objectContaining({
          status: ItemLifecycleStatus.DISPOSED,
          isActive: false,
        }),
      });
      expect(db.inventoryMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: MovementType.DISPOSED,
        }),
      });
    });

    it("blocks disposal if item currently has active allocations", async () => {
      (db.inventoryItem.findFirst as any).mockResolvedValue({
        id: "item-laptop-active",
        schoolId,
        name: "Lenovo ThinkPad",
        status: ItemLifecycleStatus.ALLOCATED,
        allocations: [{ id: "active-alloc-1" }],
      });

      await expect(
        createDisposalRecord(
          schoolId,
          { itemId: "item-laptop-active", reason: DisposalReason.LOST },
          userId,
        ),
      ).rejects.toThrow(/Cannot dispose an item that has active allocations/);
    });
  });

  describe("4. Stock Count & Reconciliation", () => {
    it("starts a stock count event with pre-filled expected quantities", async () => {
      (db.inventoryItem.findMany as any).mockResolvedValue([
        { id: "item-paper", quantityOnHand: 20, itemType: ItemType.CONSUMABLE },
        { id: "item-toner", quantityOnHand: 5, itemType: ItemType.CONSUMABLE },
      ]);

      (db.stockCount.create as any).mockResolvedValue({
        id: "sc-101",
        status: "IN_PROGRESS",
        lines: [
          { id: "scl-1", itemId: "item-paper", expectedQty: 20 },
          { id: "scl-2", itemId: "item-toner", expectedQty: 5 },
        ],
      });

      const sc = await createStockCount(
        schoolId,
        { locationId: "loc-store", notes: "Q3 Physical Audit" },
        userId,
      );

      expect(sc.id).toBe("sc-101");
      expect(sc.status).toBe("IN_PROGRESS");
      expect(sc.lines).toHaveLength(2);
    });

    it("reconciles variance by auto-adjusting consumable stock and logging ADJUSTED movements", async () => {
      (db.stockCount.findFirst as any).mockResolvedValue({
        id: "sc-101",
        schoolId,
        status: "IN_PROGRESS",
        locationId: "loc-store",
        lines: [
          {
            id: "scl-1",
            itemId: "item-paper",
            expectedQty: 20,
            countedQty: 17, // variance = -3
            variance: -3,
            item: { id: "item-paper", itemType: ItemType.CONSUMABLE },
          },
        ],
      });

      (db.inventoryItem.update as any).mockResolvedValue({});
      (db.inventoryMovement.create as any).mockResolvedValue({});
      (db.stockCount.update as any).mockResolvedValue({ id: "sc-101", status: "COMPLETED" });

      const reconciled = await reconcileStockCount(schoolId, "sc-101", userId);

      expect(reconciled.status).toBe("COMPLETED");
      expect(db.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: "item-paper" },
        data: { quantityOnHand: 17 },
      });
      expect(db.inventoryMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: MovementType.ADJUSTED,
          quantity: 3,
        }),
      });
    });
  });
});
