import { prisma } from '../prisma.js';
import { RunError } from './runs.js';

const REVIEW_WINDOW_MS = 7 * 86_400_000;
// A little slack so a scan exactly a week earlier still falls inside the window.
const REVIEW_WINDOW_SLACK_MS = 12 * 3_600_000;

export interface PinCompetitor {
  position: number;
  /** Position at this pin in the previous scan; null if it wasn't there or there's no previous scan. */
  previousPosition: number | null;
  /** True when there is a previous scan and this business wasn't in its results. */
  isNew: boolean;
  placeId: string;
  name: string;
  rating: number | null;
  reviewCount: number | null;
  /** Reviews gained over the 7 days before this scan; null without an earlier observation. */
  reviewsGained: number | null;
  /** When the earlier review count used for reviewsGained was seen. */
  reviewsSince: string | null;
  isYou: boolean;
}

/**
 * Everything the pin panel shows for one pin and keyword:
 * - history: this pin's rank in every run that checked it, oldest first
 * - competitors: the results list for the selected run, compared with the previous scan
 */
export async function getPinInsights(
  projectId: string,
  keywordId: string,
  pinId: string,
  runId: string | undefined,
) {
  const keyword = await prisma.keyword.findFirst({
    where: { id: keywordId, projectId },
    include: { project: true },
  });
  if (!keyword) throw new RunError('Keyword not found', 404);
  const pin = await prisma.pin.findFirst({ where: { id: pinId, projectId } });
  if (!pin) throw new RunError('Pin not found', 404);

  const historyRows = await prisma.pinRankResult.findMany({
    where: { pinId, run: { keywordId } },
    include: { run: { select: { date: true } } },
    orderBy: { run: { date: 'asc' } },
  });
  const history = historyRows.map((r) => ({
    runId: r.runId,
    date: r.run.date.toISOString(),
    rank: r.rank,
  }));

  const run = runId
    ? await prisma.keywordRun.findFirst({ where: { id: runId, keywordId } })
    : await prisma.keywordRun.findFirst({ where: { keywordId }, orderBy: { date: 'desc' } });
  const scan = run
    ? await prisma.pinRankResult.findUnique({
        where: { runId_pinId: { runId: run.id, pinId } },
        include: { entries: { orderBy: { position: 'asc' } } },
      })
    : null;

  if (!run || !scan) {
    return { history, scan: null, previousScan: null, competitors: [] as PinCompetitor[] };
  }

  // The latest earlier run that recorded a results list at this pin.
  const previous = await prisma.pinRankResult.findFirst({
    where: { pinId, entries: { some: {} }, run: { keywordId, date: { lt: run.date } } },
    include: { entries: true, run: { select: { date: true } } },
    orderBy: { run: { date: 'desc' } },
  });
  const previousPositions = new Map(previous?.entries.map((e) => [e.placeId, e.position]));

  // Earliest review count per business in the week before this scan, from any pin or keyword.
  const placeIds = scan.entries.map((e) => e.placeId);
  const windowStart = new Date(scan.checkedAt.getTime() - REVIEW_WINDOW_MS - REVIEW_WINDOW_SLACK_MS);
  const observations = await prisma.pinResultEntry.findMany({
    where: {
      placeId: { in: placeIds },
      reviewCount: { not: null },
      result: {
        checkedAt: { gte: windowStart, lt: scan.checkedAt },
        run: { keyword: { projectId } },
      },
    },
    select: { placeId: true, reviewCount: true, result: { select: { checkedAt: true } } },
  });
  const earliest = new Map<string, { reviewCount: number; at: Date }>();
  for (const o of observations) {
    const seen = earliest.get(o.placeId);
    if (!seen || o.result.checkedAt < seen.at) {
      earliest.set(o.placeId, { reviewCount: o.reviewCount!, at: o.result.checkedAt });
    }
  }

  const competitors: PinCompetitor[] = scan.entries.map((e) => {
    const base = earliest.get(e.placeId);
    return {
      position: e.position,
      previousPosition: previousPositions.get(e.placeId) ?? null,
      isNew: previous !== null && !previousPositions.has(e.placeId),
      placeId: e.placeId,
      name: e.name,
      rating: e.rating,
      reviewCount: e.reviewCount,
      reviewsGained:
        base && e.reviewCount !== null ? Math.max(0, e.reviewCount - base.reviewCount) : null,
      reviewsSince: base ? base.at.toISOString() : null,
      isYou: e.placeId === keyword.project.placeId,
    };
  });

  return {
    history,
    scan: { runId: run.id, checkedAt: scan.checkedAt.toISOString(), rank: scan.rank },
    previousScan: previous
      ? { runId: previous.runId, date: previous.run.date.toISOString(), rank: previous.rank }
      : null,
    competitors,
  };
}
