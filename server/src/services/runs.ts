import { prisma } from '../prisma.js';
import { MAX_TRACKED_RANK, rankEngine, type MapsListing } from '../rank/engine.js';

/** Nested-create data for a check's results list. */
export function entriesData(listings: MapsListing[]) {
  return listings.map((l) => ({
    position: l.position,
    placeId: l.placeId,
    name: l.name,
    rating: l.rating,
    reviewCount: l.reviewCount,
  }));
}

/** Pins that count for checks: not removed and switched on. */
export function checkablePinsWhere(projectId: string) {
  return { projectId, deletedAt: null, enabled: true };
}

export class RunError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function todayDate(): Date {
  return new Date(new Date().toISOString().slice(0, 10));
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

/**
 * Metrics for a set of pin results.
 * - avgRank: a pin where the business wasn't found counts as MAX_TRACKED_RANK + 1 (21),
 *   so missing pins pull the average down instead of being ignored.
 * - visibility: % of checked pins where the business is in the top 3.
 */
export function runMetrics(results: { rank: number | null }[]) {
  if (results.length === 0) return { pinsChecked: 0, avgRank: null, visibility: null };
  const ranks = results.map((r) => r.rank ?? MAX_TRACKED_RANK + 1);
  const top3 = results.filter((r) => r.rank !== null && r.rank <= 3).length;
  return {
    pinsChecked: results.length,
    avgRank: round1(mean(ranks)!),
    visibility: round1((top3 / results.length) * 100),
  };
}

export async function recomputeRun(runId: string) {
  const run = await prisma.keywordRun.findUniqueOrThrow({
    where: { id: runId },
    include: { results: true },
  });
  const metrics = runMetrics(run.results);
  return prisma.keywordRun.update({
    where: { id: runId },
    data: { ...metrics, pinsTotal: Math.max(run.pinsTotal, metrics.pinsChecked) },
  });
}

/** Keyword stats mirror its most recent run. */
export async function refreshKeywordStats(keywordId: string) {
  const latest = await prisma.keywordRun.findFirst({
    where: { keywordId },
    orderBy: { date: 'desc' },
  });
  return prisma.keyword.update({
    where: { id: keywordId },
    data: {
      avgRank: latest?.avgRank ?? null,
      visibility: latest?.visibility ?? null,
      lastRun: latest ? new Date(latest.date.toISOString().slice(0, 10)) : null,
    },
  });
}

/**
 * Project stats are the mean of each keyword's latest stats. Also records today's
 * point on the trends chart and the change since the previous day's point.
 */
export async function refreshProjectStats(projectId: string) {
  const keywords = await prisma.keyword.findMany({ where: { projectId } });
  const avgRankRaw = mean(keywords.flatMap((k) => (k.avgRank === null ? [] : [k.avgRank])));
  const visibilityRaw = mean(keywords.flatMap((k) => (k.visibility === null ? [] : [k.visibility])));
  const lastRun = keywords.reduce<Date | null>(
    (latest, k) => (k.lastRun && (!latest || k.lastRun > latest) ? k.lastRun : latest),
    null,
  );

  if (avgRankRaw === null || visibilityRaw === null) {
    await prisma.project.update({
      where: { id: projectId },
      data: { avgRank: null, visibility: null, avgRankTrend: null, visibilityTrend: null, lastRun },
    });
    return;
  }

  const avgRank = round1(avgRankRaw);
  const visibility = round1(visibilityRaw);
  const today = todayDate();
  const previous = await prisma.rankSnapshot.findFirst({
    where: { projectId, date: { lt: today } },
    orderBy: { date: 'desc' },
  });

  await prisma.$transaction([
    prisma.rankSnapshot.upsert({
      where: { projectId_date: { projectId, date: today } },
      create: { projectId, date: today, avgRank, visibility },
      update: { avgRank, visibility },
    }),
    prisma.project.update({
      where: { id: projectId },
      data: {
        avgRank,
        visibility,
        lastRun,
        avgRankTrend: previous ? round1(avgRank - previous.avgRank) : null,
        visibilityTrend: previous ? round1(visibility - previous.visibility) : null,
      },
    }),
  ]);
}

async function loadKeyword(projectId: string, keywordId: string) {
  const keyword = await prisma.keyword.findFirst({
    where: { id: keywordId, projectId },
    include: { project: true },
  });
  if (!keyword) throw new RunError('Keyword not found', 404);
  return keyword;
}

/** Checks every enabled pin for a keyword and stores the results as a new run. */
export async function runAllPins(projectId: string, keywordId: string) {
  const keyword = await loadKeyword(projectId, keywordId);
  const pins = await prisma.pin.findMany({ where: checkablePinsWhere(projectId) });
  const run = await prisma.keywordRun.create({
    data: { keywordId, date: new Date(), pinsTotal: pins.length, pinsChecked: 0 },
  });

  for (const pin of pins) {
    try {
      const { rank, listings } = await rankEngine.check({
        keyword: keyword.text,
        lat: pin.lat,
        lng: pin.lng,
        placeId: keyword.project.placeId,
        businessName: keyword.project.businessLabel,
      });
      const checkedAt = new Date();
      await prisma.$transaction([
        prisma.pinRankResult.create({
          data: {
            runId: run.id,
            pinId: pin.id,
            rank,
            checkedAt,
            entries: { create: entriesData(listings) },
          },
        }),
        prisma.pin.update({ where: { id: pin.id }, data: { lastCheckedAt: checkedAt } }),
      ]);
    } catch (err) {
      // Leave this pin unchecked for the run; the others still count.
      console.warn(`Check failed for pin ${pin.id} (${keyword.text}):`, (err as Error).message);
    }
  }

  await recomputeRun(run.id);
  await refreshKeywordStats(keywordId);
  await refreshProjectStats(projectId);
  return run.id;
}

/**
 * Checks one pin on demand. The result replaces that pin's result in the keyword's
 * latest run (creating a run if the keyword has none), then stats are recalculated.
 */
export async function checkSinglePin(projectId: string, keywordId: string, pinId: string) {
  const keyword = await loadKeyword(projectId, keywordId);
  const pin = await prisma.pin.findFirst({ where: { id: pinId, projectId, deletedAt: null } });
  if (!pin) throw new RunError('Pin not found', 404);
  if (!pin.enabled) throw new RunError('Pin is disabled', 400);

  let rank: number | null;
  let listings: MapsListing[];
  try {
    ({ rank, listings } = await rankEngine.check({
      keyword: keyword.text,
      lat: pin.lat,
      lng: pin.lng,
      placeId: keyword.project.placeId,
      businessName: keyword.project.businessLabel,
    }));
  } catch (err) {
    throw new RunError(`Check failed: ${(err as Error).message}`, 502);
  }

  const latest =
    (await prisma.keywordRun.findFirst({ where: { keywordId }, orderBy: { date: 'desc' } })) ??
    (await prisma.keywordRun.create({
      data: {
        keywordId,
        date: new Date(),
        pinsTotal: await prisma.pin.count({ where: checkablePinsWhere(projectId) }),
        pinsChecked: 0,
      },
    }));

  const checkedAt = new Date();
  await prisma.$transaction([
    prisma.pinRankResult.upsert({
      where: { runId_pinId: { runId: latest.id, pinId } },
      create: { runId: latest.id, pinId, rank, checkedAt, entries: { create: entriesData(listings) } },
      update: { rank, checkedAt, entries: { deleteMany: {}, create: entriesData(listings) } },
    }),
    prisma.pin.update({ where: { id: pinId }, data: { lastCheckedAt: checkedAt } }),
  ]);

  await recomputeRun(latest.id);
  await refreshKeywordStats(keywordId);
  await refreshProjectStats(projectId);
  return latest.id;
}
