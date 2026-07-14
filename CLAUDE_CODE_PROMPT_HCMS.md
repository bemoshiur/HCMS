# Claude Code Build Brief — CAAB Height Clearance Management System (HCMS)

Paste this whole file into Claude Code as the first instruction, or save it as `CLAUDE.md` at the repo root. First install the design skill (Section 5), then build in the phase order in Section 20. Do not stop after one module. Keep going until the Definition of Done in Section 21 is met. If you stall, continue through all phases.

---

## 1. Mission

Build a production-grade, multi-tenant, role-based web application for the Civil Aviation Authority of Bangladesh (CAAB) to manage aviation height clearance end to end for seven airports: public height enquiry, application intake through approving authorities, automatic Obstacle Limitation Surface (OLS) evaluation, multi-discipline officer review, aeronautical study, digital certificate issuance with QR verification, an obstacle register with monitoring, full reporting and analytics, master data management, notifications, and audit.

It must look and feel like a real enterprise government product: a polished, consistent, animated UI with realistic data operations (filter, sort, paginate, bulk actions, export), 11 distinct roles that log in to role-appropriate workspaces, and a correct, tested OLS calculation. This is a demonstration build for a tender evaluation, but the experience, workflows, RBAC and the OLS engine must be real.

---

## 2. Data policy (read first)

Populate with REAL reference data and REALISTIC sample cases. No lorem ipsum, no "Test User 1", no obviously-fake placeholders.

- Reference data must be real and accurate: the seven airports and their published figures, the real Bangladeshi approving authorities, real regulatory citations (ICAO Annex 14 / Annex 10 / Doc 8168, Civil Aviation Act 2017, CAAB Air Navigation Orders), real structure types, and the standard OLS parameters. Compile airport figures from public AIP and aeronautical sources (Section 15) and clearly mark any value as "reference figure, confirm against CAAB AIP".
- Sample cases must be realistic and believable: realistic Bangladeshi developer and telecom operator names, real neighbourhood and city locations near each airport, plausible coordinates that fall inside or near the OLS, realistic ground elevations and requested heights, canonical HC numbers and recent dates, and a realistic mix of outcomes (cleared, objection, under study). Present the seeded caseload clearly as demonstration data.
- Do not invent precise survey coordinates and present them as authoritative. Where exact threshold coordinates are not known, compute them from the airport reference point and runway bearing (Section 14) and mark them approximate.

---

## 3. Product context

CAAB issues height clearance for buildings, towers, chimneys, masts and other structures near airports, under ICAO Annex 14 obstacle control. Applications are not accepted directly from the public; they are routed through a design-approving authority (RAJUK, CDA, RDA, city corporations, PWD, development authorities, municipalities, union parishads). CAAB officers evaluate each site against three safeguarding domains and issue a permissible top elevation, which is the lowest limit across:
- AGA (Aerodrome): ICAO Annex 14 Obstacle Limitation Surfaces.
- CNS: navigation-aid protection zones (Annex 10).
- PANS-OPS: instrument flight procedure surfaces (Doc 8168).

Implement AGA (full OLS engine) as the live calculation. Represent CNS and PANS-OPS as officer-reviewed disciplines with configurable per-airport limit values, so the governing-minimum logic is real even where those two are simplified.

---

## 4. Non-negotiable quality bar

- Every screen uses the shared design system, app shell and motion system. No unstyled or placeholder pages.
- Every list is a real data table: pagination, column sort, multi-filter, search, row actions, bulk actions, CSV/Excel export.
- Every form uses validation with inline errors, disabled-until-valid submit, loading state on submit, and success/error toasts.
- Loading uses skeletons that crossfade to content; empty states have an icon, message and primary action; errors are handled gracefully.
- Motion is present and purposeful throughout (Section 6), and fully respects prefers-reduced-motion.
- Fully responsive (mobile, tablet, desktop). Keyboard accessible. WCAG 2.1 AA contrast. Touch targets at least 44px.
- Bilingual English and Bengali (bn) with a language switch; Bengali for public-facing text and the certificate at minimum.
- No secrets committed. No paid or keyed external APIs required to run. Single documented run command.

---

## 5. Install and use the UI/UX design skill

