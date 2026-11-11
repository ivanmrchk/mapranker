// Development helper: fills a project with simulated weekly runs for the past N weeks, so
// rank history charts and week-over-week review growth have something to show before real
// data accumulates. Uses the simulated engine only.
//
// Usage: npx tsx scripts/simulate-history.ts <projectId> [weeks=8]
import { prisma } from '../src/prisma.js';
import { simulateCheck } from '../src/rank/engine.js';
import {
  checkablePinsWhere,
  entriesData,
  recomputeRun,
  refreshKeywordStats,
  refreshProjectStats,
} from '../src/services/runs.js';

const DAY_MS = 86_400_000;

async function main() {
  const [projectId, weeksArg] = process.argv.slice(2);
  const weeks = Number(weeksArg ?? 8);
  if (!projectId || !Number.isInteger(weeks) || weeks < 1) {
    throw new Error('usage: simulate-history.ts <projectId> [weeks=8]');
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { keywords: true },
  });
  if (!project) throw new Error(`Project ${projectId} not found`);
  const pins = await prisma.pin.findMany({ where: checkablePinsWhere(projectId) });
  if (pins.length === 0 || project.keywords.length === 0) {
    throw new Error('Project needs at least one enabled pin and one keyword');
  }

  const now = Date.now();
  const existingOld = await prisma.keywordRun.count({
    where: { keyword: { projectId }, date: { lt: new Date(now - DAY_MS) } },
  });
  if (existingOld > 0) {
    throw new Error(`Project already has ${existingOld} runs older than a day; not adding history.`);
  }

  for (let w = weeks; w >= 1; w--) {
    const at = new Date(now - w * 7 * DAY_MS);
    const runs = [];
    for (const keyword of project.keywords) {
      const run = await prisma.keywordRun.create({
        data: { keywordId: keyword.id, date: at, pinsTotal: pins.length, pinsChecked: 0 },
      });
      await prisma.$transaction(
        pins
          .filter(() => Math.random() > 0.02)
          .map((pin, i) => {
            const checkedAt = new Date(at.getTime() + i * 5000);
            const { rank, listings } = simulateCheck(
              {
                keyword: keyword.text,
                lat: pin.lat,
                lng: pin.lng,
                placeId: project.placeId,
                businessName: project.businessLabel,
              },
              checkedAt,
            );
            return prisma.pinRankResult.create({
              data: {
                runId: run.id,
                pinId: pin.id,
                rank,
                checkedAt,
                entries: { create: entriesData(listings) },
              },
            });
          }),
      );
      runs.push(await recomputeRun(run.id));
    }

    // That day's point on the project trends chart.
    const date = new Date(at.toISOString().slice(0, 10));
    const ranks = runs.flatMap((r) => (r.avgRank === null ? [] : [r.avgRank]));
    const vis = runs.flatMap((r) => (r.visibility === null ? [] : [r.visibility]));
    if (ranks.length && vis.length) {
      const avgRank = Math.round((ranks.reduce((a, b) => a + b, 0) / ranks.length) * 10) / 10;
      const visibility = Math.round((vis.reduce((a, b) => a + b, 0) / vis.length) * 10) / 10;
      await prisma.rankSnapshot.upsert({
        where: { projectId_date: { projectId, date } },
        create: { projectId, date, avgRank, visibility },
        update: { avgRank, visibility },
      });
    }
    console.log(`${date.toISOString().slice(0, 10)}: ${runs.length} keyword runs`);
  }

  for (const keyword of project.keywords) await refreshKeywordStats(keyword.id);
  await refreshProjectStats(projectId);
  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
