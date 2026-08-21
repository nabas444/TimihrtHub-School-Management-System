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
