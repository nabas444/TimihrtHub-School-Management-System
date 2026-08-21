# Feature 8 — Inventory & Asset Management System
### Implementation prompt for TimihrtHub School Management System

> Paste this whole document to your coding assistant (or work through it phase‑by‑phase yourself). It is written to match the conventions already used in features 1‑7: Express + TypeScript, Prisma/PostgreSQL, Zod validation, `req.user.schoolId` multi‑tenancy, `authorize(...)` RBAC, `sendSuccess/sendCreated/paginationMeta` response helpers, `AppError`, Vitest tests under `__tests__/`, and Swagger annotations.

---

## 0. Why "one page for filling and done" is the wrong model

A single `InventoryItem` table with a `quantity` and `location` text field is what almost every tutorial ships — and it's exactly what real school inventory audits fall apart on (confirmed by current industry guidance: districts using spreadsheets or single-table trackers lose assets because nothing records *who* moved *what*, *where*, *when*, or *why*). A real system separates **five concerns** that a one-page form conflates:

1. **What it is** — the catalog/category definition (a "Dell Latitop 5420" model, or "A4 photocopy paper").
2. **Where it physically lives** — a hierarchical location (Campus → Block/Building → Floor → Room/Store), not a text string.
3. **Who is accountable for it right now** — a person, a class/room, or a department (custodian).
4. **What state it's in** — condition, lifecycle stage (in stock → allocated → under repair → disposed), and for fixed assets, depreciation/value.
5. **The movement history** — every stock-in, allocation, transfer, return, repair, and disposal is its own ledger row, never an overwrite. This is what makes the audit-log feature you already built (#2) actually useful here — inventory *is* one of the highest-value places to hook it in.

The design below treats inventory the way real asset-tracking platforms (TIPWeb-IT, Asset Panda, Incident IQ, FMX) treat it: **a lifecycle with an allocator, a locator, and a ledger**, not a form.

---

## 1. Two item types — don't force them into one model

| | **Fixed / Trackable Assets** | **Consumable Stock** |
|---|---|---|
| Examples | Laptops, projectors, furniture, lab microscopes, musical instruments, vehicles | Stationery, cleaning supplies, printer paper, lab reagents, sports consumables |
| Identity | Individually serialized (1 asset tag = 1 physical unit) | Tracked by quantity/batch, not individually |
| Allocation | Assigned to a specific person/room until returned | Deducted from stock, not "returned" |
| Financials | Purchase cost, depreciation, current book value, disposal value | Unit cost, reorder point, stock valuation (optional FIFO/weighted-avg) |
| Lifecycle | Received → In Stock → Allocated → (Maintenance ↔) → Returned → Retired/Disposed | Received → In Stock → Issued/Consumed → Reordered |

Modeling these as **one `Item` table with a `type` discriminator** (rather than two unrelated tables) keeps categories, locations, suppliers, and reporting unified while letting each type carry its own extra fields and movement rules. This is the pattern below.

---

## 2. Core system components

### 2.1 Location hierarchy (the "locator")
Flat `location: String` fields (like the current `LibraryBook.location`) don't scale to "which shelf, which room, which block, which campus." Model it as a **self-referencing tree**:

```
School
 └─ InventoryLocation (type: CAMPUS)         e.g. "Main Campus"
     └─ InventoryLocation (type: BLOCK)      e.g. "Block A - Science Wing"
         └─ InventoryLocation (type: FLOOR)  e.g. "2nd Floor"
             └─ InventoryLocation (type: ROOM)   e.g. "Room 204 / Chemistry Lab"
                 └─ InventoryLocation (type: STORE_BIN) e.g. "Shelf 3, Bin B" (optional, for stores)
```

Every stock/asset unit points to its **current** `InventoryLocation`, and every movement is logged with `fromLocationId → toLocationId`. A designated location can be flagged `isStoreRoom: true` (the main warehouse/store where goods are received before being allocated out) and `isDisposalHold: true` (holding area for condemned items awaiting write-off).

### 2.2 Categories (the "what it is")
`InventoryCategory` — hierarchical (e.g. "IT Equipment" → "Laptops"), each with a default `unit` (piece, box, litre, ream), default `reorderPoint`/`reorderQty` for stock items, and whether items in it default to `FIXED_ASSET` or `CONSUMABLE`.

### 2.3 Suppliers/Vendors
`Supplier` — name, contact, address, tax/VAT id, payment terms, rating, and a relation to `PurchaseOrder`s and `InventoryItem`s (preferred supplier), so you can answer "who do we usually buy projectors from" and "what's outstanding with Vendor X."

### 2.4 Procurement chain (the "delivery")
```
InventoryRequest (a teacher/dept asks for something)
      │  approve/reject
      ▼
PurchaseOrder (store keeper/admin orders from a Supplier)
      │  goods arrive
      ▼
GoodsReceipt (GRN) — quantities actually received, condition on arrival, discrepancies
      │  stocked
      ▼
InventoryItem / StockBatch increment, at a specific InventoryLocation
```
A `PurchaseOrder` can fulfil multiple `InventoryRequest`s, and a `GoodsReceipt` can be partial (backorders happen). This is the difference between "we have a system" and "we have a spreadsheet" — you can trace a delivered laptop all the way back to the requisition that justified buying it.

### 2.5 Allocation (the "allocator")
`InventoryAllocation` — the single most important table. It answers "who currently has this, and under what authority."
- **Custodian type**: `STAFF` (an Employee), `STUDENT`, `ROOM/DEPARTMENT` (e.g., "Chemistry Lab" holds 10 microscopes as shared equipment, not assigned to one person), or `CLASS`.
- Links back to the `InventoryRequest` that justified it, where applicable.
- Has `dueBackAt` for loaned equipment (e.g., a student-issued Chromebook, camera for a club event) — this is what powers return reminders.
- Records **condition at checkout** and **condition at return**, so damage disputes have evidence, exactly like the existing `LibraryIssue` model does for books, just generalized to any asset and to non-person custodians (rooms/departments).

### 2.6 Movement ledger (the audit trail)
`InventoryMovement` — one immutable row per event: `RECEIVED, ALLOCATED, TRANSFERRED, RETURNED, ADJUSTED, DAMAGED, LOST, SENT_FOR_MAINTENANCE, RETURNED_FROM_MAINTENANCE, DISPOSED, WRITTEN_OFF`. Every write to stock quantity or asset location/custodian happens **through** a movement row, never a silent `UPDATE`. This table is what you hook your Feature #2 audit log into (or it doubles as a domain-specific audit log — see §6).

### 2.7 Maintenance & condition
`MaintenanceRecord` — fault reported → assigned to (internal staff or external vendor) → cost → resolution → date returned to service. Asset `condition` enum (`NEW, GOOD, FAIR, DAMAGED, UNDER_REPAIR, CONDEMNED`) is updated automatically when a maintenance record opens/closes.

### 2.8 Stock take / reconciliation
`StockCount` (a cycle count or full physical audit event) + `StockCountLine` (expected qty/asset vs counted qty/asset, variance, notes). This is the formal process that catches "ghost assets" (things in the system that no longer physically exist) — a named risk in every asset-management best-practice guide.

### 2.9 Disposal & depreciation
- Fixed assets get `purchaseCost`, `depreciationMethod` (`STRAIGHT_LINE` to start — good enough for a school; leave room for `REDUCING_BALANCE` later), `usefulLifeMonths`, and a computed/cached `currentBookValue`.
- `DisposalRecord` — reason (`OBSOLETE, DAMAGED_BEYOND_REPAIR, LOST, STOLEN, DONATED, SOLD`), approver, disposal method, sale value if sold, linked to the movement ledger.

---

## 3. Roles & permissions

Map onto the existing `Role` enum (`STUDENT, TEACHER, PARENT, FINANCE, ADMIN, SUPER_ADMIN`) — no schema change needed for auth, just permission *scoping* inside the inventory module:

| Responsibility | Who | What they can do |
|---|---|---|
| **Requester** | `TEACHER`, `ADMIN` (any staff, via their `Employee`/`User` record) | Create `InventoryRequest`s for their department/class; see their own allocations; report a fault |
| **Approver** | `ADMIN` (department-head-equivalent), configurable per school | Approve/reject requests above a school-configurable threshold; escalate high-value requests to `SUPER_ADMIN`/`FINANCE` |
| **Store Keeper / Inventory Officer** | `ADMIN` (a staff member tagged as inventory manager — reuse the same "designated role" pattern you likely used for library/HR) | Manage catalog, locations, suppliers, POs, goods receipt, stock-in, issue/allocate, transfer, initiate stock counts |
| **Finance** | `FINANCE` | View/approve purchase orders above budget threshold, view depreciation & valuation reports, approve disposals with financial impact |
| **Asset Custodian** | Any `User` (teacher, admin, or even student for issued devices) | View items currently assigned to them, request return/extension, report damage |
| **Super Admin** | `SUPER_ADMIN` | Full access, cross-school reporting if the platform is multi-school SaaS, override approvals |

Add a lightweight `InventoryPermission` (or reuse a `staffRole` tag on `Employee` if that already exists from Feature 3/4) so a school can designate *which* ADMIN users are "Store Keepers" without creating new global roles — keeps this consistent with how you likely scoped HR/recruiting permissions.

---

## 4. Prisma schema additions

Add to `apps/server/prisma/schema.prisma`. Follow the existing style: `@id @default(uuid())`, `schoolId` FK + index on every tenant-scoped model, `createdAt/updatedAt`, enums in the enum block up top.

```prisma
// ── INVENTORY ENUMS ──────────────────────────────────────────────────────────
enum InventoryLocationType {
  CAMPUS
  BLOCK
  FLOOR
  ROOM
  STORE_BIN
}

enum ItemType {
  FIXED_ASSET
  CONSUMABLE
}

enum ItemCondition {
  NEW
  GOOD
  FAIR
  DAMAGED
  UNDER_REPAIR
  CONDEMNED
}

enum ItemLifecycleStatus {
  IN_STOCK
  ALLOCATED
  UNDER_MAINTENANCE
  RESERVED
  DISPOSED
  LOST
}

enum RequestStatus {
  PENDING
  APPROVED
  REJECTED
  PARTIALLY_FULFILLED
  FULFILLED
  CANCELLED
}

enum PurchaseOrderStatus {
  DRAFT
  SUBMITTED
  APPROVED
  ORDERED
  PARTIALLY_RECEIVED
  RECEIVED
  CANCELLED
}

enum CustodianType {
  STAFF
  STUDENT
  ROOM
  DEPARTMENT
  CLASS
}

enum AllocationStatus {
  ACTIVE
  RETURNED
  OVERDUE
  LOST
  DAMAGED
}

enum MovementType {
  RECEIVED
  ALLOCATED
  TRANSFERRED
  RETURNED
  ADJUSTED
  DAMAGED
  LOST
  SENT_FOR_MAINTENANCE
  RETURNED_FROM_MAINTENANCE
  DISPOSED
  WRITTEN_OFF
}

enum MaintenanceStatus {
  REPORTED
  IN_PROGRESS
  AWAITING_PARTS
  RESOLVED
  UNRESOLVABLE
}

enum DisposalReason {
  OBSOLETE
  DAMAGED_BEYOND_REPAIR
  LOST
  STOLEN
  DONATED
  SOLD
  EXPIRED
}

enum DepreciationMethod {
  STRAIGHT_LINE
  REDUCING_BALANCE
  NONE
}

// ── INVENTORY MODELS ─────────────────────────────────────────────────────────

model InventoryLocation {
  id          String                 @id @default(uuid())
  schoolId    String
  school      School                 @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  name        String
  type        InventoryLocationType
  parentId    String?
  parent      InventoryLocation?     @relation("LocationTree", fields: [parentId], references: [id])
  children    InventoryLocation[]    @relation("LocationTree")
  isStoreRoom Boolean                @default(false)
  isDisposalHold Boolean             @default(false)
  isActive    Boolean                @default(true)
  createdAt   DateTime               @default(now())
  updatedAt   DateTime               @updatedAt

  items       InventoryItem[]        @relation("CurrentLocation")
  movementsFrom InventoryMovement[]  @relation("MovementFrom")
  movementsTo   InventoryMovement[]  @relation("MovementTo")

  @@index([schoolId, parentId])
  @@map("inventory_locations")
}

model InventoryCategory {
  id                String              @id @default(uuid())
  schoolId          String
  school            School              @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  name              String
  parentId          String?
  parent            InventoryCategory?  @relation("CategoryTree", fields: [parentId], references: [id])
  children          InventoryCategory[] @relation("CategoryTree")
  defaultItemType   ItemType            @default(CONSUMABLE)
  defaultUnit       String              @default("piece")
  defaultReorderPoint Int?
  defaultReorderQty   Int?
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt

  items             InventoryItem[]

  @@index([schoolId, parentId])
  @@map("inventory_categories")
}

model Supplier {
  id           String            @id @default(uuid())
  schoolId     String
  school       School            @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  name         String
  contactName  String?
  phone        String?
  email        String?
  address      String?
  taxId        String?
  paymentTerms String?
  rating       Int?              // 1-5, updated from delivery/quality history
  isActive     Boolean           @default(true)
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt

  items            InventoryItem[]
  purchaseOrders   PurchaseOrder[]

  @@index([schoolId])
  @@map("inventory_suppliers")
}

model InventoryItem {
  id                String               @id @default(uuid())
  schoolId          String
  school            School               @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  categoryId        String
  category          InventoryCategory    @relation(fields: [categoryId], references: [id])
  name              String
  sku               String?              // internal stock keeping unit
  barcodeNumber     String?              @unique
  qrCodeUrl         String?
  itemType          ItemType
  description       String?
  unit              String               @default("piece")
  imageUrl          String?

  // Fixed-asset-only fields (null for CONSUMABLE)
  serialNumber      String?              @unique
  assetTagNumber    String?              @unique
  purchaseDate      DateTime?
  purchaseCost      Float?
  warrantyExpiresAt DateTime?
  depreciationMethod DepreciationMethod  @default(NONE)
  usefulLifeMonths  Int?
  salvageValue      Float?               @default(0)
  currentBookValue  Float?

  // Consumable-only fields
  quantityOnHand    Int?                 @default(0)
  reorderPoint      Int?
  reorderQty        Int?
  unitCost          Float?

  condition         ItemCondition        @default(NEW)
  status            ItemLifecycleStatus  @default(IN_STOCK)
  currentLocationId String?
  currentLocation   InventoryLocation?   @relation("CurrentLocation", fields: [currentLocationId], references: [id])
  preferredSupplierId String?
  preferredSupplier  Supplier?           @relation(fields: [preferredSupplierId], references: [id])

  notes             String?
  isActive          Boolean              @default(true)
  createdAt         DateTime             @default(now())
  updatedAt         DateTime             @updatedAt

  allocations       InventoryAllocation[]
  movements         InventoryMovement[]
  maintenanceRecords MaintenanceRecord[]
  poLines           PurchaseOrderLine[]
  requestLines      InventoryRequestLine[]
  disposalRecords   DisposalRecord[]
  stockCountLines   StockCountLine[]

  @@index([schoolId, categoryId])
  @@index([schoolId, status])
  @@map("inventory_items")
}

model InventoryRequest {
  id             String                 @id @default(uuid())
  schoolId       String
  school         School                 @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  requestedById  String
  requestedBy    User                   @relation("RequestedBy", fields: [requestedById], references: [id])
  departmentOrRoom String?              // free-text or link to a Class/GradeLevel if you want strict FK later
  reason         String
  neededBy       DateTime?
  status         RequestStatus          @default(PENDING)
  approvedById   String?
  approvedBy     User?                  @relation("ApprovedRequests", fields: [approvedById], references: [id])
  approvedAt     DateTime?
  rejectionReason String?
  createdAt      DateTime               @default(now())
  updatedAt      DateTime               @updatedAt

  lines          InventoryRequestLine[]
  purchaseOrders PurchaseOrder[]
  allocations    InventoryAllocation[]

  @@index([schoolId, status])
  @@map("inventory_requests")
}

model InventoryRequestLine {
  id           String            @id @default(uuid())
  requestId    String
  request      InventoryRequest  @relation(fields: [requestId], references: [id], onDelete: Cascade)
  itemId       String?           // null if requesting something not yet in the catalog
  item         InventoryItem?    @relation(fields: [itemId], references: [id])
  freeTextName String?           // used when itemId is null
  quantityRequested Int
  quantityFulfilled Int          @default(0)

  @@map("inventory_request_lines")
}

model PurchaseOrder {
  id           String               @id @default(uuid())
  schoolId     String
  school       School               @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  poNumber     String               @unique
  supplierId   String
  supplier     Supplier             @relation(fields: [supplierId], references: [id])
  requestId    String?
  request      InventoryRequest?    @relation(fields: [requestId], references: [id])
  status       PurchaseOrderStatus  @default(DRAFT)
  orderedById  String
  orderedBy    User                 @relation("OrderedPOs", fields: [orderedById], references: [id])
  approvedById String?
  approvedBy   User?                @relation("ApprovedPOs", fields: [approvedById], references: [id])
  expectedDeliveryDate DateTime?
  totalAmount  Float                @default(0)
  currency     String               @default("ETB")
  notes        String?
  createdAt    DateTime             @default(now())
  updatedAt    DateTime             @updatedAt

  lines        PurchaseOrderLine[]
  receipts     GoodsReceipt[]

  @@index([schoolId, status])
  @@map("inventory_purchase_orders")
}

model PurchaseOrderLine {
  id            String        @id @default(uuid())
  poId          String
  po            PurchaseOrder @relation(fields: [poId], references: [id], onDelete: Cascade)
  itemId        String?
  item          InventoryItem? @relation(fields: [itemId], references: [id])
  description   String        // needed when ordering something new to the catalog
  quantityOrdered  Int
  quantityReceived Int        @default(0)
  unitCost      Float

  @@map("inventory_po_lines")
}

model GoodsReceipt {
  id            String        @id @default(uuid())
  schoolId      String
  school        School        @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  poId          String
  po            PurchaseOrder @relation(fields: [poId], references: [id])
  receivedById  String
  receivedBy    User          @relation(fields: [receivedById], references: [id])
  receivedAt    DateTime      @default(now())
  locationId    String        // store room the goods land in
  location      InventoryLocation @relation(fields: [locationId], references: [id])
  notes         String?
  discrepancyNotes String?

  lines         GoodsReceiptLine[]

  @@index([schoolId])
  @@map("inventory_goods_receipts")
}

model GoodsReceiptLine {
  id            String        @id @default(uuid())
  receiptId     String
  receipt       GoodsReceipt  @relation(fields: [receiptId], references: [id], onDelete: Cascade)
  poLineId      String
  poLine        PurchaseOrderLine @relation(fields: [poLineId], references: [id])
  quantityReceived Int
  conditionOnArrival ItemCondition @default(NEW)
  serialNumbers String[]      // for fixed assets, one entry per unit received

  @@map("inventory_goods_receipt_lines")
}

model InventoryAllocation {
  id             String            @id @default(uuid())
  schoolId       String
  school         School            @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  itemId         String
  item           InventoryItem     @relation(fields: [itemId], references: [id])
  quantity       Int               @default(1)   // >1 only for consumables issued in bulk
  requestId      String?
  request        InventoryRequest? @relation(fields: [requestId], references: [id])

  custodianType  CustodianType
  custodianUserId String?          // STAFF or STUDENT
  custodianUser   User?            @relation("CustodianOf", fields: [custodianUserId], references: [id])
  custodianRoomId String?          // ROOM
  custodianRoom   InventoryLocation? @relation(fields: [custodianRoomId], references: [id])
  custodianLabel  String?          // DEPARTMENT / CLASS free text when no clean FK fits

  issuedById     String
  issuedBy       User              @relation("IssuedAllocations", fields: [issuedById], references: [id])
  issuedAt       DateTime          @default(now())
  dueBackAt      DateTime?
  returnedAt     DateTime?
  conditionAtIssue  ItemCondition
  conditionAtReturn ItemCondition?
  status         AllocationStatus  @default(ACTIVE)
  notes          String?

  @@index([schoolId, status])
  @@index([itemId])
  @@map("inventory_allocations")
}

model InventoryMovement {
  id             String            @id @default(uuid())
  schoolId       String
  school         School            @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  itemId         String
  item           InventoryItem     @relation(fields: [itemId], references: [id])
  type           MovementType
  quantity       Int               @default(1)
  fromLocationId String?
  fromLocation   InventoryLocation? @relation("MovementFrom", fields: [fromLocationId], references: [id])
  toLocationId   String?
  toLocation     InventoryLocation? @relation("MovementTo", fields: [toLocationId], references: [id])
  performedById  String
  performedBy    User              @relation(fields: [performedById], references: [id])
  relatedAllocationId String?
  relatedMaintenanceId String?
  note           String?
  createdAt      DateTime          @default(now())

  @@index([schoolId, itemId])
  @@index([schoolId, type])
  @@map("inventory_movements")
}

model MaintenanceRecord {
  id             String            @id @default(uuid())
  schoolId       String
  school         School            @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  itemId         String
  item           InventoryItem     @relation(fields: [itemId], references: [id])
  reportedById   String
  reportedBy     User              @relation("ReportedMaintenance", fields: [reportedById], references: [id])
  faultDescription String
  status         MaintenanceStatus @default(REPORTED)
  assignedToStaffId String?
  assignedToStaff  User?           @relation("AssignedMaintenance", fields: [assignedToStaffId], references: [id])
  externalVendor String?
  cost           Float?
  reportedAt     DateTime          @default(now())
  resolvedAt     DateTime?
  resolutionNotes String?

  @@index([schoolId, status])
  @@map("inventory_maintenance_records")
}

model DisposalRecord {
  id             String          @id @default(uuid())
  schoolId       String
  school         School          @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  itemId         String
  item           InventoryItem   @relation(fields: [itemId], references: [id])
  reason         DisposalReason
  method         String?         // "auction", "e-waste recycler", "donated to X", etc.
  approvedById   String
  approvedBy     User            @relation(fields: [approvedById], references: [id])
  bookValueAtDisposal Float?
  saleValue      Float?
  disposedAt     DateTime        @default(now())
  notes          String?

  @@index([schoolId])
  @@map("inventory_disposal_records")
}

model StockCount {
  id           String            @id @default(uuid())
  schoolId     String
  school       School            @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  title        String            // "Q3 2026 Full Stock Take", "Chemistry Lab Cycle Count"
  locationId   String?           // null = whole-school count
  location     InventoryLocation? @relation(fields: [locationId], references: [id])
  startedById  String
  startedBy    User              @relation(fields: [startedById], references: [id])
  status       String            @default("IN_PROGRESS") // IN_PROGRESS | COMPLETED | CANCELLED
  startedAt    DateTime          @default(now())
  completedAt  DateTime?

  lines        StockCountLine[]

  @@index([schoolId])
  @@map("inventory_stock_counts")
}

model StockCountLine {
  id            String      @id @default(uuid())
  stockCountId  String
  stockCount    StockCount  @relation(fields: [stockCountId], references: [id], onDelete: Cascade)
  itemId        String
  item          InventoryItem @relation(fields: [itemId], references: [id])
  expectedQty   Int
  countedQty    Int?
  variance      Int?
  notes         String?

  @@map("inventory_stock_count_lines")
}
```

**Add to `School` model's relations block:**
```prisma
inventoryLocations   InventoryLocation[]
inventoryCategories  InventoryCategory[]
inventorySuppliers   Supplier[]
inventoryItems       InventoryItem[]
inventoryRequests    InventoryRequest[]
purchaseOrders       PurchaseOrder[]
goodsReceipts        GoodsReceipt[]
inventoryAllocations InventoryAllocation[]
inventoryMovements   InventoryMovement[]
maintenanceRecords   MaintenanceRecord[]
disposalRecords      DisposalRecord[]
stockCounts          StockCount[]
```

**Add to `User` model's relations block** (multiple named relations, mirroring how `LibraryIssue` / `JobApplication` already fan out from `User`):
```prisma
inventoryRequestsMade   InventoryRequest[]     @relation("RequestedBy")
inventoryRequestsApproved InventoryRequest[]   @relation("ApprovedRequests")
custodianAllocations    InventoryAllocation[]  @relation("CustodianOf")
allocationsIssued       InventoryAllocation[]  @relation("IssuedAllocations")
purchaseOrdersMade      PurchaseOrder[]        @relation("OrderedPOs")
purchaseOrdersApproved  PurchaseOrder[]        @relation("ApprovedPOs")
goodsReceiptsRecorded   GoodsReceipt[]
inventoryMovementsPerformed InventoryMovement[]
maintenanceReported     MaintenanceRecord[]    @relation("ReportedMaintenance")
maintenanceAssigned     MaintenanceRecord[]    @relation("AssignedMaintenance")
disposalsApproved       DisposalRecord[]
stockCountsStarted      StockCount[]
```

Run `npx prisma migrate dev --name add_inventory_asset_management` after adding this.

---

## 5. API surface (`apps/server/src/modules/inventory/`)

Mirror the flat-router style used in `library.routes.ts` / `clubs.routes.ts`. Split into focused route files mounted under `/api/inventory/*`, registered in `app.ts` the same way other modules are:

```
inventory.locations.routes.ts     GET/POST/PUT/DELETE /api/inventory/locations           (tree CRUD)
inventory.categories.routes.ts    GET/POST/PUT/DELETE /api/inventory/categories
inventory.suppliers.routes.ts     GET/POST/PUT/DELETE /api/inventory/suppliers
inventory.items.routes.ts         GET/POST/PUT        /api/inventory/items
                                   GET                 /api/inventory/items/:id/history   (full movement + allocation timeline)
                                   GET                 /api/inventory/items/low-stock
                                   GET                 /api/inventory/items/:id/qrcode
inventory.requests.routes.ts      GET/POST             /api/inventory/requests
                                   PATCH                /api/inventory/requests/:id/approve
                                   PATCH                /api/inventory/requests/:id/reject
inventory.purchase-orders.routes.ts  GET/POST/PUT        /api/inventory/purchase-orders
                                   PATCH                /api/inventory/purchase-orders/:id/approve
inventory.goods-receipts.routes.ts   POST                /api/inventory/goods-receipts    (stock-in; increments quantity / creates serialized units)
inventory.allocations.routes.ts   POST                /api/inventory/allocations         (issue/allocate — the "checkout")
                                   PATCH               /api/inventory/allocations/:id/return
                                   PATCH               /api/inventory/allocations/:id/transfer  (move to a different room/custodian without a full return cycle)
                                   GET                 /api/inventory/allocations/mine    (custodian self-service view)
                                   GET                 /api/inventory/allocations/overdue
inventory.maintenance.routes.ts   GET/POST/PATCH       /api/inventory/maintenance
inventory.disposal.routes.ts      GET/POST             /api/inventory/disposal
inventory.stock-counts.routes.ts  GET/POST/PATCH       /api/inventory/stock-counts         (+ submit counted lines, auto-generate ADJUSTED movements for variances)
inventory.reports.routes.ts       GET                  /api/inventory/reports/valuation
                                   GET                  /api/inventory/reports/depreciation
                                   GET                  /api/inventory/reports/utilization
                                   GET                  /api/inventory/reports/maintenance-due
                                   GET                  /api/inventory/reports/disposal-register
```

### Key business rules to enforce server-side (not just UI hints)
- **Every quantity/location/custodian change goes through a service function that writes an `InventoryMovement` row in the same transaction.** Never let a route handler do a bare `db.inventoryItem.update({ quantityOnHand: ... })` — wrap it in `recordMovement()`.
- **Allocation of a `FIXED_ASSET`** requires `status = IN_STOCK`; sets `status = ALLOCATED`; blocks double-allocation (unique-in-effect: an item can have at most one `ACTIVE` allocation at a time — enforce with a query check, Postgres partial unique index optional).
- **Allocation of a `CONSUMABLE`** decrements `quantityOnHand`; blocks if `quantity > quantityOnHand`; if resulting `quantityOnHand <= reorderPoint`, flag for the low-stock report/notification (hook into your existing notifications module, feature-adjacent to #9's webhook idea later).
- **Goods receipt** increments `quantityOnHand` for consumables, or creates one `InventoryItem`-linked serialized record per unit (via `serialNumbers[]`) for fixed assets, and always writes a `RECEIVED` movement into the receiving location.
- **Return** requires `conditionAtReturn`; if it's `DAMAGED`, auto-create a `MaintenanceRecord` and set item `status = UNDER_MAINTENANCE` instead of `IN_STOCK`.
- **Disposal** requires `status` to already be `CONDEMNED`/`LOST` or an explicit override by `ADMIN`/`SUPER_ADMIN`; writes final `DISPOSED`/`WRITTEN_OFF` movement and freezes further allocation (`isActive = false`).
- **Purchase order approval threshold**: store a per-school configurable amount (extend `SchoolSettings`) above which `FINANCE` or `SUPER_ADMIN` approval is mandatory, not just `ADMIN`.
- **Barcode/QR**: generate a code (e.g. `nanoid` or sequential `assetTagNumber`) at item-creation time; render it as a QR image on demand (`GET /items/:id/qrcode`) using a lightweight lib like `qrcode` — same "generate on request, don't store the image" pattern you likely used for ID cards (#feature nearby `id-cards` module already in the repo).

---

## 6. Integration with features you've already built

- **#2 Audit log**: hook `recordMovement()` and every approval/rejection/disposal action into your existing audit middleware/service, tagged with entity type `INVENTORY_ITEM`/`ALLOCATION`/`PURCHASE_ORDER`. Inventory is one of the highest-value places for an audit trail because of theft/loss risk — treat this as non-optional, not a nice-to-have.
- **#1 MFA**: require step-up/recent MFA verification for high-risk actions — approving a `PurchaseOrder` above the threshold, and confirming a `DisposalRecord` — the same way you'd gate a password change.
- **#6 Swagger/OpenAPI**: add `swagger-jsdoc` annotations to every route file as you go (don't batch it at the end — it's much easier per-route while the shape is fresh), grouped under an `Inventory` tag.
- **#7 GDPR/FERPA**: if a `custodianType = STUDENT` allocation exists, it's personal data tied to a minor — include `InventoryAllocation` records where `custodianUserId` matches the student in your existing data-export/consent logic.
- **#5 Tests**: add `__tests__/` folders per sub-module (`inventory-items`, `inventory-allocations`, `inventory-purchase-orders` at minimum) covering: low-stock threshold triggers, double-allocation prevention, damaged-return auto-maintenance creation, and PO approval-threshold routing — these are the rules most likely to silently break.
- **Notifications module**: wire low-stock alerts, overdue-return reminders (`dueBackAt` passed), and maintenance-resolved notices into the existing `notifications` module rather than building a parallel one.

---

## 7. Reporting & dashboards (what makes it "a system" and not a database)

Build these as read endpoints first (§5 `inventory.reports.routes.ts`), UI later:

1. **Stock levels & reorder alerts** — everything at/under `reorderPoint`, grouped by category/location.
2. **Asset register** — full fixed-asset list with location, custodian, condition, book value; filterable/exportable (CSV via existing file-export patterns).
3. **Depreciation schedule** — current book value per asset and projected value at next fiscal year-end (straight-line: `cost - (cost - salvage) * monthsElapsed / usefulLifeMonths`).
4. **Utilization** — items allocated vs. sitting idle in store beyond N days (surfaces over-purchasing).
5. **Maintenance due / open faults** — anything `REPORTED`/`IN_PROGRESS`, aged by days open.
6. **Disposal register** — full audit-ready list for compliance/finance sign-off.
7. **Overdue returns** — allocations past `dueBackAt`, groupable by custodian, feeding the reminder notifications.

---

## 8. Web app pages (`apps/web`)

Match the module pattern the frontend already uses for library/HR. Suggested page set:

- **Inventory Dashboard** — low stock, overdue returns, maintenance due, recent activity feed (pulls from `InventoryMovement`).
- **Catalog** — browse/search items, filter by category/type/location/condition; item detail page shows full timeline (receipts → allocations → maintenance → disposal) sourced from `/items/:id/history`.
- **Locations** — tree view (campus/block/floor/room) with item counts per node; click a room to see everything currently located there.
- **Requests** — "My Requests" (staff) and "Pending Approval" queue (approvers), Kanban-ish by status.
- **Purchase Orders** — list + create wizard (supplier → lines → submit → approve).
- **Goods Receipt** — scan/enter a PO, record what arrived, flag discrepancies.
- **Allocate / Issue** — search item or scan barcode → pick custodian (person/room/department) → set due date → confirm condition.
- **My Assets** — self-service page for any staff/student: what's currently assigned to me, due dates, report-a-fault button.
- **Maintenance Board** — open tickets by status, assign, resolve.
- **Stock Count** — start a count (whole school or one location), enter counted quantities/scan assets, review variances, submit (auto-generates `ADJUSTED` movements).
- **Disposal** — condemned/lost items queue, disposal form, disposal register report.
- **Reports** — the seven reports from §7, each exportable.

---

## 9. Phased build order (don't build it all at once)

| Phase | Scope | Why this order |
|---|---|---|
| **Phase 1 — Foundation** | `InventoryLocation`, `InventoryCategory`, `Supplier`, `InventoryItem` CRUD + catalog UI, barcode/QR generation | Nothing else works without a real catalog and a real location tree. |
| **Phase 2 — Movement core** | `InventoryMovement` ledger, `GoodsReceipt` (manual stock-in first, PO optional), `InventoryAllocation` issue/return/transfer, "My Assets" self-service page | This is the everyday workflow — get it right before layering procurement on top. |
| **Phase 3 — Procurement** | `InventoryRequest` → approval → `PurchaseOrder` → `GoodsReceipt` linkage, supplier management, approval-threshold rules | Now that stock-in works manually, formalize where stock *comes from*. |
| **Phase 4 — Lifecycle & compliance** | `MaintenanceRecord`, `DisposalRecord`, depreciation calculation, `StockCount` reconciliation | These are periodic/exception flows — build once the daily-use core is stable. |
| **Phase 5 — Reporting, notifications, integrations** | All seven reports, low-stock/overdue notifications, audit-log hook-in, Swagger docs, tests backfilled per phase (don't actually wait — write tests alongside each phase above) | Reporting is only trustworthy once the ledger underneath it is solid. |

---

## 10. Acceptance checklist (use this to know Phase N is actually done)

- [ ] Every stock/location/custodian change is traceable to exactly one `InventoryMovement` row — no silent updates.
- [ ] A fixed asset can never have two simultaneous `ACTIVE` allocations.
- [ ] Issuing a consumable below `reorderPoint` surfaces on the low-stock report/notification within the same request cycle.
- [ ] Returning an item as `DAMAGED` automatically opens a `MaintenanceRecord` and blocks re-allocation until resolved.
- [ ] A disposed/written-off item cannot be allocated, transferred, or receipted again.
- [ ] Every write is scoped by `req.user.schoolId` and denied cross-tenant (write a test that asserts this explicitly — copy the pattern from an existing module's `__tests__`).
- [ ] Every mutating route has an `authorize(...)` role check matching §3.
- [ ] A student-linked allocation appears in the GDPR/FERPA export for that student.
- [ ] Swagger docs exist for every route before you consider the phase merged.
