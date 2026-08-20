-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVE');

-- AlterTable users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "middleName" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "nationality" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "state" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pincode" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "birthPlace" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emergencyContact" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emergencyPhone" TEXT;

-- CreateTable lookup_values
CREATE TABLE "lookup_values" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "colorHex" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "lookup_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lookup_values_schoolId_type_idx" ON "lookup_values"("schoolId", "type");

-- AddForeignKey lookup_values -> schools
ALTER TABLE "lookup_values" ADD CONSTRAINT "lookup_values_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable student_profiles
ALTER TABLE "student_profiles" ADD COLUMN "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "student_profiles" ADD COLUMN "middleName" TEXT;
ALTER TABLE "student_profiles" ADD COLUMN "fatherFirstName" TEXT;
ALTER TABLE "student_profiles" ADD COLUMN "fatherMiddleName" TEXT;
ALTER TABLE "student_profiles" ADD COLUMN "fatherLastName" TEXT;
ALTER TABLE "student_profiles" ADD COLUMN "motherFirstName" TEXT;
ALTER TABLE "student_profiles" ADD COLUMN "motherMiddleName" TEXT;
ALTER TABLE "student_profiles" ADD COLUMN "motherLastName" TEXT;
ALTER TABLE "student_profiles" ADD COLUMN "fatherMobile" TEXT;
ALTER TABLE "student_profiles" ADD COLUMN "motherMobile" TEXT;
ALTER TABLE "student_profiles" ADD COLUMN "landline" TEXT;
ALTER TABLE "student_profiles" ADD COLUMN "nationality" TEXT;
ALTER TABLE "student_profiles" ADD COLUMN "city" TEXT;
ALTER TABLE "student_profiles" ADD COLUMN "state" TEXT;
ALTER TABLE "student_profiles" ADD COLUMN "pincode" TEXT;
ALTER TABLE "student_profiles" ADD COLUMN "birthPlace" TEXT;
ALTER TABLE "student_profiles" ADD COLUMN "religionId" TEXT;
ALTER TABLE "student_profiles" ADD COLUMN "categoryId" TEXT;
ALTER TABLE "student_profiles" ADD COLUMN "feeCategoryId" TEXT;
ALTER TABLE "student_profiles" ADD COLUMN "sourceId" TEXT;
ALTER TABLE "student_profiles" ADD COLUMN "houseId" TEXT;
ALTER TABLE "student_profiles" ADD COLUMN "curriculumId" TEXT;
ALTER TABLE "student_profiles" ADD COLUMN "previousSchoolId" TEXT;
ALTER TABLE "student_profiles" ADD COLUMN "previousClassYear" TEXT;
ALTER TABLE "student_profiles" ADD COLUMN "reference" TEXT;

-- AlterTable teacher_profiles
ALTER TABLE "teacher_profiles" ADD COLUMN "religionId" TEXT;
ALTER TABLE "teacher_profiles" ADD COLUMN "houseId" TEXT;

-- AlterTable admin_profiles
ALTER TABLE "admin_profiles" ADD COLUMN "religionId" TEXT;

-- AddForeignKeys for student_profiles lookups
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_religionId_fkey" FOREIGN KEY ("religionId") REFERENCES "lookup_values"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "lookup_values"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_feeCategoryId_fkey" FOREIGN KEY ("feeCategoryId") REFERENCES "lookup_values"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "lookup_values"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "lookup_values"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "lookup_values"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_previousSchoolId_fkey" FOREIGN KEY ("previousSchoolId") REFERENCES "lookup_values"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKeys for teacher_profiles lookups
ALTER TABLE "teacher_profiles" ADD CONSTRAINT "teacher_profiles_religionId_fkey" FOREIGN KEY ("religionId") REFERENCES "lookup_values"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "teacher_profiles" ADD CONSTRAINT "teacher_profiles_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "lookup_values"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKeys for admin_profiles lookups
ALTER TABLE "admin_profiles" ADD CONSTRAINT "admin_profiles_religionId_fkey" FOREIGN KEY ("religionId") REFERENCES "lookup_values"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable fee_invoices
ALTER TABLE "fee_invoices" ADD COLUMN "discountType" TEXT NOT NULL DEFAULT 'AMOUNT';
ALTER TABLE "fee_invoices" ADD COLUMN "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "fee_invoices" ADD COLUMN "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable fee_payments
ALTER TABLE "fee_payments" ADD COLUMN "provisionalReceipt" TEXT;
ALTER TABLE "fee_payments" ADD COLUMN "receiptCopies" INTEGER NOT NULL DEFAULT 1;

-- CreateTable installment_plans
CREATE TABLE "installment_plans" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "numInstallments" INTEGER NOT NULL,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "installment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable installments
CREATE TABLE "installments" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "installmentNo" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "payDate" TIMESTAMP(3),
    "payAmount" DOUBLE PRECISION,
    "receiptNo" TEXT,
    "noCarryForward" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "installments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "installments_planId_idx" ON "installments"("planId");

-- AddForeignKeys for installment_plans
ALTER TABLE "installment_plans" ADD CONSTRAINT "installment_plans_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "installment_plans" ADD CONSTRAINT "installment_plans_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "fee_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKeys for installments
ALTER TABLE "installments" ADD CONSTRAINT "installments_planId_fkey" FOREIGN KEY ("planId") REFERENCES "installment_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
