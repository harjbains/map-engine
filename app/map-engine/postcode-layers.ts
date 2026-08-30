import type maplibregl from "maplibre-gl";
import { BIRMINGHAM_POSTCODES, POSTCODE_SECTORS, postcodesForGroup, type PostcodeGroupId } from "../lib/birmingham-postcodes";

const POSTCODE_SOURCE = "postcode-overlay";
const POSTCODE_OUTLINE_SOURCE = "postcode-outline-source";
const POSTCODE_OUTLINE_SHADE = "postcode-outline-shade";
const POSTCODE_OUTLINE = "postcode-outline";
const POSTCODE_AREA_FILL = "postcode-area-fill";
const POSTCODE_SELECTED_FILL = "postcode-selected-fill";
const POSTCODE_CONTEXT_LABELS = "postcode-context-labels";
const POSTCODE_SELECTED_LABELS = "postcode-selected-labels";
const POSTCODE_YOU_SOURCE = "postcode-you-source";
const POSTCODE_YOU_DOT = "postcode-you-dot";
const POSTCODE_YOU_LABEL = "postcode-you-label";

export const POSTCODE_LAYERS = [POSTCODE_AREA_FILL, POSTCODE_SELECTED_FILL, POSTCODE_CONTEXT_LABELS, POSTCODE_SELECTED_LABELS];

const EMPTY_COLLECTION = { type: "FeatureCollection", features: [] } as const;

// Schematic "paper chart" colour story: a quiet base, a soft outline around the
// Birmingham footprint, every postcode area as a bubble, the live selection pushed
// up in a clear amber and the vehicle a red pin.
const BIRMINGHAM_PAPER = "#f6f3ea";
const BIRMINGHAM_NIGHT = "#20262b";
const OUTLINE_SHADE_COLOR = "#efe9d8";
const OUTLINE_COLOR = "#9aa093";
const AREA_FILL_COLOR = "#e5e0d2";
const AREA_FILL_STROKE = "#cfc7b0";
const SELECTED_FILL_COLOR = "#ffcd75";
const SELECTED_FILL_STROKE = "#e7a33c";
const CONTEXT_LABEL_COLOR = "#8f968c";
const SELECTED_LABEL_COLOR = "#7a4a0a";

function radius(area: number, selected: number) {
  return ["interpolate", ["linear"], ["zoom"], 8, area, 12, Math.round(area * 1.375), 16, Math.round(area * 1.875)];
}

function cross(o: { lon: number; lat: number }, a: { lon: number; lat: number }, b: { lon: number; lat: number }) {
  return (a.lon - o.lon) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lon - o.lon);
}

function convexHull(points: { lon: number; lat: number }[]) {
  const sorted = points.slice().sort((a, b) => a.lon - b.lon || a.lat - b.lat);
  const lower: { lon: number; lat: number }[] = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop();
    lower.push(point);
  }
  const upper: { lon: number; lat: number }[] = [];
  for (let index = sorted.length - 1; index >= 0; index--) {
    const point = sorted[index];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop();
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  const hull = lower.concat(upper);
  const ring = [...hull, hull[0]].map((point) => [point.lon, point.lat]);
  return { type: "Polygon", coordinates: [ring] };
}

const BIRMINGHAM_OUTLINE_FEATURES = (() => {
  const points = BIRMINGHAM_POSTCODES.map((postcode) => ({ lon: postcode.longitude, lat: postcode.latitude }));
  for (const sectorGroup of Object.values(POSTCODE_SECTORS)) {
    for (const sector of sectorGroup) points.push({ lon: sector.longitude, lat: sector.latitude });
  }
  return {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: {},
      geometry: convexHull(points),
    }],
  };
})();

export function postcodeBirminghamStyle(dark = false): maplibregl.StyleSpecification {
  return {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {},
    layers: [
      {
        id: "birmingham-background",
        type: "background",
        paint: { "background-color": dark ? BIRMINGHAM_NIGHT : BIRMINGHAM_PAPER },
      },
    ],
  };
}

