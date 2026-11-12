// The API's response shapes (mirrored by src/types/project.ts in the frontend).
import type { Response } from 'express';
import type {
  Competitor as PrismaCompetitor,
  Keyword as PrismaKeyword,
  KeywordRun as PrismaKeywordRun,
  Pin,
  PinRankResult,
  Project as PrismaProject,
  RankSnapshot,
} from '@prisma/client';
import { prisma } from '../prisma.js';
import { RunError } from '../services/runs.js';

export function serializeProject(p: PrismaProject, keywordCount: number) {
  return {
    id: p.id,
    name: p.name,
    businessLabel: p.businessLabel,
    placeId: p.placeId,
    address: p.address,
    lat: p.lat,
    lng: p.lng,
    status: p.status,
    lastRun: p.lastRun ? p.lastRun.toISOString().slice(0, 10) : null,
    keywordCount,
    avgRank: p.avgRank,
    avgRankTrend: p.avgRankTrend,
    visibility: p.visibility,
    visibilityTrend: p.visibilityTrend,
  };
}

export function serializeProjectDetail(
  p: PrismaProject & {
    pins: Pin[];
    rankSnapshots: RankSnapshot[];
    keywords: PrismaKeyword[];
    competitors: PrismaCompetitor[];
  },
) {
  const enabledPins = p.pins.filter((pin) => pin.enabled);
  return {
    ...serializeProject(p, p.keywords.length),
    pinsTracked: enabledPins.filter((pin) => pin.lastCheckedAt !== null).length,
    pinsTotal: enabledPins.length,
    rankHistory: p.rankSnapshots.map((s) => ({
      date: s.date.toISOString().slice(0, 10),
      avgRank: s.avgRank,
      visibility: s.visibility,
    })),
    keywords: p.keywords.map(serializeKeyword),
    competitors: p.competitors.map(serializeCompetitor),
  };
}

export function serializeKeyword(k: PrismaKeyword) {
  return {
    id: k.id,
    text: k.text,
    avgRank: k.avgRank,
    visibility: k.visibility,
    lastRun: k.lastRun ? k.lastRun.toISOString().slice(0, 10) : null,
  };
}

export function serializeRunSummary(run: PrismaKeywordRun) {
  return { id: run.id, date: run.date.toISOString(), status: run.status };
}

export async function serializeKeywordRun(run: PrismaKeywordRun & { results: PinRankResult[] }) {
  return {
    ...serializeRunSummary(run),
    stopReason: run.stopReason,
    pinsTotal: run.pinsTotal,
    pinsChecked: run.pinsChecked,
    avgRank: run.avgRank,
    visibility: run.visibility,
    ...(await computeRunTrends(run)),
    pinResults: run.results.map((r) => ({
      pinId: r.pinId,
      rank: r.rank,
      checkedAt: r.checkedAt.toISOString(),
    })),
  };
}

/** Response for anything that changes a keyword's runs: the keyword plus the affected run. */
export async function keywordRunResponse(keywordId: string, runId: string) {
  const [keyword, run] = await Promise.all([
    prisma.keyword.findUniqueOrThrow({ where: { id: keywordId } }),
    prisma.keywordRun.findUniqueOrThrow({ where: { id: runId }, include: { results: true } }),
  ]);
  return { keyword: serializeKeyword(keyword), run: await serializeKeywordRun(run) };
}

export function serializePin(p: Pin) {
  return {
    id: p.id,
    lat: p.lat,
    lng: p.lng,
    enabled: p.enabled,
    lastCheckedAt: p.lastCheckedAt ? p.lastCheckedAt.toISOString() : null,
  };
}

/** Sends a RunError as its HTTP status; returns false for any other error. */
export function sendRunError(res: Response, err: unknown) {
  if (err instanceof RunError) {
    res.status(err.status).json({ error: err.message });
    return true;
  }
  return false;
}

function serializeCompetitor(c: PrismaCompetitor) {
  return {
    id: c.id,
    name: c.name,
    placeId: c.placeId,
    avgRank: c.avgRank,
    visibility: c.visibility,
    reviewCount: c.reviewCount,
    reviewGrowthPerWeek: c.reviewGrowthPerWeek,
  };
}

/** Change since the keyword's previous run that has numbers. */
async function computeRunTrends(run: PrismaKeywordRun) {
  const previous = await prisma.keywordRun.findFirst({
    where: { keywordId: run.keywordId, date: { lt: run.date }, pinsChecked: { gt: 0 } },
    orderBy: { date: 'desc' },
  });
  return {
    avgRankTrend:
      run.avgRank !== null && previous?.avgRank != null ? round1(run.avgRank - previous.avgRank) : null,
    visibilityTrend:
      run.visibility !== null && previous?.visibility != null
        ? round1(run.visibility - previous.visibility)
        : null,
  };
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
