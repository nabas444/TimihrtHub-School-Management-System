import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ItemType,
  ItemCondition,
  ItemLifecycleStatus,
  MovementType,
  CustodianType,
} from "@prisma/client";
import {
  issueAllocation,
  returnAllocation,
  transferAllocation,
  getMyAllocations,
  getOverdueAllocations,
  createGoodsReceipt,
} from "../inventory.service";
import { db } from "../../../config/database";
import { AppError } from "../../../middleware/errorHandler";

vi.mock("../../../config/database", () => ({
  db: {
    inventoryMovement: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    inventoryLocation: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    inventoryItem: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    inventoryAllocation: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    maintenanceRecord: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    goodsReceipt: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    goodsReceiptLine: {
      create: vi.fn(),
    },
    purchaseOrder: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    purchaseOrderLine: {
      update: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
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

describe("Feature 8: Inventory & Asset Management — Phase 2 Test Suite", () => {
  const schoolId = "school-uuid-1111";
  const userId = "user-uuid-admin";
  const staffUserId = "user-uuid-teacher";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Fixed Asset Allocation & Double-Allocation Prevention", () => {
    it("issues a FIXED_ASSET item, updates item status to ALLOCATED, and records ALLOCATED movement", async () => {
      (db.inventoryItem.findFirst as any).mockResolvedValue({
        id: "item-laptop-1",
        schoolId,
        name: "MacBook Air M2",
        itemType: ItemType.FIXED_ASSET,
        status: ItemLifecycleStatus.IN_STOCK,
        condition: ItemCondition.GOOD,
        currentLocationId: "loc-store",
        allocations: [],
      });
      (db.user.findFirst as any).mockResolvedValue({
        id: staffUserId,
        schoolId,
        isActive: true,
      });

      const mockAllocation = {
        id: "alloc-1",
        schoolId,
        itemId: "item-laptop-1",
        custodianType: CustodianType.STAFF,
        custodianUserId: staffUserId,
        status: "ACTIVE",
        conditionAtIssue: ItemCondition.GOOD,
      };

      (db.inventoryAllocation.create as any).mockResolvedValue(mockAllocation);
      (db.inventoryItem.update as any).mockResolvedValue({});
      (db.inventoryMovement.create as any).mockResolvedValue({ id: "mov-alloc-1" });

      const res = await issueAllocation(
        schoolId,
        {
          itemId: "item-laptop-1",
          custodianType: CustodianType.STAFF,
          custodianUserId: staffUserId,
          dueBackAt: "2026-12-31",
        },
        userId,
      );

      expect(res.id).toBe("alloc-1");
      expect(db.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: "item-laptop-1" },
        data: expect.objectContaining({
          status: ItemLifecycleStatus.ALLOCATED,
        }),
      });
      expect(db.inventoryMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: MovementType.ALLOCATED,
          itemId: "item-laptop-1",
        }),
      });
    });

    it("prevents double-allocation when a fixed asset is already ALLOCATED or has an active allocation", async () => {
      (db.inventoryItem.findFirst as any).mockResolvedValue({
        id: "item-laptop-1",
        schoolId,
        name: "MacBook Air M2",
        itemType: ItemType.FIXED_ASSET,
        status: ItemLifecycleStatus.ALLOCATED,
        allocations: [{ id: "active-alloc-99" }],
      });

      await expect(
        issueAllocation(
          schoolId,
          {
            itemId: "item-laptop-1",
            custodianType: CustodianType.STAFF,
            custodianUserId: staffUserId,
          },
          userId,
        ),
      ).rejects.toThrow(/cannot be allocated because it is currently ALLOCATED/);
    });

    it("prevents allocation of a DISPOSED item", async () => {
      (db.inventoryItem.findFirst as any).mockResolvedValue({
        id: "item-old-projector",
        schoolId,
        name: "Broken Projector",
        status: ItemLifecycleStatus.DISPOSED,
        allocations: [],
      });

      await expect(
        issueAllocation(
          schoolId,
          {
            itemId: "item-old-projector",
            custodianType: CustodianType.ROOM,
            custodianRoomId: "room-101",
          },
          userId,
        ),
      ).rejects.toThrow(/Cannot allocate item with status 'DISPOSED'/);
    });
  });

  describe("2. Consumable Stock Issuance & Low-Stock Alerts", () => {
    it("decrements quantityOnHand and triggers low-stock notification when below threshold", async () => {
      (db.inventoryItem.findFirst as any).mockResolvedValue({
        id: "item-paper",
        schoolId,
        name: "A4 Photocopy Paper",
        itemType: ItemType.CONSUMABLE,
        quantityOnHand: 8,
        reorderPoint: 5,
        unit: "ream",
        status: ItemLifecycleStatus.IN_STOCK,
        allocations: [],
      });
      (db.user.findFirst as any).mockResolvedValue({ id: staffUserId, schoolId, isActive: true });
      (db.user.findMany as any).mockResolvedValue([{ id: "admin-1" }]);

      (db.inventoryAllocation.create as any).mockResolvedValue({ id: "alloc-paper-1" });
      (db.inventoryItem.update as any).mockResolvedValue({});
      (db.inventoryMovement.create as any).mockResolvedValue({});
      (db.notification.create as any).mockResolvedValue({});

      await issueAllocation(
        schoolId,
        {
          itemId: "item-paper",
          quantity: 4, // 8 - 4 = 4 (<= 5 reorderPoint)
          custodianType: CustodianType.STAFF,
          custodianUserId: staffUserId,
        },
        userId,
      );

      expect(db.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: "item-paper" },
        data: expect.objectContaining({
          quantityOnHand: 4,
        }),
      });
      expect(db.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: "INVENTORY",
          title: expect.stringContaining("Low Stock Alert"),
        }),
      });
    });

    it("blocks consumable allocation when requested quantity exceeds available stock", async () => {
      (db.inventoryItem.findFirst as any).mockResolvedValue({
        id: "item-paper",
        schoolId,
        name: "A4 Photocopy Paper",
        itemType: ItemType.CONSUMABLE,
        quantityOnHand: 2,
        allocations: [],
      });

      await expect(
        issueAllocation(
          schoolId,
          {
            itemId: "item-paper",
            quantity: 10,
            custodianType: CustodianType.STAFF,
            custodianUserId: staffUserId,
          },
          userId,
        ),
      ).rejects.toThrow(/Insufficient stock for 'A4 Photocopy Paper'/);
    });
  });

  describe("3. Return Workflow & Damaged-Return Auto-Maintenance", () => {
    it("processes a clean return, restoring fixed asset to IN_STOCK with RETURNED movement", async () => {
      (db.inventoryAllocation.findFirst as any).mockResolvedValue({
        id: "alloc-1",
        schoolId,
        status: "ACTIVE",
        quantity: 1,
        item: {
          id: "item-laptop-1",
          name: "MacBook Air",
          itemType: ItemType.FIXED_ASSET,
          currentLocationId: "loc-room-202",
        },
      });

      (db.inventoryAllocation.update as any).mockResolvedValue({ id: "alloc-1", status: "RETURNED" });
      (db.inventoryItem.update as any).mockResolvedValue({});
      (db.inventoryMovement.create as any).mockResolvedValue({});

      const res = await returnAllocation(
        schoolId,
        "alloc-1",
        {
          conditionAtReturn: ItemCondition.GOOD,
          returnLocationId: "loc-store",
          notes: "Returned on schedule in good condition",
        },
        userId,
      );

      expect(res.allocation.status).toBe("RETURNED");
      expect(res.maintenanceRecordId).toBeNull();
      expect(db.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: "item-laptop-1" },
        data: expect.objectContaining({
          status: ItemLifecycleStatus.IN_STOCK,
          condition: ItemCondition.GOOD,
          currentLocationId: "loc-store",
        }),
      });
      expect(db.inventoryMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: MovementType.RETURNED,
        }),
      });
    });

    it("auto-opens a MaintenanceRecord when item is returned in DAMAGED condition", async () => {
      (db.inventoryAllocation.findFirst as any).mockResolvedValue({
        id: "alloc-lab-mic",
        schoolId,
        status: "ACTIVE",
        quantity: 1,
        item: {
          id: "item-mic-1",
          name: "Olympus Microscope",
          itemType: ItemType.FIXED_ASSET,
          currentLocationId: "loc-lab",
        },
      });

      (db.inventoryAllocation.update as any).mockResolvedValue({ id: "alloc-lab-mic", status: "DAMAGED" });
      (db.maintenanceRecord.create as any).mockResolvedValue({ id: "maint-ticket-99" });
      (db.inventoryItem.update as any).mockResolvedValue({});
      (db.inventoryMovement.create as any).mockResolvedValue({});

      const res = await returnAllocation(
        schoolId,
        "alloc-lab-mic",
        {
          conditionAtReturn: ItemCondition.DAMAGED,
          notes: "Cracked optical lens on 40x objective",
        },
        userId,
      );

      expect(res.allocation.status).toBe("DAMAGED");
      expect(res.maintenanceRecordId).toBe("maint-ticket-99");
      expect(db.maintenanceRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          itemId: "item-mic-1",
          status: "REPORTED",
          faultDescription: "Cracked optical lens on 40x objective",
        }),
      });
      expect(db.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: "item-mic-1" },
        data: expect.objectContaining({
          status: ItemLifecycleStatus.UNDER_MAINTENANCE,
          condition: ItemCondition.DAMAGED,
        }),
      });
      expect(db.inventoryMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: MovementType.DAMAGED,
          relatedMaintenanceId: "maint-ticket-99",
        }),
      });
    });
  });

  describe("4. Transfer & Self-Service Custodian Views", () => {
    it("transfers an active allocation to a new room and writes TRANSFERRED movement", async () => {
      (db.inventoryAllocation.findFirst as any).mockResolvedValue({
        id: "alloc-proj",
        schoolId,
        itemId: "item-proj-1",
        status: "ACTIVE",
        quantity: 1,
        item: { id: "item-proj-1", currentLocationId: "room-101" },
      });
      (db.inventoryLocation.findFirst as any).mockResolvedValue({
        id: "room-202",
        schoolId,
        isActive: true,
      });

      (db.inventoryAllocation.update as any).mockResolvedValue({
        id: "alloc-proj",
        custodianType: CustodianType.ROOM,
        custodianRoomId: "room-202",
      });
      (db.inventoryItem.update as any).mockResolvedValue({});
      (db.inventoryMovement.create as any).mockResolvedValue({});

      const transferred = await transferAllocation(
        schoolId,
        "alloc-proj",
        {
          newCustodianType: CustodianType.ROOM,
          newCustodianRoomId: "room-202",
          notes: "Moved to 2nd Floor Physics Lab",
        },
        userId,
      );

      expect(transferred.custodianRoomId).toBe("room-202");
      expect(db.inventoryMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: MovementType.TRANSFERRED,
          toLocationId: "room-202",
        }),
      });
    });

    it("retrieves personal allocations for authenticated custodian in My Assets", async () => {
      const myItems = [
        {
          id: "alloc-1",
          itemId: "item-laptop-1",
          custodianUserId: staffUserId,
          status: "ACTIVE",
          item: { name: "ThinkPad T14" },
        },
      ];

      (db.inventoryAllocation.findMany as any).mockResolvedValue(myItems);

      const res = await getMyAllocations(schoolId, staffUserId);
      expect(res).toHaveLength(1);
      expect(res[0].item.name).toBe("ThinkPad T14");
    });

    it("filters overdue active allocations where dueBackAt is in the past", async () => {
      const overdueList = [
        {
          id: "alloc-overdue-1",
          status: "ACTIVE",
          dueBackAt: new Date("2026-01-01"),
          item: { name: "Canon DSLR Camera" },
        },
      ];

      (db.inventoryAllocation.findMany as any).mockResolvedValue(overdueList);

      const overdue = await getOverdueAllocations(schoolId);
      expect(overdue).toHaveLength(1);
      expect(overdue[0].item.name).toBe("Canon DSLR Camera");
    });
  });

  describe("5. Goods Receipt (Manual Stock-in)", () => {
    it("receives stock into store room and increments consumable quantityOnHand with RECEIVED movement", async () => {
      (db.inventoryLocation.findFirst as any).mockResolvedValue({
        id: "loc-main-store",
        schoolId,
        name: "Central Warehouse",
        isActive: true,
      });

      (db.goodsReceipt.create as any).mockResolvedValue({ id: "grn-2026-001" });
      (db.inventoryItem.findFirst as any).mockResolvedValue({
        id: "item-bleach",
        schoolId,
        name: "Cleaning Detergent",
        itemType: ItemType.CONSUMABLE,
        quantityOnHand: 10,
      });
      (db.inventoryItem.update as any).mockResolvedValue({});
      (db.inventoryMovement.create as any).mockResolvedValue({});

      const receipt = await createGoodsReceipt(
        schoolId,
        {
          locationId: "loc-main-store",
          notes: "Monthly cleaning supplies delivery",
          lines: [
            {
              itemId: "item-bleach",
              quantityReceived: 25,
              unitCost: 180,
            },
          ],
        },
        userId,
      );

      expect(receipt.id).toBe("grn-2026-001");
      expect(db.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: "item-bleach" },
        data: expect.objectContaining({
          quantityOnHand: 35, // 10 + 25
          currentLocationId: "loc-main-store",
        }),
      });
      expect(db.inventoryMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: MovementType.RECEIVED,
          quantity: 25,
          toLocationId: "loc-main-store",
        }),
      });
    });
  });
});
