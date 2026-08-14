-- AlterTable
ALTER TABLE "teacher_profiles" ADD COLUMN     "gradeLevelId" TEXT;

-- AddForeignKey
ALTER TABLE "teacher_profiles" ADD CONSTRAINT "teacher_profiles_gradeLevelId_fkey" FOREIGN KEY ("gradeLevelId") REFERENCES "grade_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
