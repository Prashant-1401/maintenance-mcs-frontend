# Maintenance MCS — Backend Architecture & Developer Guide

## 1. Overview
The backend is a production-ready **NestJS 11** RESTful API using **Prisma 7 ORM** with **PostgreSQL 16**, asynchronous job queues with **BullMQ / Redis**, and **Passport JWT** role-based authentication.

- **Directory**: `apps/api`
- **Default Port**: `3000`
- **Database**: PostgreSQL 16 (`localhost:51214` local dev / `5432` docker)
- **Queue/Cache**: Redis 7 (`localhost:6379`)

---

## 2. Tech Stack

| Component | Technology | Description |
|---|---|---|
| **Framework** | NestJS 11 (`@nestjs/core`, `@nestjs/platform-express`) | Modular enterprise Node.js framework |
| **ORM** | Prisma 7 (`@prisma/client`, `@prisma/adapter-pg`) | Type-safe SQL ORM & migrations |
| **Database** | PostgreSQL 16 | Relational data store |
| **Auth & Security** | Passport JWT + bcryptjs | Stateless token auth & password hashing |
| **Validation** | `class-validator`, `class-transformer` | DTO validation pipes |
| **Export/Import** | `exceljs`, `pdfkit`, `multer` | Excel & PDF report generation |
| **Scheduling & Queues**| `@nestjs/schedule`, `bullmq` | Cron triggers & background workers |

---

## 3. Directory Structure

```
apps/api/
├── prisma/
│   ├── schema.prisma              # Database models, enums & relations
│   ├── seed.ts                    # Basic seed data (Users, Roles, Assets, Spares)
│   └── demo-seed.ts               # Extended realistic demo data
├── src/
│   ├── app.module.ts              # Root NestJS module
│   ├── main.ts                    # Application bootstrapper (port 3000)
│   ├── auth/                      # JWT auth, login, guards, RBAC decorator
│   ├── roles/                     # Role management & permission tiers
│   ├── users/                     # User management & passwords
│   ├── locations/                 # Plant / Line hierarchical locations
│   ├── assets/                    # Machine master & asset lifecycle
│   ├── work-orders/               # Shared work order engine (Breakdown/PM/PdM)
│   ├── breakdowns/                # Breakdown slips, symptoms & MTTR tracking
│   ├── pm-checklist-templates/    # PM question checklists
│   ├── pm-schedules/              # PM recurring triggers & work order generation
│   ├── pm-work-orders/            # Preventive maintenance completion capture
│   ├── predictive-checklist-templates/ # Condition monitoring bounds
│   ├── predictive-schedules/      # Predictive inspection intervals
│   ├── predictive-work-orders/    # Vibration, temp, acoustic readings
│   ├── spare-parts/               # Master catalog & inventory usage analytics
│   ├── pending-job-sheet/         # Shift backlog items
│   ├── deviation-notes/           # Operational variance approvals
│   ├── rca/                       # 5-Why analysis & CAPA tracking
│   ├── knowledge-bank/            # Asset manuals & SOP document store
│   ├── kpi/                       # MTTR, MTBF, PM compliance calculations
│   ├── ai-suggestions/            # Diagnostic & RCA assistance
│   └── common/                    # Excel, PDF, and file export helpers
```

---

## 4. Role-Based Access Control (RBAC)

Four tiered permission levels governed by `@Roles(...)` and `RolesGuard`:

```ts
enum PermissionTier {
  ADMIN        // Full system control, master data, imports/exports
  MANAGEMENT   // Reports, KPIs, history cards, approvals, RCA review
  TECHNICIAN   // Execute work orders, log spares, submit checklist readings
  REQUESTER    // Report breakdown slips & view status
}
```

---

## 5. Core API Endpoints

### 🔐 Authentication (`/auth`)
- `POST /auth/login` — Login with email/password; returns JWT `accessToken` & user profile.
- `GET /auth/me` — Return current authenticated user.