Before building UI, install and use the ui-ux-pro-max design-intelligence skill so the interface is premium and consistent.

Install in Claude Code (either method):
```
/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill
/plugin install ui-ux-pro-max@ui-ux-pro-max-skill
```
or
```
npx skills add https://github.com/nextlevelbuilder/ui-ux-pro-max-skill --skill ui-ux-pro-max
```

Then use it during the build:
- Generate a tailored design system for this product type (government dashboard / admin / data-dense enterprise) with the dials set to: variance low-to-moderate (professional and government-serious, not flashy), motion moderate-to-high (rich but tasteful), density high (dashboard, data-dense).
- Pull its palette, typography pairing, spacing scale, chart guidance and its Framer Motion patterns and UX guidelines, and apply them consistently.
- Run its UX validation pass (animation, accessibility, z-index, loading, contrast, touch targets) before delivery and fix flagged anti-patterns (hard borders, inconsistent radii, static layouts, arbitrary spacing, mixed icon styles).

If the skill cannot be installed in this environment, proceed with the same principles manually: a coherent design token system, shadcn/ui components, Framer Motion, and the motion and UX rules in Section 6.

---

## 6. Motion system (Framer Motion) — rich but government-serious

Use Framer Motion across the app. Motion must aid comprehension and feedback, never distract. Government-serious means restrained, smooth and confident, not gimmicky. Follow these rules (aligned with the ui-ux-pro-max motion guidelines):

- Respect prefers-reduced-motion: reduce or disable non-essential animation when the user requests it.
- Spring physics for interactive elements; avoid linear easing. Enter animations are gentle; exit animations are shorter (about 60-70% of enter duration) so the UI feels responsive.
- Animations are interruptible and never block input. UI stays interactive during motion.
- Route and view transitions: subtle fade with a small vertical offset. Use AnimatePresence for modals, drawers, toasts and route changes.
- Lists and tables: stagger row and card entrance by 30-50ms per item. Never all-at-once or too slow.
- Layout animations: use the layout prop for smooth reflow when items reorder, filter or expand.
- Shared-element transitions between a list row or map marker and its detail view for continuity.
- Press feedback: subtle scale (0.97-1.0) on buttons and clickable cards; restore on release.
- Skeleton to content: crossfade, not a hard swap.
- Data delight, restrained: animated count-up on KPI cards, chart series ease-in on mount, map marker drop and pulse, sidebar collapse spring, notification bell subtle pulse on new items, status badge color transitions.

Keep durations short (roughly 150-350ms). No parallax-heavy or decorative background animation on internal government screens; a single tasteful accent (for example a soft gradient header or subtle glass effect on the topbar/overlays) is acceptable, nothing more.

---

## 7. Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) + React + TypeScript (strict) |
| Styling | Tailwind CSS + shadcn/ui (Radix primitives) |
| Motion | Framer Motion (Section 6) |
| Icons | lucide-react (consistent stroke width; SVG only; no emoji for controls) |
| State / data | TanStack Query for server state; Zustand for UI state |
| Forms | React Hook Form + Zod |
| Auth | Auth.js (NextAuth) credentials provider, role-based JWT sessions |
| Database | PostgreSQL with PostGIS |
| ORM | Prisma (raw SQL / PostGIS where spatial) |
| Maps | MapLibre GL JS with a free OSM basemap (no token); OLS surfaces as GeoJSON overlays |
| Charts | Recharts (animated on mount) |
| Tables | TanStack Table |
| PDF / certificate | Server-side PDF (@react-pdf/renderer or Playwright print) with embedded QR (qrcode) |
| i18n | next-intl or a lightweight dictionary (en, bn) |
| Container | Dockerfile + docker-compose (app + postgis) |
| Tests | Vitest for the OLS engine (mandatory); Playwright smoke test (login as roles, evaluate, issue, verify) |

Production mapping note for the README: the tender proposal specifies a Django REST + GeoDjango + PostGIS backend with a Next.js frontend, Celery/Redis, and native mobile apps. This demo delivers the same domain logic and UX in a single Next.js full-stack app with a TypeScript port of the identical OLS engine, for a faster and reliably runnable evaluation build. Keep the OLS engine isolated in one framework-free module so it can be reimplemented in Python without touching the UI.

