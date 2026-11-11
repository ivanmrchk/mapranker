import { Router } from 'express';
import {
  Prisma,
  type Competitor as PrismaCompetitor,
  type Keyword as PrismaKeyword,
  type KeywordRun as PrismaKeywordRun,
  type Pin,
  type Project as PrismaProject,
  type RankSnapshot,
} from '@prisma/client';
import { prisma } from '../prisma.js';

const router = Router();

function serialize(p: PrismaProject, keywordCount: number) {
  return {
    id: p.id,
    name: p.name,
    businessLabel: p.businessLabel,
    placeId: p.placeId,
    address: p.address,
    status: p.status,
    lastRun: p.lastRun ? p.lastRun.toISOString().slice(0, 10) : null,
    keywordCount,
    avgRank: p.avgRank,
    avgRankTrend: p.avgRankTrend,
    visibility: p.visibility,
    visibilityTrend: p.visibilityTrend,
  };
}

function serializeKeyword(k: PrismaKeyword) {
  return {
    id: k.id,
    text: k.text,
    avgRank: k.avgRank,
    visibility: k.visibility,
    lastRun: k.lastRun ? k.lastRun.toISOString().slice(0, 10) : null,
  };
}

function serializePin(p: Pin) {
  return {
    id: p.id,
    lat: p.lat,
    lng: p.lng,
    enabled: p.enabled,
    lastCheckedAt: p.lastCheckedAt ? p.lastCheckedAt.toISOString() : null,
  };
}

function serializeKeywordRun(
  run: PrismaKeywordRun,
  avgRankTrend: number | null,
  pinResults: { pinId: string; rank: number | null }[] = [],
) {
  return {
    id: run.id,
    date: run.date.toISOString(),
    pinsTotal: run.pinsTotal,
    pinsChecked: run.pinsChecked,
    avgRank: run.avgRank,
    avgRankTrend,
    pinResults,
  };
}

async function computeAvgRankTrend(
  keywordId: string,
  run: PrismaKeywordRun,
): Promise<number | null> {
  if (run.avgRank === null) return null;
  const previous = await prisma.keywordRun.findFirst({
    where: { keywordId, date: { lt: run.date } },
    orderBy: { date: 'desc' },
  });
  if (!previous || previous.avgRank === null) return null;
  return Math.round((run.avgRank - previous.avgRank) * 10) / 10;
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

function serializeDetail(
  p: PrismaProject & {
    pins: Pin[];
    rankSnapshots: RankSnapshot[];
    keywords: PrismaKeyword[];
    competitors: PrismaCompetitor[];
  },
) {
  return {
    ...serialize(p, p.keywords.length),
    pinsTracked: p.pins.filter((pin) => pin.lastCheckedAt !== null).length,
    pinsTotal: p.pins.length,
    rankHistory: p.rankSnapshots.map((s) => ({
      date: s.date.toISOString().slice(0, 10),
      avgRank: s.avgRank,
      visibility: s.visibility,
    })),
    keywords: p.keywords.map(serializeKeyword),
    competitors: p.competitors.map(serializeCompetitor),
  };
}

router.get('/', async (_req, res) => {
  const projects = await prisma.project.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { keywords: true } } },
  });
  res.json(projects.map((p) => serialize(p, p._count.keywords)));
});

router.get('/:id', async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
      pins: true,
      rankSnapshots: { orderBy: { date: 'asc' } },
      keywords: { orderBy: { createdAt: 'asc' } },
      competitors: { orderBy: { avgRank: 'asc' } },
    },
  });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  res.json(serializeDetail(project));
});

router.post('/', async (req, res) => {
  const { name, businessLabel, placeId, address } = req.body ?? {};
  if (!name || !businessLabel || !placeId) {
    res.status(400).json({ error: 'name, businessLabel, and placeId are required' });
    return;
  }
  const project = await prisma.project.create({
    data: { name, businessLabel, placeId, address: address || '' },
  });
  res.status(201).json(serialize(project, 0));
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.project.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    throw err;
  }
});

router.post('/:id/keywords', async (req, res) => {
  const { text } = req.body ?? {};
  if (!text) {
    res.status(400).json({ error: 'text is required' });
    return;
  }
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  const keyword = await prisma.keyword.create({ data: { projectId: project.id, text } });
  res.status(201).json(serializeKeyword(keyword));
});

router.delete('/:id/keywords/:keywordId', async (req, res) => {
  try {
    await prisma.keyword.delete({
      where: { id: req.params.keywordId, projectId: req.params.id },
    });
    res.status(204).end();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      res.status(404).json({ error: 'Keyword not found' });
      return;
    }
    throw err;
  }
});

