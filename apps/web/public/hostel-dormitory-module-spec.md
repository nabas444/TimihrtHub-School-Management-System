# TimihrtHub — Hostel / Dormitory Management Module
### Full system design + build prompt (Feature #7)

> Repo reviewed: `nabas444/TimihrtHub-School-Management-System`
> Stack confirmed: Express + TypeScript + Prisma/Postgres, multi-tenant via `schoolId`, `Role` enum (`STUDENT/TEACHER/PARENT/FINANCE/ADMIN/SUPER_ADMIN`), `Gender` enum, module pattern = `modules/<name>/<name>.routes.ts` (+ optional `.service.ts` / `.controller.ts`), `authorize(...roles)` middleware, `AppError`, `sendSuccess/sendCreated/paginationMeta` helpers, BullMQ workers in `src/jobs`, `Notification` model + socket emit, Vitest `__tests__` folders per module.

---

## 0. Why this can't be "one page with a dropdown"

A dormitory is a physical, staffed, 24/7 micro-institution living inside the school. If you model it as `Student.roomNumber = string`, you will not be able to answer any of these — and every one of them *will* come up in year one:

- "We have a burst pipe in Block C — which students need to be moved tonight, and where?"
- "A boy and girl were accidentally allocated the same room number in two different blocks — how did that happen?"
- "Student X's guardian says he never came home for the weekend — when did he last check out, and did he return?"
- "We're full. Who's on the waitlist, and who gets the next vacancy?"
- "Show me every allocation history for this student across 3 years, for the exit report."
- "Warden of Block B is sick — who has authority to approve outpasses today?"

None of that is answerable from a form. It requires **inventory (rooms/beds), an allocation engine with rules, a staffing/ownership model, an attendance & movement ledger, and an audit trail** — tied into the modules you already have (Billing, Notifications, Audit Log, Users/Employees).

---

## 1. System actors

| Actor | System `Role` | Scope |
|---|---|---|
| **Warden** (hostel head) | `ADMIN`, scoped via `HostelStaffAssignment` | Full control of one or more hostels |
| **Assistant Warden / Matron** | `ADMIN`, scoped | Delegated approvals (leave, visitors) within their hostel/block |
| **Caretaker** | `ADMIN` (limited) or `TEACHER`-adjacent, scoped | Room condition, maintenance intake, day-to-day roll call |
| **Security / Gatekeeper** | `ADMIN` (limited), scoped | Visitor log, outpass check-in/out at the gate |
| **Nurse / Medical** | `ADMIN` (limited) | Read medical flags, log infirmary stays that pause hostel attendance |
| **Super Admin / Principal** | `SUPER_ADMIN` | Cross-hostel oversight, reports, fee policy |
| **Student** | `STUDENT` | Apply, view own allocation, request transfer, request outpass |
| **Parent** | `PARENT` | View child's allocation, approve/co-sign outpass, view visitor log entries |
| **Finance** | `FINANCE` | Hostel fee invoices, arrears, refunds on vacate |

You don't have hostel-specific roles in the `Role` enum, and you shouldn't add them — that enum drives *system-wide* authorization (login, module access). Hostel staff are already `Employee` records (from your HR module). What they need is **hostel-scoped authority**, which is a *second, thinner layer* on top of `Role`, exactly like how a `TeacherProfile.classTeacherOf` scopes a teacher to one class without needing a new `Role`. That's the `HostelStaffAssignment` model below — it's the same pattern you already use, just applied to hostels.

---

## 2. Data model (Prisma additions)

Add a new section to `apps/server/prisma/schema.prisma`. Naming, `@@map`, `schoolId` tenancy, and cascade style all match your existing models (compare `BusRoute`, `LibraryBook`, `Employee`).

