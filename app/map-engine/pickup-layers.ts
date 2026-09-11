import type maplibregl from "maplibre-gl";
import type { PickupFeatureCollection } from "../lib/pickup-history";

const PICKUP_SOURCE = "pickup-history";
const EMPTY_PICKUP_DATA: PickupFeatureCollection = { type: "FeatureCollection", features: [] };

export const PICKUP_LAYERS = ["pickup-historic", "pickup-current"] as const;
export const HISTORIC_PICKUP_COLOUR = "#647b8b";
export const CURRENT_TIME_PICKUP_COLOUR = "#f28c28";

export function ensurePickupLayers(map: maplibregl.Map) {
  if (!map.getSource(PICKUP_SOURCE)) map.addSource(PICKUP_SOURCE, { type: "geojson", data: EMPTY_PICKUP_DATA as never });
  const before = map.getLayer("road-name") ? "road-name" : undefined;
  const add = (layer: maplibregl.LayerSpecification) => {
    if (!map.getLayer(layer.id)) map.addLayer(layer, before);
  };
  add({
    id: "pickup-historic",
    type: "circle",
    source: PICKUP_SOURCE,
    filter: ["==", ["get", "matchesWindow"], false],
    paint: {
      "circle-pitch-alignment": "map",
      "circle-radius": ["interpolate", ["exponential", 1.4], ["zoom"], 13, 5.5, 18, 10],
      "circle-color": HISTORIC_PICKUP_COLOUR,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 1.6,
      "circle-opacity": 0.95,
    },
  });
  add({
    id: "pickup-current",
    type: "circle",
    source: PICKUP_SOURCE,
    filter: ["==", ["get", "matchesWindow"], true],
    paint: {
      "circle-pitch-alignment": "map",
      "circle-radius": ["interpolate", ["exponential", 1.4], ["zoom"], 13, 8, 18, 15],
      "circle-color": CURRENT_TIME_PICKUP_COLOUR,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 2.2,
    },
  });
}

export function setPickupData(map: maplibregl.Map, data: PickupFeatureCollection) {
  const source = map.getSource(PICKUP_SOURCE) as maplibregl.GeoJSONSource | undefined;
  source?.setData(data as never);
}

export function setPickupVisibility(map: maplibregl.Map, visible: boolean) {
  for (const layer of PICKUP_LAYERS) {
    if (map.getLayer(layer)) map.setLayoutProperty(layer, "visibility", visible ? "visible" : "none");
  }
}