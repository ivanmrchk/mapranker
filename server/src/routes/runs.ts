import { Router } from 'express';
import type { RunManager } from '../services/runManager.js';
import { keywordRunResponse, sendRunError } from './responses.js';

/** Endpoints that send checks to the rank engine. Mounted under /api/projects. */
export function createRunsRouter({ runManager }: { runManager: RunManager }) {
  const router = Router();

  /** Starts a run in the background and answers at once; poll the run for progress. */
  router.post('/:id/keywords/:keywordId/run', async (req, res) => {
    try {
      const runId = await runManager.startRun(req.params.id, req.params.keywordId);
      res.status(202).json(await keywordRunResponse(req.params.keywordId, runId));
    } catch (err) {
      if (!sendRunError(res, err)) throw err;
    }
  });

  router.post('/:id/keywords/:keywordId/runs/:runId/stop', (req, res) => {
    try {
      runManager.requestStop(req.params.runId);
      res.status(202).end();
    } catch (err) {
      if (!sendRunError(res, err)) throw err;
    }
  });

  router.post('/:id/keywords/:keywordId/pins/:pinId/check', async (req, res) => {
    try {
      const runId = await runManager.checkPin(req.params.id, req.params.keywordId, req.params.pinId);
      res.json(await keywordRunResponse(req.params.keywordId, runId));
    } catch (err) {
      if (!sendRunError(res, err)) throw err;
    }
  });

  return router;
}
