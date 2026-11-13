# CLAUDE.md

Map Ranker: a local, single-user Google Maps rank tracker. For each project
(a business) and keyword, it checks where the business ranks in Maps results
at every pin of a grid around it, keeps the full top 20 at each pin, and
shows rank maps, history, and competitor movement. React + Leaflet frontend,
Express + Prisma API, PostgreSQL in Docker.

Current state, decisions, and the roadmap live in @CONTEXT.md (local only,
not in git). Read it before starting work.

## Coding guidelines

- **Beautifully simple.** Modular and SOLID, but never over-abstracted:
  excessive modularity is not simple. Choose the simplest structure that
  fits the size of the problem, and refactor when it grows.
- **Readability first.** Long, descriptive names are welcome when they aid
  understanding (`checkablePinsWhere`, `reviewsGainedThisWeek`). Don't trade
  readability for cleverness; if a line needs decoding, rewrite it.
- **One responsibility per module, component, and function.** Data (fixed
  lists, config, constants) is kept apart from logic.
- **A class only when it holds state; otherwise plain functions.** Modules
  export a small public surface; helpers stay unexported.
- **Pass dependencies in** (e.g. the `RankEngine`, a clock, a random source)
  rather than reaching for module-level globals, so code can be tested and
  the engine swapped.
- **Immutable data:** `readonly` fields, `as const` arrays, string-literal
  unions for fixed vocabularies (`'Active' | 'Paused' | 'Inactive'`). Never
  pass bare booleans positionally: use an options object
  (`pinIcon(state, { selected: true, isNew: false })`), and use an object
  parameter whenever several arguments share a type.
- **Top-down reading order:** the main function or component tells the
  story; small, well-named helpers sit below it.
- **No speculative code:** no layers, options, or indexes "just in case".
- **Comments explain why**, especially when deviating from the obvious tool.
- Match the density and idiom of the surrounding code (Tailwind utility
  classes, functional React components with hooks, `async`/`await`).

## Layout

```
src/                    React frontend (Vite, Tailwind v4, react-router, react-leaflet)
  components/             pages (*Page.tsx), cards, modals, map, pin panel
  lib/                    api() fetch wrapper, grid math, rank display rules, run polling hook
  types/project.ts        API response shapes (mirror routes/responses.ts)
server/                 Express API (tsx in dev)
  prisma/
    schema.prisma         the schema
    migrations/           one folder per migration (the schema's history)
    seed.ts               demo project "Surge Electrical" (fictional)
  src/
    index.ts              composition root: picks the RankEngine, builds the RunManager
    routes/projects.ts    projects, keywords, runs (read), pins, insights endpoints
    routes/runs.ts        endpoints that use the engine: start/stop a run, check a pin
    routes/responses.ts   serializers (the API's response shapes)
    services/runManager.ts  one engine job at a time; runs pins in the background
    services/runs.ts      store results, finish runs, roll stats up to keyword/project
    services/insights.ts  pin panel data: rank history, competitors, review growth
    rank/engine.ts        RankEngine / RankSession interfaces
    rank/googleMapsEngine.ts  the Playwright scraper
    rank/simulatedEngine.ts   fake results for development (+ simulatedBusinesses.ts data)
    lib/geo.ts            pin grid generation, address lookup (OSM Nominatim)
  scripts/
    check-rank.ts         runs the Google engine at points and prints what it read
    simulate-history.ts   backfills simulated weekly runs for a project
```

## Commands

```bash
# Postgres (host port 5433)
docker compose up -d

# API on :4001 (port 4000 is taken by the Local WordPress app on this machine).
# Searches Google Maps for real; RANK_ENGINE=simulated gives fake results for
# development (use it when testing runs, so tests don't hit Google).
PORT=4001 npm run dev:server
RANK_ENGINE=simulated PORT=4001 npm run dev:server

# Frontend on :5173, proxying /api to the API port
API_PORT=4001 npm run dev

# Type-check and lint (no automated test suite yet)
npx tsc -b && (cd server && npx tsc --noEmit -p .) && npx oxlint src server/src server/scripts

# Apply migrations / seed the demo project
cd server && npx prisma migrate deploy && npx tsx prisma/seed.ts

# Backfill 8 weeks of simulated runs (refuses if the project has older runs)
cd server && npx tsx scripts/simulate-history.ts <projectId> 8

# Check that the scraper still reads Maps correctly (no database writes)
cd server && npx tsx scripts/check-rank.ts "electrician" 30.2672,-97.7431 [--place ChIJ...]
```

