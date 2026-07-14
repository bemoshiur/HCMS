import { describe, expect, it } from "vitest";
import { destination, makeProjector } from "./geo";
import {
  DEFAULT_CODE34_PARAMETERS,
  ENGINE_VERSION,
  approachRise,
  collectSurfaceHits,
  evaluate,
} from "./engine";
import { surfaceFootprints, zoningGrid } from "./geojson";
import type { OlsAirport, OlsParameters } from "./types";

/**
 * Test aerodrome modelled on VGHS (Hazrat Shahjalal Intl, Dhaka):
 * elevation 8 m AMSL, runway 14/32, 3200 m, true bearing 140°.
 * Thresholds are projected ±1600 m from the reference point along the bearing.
 */
const REF = { lat: 23.8433, lon: 90.3978 };
const ELEV = 8;
const BEARING = 140;
const HALF_LEN = 1600;

const thr14 = destination(REF.lat, REF.lon, BEARING + 180, HALF_LEN); // approach from NW
const thr32 = destination(REF.lat, REF.lon, BEARING, HALF_LEN);

const airport: OlsAirport = {
  icao: "VGHS",
  elevationM: ELEV,
  referenceLat: REF.lat,
  referenceLon: REF.lon,
  runways: [
    {
      designator: "14/32",
      thresholds: [
        { name: "14", lat: thr14.lat, lon: thr14.lon, elevationM: ELEV },
        { name: "32", lat: thr32.lat, lon: thr32.lon, elevationM: ELEV },
      ],
    },
  ],
};

const params: OlsParameters = DEFAULT_CODE34_PARAMETERS;
const EPS = 0.35; // metres — allows for the equirectangular round-trip error

describe("projection", () => {
  it("round-trips lat/lon → XY → lat/lon", () => {
    const proj = makeProjector(REF.lat, REF.lon);
    const p = proj.toXY(23.9, 90.45);
    const back = proj.toLatLon(p);
    expect(back.lat).toBeCloseTo(23.9, 6);
    expect(back.lon).toBeCloseTo(90.45, 6);
  });
});

describe("approach piecewise profile", () => {
  const sections = params.approach.sections;
  it("first 3000 m at 2.5%", () => {
    expect(approachRise(sections, 0)).toBe(0);
    expect(approachRise(sections, 1000)).toBeCloseTo(25, 6);
    expect(approachRise(sections, 3000)).toBeCloseTo(75, 6);
  });
  it("next 3600 m at 3.0%", () => {
    expect(approachRise(sections, 4000)).toBeCloseTo(75 + 30, 6);
    expect(approachRise(sections, 6600)).toBeCloseTo(75 + 108, 6);
  });
  it("horizontal to 15000 m", () => {
    expect(approachRise(sections, 10000)).toBeCloseTo(183, 6);
    expect(approachRise(sections, 15000)).toBeCloseTo(183, 6);
  });
});

