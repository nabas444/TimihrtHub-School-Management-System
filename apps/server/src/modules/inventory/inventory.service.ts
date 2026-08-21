import { Request } from "express";
import QRCode from "qrcode";
import {
  Prisma,
  MovementType,
  ItemType,
  ItemCondition,
  ItemLifecycleStatus,
  InventoryLocationType,
  DepreciationMethod,
  CustodianType,
  AllocationStatus,
} from "@prisma/client";
import { db } from "../../config/database";
import { AppError } from "../../middleware/errorHandler";
import { recordAuditEvent } from "../../utils/auditLog";

// ─────────────────────────────────────────────────────────────────────────────
// 1. SHARED LEDGER MOVEMENT HELPER
// ─────────────────────────────────────────────────────────────────────────────

export interface RecordMovementParams {
  schoolId: string;
  itemId: string;
  type: MovementType;
  quantity: number;
  fromLocationId?: string | null;
  toLocationId?: string | null;
  performedById: string;
  relatedAllocationId?: string | null;
  relatedMaintenanceId?: string | null;
  note?: string | null;
}

/**
 * Shared transaction helper for recording inventory movements.
 * Every quantity/location/custodian change MUST pass through this function.
 */
export async function recordMovement(
  tx: Prisma.TransactionClient,
  params: RecordMovementParams,
  req?: Request,
) {
  const movement = await tx.inventoryMovement.create({
    data: {
      schoolId: params.schoolId,
      itemId: params.itemId,
      type: params.type,
      quantity: params.quantity,
      fromLocationId: params.fromLocationId || null,
      toLocationId: params.toLocationId || null,
      performedById: params.performedById,
      relatedAllocationId: params.relatedAllocationId || null,
      relatedMaintenanceId: params.relatedMaintenanceId || null,
      note: params.note || null,
    },
  });

  // Trigger system audit log asynchronously
  recordAuditEvent({
    schoolId: params.schoolId,
    actorId: params.performedById,
    action: `INVENTORY_MOVEMENT_${params.type}`,
    targetType: "INVENTORY_ITEM",
    targetId: params.itemId,
    metadata: {
      movementId: movement.id,
      type: params.type,
      quantity: params.quantity,
      fromLocationId: params.fromLocationId,
      toLocationId: params.toLocationId,
      note: params.note,
    },
    req,
  }).catch(() => {});

  return movement;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. LOCATION MANAGEMENT (HIERARCHICAL TREE)
// ─────────────────────────────────────────────────────────────────────────────

export async function getLocationTree(schoolId: string) {
  const locations = await db.inventoryLocation.findMany({
    where: { schoolId, isActive: true },
    include: {
      _count: {
        select: {
          items: true,
        },
      },
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  // Build tree structure
  const map = new Map<string, any>();
  const roots: any[] = [];

  locations.forEach((loc) => {
    map.set(loc.id, { ...loc, children: [] });
  });

  locations.forEach((loc) => {
    const node = map.get(loc.id);
    if (loc.parentId && map.has(loc.parentId)) {
      map.get(loc.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

export async function getLocationsList(schoolId: string, query?: { type?: InventoryLocationType; parentId?: string; isStoreRoom?: boolean }) {
  return db.inventoryLocation.findMany({
    where: {
      schoolId,
      isActive: true,
      ...(query?.type && { type: query.type }),
      ...(query?.parentId !== undefined && { parentId: query.parentId || null }),
      ...(query?.isStoreRoom !== undefined && { isStoreRoom: query.isStoreRoom }),
    },
    include: {
      parent: { select: { id: true, name: true, type: true } },
      _count: { select: { items: true, children: true } },
    },
    orderBy: [{ name: "asc" }],
  });
}

export async function getLocationById(schoolId: string, id: string) {
  const location = await db.inventoryLocation.findFirst({
    where: { id, schoolId },
    include: {
      parent: true,
      children: { where: { isActive: true } },
      items: {
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          itemType: true,
          status: true,
          quantityOnHand: true,
          assetTagNumber: true,
          serialNumber: true,
        },
      },
      _count: { select: { items: true, children: true } },
    },
  });

  if (!location) {
    throw new AppError("Inventory location not found", 404);
  }
  return location;
}

export async function createLocation(
  schoolId: string,
  data: {
    name: string;
    type: InventoryLocationType;
    parentId?: string | null;
    isStoreRoom?: boolean;
    isDisposalHold?: boolean;
  },
  req?: Request,
) {
  if (data.parentId) {
    const parent = await db.inventoryLocation.findFirst({
      where: { id: data.parentId, schoolId, isActive: true },
    });
    if (!parent) {
      throw new AppError("Parent location not found in this school", 400);
    }
  }

  const location = await db.inventoryLocation.create({
    data: {
      schoolId,
      name: data.name.trim(),
      type: data.type,
      parentId: data.parentId || null,
      isStoreRoom: Boolean(data.isStoreRoom),
      isDisposalHold: Boolean(data.isDisposalHold),
    },
    include: { parent: true },
  });

  recordAuditEvent({
    schoolId,
    actorId: req?.user?.id,
    action: "INVENTORY_LOCATION_CREATED",
    targetType: "INVENTORY_LOCATION",
    targetId: location.id,
    metadata: { name: location.name, type: location.type, parentId: location.parentId },
    req,
  }).catch(() => {});

  return location;
}

export async function updateLocation(
  schoolId: string,
  id: string,
  data: Partial<{
    name: string;
    type: InventoryLocationType;
    parentId: string | null;
    isStoreRoom: boolean;
    isDisposalHold: boolean;
    isActive: boolean;
  }>,
  req?: Request,
) {
  const existing = await db.inventoryLocation.findFirst({
    where: { id, schoolId },
  });
  if (!existing) {
    throw new AppError("Inventory location not found", 404);
  }

  if (data.parentId) {
    if (data.parentId === id) {
      throw new AppError("A location cannot be its own parent", 400);
    }
    const parent = await db.inventoryLocation.findFirst({
      where: { id: data.parentId, schoolId, isActive: true },
    });
    if (!parent) {
      throw new AppError("Parent location not found", 400);
    }
  }

  const updated = await db.inventoryLocation.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.parentId !== undefined && { parentId: data.parentId || null }),
      ...(data.isStoreRoom !== undefined && { isStoreRoom: data.isStoreRoom }),
      ...(data.isDisposalHold !== undefined && { isDisposalHold: data.isDisposalHold }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
    include: { parent: true },
  });

  recordAuditEvent({
    schoolId,
    actorId: req?.user?.id,
    action: "INVENTORY_LOCATION_UPDATED",
    targetType: "INVENTORY_LOCATION",
    targetId: updated.id,
    metadata: data,
    req,
  }).catch(() => {});

  return updated;
}

export async function deleteLocation(schoolId: string, id: string, req?: Request) {
  const location = await db.inventoryLocation.findFirst({
    where: { id, schoolId },
    include: {
      _count: {
        select: {
          items: { where: { isActive: true } },
          children: { where: { isActive: true } },
        },
      },
    },
  });

  if (!location) {
    throw new AppError("Inventory location not found", 404);
  }

  if (location._count.items > 0) {
    throw new AppError(
      `Cannot delete location containing ${location._count.items} active inventory items. Reallocate or transfer them first.`,
      400,
    );
  }

  if (location._count.children > 0) {
    throw new AppError(
      `Cannot delete location containing ${location._count.children} sub-locations. Delete or move sub-locations first.`,
      400,
    );
  }

  await db.inventoryLocation.update({
    where: { id },
    data: { isActive: false },
  });

  recordAuditEvent({
    schoolId,
    actorId: req?.user?.id,
    action: "INVENTORY_LOCATION_DELETED",
    targetType: "INVENTORY_LOCATION",
    targetId: id,
    req,
  }).catch(() => {});

  return { id, deleted: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. CATEGORY MANAGEMENT (HIERARCHICAL TREE)
// ─────────────────────────────────────────────────────────────────────────────

export async function getCategoryTree(schoolId: string) {
  const categories = await db.inventoryCategory.findMany({
    where: { schoolId },
    include: {
      _count: { select: { items: { where: { isActive: true } } } },
    },
    orderBy: [{ name: "asc" }],
  });

  const map = new Map<string, any>();
  const roots: any[] = [];

  categories.forEach((cat) => {
    map.set(cat.id, { ...cat, children: [] });
  });

  categories.forEach((cat) => {
    const node = map.get(cat.id);
    if (cat.parentId && map.has(cat.parentId)) {
      map.get(cat.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

export async function getCategoriesList(schoolId: string) {
  return db.inventoryCategory.findMany({
    where: { schoolId },
    include: {
      parent: { select: { id: true, name: true } },
      _count: { select: { items: { where: { isActive: true } }, children: true } },
    },
    orderBy: [{ name: "asc" }],
  });
}

export async function getCategoryById(schoolId: string, id: string) {
  const category = await db.inventoryCategory.findFirst({
    where: { id, schoolId },
    include: {
      parent: true,
      children: true,
      _count: { select: { items: true } },
    },
  });
  if (!category) throw new AppError("Category not found", 404);
  return category;
}

export async function createCategory(
  schoolId: string,
  data: {
    name: string;
    parentId?: string | null;
    defaultItemType?: ItemType;
    defaultUnit?: string;
    defaultReorderPoint?: number | null;
    defaultReorderQty?: number | null;
  },
  req?: Request,
) {
  if (data.parentId) {
    const parent = await db.inventoryCategory.findFirst({
      where: { id: data.parentId, schoolId },
    });
    if (!parent) throw new AppError("Parent category not found", 400);
  }

  const category = await db.inventoryCategory.create({
    data: {
      schoolId,
      name: data.name.trim(),
      parentId: data.parentId || null,
      defaultItemType: data.defaultItemType || ItemType.CONSUMABLE,
      defaultUnit: data.defaultUnit?.trim() || "piece",
      defaultReorderPoint: data.defaultReorderPoint ?? null,
      defaultReorderQty: data.defaultReorderQty ?? null,
    },
    include: { parent: true },
  });

  recordAuditEvent({
    schoolId,
    actorId: req?.user?.id,
    action: "INVENTORY_CATEGORY_CREATED",
    targetType: "INVENTORY_CATEGORY",
    targetId: category.id,
    metadata: { name: category.name, defaultItemType: category.defaultItemType },
    req,
  }).catch(() => {});

  return category;
}

export async function updateCategory(
  schoolId: string,
  id: string,
  data: Partial<{
    name: string;
    parentId: string | null;
    defaultItemType: ItemType;
    defaultUnit: string;
    defaultReorderPoint: number | null;
    defaultReorderQty: number | null;
  }>,
  req?: Request,
) {
  const existing = await db.inventoryCategory.findFirst({ where: { id, schoolId } });
  if (!existing) throw new AppError("Category not found", 404);

  if (data.parentId) {
    if (data.parentId === id) throw new AppError("Category cannot be its own parent", 400);
    const parent = await db.inventoryCategory.findFirst({ where: { id: data.parentId, schoolId } });
    if (!parent) throw new AppError("Parent category not found", 400);
  }

  const updated = await db.inventoryCategory.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.parentId !== undefined && { parentId: data.parentId || null }),
      ...(data.defaultItemType !== undefined && { defaultItemType: data.defaultItemType }),
      ...(data.defaultUnit !== undefined && { defaultUnit: data.defaultUnit.trim() }),
      ...(data.defaultReorderPoint !== undefined && { defaultReorderPoint: data.defaultReorderPoint }),
      ...(data.defaultReorderQty !== undefined && { defaultReorderQty: data.defaultReorderQty }),
    },
    include: { parent: true },
  });

  recordAuditEvent({
    schoolId,
    actorId: req?.user?.id,
    action: "INVENTORY_CATEGORY_UPDATED",
    targetType: "INVENTORY_CATEGORY",
    targetId: updated.id,
    metadata: data,
    req,
  }).catch(() => {});

  return updated;
}

export async function deleteCategory(schoolId: string, id: string, req?: Request) {
  const category = await db.inventoryCategory.findFirst({
    where: { id, schoolId },
    include: {
      _count: {
        select: {
          items: { where: { isActive: true } },
          children: true,
        },
      },
    },
  });

  if (!category) throw new AppError("Category not found", 404);

  if (category._count.items > 0) {
    throw new AppError(`Cannot delete category with ${category._count.items} active catalog items`, 400);
  }
  if (category._count.children > 0) {
    throw new AppError(`Cannot delete category with ${category._count.children} subcategories`, 400);
  }

  await db.inventoryCategory.delete({ where: { id } });

  recordAuditEvent({
    schoolId,
    actorId: req?.user?.id,
    action: "INVENTORY_CATEGORY_DELETED",
    targetType: "INVENTORY_CATEGORY",
    targetId: id,
    req,
  }).catch(() => {});

  return { id, deleted: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. SUPPLIER MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

export async function getSuppliers(
  schoolId: string,
  params?: { search?: string; isActive?: boolean; page?: number; limit?: number },
) {
  const page = Math.max(1, params?.page || 1);
  const limit = Math.min(100, Math.max(1, params?.limit || 20));
  const skip = (page - 1) * limit;

  const where: Prisma.SupplierWhereInput = {
    schoolId,
    ...(params?.isActive !== undefined && { isActive: params.isActive }),
    ...(params?.search && {
      OR: [
        { name: { contains: params.search, mode: "insensitive" } },
        { contactName: { contains: params.search, mode: "insensitive" } },
        { email: { contains: params.search, mode: "insensitive" } },
        { phone: { contains: params.search, mode: "insensitive" } },
      ],
    }),
  };

  const [suppliers, total] = await Promise.all([
    db.supplier.findMany({
      where,
      skip,
      take: limit,
      include: {
        _count: { select: { items: true, purchaseOrders: true } },
      },
      orderBy: [{ name: "asc" }],
    }),
    db.supplier.count({ where }),
  ]);

  return { suppliers, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getSupplierById(schoolId: string, id: string) {
  const supplier = await db.supplier.findFirst({
    where: { id, schoolId },
    include: {
      items: {
        where: { isActive: true },
        select: { id: true, name: true, itemType: true, unitCost: true, status: true },
      },
      purchaseOrders: {
        take: 10,
        orderBy: { createdAt: "desc" },
        select: { id: true, poNumber: true, status: true, totalAmount: true, createdAt: true },
      },
      _count: { select: { items: true, purchaseOrders: true } },
    },
  });
  if (!supplier) throw new AppError("Supplier not found", 404);
  return supplier;
}

export async function createSupplier(
  schoolId: string,
  data: {
    name: string;
    contactName?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    taxId?: string | null;
    paymentTerms?: string | null;
    rating?: number | null;
  },
  req?: Request,
) {
  const supplier = await db.supplier.create({
    data: {
      schoolId,
      name: data.name.trim(),
      contactName: data.contactName?.trim() || null,
      phone: data.phone?.trim() || null,
      email: data.email?.trim().toLowerCase() || null,
      address: data.address?.trim() || null,
      taxId: data.taxId?.trim() || null,
      paymentTerms: data.paymentTerms?.trim() || null,
      rating: data.rating ? Math.min(5, Math.max(1, data.rating)) : null,
    },
  });

  recordAuditEvent({
    schoolId,
    actorId: req?.user?.id,
    action: "INVENTORY_SUPPLIER_CREATED",
    targetType: "SUPPLIER",
    targetId: supplier.id,
    metadata: { name: supplier.name, contactName: supplier.contactName },
    req,
  }).catch(() => {});

  return supplier;
}

export async function updateSupplier(
  schoolId: string,
  id: string,
  data: Partial<{
    name: string;
    contactName: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    taxId: string | null;
    paymentTerms: string | null;
    rating: number | null;
    isActive: boolean;
  }>,
  req?: Request,
) {
  const existing = await db.supplier.findFirst({ where: { id, schoolId } });
  if (!existing) throw new AppError("Supplier not found", 404);

  const updated = await db.supplier.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.contactName !== undefined && { contactName: data.contactName?.trim() || null }),
      ...(data.phone !== undefined && { phone: data.phone?.trim() || null }),
      ...(data.email !== undefined && { email: data.email?.trim().toLowerCase() || null }),
      ...(data.address !== undefined && { address: data.address?.trim() || null }),
      ...(data.taxId !== undefined && { taxId: data.taxId?.trim() || null }),
      ...(data.paymentTerms !== undefined && { paymentTerms: data.paymentTerms?.trim() || null }),
      ...(data.rating !== undefined && { rating: data.rating ? Math.min(5, Math.max(1, data.rating)) : null }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });

  recordAuditEvent({
    schoolId,
    actorId: req?.user?.id,
    action: "INVENTORY_SUPPLIER_UPDATED",
    targetType: "SUPPLIER",
    targetId: updated.id,
    metadata: data,
    req,
  }).catch(() => {});

  return updated;
}

export async function deleteSupplier(schoolId: string, id: string, req?: Request) {
  const supplier = await db.supplier.findFirst({
    where: { id, schoolId },
    include: {
      _count: { select: { purchaseOrders: true, items: true } },
    },
  });
  if (!supplier) throw new AppError("Supplier not found", 404);

  if (supplier._count.purchaseOrders > 0) {
    // Soft delete if linked to purchase orders
    await db.supplier.update({ where: { id }, data: { isActive: false } });
  } else {
    // Unlink items preferred supplier and delete
    await db.inventoryItem.updateMany({
      where: { preferredSupplierId: id },
      data: { preferredSupplierId: null },
    });
    await db.supplier.delete({ where: { id } });
  }

  recordAuditEvent({
    schoolId,
    actorId: req?.user?.id,
    action: "INVENTORY_SUPPLIER_DELETED",
    targetType: "SUPPLIER",
    targetId: id,
    req,
  }).catch(() => {});

  return { id, deleted: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. INVENTORY ITEM CATALOG & ASSET MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateItemDTO {
  categoryId: string;
  name: string;
  itemType: ItemType;
  sku?: string | null;
  barcodeNumber?: string | null;
  description?: string | null;
  unit?: string;
  imageUrl?: string | null;
  currentLocationId?: string | null;
  preferredSupplierId?: string | null;
  notes?: string | null;

  // Fixed Asset Specific
  serialNumber?: string | null;
  assetTagNumber?: string | null;
  purchaseDate?: string | Date | null;
  purchaseCost?: number | null;
  warrantyExpiresAt?: string | Date | null;
  depreciationMethod?: DepreciationMethod;
  usefulLifeMonths?: number | null;
  salvageValue?: number | null;

  // Consumable Specific
  quantityOnHand?: number;
  reorderPoint?: number | null;
  reorderQty?: number | null;
  unitCost?: number | null;
}

export async function createInventoryItem(
  schoolId: string,
  data: CreateItemDTO,
  performedById: string,
  req?: Request,
) {
  // Validate Category
  const category = await db.inventoryCategory.findFirst({
    where: { id: data.categoryId, schoolId },
  });
  if (!category) throw new AppError("Inventory category not found", 400);

  // Validate Location
  if (data.currentLocationId) {
    const loc = await db.inventoryLocation.findFirst({
      where: { id: data.currentLocationId, schoolId, isActive: true },
    });
    if (!loc) throw new AppError("Current location not found", 400);
  }

  // Validate Supplier
  if (data.preferredSupplierId) {
    const supp = await db.supplier.findFirst({
      where: { id: data.preferredSupplierId, schoolId, isActive: true },
    });
    if (!supp) throw new AppError("Preferred supplier not found", 400);
  }

  // Auto-generate Asset Tag Number if Fixed Asset and not provided
  let assetTag = data.assetTagNumber?.trim() || null;
  if (data.itemType === ItemType.FIXED_ASSET && !assetTag) {
    const count = await db.inventoryItem.count({
      where: { schoolId, itemType: ItemType.FIXED_ASSET },
    });
    const year = new Date().getFullYear();
    assetTag = `AST-${year}-${String(count + 1).padStart(5, "0")}`;
  }

  // Auto-generate Barcode Number if not provided
  let barcode = data.barcodeNumber?.trim() || null;
  if (!barcode) {
    const prefix = data.itemType === ItemType.FIXED_ASSET ? "FA" : "CS";
    const rand = Math.floor(10000000 + Math.random() * 90000000);
    barcode = `${prefix}-${rand}`;
  }

  // Check unique constraints for serialNumber and barcodeNumber
  if (data.serialNumber) {
    const dupSerial = await db.inventoryItem.findFirst({
      where: { serialNumber: data.serialNumber.trim() },
    });
    if (dupSerial) throw new AppError(`Serial number '${data.serialNumber}' already registered`, 400);
  }

  if (assetTag) {
    const dupTag = await db.inventoryItem.findFirst({
      where: { assetTagNumber: assetTag },
    });
    if (dupTag) throw new AppError(`Asset tag '${assetTag}' already registered`, 400);
  }

  const initialQty = data.itemType === ItemType.CONSUMABLE ? Number(data.quantityOnHand) || 0 : 1;

  // Transaction: Create Item + Ledger Initial Stock Movement
  const result = await db.$transaction(async (tx) => {
    const item = await tx.inventoryItem.create({
      data: {
        schoolId,
        categoryId: data.categoryId,
        name: data.name.trim(),
        sku: data.sku?.trim() || null,
        barcodeNumber: barcode,
        itemType: data.itemType,
        description: data.description?.trim() || null,
        unit: data.unit?.trim() || category.defaultUnit || "piece",
        imageUrl: data.imageUrl || null,
        currentLocationId: data.currentLocationId || null,
        preferredSupplierId: data.preferredSupplierId || null,
        notes: data.notes?.trim() || null,
        status: ItemLifecycleStatus.IN_STOCK,
        condition: ItemCondition.NEW,

        // Fixed Asset Fields
        serialNumber: data.serialNumber?.trim() || null,
        assetTagNumber: assetTag,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
        purchaseCost: data.purchaseCost ?? null,
        warrantyExpiresAt: data.warrantyExpiresAt ? new Date(data.warrantyExpiresAt) : null,
        depreciationMethod: data.depreciationMethod || DepreciationMethod.NONE,
        usefulLifeMonths: data.usefulLifeMonths ?? null,
        salvageValue: data.salvageValue ?? 0,
        currentBookValue: data.purchaseCost ?? null,

        // Consumable Fields
        quantityOnHand: initialQty,
        reorderPoint: data.reorderPoint ?? category.defaultReorderPoint ?? null,
        reorderQty: data.reorderQty ?? category.defaultReorderQty ?? null,
        unitCost: data.unitCost ?? null,
      },
      include: {
        category: true,
        currentLocation: true,
        preferredSupplier: true,
      },
    });

    // Record initial stock receipt in movement ledger
    if (initialQty > 0) {
      await recordMovement(
        tx,
        {
          schoolId,
          itemId: item.id,
          type: MovementType.RECEIVED,
          quantity: initialQty,
          toLocationId: item.currentLocationId,
          performedById,
          note: "Initial catalog item creation stock-in",
        },
        req,
      );
    }

    return item;
  });

  return result;
}

export async function getInventoryItems(
  schoolId: string,
  params?: {
    search?: string;
    categoryId?: string;
    itemType?: ItemType;
    status?: ItemLifecycleStatus;
    condition?: ItemCondition;
    locationId?: string;
    isLowStock?: boolean;
    page?: number;
    limit?: number;
  },
) {
  const page = Math.max(1, params?.page || 1);
  const limit = Math.min(100, Math.max(1, params?.limit || 20));
  const skip = (page - 1) * limit;

  const where: Prisma.InventoryItemWhereInput = {
    schoolId,
    isActive: true,
    ...(params?.categoryId && { categoryId: params.categoryId }),
    ...(params?.itemType && { itemType: params.itemType }),
    ...(params?.status && { status: params.status }),
    ...(params?.condition && { condition: params.condition }),
    ...(params?.locationId && { currentLocationId: params.locationId }),
    ...(params?.search && {
      OR: [
        { name: { contains: params.search, mode: "insensitive" } },
        { sku: { contains: params.search, mode: "insensitive" } },
        { assetTagNumber: { contains: params.search, mode: "insensitive" } },
        { serialNumber: { contains: params.search, mode: "insensitive" } },
        { barcodeNumber: { contains: params.search, mode: "insensitive" } },
      ],
    }),
  };

  const [items, total] = await Promise.all([
    db.inventoryItem.findMany({
      where,
      skip,
      take: limit,
      include: {
        category: { select: { id: true, name: true } },
        currentLocation: { select: { id: true, name: true, type: true } },
        preferredSupplier: { select: { id: true, name: true } },
        allocations: {
          where: { status: "ACTIVE" },
          take: 1,
          include: {
            custodianUser: { select: { id: true, firstName: true, lastName: true, role: true } },
            custodianRoom: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    }),
    db.inventoryItem.count({ where }),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getLowStockItems(schoolId: string) {
  const items = await db.inventoryItem.findMany({
    where: {
      schoolId,
      isActive: true,
      itemType: ItemType.CONSUMABLE,
      reorderPoint: { not: null },
    },
    include: {
      category: { select: { id: true, name: true } },
      currentLocation: { select: { id: true, name: true } },
      preferredSupplier: { select: { id: true, name: true, phone: true, email: true } },
    },
    orderBy: [{ quantityOnHand: "asc" }],
  });

  return items.filter((item) => (item.quantityOnHand ?? 0) <= (item.reorderPoint ?? 0));
}

export async function getItemById(schoolId: string, id: string) {
  const item = await db.inventoryItem.findFirst({
    where: { id, schoolId },
    include: {
      category: true,
      currentLocation: { include: { parent: true } },
      preferredSupplier: true,
      allocations: {
        orderBy: { issuedAt: "desc" },
        take: 10,
        include: {
          custodianUser: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
          custodianRoom: { select: { id: true, name: true } },
          issuedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      movements: {
        orderBy: { createdAt: "desc" },
        take: 15,
        include: {
          fromLocation: { select: { id: true, name: true } },
          toLocation: { select: { id: true, name: true } },
          performedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      maintenanceRecords: {
        orderBy: { reportedAt: "desc" },
        take: 10,
        include: {
          reportedBy: { select: { id: true, firstName: true, lastName: true } },
          assignedToStaff: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });

  if (!item) throw new AppError("Inventory item not found", 404);
  return item;
}

export async function getItemHistory(schoolId: string, id: string) {
  const item = await db.inventoryItem.findFirst({
    where: { id, schoolId },
    select: { id: true, name: true, assetTagNumber: true, itemType: true },
  });
  if (!item) throw new AppError("Inventory item not found", 404);

  const [movements, allocations, maintenance, disposals] = await Promise.all([
    db.inventoryMovement.findMany({
      where: { itemId: id, schoolId },
      include: {
        fromLocation: { select: { id: true, name: true } },
        toLocation: { select: { id: true, name: true } },
        performedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.inventoryAllocation.findMany({
      where: { itemId: id, schoolId },
      include: {
        custodianUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        custodianRoom: { select: { id: true, name: true } },
        issuedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { issuedAt: "desc" },
    }),
    db.maintenanceRecord.findMany({
      where: { itemId: id, schoolId },
      include: {
        reportedBy: { select: { id: true, firstName: true, lastName: true } },
        assignedToStaff: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { reportedAt: "desc" },
    }),
    db.disposalRecord.findMany({
      where: { itemId: id, schoolId },
      include: {
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { disposedAt: "desc" },
    }),
  ]);

  return { item, movements, allocations, maintenance, disposals };
}

export async function generateItemQRCode(schoolId: string, id: string) {
  const item = await db.inventoryItem.findFirst({
    where: { id, schoolId },
    select: { id: true, name: true, assetTagNumber: true, barcodeNumber: true, itemType: true },
  });
  if (!item) throw new AppError("Inventory item not found", 404);

  const payload = JSON.stringify({
    id: item.id,
    tag: item.assetTagNumber || item.barcodeNumber,
    name: item.name,
    type: item.itemType,
  });

  const qrDataUrl = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 300,
    color: {
      dark: "#1e1b4b",
      light: "#ffffff",
    },
  });

  return { item, qrDataUrl };
}

export async function updateInventoryItem(
  schoolId: string,
  id: string,
  data: Partial<CreateItemDTO>,
  performedById: string,
  req?: Request,
) {
  const existing = await db.inventoryItem.findFirst({
    where: { id, schoolId },
  });
  if (!existing) throw new AppError("Inventory item not found", 404);

  const updated = await db.inventoryItem.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
      ...(data.sku !== undefined && { sku: data.sku?.trim() || null }),
      ...(data.description !== undefined && { description: data.description?.trim() || null }),
      ...(data.unit !== undefined && { unit: data.unit.trim() }),
      ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl || null }),
      ...(data.preferredSupplierId !== undefined && { preferredSupplierId: data.preferredSupplierId || null }),
      ...(data.notes !== undefined && { notes: data.notes?.trim() || null }),
      ...(data.purchaseCost !== undefined && { purchaseCost: data.purchaseCost }),
      ...(data.warrantyExpiresAt !== undefined && {
        warrantyExpiresAt: data.warrantyExpiresAt ? new Date(data.warrantyExpiresAt) : null,
      }),
      ...(data.usefulLifeMonths !== undefined && { usefulLifeMonths: data.usefulLifeMonths }),
      ...(data.salvageValue !== undefined && { salvageValue: data.salvageValue }),
      ...(data.reorderPoint !== undefined && { reorderPoint: data.reorderPoint }),
      ...(data.reorderQty !== undefined && { reorderQty: data.reorderQty }),
      ...(data.unitCost !== undefined && { unitCost: data.unitCost }),
    },
    include: {
      category: true,
      currentLocation: true,
      preferredSupplier: true,
    },
  });

  recordAuditEvent({
    schoolId,
    actorId: performedById,
    action: "INVENTORY_ITEM_UPDATED",
    targetType: "INVENTORY_ITEM",
    targetId: updated.id,
    metadata: data,
    req,
  }).catch(() => {});

  return updated;
}

export async function deleteInventoryItem(schoolId: string, id: string, req?: Request) {
  const item = await db.inventoryItem.findFirst({
    where: { id, schoolId },
    include: {
      allocations: { where: { status: "ACTIVE" } },
    },
  });
  if (!item) throw new AppError("Inventory item not found", 404);

  if (item.allocations.length > 0) {
    throw new AppError("Cannot delete an item that is currently allocated. Return or transfer it first.", 400);
  }

  await db.inventoryItem.update({
    where: { id },
    data: { isActive: false },
  });

  recordAuditEvent({
    schoolId,
    actorId: req?.user?.id,
    action: "INVENTORY_ITEM_DELETED",
    targetType: "INVENTORY_ITEM",
    targetId: id,
    req,
  }).catch(() => {});

  return { id, deleted: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. INVENTORY ALLOCATIONS (ISSUE / RETURN / TRANSFER)
// ─────────────────────────────────────────────────────────────────────────────

export interface IssueAllocationDTO {
  itemId: string;
  quantity?: number;
  requestId?: string | null;
  custodianType: CustodianType;
  custodianUserId?: string | null;
  custodianRoomId?: string | null;
  custodianLabel?: string | null;
  dueBackAt?: string | Date | null;
  conditionAtIssue?: ItemCondition;
  notes?: string | null;
}

export async function issueAllocation(
  schoolId: string,
  data: IssueAllocationDTO,
  issuedById: string,
  req?: Request,
) {
  const item = await db.inventoryItem.findFirst({
    where: { id: data.itemId, schoolId, isActive: true },
    include: {
      allocations: { where: { status: "ACTIVE" } },
    },
  });

  if (!item) throw new AppError("Inventory item not found or is inactive", 404);

  // Business Rule: Disposed / lost items cannot be allocated
  if (item.status === ItemLifecycleStatus.DISPOSED || item.status === ItemLifecycleStatus.LOST) {
    throw new AppError(`Cannot allocate item with status '${item.status}'`, 400);
  }

  // Business Rule: Validate Fixed Asset allocation constraints
  if (item.itemType === ItemType.FIXED_ASSET) {
    if (item.status !== ItemLifecycleStatus.IN_STOCK) {
      throw new AppError(
        `Fixed asset '${item.name}' cannot be allocated because it is currently ${item.status}`,
        400,
      );
    }
    if (item.allocations.length > 0) {
      throw new AppError(`Fixed asset '${item.name}' already has an active allocation`, 400);
    }
  }

  // Business Rule: Validate Consumable quantityOnHand constraints
  const issueQty = item.itemType === ItemType.FIXED_ASSET ? 1 : Math.max(1, data.quantity || 1);
  if (item.itemType === ItemType.CONSUMABLE) {
    const currentStock = item.quantityOnHand ?? 0;
    if (issueQty > currentStock) {
      throw new AppError(
        `Insufficient stock for '${item.name}'. Available: ${currentStock}, Requested: ${issueQty}`,
        400,
      );
    }
  }

  // Validate Custodian Details
  if (data.custodianType === CustodianType.STAFF || data.custodianType === CustodianType.STUDENT) {
    if (!data.custodianUserId) {
      throw new AppError("Custodian user ID is required for STAFF or STUDENT custodians", 400);
    }
    const user = await db.user.findFirst({
      where: { id: data.custodianUserId, schoolId, isActive: true },
    });
    if (!user) throw new AppError("Custodian user account not found", 400);
  } else if (data.custodianType === CustodianType.ROOM) {
    if (!data.custodianRoomId) {
      throw new AppError("Custodian room ID is required for ROOM custodian type", 400);
    }
    const room = await db.inventoryLocation.findFirst({
      where: { id: data.custodianRoomId, schoolId, isActive: true },
    });
    if (!room) throw new AppError("Custodian room location not found", 400);
  }

  // Execute Allocation and Ledger update in a single atomic transaction
  const result = await db.$transaction(async (tx) => {
    // 1. Create Allocation Record
    const allocation = await tx.inventoryAllocation.create({
      data: {
        schoolId,
        itemId: item.id,
        quantity: issueQty,
        requestId: data.requestId || null,
        custodianType: data.custodianType,
        custodianUserId: data.custodianUserId || null,
        custodianRoomId: data.custodianRoomId || null,
        custodianLabel: data.custodianLabel?.trim() || null,
        issuedById,
        dueBackAt: data.dueBackAt ? new Date(data.dueBackAt) : null,
        conditionAtIssue: data.conditionAtIssue || item.condition || ItemCondition.GOOD,
        status: "ACTIVE",
        notes: data.notes?.trim() || null,
      },
      include: {
        item: true,
        custodianUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        custodianRoom: { select: { id: true, name: true } },
        issuedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // 2. Update Item Status / Location / Stock
    let newStock = item.quantityOnHand;
    let newStatus = item.status;
    let newLocationId = item.currentLocationId;

    if (item.itemType === ItemType.FIXED_ASSET) {
      newStatus = ItemLifecycleStatus.ALLOCATED;
      if (data.custodianType === CustodianType.ROOM && data.custodianRoomId) {
        newLocationId = data.custodianRoomId;
      }
    } else {
      newStock = Math.max(0, (item.quantityOnHand ?? 0) - issueQty);
    }

    await tx.inventoryItem.update({
      where: { id: item.id },
      data: {
        status: newStatus,
        quantityOnHand: newStock,
        currentLocationId: newLocationId,
      },
    });

    // 3. Record Immutable Ledger Movement
    await recordMovement(
      tx,
      {
        schoolId,
        itemId: item.id,
        type: MovementType.ALLOCATED,
        quantity: issueQty,
        fromLocationId: item.currentLocationId,
        toLocationId: newLocationId,
        performedById: issuedById,
        relatedAllocationId: allocation.id,
        note: data.notes || `Allocated to ${data.custodianType}: ${data.custodianLabel || data.custodianUserId || data.custodianRoomId}`,
      },
      req,
    );

    // 4. Low-stock trigger check
    if (
      item.itemType === ItemType.CONSUMABLE &&
      item.reorderPoint !== null &&
      newStock !== null &&
      newStock <= item.reorderPoint
    ) {
      // Create notification for school administrators
      const admins = await tx.user.findMany({
        where: { schoolId, role: { in: ["ADMIN", "SUPER_ADMIN", "FINANCE"] }, isActive: true },
        select: { id: true },
        take: 10,
      });

      for (const adm of admins) {
        await tx.notification.create({
          data: {
            schoolId,
            userId: adm.id,
            type: "INVENTORY",
            title: `Low Stock Alert: ${item.name}`,
            body: `Stock for '${item.name}' is now ${newStock} ${item.unit} (reorder point: ${item.reorderPoint}).`,
            data: { itemId: item.id, quantityOnHand: newStock, reorderPoint: item.reorderPoint },
          },
        });
      }
    }

    return allocation;
  });

  return result;
}

export interface ReturnAllocationDTO {
  conditionAtReturn: ItemCondition;
  returnLocationId?: string | null;
  quantityReturned?: number;
  notes?: string | null;
}

export async function returnAllocation(
  schoolId: string,
  allocationId: string,
  data: ReturnAllocationDTO,
  performedById: string,
  req?: Request,
) {
  const allocation = await db.inventoryAllocation.findFirst({
    where: { id: allocationId, schoolId },
    include: { item: true },
  });

  if (!allocation) throw new AppError("Allocation record not found", 404);
  if (allocation.status !== "ACTIVE" && allocation.status !== "OVERDUE") {
    throw new AppError(`Cannot return an allocation that is already ${allocation.status}`, 400);
  }

  const item = allocation.item;
  const isDamaged =
    data.conditionAtReturn === ItemCondition.DAMAGED ||
    data.conditionAtReturn === ItemCondition.CONDEMNED;

  const result = await db.$transaction(async (tx) => {
    // 1. Update Allocation Status
    const updatedAllocation = await tx.inventoryAllocation.update({
      where: { id: allocationId },
      data: {
        status: isDamaged ? "DAMAGED" : "RETURNED",
        conditionAtReturn: data.conditionAtReturn,
        returnedAt: new Date(),
        notes: data.notes
          ? `${allocation.notes ? allocation.notes + "\n" : ""}${data.notes}`
          : allocation.notes,
      },
      include: {
        item: true,
        custodianUser: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    let maintenanceRecordId: string | null = null;

    // 2. Business Rule: Damaged Return automatically opens a MaintenanceRecord
    if (isDamaged) {
      const maint = await tx.maintenanceRecord.create({
        data: {
          schoolId,
          itemId: item.id,
          reportedById: performedById,
          faultDescription:
            data.notes ||
            `Item returned in ${data.conditionAtReturn} condition from allocation #${allocation.id.substring(0, 8)}`,
          status: "REPORTED",
        },
      });
      maintenanceRecordId = maint.id;

      // Update Item to UNDER_MAINTENANCE or CONDEMNED
      await tx.inventoryItem.update({
        where: { id: item.id },
        data: {
          status:
            data.conditionAtReturn === ItemCondition.CONDEMNED
              ? ItemLifecycleStatus.DISPOSED
              : ItemLifecycleStatus.UNDER_MAINTENANCE,
          condition: data.conditionAtReturn,
          ...(data.returnLocationId && { currentLocationId: data.returnLocationId }),
        },
      });

      // Record DAMAGED Movement
      await recordMovement(
        tx,
        {
          schoolId,
          itemId: item.id,
          type: MovementType.DAMAGED,
          quantity: allocation.quantity,
          fromLocationId: item.currentLocationId,
          toLocationId: data.returnLocationId || item.currentLocationId,
          performedById,
          relatedAllocationId: allocation.id,
          relatedMaintenanceId: maintenanceRecordId,
          note: `Returned damaged: ${data.notes || "Auto-flagged maintenance"}`,
        },
        req,
      );
    } else {
      // Clean return
      let newStock = item.quantityOnHand;
      if (item.itemType === ItemType.CONSUMABLE) {
        const qtyReturned = data.quantityReturned ?? allocation.quantity;
        newStock = (item.quantityOnHand ?? 0) + qtyReturned;
      }

      await tx.inventoryItem.update({
        where: { id: item.id },
        data: {
          status: ItemLifecycleStatus.IN_STOCK,
          condition: data.conditionAtReturn,
          quantityOnHand: newStock,
          ...(data.returnLocationId && { currentLocationId: data.returnLocationId }),
        },
      });

      // Record RETURNED Movement
      await recordMovement(
        tx,
        {
          schoolId,
          itemId: item.id,
          type: MovementType.RETURNED,
          quantity: allocation.quantity,
          fromLocationId: item.currentLocationId,
          toLocationId: data.returnLocationId || item.currentLocationId,
          performedById,
          relatedAllocationId: allocation.id,
          note: data.notes || `Returned in ${data.conditionAtReturn} condition`,
        },
        req,
      );
    }

    return { allocation: updatedAllocation, maintenanceRecordId };
  });

  return result;
}

export interface TransferAllocationDTO {
  newCustodianType: CustodianType;
  newCustodianUserId?: string | null;
  newCustodianRoomId?: string | null;
  newCustodianLabel?: string | null;
  newLocationId?: string | null;
  notes?: string | null;
}

export async function transferAllocation(
  schoolId: string,
  allocationId: string,
  data: TransferAllocationDTO,
  performedById: string,
  req?: Request,
) {
  const allocation = await db.inventoryAllocation.findFirst({
    where: { id: allocationId, schoolId },
    include: { item: true },
  });

  if (!allocation) throw new AppError("Allocation not found", 404);
  if (allocation.status !== "ACTIVE") {
    throw new AppError("Only active allocations can be transferred", 400);
  }

  // Validate new custodian
  if (data.newCustodianType === CustodianType.STAFF || data.newCustodianType === CustodianType.STUDENT) {
    if (!data.newCustodianUserId) {
      throw new AppError("New custodian user ID is required", 400);
    }
    const user = await db.user.findFirst({
      where: { id: data.newCustodianUserId, schoolId, isActive: true },
    });
    if (!user) throw new AppError("Target custodian user account not found", 400);
  } else if (data.newCustodianType === CustodianType.ROOM) {
    if (!data.newCustodianRoomId) {
      throw new AppError("New custodian room ID is required", 400);
    }
    const room = await db.inventoryLocation.findFirst({
      where: { id: data.newCustodianRoomId, schoolId, isActive: true },
    });
    if (!room) throw new AppError("Target room location not found", 400);
  }

  const result = await db.$transaction(async (tx) => {
    const updatedAllocation = await tx.inventoryAllocation.update({
      where: { id: allocationId },
      data: {
        custodianType: data.newCustodianType,
        custodianUserId: data.newCustodianUserId || null,
        custodianRoomId: data.newCustodianRoomId || null,
        custodianLabel: data.newCustodianLabel?.trim() || null,
        notes: data.notes
          ? `${allocation.notes ? allocation.notes + "\n" : ""}Transfer: ${data.notes}`
          : allocation.notes,
      },
      include: {
        item: true,
        custodianUser: { select: { id: true, firstName: true, lastName: true } },
        custodianRoom: { select: { id: true, name: true } },
      },
    });

    const targetLocationId =
      data.newLocationId ||
      (data.newCustodianType === CustodianType.ROOM ? data.newCustodianRoomId : null) ||
      allocation.item.currentLocationId;

    if (targetLocationId !== allocation.item.currentLocationId) {
      await tx.inventoryItem.update({
        where: { id: allocation.itemId },
        data: { currentLocationId: targetLocationId },
      });
    }

    await recordMovement(
      tx,
      {
        schoolId,
        itemId: allocation.itemId,
        type: MovementType.TRANSFERRED,
        quantity: allocation.quantity,
        fromLocationId: allocation.item.currentLocationId,
        toLocationId: targetLocationId,
        performedById,
        relatedAllocationId: allocation.id,
        note: `Transferred to ${data.newCustodianType}: ${data.newCustodianLabel || data.newCustodianUserId || data.newCustodianRoomId}`,
      },
      req,
    );

    return updatedAllocation;
  });

  return result;
}

export async function getAllocations(
  schoolId: string,
  params?: {
    status?: string;
    itemId?: string;
    custodianUserId?: string;
    custodianType?: CustodianType;
    search?: string;
    page?: number;
    limit?: number;
  },
) {
  const page = Math.max(1, params?.page || 1);
  const limit = Math.min(100, Math.max(1, params?.limit || 20));
  const skip = (page - 1) * limit;

  const where: Prisma.InventoryAllocationWhereInput = {
    schoolId,
    ...(params?.status && { status: params.status as any }),
    ...(params?.itemId && { itemId: params.itemId }),
    ...(params?.custodianUserId && { custodianUserId: params.custodianUserId }),
    ...(params?.custodianType && { custodianType: params.custodianType }),
    ...(params?.search && {
      OR: [
        { item: { name: { contains: params.search, mode: "insensitive" } } },
        { item: { assetTagNumber: { contains: params.search, mode: "insensitive" } } },
        { custodianLabel: { contains: params.search, mode: "insensitive" } },
      ],
    }),
  };

  const [allocations, total] = await Promise.all([
    db.inventoryAllocation.findMany({
      where,
      skip,
      take: limit,
      include: {
        item: {
          select: {
            id: true,
            name: true,
            assetTagNumber: true,
            serialNumber: true,
            itemType: true,
            currentLocation: { select: { id: true, name: true } },
          },
        },
        custodianUser: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        custodianRoom: { select: { id: true, name: true, type: true } },
        issuedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ issuedAt: "desc" }],
    }),
    db.inventoryAllocation.count({ where }),
  ]);

  return { allocations, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getAllocationById(schoolId: string, id: string) {
  const allocation = await db.inventoryAllocation.findFirst({
    where: { id, schoolId },
    include: {
      item: {
        include: {
          category: true,
          currentLocation: true,
        },
      },
      custodianUser: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true } },
      custodianRoom: { select: { id: true, name: true, type: true } },
      issuedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });
  if (!allocation) throw new AppError("Allocation record not found", 404);
  return allocation;
}

export async function getMyAllocations(schoolId: string, userId: string) {
  const allocations = await db.inventoryAllocation.findMany({
    where: {
      schoolId,
      custodianUserId: userId,
    },
    include: {
      item: {
        select: {
          id: true,
          name: true,
          itemType: true,
          assetTagNumber: true,
          serialNumber: true,
          imageUrl: true,
          currentLocation: { select: { id: true, name: true } },
        },
      },
      issuedBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ status: "asc" }, { issuedAt: "desc" }],
  });

  return allocations;
}

export async function getOverdueAllocations(schoolId: string) {
  const now = new Date();
  const overdueAllocations = await db.inventoryAllocation.findMany({
    where: {
      schoolId,
      status: "ACTIVE",
      dueBackAt: { lt: now },
    },
    include: {
      item: {
        select: {
          id: true,
          name: true,
          assetTagNumber: true,
          serialNumber: true,
          currentLocation: { select: { id: true, name: true } },
        },
      },
      custodianUser: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      custodianRoom: { select: { id: true, name: true } },
      issuedBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ dueBackAt: "asc" }],
  });

  return overdueAllocations;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. GOODS RECEIPTS (STOCK-IN / RECEIVING)
// ─────────────────────────────────────────────────────────────────────────────

export interface GoodsReceiptLineInput {
  poLineId?: string | null;
  itemId?: string | null;
  quantityReceived: number;
  conditionOnArrival?: ItemCondition;
  serialNumbers?: string[];
  unitCost?: number;
  itemName?: string;
  categoryId?: string;
}

export interface CreateGoodsReceiptDTO {
  poId?: string | null;
  locationId: string;
  notes?: string | null;
  discrepancyNotes?: string | null;
  lines: GoodsReceiptLineInput[];
}

export async function createGoodsReceipt(
  schoolId: string,
  data: CreateGoodsReceiptDTO,
  receivedById: string,
  req?: Request,
) {
  const location = await db.inventoryLocation.findFirst({
    where: { id: data.locationId, schoolId, isActive: true },
  });
  if (!location) throw new AppError("Receiving store location not found", 400);

  if (!data.lines || data.lines.length === 0) {
    throw new AppError("At least one goods receipt line is required", 400);
  }

  const result = await db.$transaction(async (tx) => {
    // 1. If PO is linked, validate PO
    let purchaseOrder: any = null;
    if (data.poId) {
      purchaseOrder = await tx.purchaseOrder.findFirst({
        where: { id: data.poId, schoolId },
        include: { lines: true },
      });
      if (!purchaseOrder) throw new AppError("Linked Purchase Order not found", 404);
    }

    // 2. Create Goods Receipt Header
    const receipt = await tx.goodsReceipt.create({
      data: {
        schoolId,
        poId: data.poId || (purchaseOrder?.id ?? ""),
        receivedById,
        locationId: data.locationId,
        notes: data.notes?.trim() || null,
        discrepancyNotes: data.discrepancyNotes?.trim() || null,
      },
    });

    // 3. Process Lines
    for (const line of data.lines) {
      const qty = Math.max(1, line.quantityReceived);

      if (line.itemId) {
        const item = await tx.inventoryItem.findFirst({
          where: { id: line.itemId, schoolId },
        });

        if (item) {
          if (item.itemType === ItemType.CONSUMABLE) {
            // Increment consumable stock
            await tx.inventoryItem.update({
              where: { id: item.id },
              data: {
                quantityOnHand: (item.quantityOnHand ?? 0) + qty,
                currentLocationId: data.locationId,
                ...(line.unitCost && { unitCost: line.unitCost }),
              },
            });

            // Write Movement
            await recordMovement(
              tx,
              {
                schoolId,
                itemId: item.id,
                type: MovementType.RECEIVED,
                quantity: qty,
                toLocationId: data.locationId,
                performedById: receivedById,
                note: `Goods receipt #${receipt.id.substring(0, 8)}: ${data.notes || "Stock-in"}`,
              },
              req,
            );
          } else {
            // Fixed Asset
            await tx.inventoryItem.update({
              where: { id: item.id },
              data: {
                status: ItemLifecycleStatus.IN_STOCK,
                condition: line.conditionOnArrival || ItemCondition.NEW,
                currentLocationId: data.locationId,
              },
            });

            await recordMovement(
              tx,
              {
                schoolId,
                itemId: item.id,
                type: MovementType.RECEIVED,
                quantity: 1,
                toLocationId: data.locationId,
                performedById: receivedById,
                note: `Goods receipt #${receipt.id.substring(0, 8)}`,
              },
              req,
            );
          }
        }
      }

      // If poLineId exists, update PO Line quantityReceived
      if (line.poLineId) {
        await tx.purchaseOrderLine.update({
          where: { id: line.poLineId },
          data: { quantityReceived: { increment: qty } },
        });

        await tx.goodsReceiptLine.create({
          data: {
            receiptId: receipt.id,
            poLineId: line.poLineId,
            quantityReceived: qty,
            conditionOnArrival: line.conditionOnArrival || ItemCondition.NEW,
            serialNumbers: line.serialNumbers || [],
          },
        });
      }
    }

    // 4. Update PO status if linked
    if (purchaseOrder) {
      const refreshedPo = await tx.purchaseOrder.findUnique({
        where: { id: purchaseOrder.id },
        include: { lines: true },
      });
      const allReceived = refreshedPo?.lines.every((l) => l.quantityReceived >= l.quantityOrdered);
      const anyReceived = refreshedPo?.lines.some((l) => l.quantityReceived > 0);

      await tx.purchaseOrder.update({
        where: { id: purchaseOrder.id },
        data: {
          status: allReceived
            ? "RECEIVED"
            : anyReceived
            ? "PARTIALLY_RECEIVED"
            : purchaseOrder.status,
        },
      });
    }

    return receipt;
  });

  return result;
}

export async function getGoodsReceipts(
  schoolId: string,
  params?: { page?: number; limit?: number },
) {
  const page = Math.max(1, params?.page || 1);
  const limit = Math.min(100, Math.max(1, params?.limit || 20));
  const skip = (page - 1) * limit;

  const [receipts, total] = await Promise.all([
    db.goodsReceipt.findMany({
      where: { schoolId },
      skip,
      take: limit,
      include: {
        location: { select: { id: true, name: true } },
        receivedBy: { select: { id: true, firstName: true, lastName: true } },
        po: { select: { id: true, poNumber: true } },
        lines: { include: { poLine: true } },
      },
      orderBy: [{ receivedAt: "desc" }],
    }),
    db.goodsReceipt.count({ where: { schoolId } }),
  ]);

  return { receipts, total, page, limit, totalPages: Math.ceil(total / limit) };
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. MOVEMENT LEDGER QUERIES
// ─────────────────────────────────────────────────────────────────────────────

export async function getMovements(
  schoolId: string,
  params?: {
    itemId?: string;
    type?: MovementType;
    fromLocationId?: string;
    toLocationId?: string;
    page?: number;
    limit?: number;
  },
) {
  const page = Math.max(1, params?.page || 1);
  const limit = Math.min(100, Math.max(1, params?.limit || 20));
  const skip = (page - 1) * limit;

  const where: Prisma.InventoryMovementWhereInput = {
    schoolId,
    ...(params?.itemId && { itemId: params.itemId }),
    ...(params?.type && { type: params.type }),
    ...(params?.fromLocationId && { fromLocationId: params.fromLocationId }),
    ...(params?.toLocationId && { toLocationId: params.toLocationId }),
  };

  const [movements, total] = await Promise.all([
    db.inventoryMovement.findMany({
      where,
      skip,
      take: limit,
      include: {
        item: { select: { id: true, name: true, assetTagNumber: true, itemType: true } },
        fromLocation: { select: { id: true, name: true } },
        toLocation: { select: { id: true, name: true } },
        performedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ createdAt: "desc" }],
    }),
    db.inventoryMovement.count({ where }),
  ]);

  return { movements, total, page, limit, totalPages: Math.ceil(total / limit) };
}

