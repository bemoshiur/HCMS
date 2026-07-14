"use client";

/**
 * Shared OLS map (§18): MapLibre GL + free OSM raster basemap (no token).
 * Layers: OLS surface footprints (semi-transparent fills using status palette),
 * runway centreline, navaid markers, zoning grid, and a draggable site marker
 * with drop-and-pulse motion. Used by the public height-check AND the internal
 * evaluation screen — one component, one engine output.
 */
import * as React from "react";
import maplibregl, {
  Map as MapLibreMap,
  Marker,
  type ExpressionSpecification,
} from "maplibre-gl";
import type * as GeoJSON from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";

export type SiteStatus = "CLEAR" | "OBJECTION" | "OUTSIDE" | "NONE";

export interface OlsMapProps {
  center: [number, number]; // [lon, lat]
  zoom?: number;
  /** GeoJSON FeatureCollection of OLS surface footprints. */
  surfaces?: GeoJSON.FeatureCollection | null;
  /** GeoJSON FeatureCollection LineString runways. */
  runways?: GeoJSON.FeatureCollection | null;
  /** Navaid markers. */
  navaids?: Array<{ lat: number; lon: number; type: string; name?: string | null }>;
  /** Zoning grid (colour-coded PTE cells). */
  zoningGrid?: GeoJSON.FeatureCollection | null;
  showZoning?: boolean;
  /** Site marker position; null hides the marker. */
  site?: { lat: number; lon: number } | null;
  siteStatus?: SiteStatus;
  siteDraggable?: boolean;
  onSiteChange?: (pos: { lat: number; lon: number }) => void;
  onMapClick?: (pos: { lat: number; lon: number }) => void;
  /** Additional obstacle markers (register view). */
  obstacles?: Array<{ lat: number; lon: number; status: string; label?: string }>;
  className?: string;
  interactive?: boolean;
}

const SURFACE_COLORS: Record<string, string> = {
  INNER_HORIZONTAL: "#1e6fb8",
  CONICAL: "#7c3aed",
  APPROACH: "#b3261e",
  TAKEOFF_CLIMB: "#9a6a00",
  TRANSITIONAL: "#1a7f4b",
};

const SITE_COLORS: Record<SiteStatus, string> = {
  CLEAR: "#1a7f4b",
  OBJECTION: "#b3261e",
  OUTSIDE: "#5b6b79",
  NONE: "#1e6fb8",
};

const OBSTACLE_COLORS: Record<string, string> = {
  COMPLIANT: "#1a7f4b",
  PENETRATING: "#b3261e",
  UNDER_MONITORING: "#9a6a00",
  ILLEGAL: "#b3261e",
};

// Data-driven fill/line colour by surface kind
const SURFACE_COLOR_EXPR: ExpressionSpecification = [
  "match",
  ["get", "kind"],
  "INNER_HORIZONTAL", SURFACE_COLORS.INNER_HORIZONTAL,
  "CONICAL", SURFACE_COLORS.CONICAL,
  "APPROACH", SURFACE_COLORS.APPROACH,
  "TAKEOFF_CLIMB", SURFACE_COLORS.TAKEOFF_CLIMB,
  "TRANSITIONAL", SURFACE_COLORS.TRANSITIONAL,
  "#5b6b79",
];

