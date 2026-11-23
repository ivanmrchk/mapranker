import { prisma } from '../prisma.js';
import { mean, round1 } from '../lib/numbers.js';
import { findRankMovement, padWithNotFound, type RankMovement } from './rankMovement.js';
import { findReviewBaselines } from './reviewBaselines.js';
import { RunError, latestScanArgs, runMetrics } from './runs.js';

export interface ProjectCompetitor {
  placeId: string;
  name: string;
  isYou: boolean;
  /** Mean over keywords; a pin where the business isn't in the top 20 counts as 21. */
  avgRank: number;
  /** Mean over keywords of the % of pins in the top 3. */
  visibility: number;
  /** % of all pin checks where the business is in the top 20. */
  top20Share: number;
  /** Change in average rank since about a week earlier; null when not seen on the pins scanned both times. */
  movement: RankMovement | null;
  rating: number | null;
  reviewCount: number | null;
  /** When reviewCount was seen. */
  reviewsSeenAt: string;
  /** Reviews gained (negative: lost) since reviewsSince; null without an earlier observation. */
  reviewChange: number | null;
  reviewsSince: string | null;
}

interface Scan {
  results: { checkedAt: Date; entries: Entry[] }[];
}

interface Entry {
  placeId: string;
  name: string;
  position: number;
  rating: number | null;
  reviewCount: number | null;
}

/** One business's appearances in the scans. */
interface Sightings {
  /** Positions found, per scan (same order as the scans); pins without it are absent. */
  positionsByScan: number[][];
  latest: Entry;
  latestAt: Date;
}

/**
 * Every business in the latest scan of each keyword, with the same metrics as the project's
 * own stats, so the tracked business's row equals the project's average rank and visibility.
 */
export async function getProjectCompetitors(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      keywords: {
        include: {
          runs: {
            ...latestScanArgs,
            include: { results: { select: { checkedAt: true, entries: true } } },
          },
        },
      },
    },
  });
  if (!project) throw new RunError('Project not found', 404);

  const scans = project.keywords.flatMap((k) => k.runs);
  const sightingsByPlace = collectSightings(scans);
  const [baselines, { movementByPlace, ...comparison }] = await Promise.all([
    findReviewBaselines(
      projectId,
      [...sightingsByPlace].map(([placeId, s]) => ({ placeId, scannedAt: s.latestAt })),
    ),
    findRankMovement(scans.map((s) => s.id)),
  ]);

  const competitors: ProjectCompetitor[] = [...sightingsByPlace].map(([placeId, sightings]) => {
    const { latest, latestAt } = sightings;
    const baseline = baselines.get(placeId);
    return {
      placeId,
      name: latest.name,
      isYou: placeId === project.placeId,
      ...rankMetrics(scans, sightings),
      movement: movementByPlace.get(placeId) ?? null,
      rating: latest.rating,
      reviewCount: latest.reviewCount,
      reviewsSeenAt: latestAt.toISOString(),
      reviewChange:
        baseline && latest.reviewCount !== null ? latest.reviewCount - baseline.reviewCount : null,
      reviewsSince: baseline ? baseline.seenAt.toISOString() : null,
    };
  });

  return {
    scans: scans.map((s) => ({ date: s.date.toISOString(), pinsChecked: s.results.length })),
    comparison,
    competitors,
  };
}

function collectSightings(scans: readonly Scan[]): Map<string, Sightings> {
  const byPlace = new Map<string, Sightings>();
  scans.forEach((scan, scanIndex) => {
    for (const { checkedAt, entries } of scan.results) {
      for (const entry of entries) {
        const sightings = byPlace.get(entry.placeId) ?? {
          positionsByScan: scans.map(() => []),
          latest: entry,
          latestAt: checkedAt,
        };
        byPlace.set(entry.placeId, sightings);
        sightings.positionsByScan[scanIndex].push(entry.position);
        if (checkedAt > sightings.latestAt) {
          sightings.latest = entry;
          sightings.latestAt = checkedAt;
        }
      }
    }
  });
  return byPlace;
}

function rankMetrics(scans: readonly Scan[], { positionsByScan }: Sightings) {
  const perScan = scans.map((scan, i) =>
    runMetrics(padWithNotFound(positionsByScan[i], scan.results.length)),
  );
  const pinChecks = scans.reduce((total, scan) => total + scan.results.length, 0);
  return {
    // Scans always have checked pins (latestScanArgs), so these are never null.
    avgRank: round1(mean(perScan.map((m) => m.avgRank!))!),
    visibility: round1(mean(perScan.map((m) => m.visibility!))!),
    top20Share: round1((positionsByScan.flat().length / pinChecks) * 100),
  };
}
