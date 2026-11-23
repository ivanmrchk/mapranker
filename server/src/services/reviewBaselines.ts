import { prisma } from '../prisma.js';

export interface ReviewBaseline {
  reviewCount: number;
  seenAt: Date;
}

/**
 * For each business, the earlier review count to compare its scan with: the one seen closest
 * to a week before that scan, at any pin or keyword of the project. There's no limit on how
 * old it may be, so growth still shows after a longer gap between runs. Counts seen less than
 * 12 hours before are the same scan session, not history. Businesses never seen before are
 * left out of the map.
 *
 * Raw SQL because Prisma can't pick one closest row per business (DISTINCT ON), and fetching
 * every past sighting would grow with each run. Times are passed as text: the columns hold
 * UTC without a zone, and this keeps the session's time zone out of the comparison.
 */
export async function findReviewBaselines(
  projectId: string,
  scans: readonly { placeId: string; scannedAt: Date }[],
): Promise<Map<string, ReviewBaseline>> {
  const placeIds = scans.map((s) => s.placeId);
  const scannedAts = scans.map((s) => s.scannedAt.toISOString());
  const rows = await prisma.$queryRaw<(ReviewBaseline & { placeId: string })[]>`
    SELECT DISTINCT ON (scan."placeId")
      scan."placeId", entry."reviewCount", result."checkedAt" AS "seenAt"
    FROM unnest(${placeIds}::text[], ${scannedAts}::text[]::timestamp[]) AS scan("placeId", "scannedAt")
    JOIN "PinResultEntry" entry ON entry."placeId" = scan."placeId" AND entry."reviewCount" IS NOT NULL
    JOIN "PinRankResult" result ON result.id = entry."resultId"
      AND result."checkedAt" <= scan."scannedAt" - interval '12 hours'
    JOIN "KeywordRun" run ON run.id = result."runId"
    JOIN "Keyword" keyword ON keyword.id = run."keywordId" AND keyword."projectId" = ${projectId}
    ORDER BY scan."placeId",
      abs(extract(epoch FROM result."checkedAt" - (scan."scannedAt" - interval '7 days')))
  `;
  return new Map(rows.map(({ placeId, reviewCount, seenAt }) => [placeId, { reviewCount, seenAt }]));
}
