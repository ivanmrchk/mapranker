-- DropIndex
DROP INDEX "PinRankResult_runId_idx";

-- AlterTable
ALTER TABLE "KeywordRun" ADD COLUMN     "visibility" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Pin" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PinRankResult" ADD COLUMN     "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "Pin_projectId_deletedAt_idx" ON "Pin"("projectId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PinRankResult_runId_pinId_key" ON "PinRankResult"("runId", "pinId");

-- CreateIndex
CREATE UNIQUE INDEX "RankSnapshot_projectId_date_key" ON "RankSnapshot"("projectId", "date");