### 🏭 Assets & Locations (`/assets`, `/locations`)
- `GET /assets` — List machines (filterable by location, criticality, status).
- `GET /assets/:id` — Machine detail + work order history + spare parts used.
- `POST /assets` — Create asset (`ADMIN` only).
- `GET /locations` — Hierarchical tree of plants and production lines.

### 🚨 Breakdown Maintenance (`/breakdowns`)
- `GET /breakdowns` — Active breakdown slips list.
- `POST /breakdowns` — Report breakdown incident.
- `POST /breakdowns/:id/attend` — Acknowledge and assign technician.
- `POST /breakdowns/:id/close` — Complete breakdown, log downtime, spares, and labor.
- `GET /breakdowns/history` — Historical breakdown records with downtime duration.

### 📅 Preventive & Predictive Maintenance (`/pm-*`, `/predictive-*`)
- `GET /pm-schedules` — Active preventive maintenance schedules.
- `POST /pm-schedules` — Setup recurring PM schedule.
- `GET /pm-work-orders/:id` — PM work order checklist questions.
- `POST /pm-work-orders/:id/complete` — Submit pass/fail responses & spares consumed.
- `GET /predictive-work-orders/:id` — Predictive parameter entry form.
- `POST /predictive-work-orders/:id/complete` — Submit vibration/temperature readings.

### 📦 Spare Parts & Inventory Usage (`/spare-parts`)
- `GET /spare-parts` — Master catalog of spare parts.
- `POST /spare-parts` — Add new master spare part (`ADMIN` only).
- `GET /spare-parts/inventory` — **Usage Analytics**: Aggregates usage frequency (`timesUsed`), total quantity consumed (`totalQuantityUsed`), total spend (`totalCost`), breakdown/PM demand split, and itemized work order history.
- `GET /spare-parts/inventory/export` — Export inventory report to Excel (`format=xlsx`) or PDF (`format=pdf`).
- `GET /spare-parts/export` — Export master catalog.
- `POST /spare-parts/import` — Bulk import spare parts from `.xlsx`.

### 🔍 Problem Solving & Quality (`/rca`, `/deviation-notes`, `/pending-job-sheet`)
- `GET /rca` & `POST /rca` — 5-Why analysis & Fishbone problem solving.
- `GET /rca-action-items` — CAPA tracking and closure sign-offs.
- `GET /deviation-notes` & `POST /deviation-notes` — Log and approve operational variances.
- `GET /pending-job-sheet` — Shift backlog job sheet items.

### 📊 KPI & Analytics (`/kpi`)
- `GET /kpi/dashboard` — MTTR, MTBF, PM Compliance, PdM Compliance, RCA Closure Rate.

---

## 6. Environment Variables (`apps/api/.env`)

```env
DATABASE_URL="postgres://postgres:postgres@localhost:51214/template1?sslmode=disable"
REDIS_HOST="localhost"
REDIS_PORT="6379"
JWT_SECRET="dev-super-secret-key-for-maintenance-mcs-local-2026"
JWT_EXPIRES_IN="8h"
PORT="3000"
```

---

## 7. Running & Developing Locally

```bash
# 1. Install dependencies
npm install

# 2. Start local Prisma Postgres DB
cd apps/api
npx prisma dev --name=maintenance -d -P 51214

# 3. Synchronize schema & seed database
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts

# 4. Start NestJS in watch mode
npm run start:dev
# or from root: npm run dev:api
```

---

## 8. Seed Accounts

| Role | Email | Password | Tier |
|---|---|---|---|
| **Admin** | `admin@maintenance.local` | `password123` | `ADMIN` |
| **Head** | `head@maintenance.local` | `password123` | `MANAGEMENT` |
| **Supervisor**| `supervisor@maintenance.local` | `password123` | `MANAGEMENT` |
| **Fitter** | `fitter@maintenance.local` | `password123` | `TECHNICIAN` |
| **Electrician**| `electrician@maintenance.local`| `password123` | `TECHNICIAN` |
| **Operator** | `operator@maintenance.local` | `password123` | `REQUESTER` |