---

## 8. Project structure

```
/app
  /(public)     public site
  /(auth)       login
  /(app)        authenticated shell
    /dashboard /applications /evaluate /review /studies /certificates
    /obstacles /reports /master-data /users /audit /settings /notifications
/components
  /ui           shadcn components
  /app-shell    sidebar, topbar, breadcrumbs, command palette
  /motion       reusable Framer Motion wrappers (PageTransition, Stagger, FadeIn, Pressable, CountUp)
  /data-table   reusable table (sort/filter/paginate/export/bulk)
  /map          MapLibre wrapper + OLS layers
  /charts
/lib
  /ols          OLS ENGINE (pure, framework-free, unit-tested)
  /auth         RBAC + permission checks
  /db           prisma client + spatial helpers
  /i18n
/prisma         schema + migrations + seed
/scripts        seed, demo-reset
```

Keep `/lib/ols` free of React and DB imports so it is unit-testable and portable. Put every animation in `/components/motion` wrappers so motion is consistent and reduced-motion is handled in one place.

---

## 9. Design system

Aesthetic: modern government enterprise. Clean, dense-but-readable, trustworthy, confident. Use the ui-ux-pro-max generated system; if defining manually, use these tokens.

| Token | Intent |
|---|---|
| Primary (navy) | deep aviation navy, around #0F3557, hover #16466F |
| Accent | one professional blue for links/focus, around #1E6FB8 |
| Success | #1A7F4B (clear/approved) |
| Danger | #B3261E (objection/rejected) |
| Warning | #9A6A00 (study/conditional/pending) |
| Neutral | grey scale for text and borders |
| Surface | white cards on #EEF2F6 app background |
| Border | #DFE6EC, consistent 1px |
| Radius | 8-10px cards, 7px inputs, consistent everywhere |
| Font | ui-ux-pro-max pairing; Bengali via Noto Sans Bengali |
| Elevation | subtle only (1px border + faint shadow) |
| Icon sizes | tokens: icon-sm 16, icon-md 20/24, icon-lg 32; one stroke width per layer |

Status colour semantics are consistent everywhere: green clear/approved, red objection/rejected, amber study/conditional/pending, grey draft/outside-surfaces.

Standardize (shadcn + motion wrappers): Button, Input, Select, Combobox, DatePicker, Checkbox, Switch, Textarea, Dialog, Sheet/Drawer, Tabs, Card, Badge/StatusBadge, Table, Toast, Tooltip, Breadcrumb, Pagination, Skeleton, EmptyState, Avatar, DropdownMenu, Command palette (Cmd/Ctrl-K), Stepper (workflow), Timeline (case history), FileUpload (drag-drop), StatCard (KPI with count-up).

Every page: breadcrumb, title, primary actions top-right, then content, with loading skeletons and empty states.

---

## 10. App shell and navigation

- Collapsible left sidebar (spring collapse), grouped nav filtered by the current role's permissions.
- Topbar: global command-palette search (Cmd/Ctrl-K), language switch (EN/BN), notifications bell with animated unread count, help, user menu (profile, role, sign out).
- Breadcrumbs under the topbar; role badge near the user menu.
- Sidebar groups: Overview (Dashboard), Casework (Applications, Evaluate, Review, Studies, Certificates), Register (Obstacles, Monitoring), Insight (Reports), Configuration (Master Data, Users, Settings), Compliance (Audit). Hide groups a role cannot access.

---

## 11. Roles and RBAC

11 roles. Enforce on both UI (hide/disable) and API (authorization). Central permission matrix in `/lib/auth`.

| Role | Purpose |
|---|---|
| PUBLIC | Unauthenticated: height check, certificate verify, public register, guidelines |
| APPLICANT | Company/owner: create and track applications, upload documents, request revalidation |
| AUTHORITY_OFFICER | Approving authority (RAJUK/CDA/RDA/development authority/city corporation/PWD): endorse and forward applications in their jurisdiction |
| INTAKE_OFFICER | CAAB dealing officer: scrutinise, accept or return, assign to disciplines |
| AGA_REVIEWER | CAAB Aerodrome: review the Annex 14 OLS assessment; confirm or override with reasons |
| CNS_REVIEWER | CAAB CNS: review navaid protection assessment |
| PANSOPS_REVIEWER | CAAB PANS-OPS: review procedure assessment |
| APPROVER | CAAB Director (ATM): final decision and certificate sign-off |
| STUDY_OFFICER | Aeronautical study team: run study and shielding cases, propose conditions |
| ADMIN | System admin: users, roles, master data, airports and OLS parameters, settings |
| AUDITOR | Read-only oversight across the system and the audit trail |

