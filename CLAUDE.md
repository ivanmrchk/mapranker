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
  lib/                    api() fetch wrapper, grid math, rank display rules
  types/project.ts        API response shapes (mirror the server serializers)
server/                 Express API (tsx in dev)
  prisma/
    schema.prisma         the schema
    migrations/           one folder per migration (the schema's history)
    seed.ts               demo project "Surge Electrical" (fictional)
  src/
    routes/projects.ts    all HTTP endpoints + serializers
    services/runs.ts      run all pins, check one pin, roll stats up to keyword/project
    services/insights.ts  pin panel data: rank history, competitors, review growth
    rank/engine.ts        RankEngine interface + simulated engine (scraper goes here)
    lib/geo.ts            pin grid generation, address lookup (OSM Nominatim)
  scripts/
    maps-spike.ts         Google Maps scraping proof of concept (Playwright)
    simulate-history.ts   backfills simulated weekly runs for a project
```

## Commands

```bash
# Postgres (host port 5433)
docker compose up -d

# API on :4001 (port 4000 is taken by the Local WordPress app on this machine)
PORT=4001 npm run dev:server

# Frontend on :5173, proxying /api to the API port
API_PORT=4001 npm run dev

# Type-check and lint (no automated test suite yet)
npx tsc -b && (cd server && npx tsc --noEmit -p .) && npx oxlint src server/src server/scripts

# Apply migrations / seed the demo project
cd server && npx prisma migrate deploy && npx tsx prisma/seed.ts

# Backfill 8 weeks of simulated runs (refuses if the project has older runs)
cd server && npx tsx scripts/simulate-history.ts <projectId> 8

# Scrape Maps results for a keyword at points (writes screenshots to SPIKE_OUT)
cd server && npx tsx scripts/maps-spike.ts "electrician" 30.2672,-97.7431
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
  remaining pins unchecked.
- A failed check leaves the pin unchecked for that run; it is never recorded
  as "not found".
- Business names and other scraped text are untrusted: render them through
  React only. Never interpolate them into Leaflet `divIcon` HTML strings or
  `dangerouslySetInnerHTML`.
- The frontend calls the API only through `api()` in `src/lib/api.ts` and
  shows failures (`ErrorBanner`); never swallow a failed request.
- The grid math exists twice (`server/src/lib/geo.ts`, `src/lib/grid.ts`);
  change both together.
- Simulated and demo data use fictional businesses only; simulated Place IDs
  start with `sim-`.
- Commits: no `Co-Authored-By: Claude` trailer or "Generated with Claude"
  line; commit as the user only.
