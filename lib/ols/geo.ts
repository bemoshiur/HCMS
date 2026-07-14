/**
 * Local planar projection (§16): equirectangular approximation around the
 * airport reference point. Adequate for the ≤ 20 km safeguarding radius.
 *
 *   x = (lon − lon0) · cos(lat0) · 111320   (east, metres)
 *   y = (lat − lat0) · 110540               (north, metres)
 */

export interface XY {
  x: number;
  y: number;
}

const M_PER_DEG_LON_EQUATOR = 111320;
const M_PER_DEG_LAT = 110540;

export function makeProjector(lat0: number, lon0: number) {
  const cosLat0 = Math.cos((lat0 * Math.PI) / 180);

  function toXY(lat: number, lon: number): XY {
    return {
      x: (lon - lon0) * cosLat0 * M_PER_DEG_LON_EQUATOR,
      y: (lat - lat0) * M_PER_DEG_LAT,
    };
  }

  function toLatLon(p: XY): { lat: number; lon: number } {
    return {
      lat: lat0 + p.y / M_PER_DEG_LAT,
      lon: lon0 + p.x / (cosLat0 * M_PER_DEG_LON_EQUATOR),
    };
  }

  return { toXY, toLatLon };
}

export type Projector = ReturnType<typeof makeProjector>;

// ───────────────────────── Segment geometry ─────────────────────────

export interface SegmentFrame {
  /** distance along the segment from A (unclamped, metres) */
  along: number;
  /** signed perpendicular offset from the segment line (metres) */
  lateral: number;
  /** segment length */
  length: number;
  /** distance from the point to the closest point ON the segment */
  distToSegment: number;
}

/** Decompose point p relative to segment A→B. */
export function segmentFrame(p: XY, a: XY, b: XY): SegmentFrame {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) {
    const d = Math.hypot(p.x - a.x, p.y - a.y);
    return { along: 0, lateral: d, length: 0, distToSegment: d };
  }
  const ux = dx / length;
  const uy = dy / length;
  const px = p.x - a.x;
  const py = p.y - a.y;
  const along = px * ux + py * uy;
  const lateral = px * -uy + py * ux; // left of A→B positive
  let distToSegment: number;
  if (along < 0) distToSegment = Math.hypot(p.x - a.x, p.y - a.y);
  else if (along > length) distToSegment = Math.hypot(p.x - b.x, p.y - b.y);
  else distToSegment = Math.abs(lateral);
  return { along, lateral, length, distToSegment };
}

/** Project a distance along a bearing (degrees true) from a lat/lon. */
export function destination(
  lat: number,
  lon: number,
  bearingDeg: number,
  distanceM: number
): { lat: number; lon: number } {
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const theta = (bearingDeg * Math.PI) / 180;
  const dNorth = Math.cos(theta) * distanceM;
  const dEast = Math.sin(theta) * distanceM;
  return {
    lat: lat + dNorth / M_PER_DEG_LAT,
    lon: lon + dEast / (cosLat * M_PER_DEG_LON_EQUATOR),
  };
}