Permission matrix (implement at least these capabilities; ✓ allowed):

| Capability | PUBLIC | APPLICANT | AUTHORITY | INTAKE | AGA | CNS | PANSOPS | APPROVER | STUDY | ADMIN | AUDITOR |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Public height check / verify | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create application | – | ✓ | ✓ | – | – | – | – | – | – | – | – |
| Endorse / forward | – | – | ✓ | – | – | – | – | – | – | – | – |
| Intake scrutiny / assign | – | – | – | ✓ | – | – | – | – | – | ✓ | – |
| Discipline review (own domain) | – | – | – | – | ✓ | ✓ | ✓ | – | – | – | – |
| Aeronautical / shielding study | – | – | – | – | – | – | – | – | ✓ | – | – |
| Final decision / sign | – | – | – | – | – | – | – | ✓ | – | – | – |
| Issue / revoke / revalidate certificate | – | – | – | – | – | – | – | ✓ | – | ✓ | – |
| Manage obstacle register | – | – | – | ✓ | ✓ | – | – | – | – | ✓ | – |
| Master data CRUD | – | – | – | – | – | – | – | – | – | ✓ | – |
| User / role management | – | – | – | – | – | – | – | – | – | ✓ | – |
| View reports | – | own | jurisdiction | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| View audit trail | – | – | – | – | – | – | – | – | – | ✓ | ✓ |

---

## 12. Authentication and demo accounts

- Credentials login with a polished, bilingual, animated login screen (CAAB branding).
- Show a "Demo accounts" panel with one-click sign-in buttons for every role so an evaluator can jump into any workspace instantly. Shared demo password shown.
- Seed one user per role, plus applicant companies and several approving-authority officers spread across cities.
- Session carries role, name, org and jurisdiction; each role lands on its default page.

Demo users (email : role), password Demo@1234: applicant@demo.gov.bd (APPLICANT), rajuk@demo.gov.bd, cda@demo.gov.bd, rda@demo.gov.bd (AUTHORITY_OFFICER x3), intake@caab.gov.bd (INTAKE), aga@caab.gov.bd (AGA), cns@caab.gov.bd (CNS), pansops@caab.gov.bd (PANSOPS), director@caab.gov.bd (APPROVER), study@caab.gov.bd (STUDY), admin@caab.gov.bd (ADMIN), auditor@caab.gov.bd (AUDITOR).

---

## 13. Data model (Prisma entities, key fields)

