import { Router, type Response } from 'express';
import {
  Prisma,
  ProjectStatus,
  type Competitor as PrismaCompetitor,
  type Keyword as PrismaKeyword,
  type KeywordRun as PrismaKeywordRun,
  type Pin,
  type PinRankResult,
  type Project as PrismaProject,
  type RankSnapshot,
} from '@prisma/client';
import { prisma } from '../prisma.js';
import { generateGrid, geocodeAddress } from '../lib/geo.js';
import {
  RunError,
  checkSinglePin,
  checkablePinsWhere,
  refreshProjectStats,
  runAllPins,
} from '../services/runs.js';

const router = Router();

// ---------- serializers ----------

function serialize(p: PrismaProject, keywordCount: number) {
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

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

async function computeRunTrends(run: PrismaKeywordRun) {
  const previous = await prisma.keywordRun.findFirst({
    where: { keywordId: run.keywordId, date: { lt: run.date } },
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

async function serializeKeywordRun(run: PrismaKeywordRun & { results: PinRankResult[] }) {
  return {
    id: run.id,
    date: run.date.toISOString(),
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
  const enabledPins = p.pins.filter((pin) => pin.enabled);
  return {
    ...serialize(p, p.keywords.length),
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

// ---------- helpers ----------

function loadProjectDetail(id: string) {
  return prisma.project.findUnique({
    where: { id },
    include: {
      pins: { where: { deletedAt: null } },
      rankSnapshots: { orderBy: { date: 'asc' } },
      keywords: { orderBy: { createdAt: 'asc' } },
      competitors: { orderBy: { avgRank: 'asc' } },
    },
  });
}

/** Response for anything that changes a keyword's runs: the keyword plus the affected run. */
async function keywordRunResponse(keywordId: string, runId: string) {
  const [keyword, run] = await Promise.all([
    prisma.keyword.findUniqueOrThrow({ where: { id: keywordId } }),
    prisma.keywordRun.findUniqueOrThrow({ where: { id: runId }, include: { results: true } }),
  ]);
  return { keyword: serializeKeyword(keyword), run: await serializeKeywordRun(run) };
}

function isNotFound(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025';
}

function sendRunError(res: Response, err: unknown) {
  if (err instanceof RunError) {
    res.status(err.status).json({ error: err.message });
    return true;
  }
  return false;
}

function isLat(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= -90 && v <= 90;
}

function isLng(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= -180 && v <= 180;
}

function optionalString(v: unknown): v is string | undefined {
  return v === undefined || typeof v === 'string';
}

// ---------- projects ----------

router.get('/', async (_req, res) => {
  const projects = await prisma.project.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { keywords: true } } },
  });
  res.json(projects.map((p) => serialize(p, p._count.keywords)));
});

router.get('/:id', async (req, res) => {
  const project = await loadProjectDetail(req.params.id);
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
  const location = address ? await geocodeAddress(address) : null;
  const project = await prisma.project.create({
    data: {
      name,
      businessLabel,
      placeId,
      address: address || '',
      lat: location?.lat ?? null,
      lng: location?.lng ?? null,
    },
  });
  if (location) {
    await prisma.pin.createMany({
      data: generateGrid(location).map((point) => ({ projectId: project.id, ...point })),
    });
  }
  res.status(201).json(serialize(project, 0));
});

router.patch('/:id', async (req, res) => {
  const { name, businessLabel, placeId, address, status } = req.body ?? {};
  if (![name, businessLabel, placeId, address].every(optionalString)) {
    res.status(400).json({ error: 'name, businessLabel, placeId and address must be strings' });
    return;
  }
  if (name === '' || businessLabel === '' || placeId === '') {
    res.status(400).json({ error: 'name, businessLabel and placeId cannot be empty' });
    return;
  }
  if (status !== undefined && !Object.values(ProjectStatus).includes(status)) {
    res.status(400).json({ error: `status must be one of ${Object.values(ProjectStatus).join(', ')}` });
    return;
  }

  const existing = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const data: Prisma.ProjectUpdateInput = { name, businessLabel, placeId, status };
  if (address !== undefined && address.trim() !== existing.address) {
    const location = await geocodeAddress(address);
    data.address = address.trim();
    data.lat = location?.lat ?? null;
    data.lng = location?.lng ?? null;
  }
  await prisma.project.update({ where: { id: existing.id }, data });
  res.json(serializeDetail((await loadProjectDetail(existing.id))!));
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.project.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    if (isNotFound(err)) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    throw err;
  }
});

// ---------- keywords ----------

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
  } catch (err) {
    if (isNotFound(err)) {
      res.status(404).json({ error: 'Keyword not found' });
      return;
    }
    throw err;
  }
  await refreshProjectStats(req.params.id);
  res.status(204).end();
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
    prisma.pin.count({ where: checkablePinsWhere(req.params.id) }),
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
  res.json(await serializeKeywordRun(run));
});

router.post('/:id/keywords/:keywordId/run', async (req, res) => {
  try {
    const runId = await runAllPins(req.params.id, req.params.keywordId);
    res.json(await keywordRunResponse(req.params.keywordId, runId));
  } catch (err) {
    if (!sendRunError(res, err)) throw err;
  }
});

