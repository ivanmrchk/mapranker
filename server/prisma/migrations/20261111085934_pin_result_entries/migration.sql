-- CreateTable
CREATE TABLE "PinResultEntry" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "placeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rating" DOUBLE PRECISION,
    "reviewCount" INTEGER,

    CONSTRAINT "PinResultEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PinResultEntry_resultId_idx" ON "PinResultEntry"("resultId");

-- CreateIndex
CREATE INDEX "PinResultEntry_placeId_idx" ON "PinResultEntry"("placeId");

-- AddForeignKey
ALTER TABLE "PinResultEntry" ADD CONSTRAINT "PinResultEntry_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "PinRankResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

