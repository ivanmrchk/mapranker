-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('Active', 'Paused', 'Inactive');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "businessLabel" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'Active',
    "lastRun" DATE,
    "keywordCount" INTEGER NOT NULL DEFAULT 0,
    "avgRank" DOUBLE PRECISION,
    "avgRankTrend" DOUBLE PRECISION,
    "visibility" DOUBLE PRECISION,
    "visibilityTrend" DOUBLE PRECISION,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);