- User: id, name, email, passwordHash, role, orgId, jurisdiction, phone, locale, active.
- Organization: id, type (APPLICANT | AUTHORITY | CAAB), name, tradeLicense/BIN, authorityCode, city, contact.
- Airport: id, icao, iata, name, city, elevationM, referenceLat, referenceLon.
- Runway: id, airportId, designator, code (1-4), approachType (NON_INSTRUMENT | NON_PRECISION | PRECISION_I/II/III), lengthM, trueBearingDeg.
- Threshold: id, runwayId, name, lat, lon, elevationM, approximate (bool).
- Navaid: id, airportId, type (VOR|DME|ILS_GP|ILS_LOC|NDB), lat, lon, protectionRadiusM, note.
- OlsParameterSet: id, airportId, version, effectiveFrom, framework (ANNEX14_CLASSIC | OFS_OES), json (all surface parameters), signedOffBy, active.
- Application: id, refNo, applicantOrgId, authorityOrgId, airportId, structureType, lat, lon, groundElevationM, requestedHeightAglM, requestedTopElevationAmslM, status, slaDueAt, assignedDisciplines[], createdBy, timestamps.
- EvaluationResult: id, applicationId, governingSurface, ptE_amslM, permissibleAglM, penetrationM, status (CLEAR|OBJECTION|OUTSIDE), surfaces json, computedAt, engineVersion.
- DisciplineReview: id, applicationId, discipline (AGA|CNS|PANSOPS), reviewerId, verdict (CONFIRM|OVERRIDE|REFER_STUDY), overrideValueAmslM, remarks, decidedAt.
- Study: id, applicationId, type (AERONAUTICAL|SHIELDING), findings, proposedConditions[], outcome (PERMIT_WITH_CONDITIONS|REFUSE), officerId, decidedAt.
- Certificate: id, hcNo, applicationId, decision (GRANTED|OBJECTION), ptE_amslM, permissibleAglM, conditions[], validFrom, validTo, qrToken, status (ISSUED|REVOKED|EXPIRED|SUPERSEDED), signedBy, issuedAt.
- Obstacle: id, airportId, lat, lon, topElevationAmslM, source (CERTIFIED|SURVEY|COMPLAINT), structureType, status (COMPLIANT|PENETRATING|UNDER_MONITORING|ILLEGAL), linkedApplicationId, lastCheckedAt.
- DocumentFile: id, applicationId, type (OWNERSHIP|SITE_PLAN|ELEVATION_CERT|MOUZA_MAP|OTHER), filename, url, version, uploadedBy.
- FeeInvoice (optional, off by default): id, applicationId, amount, status, method, paidAt.
- Notification: id, userId, channel (EMAIL|SMS|IN_APP), event, title, body, read, sentAt.
- AuditLog: id, actorId, action, entity, entityId, before json, after json, ip, at.
- CaseEvent: id, applicationId, type, actorId, note, internal (bool), at (drives the case timeline).

Application workflow states: DRAFT, SUBMITTED, ENDORSED, INTAKE_SCRUTINY, UNDER_REVIEW, STUDY, DECISION_PENDING, APPROVED, REJECTED, RETURNED_FOR_INFO, CERTIFICATE_ISSUED, REVALIDATION, EXPIRED, REVOKED. Enforce legal transitions; record every transition as a CaseEvent and AuditLog; attach an SLA due date per active state.

---

## 14. Seed data — the seven airports (real reference figures)

Seed all seven. These figures are compiled from public AIP and aeronautical sources; mark them in the UI as "reference, confirm against CAAB AIP". Elevations in metres AMSL.

| ICAO | Name | City | Ref lat | Ref lon | Elev (m) | Runway | Length (m) | Code | Approach |
|---|---|---|---|---|---|---|---|---|---|
| VGHS | Hazrat Shahjalal Intl | Dhaka | 23.8433 | 90.3978 | 8 | 14/32 | 3200 | 4 | PRECISION (ILS) |
| VGTJ | Tejgaon | Dhaka | 23.7783 | 90.3828 | 7 | 18/36 | 2400 | 4 | NON_INSTRUMENT |
| VGEG | Shah Amanat Intl | Chattogram | 22.2496 | 91.8133 | 4 | 05/23 | 2940 | 4 | PRECISION (ILS) |
| VGSY | Osmani Intl | Sylhet | 24.9633 | 91.8667 | 15 | 11/29 | 3125 | 4 | PRECISION (ILS) |
| VGCB | Cox's Bazar | Cox's Bazar | 21.4522 | 91.9639 | 4 | 17/35 | 3300 | 4 | NON_PRECISION (NDB) |
| VGJR | Jashore | Jashore | 23.1838 | 89.1608 | 6 | 16/34 | 2400 | 4 | NON_PRECISION (VOR) |
| VGRJ | Shah Makhdum | Rajshahi | 24.4372 | 88.6165 | 20 | 17/35 | 1830 | 3 | NON_PRECISION (VOR/NDB) |

Threshold coordinates: for each runway compute the two thresholds from the reference point by projecting plus and minus (length/2) along the runway true bearing (approximate true bearing from the lower designator times 10 degrees, e.g. 14 gives 140, 05 gives 050, 11 gives 110). Store thresholds with approximate = true. Threshold elevation equals the aerodrome elevation unless AIP data is supplied. Add a couple of sample navaids per airport (VOR/DME/NDB/ILS as listed).

