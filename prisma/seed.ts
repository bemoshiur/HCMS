/**
 * CAAB HCMS seed — 7 airports (reference figures), real approving authorities,
 * demo users for all roles, and a realistic caseload of ~55 applications whose
 * evaluation results are produced by the REAL OLS engine.
 *
 * Deterministic (seeded PRNG) so demo-reset reproduces the same data.
 * Run: pnpm db:seed
 */
import { PrismaClient, type ApplicationStatus, type Discipline, type Prisma } from "@prisma/client";
import { hash } from "bcryptjs";
import { destination } from "../lib/ols/geo";
import {
  DEFAULT_CODE34_PARAMETERS,
  ENGINE_VERSION,
  evaluate,
} from "../lib/ols/engine";
import type { OlsAirport, OlsParameters } from "../lib/ols/types";
import { addBusinessDays, slaDueDate } from "../lib/workflow";
import {
  GROUND_ELEV,
  LOCALITIES,
  SEED_AIRPORTS,
  SEED_APPLICANTS,
  SEED_AUTHORITIES,
  SEED_STRUCTURE_TYPES,
  type SeedAirport,
} from "./seed-data";

const prisma = new PrismaClient();

// ───────────────────────── deterministic PRNG ─────────────────────────
let prngState = 20260715;
function rand(): number {
  // LCG (Numerical Recipes)
  prngState = (prngState * 1664525 + 1013904223) % 4294967296;
  return prngState / 4294967296;
}
function randBetween(min: number, max: number): number {
  return min + rand() * (max - min);
}
function pick<T>(items: T[]): T {
  return items[Math.floor(rand() * items.length)];
}

const DEMO_PASSWORD = "Demo@1234";
const NOW = new Date("2026-07-15T09:00:00+06:00");

function daysAgo(days: number): Date {
  const d = new Date(NOW);
  d.setDate(d.getDate() - days);
  d.setHours(9 + Math.floor(rand() * 8), Math.floor(rand() * 60), 0, 0);
  return d;
}

// ───────────────────────── main ─────────────────────────

