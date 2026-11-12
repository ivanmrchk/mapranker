-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('Running', 'Completed', 'Stopped');

-- AlterTable
ALTER TABLE "KeywordRun" ADD COLUMN     "status" "RunStatus" NOT NULL DEFAULT 'Completed',
ADD COLUMN     "stopReason" TEXT;