router.get('/:id/keywords/:keywordId', async (req, res) => {
  const keyword = await prisma.keyword.findFirst({
    where: { id: req.params.keywordId, projectId: req.params.id },
  });
  if (!keyword) {
    res.status(404).json({ error: 'Keyword not found' });
    return;
  }
  const [pinsTotal, runs] = await Promise.all([
    prisma.pin.count({ where: { projectId: req.params.id } }),
    prisma.keywordRun.findMany({
      where: { keywordId: keyword.id },
      orderBy: { date: 'desc' },
      take: 30,
    }),
  ]);
  res.json({
    ...serializeKeyword(keyword),
    pinsTotal,
    runs: runs.map((r) => ({ id: r.id, date: r.date.toISOString() })),
  });
});

router.get('/:id/keywords/:keywordId/runs/:runId', async (req, res) => {
  const run = await prisma.keywordRun.findFirst({
    where: {
      id: req.params.runId,
      keywordId: req.params.keywordId,
      keyword: { projectId: req.params.id },
    },
    include: { results: true },
  });
  if (!run) {
    res.status(404).json({ error: 'Run not found' });
    return;
  }
  const avgRankTrend = await computeAvgRankTrend(run.keywordId, run);
  res.json(
    serializeKeywordRun(
      run,
      avgRankTrend,
      run.results.map((r) => ({ pinId: r.pinId, rank: r.rank })),
    ),
  );
});

router.post('/:id/keywords/:keywordId/run', async (req, res) => {
  const keyword = await prisma.keyword.findFirst({
    where: { id: req.params.keywordId, projectId: req.params.id },
  });
  if (!keyword) {
    res.status(404).json({ error: 'Keyword not found' });
    return;
  }

  // Stub: no real rank-checking engine yet, so this simulates a check of every
  // enabled pin, with a small chance per pin that the check fails outright.
  const allPins = await prisma.pin.findMany({ where: { projectId: req.params.id } });
  const checkablePins = allPins.filter((pin) => pin.enabled);
  const now = new Date();
  const results = checkablePins
    .filter(() => Math.random() > 0.05)
    .map((pin) => ({ pinId: pin.id, rank: Math.floor(Math.random() * 20) + 1 }));
  const avgRank = results.length
    ? Math.round((results.reduce((sum, r) => sum + r.rank, 0) / results.length) * 10) / 10
    : null;
  const visibility = Math.round((Math.random() * 30 + 5) * 10) / 10;

  const run = await prisma.keywordRun.create({
    data: {
      keywordId: keyword.id,
      date: now,
      pinsTotal: allPins.length,
      pinsChecked: results.length,
      avgRank,
      results: { create: results },
    },
  });

  const [updatedKeyword] = await prisma.$transaction([
    prisma.keyword.update({
      where: { id: keyword.id },
      data: { avgRank, visibility, lastRun: now },
    }),
    ...results.map((r) =>
      prisma.pin.update({ where: { id: r.pinId }, data: { lastCheckedAt: now } }),
    ),
  ]);

  const avgRankTrend = await computeAvgRankTrend(keyword.id, run);
  res.json({
    keyword: serializeKeyword(updatedKeyword),
    run: serializeKeywordRun(
      run,
      avgRankTrend,
      results.map((r) => ({ pinId: r.pinId, rank: r.rank })),
    ),
  });
});

router.get('/:id/pins', async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  const pins = await prisma.pin.findMany({ where: { projectId: req.params.id } });
  res.json(pins.map(serializePin));
});

router.post('/:id/pins', async (req, res) => {
  const { lat, lng } = req.body ?? {};
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    res.status(400).json({ error: 'lat and lng are required numbers' });
    return;
  }
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  const pin = await prisma.pin.create({ data: { projectId: project.id, lat, lng } });
  res.status(201).json(serializePin(pin));
});

router.patch('/:id/pins/:pinId', async (req, res) => {
  const { lat, lng, enabled } = req.body ?? {};
  const data: Prisma.PinUpdateInput = {};
  if (lat !== undefined) {
    if (typeof lat !== 'number') {
      res.status(400).json({ error: 'lat must be a number' });
      return;
    }
    data.lat = lat;
  }
  if (lng !== undefined) {
    if (typeof lng !== 'number') {
      res.status(400).json({ error: 'lng must be a number' });
      return;
    }
    data.lng = lng;
  }
  if (enabled !== undefined) {
    if (typeof enabled !== 'boolean') {
      res.status(400).json({ error: 'enabled must be a boolean' });
      return;
    }
    data.enabled = enabled;
  }
  try {
    const pin = await prisma.pin.update({
      where: { id: req.params.pinId, projectId: req.params.id },
      data,
    });
    res.json(serializePin(pin));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      res.status(404).json({ error: 'Pin not found' });
      return;
    }
    throw err;
  }
});

router.delete('/:id/pins/:pinId', async (req, res) => {
  try {
    await prisma.pin.delete({ where: { id: req.params.pinId, projectId: req.params.id } });
    res.status(204).end();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      res.status(404).json({ error: 'Pin not found' });
      return;
    }
    throw err;
  }
});

export default router;
