# Map Ranker

Local-SEO / Google Maps rank tracker. React + Vite frontend, Express + Prisma API, PostgreSQL database.

## Dev setup

1. Start Postgres:
   ```
   docker compose up -d
   ```
2. Install and set up the API server (first time only):
   ```
   cd server
   npm install
   cp .env.example .env
   npx prisma migrate dev
   ```
3. Run the API server:
   ```
   npm run dev:server
   ```
4. In another terminal, run the frontend:
   ```
   npm install
   npm run dev
   ```

Frontend runs at http://localhost:5173 and proxies `/api` requests to the Express server at http://localhost:4000.
