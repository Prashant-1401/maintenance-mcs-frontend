# Maintenance Reliability MCS — Complete Project Guide

## 1. Project Overview & System Goals
**Maintenance Reliability MCS** is an enterprise-grade Computerized Maintenance Management System (CMMS) engineered for industrial manufacturing plants. It optimizes plant uptime, minimizes Mean Time to Repair (MTTR), maximizes Mean Time Between Failures (MTBF), streamlines work execution, and tracks spare parts consumption and operational knowledge in real time.

---

## 2. Technology Stack & Architecture

```
                                  ┌───────────────────────────┐
                                  │      Client Browser       │
                                  │   (Desktop, Tablet, Phone)│
                                  └─────────────┬─────────────┘
                                                │
                                                ▼  http://localhost:5173  (/*)
                                  ┌───────────────────────────┐
                                  │    apps/web (Frontend)    │
                                  │  React 19 + Vite + TS     │
                                  │  Tailwind CSS v4, Recharts│
                                  └─────────────┬─────────────┘
                                                │
                                                ▼  http://localhost:3000  (/api/*)
                                  ┌───────────────────────────┐
                                  │     apps/api (Backend)    │
                                  │   NestJS 11 + Prisma 7    │
                                  │  Passport JWT, Multer, PDF│
                                  └─────────────┬─────────────┘
                                                │
                       ┌────────────────────────┴────────────────────────┐
                       ▼                                                 ▼
        ┌─────────────────────────────┐                   ┌─────────────────────────────┐
        │   PostgreSQL 16 Database    │                   │   Redis 7 (BullMQ Engine)   │
        │   Prisma ORM (Port 51214)   │                   │   Async Queues (Port 6379)  │
        └─────────────────────────────┘                   └─────────────────────────────┘
```

---

## 3. Core Functional Modules

### 🏭 1. Machine Master & Location Hierarchy
- **Hierarchical Plant Mapping**: `Plant → Production Line → Machine / Asset`.
- **Machine Lifecycle Tracking**: Tag, name, category, criticality rating (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), and real-time status (`OPERATIONAL`, `DOWN`, `UNDER_MAINTENANCE`, `RETIRED`).
- **Machine History Card**: Single pane showing cumulative downtime, MTTR, days since last failure, attached manuals, and operating baselines.

### 🚨 2. Breakdown Maintenance Workflow
1. **Incident Logging**: Operator or supervisor reports a breakdown slip with symptom and failure category (`MECHANICAL`, `ELECTRICAL`, `UTILITY`, `INSTRUMENTATION`, `OTHER`).
2. **Attendance & Assignment**: Technician claims the ticket (`ATTENDED`), triggering downtime start tracking.
3. **Restoration & Cost Capture**: Technician completes repairs, submits action taken, logs technician hours, and captures spare parts consumed.
4. **Analysis & Heatmaps**: Breakdown heat map by shift and area + MTTR / MTBF calculations.

### 📅 3. Preventive Maintenance (PM) Engine
- **Checklist Template Builder**: Define step-by-step verification checklists per machine type.
- **Recurring Schedules**: Configurable intervals (Daily, Weekly, Monthly, Operating Hours, Meter readings).
- **Auto-Generation**: Background timer automatically creates PM work orders when lead time arrives.
- **PM Heat Map**: Visual calendar matrix tracking scheduled vs executed PM compliance.

### 🔮 4. Predictive Maintenance (PdM) Engine
- **Condition Monitoring Bounds**: Register nominal parameters with min/max safety boundaries (vibration, bearing temperature, acoustic ultrasound, current draw).
- **Readings Capture**: Technicians log measured condition values; system automatically flags abnormal out-of-spec readings.
- **PdM Compliance Heat Map**: Visual compliance tracking across plant assets.

### 🔍 5. Root Cause Analysis (RCA) & Problem Solving
- **5-Why Problem Breakdown**: Structured root cause drill-down.
- **Fishbone (Ishikawa) Categorization**: Man, Machine, Method, Material, Measurement, Milieu.
- **CAPA Action Item Tracker**: Assign corrective/preventive actions with due dates, owner assignment, and verification sign-offs.

### 📦 6. Spare Parts & Inventory Usage Analytics
- **Master Parts Catalog**: Item codes, names, units of measure, unit costs, bulk Excel import/export.
- **Usage Frequency Tracking**: Live count of how many times each spare part has been replaced (`timesUsed`).
- **Total Consumption & Spend**: Sum of units consumed and total financial expenditure.
- **Work Order History Drill-Down**: Click any spare part to view every breakdown or PM slip where it was used, machine tag, date, and technician.
- **Exporting**: One-click Excel (`.xlsx`) and PDF (`.pdf`) reports.

### 📚 7. Machine Operations Knowledge Bank
- **Machine-Linked SOPs & Manuals**: Store PDF manuals, wiring diagrams, and lubrication charts linked directly to machine tags.
- **Operational Baselines & Nominals**: Document standard running parameters (RPM, nominal temp, pressure) and safety limits.
- **Troubleshooting Playbooks**: Symptom-to-solution guides with root cause explanations, standard fix procedures, recommended spare parts, and LOTO safety precautions.

### 📋 8. Shift Operations & Governance
- **Open Orders Queue**: Central live taskboard for all pending breakdowns, PMs, and PdMs.
- **Pending Job Sheet**: Shift handoff backlog items with priority tracking.
- **Deviation Notes**: Log operational variances with formal approval workflows.

