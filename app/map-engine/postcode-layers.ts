import type maplibregl from "maplibre-gl";
import { BIRMINGHAM_POSTCODES, POSTCODE_SECTORS, postcodesForGroup, type PostcodeGroupId } from "../lib/birmingham-postcodes";

const POSTCODE_SOURCE = "postcode-overlay";
const POSTCODE_CONTEXT_DOTS = "postcode-context-dots";
const POSTCODE_SELECTED_DOTS = "postcode-selected-dots";
const POSTCODE_SELECTED_LABELS = "postcode-selected-labels";

export const POSTCODE_LAYERS = [POSTCODE_CONTEXT_DOTS, POSTCODE_SELECTED_DOTS, POSTCODE_SELECTED_LABELS];

const EMPTY_COLLECTION = { type: "FeatureCollection", features: [] } as const;

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
  const before =
    map.getLayer("active-route-casing")
      ? "active-route-casing"
      : map.getLayer("road-name")
        ? "road-name"
        : undefined;
  if (!map.getLayer(POSTCODE_CONTEXT_DOTS)) {
    map.addLayer({
      id: POSTCODE_CONTEXT_DOTS,
      type: "circle",
      source: POSTCODE_SOURCE,
      filter: ["==", ["get", "selected"], false],
      layout: { visibility: "none" },
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 3.5, 12, 6, 16, 9],
        "circle-color": "#7c8890",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1,
        "circle-opacity": 0.7,
      },
    }, before);
  }
  if (!map.getLayer(POSTCODE_SELECTED_DOTS)) {
    map.addLayer({
      id: POSTCODE_SELECTED_DOTS,
      type: "circle",
      source: POSTCODE_SOURCE,
      filter: ["==", ["get", "selected"], true],
      layout: { visibility: "none" },
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 5, 12, 9, 16, 15],
        "circle-color": "#398957",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
        "circle-opacity": 0.98,
      },
    }, before);
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
        "text-size": ["interpolate", ["linear"], ["zoom"], 8, 11, 12, 15, 16, 19],
        "text-font": ["Noto Sans Regular"],
        "text-anchor": "top",
        "text-offset": [0, 1.1],
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      },
      paint: { "text-color": "#0c3d22", "text-halo-color": "#ffffff", "text-halo-width": 1.4 },
    }, before);
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