export function postcodeGroupBounds(groupId: PostcodeGroupId, includePosition?: { latitude: number; longitude: number }) {
  const points = postcodesForGroup(groupId);
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  const extend = (longitude: number, latitude: number) => {
    if (longitude < minLon) minLon = longitude;
    if (latitude < minLat) minLat = latitude;
    if (longitude > maxLon) maxLon = longitude;
    if (latitude > maxLat) maxLat = latitude;
  };
  for (const postcode of points) extend(postcode.longitude, postcode.latitude);
  if (includePosition) extend(includePosition.longitude, includePosition.latitude);
  if (!Number.isFinite(minLon)) return [[-1.9, 52.45], [-1.68, 52.6]] as [[number, number], [number, number]];
  const padLon = Math.max((maxLon - minLon) / 5, 0.025);
  const padLat = Math.max((maxLat - minLat) / 5, 0.016);
  return [[minLon - padLon, minLat - padLat], [maxLon + padLon, maxLat + padLat]] as [[number, number], [number, number]];
}

export function birminghamBounds(includePosition?: { latitude: number; longitude: number }) {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  const extend = (longitude: number, latitude: number) => {
    if (longitude < minLon) minLon = longitude;
    if (latitude < minLat) minLat = latitude;
    if (longitude > maxLon) maxLon = longitude;
    if (latitude > maxLat) maxLat = latitude;
  };
  for (const postcode of BIRMINGHAM_POSTCODES) extend(postcode.longitude, postcode.latitude);
  for (const sectorGroup of Object.values(POSTCODE_SECTORS)) {
    for (const sector of sectorGroup) extend(sector.longitude, sector.latitude);
  }
  if (includePosition) extend(includePosition.longitude, includePosition.latitude);
  if (!Number.isFinite(minLon)) return [[-1.95, 52.39], [-1.72, 52.62]] as [[number, number], [number, number]];
  const padLon = Math.max((maxLon - minLon) / 7, 0.04);
  const padLat = Math.max((maxLat - minLat) / 7, 0.03);
  return [[minLon - padLon, minLat - padLat], [maxLon + padLon, maxLat + padLat]] as [[number, number], [number, number]];
}

function buildFeatures(groupId: PostcodeGroupId) {
  const selected = new Set(postcodesForGroup(groupId).map((postcode) => postcode.code));
  const features = [];
  for (const postcode of BIRMINGHAM_POSTCODES) {
    features.push({
      type: "Feature",
      properties: { code: postcode.code, selected: selected.has(postcode.code) },
      geometry: { type: "Point", coordinates: [postcode.longitude, postcode.latitude] },
    });
  }
  const sectors = POSTCODE_SECTORS[groupId];
  if (sectors) {
    for (const sector of sectors) {
      features.push({
        type: "Feature",
        properties: { code: sector.code, selected: true },
        geometry: { type: "Point", coordinates: [sector.longitude, sector.latitude] },
      });
    }
  }
  return { type: "FeatureCollection", features } as GeoJSON.FeatureCollection;
}