---

## 4. Role-Based Access Control (RBAC)

| Role Tier | Typical Job Titles | Key Capabilities |
|---|---|---|
| **`ADMIN`** | Plant Maintenance Head, Admin | Full system control, user/role management, machine setup, template creation, bulk import/export. |
| **`MANAGEMENT`** | Maintenance Supervisor, Shift Engineer | Approvals, RCA tracking, heatmaps, KPI reports, breakdown slip reviews. |
| **`TECHNICIAN`** | Fitter, Electrician, Instrument Tech | Attend work orders, fill PM checklists, record vibration/temp readings, log spares consumed. |
| **`REQUESTER`** | Line Operator, Production Staff | Report new breakdown slips and check machine status. |

---

## 5. Local Setup & Execution Guide

### Prerequisites
- **Node.js**: v22.0.0 or higher
- **PostgreSQL**: v16 (via Prisma Dev local DB or Docker)
- **Redis** (optional for local dev; required for production queues)

### 1. Installation
```bash
# Clone and install monorepo dependencies
git clone <REPO_URL>
cd Maintenance-MCS-source
npm install
```

### 2. Environment Configuration
Create `apps/api/.env` with the following:
```env
DATABASE_URL="postgres://postgres:postgres@localhost:51214/template1?sslmode=disable"
REDIS_HOST="localhost"
REDIS_PORT="6379"
JWT_SECRET="dev-super-secret-key-for-maintenance-mcs-local-2026"
JWT_EXPIRES_IN="8h"
PORT="3000"
```

### 3. Start Database & Seed Data
```bash
# Terminal 1: Start local Prisma Postgres server
cd apps/api
npx prisma dev --name=maintenance -d -P 51214

# Sync schema and populate seed data
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts
```

### 4. Start Application Servers

**Terminal 1 — Backend API (Port 3000):**
```bash
npm run dev:api
```

**Terminal 2 — Frontend Web (Port 5173):**
```bash
npm run dev:web
```

---

## 6. Seed User Credentials

| Persona | Email | Password | Tier |
|---|---|---|---|
| **Admin** | `admin@maintenance.local` | `password123` | `ADMIN` |
| **Maintenance Head** | `head@maintenance.local` | `password123` | `MANAGEMENT` |
| **Supervisor** | `supervisor@maintenance.local` | `password123` | `MANAGEMENT` |
| **Mechanical Fitter**| `fitter@maintenance.local` | `password123` | `TECHNICIAN` |
| **Electrician** | `electrician@maintenance.local`| `password123` | `TECHNICIAN` |
| **Line Operator** | `operator@maintenance.local` | `password123` | `REQUESTER` |

---

## 7. Deployment & Hosting (Vercel Multi-Service)

The repository is configured for multi-service deployment using [`vercel.json`](file:///home/prashant/Projects/Maintenance-MCS-source/vercel.json):

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "services": {
    "api": {
      "root": "apps/api",
      "framework": "nestjs"
    },
    "web": {
      "root": "apps/web",
      "framework": "vite"
    }
  },
  "rewrites": [
    { "source": "/api/(.*)", "destination": { "service": "api" } },
    { "source": "/(.*)", "destination": { "service": "web" } }
  ]
}
```

### Production Build Verification
```bash
# Build both backend and frontend
npm run build:api
npm run build:web
```

### Pushing to GitHub
```bash
git add .
git commit -m "Update project documentation and deploy configuration"
git push -u origin main
```

---

## 8. Directory Structure Overview

```
Maintenance-MCS-source/
├── apps/
│   ├── api/                          # NestJS 11 Backend
│   │   ├── prisma/
│   │   │   ├── schema.prisma         # Database schema & relations
│   │   │   ├── seed.ts               # Core database seeder
│   │   │   └── demo-seed.ts          # Extended dataset seeder
│   │   └── src/
│   │       ├── assets/               # Machine registry & asset detail
│   │       ├── auth/                 # JWT login, guards & decorators
│   │       ├── breakdowns/           # Breakdown slips & MTTR
│   │       ├── deviation-notes/      # Variance logging & approvals
│   │       ├── knowledge-bank/       # SOPs, Baselines & Playbooks
│   │       ├── kpi/                  # MTTR, MTBF, compliance calculations
│   │       ├── locations/            # Plant & line hierarchy
│   │       ├── pending-job-sheet/    # Shift backlog items
│   │       ├── pm-schedules/         # PM scheduling engine
│   │       ├── pm-work-orders/       # PM execution & checklists
│   │       ├── predictive-schedules/ # PdM intervals & readings
│   │       ├── rca/                  # 5-Why analysis & CAPA tracking
│   │       ├── roles/                # Role tiers & capacity planning
│   │       ├── spare-parts/          # Catalog & Inventory usage analytics
│   │       └── users/                # User management
│   └── web/                          # React 19 + Vite Frontend
│       └── src/
│           ├── components/           # Charcoal Layout, Toolbar, Status Badges
│           ├── lib/                  # Axios API client, types & role utilities
│           └── pages/                # All 25+ plant management application pages
├── BACKEND.md                        # Dedicated backend developer reference
├── vercel.json                       # Multi-service cloud routing configuration
└── PROJECT-GUIDE.md                  # Master project guide
```
