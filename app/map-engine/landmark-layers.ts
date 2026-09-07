import type maplibregl from "maplibre-gl";
import type { VisibleLandmark } from "./map-navigation";

const LANDMARK_SOURCE = "landmarks-ahead";
const LANDMARK_LABEL_LAYER = "landmarks-ahead-label";

function milesText(miles: number) {
  return `${miles < 0.1 ? "<0.1" : miles.toFixed(1)} mi`;
}

export function ensureLandmarkLayers(map: maplibregl.Map) {
  if (map.getSource(LANDMARK_SOURCE)) return;
  map.addSource(LANDMARK_SOURCE, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addLayer({
    id: LANDMARK_LABEL_LAYER,
    type: "symbol",
    source: LANDMARK_SOURCE,
    layout: {
      "text-field": ["get", "label"],
      "text-size": 12,
      "text-anchor": "center",
      "text-allow-overlap": true,
      "text-padding": 2,
    },
    paint: {
      "text-color": "#ffffff",
      "text-halo-color": "rgba(0,0,0,0.85)",
      "text-halo-width": 2,
    },
  });
}

export function setLandmarks(map: maplibregl.Map, landmarks: VisibleLandmark[]) {
  const source = map.getSource(LANDMARK_SOURCE);
  if (!source) return;
  const features = landmarks.map((landmark) => ({
    type: "Feature" as const,
    geometry: { type: "Point" as const, coordinates: [landmark.longitude, landmark.latitude] },
    properties: {
      name: landmark.name,
      miles: milesText(landmark.miles),
      label: `${landmark.name}\n${milesText(landmark.miles)}`,
    },
  }));
  (source as maplibregl.GeoJSONSource).setData({
    type: "FeatureCollection",
    features,
  });
}