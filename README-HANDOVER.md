# Maintenance Reliability App - developer handover

Stack: NestJS + Prisma 7 (PostgreSQL) API in apps/api, React + Vite + TypeScript + Tailwind web app in apps/web. npm workspaces monorepo.

## Run locally
1. Install Node 22+ and PostgreSQL 16 (docker-compose.yml provides Postgres + Redis).
2. Copy apps/api/.env.example to apps/api/.env and set DATABASE_URL / JWT_SECRET.
3. npm install            (repo root)
4. cd apps/api && npx prisma generate && npx prisma db push && npx tsx prisma/seed.ts
5. npm run dev:api        (http://localhost:3000)
6. npm run dev:web        (http://localhost:5173; set VITE_API_URL if the API is elsewhere)
Seed logins: admin@maintenance.local / password123 (also head@, supervisor@, fitter@, electrician@, operator@).

Optional realistic demo data (needs the real RPVC checklist templates imported first):
  npx tsx prisma/demo-seed.ts     (wipes transactional data - take a backup with scripts/backup-db.ts first)

## Production build
npm run build:api && npm run build:web ; API: node apps/api/dist/src/main.js ; web: apps/web/dist (static).

## Notes
- Schema changes are applied with `prisma db push` (no migration history is maintained).
- Start-Demo.bat / Stop-Demo.bat / Fix-Demo.bat + scripts/demo-launcher.ps1 are a Windows convenience for the local demo only (they use `prisma dev` local Postgres on port 51214).
- Modules: apps/api/src/* (assets, breakdowns, pm-*, predictive-*, rca, kpi, roles, users, ...). Pages: apps/web/src/pages.