export function OlsMap({
  center,
  zoom = 11.5,
  surfaces,
  runways,
  navaids,
  zoningGrid,
  showZoning = false,
  site,
  siteStatus = "NONE",
  siteDraggable = false,
  onSiteChange,
  onMapClick,
  obstacles,
  className,
  interactive = true,
}: OlsMapProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<MapLibreMap | null>(null);
  const markerRef = React.useRef<Marker | null>(null);
  const markerElRef = React.useRef<HTMLDivElement | null>(null);
  const navaidMarkersRef = React.useRef<Marker[]>([]);
  const obstacleMarkersRef = React.useRef<Marker[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  // Keep callbacks fresh without re-initialising the map
  const onSiteChangeRef = React.useRef(onSiteChange);
  onSiteChangeRef.current = onSiteChange;
  const onMapClickRef = React.useRef(onMapClick);
  onMapClickRef.current = onMapClick;

  // ── init ──
  React.useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors",
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      center,
      zoom,
      interactive,
      attributionControl: { compact: true },
    });
    if (interactive) {
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
    }
    map.on("load", () => setLoaded(true));
    map.on("click", (e) => {
      onMapClickRef.current?.({ lat: e.lngLat.lat, lon: e.lngLat.lng });
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      setLoaded(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── recenter on airport change ──
  React.useEffect(() => {
    mapRef.current?.flyTo({ center, zoom, duration: 900, essential: false });
  }, [center[0], center[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── data layers ──
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;

    const upsert = (id: string, data: GeoJSON.FeatureCollection | null | undefined) => {
      const source = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
      const value = (data ?? { type: "FeatureCollection", features: [] }) as GeoJSON.FeatureCollection;
      if (source) source.setData(value);
      else map.addSource(id, { type: "geojson", data: value });
    };

    upsert("ols-surfaces", surfaces);
    upsert("ols-runways", runways);
    upsert("ols-zoning", showZoning ? zoningGrid : { type: "FeatureCollection", features: [] });

    if (!map.getLayer("zoning-fill")) {
      map.addLayer({
        id: "zoning-fill",
        type: "fill",
        source: "ols-zoning",
        paint: {
          "fill-color": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "aboveAerodromeM"], 200],
            0, "#b3261e",
            15, "#d97706",
            45, "#eab308",
            90, "#1a7f4b",
            180, "#1e6fb8",
          ],
          "fill-opacity": 0.35,
        },
      });
      map.addLayer({
        id: "zoning-line",
        type: "line",
        source: "ols-zoning",
        paint: { "line-color": "#ffffff", "line-opacity": 0.15, "line-width": 0.5 },
      });
    }

    if (!map.getLayer("surfaces-fill")) {
      map.addLayer({
        id: "surfaces-fill",
        type: "fill",
        source: "ols-surfaces",
        paint: {
          "fill-color": SURFACE_COLOR_EXPR,
          "fill-opacity": 0.14,
        },
      });
      map.addLayer({
        id: "surfaces-line",
        type: "line",
        source: "ols-surfaces",
        paint: {
          "line-color": SURFACE_COLOR_EXPR,
          "line-width": 1.2,
          "line-opacity": 0.55,
        },
      });
      // hover popup for surfaces
      map.on("click", "surfaces-fill", (e) => {
        const f = e.features?.[0];
        if (!f || onMapClickRef.current) return; // site-picking takes priority
        // Build popup DOM safely (no innerHTML with feature data)
        const wrap = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = String(f.properties?.name ?? "Surface");
        const line = document.createElement("div");
        line.textContent = `Limit: ${f.properties?.baseElevationAmslM ?? "?"}–${f.properties?.topElevationAmslM ?? "?"} m AMSL`;
        wrap.append(title, line);
        new maplibregl.Popup({ closeButton: false })
          .setLngLat(e.lngLat)
          .setDOMContent(wrap)
          .addTo(map);
      });
    }

    if (!map.getLayer("runway-line")) {
      map.addLayer({
        id: "runway-casing",
        type: "line",
        source: "ols-runways",
        paint: { "line-color": "#0f3557", "line-width": 7, "line-opacity": 0.9 },
      });
      map.addLayer({
        id: "runway-line",
        type: "line",
        source: "ols-runways",
        paint: { "line-color": "#ffffff", "line-width": 2, "line-dasharray": [3, 2] },
      });
    }
  }, [loaded, surfaces, runways, zoningGrid, showZoning]);

  // ── navaid markers ──
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    navaidMarkersRef.current.forEach((m) => m.remove());
    navaidMarkersRef.current = (navaids ?? []).map((n) => {
      const el = document.createElement("div");
      el.style.cssText =
        "width:22px;height:22px;border-radius:6px;background:#0f3557;color:#fff;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3);cursor:default";
      el.textContent = n.type.slice(0, 3);
      el.title = n.name ?? n.type;
      return new maplibregl.Marker({ element: el }).setLngLat([n.lon, n.lat]).addTo(map);
    });
  }, [loaded, navaids]);

  // ── obstacle markers ──
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    obstacleMarkersRef.current.forEach((m) => m.remove());
    obstacleMarkersRef.current = (obstacles ?? []).map((o) => {
      const color = OBSTACLE_COLORS[o.status] ?? "#5b6b79";
      const el = document.createElement("div");
      el.style.cssText = `width:14px;height:14px;border-radius:50%;background:${color};border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)`;
      if (o.label) el.title = o.label;
      return new maplibregl.Marker({ element: el }).setLngLat([o.lon, o.lat]).addTo(map);
    });
  }, [loaded, obstacles]);

  // ── site marker (drop + pulse) ──
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;

    if (!site) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    const color = SITE_COLORS[siteStatus];
    if (!markerRef.current) {
      const el = document.createElement("div");
      el.setAttribute("role", "img");
      el.setAttribute("aria-label", "Site marker");
      const box = document.createElement("div");
      box.style.cssText = "position:relative;width:26px;height:26px";
      const pulseEl = document.createElement("div");
      pulseEl.className = "hcms-pulse";
      pulseEl.style.cssText = `position:absolute;inset:-6px;border-radius:50%;background:${color};opacity:.3`;
      const dotEl = document.createElement("div");
      dotEl.className = "hcms-dot";
      dotEl.style.cssText = `position:absolute;inset:0;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)`;
      box.append(pulseEl, dotEl);
      el.appendChild(box);
      const style = document.createElement("style");
      style.textContent = `
        @keyframes hcms-pulse { 0% {transform:scale(.7);opacity:.45} 70% {transform:scale(1.6);opacity:0} 100% {opacity:0} }
        @keyframes hcms-drop { 0% {transform:translateY(-14px);opacity:0} 60% {transform:translateY(2px);opacity:1} 100% {transform:translateY(0)} }
        .hcms-pulse { animation: hcms-pulse 1.8s ease-out infinite }
        .hcms-dot { animation: hcms-drop .4s cubic-bezier(.22,1,.36,1) }
        @media (prefers-reduced-motion: reduce) { .hcms-pulse,.hcms-dot { animation: none } }
      `;
      el.appendChild(style);
      markerElRef.current = el;
      const marker = new maplibregl.Marker({ element: el, draggable: siteDraggable })
        .setLngLat([site.lon, site.lat])
        .addTo(map);
      marker.on("dragend", () => {
        const pos = marker.getLngLat();
        onSiteChangeRef.current?.({ lat: pos.lat, lon: pos.lng });
      });
      markerRef.current = marker;
    } else {
      markerRef.current.setLngLat([site.lon, site.lat]);
      markerRef.current.setDraggable(siteDraggable);
      const el = markerElRef.current;
      if (el) {
        const dot = el.querySelector<HTMLDivElement>(".hcms-dot");
        const pulse = el.querySelector<HTMLDivElement>(".hcms-pulse");
        if (dot) dot.style.background = color;
        if (pulse) pulse.style.background = color;
      }
    }
  }, [loaded, site?.lat, site?.lon, siteStatus, siteDraggable]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ minHeight: 320 }}
      aria-label="Obstacle limitation surfaces map"
    />
  );
}

/** Legend chips matching the surface palette — render beside any OLS map. */
export function OlsLegend({ className }: { className?: string }) {
  const items: [string, string][] = [
    ["Inner Horizontal", SURFACE_COLORS.INNER_HORIZONTAL],
    ["Conical", SURFACE_COLORS.CONICAL],
    ["Approach", SURFACE_COLORS.APPROACH],
    ["Take-off Climb", SURFACE_COLORS.TAKEOFF_CLIMB],
    ["Transitional", SURFACE_COLORS.TRANSITIONAL],
  ];
  return (
    <div className={className}>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {items.map(([label, color]) => (
          <li key={label} className="flex items-center gap-1.5">
            <span
              className="inline-block size-2.5 rounded-sm"
              style={{ background: color, opacity: 0.8 }}
              aria-hidden
            />
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}