Seed a default OlsParameterSet per airport with the Code 3/4 values in Section 16, framework ANNEX14_CLASSIC, active.

Approving authorities (real) to seed as Organizations, mapped by city:
- Dhaka (VGHS, VGTJ): RAJUK, Dhaka North City Corporation, Dhaka South City Corporation
- Chattogram (VGEG): Chattogram Development Authority (CDA), Chattogram City Corporation
- Sylhet (VGSY): Sylhet Development Authority, Sylhet City Corporation
- Cox's Bazar (VGCB): Cox's Bazar Development Authority, Cox's Bazar Municipality
- Jashore (VGJR): Jashore Municipality (Pourashava)
- Rajshahi (VGRJ): Rajshahi Development Authority (RDA), Rajshahi City Corporation
- National: Public Works Department (PWD), Bangladesh Hi-Tech Park Authority

Realistic sample cases (demonstration data): seed 40-60 applications spread across all seven airports and all workflow states, using realistic Bangladeshi applicant names and real localities near each airport, with plausible coordinates inside or near the OLS, realistic ground elevations and heights, canonical HC numbers and recent dates, and a realistic outcome mix (majority cleared, several objections, a few under study). Suggested realistic applicant names to vary across records: real-estate developers such as bti, Sheltech, Navana Real Estate, Concord, Rangs Properties, Shanta Holdings, Assurance Developments, Building For Future, Edison Real Estate; telecom and tower operators such as Grameenphone, Robi Axiata, Banglalink, edotco Bangladesh, Summit Communications; plus a textile-mill chimney, a PGCB transmission line, and a city-corporation overhead water tank. Generate matching evaluation results, some discipline reviews, one or two studies, several issued certificates, and a handful of register obstacles including at least one flagged illegal. Every dashboard, queue and report must be populated on first load. Provide `scripts/demo-reset` to reseed cleanly.

---

## 15. Reference sources for airport data

Compile and cross-check the seven airports' figures from public aeronautical sources such as the CAAB AIP aerodrome pages, VATSIM Bangladesh charts, Wikipedia airport articles, and OpenAIP/OurAirports. Treat all seeded coordinates and elevations as reference values labelled for confirmation against the CAAB AIP. Do not present computed thresholds as surveyed points.

---

## 16. OLS computation engine (spec — implement exactly, config-driven)

Put this in `/lib/ols` as pure TypeScript with full unit tests. Read all numeric parameters from the active OlsParameterSet; do not hard-code them. The values below are the Code 3/4 defaults.

Coordinate handling: inputs are WGS-84 lat/lon; project to a local east/north metric frame around the airport reference point using an equirectangular approximation: x = (lon - lon0) * cos(lat0) * 111320; y = (lat - lat0) * 110540; provide the inverse. Elevations in metres AMSL.

Surfaces (Code 3/4 defaults), anchored to each runway (segment between its two thresholds):

| Surface | Rule |
|---|---|
| Inner horizontal | Elevation = aerodrome elevation + 45 m. Footprint = capsule within 4000 m of the runway segment. |
| Conical | From the inner-horizontal edge outward, slope 5%, up to +100 m above the inner horizontal. Footprint distance 4000-6000 m from the segment. Elevation = aerodrome + 45 + (d - 4000) * 0.05. |
| Approach (per runway end) | Inner edge 60 m outside the threshold, half-width 75 m, diverging 15% each side. Let s = alongOutwardDistanceFromThreshold - 60. Valid for 0 <= s <= 15000 and lateral <= 75 + 0.15*s. Elevation = thresholdElev + (s <= 3000 ? 0.025*s : 3000*0.025 + (s <= 6600 ? 0.03*(s-3000) : 0.03*3600)). |
| Take-off climb (per runway end) | Inner edge at the runway end, half-width 90 m, diverging 12.5%, slope 2%. Valid 0 <= along <= 15000 and lateral <= 90 + 0.125*along. Elevation = thresholdElev + 0.02*along. |
| Transitional | Beside the runway strip: where the point projects onto the runway length and lateral distance is 150-465 m, elevation = aerodrome + (lateral - 150) * 0.143 (rising to the inner horizontal). |