```prisma
// ─────────────────────────────────────────────────────────────────────────────
// HOSTEL / DORMITORY MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

enum HostelType {
  BOYS
  GIRLS
  MIXED   // co-ed campus, gender-segregated at block level
  STAFF
}

enum RoomType {
  SINGLE
  DOUBLE
  TRIPLE
  QUAD
  DORMITORY
}

enum RoomStatus {
  AVAILABLE
  FULL
  MAINTENANCE
  RESERVED
  CLOSED
}

enum BedStatus {
  VACANT
  OCCUPIED
  RESERVED     // held for an approved-but-not-yet-checked-in application
  OUT_OF_SERVICE
}

enum HostelStaffRole {
  WARDEN
  ASSISTANT_WARDEN
  MATRON
  CARETAKER
  SECURITY_GUARD
  NURSE
  COOK
  MAINTENANCE_STAFF
}

enum HostelApplicationStatus {
  PENDING
  UNDER_REVIEW
  APPROVED
  WAITLISTED
  REJECTED
  WITHDRAWN
}

enum AllocationStatus {
  ACTIVE
  CHECKED_OUT
  TRANSFERRED
  TERMINATED    // disciplinary / non-payment
  EXPIRED       // term/year ended, not renewed
}

enum TransferRequestStatus {
  PENDING
  APPROVED
  REJECTED
  COMPLETED
  CANCELLED
}

enum OutpassType {
  DAY_OUT
  OVERNIGHT
  HOME_VISIT
  MEDICAL
  EMERGENCY
}

enum OutpassStatus {
  PENDING
  APPROVED
  REJECTED
  OUT          // student has physically left (gate check-out scanned)
  RETURNED
  OVERDUE
  CANCELLED
}

enum NightAttendanceStatus {
  PRESENT
  ABSENT
  ON_LEAVE
  ON_OUTPASS
  MEDICAL_LEAVE
}

enum MaintenanceCategory {
  ELECTRICAL
  PLUMBING
  FURNITURE
  CLEANING
  PEST_CONTROL
  STRUCTURAL
  IT_NETWORK
  OTHER
}

enum MaintenancePriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum MaintenanceStatus {
  OPEN
  ASSIGNED
  IN_PROGRESS
  RESOLVED
  CLOSED
  CANCELLED
}

enum IncidentSeverity {
  MINOR
  MODERATE
  SEVERE
  CRITICAL
}

// ── Physical structure ───────────────────────────────────────────────────────

model Hostel {
  id            String     @id @default(uuid())
  schoolId      String
  name          String
  type          HostelType
  wardenId      String?               // Employee.id of the head warden
  address       String?
  totalCapacity Int        @default(0)   // denormalized, recalculated on room changes
  isActive      Boolean    @default(true)
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt

  school        School               @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  warden        Employee?            @relation("HostelWarden", fields: [wardenId], references: [id])
  blocks        HostelBlock[]
  staff         HostelStaffAssignment[]
  applications  HostelApplication[]
  allocations   HostelAllocation[]

  @@index([schoolId])
  @@map("hostels")
}

model HostelBlock {
  id          String   @id @default(uuid())
  hostelId    String
  name        String            // "Block A", "North Wing"
  floorCount  Int      @default(1)
  gradeMin    String?           // optional: restrict block to GradeLevel range (junior/senior wings)
  gradeMax    String?
  isActive    Boolean  @default(true)

  hostel      Hostel        @relation(fields: [hostelId], references: [id], onDelete: Cascade)
  rooms       HostelRoom[]
  staff       HostelStaffAssignment[]

  @@index([hostelId])
  @@map("hostel_blocks")
}

model HostelRoom {
  id          String     @id @default(uuid())
  blockId     String
  roomNumber  String
  floor       Int        @default(1)
  roomType    RoomType
  capacity    Int                 // total beds in the room
  status      RoomStatus @default(AVAILABLE)
  amenities   Json?               // ["attached_bathroom","balcony","heater"]
  isAccessible Boolean   @default(false)   // ground floor / wheelchair accessible flag

  block       HostelBlock  @relation(fields: [blockId], references: [id], onDelete: Cascade)
  beds        HostelBed[]
  maintenanceTickets HostelMaintenanceTicket[]

  @@unique([blockId, roomNumber])
  @@index([blockId])
  @@map("hostel_rooms")
}

model HostelBed {
  id         String    @id @default(uuid())
  roomId     String
  bedNumber  String            // "A", "B" or "1","2"
  status     BedStatus @default(VACANT)

  room         HostelRoom          @relation(fields: [roomId], references: [id], onDelete: Cascade)
  allocations  HostelAllocation[]  // full history; only one ACTIVE at a time (enforced in service layer)

  @@unique([roomId, bedNumber])
  @@index([roomId])
  @@map("hostel_beds")
}

// ── Staffing (thin scoping layer over Employee, mirrors TeacherProfile pattern) ─

model HostelStaffAssignment {
  id         String          @id @default(uuid())
  hostelId   String
  blockId    String?                 // null = whole-hostel authority (e.g. Warden)
  employeeId String
  staffRole  HostelStaffRole
  shift      String?                 // "Day", "Night", "24h"
  isActive   Boolean         @default(true)
  assignedAt DateTime        @default(now())

  hostel     Hostel       @relation(fields: [hostelId], references: [id], onDelete: Cascade)
  block      HostelBlock? @relation(fields: [blockId], references: [id])
  employee   Employee     @relation("HostelStaffAssignments", fields: [employeeId], references: [id])

  @@index([hostelId])
  @@index([employeeId])
  @@map("hostel_staff_assignments")
}

// ── Intake / CRM-style application ───────────────────────────────────────────

model HostelApplication {
  id                 String                   @id @default(uuid())
  schoolId           String
  hostelId           String?                  // may be null until reviewed/matched
  studentProfileId   String
  academicTermId     String?
  preferredRoomType  RoomType?
  medicalNotes       String?
  specialRequests    String?                  // dietary, mobility, allergy
  roommatePreference String?                  // free text or studentProfileId of requested roommate
  guardianConsent    Boolean                  @default(false)
  priorityScore      Int                      @default(0)   // computed: medical > sibling-in-hostel > distance > FIFO
  status             HostelApplicationStatus  @default(PENDING)
  reviewedById       String?
  reviewNotes        String?
  submittedAt        DateTime                 @default(now())
  reviewedAt         DateTime?

  school         School          @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  hostel         Hostel?         @relation(fields: [hostelId], references: [id])
  studentProfile StudentProfile  @relation(fields: [studentProfileId], references: [id], onDelete: Cascade)
  reviewedBy     User?           @relation("HostelApplicationReviewer", fields: [reviewedById], references: [id])
  allocation     HostelAllocation?

  @@index([schoolId, status])
  @@index([studentProfileId])
  @@map("hostel_applications")
}

// ── The actual assignment ledger (one row per stay, full history retained) ──

model HostelAllocation {
  id               String            @id @default(uuid())
  applicationId    String?           @unique
  hostelId         String
  bedId            String
  studentProfileId String
  academicTermId   String?
  status           AllocationStatus  @default(ACTIVE)
  allocatedById    String                    // staff/system user who ran the allocation
  allocatedAt      DateTime          @default(now())
  checkedInAt      DateTime?
  checkedOutAt     DateTime?
  vacateReason     String?
  feeInvoiceId     String?                   // links to FeeInvoice generated on allocation

  application    HostelApplication? @relation(fields: [applicationId], references: [id])
  hostel         Hostel             @relation(fields: [hostelId], references: [id])
  bed            HostelBed          @relation(fields: [bedId], references: [id])
  studentProfile StudentProfile     @relation(fields: [studentProfileId], references: [id], onDelete: Cascade)
  allocatedBy    User               @relation("HostelAllocator", fields: [allocatedById], references: [id])
  feeInvoice     FeeInvoice?        @relation(fields: [feeInvoiceId], references: [id])
  nightAttendance HostelNightAttendance[]
  outpasses       HostelOutpass[]

  // Only one ACTIVE allocation per student and per bed — enforce in service layer
  // with a transaction + partial unique index (Postgres) as belt-and-braces:
  // CREATE UNIQUE INDEX one_active_alloc_per_student ON hostel_allocations (student_profile_id) WHERE status = 'ACTIVE';
  // CREATE UNIQUE INDEX one_active_alloc_per_bed ON hostel_allocations (bed_id) WHERE status = 'ACTIVE';

  @@index([hostelId, status])
  @@index([studentProfileId])
  @@index([bedId])
  @@map("hostel_allocations")
}

model HostelTransferRequest {
  id                String                 @id @default(uuid())
  studentProfileId  String
  fromAllocationId  String
  toBedId           String?                // null = "any suitable bed, let the engine decide"
  reason            String
  status            TransferRequestStatus  @default(PENDING)
  requestedAt       DateTime               @default(now())
  decidedById       String?
  decidedAt         DateTime?
  decisionNotes     String?

  studentProfile StudentProfile @relation(fields: [studentProfileId], references: [id], onDelete: Cascade)
  fromAllocation HostelAllocation @relation(fields: [fromAllocationId], references: [id])
  decidedBy      User?            @relation("TransferDecider", fields: [decidedById], references: [id])

  @@index([studentProfileId])
  @@map("hostel_transfer_requests")
}

// ── Nightly roll call ─────────────────────────────────────────────────────────

model HostelNightAttendance {
  id             String                 @id @default(uuid())
  allocationId   String
  date           DateTime               @db.Date
  status         NightAttendanceStatus
  markedById     String
  remarks        String?
  markedAt       DateTime               @default(now())

  allocation HostelAllocation @relation(fields: [allocationId], references: [id], onDelete: Cascade)
  markedBy   User             @relation("NightAttendanceMarker", fields: [markedById], references: [id])

  @@unique([allocationId, date])
  @@index([date])
  @@map("hostel_night_attendance")
}

// ── Movement: outpass / leave ────────────────────────────────────────────────

model HostelOutpass {
  id                    String        @id @default(uuid())
  allocationId          String
  type                  OutpassType
  fromDateTime          DateTime
  expectedReturnAt      DateTime
  actualReturnAt        DateTime?
  destination            String
  contactAtDestination  String?
  reason                String
  status                OutpassStatus @default(PENDING)
  approvedById          String?
  parentConsentAt       DateTime?               // stamp when parent co-signs via portal
  gateOutAt             DateTime?               // security scan-out
  gateInAt              DateTime?               // security scan-in
  createdAt             DateTime      @default(now())

  allocation HostelAllocation @relation(fields: [allocationId], references: [id], onDelete: Cascade)
  approvedBy User?            @relation("OutpassApprover", fields: [approvedById], references: [id])

  @@index([allocationId, status])
  @@map("hostel_outpasses")
}

// ── Visitors ──────────────────────────────────────────────────────────────────

model HostelVisitorLog {
  id                String    @id @default(uuid())
  studentProfileId  String
  visitorName       String
  relationToStudent String
  idProofType       String?
  idProofNumber     String?
  purpose           String?
  checkInAt         DateTime  @default(now())
  checkOutAt        DateTime?
  loggedById        String            // security/gate staff

  studentProfile StudentProfile @relation(fields: [studentProfileId], references: [id], onDelete: Cascade)
  loggedBy       User           @relation("VisitorLogger", fields: [loggedById], references: [id])

  @@index([studentProfileId])
  @@map("hostel_visitor_logs")
}

// ── Maintenance ───────────────────────────────────────────────────────────────

model HostelMaintenanceTicket {
  id            String               @id @default(uuid())
  roomId        String
  category      MaintenanceCategory
  priority      MaintenancePriority  @default(MEDIUM)
  status        MaintenanceStatus    @default(OPEN)
  description   String
  reportedById  String
  assignedToId  String?              // Employee.id (caretaker/vendor)
  cost          Decimal?             @db.Decimal(10, 2)
  reportedAt    DateTime             @default(now())
  resolvedAt    DateTime?

  room         HostelRoom @relation(fields: [roomId], references: [id], onDelete: Cascade)
  reportedBy   User       @relation("TicketReporter", fields: [reportedById], references: [id])
  assignedTo   Employee?  @relation("TicketAssignee", fields: [assignedToId], references: [id])

  @@index([roomId, status])
  @@map("hostel_maintenance_tickets")
}

// ── Incidents (kept separate from BehaviourRecord: residential-specific,
//    visible to warden/parent, optionally cross-links to BehaviourRecord) ────

model HostelIncidentReport {
  id                String            @id @default(uuid())
  allocationId      String
  severity          IncidentSeverity
  description       String
  actionTaken       String?
  reportedById      String
  linkedBehaviourId String?           // optional FK to your existing BehaviourRecord
  occurredAt        DateTime          @default(now())

  allocation HostelAllocation @relation(fields: [allocationId], references: [id], onDelete: Cascade)
  reportedBy User             @relation("IncidentReporter", fields: [reportedById], references: [id])

  @@index([allocationId])
  @@map("hostel_incident_reports")
}
```

