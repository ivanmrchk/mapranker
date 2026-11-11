import express from 'express';
import projectsRouter from './routes/projects.js';

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 4000;

app.use(express.json());
app.use('/api/projects', projectsRouter);
app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.listen(port, () => {
  console.log(`Map Ranker API listening on http://localhost:${port}`);
});