Evaluation algorithm for (lat, lon, groundElev, requestedHeightAgl):
1. Project the point; compute distance and projection parameter to each runway segment.
2. Collect every surface whose footprint contains the point (all runways, both ends), each with its elevation AMSL.
3. If none, return status OUTSIDE with the distance.
4. Governing AGA elevation = minimum surface elevation; then take the minimum with the CNS and PANS-OPS limit values from the parameter set (defaults may be null/very high so AGA governs) to get the governing PTE.
5. permissibleAgl = PTE - groundElev; requestedTop = groundElev + requestedHeightAgl; penetration = requestedTop - PTE.
6. status = penetration > 0 ? OBJECTION : CLEAR. Return PTE, permissibleAgl, penetration, governing surface name, and the full list of surfaces with a penetrated flag.

Also expose: a grid generator that samples permissible top elevation over a lat/lon grid around an airport (for the Colour-Coded Zoning Map) returning GeoJSON with a PTE property per cell; a surface-footprint GeoJSON generator (capsules, trapezoids, transitional bands) for the map; an engineVersion string; and a Vitest file asserting known cases (a site under the inner horizontal returns aerodrome+45; a far site returns OUTSIDE; a near tall structure returns OBJECTION; a site in the approach uses the sloped value). Keep surface definitions data-driven so a second framework (OFS/OES) can be added later without changing callers.

---

## 17. Modules and features

Build all of these; each must be functional.

- Public site: landing + guidelines; Height Check (airport, coordinates or map click, ground elevation, requested height) returning governing surface, PTE, permissible AGL, penetration and CLEAR/OBJECTION with OLS overlays and a coloured marker, with an indicative-use disclaimer; certificate verification (HC number or QR); public register (searchable, paginated, filters by station/date/structure type).
- Applicant portal: dashboard; multi-step new-application wizard (applicant, site with a map picker and live indicative height check, structure details, drag-drop documents with type/size validation, review, submit routed to an approving authority); application detail (status timeline, data, documents, messages, evaluation result, certificate download); revalidation request.
- Approving authority workspace: jurisdiction dashboard and queue; endorse and forward to CAAB or return to applicant with remarks.
- Case / workflow management (CAAB): applications list with rich filters (airport, status, structure type, authority, date range, SLA breach), sort, bulk assign/export; case detail with status badge, SLA countdown, workflow Stepper, tabs (Overview, Evaluation, Discipline Reviews, Study, Documents, Timeline, Certificate), internal notes vs external messages, assign/reassign, return-for-info, escalate.
- OLS evaluation (map-centric): full-screen MapLibre map with airport, runways and OLS overlays as coloured GeoJSON, a draggable site marker, and a live result panel; Colour-Coded Zoning grid overlay of pre-computed permissible top elevations, downloadable; recompute on marker move with per-surface breakdown.
- Officer discipline review console: per-discipline queues (AGA, CNS, PANS-OPS); reviewer sees the automatic assessment and confirms, overrides with a reason and value, or refers to study; when all required disciplines are decided, the case advances.
- Aeronautical study: study workspace capturing findings, shielding assessment, proposed conditions (marking, lighting) and an outcome feeding the final decision.
- Certificate management: bilingual Height Clearance letter on CAAB letterhead (canonical HC number, applicant and authority, coordinates, permissible top elevation AMSL and AGL, governing surface, conditions, validity, QR verification, signature block Director ATM) with view/print/download; objection letters for refusals with reasons and the permissible alternative; lifecycle issue/revalidate/supersede/revoke/expire; canonical sequential numbering; batch view and export.
- Obstacle register and monitoring: register (map and table) of cleared and known obstacles; monitoring to flag structures exceeding permissible height, log complaints, set status (compliant, penetrating, under monitoring, illegal), alert officers.
- Master data management (ADMIN): CRUD for airports, runways, thresholds, navaids, OLS parameter sets (versioning, effective dates, framework toggle for future OFS/OES), structure types, fee schedule, approving-authority directory; editing OLS parameters requires confirmation and is audited.
- Reporting and analytics: role-appropriate dashboards with KPI cards (applications, approvals, objections, average turnaround, SLA compliance, average permissible height) and animated charts (throughput over time, outcomes, per-airport, per-authority, structure-type mix); a penetration/application heatmap; a report builder with filters and CSV/Excel/PDF export.
- Notifications: in-app center plus email and SMS templates (SMS mocked with a visible log); triggers on submission, endorsement, assignment, decision, issuance, expiry.
- Document management: versioned, typed store per application with drag-drop upload, preview, validation, download.
- Billing / fees (optional, off by default): invoice per application with paid/unpaid/waived and a mock payment step; toggleable.
- Audit and compliance: immutable audit trail viewer (actor, action, entity, before/after diff, IP, timestamp) with filters and export; every state change and admin action logged.
- Settings: system settings (working hours and holidays for SLA, safeguarding radius default, notification templates, feature toggles) and per-user profile and locale.

