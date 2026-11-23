import { prisma } from '../prisma.js';
import { round1 } from '../lib/numbers.js';
import { runMetrics } from './runs.js';

interface Position {
  placeId: string;
  position: number;
}

/** One pin check and the same pin and keyword's check about a week earlier. */
interface Comparison {
  runId: string;
  now: Position[];
  before: Position[];
  daysApart: number;
}

export interface RankMovement {
  /** Average rank over the compared pin checks; a pin outside the top 20 counts as 21. */
  before: number;
  now: number;
  /** before - now: positive when the business moved up. */
  spotsGained: number;
}

/**
 * How each business's average rank moved between the given runs and about a week earlier.
 * Only pin checks made both times count, so a keyword scanned once, or pins added or removed
 * since, can't look like movement. Businesses not in the top 20 at any of them are left out.
 */
export async function findRankMovement(runIds: readonly string[]) {
  const comparisons = await loadComparisons(runIds);
  const positionsBefore = groupPositions(comparisons.map((c) => c.before));
  const positionsNow = groupPositions(comparisons.map((c) => c.now));
  const averageRank = (found: number[] = []) => runMetrics(padWithNotFound(found, comparisons.length)).avgRank!;

  const movementByPlace = new Map<string, RankMovement>();
  for (const placeId of new Set([...positionsBefore.keys(), ...positionsNow.keys()])) {
    const before = averageRank(positionsBefore.get(placeId));
    const now = averageRank(positionsNow.get(placeId));
    movementByPlace.set(placeId, { before, now, spotsGained: round1(before - now) });
  }
  return {
    movementByPlace,
    pinChecksCompared: comparisons.length,
    keywordsCompared: new Set(comparisons.map((c) => c.runId)).size,
    daysApart: comparisons.length
      ? Math.round(comparisons.reduce((total, c) => total + c.daysApart, 0) / comparisons.length)
      : null,
  };
}

/** Ranks for `total` pin checks: the found positions, and null for every check without one. */
export function padWithNotFound(found: readonly number[], total: number): { rank: number | null }[] {
  return Array.from({ length: total }, (_, i) => ({ rank: found[i] ?? null }));
}

/**
 * Pairs each of the runs' pin checks with the check closest to a week earlier at the same pin
 * for the same keyword. As with review growth, checks under 12 hours apart are the same scan
 * session. Raw SQL for DISTINCT ON: Prisma can't pick one closest row per check.
 */
async function loadComparisons(runIds: readonly string[]): Promise<Comparison[]> {
  const pairs = await prisma.$queryRaw<{ nowId: string; beforeId: string; daysApart: number }[]>`
    SELECT DISTINCT ON (now.id)
      now.id AS "nowId", before.id AS "beforeId",
      (extract(epoch FROM now."checkedAt" - before."checkedAt") / 86400)::float AS "daysApart"
    FROM "PinRankResult" now
    JOIN "KeywordRun" "nowRun" ON "nowRun".id = now."runId"
    JOIN "KeywordRun" "beforeRun" ON "beforeRun"."keywordId" = "nowRun"."keywordId"
    JOIN "PinRankResult" before ON before."runId" = "beforeRun".id AND before."pinId" = now."pinId"
      AND before."checkedAt" <= now."checkedAt" - interval '12 hours'
    WHERE now."runId" = ANY(${[...runIds]}::text[])
    ORDER BY now.id,
      abs(extract(epoch FROM before."checkedAt" - (now."checkedAt" - interval '7 days')))
  `;

  const results = await prisma.pinRankResult.findMany({
    where: { id: { in: pairs.flatMap((p) => [p.nowId, p.beforeId]) } },
    select: { id: true, runId: true, entries: { select: { placeId: true, position: true } } },
  });
  const resultById = new Map(results.map((r) => [r.id, r]));
  return pairs.map(({ nowId, beforeId, daysApart }) => ({
    runId: resultById.get(nowId)!.runId,
    now: resultById.get(nowId)!.entries,
    before: resultById.get(beforeId)!.entries,
    daysApart,
  }));
}

function groupPositions(lists: readonly Position[][]): Map<string, number[]> {
  const byPlace = new Map<string, number[]>();
  for (const { placeId, position } of lists.flat()) {
    const positions = byPlace.get(placeId);
    if (positions) positions.push(position);
    else byPlace.set(placeId, [position]);
  }
  return byPlace;
}
