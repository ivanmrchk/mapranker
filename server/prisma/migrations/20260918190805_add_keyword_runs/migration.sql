-- CreateTable
CREATE TABLE "KeywordRun" (
    "id" TEXT NOT NULL,
    "keywordId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "avgRank" DOUBLE PRECISION,
    "pinsTotal" INTEGER NOT NULL,
    "pinsChecked" INTEGER NOT NULL,

    CONSTRAINT "KeywordRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PinRankResult" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "pinId" TEXT NOT NULL,
    "rank" INTEGER,

    CONSTRAINT "PinRankResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KeywordRun_keywordId_date_idx" ON "KeywordRun"("keywordId", "date");

-- CreateIndex
CREATE INDEX "PinRankResult_runId_idx" ON "PinRankResult"("runId");

-- AddForeignKey
ALTER TABLE "KeywordRun" ADD CONSTRAINT "KeywordRun_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PinRankResult" ADD CONSTRAINT "PinRankResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "KeywordRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PinRankResult" ADD CONSTRAINT "PinRankResult_pinId_fkey" FOREIGN KEY ("pinId") REFERENCES "Pin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