**Relations to wire back into existing models** (additive, non-breaking):
- `School.hostels HostelBlock[]... Hostel[]`
- `Employee.hostelWardenOf Hostel[] @relation("HostelWarden")`, `Employee.hostelStaffAssignments HostelStaffAssignment[] @relation("HostelStaffAssignments")`
- `StudentProfile.hostelApplications HostelApplication[]`, `StudentProfile.hostelAllocations HostelAllocation[]`, etc.
- `User` gets the handful of named back-relations referenced above (`HostelAllocator`, `HostelApplicationReviewer`, etc.) — same style as your existing `"AnnualPlanCreator"`, `"SupportEnrollmentApprover"` named relations.
- `FeeInvoice.hostelAllocation HostelAllocation?` reverse side.

---

## 3. The allocation engine (the actual "system," not the form)

This is a **service function**, not a wizard the warden clicks through bed-by-bed. Manual override always remains available, but the default path is automated and rule-driven — same philosophy as your deadline engine.

### 3.1 Priority scoring (on `HostelApplication` submit/nightly recompute)
```
priorityScore =
    (medicalNotes present ? 50 : 0)
  + (sibling already actively allocated in same hostel ? 30 : 0)
  + (distance-from-home band: far=20, medium=10, near=0)
  + (returning resident, good standing, renewing ? 15 : 0)
  + (disciplinary hold flag ? -100 : 0)      // pushed to bottom / requires manual review
  - (days since submittedAt, capped)          // slight FIFO tiebreaker
```