async function main() {
  console.log("Seeding CAAB HCMS…");

  // Clean slate (delete in dependency order)
  await prisma.$transaction([
    prisma.notification.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.caseEvent.deleteMany(),
    prisma.certificate.deleteMany(),
    prisma.obstacle.deleteMany(),
    prisma.study.deleteMany(),
    prisma.disciplineReview.deleteMany(),
    prisma.evaluationResult.deleteMany(),
    prisma.documentFile.deleteMany(),
    prisma.feeInvoice.deleteMany(),
    prisma.application.deleteMany(),
    prisma.olsParameterSet.deleteMany(),
    prisma.navaid.deleteMany(),
    prisma.threshold.deleteMany(),
    prisma.runway.deleteMany(),
    prisma.airport.deleteMany(),
    prisma.user.deleteMany(),
    prisma.organization.deleteMany(),
    prisma.structureTypeDef.deleteMany(),
    prisma.feeScheduleItem.deleteMany(),
    prisma.systemSetting.deleteMany(),
    prisma.counter.deleteMany(),
  ]);

  // ── Airports, runways, thresholds, navaids, OLS parameter sets ──
  const airportRecords: Record<string, { id: string; ols: OlsAirport }> = {};

  for (const seed of SEED_AIRPORTS) {
    const airport = await prisma.airport.create({
      data: {
        icao: seed.icao,
        iata: seed.iata || null,
        name: seed.name,
        nameBn: seed.nameBn,
        city: seed.city,
        elevationM: seed.elevationM,
        referenceLat: seed.referenceLat,
        referenceLon: seed.referenceLon,
      },
    });

    // Thresholds: ± length/2 along the true bearing from the reference point
    const half = seed.runway.lengthM / 2;
    const [lowDesig, highDesig] = seed.runway.designator.split("/");
    const thrLow = destination(
      seed.referenceLat,
      seed.referenceLon,
      seed.runway.trueBearingDeg + 180,
      half
    );
    const thrHigh = destination(
      seed.referenceLat,
      seed.referenceLon,
      seed.runway.trueBearingDeg,
      half
    );

    const runway = await prisma.runway.create({
      data: {
        airportId: airport.id,
        designator: seed.runway.designator,
        code: seed.runway.code,
        approachType: seed.runway.approachType,
        lengthM: seed.runway.lengthM,
        trueBearingDeg: seed.runway.trueBearingDeg,
      },
    });

    await prisma.threshold.createMany({
      data: [
        {
          runwayId: runway.id,
          name: lowDesig,
          lat: thrLow.lat,
          lon: thrLow.lon,
          elevationM: seed.elevationM,
          approximate: true,
        },
        {
          runwayId: runway.id,
          name: highDesig,
          lat: thrHigh.lat,
          lon: thrHigh.lon,
          elevationM: seed.elevationM,
          approximate: true,
        },
      ],
    });

    for (const nav of seed.navaids) {
      const pos = destination(seed.referenceLat, seed.referenceLon, nav.bearingDeg, nav.distanceM);
      await prisma.navaid.create({
        data: {
          airportId: airport.id,
          type: nav.type,
          name: nav.name,
          lat: pos.lat,
          lon: pos.lon,
          protectionRadiusM: nav.protectionRadiusM,
          note: nav.note,
        },
      });
    }

    const params: OlsParameters = {
      ...DEFAULT_CODE34_PARAMETERS,
      // CNS/PANS-OPS represented as configurable per-airport limits; default
      // high enough that AGA governs (officer-reviewed disciplines).
      cnsLimitAmslM: null,
      pansOpsLimitAmslM: null,
    };
    await prisma.olsParameterSet.create({
      data: {
        airportId: airport.id,
        version: 1,
        effectiveFrom: daysAgo(400),
        framework: "ANNEX14_CLASSIC",
        json: params as unknown as Prisma.InputJsonValue,
        signedOffBy: "Director (Aerodrome Standards & Safety)",
        active: true,
      },
    });

    airportRecords[seed.icao] = {
      id: airport.id,
      ols: {
        icao: seed.icao,
        name: seed.name,
        elevationM: seed.elevationM,
        referenceLat: seed.referenceLat,
        referenceLon: seed.referenceLon,
        runways: [
          {
            designator: seed.runway.designator,
            thresholds: [
              { name: lowDesig, lat: thrLow.lat, lon: thrLow.lon, elevationM: seed.elevationM },
              { name: highDesig, lat: thrHigh.lat, lon: thrHigh.lon, elevationM: seed.elevationM },
            ],
          },
        ],
      },
    };
  }
  console.log(`  ✓ ${SEED_AIRPORTS.length} airports with runways, thresholds, navaids, OLS parameters`);

  // ── Organizations ──
  const caabOrg = await prisma.organization.create({
    data: {
      type: "CAAB",
      name: "Civil Aviation Authority of Bangladesh",
      nameBn: "বাংলাদেশ বেসামরিক বিমান চলাচল কর্তৃপক্ষ",
      city: "Dhaka",
      contact: "info@caab.gov.bd",
    },
  });

  const authorityOrgs: Record<string, { id: string; name: string; city: string }> = {};
  for (const a of SEED_AUTHORITIES) {
    const org = await prisma.organization.create({
      data: {
        type: "AUTHORITY",
        name: a.name,
        nameBn: a.nameBn,
        authorityCode: a.code,
        city: a.city,
        contact: `${a.code.toLowerCase()}@${a.code.toLowerCase()}.gov.bd`,
      },
    });
    authorityOrgs[a.code] = { id: org.id, name: a.name, city: a.city };
  }

  const applicantOrgs: { id: string; name: string; kind: string; city: string }[] = [];
  for (const a of SEED_APPLICANTS) {
    const org = await prisma.organization.create({
      data: {
        type: "APPLICANT",
        name: a.name,
        tradeLicense: a.tradeLicense,
        city: a.city,
        contact: `contact@${a.name.split(" ")[0].toLowerCase().replace(/[^a-z]/g, "")}.com.bd`,
      },
    });
    applicantOrgs.push({ id: org.id, name: a.name, kind: a.kind, city: a.city });
  }
  console.log(`  ✓ ${SEED_AUTHORITIES.length + SEED_APPLICANTS.length + 1} organizations`);

  // ── Users (demo accounts §12) ──
  const passwordHash = await hash(DEMO_PASSWORD, 10);

  const applicantOrgForDemo = applicantOrgs.find((o) => o.name.startsWith("bti"))!;
  const users = await Promise.all(
    [
      { name: "Fahim Rahman", email: "applicant@demo.gov.bd", role: "APPLICANT" as const, orgId: applicantOrgForDemo.id, jurisdiction: null as string | null, phone: "+8801711000001" },
      { name: "Md. Shafiqul Islam", email: "rajuk@demo.gov.bd", role: "AUTHORITY_OFFICER" as const, orgId: authorityOrgs["RAJUK"].id, jurisdiction: "Dhaka", phone: "+8801711000002" },
      { name: "Kamrun Nahar", email: "cda@demo.gov.bd", role: "AUTHORITY_OFFICER" as const, orgId: authorityOrgs["CDA"].id, jurisdiction: "Chattogram", phone: "+8801711000003" },
      { name: "Abdul Karim", email: "rda@demo.gov.bd", role: "AUTHORITY_OFFICER" as const, orgId: authorityOrgs["RDA"].id, jurisdiction: "Rajshahi", phone: "+8801711000004" },
      { name: "Sharmin Akter", email: "intake@caab.gov.bd", role: "INTAKE_OFFICER" as const, orgId: caabOrg.id, jurisdiction: null, phone: "+8801711000005" },
      { name: "Wg Cdr (Retd.) Mahbub Alam", email: "aga@caab.gov.bd", role: "AGA_REVIEWER" as const, orgId: caabOrg.id, jurisdiction: null, phone: "+8801711000006" },
      { name: "Engr. Tanvir Hossain", email: "cns@caab.gov.bd", role: "CNS_REVIEWER" as const, orgId: caabOrg.id, jurisdiction: null, phone: "+8801711000007" },
      { name: "Capt. Nusrat Jahan", email: "pansops@caab.gov.bd", role: "PANSOPS_REVIEWER" as const, orgId: caabOrg.id, jurisdiction: null, phone: "+8801711000008" },
      { name: "Gp Capt Rashedul Hoque", email: "director@caab.gov.bd", role: "APPROVER" as const, orgId: caabOrg.id, jurisdiction: null, phone: "+8801711000009" },
      { name: "Dr. Salma Khatun", email: "study@caab.gov.bd", role: "STUDY_OFFICER" as const, orgId: caabOrg.id, jurisdiction: null, phone: "+8801711000010" },
      { name: "Mohammad Ali Siddiqui", email: "admin@caab.gov.bd", role: "ADMIN" as const, orgId: caabOrg.id, jurisdiction: null, phone: "+8801711000011" },
      { name: "Rehana Parvin", email: "auditor@caab.gov.bd", role: "AUDITOR" as const, orgId: caabOrg.id, jurisdiction: null, phone: "+8801711000012" },
    ].map((u) =>
      prisma.user.create({
        data: { ...u, passwordHash, locale: "en", active: true },
      })
    )
  );
  const userByRole = Object.fromEntries(users.map((u) => [u.role, u]));
  const authorityUsers: Record<string, (typeof users)[number]> = {
    RAJUK: users[1],
    CDA: users[2],
    RDA: users[3],
  };

  // Additional authority officers spread across cities
  const extraAuthorityUsers = await Promise.all(
    [
      { name: "Selim Reza", email: "dncc.officer@demo.gov.bd", code: "DNCC", jurisdiction: "Dhaka" },
      { name: "Farhana Yasmin", email: "sda.officer@demo.gov.bd", code: "SDA", jurisdiction: "Sylhet" },
      { name: "Jahangir Alam", email: "cxda.officer@demo.gov.bd", code: "CXDA", jurisdiction: "Cox's Bazar" },
      { name: "Mizanur Rahman", email: "jsm.officer@demo.gov.bd", code: "JSM", jurisdiction: "Jashore" },
      { name: "Nasrin Sultana", email: "pwd.officer@demo.gov.bd", code: "PWD", jurisdiction: "National" },
    ].map((u) =>
      prisma.user.create({
        data: {
          name: u.name,
          email: u.email,
          role: "AUTHORITY_OFFICER",
          orgId: authorityOrgs[u.code].id,
          jurisdiction: u.jurisdiction,
          passwordHash,
          locale: "en",
        },
      })
    )
  );
  for (const [i, code] of ["DNCC", "SDA", "CXDA", "JSM", "PWD"].entries()) {
    authorityUsers[code] = extraAuthorityUsers[i];
  }

  // A few extra applicant users tied to companies
  const applicantUsers = await Promise.all(
    [
      { name: "Tahmina Chowdhury", email: "tahmina@sheltech.demo.bd", org: "Sheltech (Pvt.) Ltd." },
      { name: "Rakibul Hasan", email: "rakib@edotco.demo.bd", org: "edotco Bangladesh Co. Ltd." },
      { name: "Arif Mahmud", email: "arif@gp.demo.bd", org: "Grameenphone Ltd." },
    ].map((u) =>
      prisma.user.create({
        data: {
          name: u.name,
          email: u.email,
          role: "APPLICANT",
          orgId: applicantOrgs.find((o) => o.name === u.org)!.id,
          passwordHash,
          locale: "en",
        },
      })
    )
  );
  console.log(`  ✓ ${users.length + extraAuthorityUsers.length + applicantUsers.length} users (password ${DEMO_PASSWORD})`);

  // ── Structure types & fee schedule ──
  await prisma.structureTypeDef.createMany({ data: SEED_STRUCTURE_TYPES });
  await prisma.feeScheduleItem.createMany({
    data: [
      { structureType: "Any", heightBandM: "0-50", amount: 5000 },
      { structureType: "Any", heightBandM: "50-150", amount: 15000 },
      { structureType: "Any", heightBandM: "150+", amount: 30000 },
    ],
  });

  await prisma.systemSetting.createMany({
    data: [
      { key: "sla.workingDays", value: { weekend: ["FRI", "SAT"], holidays: ["2026-03-26", "2026-04-14", "2026-12-16"] } },
      { key: "safeguarding.radiusKm", value: { default: 15 } },
      { key: "features.billing", value: { enabled: false } },
      { key: "certificate.validityYears", value: { years: 5 } },
      { key: "notifications.templates", value: {
        APPLICATION_SUBMITTED: { email: "Your application {ref} has been submitted.", sms: "CAAB: Application {ref} submitted." },
        CERTIFICATE_ISSUED: { email: "Height clearance {hc} has been issued.", sms: "CAAB: Certificate {hc} issued." },
      } },
    ],
  });

  // ────────────────── Applications: realistic caseload ──────────────────
  // Status plan → realistic mix (majority cleared, several objections, a few studies)
  const STATUS_PLAN: { status: ApplicationStatus; count: number; wantObjection?: boolean; outside?: boolean }[] = [
    { status: "DRAFT", count: 2 },
    { status: "SUBMITTED", count: 5 },
    { status: "ENDORSED", count: 4 },
    { status: "INTAKE_SCRUTINY", count: 5 },
    { status: "UNDER_REVIEW", count: 6 },
    { status: "UNDER_REVIEW", count: 1, wantObjection: true },
    { status: "STUDY", count: 3, wantObjection: true },
    { status: "DECISION_PENDING", count: 3 },
    { status: "DECISION_PENDING", count: 1, wantObjection: true },
    { status: "APPROVED", count: 3 },
    { status: "CERTIFICATE_ISSUED", count: 11 },
    { status: "REJECTED", count: 4, wantObjection: true },
    { status: "REJECTED", count: 1 },
    { status: "RETURNED_FOR_INFO", count: 2 },
    { status: "REVALIDATION", count: 1 },
    { status: "EXPIRED", count: 1 },
    { status: "REVOKED", count: 1 },
    { status: "SUBMITTED", count: 1, outside: true }, // far site → OUTSIDE
  ];

  // Airport rotation weighted toward Dhaka/Chattogram
  const AIRPORT_ROTATION = [
    "VGHS", "VGHS", "VGHS", "VGHS", "VGEG", "VGEG", "VGSY", "VGCB",
    "VGHS", "VGEG", "VGTJ", "VGJR", "VGRJ", "VGSY", "VGCB", "VGHS",
    "VGEG", "VGHS", "VGTJ", "VGCB", "VGSY", "VGJR", "VGRJ", "VGHS",
  ];

  const AUTHORITY_BY_CITY: Record<string, string[]> = {
    Dhaka: ["RAJUK", "DNCC", "DSCC"],
    Chattogram: ["CDA", "CCC"],
    Sylhet: ["SDA", "SCC"],
    "Cox's Bazar": ["CXDA", "CXM"],
    Jashore: ["JSM"],
    Rajshahi: ["RDA", "RCC"],
  };

  const STRUCTURE_HEIGHTS: Record<string, [number, number]> = {
    "Residential Building": [15, 45],
    "Commercial Building": [20, 60],
    "Mixed-use Building": [20, 55],
    "Telecom Tower (Greenfield)": [40, 75],
    "Telecom Tower (Rooftop)": [12, 25],
    "Industrial Chimney": [40, 65],
    "Water Tank (Overhead)": [18, 35],
    "Transmission Line Tower": [35, 55],
    "Communication Mast": [30, 60],
    "Construction Crane (Temporary)": [40, 70],
    "Silo / Storage Structure": [20, 40],
  };

  const STRUCTURE_BY_KIND: Record<string, string[]> = {
    developer: ["Residential Building", "Commercial Building", "Mixed-use Building", "Construction Crane (Temporary)"],
    telecom: ["Telecom Tower (Greenfield)", "Telecom Tower (Rooftop)", "Communication Mast"],
    industrial: ["Industrial Chimney", "Silo / Storage Structure", "Commercial Building"],
    utility: ["Transmission Line Tower", "Water Tank (Overhead)"],
    government: ["Water Tank (Overhead)", "Commercial Building"],
  };

  const applicationIds: string[] = [];
  const certificateApps: { appId: string; refNo: string; status: ApplicationStatus }[] = [];
  let rotation = 0;
  let appSeq = 0;
  const hcCounterByYear: Record<number, number> = {};
  const disciplinesFor = (icao: string): Discipline[] => {
    const precision = ["VGHS", "VGEG", "VGSY"].includes(icao);
    return precision ? ["AGA", "CNS", "PANSOPS"] : ["AGA", "CNS"];
  };

  for (const plan of STATUS_PLAN) {
    for (let i = 0; i < plan.count; i++) {
      const icao = AIRPORT_ROTATION[rotation % AIRPORT_ROTATION.length];
      rotation++;
      const seedAirport = SEED_AIRPORTS.find((a) => a.icao === icao)!;
      const airportRec = airportRecords[icao];
      const applicant = pick(applicantOrgs);
      const structureType = pick(STRUCTURE_BY_KIND[applicant.kind] ?? STRUCTURE_BY_KIND.developer);
      const authorityCity = seedAirport.city;
      const authCode = pick(AUTHORITY_BY_CITY[authorityCity] ?? ["PWD"]);
      const authority = authorityOrgs[authCode];

      // Site: bearing anywhere, distance tuned to land inside surfaces
      const bearing = rand() * 360;
      const distance = plan.outside
        ? randBetween(18000, 22000)
        : randBetween(1200, 8500);
      const site = destination(seedAirport.referenceLat, seedAirport.referenceLon, bearing, distance);
      const [gMin, gMax] = GROUND_ELEV[icao];
      const groundElev = Math.round(randBetween(gMin, gMax) * 10) / 10;

      // Probe permissible height at this site with the real engine
      const probe = evaluate(airportRec.ols, DEFAULT_CODE34_PARAMETERS, {
        lat: site.lat,
        lon: site.lon,
        groundElevationM: groundElev,
        requestedHeightAglM: 10,
      });

      const [hMin, hMax] = STRUCTURE_HEIGHTS[structureType];
      let requestedHeight: number;
      if (plan.outside || probe.status === "OUTSIDE" || probe.permissibleAglM == null) {
        requestedHeight = Math.round(randBetween(hMin, hMax));
      } else if (plan.wantObjection) {
        // exceed the permissible height by 4–20 m (still plausible for the type)
        requestedHeight = Math.max(hMin, Math.round(probe.permissibleAglM + randBetween(4, 20)));
      } else {
        // stay safely under the permissible height
        const cap = Math.max(6, Math.min(hMax, probe.permissibleAglM - randBetween(3, 12)));
        requestedHeight = Math.round(Math.max(6, Math.min(cap, hMax)));
      }

      const result = evaluate(airportRec.ols, DEFAULT_CODE34_PARAMETERS, {
        lat: site.lat,
        lon: site.lon,
        groundElevationM: groundElev,
        requestedHeightAglM: requestedHeight,
      });

      // Timeline: older cases are further through the workflow
      const ageDays =
        plan.status === "DRAFT" || plan.status === "SUBMITTED"
          ? Math.round(randBetween(1, 12))
          : plan.status === "CERTIFICATE_ISSUED" || plan.status === "REJECTED"
            ? Math.round(randBetween(30, 200))
            : plan.status === "EXPIRED" || plan.status === "REVOKED"
              ? Math.round(randBetween(250, 400))
              : Math.round(randBetween(8, 60));
      const createdAt = daysAgo(ageDays);
      appSeq++;
      const year = createdAt.getFullYear();
      const refNo = `CAAB/HC/${year}/${icao}/${String(appSeq).padStart(4, "0")}`;

      const creator =
        applicant.name === applicantOrgForDemo.name
          ? userByRole["APPLICANT"]
          : (pick(applicantUsers as { id: string }[]) as (typeof applicantUsers)[number]);

      const assignedDisciplines =
        ["UNDER_REVIEW", "STUDY", "DECISION_PENDING", "APPROVED", "CERTIFICATE_ISSUED", "REVALIDATION", "EXPIRED", "REVOKED", "REJECTED"].includes(plan.status)
          ? disciplinesFor(icao)
          : [];

      const app = await prisma.application.create({
        data: {
          refNo,
          applicantOrgId: applicant.id,
          authorityOrgId: plan.status === "DRAFT" ? null : authority.id,
          airportId: airportRec.id,
          structureType,
          siteAddress: pick(LOCALITIES[icao]),
          lat: site.lat,
          lon: site.lon,
          groundElevationM: groundElev,
          requestedHeightAglM: requestedHeight,
          requestedTopElevationAmslM: Math.round((groundElev + requestedHeight) * 100) / 100,
          status: plan.status,
          slaDueAt: slaDueDate(plan.status, createdAt.getTime() > daysAgo(10).getTime() ? createdAt : daysAgo(Math.max(1, ageDays - 20))),
          assignedDisciplines,
          assignedOfficerId: assignedDisciplines.length ? userByRole["INTAKE_OFFICER"].id : null,
          createdById: creator.id,
          submittedAt: plan.status === "DRAFT" ? null : createdAt,
          decidedAt: ["APPROVED", "REJECTED", "CERTIFICATE_ISSUED", "REVALIDATION", "EXPIRED", "REVOKED"].includes(plan.status)
            ? addBusinessDays(createdAt, 20)
            : null,
          createdAt,
        },
      });
      applicationIds.push(app.id);

      // Evaluation stored for every non-draft application
      if (plan.status !== "DRAFT") {
        await prisma.evaluationResult.create({
          data: {
            applicationId: app.id,
            governingSurface: result.governingSurface,
            ptE_amslM: result.ptE_amslM,
            permissibleAglM: result.permissibleAglM,
            penetrationM: result.penetrationM,
            status: result.status,
            surfaces: result as unknown as Prisma.InputJsonValue,
            computedAt: addBusinessDays(createdAt, 2),
            engineVersion: ENGINE_VERSION,
          },
        });
      }

      // Case events chain
      const events: { type: string; note: string; actorId?: string; internal?: boolean; offset: number }[] = [];
      events.push({ type: "CREATED", note: `Application drafted by ${applicant.name}`, actorId: creator.id, offset: 0 });
      if (plan.status !== "DRAFT") {
        events.push({ type: "SUBMITTED", note: `Submitted to ${authority.name}`, actorId: creator.id, offset: 0 });
      }
      const throughStates: ApplicationStatus[] = [
        "ENDORSED", "INTAKE_SCRUTINY", "UNDER_REVIEW", "STUDY", "DECISION_PENDING",
        "APPROVED", "CERTIFICATE_ISSUED", "REVALIDATION", "EXPIRED", "REVOKED", "REJECTED",
      ];
      const reachIndex = throughStates.indexOf(plan.status);
      const authUser = authorityUsers[authCode] ?? userByRole["AUTHORITY_OFFICER"];
      if (reachIndex >= 0 || ["RETURNED_FOR_INFO"].includes(plan.status)) {
        if (reachIndex >= throughStates.indexOf("ENDORSED") && plan.status !== "RETURNED_FOR_INFO") {
          events.push({ type: "ENDORSED", note: `Endorsed and forwarded to CAAB by ${authority.name}`, actorId: authUser?.id, offset: 2 });
        }
        if (plan.status === "RETURNED_FOR_INFO") {
          events.push({ type: "RETURNED", note: "Returned to applicant: site plan illegible, mouza map missing", actorId: userByRole["INTAKE_OFFICER"].id, offset: 3 });
        }
        if (reachIndex >= throughStates.indexOf("INTAKE_SCRUTINY")) {
          events.push({ type: "INTAKE", note: "Documents scrutinised and accepted; case assigned to disciplines", actorId: userByRole["INTAKE_OFFICER"].id, offset: 4 });
        }
        if (reachIndex >= throughStates.indexOf("UNDER_REVIEW")) {
          events.push({ type: "ASSIGNED", note: `Assigned for review: ${assignedDisciplines.join(", ")}`, actorId: userByRole["INTAKE_OFFICER"].id, internal: true, offset: 5 });
        }
        if (plan.status === "STUDY" || (plan.wantObjection && reachIndex >= throughStates.indexOf("STUDY") && reachIndex < throughStates.indexOf("REJECTED"))) {
          events.push({ type: "STUDY_REFERRED", note: "Penetration identified — referred for aeronautical study", actorId: userByRole["AGA_REVIEWER"].id, offset: 8 });
        }
        if (reachIndex >= throughStates.indexOf("DECISION_PENDING")) {
          events.push({ type: "REVIEW_COMPLETE", note: "All discipline reviews completed", actorId: userByRole["INTAKE_OFFICER"].id, internal: true, offset: 12 });
        }
        if (["APPROVED", "CERTIFICATE_ISSUED", "REVALIDATION", "EXPIRED", "REVOKED"].includes(plan.status)) {
          events.push({ type: "DECISION", note: "Approved — height clearance granted", actorId: userByRole["APPROVER"].id, offset: 16 });
        }
        if (plan.status === "REJECTED") {
          events.push({
            type: "DECISION",
            note: plan.wantObjection
              ? `Objection — proposal penetrates ${result.governingSurface ?? "the OLS"} by ${result.penetrationM?.toFixed(1) ?? "?"} m`
              : "Rejected — incomplete ownership documentation after repeated requests",
            actorId: userByRole["APPROVER"].id,
            offset: 16,
          });
        }
        if (["CERTIFICATE_ISSUED", "REVALIDATION", "EXPIRED", "REVOKED"].includes(plan.status)) {
          events.push({ type: "CERTIFICATE_ISSUED", note: "Height clearance certificate issued", actorId: userByRole["APPROVER"].id, offset: 18 });
        }
        if (plan.status === "REVOKED") {
          events.push({ type: "REVOKED", note: "Certificate revoked — as-built height exceeded the certified elevation", actorId: userByRole["ADMIN"].id, offset: 60 });
        }
      }
      for (const e of events) {
        await prisma.caseEvent.create({
          data: {
            applicationId: app.id,
            type: e.type,
            actorId: e.actorId ?? null,
            note: e.note,
            internal: e.internal ?? false,
            at: addBusinessDays(createdAt, e.offset),
          },
        });
      }

      // Discipline reviews for cases at/past review
      if (assignedDisciplines.length > 0 && reachIndex >= throughStates.indexOf("UNDER_REVIEW")) {
        const decided = reachIndex >= throughStates.indexOf("DECISION_PENDING") || plan.status === "STUDY";
        for (const d of assignedDisciplines) {
          const reviewer =
            d === "AGA" ? userByRole["AGA_REVIEWER"] : d === "CNS" ? userByRole["CNS_REVIEWER"] : userByRole["PANSOPS_REVIEWER"];
          const isAgaObjection = d === "AGA" && result.status === "OBJECTION";
          await prisma.disciplineReview.create({
            data: {
              applicationId: app.id,
              discipline: d,
              reviewerId: decided || plan.status === "UNDER_REVIEW" ? reviewer.id : null,
              verdict: decided ? (isAgaObjection && plan.status === "STUDY" ? "REFER_STUDY" : "CONFIRM") : plan.status === "UNDER_REVIEW" && d === "AGA" ? "CONFIRM" : null,
              remarks: decided
                ? isAgaObjection
                  ? `Automatic assessment confirmed: penetration of ${result.penetrationM?.toFixed(1)} m on ${result.governingSurface}`
                  : `No objection from ${d} standpoint. Assessment confirmed.`
                : null,
              decidedAt: decided ? addBusinessDays(createdAt, 10) : null,
            },
          });
        }
      }

      // Studies
      if (plan.status === "STUDY") {
        await prisma.study.create({
          data: {
            applicationId: app.id,
            type: rand() > 0.5 ? "AERONAUTICAL" : "SHIELDING",
            findings:
              "Assessment of operational impact in progress. Reviewing radar terrain clearance, circling protection and shielding by existing structures in the vicinity.",
            proposedConditions: ["Medium-intensity obstacle light (red, flashing) at top", "Aviation orange/white paint marking per ICAO Annex 14 Ch.6"],
            officerId: userByRole["STUDY_OFFICER"].id,
          },
        });
      }

      // Certificates for issued/expired/revoked/revalidation
      if (["CERTIFICATE_ISSUED", "REVALIDATION", "EXPIRED", "REVOKED"].includes(plan.status)) {
        hcCounterByYear[year] = (hcCounterByYear[year] ?? 0) + 1;
        const hcNo = `HC-${year}-${String(hcCounterByYear[year]).padStart(6, "0")}`;
        const issuedAt = addBusinessDays(createdAt, 18);
        const validYears = 5;
        const validTo = new Date(issuedAt);
        validTo.setFullYear(validTo.getFullYear() + validYears);
        if (plan.status === "EXPIRED") validTo.setFullYear(NOW.getFullYear() - 1);
        const tallStructure = requestedHeight >= 45;
        await prisma.certificate.create({
          data: {
            hcNo,
            applicationId: app.id,
            decision: "GRANTED",
            ptE_amslM: result.ptE_amslM ?? groundElev + requestedHeight + 10,
            permissibleAglM: result.permissibleAglM ?? requestedHeight + 10,
            governingSurface: result.governingSurface,
            conditions: tallStructure
              ? ["Obstacle light (low-intensity, steady red) to be installed at the top", "Structure to be painted in aviation orange and white bands", "No further vertical extension without fresh clearance"]
              : ["No further vertical extension without fresh clearance"],
            validFrom: issuedAt,
            validTo,
            qrToken: `qr-${app.id.slice(-12)}-${String(hcCounterByYear[year]).padStart(4, "0")}`,
            status: plan.status === "REVOKED" ? "REVOKED" : plan.status === "EXPIRED" ? "EXPIRED" : "ISSUED",
            signedById: userByRole["APPROVER"].id,
            issuedAt,
          },
        });
        certificateApps.push({ appId: app.id, refNo, status: plan.status });

        // Register obstacle from certified structure
        if (rand() > 0.35) {
          await prisma.obstacle.create({
            data: {
              airportId: airportRec.id,
              name: `${structureType} — ${applicant.name}`,
              lat: site.lat,
              lon: site.lon,
              topElevationAmslM: Math.round((groundElev + requestedHeight) * 100) / 100,
              heightAglM: requestedHeight,
              source: "CERTIFIED",
              structureType,
              status: plan.status === "REVOKED" ? "PENETRATING" : "COMPLIANT",
              linkedApplicationId: app.id,
              lastCheckedAt: daysAgo(Math.round(randBetween(5, 60))),
            },
          });
        }
      }

      // Documents metadata (files simulated for demo)
      if (plan.status !== "DRAFT") {
        const docTypes = ["OWNERSHIP", "SITE_PLAN", "ELEVATION_CERT", "MOUZA_MAP"] as const;
        for (const [d, docType] of docTypes.entries()) {
          if (plan.status === "RETURNED_FOR_INFO" && d >= 2) continue; // missing docs
          await prisma.documentFile.create({
            data: {
              applicationId: app.id,
              type: docType,
              filename: `${docType.toLowerCase()}_${refNo.replace(/\//g, "-")}.pdf`,
              url: `/api/documents/sample?type=${docType}`,
              sizeBytes: Math.round(randBetween(180_000, 2_400_000)),
              mimeType: "application/pdf",
              uploadedById: creator.id,
              uploadedAt: createdAt,
            },
          });
        }
      }
    }
  }
  console.log(`  ✓ ${applicationIds.length} applications with evaluations, reviews, events, documents`);

  // Counter rows aligned with issued numbers
  for (const [yearKey, value] of Object.entries(hcCounterByYear)) {
    await prisma.counter.create({ data: { key: `HC-${yearKey}`, value } });
  }
  await prisma.counter.create({ data: { key: `APP-2026-GLOBAL`, value: appSeq } });

  // ── Standalone register obstacles (survey/complaint) ──
  const vghs = airportRecords["VGHS"];
  const vgeg = airportRecords["VGEG"];
  const standaloneObstacles = [
    {
      airportId: vghs.id,
      name: "Unauthorised rooftop mast — Ashkona",
      site: destination(23.8433, 90.3978, 155, 2600),
      top: 8 + 38,
      height: 32,
      source: "COMPLAINT" as const,
      structureType: "Communication Mast",
      status: "ILLEGAL" as const,
      remarks: "Complaint received from approach controller; exceeds permissible height near approach RWY 14. Enforcement notice served.",
    },
    {
      airportId: vghs.id,
      name: "Under-monitoring crane — Uttara Sector 4",
      site: destination(23.8433, 90.3978, 300, 3100),
      top: 8 + 52,
      height: 48,
      source: "SURVEY" as const,
      structureType: "Construction Crane (Temporary)",
      status: "UNDER_MONITORING" as const,
      remarks: "Temporary crane within IHS; monitored weekly until dismantling.",
    },
    {
      airportId: vgeg.id,
      name: "Grain silo — South Halishahar",
      site: destination(22.2496, 91.8133, 330, 4200),
      top: 4 + 41,
      height: 38,
      source: "SURVEY" as const,
      structureType: "Silo / Storage Structure",
      status: "PENETRATING" as const,
      remarks: "2019 obstacle survey; penetrates conical surface by 2.3 m. Marked and lit.",
    },
    {
      airportId: vghs.id,
      name: "PGCB transmission tower — Khilkhet",
      site: destination(23.8433, 90.3978, 210, 5200),
      top: 7 + 46,
      height: 46,
      source: "CERTIFIED" as const,
      structureType: "Transmission Line Tower",
      status: "COMPLIANT" as const,
      remarks: "River-crossing tower; certified with day marking.",
    },
  ];
  for (const o of standaloneObstacles) {
    await prisma.obstacle.create({
      data: {
        airportId: o.airportId,
        name: o.name,
        lat: o.site.lat,
        lon: o.site.lon,
        topElevationAmslM: o.top,
        heightAglM: o.height,
        source: o.source,
        structureType: o.structureType,
        status: o.status,
        remarks: o.remarks,
        lastCheckedAt: daysAgo(Math.round(randBetween(2, 30))),
      },
    });
  }
  console.log(`  ✓ obstacle register (incl. 1 illegal, 1 under monitoring, 1 penetrating)`);

  // ── Notifications for demo users ──
  const demoNotifs = [
    { user: userByRole["INTAKE_OFFICER"], event: "APPLICATION_ENDORSED", title: "New endorsed application", body: "RAJUK endorsed a telecom tower application near VGHS — awaiting intake scrutiny." },
    { user: userByRole["AGA_REVIEWER"], event: "APPLICATION_ASSIGNED", title: "Case assigned for AGA review", body: "A 55 m commercial building near approach RWY 14 requires your review." },
    { user: userByRole["APPROVER"], event: "REVIEW_COMPLETED", title: "Case ready for decision", body: "All discipline reviews complete for a Sheltech application at Uttara." },
    { user: userByRole["APPLICANT"], event: "CERTIFICATE_ISSUED", title: "Certificate issued", body: "Your height clearance certificate has been issued and is ready to download." },
    { user: userByRole["STUDY_OFFICER"], event: "APPLICATION_ASSIGNED", title: "Aeronautical study referred", body: "A penetrating chimney case at Chattogram was referred for study." },
  ];
  for (const n of demoNotifs) {
    await prisma.notification.createMany({
      data: [
        { userId: n.user.id, channel: "IN_APP", event: n.event, title: n.title, body: n.body, read: false, sentAt: daysAgo(Math.round(randBetween(0, 5))) },
        { userId: n.user.id, channel: "EMAIL", event: n.event, title: n.title, body: n.body, read: true, sentAt: daysAgo(Math.round(randBetween(0, 5))) },
      ],
    });
  }

  // ── A few seed audit entries ──
  await prisma.auditLog.createMany({
    data: [
      { actorId: userByRole["ADMIN"].id, action: "masterdata.olsparams.activate", entity: "OlsParameterSet", entityId: null, after: { airport: "VGHS", version: 1, framework: "ANNEX14_CLASSIC" }, at: daysAgo(90) },
      { actorId: userByRole["ADMIN"].id, action: "user.create", entity: "User", entityId: userByRole["AUDITOR"].id, after: { email: "auditor@caab.gov.bd", role: "AUDITOR" }, at: daysAgo(120) },
      { actorId: userByRole["APPROVER"].id, action: "certificate.issue", entity: "Certificate", entityId: null, after: { hcNo: "HC-2026-000001" }, at: daysAgo(45) },
    ],
  });

  console.log("Seed complete ✔");
  console.log(`  Demo password for all accounts: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