---

## 18. Maps

MapLibre GL JS with an OSM raster basemap (no token). Render OLS surfaces as semi-transparent GeoJSON fills using the status palette; runway as a line; navaids as markers; site as a coloured marker (green clear, red objection, grey outside) with a drop-and-pulse motion. Click or drag to set the site; recompute live. The evaluation screen and the public height-check share the same map component and engine output.

---

## 19. Accessibility, i18n, API conventions

- WCAG 2.1 AA contrast, focus-visible rings, keyboard navigation, ARIA on interactive components, labelled fields, 44px touch targets, reduced-motion honoured.
- English and Bengali dictionaries; language switch in the topbar; certificate and public pages fully bilingual.
- Next.js route handlers or server actions with Zod-validated inputs and typed responses; enforce authorization in every mutation and query using the permission matrix; never trust the client role; consistent error shapes surfaced as toasts. The OLS engine is callable server-side (authoritative, stored on the application) and client-side (live map) from the one module.

---

## 20. Build order (phases)

1. Install the ui-ux-pro-max skill and generate the design system. Scaffold Next.js + TS + Tailwind + shadcn + Framer Motion + Prisma + PostGIS via docker-compose. App shell, tokens, base components, motion wrappers, i18n skeleton. Login + Auth.js + RBAC + demo accounts + role landing pages.
2. OLS engine in `/lib/ols` with Vitest. Map component with OLS overlays. Public height-check working end to end.
3. Data model + migrations + full seed for all seven airports and the realistic caseload. Applications list (data table) + application detail + case timeline.
4. Applicant portal (wizard, documents, tracking) and approving-authority workspace.
5. Workflow engine: transitions, SLA, intake, discipline review console, study, decision.
6. Certificate generation (bilingual PDF + QR), objection letters, lifecycle. Public verification + public register.
7. Obstacle register + monitoring. Notifications center + logs.
8. Master data management (incl. OLS parameter versioning). Reports and analytics dashboards + exports. Colour-coded zoning grid.
9. Audit trail, settings, optional billing toggle. Motion pass, accessibility pass, empty/loading states, responsive polish. Run the ui-ux-pro-max UX validation and fix anti-patterns.
10. Playwright smoke test (login as each role, run an evaluation, issue a certificate, verify it). README with run instructions, demo accounts, the OLS engine, the data-source note, and the production-stack mapping.

Do not pause between phases for confirmation; proceed through all of them.

---

## 21. Definition of Done

- A single documented command (docker compose up) brings up the app with PostGIS and a seeded database for all seven airports and the realistic caseload.
- All 11 roles log in from the demo panel and land in a populated, role-appropriate, animated workspace.
- The public height-check and internal evaluation return correct OLS results on a live map for all seven airports, matching the engine unit tests.
- An application flows from submission through endorsement, intake, multi-discipline review (and study where penetrating) to approval and a downloadable bilingual certificate whose QR verifies on the public page.
- Every list is a real data table (filter/sort/paginate/export); every form validates; every screen uses the design system and motion with loading and empty states; motion respects reduced-motion.
- Dashboards and reports are populated and export.
- Audit trail records actions; master data (including OLS parameters) is editable by ADMIN and audited.
- OLS engine unit tests and the Playwright smoke test pass.
- The ui-ux-pro-max UX validation pass is clean of the listed anti-patterns.
- README documents setup, demo accounts, the OLS engine, the real-data sourcing note, and the production-stack mapping.

Build it to feel like a real product an evaluation committee would believe is in production.