### 3.2 Allocation run (triggered per term, or on-demand by a warden)
1. **Eligibility filter** — pull `PENDING`/`UNDER_REVIEW` applications for the hostel/term. Exclude if `Hostel.type` doesn't match `User.gender` (hard constraint, never overridden automatically).
2. **Sort** by `priorityScore` desc.
3. **Roommate pairing pass** — build a mutual-request graph from `roommatePreference`; place mutually-requesting groups together first if a room of matching capacity is free.
4. **Remaining students** — bin-pack into rooms using a *least-empty-first* strategy (fill partially-occupied rooms before opening new ones) filtered by:
   - gender/hostel match (hard)
   - block `gradeMin`/`gradeMax` band if set (soft — warn, allow override)
   - accessibility flag if student requires it (hard)
   - room not in `MAINTENANCE`/`CLOSED`
5. **No bed available** → application flips to `WAITLISTED`, ranked by the same score; a `Notification` fires to student/parent with waitlist position.
6. **Successful match** → in one DB transaction:
   - `HostelBed.status = OCCUPIED`, recompute `HostelRoom.status` (`FULL` if all beds occupied)
   - create `HostelAllocation(status: ACTIVE)`
   - flip `HostelApplication.status = APPROVED`
   - generate a `FeeInvoice` via the existing Billing module (hostel fee `FeeTemplate` × room type) and attach `feeInvoiceId`
   - fire `Notification` (allocation confirmed, room/bed/block, move-in date) to student + parent
   - write an audit log entry (feature #2 hook — see §6)
7. **Manual override** endpoint always available to a warden for edge cases (VIP transfer, emergency placement) — same transaction/validation path, just skips the auto-matching steps but keeps every hard constraint (gender, capacity, disciplinary hold requires explicit confirm flag).

### 3.3 Re-allocation / rollover at year end
A scheduled job (add `hostelRolloverJob.ts` to `src/jobs`, same shape as `deadlineEngine.ts`):
- On academic year close: `EXPIRED` all `ACTIVE` allocations for graduating/withdrawn students, free their beds.
- For continuing students who don't submit a renewal application by a cutoff date, auto-generate a `HostelApplication` pre-filled from last year (opt-out model reduces admin load), then run §3.2 for the new term.

### 3.4 Transfers
`HostelTransferRequest` reuses the exact same hard-constraint checks as §3.2 step 4, scoped to a single student — this is the *only* place transfer logic should live; don't duplicate constraint checks in two places.

---

## 4. Daily operational workflows

| Workflow | Trigger | Key state changes |
|---|---|---|
| **Check-in** | Student arrives on move-in day | `HostelAllocation.checkedInAt` set; first `HostelNightAttendance` row created |
| **Night roll call** | Caretaker/matron marks nightly via app (bulk screen: room-by-room checklist, not one-by-one forms) | `HostelNightAttendance` per active allocation per date; `ABSENT` with no matching `APPROVED` outpass auto-flags for warden review |
| **Outpass request** | Student/parent requests leave | `PENDING` → warden `APPROVED`/`REJECTED` → security scans on physical exit (`gateOutAt`) → `OUT` → scans on return (`gateInAt`) → `RETURNED`. A job checks `expectedReturnAt < now && status == OUT` every 15 min → `OVERDUE` + urgent `Notification` to warden + parent |
| **Visitor** | Someone arrives at gate | Security logs `HostelVisitorLog`; `checkOutAt` closed on departure; unclosed logs past curfew surfaced on warden dashboard |
| **Maintenance** | Anyone (student, caretaker) reports an issue | `OPEN` → assigned to caretaker/vendor → `IN_PROGRESS` → `RESOLVED`/`CLOSED`; room auto-flips to `MAINTENANCE` status if `priority = URGENT` and blocks the bed from new allocation until resolved |
| **Incident** | Warden/matron logs a residential incident | `HostelIncidentReport`; severe/critical auto-notifies admin + optionally cross-posts to `BehaviourRecord` |
| **Checkout / vacate** | End of term, withdrawal, disciplinary removal | `HostelAllocation.status` set accordingly, `checkedOutAt` stamped, bed → `VACANT`, room status recalculated, any prorated fee/refund handled via Billing |

---

## 5. Fee & billing integration (reuse, don't rebuild)

- Add a `HostelFeeStructure` mapping `hostelId + roomType → feeTemplateId` (or simply tag existing `FeeTemplate` rows with a `category: "HOSTEL"` if your `FeeTemplate` already supports categories — check before adding a new table).
- On successful allocation (§3.2 step 6), call your existing fee-invoice creation service the same way `fees.routes.ts` does for tuition — **don't** write a parallel invoicing path.
- On vacate mid-term, trigger a prorated credit/refund through the same Billing service.

---

## 6. Cross-feature hooks (you already built these — wire into them, don't duplicate)

- **Audit log (#2):** every state-changing hostel action (allocate, transfer, check-in/out, outpass decision, ticket status change) should go through the same audit middleware/service you built for features 1–3. If it's request-scoped middleware, mount it on the hostel router group; if it's an explicit `logAudit()` call in the service layer, call it at every mutation point listed in §4.
- **Admissions/CRM (#3):** `HostelApplication` is deliberately shaped like a mini-CRM record (status pipeline, priority score, reviewer, notes) — consistent with whatever pipeline pattern you used for admissions, so wardens get a familiar "kanban-style" review screen instead of a new mental model.
- **MFA (#1):** no special hook needed, but flag hostel `WARDEN`/`ASSISTANT_WARDEN` staff assignments as MFA-required roles in your policy config — they handle minors' movement data, which is the most sensitive data flow in this module.
- **Notifications:** every row in the "Trigger" column of §4 fires a `Notification` using your existing model/socket pattern — reuse `NotificationType` enum, just add new variants (`HOSTEL_ALLOCATED`, `OUTPASS_APPROVED`, `OUTPASS_OVERDUE`, `MAINTENANCE_UPDATE`, etc.)
- **Inventory (#11, future):** `HostelRoom.amenities` and `HostelMaintenanceTicket` are intentionally loose (`Json`, no `assetId`) right now so that when you build the Inventory module, you can add a proper `assetId` FK to both without a breaking migration.

---

## 7. API surface (Express routes)

Follow the `clubs` module pattern (`hostel.routes.ts` + `hostel.service.ts`, split because this is genuinely a large module) under `apps/server/src/modules/hostel/`:

```
protectedHostelRouter  (all require authenticate + role/scope checks)

  # Setup (SUPER_ADMIN/ADMIN)
  POST   /hostels
  GET    /hostels
  POST   /hostels/:id/blocks
  POST   /blocks/:id/rooms
  POST   /rooms/:id/beds                 (or bulk: POST /rooms/:id/beds/bulk)
  POST   /hostels/:id/staff               (assign warden/matron/caretaker)
  GET    /hostels/:id/occupancy           (dashboard: vacancy by room/block)

  # Applications
  POST   /hostel-applications             (student/parent)
  GET    /hostel-applications             (warden queue, filterable by status)
  PATCH  /hostel-applications/:id/review  (approve/reject/waitlist, manual)

  # Allocation engine
  POST   /hostels/:id/allocate/run        (trigger auto-allocation batch)
  POST   /hostel-allocations              (manual single allocation override)
  GET    /hostel-allocations/:id
  GET    /students/:studentId/hostel-allocations   (full history)
  POST   /hostel-allocations/:id/check-in
  POST   /hostel-allocations/:id/check-out

  # Transfers
  POST   /hostel-transfer-requests
  PATCH  /hostel-transfer-requests/:id/decide

  # Attendance
  POST   /hostels/:id/night-attendance             (bulk, room-by-room submit)
  GET    /hostels/:id/night-attendance?date=

  # Outpass
  POST   /hostel-outpasses
  PATCH  /hostel-outpasses/:id/decide
  POST   /hostel-outpasses/:id/gate-out
  POST   /hostel-outpasses/:id/gate-in

  # Visitors
  POST   /hostel-visitor-logs
  PATCH  /hostel-visitor-logs/:id/checkout

  # Maintenance
  POST   /hostel-maintenance-tickets
  PATCH  /hostel-maintenance-tickets/:id

  # Incidents
  POST   /hostel-incident-reports

  # Reporting
  GET    /hostels/:id/reports/occupancy
  GET    /hostels/:id/reports/revenue
  GET    /hostels/:id/reports/waitlist
```

Every handler: `authenticate` → `authorize(Role.ADMIN, Role.SUPER_ADMIN)` (or scoped variant) → validate with `zod` → call service → `sendSuccess/sendCreated` → errors via `AppError`, exactly like `recruiting.routes.ts`.

**Scoping middleware to add:** a small `hostelScope` middleware that, for non-`SUPER_ADMIN` `ADMIN` users, checks `HostelStaffAssignment` to confirm they're actually assigned to the `hostelId`/`blockId` in the request before letting mutations through. This is the piece that turns "any admin can touch any hostel" into "wardens only manage their own hostel" — same principle as your `classTeacherOf` scoping, just generalized into middleware since hostel has more staff roles than a class does.

---

## 8. Frontend (apps/web) — page inventory

- **Setup wizard** (admin): Hostel → Blocks → Rooms → Beds, with CSV bulk-import for rooms/beds (you'll have dozens to hundreds of beds; nobody should hand-type each one).
- **Warden dashboard**: occupancy heatmap by block/floor, today's roll-call status, open outpasses, open maintenance tickets, waitlist count — the single screen a warden actually lives in daily.
- **Application review queue**: kanban-style like your admissions CRM (PENDING → UNDER_REVIEW → APPROVED/WAITLISTED/REJECTED).
- **Room/floor visual map**: clickable room grid showing bed occupancy at a glance (this is the "not just a form" moment — wardens think spatially, in floor plans, not in tables).
- **Night attendance sheet**: room-by-room checklist, bulk-submit, pre-filled with expected occupants, auto-excludes students `ON_OUTPASS`.
- **Outpass approval + gate scan screen**: simple approve/reject for wardens; QR/ID-based scan-out/scan-in for security.
- **Student/parent portal**: view current allocation, request outpass, request transfer, view visitor log for their own visits, view hostel fee invoice — all reusing existing student/parent shell.
- **Reports**: occupancy %, gender ratio, revenue vs. capacity, maintenance backlog by category.

---

## 9. Critical business rules (encode these as guards, not comments)

1. A student can have **at most one `ACTIVE` allocation** at a time (enforced via transaction + partial unique index in §2).
2. A bed can have **at most one `ACTIVE` allocation** at a time (same enforcement).
3. **Gender/hostel type mismatch is a hard block**, never auto-overridden, and requires an explicit `SUPER_ADMIN` confirmation flag to override manually (for edge cases like staff hostels).
4. A room's `status` is **derived**, not hand-set: recompute `AVAILABLE`/`FULL` from live bed counts after every allocation/vacate; `MAINTENANCE`/`CLOSED`/`RESERVED` are the only manually-set states and they suppress the room from the allocator entirely.
5. **Disciplinary hold** (`priorityScore` penalty) never auto-blocks — it forces the case into manual warden review instead of silently rejecting a student.
6. Outpass `expectedReturnAt` in the past with no `gateInAt` **always** escalates (`OVERDUE`) — this is a duty-of-care/safety feature, not just a status label; never let it silently expire.
7. Vacating a bed for non-payment must go through **Finance sign-off** in the workflow (don't let a warden alone evict a student for a billing reason — that's a Finance decision with a warden execution step).
8. All timestamps on movement records (outpass, visitor, night attendance) should be stored in **school-local timezone**, consistent with how `deadlineEngine.ts` already does `formatInSchoolTimezone`.

---

## 10. Testing (Vitest — mirror `modules/clubs/__tests__` etc.)

Priority order for `modules/hostel/__tests__/`:
1. Allocation engine: gender-mismatch rejection, capacity overflow → waitlist, roommate-pairing correctness, one-active-allocation-per-student invariant under concurrent requests (this is the one worth a real integration test with parallel calls).
2. Transfer request re-uses the same hard constraints as initial allocation.
3. Outpass overdue job correctly flags and notifies.
4. Fee invoice generated exactly once per allocation, reversed correctly on vacate.
5. Scoping middleware: a warden of Hostel A cannot mutate Hostel B's data.

---

## 11. Suggested build order (don't ship all 20 endpoints in one PR)

**Phase 1 — Foundation:** schema migration, Hostel/Block/Room/Bed CRUD + bulk import, staff assignment, occupancy dashboard read-only.
**Phase 2 — Intake & allocation:** `HostelApplication`, allocation engine (auto + manual), check-in/out, fee invoice hook, notifications.
**Phase 3 — Daily ops:** night attendance, outpass + gate scan + overdue job, visitor log.
**Phase 4 — Care & maintenance:** maintenance tickets, incident reports, transfer requests.
**Phase 5 — Reporting & polish:** occupancy/revenue/waitlist reports, room visual map on frontend, CSV exports.

Ship Phase 1–2 as your MVP — that alone is already a *complete* system (structure + staffed allocation), not a stub. Phases 3–5 are what turn it into something a warden actually trusts day to day.

---

## 12. Ready-to-use build prompt

Paste this (or hand it to me directly, continuing here) once you're ready to start Phase 1:

> Implement Phase 1 of the Hostel/Dormitory module for TimihrtHub, following the design in `hostel-dormitory-module-spec.md`. Specifically:
> 1. Add the Prisma schema from §2 (Hostel, HostelBlock, HostelRoom, HostelBed, HostelStaffAssignment enums + the back-relations listed) and generate a migration.
> 2. Create `apps/server/src/modules/hostel/hostel.routes.ts` and `hostel.service.ts` following the structure/conventions of `modules/clubs/`.
> 3. Implement: Hostel/Block/Room CRUD, bulk bed creation, staff assignment endpoint, and the read-only occupancy dashboard endpoint (`GET /hostels/:id/occupancy`) that returns per-block/per-room vacancy counts.
> 4. Add `hostelScope` middleware per §7 so non-super-admins are restricted to hostels they're assigned to via `HostelStaffAssignment`.
> 5. Add Vitest tests under `modules/hostel/__tests__/` covering CRUD validation and the scoping middleware.
> Do not implement allocation/application logic yet — that's Phase 2.

---

*Prepared after cloning and reviewing the live repo structure (`schema.prisma`, `modules/*`, `middleware/auth.ts`, `jobs/*`) to keep every convention — naming, tenancy, RBAC, job pattern — consistent with what's already shipped for MFA, audit logging, and admissions.*