router.post('/:id/keywords/:keywordId/pins/:pinId/check', async (req, res) => {
  try {
    const runId = await checkSinglePin(req.params.id, req.params.keywordId, req.params.pinId);
    res.json(await keywordRunResponse(req.params.keywordId, runId));
  } catch (err) {
    if (!sendRunError(res, err)) throw err;
  }
});

// ---------- pins ----------

router.get('/:id/pins', async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  const pins = await prisma.pin.findMany({ where: { projectId: req.params.id, deletedAt: null } });
  res.json(pins.map(serializePin));
});

router.post('/:id/pins', async (req, res) => {
  const { lat, lng, enabled } = req.body ?? {};
  if (!isLat(lat) || !isLng(lng)) {
    res.status(400).json({ error: 'lat and lng must be valid coordinates' });
    return;
  }
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  const pin = await prisma.pin.create({
    data: { projectId: project.id, lat, lng, enabled: enabled !== false },
  });
  res.status(201).json(serializePin(pin));
});

interface PinBatch {
  create?: { tempId: string; lat: number; lng: number; enabled?: boolean }[];
  update?: { id: string; lat?: number; lng?: number; enabled?: boolean }[];
  delete?: string[];
}

function validatePinBatch(body: unknown): string | null {
  if (!body || typeof body !== 'object') return 'body must be an object';
  const b = body as Record<string, unknown>;
  for (const key of ['create', 'update', 'delete']) {
    if (b[key] !== undefined && !Array.isArray(b[key])) return `${key} must be an array`;
  }
  for (const c of (b.create as PinBatch['create']) ?? []) {
    if (typeof c?.tempId !== 'string' || !isLat(c.lat) || !isLng(c.lng)) {
      return 'each create needs tempId and valid lat/lng';
    }
  }
  for (const u of (b.update as PinBatch['update']) ?? []) {
    if (typeof u?.id !== 'string') return 'each update needs an id';
    if (u.lat !== undefined && !isLat(u.lat)) return 'invalid lat in update';
    if (u.lng !== undefined && !isLng(u.lng)) return 'invalid lng in update';
    if (u.enabled !== undefined && typeof u.enabled !== 'boolean') return 'enabled must be a boolean';
  }
  if (((b.delete as unknown[]) ?? []).some((id) => typeof id !== 'string')) {
    return 'delete must be an array of pin ids';
  }
  return null;
}

/** Saves a whole round of pin edits at once: all of it applies, or none of it does. */
router.put('/:id/pins', async (req, res) => {
  const error = validatePinBatch(req.body);
  if (error) {
    res.status(400).json({ error });
    return;
  }
  const batch = req.body as PinBatch;
  const projectId = req.params.id;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  try {
    const idMap = await prisma.$transaction(async (tx) => {
      const map: Record<string, string> = {};
      for (const c of batch.create ?? []) {
        const pin = await tx.pin.create({
          data: { projectId, lat: c.lat, lng: c.lng, enabled: c.enabled !== false },
        });
        map[c.tempId] = pin.id;
      }
      for (const u of batch.update ?? []) {
        await tx.pin.update({
          where: { id: u.id, projectId, deletedAt: null },
          data: { lat: u.lat, lng: u.lng, enabled: u.enabled },
        });
      }
      if (batch.delete?.length) {
        await tx.pin.updateMany({
          where: { id: { in: batch.delete }, projectId, deletedAt: null },
          data: { deletedAt: new Date() },
        });
      }
      return map;
    });
    const pins = await prisma.pin.findMany({ where: { projectId, deletedAt: null } });
    res.json({ pins: pins.map(serializePin), idMap });
  } catch (err) {
    if (isNotFound(err)) {
      res.status(409).json({ error: 'A pin was changed or removed elsewhere. Reload and try again.' });
      return;
    }
    throw err;
  }
});

router.patch('/:id/pins/:pinId', async (req, res) => {
  const { lat, lng, enabled } = req.body ?? {};
  if (lat !== undefined && !isLat(lat)) {
    res.status(400).json({ error: 'lat must be a valid latitude' });
    return;
  }
  if (lng !== undefined && !isLng(lng)) {
    res.status(400).json({ error: 'lng must be a valid longitude' });
    return;
  }
  if (enabled !== undefined && typeof enabled !== 'boolean') {
    res.status(400).json({ error: 'enabled must be a boolean' });
    return;
  }
  try {
    const pin = await prisma.pin.update({
      where: { id: req.params.pinId, projectId: req.params.id, deletedAt: null },
      data: { lat, lng, enabled },
    });
    res.json(serializePin(pin));
  } catch (err) {
    if (isNotFound(err)) {
      res.status(404).json({ error: 'Pin not found' });
      return;
    }
    throw err;
  }
});

/** Soft delete: the pin disappears from the map but its past results stay in run history. */
router.delete('/:id/pins/:pinId', async (req, res) => {
  try {
    await prisma.pin.update({
      where: { id: req.params.pinId, projectId: req.params.id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    res.status(204).end();
  } catch (err) {
    if (isNotFound(err)) {
      res.status(404).json({ error: 'Pin not found' });
      return;
    }
    throw err;
  }
});

export default router;
