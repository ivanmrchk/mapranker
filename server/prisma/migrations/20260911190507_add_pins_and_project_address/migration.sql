-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "address" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "Pin" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "lastCheckedAt" TIMESTAMP(3),

    CONSTRAINT "Pin_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Pin" ADD CONSTRAINT "Pin_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
