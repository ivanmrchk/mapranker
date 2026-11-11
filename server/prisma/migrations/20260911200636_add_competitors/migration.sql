-- CreateTable
CREATE TABLE "Competitor" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "placeId" TEXT,
    "avgRank" DOUBLE PRECISION,
    "visibility" DOUBLE PRECISION,
    "reviewCount" INTEGER,
    "reviewGrowthPerWeek" DOUBLE PRECISION,

    CONSTRAINT "Competitor_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Competitor" ADD CONSTRAINT "Competitor_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