describe("evaluate — §16 known cases", () => {
  it("site under the inner horizontal returns aerodrome + 45", () => {
    // 1000 m perpendicular from mid-runway: inside IH capsule, outside
    // transitional band, not beyond either end.
    const site = destination(REF.lat, REF.lon, BEARING + 90, 1000);
    const result = evaluate(airport, params, {
      lat: site.lat,
      lon: site.lon,
      groundElevationM: 5,
      requestedHeightAglM: 30,
    });
    expect(result.status).toBe("CLEAR");
    expect(result.ptE_amslM).toBeCloseTo(ELEV + 45, 6);
    expect(result.permissibleAglM).toBeCloseTo(ELEV + 45 - 5, 6);
    expect(result.governingSurface).toContain("Inner Horizontal");
    expect(result.governingDomain).toBe("AGA");
    expect(result.engineVersion).toBe(ENGINE_VERSION);
  });

  it("far site returns OUTSIDE with the distance", () => {
    const site = destination(REF.lat, REF.lon, 90, 25000);
    const result = evaluate(airport, params, {
      lat: site.lat,
      lon: site.lon,
      groundElevationM: 5,
      requestedHeightAglM: 100,
    });
    expect(result.status).toBe("OUTSIDE");
    expect(result.ptE_amslM).toBeNull();
    expect(result.surfaces).toHaveLength(0);
    expect(result.distanceToNearestRunwayM).toBeGreaterThan(20000);
  });

  it("near tall structure returns OBJECTION with penetration", () => {
    const site = destination(REF.lat, REF.lon, BEARING + 90, 1000);
    const result = evaluate(airport, params, {
      lat: site.lat,
      lon: site.lon,
      groundElevationM: 5,
      requestedHeightAglM: 60, // top 65 vs PTE 53
    });
    expect(result.status).toBe("OBJECTION");
    expect(result.penetrationM).toBeCloseTo(65 - 53, 6);
    expect(result.surfaces.some((s) => s.penetrated)).toBe(true);
  });

  it("site in the approach uses the sloped value", () => {
    // On the extended centreline 1060 m beyond THR 14 → s = 1000.
    const site = destination(thr14.lat, thr14.lon, BEARING + 180, 1060);
    const result = evaluate(airport, params, {
      lat: site.lat,
      lon: site.lon,
      groundElevationM: 6,
      requestedHeightAglM: 10,
    });
    const approach = result.surfaces.find((s) => s.kind === "APPROACH");
    expect(approach).toBeDefined();
    expect(approach!.name).toContain("RWY 14");
    // thresholdElev + 0.025 × 1000 = 8 + 25 = 33
    expect(approach!.elevationAmslM).toBeCloseTo(33, 0);
    expect(Math.abs(approach!.elevationAmslM - 33)).toBeLessThan(EPS);

    // Take-off climb from the same end is lower here (2% from the runway end)
    const toc = result.surfaces.find((s) => s.kind === "TAKEOFF_CLIMB");
    expect(toc).toBeDefined();
    expect(Math.abs(toc!.elevationAmslM - (8 + 0.02 * 1060))).toBeLessThan(EPS);
    // Governing = the lower of the two
    expect(result.ptE_amslM).toBeCloseTo(toc!.elevationAmslM, 2);
    expect(result.governingSurface).toContain("Take-off Climb");
  });

  it("approach second section at 3.0% beyond 3000 m", () => {
    const site = destination(thr14.lat, thr14.lon, BEARING + 180, 4060); // s = 4000
    const { hits } = collectSurfaceHits(airport, params, site.lat, site.lon);
    const approach = hits.find((h) => h.kind === "APPROACH");
    expect(approach).toBeDefined();
    expect(Math.abs(approach!.elevationAmslM - (8 + 105))).toBeLessThan(EPS);
  });

  it("conical surface rises at 5% beyond the inner horizontal", () => {
    const site = destination(REF.lat, REF.lon, BEARING + 90, 5000);
    const result = evaluate(airport, params, {
      lat: site.lat,
      lon: site.lon,
      groundElevationM: 5,
      requestedHeightAglM: 20,
    });
    const conical = result.surfaces.find((s) => s.kind === "CONICAL");
    expect(conical).toBeDefined();
    // aerodrome + 45 + (5000 − 4000) × 0.05 = 8 + 45 + 50 = 103
    expect(Math.abs(conical!.elevationAmslM - 103)).toBeLessThan(EPS);
    expect(result.governingSurface).toContain("Conical");
  });

  it("transitional surface governs beside the strip", () => {
    const site = destination(REF.lat, REF.lon, BEARING + 90, 300);
    const result = evaluate(airport, params, {
      lat: site.lat,
      lon: site.lon,
      groundElevationM: 5,
      requestedHeightAglM: 10,
    });
    const trans = result.surfaces.find((s) => s.kind === "TRANSITIONAL");
    expect(trans).toBeDefined();
    // aerodrome + (300 − 150) × 0.143 = 8 + 21.45 = 29.45
    expect(Math.abs(trans!.elevationAmslM - 29.45)).toBeLessThan(EPS);
    expect(result.governingSurface).toContain("Transitional");
    expect(result.ptE_amslM).toBeLessThan(ELEV + 45); // governs below the IH
  });

  it("penetration of exactly 0 is CLEAR (boundary)", () => {
    const site = destination(REF.lat, REF.lon, BEARING + 90, 1000);
    const result = evaluate(airport, params, {
      lat: site.lat,
      lon: site.lon,
      groundElevationM: 5,
      requestedHeightAglM: 48, // top = 53 = PTE exactly
    });
    expect(result.penetrationM).toBeCloseTo(0, 6);
    expect(result.status).toBe("CLEAR");
  });

  it("CNS limit governs when lower than AGA", () => {
    const cnsParams: OlsParameters = { ...params, cnsLimitAmslM: 20 };
    const site = destination(REF.lat, REF.lon, BEARING + 90, 1000);
    const result = evaluate(airport, cnsParams, {
      lat: site.lat,
      lon: site.lon,
      groundElevationM: 5,
      requestedHeightAglM: 30,
    });
    expect(result.ptE_amslM).toBe(20);
    expect(result.governingDomain).toBe("CNS");
    expect(result.agaPtE_amslM).toBeCloseTo(53, 6);
    expect(result.status).toBe("OBJECTION"); // top 35 > 20
  });

  it("PANS-OPS limit governs when lowest", () => {
    const p2: OlsParameters = { ...params, cnsLimitAmslM: 40, pansOpsLimitAmslM: 25 };
    const site = destination(REF.lat, REF.lon, BEARING + 90, 1000);
    const result = evaluate(airport, p2, {
      lat: site.lat,
      lon: site.lon,
      groundElevationM: 5,
      requestedHeightAglM: 10,
    });
    expect(result.ptE_amslM).toBe(25);
    expect(result.governingDomain).toBe("PANSOPS");
  });
});

describe("geojson generators", () => {
  it("produces all surface footprints for a runway", () => {
    const fc = surfaceFootprints(airport, params);
    const kinds = fc.features.map((f) => f.properties.kind);
    // 1 IH + 1 conical + 2 transitional + 2 approach + 2 take-off climb
    expect(fc.features).toHaveLength(8);
    expect(kinds.filter((k) => k === "APPROACH")).toHaveLength(2);
    expect(kinds.filter((k) => k === "TAKEOFF_CLIMB")).toHaveLength(2);
    expect(kinds.filter((k) => k === "TRANSITIONAL")).toHaveLength(2);
    // every ring is closed
    for (const f of fc.features) {
      for (const ring of f.geometry.coordinates) {
        expect(ring[0]).toEqual(ring[ring.length - 1]);
      }
    }
  });

  it("zoning grid samples PTE around the airport", () => {
    const grid = zoningGrid(airport, params, { cellSizeM: 2000, extentM: 8000 });
    expect(grid.features.length).toBeGreaterThan(10);
    for (const cell of grid.features) {
      expect(cell.properties.pte).not.toBeNull();
      expect(cell.properties.pte!).toBeGreaterThanOrEqual(ELEV);
    }
    // a central cell should sit at the IH elevation or below (transitional)
    const ptes = grid.features.map((f) => f.properties.pte!);
    expect(Math.min(...ptes)).toBeLessThanOrEqual(ELEV + 45);
  });
});