export function ensurePostcodeLayers(map: maplibregl.Map) {
  if (!map.isStyleLoaded()) return;
  if (!map.getSource(POSTCODE_SOURCE)) {
    map.addSource(POSTCODE_SOURCE, { type: "geojson", data: EMPTY_COLLECTION as never });
  }
  if (!map.getSource(POSTCODE_YOU_SOURCE)) {
    map.addSource(POSTCODE_YOU_SOURCE, { type: "geojson", data: EMPTY_COLLECTION as never });
  }
  if (!map.getSource(POSTCODE_OUTLINE_SOURCE)) {
    map.addSource(POSTCODE_OUTLINE_SOURCE, { type: "geojson", data: BIRMINGHAM_OUTLINE_FEATURES as never });
  }
  if (!map.getLayer(POSTCODE_OUTLINE_SHADE)) {
    map.addLayer({
      id: POSTCODE_OUTLINE_SHADE,
      type: "fill",
      source: POSTCODE_OUTLINE_SOURCE,
      paint: { "fill-color": OUTLINE_SHADE_COLOR, "fill-opacity": 0.55 },
    });
  }
  if (!map.getLayer(POSTCODE_OUTLINE)) {
    map.addLayer({
      id: POSTCODE_OUTLINE,
      type: "line",
      source: POSTCODE_OUTLINE_SOURCE,
      paint: { "line-color": OUTLINE_COLOR, "line-width": 2, "line-opacity": 0.95 },
    });
  }
  if (!map.getLayer(POSTCODE_AREA_FILL)) {
    map.addLayer({
      id: POSTCODE_AREA_FILL,
      type: "circle",
      source: POSTCODE_SOURCE,
      filter: ["==", ["get", "selected"], false],
      layout: { visibility: "none" },
      paint: {
        "circle-radius": radius(16, 21),
        "circle-color": AREA_FILL_COLOR,
        "circle-stroke-color": AREA_FILL_STROKE,
        "circle-stroke-width": 1,
        "circle-opacity": 0.65,
      },
    });
  }
  if (!map.getLayer(POSTCODE_SELECTED_FILL)) {
    map.addLayer({
      id: POSTCODE_SELECTED_FILL,
      type: "circle",
      source: POSTCODE_SOURCE,
      filter: ["==", ["get", "selected"], true],
      layout: { visibility: "none" },
      paint: {
        "circle-radius": radius(21, 27),
        "circle-color": SELECTED_FILL_COLOR,
        "circle-stroke-color": SELECTED_FILL_STROKE,
        "circle-stroke-width": 2,
        "circle-opacity": 0.9,
      },
    });
  }
  if (!map.getLayer(POSTCODE_CONTEXT_LABELS)) {
    map.addLayer({
      id: POSTCODE_CONTEXT_LABELS,
      type: "symbol",
      source: POSTCODE_SOURCE,
      filter: ["==", ["get", "selected"], false],
      layout: {
        visibility: "none",
        "text-field": ["get", "code"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 8, 10, 12, 11, 16, 12.5],
        "text-font": ["Noto Sans Regular"],
        "text-anchor": "center",
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      },
      paint: { "text-color": CONTEXT_LABEL_COLOR, "text-halo-color": "#ffffff", "text-halo-width": 1.2 },
    });
  }
  if (!map.getLayer(POSTCODE_SELECTED_LABELS)) {
    map.addLayer({
      id: POSTCODE_SELECTED_LABELS,
      type: "symbol",
      source: POSTCODE_SOURCE,
      filter: ["==", ["get", "selected"], true],
      layout: {
        visibility: "none",
        "text-field": ["get", "code"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 8, 13, 12, 15.5, 16, 18],
        "text-font": ["Noto Sans Regular"],
        "text-anchor": "center",
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      },
      paint: { "text-color": SELECTED_LABEL_COLOR, "text-halo-color": "#ffffff", "text-halo-width": 1.5 },
    });
  }
  if (!map.getLayer(POSTCODE_YOU_DOT)) {
    map.addLayer({
      id: POSTCODE_YOU_DOT,
      type: "circle",
      source: POSTCODE_YOU_SOURCE,
      layout: { visibility: "none" },
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 7, 12, 10, 16, 14],
        "circle-color": "#d43d36",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 3,
        "circle-opacity": 1,
      },
    });
  }
  if (!map.getLayer(POSTCODE_YOU_LABEL)) {
    map.addLayer({
      id: POSTCODE_YOU_LABEL,
      type: "symbol",
      source: POSTCODE_YOU_SOURCE,
      layout: {
        visibility: "none",
        "text-field": "You",
        "text-size": ["interpolate", ["linear"], ["zoom"], 8, 12, 16, 16],
        "text-font": ["Noto Sans Regular"],
        "text-anchor": "top",
        "text-offset": [0, 1.8],
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      },
      paint: { "text-color": "#b3302a", "text-halo-color": "#ffffff", "text-halo-width": 1.6 },
    });
  }
}

export function setPostcodeOverlay(map: maplibregl.Map, groupId: PostcodeGroupId | null) {
  const source = map.getSource(POSTCODE_SOURCE) as maplibregl.GeoJSONSource | undefined;
  source?.setData(groupId ? buildFeatures(groupId) : EMPTY_COLLECTION);
  for (const layer of POSTCODE_LAYERS) {
    if (map.getLayer(layer)) map.setLayoutProperty(layer, "visibility", groupId ? "visible" : "none");
  }
  map.triggerRepaint();
}

export function setPostcodeYou(map: maplibregl.Map, position: { latitude: number; longitude: number } | null | undefined) {
  const source = map.getSource(POSTCODE_YOU_SOURCE) as maplibregl.GeoJSONSource | undefined;
  source?.setData(position
    ? { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [position.longitude, position.latitude] } }] }
    : EMPTY_COLLECTION);
  for (const layer of [POSTCODE_YOU_DOT, POSTCODE_YOU_LABEL]) {
    if (map.getLayer(layer)) map.setLayoutProperty(layer, "visibility", position ? "visible" : "none");
  }
  map.triggerRepaint();
}