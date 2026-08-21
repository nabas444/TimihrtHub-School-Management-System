-- CreateEnum
CREATE TYPE "AnnouncementPriority" AS ENUM ('NORMAL', 'IMPORTANT', 'URGENT');

-- CreateEnum
CREATE TYPE "AnnualPlanScope" AS ENUM ('TEACHER_SUBJECT', 'SCHOOL_WIDE');

-- CreateEnum
CREATE TYPE "AnnualPlanStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REVISION_REQUESTED');

-- CreateEnum
CREATE TYPE "CertificateType" AS ENUM ('GRADUATION', 'RECOGNITION');

-- CreateEnum
CREATE TYPE "CertificateRecipientType" AS ENUM ('STUDENT', 'STAFF');

-- CreateEnum
CREATE TYPE "SupportProgramType" AS ENUM ('FINANCIAL_AID', 'MEAL_SUPPORT', 'SCHOLARSHIP', 'OTHER');

-- CreateEnum
CREATE TYPE "SupportEnrollmentStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ENDED');

-- CreateEnum
CREATE TYPE "ProgramType" AS ENUM ('REGULAR', 'SUMMER', 'NIGHT', 'WEEKEND', 'EXTENSION', 'OTHER');

-- CreateEnum
CREATE TYPE "TutorialEnrollmentStatus" AS ENUM ('ENROLLED', 'WAITLISTED', 'DROPPED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ANNUAL_PLAN';

-- AlterTable
ALTER TABLE "admin_profiles" ADD COLUMN     "designation" TEXT,
ADD COLUMN     "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "announcements" ADD COLUMN     "classIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "gradeLevelId" TEXT,
ADD COLUMN     "priority" "AnnouncementPriority" NOT NULL DEFAULT 'NORMAL';

-- AlterTable
ALTER TABLE "classes" ADD COLUMN     "programType" "ProgramType" NOT NULL DEFAULT 'REGULAR',
ADD COLUMN     "programTypeLabel" TEXT;

-- AlterTable
ALTER TABLE "library_books" ADD COLUMN     "acquisitionSource" TEXT,
ADD COLUMN     "barcodeNumber" TEXT,
ADD COLUMN     "condition" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "digitalCopyUrl" TEXT,
ADD COLUMN     "edition" TEXT,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "price" DOUBLE PRECISION,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "parent_profiles" ADD COLUMN     "annualIncome" TEXT,
ADD COLUMN     "education" TEXT;

-- AlterTable
ALTER TABLE "student_profiles" ADD COLUMN     "programType" "ProgramType",
ADD COLUMN     "programTypeLabel" TEXT,
ADD COLUMN     "usesTransport" BOOLEAN;

-- AlterTable
ALTER TABLE "subjects" ADD COLUMN     "gradeLevelId" TEXT;

-- AlterTable
ALTER TABLE "teacher_profiles" ADD COLUMN     "designation" TEXT,
ADD COLUMN     "experienceYears" INTEGER;

-- CreateTable
CREATE TABLE "academic_year_summaries" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "overallAverage" DOUBLE PRECISION,
    "overallRank" INTEGER,
    "termBreakdown" JSONB NOT NULL,
    "isPassing" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "academic_year_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "type" "CertificateType" NOT NULL,
    "recipientType" "CertificateRecipientType" NOT NULL,
    "studentProfileId" TEXT,
    "userId" TEXT,
    "academicYear" TEXT,
    "title" TEXT NOT NULL,
    "reason" TEXT,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "layout" TEXT NOT NULL DEFAULT 'ONE_SIDED',
    "signedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "annual_plans" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "scope" "AnnualPlanScope" NOT NULL,
    "createdById" TEXT NOT NULL,
    "teacherProfileId" TEXT,
    "subjectId" TEXT,
    "classId" TEXT,
    "gradeLevelId" TEXT,
    "academicYear" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "columns" JSONB NOT NULL,
    "rows" JSONB NOT NULL,
    "status" "AnnualPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "annual_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_programs" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "type" "SupportProgramType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "waiverPercent" DOUBLE PRECISION,
    "academicYear" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_support_enrollments" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "supportProgramId" TEXT NOT NULL,
    "status" "SupportEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "notes" TEXT,
    "approvedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_support_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_distribution_records" (
    "id" TEXT NOT NULL,
    "studentSupportEnrollmentId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "recordedById" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "meal_distribution_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutorial_sessions" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subjectId" TEXT,
    "classId" TEXT,
    "gradeLevelId" TEXT,
    "teacherProfileId" TEXT NOT NULL,
    "dayOfWeek" "DayOfWeek",
    "specificDate" TIMESTAMP(3),
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "location" TEXT,
    "capacity" INTEGER,
    "isRecurring" BOOLEAN NOT NULL DEFAULT true,
    "academicYear" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutorial_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutorial_enrollments" (
    "id" TEXT NOT NULL,
    "tutorialSessionId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "status" "TutorialEnrollmentStatus" NOT NULL DEFAULT 'ENROLLED',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutorial_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutorial_attendance_records" (
    "id" TEXT NOT NULL,
    "tutorialSessionId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'ABSENT',
    "markedById" TEXT NOT NULL,

    CONSTRAINT "tutorial_attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "academic_year_summaries_studentProfileId_academicYear_key" ON "academic_year_summaries"("studentProfileId", "academicYear");

-- CreateIndex
CREATE INDEX "certificates_schoolId_type_idx" ON "certificates"("schoolId", "type");

-- CreateIndex
CREATE INDEX "annual_plans_schoolId_academicYear_idx" ON "annual_plans"("schoolId", "academicYear");

-- CreateIndex
CREATE INDEX "support_programs_schoolId_type_idx" ON "support_programs"("schoolId", "type");

-- CreateIndex
CREATE INDEX "student_support_enrollments_studentProfileId_idx" ON "student_support_enrollments"("studentProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "meal_distribution_records_studentSupportEnrollmentId_date_key" ON "meal_distribution_records"("studentSupportEnrollmentId", "date");

-- CreateIndex
CREATE INDEX "tutorial_sessions_schoolId_academicYear_idx" ON "tutorial_sessions"("schoolId", "academicYear");

-- CreateIndex
CREATE UNIQUE INDEX "tutorial_enrollments_tutorialSessionId_studentProfileId_key" ON "tutorial_enrollments"("tutorialSessionId", "studentProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "tutorial_attendance_records_tutorialSessionId_studentProfil_key" ON "tutorial_attendance_records"("tutorialSessionId", "studentProfileId", "date");

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_gradeLevelId_fkey" FOREIGN KEY ("gradeLevelId") REFERENCES "grade_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_gradeLevelId_fkey" FOREIGN KEY ("gradeLevelId") REFERENCES "grade_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_year_summaries" ADD CONSTRAINT "academic_year_summaries_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_signedById_fkey" FOREIGN KEY ("signedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annual_plans" ADD CONSTRAINT "annual_plans_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annual_plans" ADD CONSTRAINT "annual_plans_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annual_plans" ADD CONSTRAINT "annual_plans_teacherProfileId_fkey" FOREIGN KEY ("teacherProfileId") REFERENCES "teacher_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annual_plans" ADD CONSTRAINT "annual_plans_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annual_plans" ADD CONSTRAINT "annual_plans_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_programs" ADD CONSTRAINT "support_programs_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_support_enrollments" ADD CONSTRAINT "student_support_enrollments_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_support_enrollments" ADD CONSTRAINT "student_support_enrollments_supportProgramId_fkey" FOREIGN KEY ("supportProgramId") REFERENCES "support_programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_support_enrollments" ADD CONSTRAINT "student_support_enrollments_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_distribution_records" ADD CONSTRAINT "meal_distribution_records_studentSupportEnrollmentId_fkey" FOREIGN KEY ("studentSupportEnrollmentId") REFERENCES "student_support_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutorial_sessions" ADD CONSTRAINT "tutorial_sessions_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutorial_sessions" ADD CONSTRAINT "tutorial_sessions_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutorial_sessions" ADD CONSTRAINT "tutorial_sessions_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutorial_sessions" ADD CONSTRAINT "tutorial_sessions_gradeLevelId_fkey" FOREIGN KEY ("gradeLevelId") REFERENCES "grade_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutorial_sessions" ADD CONSTRAINT "tutorial_sessions_teacherProfileId_fkey" FOREIGN KEY ("teacherProfileId") REFERENCES "teacher_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutorial_enrollments" ADD CONSTRAINT "tutorial_enrollments_tutorialSessionId_fkey" FOREIGN KEY ("tutorialSessionId") REFERENCES "tutorial_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutorial_enrollments" ADD CONSTRAINT "tutorial_enrollments_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutorial_attendance_records" ADD CONSTRAINT "tutorial_attendance_records_tutorialSessionId_fkey" FOREIGN KEY ("tutorialSessionId") REFERENCES "tutorial_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
