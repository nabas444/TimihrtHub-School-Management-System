import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  InventoryLocationType,
  ItemType,
  ItemCondition,
  ItemLifecycleStatus,
  MovementType,
  DepreciationMethod,
} from "@prisma/client";
import {
  recordMovement,
  getLocationTree,
  createLocation,
  updateLocation,
  deleteLocation,
  createCategory,
  getCategoryTree,
  createSupplier,
  createInventoryItem,
  getLowStockItems,
  getItemHistory,
  generateItemQRCode,
  deleteInventoryItem,
} from "../inventory.service";
import { db } from "../../../config/database";
import { AppError } from "../../../middleware/errorHandler";

vi.mock("../../../config/database", () => ({
  db: {
    inventoryMovement: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    inventoryLocation: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    inventoryCategory: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    supplier: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    inventoryItem: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    inventoryAllocation: {
      findMany: vi.fn(),
    },
    maintenanceRecord: {
      findMany: vi.fn(),
    },
    disposalRecord: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(async (cb) => cb(db)),
  },
}));

vi.mock("../../../utils/auditLog", () => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

describe("Feature 8: Inventory & Asset Management — Phase 1 Test Suite", () => {
  const schoolId = "school-uuid-1111";
  const otherSchoolId = "school-uuid-9999";
  const userId = "user-uuid-admin";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Shared Ledger Movement Helper (recordMovement)", () => {
    it("writes an immutable InventoryMovement row with schoolId scoping", async () => {
      const mockMovement = {
        id: "mov-1",
        schoolId,
        itemId: "item-101",
        type: MovementType.RECEIVED,
        quantity: 50,
        fromLocationId: null,
        toLocationId: "loc-store-1",
        performedById: userId,
        note: "Initial stock intake",
        createdAt: new Date(),
      };

      (db.inventoryMovement.create as any).mockResolvedValue(mockMovement);

      const res = await recordMovement(db as any, {
        schoolId,
        itemId: "item-101",
        type: MovementType.RECEIVED,
        quantity: 50,
        toLocationId: "loc-store-1",
        performedById: userId,
        note: "Initial stock intake",
      });

      expect(res.id).toBe("mov-1");
      expect(db.inventoryMovement.create).toHaveBeenCalledWith({
        data: {
          schoolId,
          itemId: "item-101",
          type: MovementType.RECEIVED,
          quantity: 50,
          fromLocationId: null,
          toLocationId: "loc-store-1",
          performedById: userId,
          relatedAllocationId: null,
          relatedMaintenanceId: null,
          note: "Initial stock intake",
        },
      });
    });
  });

  describe("2. Location Hierarchy (Tree CRUD)", () => {
    it("builds a hierarchical tree from flat location nodes", async () => {
      const flatLocations = [
        { id: "campus-1", name: "Main Campus", type: InventoryLocationType.CAMPUS, parentId: null, isActive: true },
        { id: "block-a", name: "Science Wing", type: InventoryLocationType.BLOCK, parentId: "campus-1", isActive: true },
        { id: "room-101", name: "Chemistry Lab", type: InventoryLocationType.ROOM, parentId: "block-a", isActive: true },
      ];

      (db.inventoryLocation.findMany as any).mockResolvedValue(flatLocations);

      const tree = await getLocationTree(schoolId);
      expect(tree).toHaveLength(1);
      expect(tree[0].id).toBe("campus-1");
      expect(tree[0].children).toHaveLength(1);
      expect(tree[0].children[0].id).toBe("block-a");
      expect(tree[0].children[0].children[0].id).toBe("room-101");
    });

    it("prevents setting a location as its own parent", async () => {
      (db.inventoryLocation.findFirst as any).mockResolvedValue({
        id: "loc-1",
        schoolId,
      });

      await expect(
        updateLocation(schoolId, "loc-1", { parentId: "loc-1" }),
      ).rejects.toThrow("A location cannot be its own parent");
    });

    it("prevents deleting a location that holds active inventory items", async () => {
      (db.inventoryLocation.findFirst as any).mockResolvedValue({
        id: "loc-store",
        schoolId,
        _count: { items: 12, children: 0 },
      });

      await expect(deleteLocation(schoolId, "loc-store")).rejects.toThrow(
        /Cannot delete location containing 12 active inventory items/,
      );
    });
  });

  describe("3. Category Tree & Supplier Management", () => {
    it("creates a sub-category with default reorder threshold", async () => {
      (db.inventoryCategory.findFirst as any).mockResolvedValue({
        id: "cat-parent",
        schoolId,
        name: "Lab Supplies",
      });

      (db.inventoryCategory.create as any).mockResolvedValue({
        id: "cat-child",
        schoolId,
        name: "Glassware",
        parentId: "cat-parent",
        defaultItemType: ItemType.CONSUMABLE,
        defaultUnit: "box",
        defaultReorderPoint: 5,
        defaultReorderQty: 20,
      });

      const cat = await createCategory(schoolId, {
        name: "Glassware",
        parentId: "cat-parent",
        defaultItemType: ItemType.CONSUMABLE,
        defaultUnit: "box",
        defaultReorderPoint: 5,
        defaultReorderQty: 20,
      });

      expect(cat.name).toBe("Glassware");
      expect(cat.defaultReorderPoint).toBe(5);
    });

    it("creates and registers a supplier with contact and rating", async () => {
      (db.supplier.create as any).mockResolvedValue({
        id: "supp-1",
        schoolId,
        name: "Addis Educational Supplies PLC",
        contactName: "Solomon Tilahun",
        phone: "+251911002233",
        email: "sales@addisedu.et",
        rating: 5,
        isActive: true,
      });

      const supp = await createSupplier(schoolId, {
        name: "Addis Educational Supplies PLC",
        contactName: "Solomon Tilahun",
        phone: "+251911002233",
        email: "sales@addisedu.et",
        rating: 5,
      });

      expect(supp.id).toBe("supp-1");
      expect(supp.rating).toBe(5);
    });
  });

  describe("4. Inventory Catalog Items & Fixed Asset Auto-tagging", () => {
    it("creates a FIXED_ASSET item, auto-generates asset tag, and records initial stock movement", async () => {
      (db.inventoryCategory.findFirst as any).mockResolvedValue({
        id: "cat-it",
        schoolId,
        name: "Laptops",
        defaultUnit: "piece",
      });
      (db.inventoryLocation.findFirst as any).mockResolvedValue({
        id: "loc-store",
        schoolId,
        name: "IT Main Store",
      });
      (db.inventoryItem.count as any).mockResolvedValue(42);
      (db.inventoryItem.findFirst as any).mockResolvedValue(null); // No duplicates

      const createdFixedAsset = {
        id: "item-laptop-1",
        schoolId,
        categoryId: "cat-it",
        name: "Dell Latitude 5420",
        itemType: ItemType.FIXED_ASSET,
        serialNumber: "SN-DELL-987654",
        assetTagNumber: `AST-${new Date().getFullYear()}-00043`,
        purchaseCost: 45000,
        currentBookValue: 45000,
        depreciationMethod: DepreciationMethod.STRAIGHT_LINE,
        usefulLifeMonths: 36,
        currentLocationId: "loc-store",
        quantityOnHand: 1,
        status: ItemLifecycleStatus.IN_STOCK,
        condition: ItemCondition.NEW,
      };

      (db.inventoryItem.create as any).mockResolvedValue(createdFixedAsset);
      (db.inventoryMovement.create as any).mockResolvedValue({
        id: "mov-init-1",
        schoolId,
        itemId: "item-laptop-1",
        type: MovementType.RECEIVED,
        quantity: 1,
      });

      const item = await createInventoryItem(
        schoolId,
        {
          categoryId: "cat-it",
          name: "Dell Latitude 5420",
          itemType: ItemType.FIXED_ASSET,
          serialNumber: "SN-DELL-987654",
          purchaseCost: 45000,
          depreciationMethod: DepreciationMethod.STRAIGHT_LINE,
          usefulLifeMonths: 36,
          currentLocationId: "loc-store",
        },
        userId,
      );

      expect(item.name).toBe("Dell Latitude 5420");
      expect(item.assetTagNumber).toMatch(/^AST-\d{4}-\d{5}$/);
      expect(db.inventoryMovement.create).toHaveBeenCalled();
    });

    it("identifies low-stock consumable items when quantityOnHand <= reorderPoint", async () => {
      const items = [
        {
          id: "item-paper",
          name: "A4 Photocopy Paper",
          itemType: ItemType.CONSUMABLE,
          quantityOnHand: 3,
          reorderPoint: 10,
        },
        {
          id: "item-pens",
          name: "Whiteboard Markers",
          itemType: ItemType.CONSUMABLE,
          quantityOnHand: 25,
          reorderPoint: 10,
        },
        {
          id: "item-chalk",
          name: "Dustless Chalk Box",
          itemType: ItemType.CONSUMABLE,
          quantityOnHand: 0,
          reorderPoint: 5,
        },
      ];

      (db.inventoryItem.findMany as any).mockResolvedValue(items);

      const lowStock = await getLowStockItems(schoolId);
      expect(lowStock).toHaveLength(2);
      expect(lowStock.map((i) => i.id)).toEqual(["item-paper", "item-chalk"]);
    });

    it("generates a valid QR code Data URL for an asset", async () => {
      (db.inventoryItem.findFirst as any).mockResolvedValue({
        id: "item-lab-mic-1",
        schoolId,
        name: "Olympus Microscope CX23",
        assetTagNumber: "AST-2026-00012",
        barcodeNumber: "FA-88991122",
        itemType: ItemType.FIXED_ASSET,
      });

      const qr = await generateItemQRCode(schoolId, "item-lab-mic-1");
      expect(qr.item.name).toBe("Olympus Microscope CX23");
      expect(qr.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    });

    it("prevents deleting an item with an active allocation", async () => {
      (db.inventoryItem.findFirst as any).mockResolvedValue({
        id: "item-allocated",
        schoolId,
        allocations: [{ id: "alloc-1", status: "ACTIVE" }],
      });

      await expect(deleteInventoryItem(schoolId, "item-allocated")).rejects.toThrow(
        /Cannot delete an item that is currently allocated/,
      );
    });

    it("aggregates the item history timeline including movements and allocations", async () => {
      (db.inventoryItem.findFirst as any).mockResolvedValue({
        id: "item-1",
        schoolId,
        name: "Projector Epson EB-X49",
        assetTagNumber: "AST-2026-00005",
        itemType: ItemType.FIXED_ASSET,
      });

      (db.inventoryMovement.findMany as any).mockResolvedValue([
        { id: "mov-1", type: MovementType.RECEIVED, quantity: 1, createdAt: new Date() },
        { id: "mov-2", type: MovementType.ALLOCATED, quantity: 1, createdAt: new Date() },
      ]);
      (db.inventoryAllocation.findMany as any).mockResolvedValue([
        { id: "alloc-1", custodianType: "ROOM", issuedAt: new Date() },
      ]);
      (db.maintenanceRecord.findMany as any).mockResolvedValue([]);
      (db.disposalRecord.findMany as any).mockResolvedValue([]);

      const history = await getItemHistory(schoolId, "item-1");
      expect(history.item.name).toBe("Projector Epson EB-X49");
      expect(history.movements).toHaveLength(2);
      expect(history.allocations).toHaveLength(1);
    });
  });
});
