import express from 'express';
import projectsRouter from './routes/projects.js';
import { createRunsRouter } from './routes/runs.js';
import type { RankEngine } from './rank/engine.js';
import { googleMapsEngine } from './rank/googleMapsEngine.js';
import { simulatedEngine } from './rank/simulatedEngine.js';
import { RunManager } from './services/runManager.js';
import { stopInterruptedRuns } from './services/runs.js';

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
const rankEngine = rankEngineFromEnv(process.env.RANK_ENGINE);
const runManager = new RunManager(rankEngine);

const interrupted = await stopInterruptedRuns();
if (interrupted > 0) console.log(`Marked ${interrupted} interrupted run(s) as stopped.`);

const app = express();
app.use(express.json());
app.use('/api/projects', createRunsRouter({ runManager }));
app.use('/api/projects', projectsRouter);
app.get('/api/health', (_req, res) => res.json({ ok: true, rankEngine: rankEngine.name }));

app.listen(port, () => {
  console.log(`Map Ranker API listening on http://localhost:${port} (rank engine: ${rankEngine.name})`);
});

/** Real Google Maps searches, unless RANK_ENGINE=simulated (fake results for development). */
function rankEngineFromEnv(setting: string | undefined): RankEngine {
  return setting === 'simulated' ? simulatedEngine : googleMapsEngine;
}
