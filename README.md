# CAAB Height Clearance Management System (HCMS)

A production-grade, multi-tenant, role-based web application for the **Civil Aviation Authority of Bangladesh (CAAB)** to manage aviation height clearance end to end for seven airports: public height enquiry → application intake through approving authorities → automatic **Obstacle Limitation Surface (OLS)** evaluation → multi-discipline officer review → aeronautical study → digital certificate issuance with QR verification → obstacle register and monitoring, plus reporting, master-data management, notifications and an immutable audit trail.

This is a **demonstration build for a tender evaluation**. Reference figures (airport coordinates, elevations, thresholds) are compiled from public AIP/aeronautical sources and are labelled **"reference — confirm against CAAB AIP"** throughout the UI. The seeded caseload is clearly presented as demonstration data. The experience, workflows, RBAC and the OLS engine are real.

---

## Quick start

### Option A — Docker (one command, includes PostGIS + seed)

```bash
docker compose up --build
```

This brings up **PostGIS** and the **app**, runs migrations, seeds the database (7 airports + a realistic ~55-case caseload), and serves the app at **http://localhost:3000**. First build takes a few minutes.

### Option B — Local development

Requires Node 20+, pnpm, and a PostgreSQL database (PostGIS recommended). A `docker compose up -d db` gives you one locally.

```bash
pnpm install
cp .env.example .env            # adjust DATABASE_URL if needed
pnpm prisma migrate deploy      # or: pnpm db:migrate
pnpm db:seed                    # seed 7 airports + demo caseload
pnpm dev                        # http://localhost:3000
```

**Reseed at any time** (idempotent, deterministic):

```bash
pnpm db:reset
```

---

## Demo accounts

Every role can be signed into with **one click** from the login screen's *Demo accounts* panel. Shared password for all accounts: **`Demo@1234`**

| Role | Email | Lands on |
|---|---|---|
| Applicant | `applicant@demo.gov.bd` | Applicant portal |
| Approving Authority (RAJUK) | `rajuk@demo.gov.bd` | Authority workspace |
| Approving Authority (CDA) | `cda@demo.gov.bd` | Authority workspace |
| Approving Authority (RDA) | `rda@demo.gov.bd` | Authority workspace |
| Intake Officer | `intake@caab.gov.bd` | Dashboard |
| AGA Reviewer | `aga@caab.gov.bd` | Discipline review |
| CNS Reviewer | `cns@caab.gov.bd` | Discipline review |
| PANS-OPS Reviewer | `pansops@caab.gov.bd` | Discipline review |
| Director (ATM) — Approver | `director@caab.gov.bd` | Dashboard |
| Study Officer | `study@caab.gov.bd` | Studies |
| System Administrator | `admin@caab.gov.bd` | Dashboard |
| Auditor | `auditor@caab.gov.bd` | Dashboard |

Access is enforced on **both** the UI (nav hidden, edge middleware redirects) **and** the API (every route checks the central permission matrix). Never trust the client role.

---

## The OLS engine

The Obstacle Limitation Surface calculation lives in **[`lib/ols/`](lib/ols/)** as **pure, framework-free TypeScript** with no React or database imports, so it is unit-testable and portable to a Python (GeoDjango) backend without touching the UI.

- **`engine.ts`** — ICAO Annex 14 "classic" surfaces (inner horizontal, conical, approach, take-off climb, transitional), anchored per runway. All numeric parameters are read from the airport's active `OlsParameterSet` (config-driven; Code 3/4 defaults included). The governing permissible top elevation (PTE) is the minimum across AGA (OLS) and the per-airport CNS / PANS-OPS limits.
- **`geo.ts`** — local equirectangular projection around each airport reference point, segment geometry, and bearing projection.
- **`geojson.ts`** — surface-footprint GeoJSON (capsules, rings, trapezoids, transitional bands) for the map, plus a colour-coded zoning-grid generator (sampled PTE per cell).
- **`server.ts`** — loads a DB `Airport` + active parameter set into the engine (the single authoritative path from master data into calculations).

The engine is called **server-side** (authoritative result stored on the application) and **client-side** (live map on the public height-check and the internal evaluation screen) from the one module.

**Run the tests** (16 assertions covering the §16 known cases — inner-horizontal, conical, approach slope, transitional, OUTSIDE, OBJECTION, CNS/PANS-OPS governing, GeoJSON generators):

```bash
pnpm test
```

CNS and PANS-OPS are represented as officer-reviewed disciplines with configurable per-airport limit values, so the governing-minimum logic is real even where those two domains are simplified.

---

## Data sourcing note