### Creating a migration (non-interactive shells)

`prisma migrate dev` refuses to run without a TTY. With the database up to
date, generate the SQL from the schema diff, review it, then deploy:

```bash
cd server
dir="prisma/migrations/$(date -u +%Y%m%d%H%M%S)_short_name" && mkdir -p "$dir"
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma --script > "$dir/migration.sql"
npx prisma migrate deploy && npx prisma generate
```

### Windows notes

- Stop the API before `prisma generate`: the running server locks the query
  engine DLL (`EPERM ... query_engine-windows.dll.node`). Stopping the npm
  task can leave `tsx` node processes behind; kill those too.
- Commands that only exist in `server/node_modules` (tsx, playwright) must
  run from `server/`, or `npx` will try to download them.

## Data model and metrics

- **Project** → **Pin** (grid points), **Keyword** → **KeywordRun** (one scan
  of all pins) → **PinRankResult** (one pin in one run) → **PinResultEntry**
  (the full top-20 list seen at that pin).
- `PinRankResult.rank`: a number = position; `null` = checked, but not in the
  top 20 (shown as "20+"). No result row for a pin = not checked in that run.
- **Avg rank** counts a not-found pin as 21. **Visibility** = % of checked
  pins in the top 3. Keyword stats mirror the keyword's latest run; project
  stats are the mean over keywords, with one `RankSnapshot` per day.
- "Check this pin" replaces that pin's result in the keyword's **latest** run
  and recalculates; it never creates a new history entry (unless the keyword
  has no runs yet).
- **Runs** (`KeywordRun.status`): `Running` while the `RunManager` checks pins
  in the background (the frontend polls the run), then `Completed`, or
  `Stopped` with a `stopReason` (stopped by the user, CAPTCHA, error, or a
  server restart, which marks leftover `Running` runs stopped at start-up).
  Keyword stats mirror the latest run that checked at least one pin.

## Rules

- Schema changes go in a **new** migration; never edit one that has already
  been applied.
- Queries go through the Prisma client. Raw SQL only via tagged
  `prisma.$queryRaw`/`$executeRaw` templates (bound parameters), never
  `$queryRawUnsafe` or string-built SQL.
- **Pins are never hard-deleted** (set `deletedAt`): past runs must keep
  their results. Queries for the live map filter `deletedAt: null`; counts
  for checks use `checkablePinsWhere` (live and enabled).
- Pin edits are saved through `PUT /api/projects/:id/pins` in one
  transaction, all or nothing.
- **Only a `RankEngine` talks to Google.** Every Maps request sets
  `hl=en&gl=us` (results then don't depend on the machine's IP country).
  Ads ("Sponsored") never count toward rank. Pause between requests, and stop
  a run at the first CAPTCHA (`/sorry/` page) instead of retrying; leave the
  remaining pins unchecked. Engine work goes through the `RunManager`, which
  allows one job (a run or a pin check) at a time: parallel searches from one
  IP invite CAPTCHAs.
- A failed check leaves the pin unchecked for that run; it is never recorded
  as "not found".
- Business names and other scraped text are untrusted: render them through
  React only. Never interpolate them into Leaflet `divIcon` HTML strings or
  `dangerouslySetInnerHTML`.
- The frontend calls the API only through `api()` in `src/lib/api.ts` and
  shows failures (`ErrorBanner`); never swallow a failed request.
- The grid math exists twice (`server/src/lib/geo.ts`, `src/lib/grid.ts`);
  change both together. So does the Maps search URL
  (`server/src/rank/googleMapsEngine.ts`, `src/lib/mapsUrl.ts`).
- Simulated and demo data use fictional businesses only; simulated Place IDs
  start with `sim-`.
- Commits: no `Co-Authored-By: Claude` trailer or "Generated with Claude"
  line; commit as the user only.
