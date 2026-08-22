-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "AuthProvider" AS ENUM ('LOCAL', 'GOOGLE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "googleId" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "authProvider" "AuthProvider" NOT NULL DEFAULT 'LOCAL';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "middleName" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "nationality" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "state" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pincode" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "birthPlace" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emergencyContact" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emergencyPhone" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_googleId_key" ON "users"("googleId");
