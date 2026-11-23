import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import { RunError } from './runs.js';

const HOUR_MS = 3_600_000;
/** Review change is measured over about this long, as closely as past scans allow. */
const REVIEW_COMPARISON_MS = 7 * 24 * HOUR_MS;
/** Counts newer than this are the same scan session (other pins, other keywords), not history. */
const MIN_REVIEW_BASELINE_AGE_MS = 12 * HOUR_MS;

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
  /** Reviews gained (negative: lost) since reviewsSince; null without an earlier observation. */
  reviewChange: number | null;
  /** When the earlier count was seen: the observation closest to a week before this scan. */
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

  const reviewBaselines = await Promise.all(
    scan.entries.map((e) =>
      findReviewBaseline({ projectId, placeId: e.placeId, scannedAt: scan.checkedAt }),
    ),
  );

  const competitors: PinCompetitor[] = scan.entries.map((e, i) => {
    const baseline = reviewBaselines[i];
    return {
      position: e.position,
      previousPosition: previousPositions.get(e.placeId) ?? null,
      isNew: previous !== null && !previousPositions.has(e.placeId),
      placeId: e.placeId,
      name: e.name,
      rating: e.rating,
      reviewCount: e.reviewCount,
      reviewChange:
        baseline && e.reviewCount !== null ? e.reviewCount - baseline.reviewCount : null,
      reviewsSince: baseline ? baseline.seenAt.toISOString() : null,
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

/**
 * The review count to compare a scan with: the one seen closest to a week earlier, at any pin
 * or keyword of the project. There's no limit on how old it may be, so growth still shows
 * after a longer gap between runs.
 */
async function findReviewBaseline({
  projectId,
  placeId,
  scannedAt,
}: {
  projectId: string;
  placeId: string;
  scannedAt: Date;
}) {
  const aWeekEarlier = new Date(scannedAt.getTime() - REVIEW_COMPARISON_MS);
  const newestAllowed = new Date(scannedAt.getTime() - MIN_REVIEW_BASELINE_AGE_MS);
  const findSighting = (checkedAt: Prisma.DateTimeFilter, order: Prisma.SortOrder) =>
    prisma.pinResultEntry.findFirst({
      where: {
        placeId,
        reviewCount: { not: null },
        result: { checkedAt, run: { keyword: { projectId } } },
      },
      orderBy: { result: { checkedAt: order } },
      select: { reviewCount: true, result: { select: { checkedAt: true } } },
    });

  const sightings = await Promise.all([
    findSighting({ lte: aWeekEarlier }, 'desc'),
    findSighting({ gt: aWeekEarlier, lte: newestAllowed }, 'asc'),
  ]);
  const distanceFromAWeek = (seenAt: Date) => Math.abs(seenAt.getTime() - aWeekEarlier.getTime());
  const [closest] = sightings
    .flatMap((s) => (s ? [{ reviewCount: s.reviewCount!, seenAt: s.result.checkedAt }] : []))
    .sort((a, b) => distanceFromAWeek(a.seenAt) - distanceFromAWeek(b.seenAt));
  return closest ?? null;
}
