import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ItemType,
  CustodianType,
} from "@prisma/client";
import {
  getInventorySummaryReport,
  getCategoryValuationReport,
  getLocationUtilizationReport,
  getDepreciationScheduleReport,
} from "../inventory.service";
import { db } from "../../../config/database";

vi.mock("../../../config/database", () => ({
  db: {
    inventoryItem: {
      findMany: vi.fn(),
    },
    inventoryAllocation: {
      findMany: vi.fn(),
    },
    maintenanceRecord: {
      count: vi.fn(),
    },
    inventoryRequest: {
      count: vi.fn(),
    },
    purchaseOrder: {
      count: vi.fn(),
    },
    inventoryCategory: {
      findMany: vi.fn(),
    },
    inventoryLocation: {
      findMany: vi.fn(),
    },
  },
}));

describe("Feature 8: Inventory & Asset Management — Phase 5 Test Suite (Reporting & Analytics)", () => {
  const schoolId = "school-uuid-1111";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Overall Inventory Valuation & Summary Report", () => {
    it("aggregates book value, consumable stock value, allocation breakdown, and alert counts", async () => {
      const pastDate = new Date();
      pastDate.setMonth(pastDate.getMonth() - 10);

      (db.inventoryItem.findMany as any).mockResolvedValue([
        // Fixed Asset: Cost 100k, Useful Life 50 months -> 2k/mo -> 20k dep -> 80k book value
        {
          id: "item-fa-1",
          itemType: ItemType.FIXED_ASSET,
          purchaseCost: 100000,
          salvageValue: 0,
          usefulLifeMonths: 50,
          createdAt: pastDate,
          quantityOnHand: null,
          unitCost: null,
          reorderPoint: null,
        },
        // Consumable: 100 on hand @ 50 ETB = 5,000 ETB
        {
          id: "item-con-1",
          itemType: ItemType.CONSUMABLE,
          quantityOnHand: 100,
          unitCost: 50,
          reorderPoint: 20,
          createdAt: new Date(),
        },
        // Low-stock Consumable: 5 on hand <= 10 reorderPoint
        {
          id: "item-con-low",
          itemType: ItemType.CONSUMABLE,
          quantityOnHand: 5,
          unitCost: 200,
          reorderPoint: 10,
          createdAt: new Date(),
        },
      ]);

      (db.inventoryAllocation.findMany as any).mockResolvedValue([
        { custodianType: CustodianType.STAFF, quantity: 1 },
        { custodianType: CustodianType.ROOM, quantity: 1 },
        { custodianType: CustodianType.STUDENT, quantity: 1 },
      ]);

      (db.maintenanceRecord.count as any).mockResolvedValue(2);
      (db.inventoryRequest.count as any).mockResolvedValue(4);
      (db.purchaseOrder.count as any).mockResolvedValue(1);

      const summary = await getInventorySummaryReport(schoolId);

      expect(summary.totalItemsCount).toBe(3);
      expect(summary.totalFixedAssetsCount).toBe(1);
      expect(summary.totalConsumablesCount).toBe(2);
      expect(summary.totalFixedAssetBookValue).toBe(80000);
      expect(summary.totalConsumableStockValue).toBe(6000); // 5000 + 1000
      expect(summary.totalCombinedInventoryValuation).toBe(86000);
      expect(summary.lowStockAlertsCount).toBe(1);
      expect(summary.itemsUnderMaintenanceCount).toBe(2);
      expect(summary.pendingRequestsCount).toBe(4);
      expect(summary.activeAllocationsCount.TOTAL).toBe(3);
      expect(summary.activeAllocationsCount.STAFF).toBe(1);
      expect(summary.activeAllocationsCount.ROOM).toBe(1);
    });
  });

  describe("2. Category Valuation Report", () => {
    it("groups and computes item count and valuation per category", async () => {
      (db.inventoryCategory.findMany as any).mockResolvedValue([
        {
          id: "cat-it",
          name: "IT & Electronics",
          code: "ITE",
          items: [
            {
              itemType: ItemType.CONSUMABLE,
              quantityOnHand: 20,
              unitCost: 150, // 3,000
            },
          ],
        },
      ]);

      const report = await getCategoryValuationReport(schoolId);
      expect(report).toHaveLength(1);
      expect(report[0].categoryName).toBe("IT & Electronics");
      expect(report[0].consumableStockValue).toBe(3000);
      expect(report[0].totalValuation).toBe(3000);
    });
  });

  describe("3. Location Utilization Report", () => {
    it("computes stored items and active room allocations for each location", async () => {
      (db.inventoryLocation.findMany as any).mockResolvedValue([
        {
          id: "loc-lab",
          name: "Science Laboratory",
          code: "SCI-LAB",
          type: "ROOM",
          items: [
            {
              itemType: ItemType.CONSUMABLE,
              quantityOnHand: 10,
              unitCost: 500, // 5,000
            },
          ],
          allocations: [{ id: "alloc-1", itemId: "item-microscope" }],
        },
      ]);

      const report = await getLocationUtilizationReport(schoolId);
      expect(report).toHaveLength(1);
      expect(report[0].locationName).toBe("Science Laboratory");
      expect(report[0].storedItemsCount).toBe(1);
      expect(report[0].activeRoomAllocationsCount).toBe(1);
      expect(report[0].estimatedLocationValuation).toBe(5000);
    });
  });

  describe("4. Depreciation Schedule Report", () => {
    it("returns depreciation timeline and remaining book values for all fixed assets", async () => {
      const purchaseDate = new Date();
      purchaseDate.setMonth(purchaseDate.getMonth() - 6);

      (db.inventoryItem.findMany as any).mockResolvedValue([
        {
          id: "fa-1",
          name: "Interactive Whiteboard",
          assetTagNumber: "AST-2026-00001",
          serialNumber: "SN-98765",
          purchaseCost: 50000,
          salvageValue: 5000,
          usefulLifeMonths: 45, // 1000/mo -> 6000 dep -> 44000 book value
          createdAt: purchaseDate,
          category: { name: "Smart Classroom" },
          currentLocation: { name: "Room 101" },
        },
      ]);

      const report = await getDepreciationScheduleReport(schoolId);
      expect(report).toHaveLength(1);
      expect(report[0].name).toBe("Interactive Whiteboard");
      expect(report[0].currentBookValue).toBe(44000);
      expect(report[0].accumulatedDepreciation).toBe(6000);
    });
  });
});