- **Reference data is real:** the seven airports and their published figures, real Bangladeshi approving authorities (RAJUK, CDA, RDA, city corporations, PWD, development authorities, municipalities), real regulatory citations (ICAO Annex 14 / Annex 10 / Doc 8168, Civil Aviation Act 2017, CAAB Air Navigation Orders), standard structure types, and the standard OLS parameters.
- Airport figures are **compiled from public AIP and aeronautical sources** (CAAB AIP aerodrome pages, VATSIM Bangladesh charts, Wikipedia, OpenAIP/OurAirports) and are **marked in the UI as reference values to confirm against the CAAB AIP.**
- **Runway thresholds are computed**, not surveyed: projected ± (length/2) from the aerodrome reference point along the runway true bearing, and stored with `approximate = true`. They are **not** presented as authoritative survey coordinates.
- **Sample cases are realistic demonstration data:** real developer/telecom names (bti, Sheltech, Navana, Concord, Grameenphone, Robi, edotco, Summit, PGCB, …), real localities near each airport, plausible coordinates inside/near the OLS, canonical HC numbers, recent dates, and a realistic outcome mix (majority cleared, several objections, a few under study). Every evaluation result in the seed is produced by the **real OLS engine**.

---

## Production-stack mapping

The tender proposal specifies a **Django REST + GeoDjango + PostGIS** backend with a Next.js frontend, Celery/Redis, and native mobile apps. This demo delivers the **same domain logic and UX in a single Next.js full-stack app** with a TypeScript port of the identical OLS engine, for a faster and reliably runnable evaluation build.

The OLS engine is deliberately isolated in one framework-free module (`lib/ols`) so it can be reimplemented in Python without touching the UI. Server actions / route handlers map 1:1 to the eventual Django REST endpoints; the Prisma schema maps to the Django models.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript (strict) |
| Styling | Tailwind CSS v4 + shadcn/ui (Radix primitives) |
| Motion | Framer Motion (centralised wrappers in `components/motion`) |
| State / data | TanStack Query (server state) · Zustand (UI state) |
| Forms | React Hook Form + Zod |
| Auth | Auth.js (NextAuth v5) credentials provider, role-based JWT sessions |
| Database | PostgreSQL + PostGIS · Prisma ORM |
| Maps | MapLibre GL JS + free OSM basemap (no token) · OLS surfaces as GeoJSON |
| Charts | Recharts (animated on mount) |
| Tables | TanStack Table |
| PDF | `@react-pdf/renderer` (bilingual certificate + QR) |
| i18n | Lightweight en/bn dictionary, cookie-persisted |
| Tests | Vitest (OLS engine) · Playwright (role login, evaluate, verify smoke) |

---

## Project structure

```
app/
  (public)/     landing · height-check · verify · register · guidelines
  (auth)/       login (+ demo panel)
  (app)/        authenticated shell
    dashboard applications evaluate review studies certificates
    obstacles reports master-data users audit settings notifications
    portal authority
  api/          route handlers (Zod-validated, RBAC-guarded)
components/
  ui/           shadcn components
  app-shell/    sidebar · topbar · command palette · notifications
  motion/       PageTransition · Stagger · FadeIn · Pressable · CountUp …
  data-table/   reusable table (sort/filter/paginate/export/bulk)
  map/          MapLibre wrapper + OLS layers
  shared/       StatusBadge · PageHeader · StatCard · EmptyState
lib/
  ols/          OLS ENGINE (pure, framework-free, unit-tested)
  auth/          RBAC permission matrix + guards
  workflow/     state machine + SLA policy
  db/ i18n/ certificates/ …
prisma/         schema · migration · seed (7 airports + caseload)
e2e/            Playwright smoke test
```

---

## Deployment (AWS Amplify)

The app is deployed on **AWS Amplify Hosting** (Next.js SSR / WEB_COMPUTE) with a **Neon** PostgreSQL database, at **https://hcms.ticonsys.com**.

- **`amplify.yml`** drives the build: `pnpm install` → `prisma generate` → `prisma migrate deploy` → `pnpm build`.
- Set these as Amplify environment variables (never committed): `DATABASE_URL` (Neon pooled connection string), `AUTH_SECRET` (`openssl rand -base64 32`), `AUTH_TRUST_HOST=true`.
- Seed the Neon database once after the first deploy: `DATABASE_URL="<neon-url>" pnpm db:seed`.
- The Prisma client is generated for the Lambda runtime (`binaryTargets` includes `rhel-openssl-3.0.x`).

`docker compose` remains available for a fully self-contained local/self-hosted run (the Dockerfile builds Next.js standalone output, gated behind `DOCKER_BUILD=1`).

---

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Dev server |
| `pnpm build` / `pnpm start` | Production build / serve |
| `pnpm test` | OLS engine unit tests (Vitest) |
| `pnpm test:e2e` | Playwright smoke test |
| `pnpm db:migrate` | Apply Prisma migrations (dev) |
| `pnpm db:seed` | Seed 7 airports + demo caseload |
| `pnpm db:reset` | Wipe + reseed demonstration data |
