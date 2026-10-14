import type maplibregl from "maplibre-gl";
import type { CalculatedRoute } from "../lib/routing";
import { tomTomKey, trafficTileUrl, trafficIncidentTileUrl } from "../lib/tomtom-client";

const EMPTY_ROUTE_DATA = { type: "FeatureCollection", features: [] } as const;
export const TRAFFIC_SOURCE = "tomtom-live-traffic";
export const TRAFFIC_INCIDENTS_SOURCE = "tomtom-traffic-incidents";
const TRAFFIC_FLOW_LAYER = "tomtom-live-traffic-flow";
const TRAFFIC_INCIDENT_LAYER = "tomtom-traffic-incidents-flow";
const TRAFFIC_LAYERS = [TRAFFIC_FLOW_LAYER, TRAFFIC_INCIDENT_LAYER];

export function ensureTrafficLayer(map: maplibregl.Map) {
  addTrafficGeometry(map, false);
}

function addTrafficGeometry(map: maplibregl.Map, visible: boolean) {
  if (!map.isStyleLoaded()) return;
  if (!tomTomKey()) return;
  const visibility = visible ? "visible" : "none";
  
  const tileUrl = trafficTileUrl();
  if (tileUrl && !map.getSource(TRAFFIC_SOURCE)) {
    map.addSource(TRAFFIC_SOURCE, {
      type: "vector",
      tiles: [tileUrl],
      minzoom: 5,
      maxzoom: 22,
      attribution: "Traffic © TomTom",
    });
  }

  const incidentUrl = trafficIncidentTileUrl();
  if (incidentUrl && !map.getSource(TRAFFIC_INCIDENTS_SOURCE)) {
    map.addSource(TRAFFIC_INCIDENTS_SOURCE, {
      type: "vector",
      tiles: [incidentUrl],
      minzoom: 5,
      maxzoom: 22,
      attribution: "Traffic © TomTom",
    });
  }

  const before =
    map.getLayer("active-route-casing")
      ? "active-route-casing"
      : map.getLayer("road-name")
        ? "road-name"
        : undefined;

  if (map.getSource(TRAFFIC_SOURCE) && !map.getLayer(TRAFFIC_FLOW_LAYER)) {
    map.addLayer({
      id: TRAFFIC_FLOW_LAYER,
      type: "line",
      source: TRAFFIC_SOURCE,
      "source-layer": "Traffic flow",
      minzoom: 7,
      layout: { visibility, "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": [
          "case",
          ["==", ["get", "road_closure"], true],
          "#6b0f1c", // severe (road closure)
          [
            "step",
            ["get", "traffic_level"],
            "#6b0f1c", // 0 to 0.35: severe
            0.35,
            "#e0242d", // 0.35 to 0.60: heavy
            0.60,
            "#f2a513", // 0.60 to 0.80: delay / moderate
            0.80,
            "rgba(0,0,0,0)", // > 0.80: normal free flow
          ],
        ],
        "line-width": ["interpolate", ["linear"], ["zoom"], 7, 1.5, 12, 4.5, 15, 8, 18, 14],
        "line-opacity": 0.95,
      },
    }, before);
  }

  if (map.getSource(TRAFFIC_INCIDENTS_SOURCE) && !map.getLayer(TRAFFIC_INCIDENT_LAYER)) {
    map.addLayer({
      id: TRAFFIC_INCIDENT_LAYER,
      type: "line",
      source: TRAFFIC_INCIDENTS_SOURCE,
      "source-layer": "Traffic incident flow",
      minzoom: 7,
      layout: { visibility, "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#c8322d",
        "line-width": ["interpolate", ["linear"], ["zoom"], 7, 2, 12, 5, 15, 9, 18, 15],
        "line-dasharray": [2, 1.5],
        "line-opacity": 0.95,
      },
    }, before);
  }

  for (const layer of TRAFFIC_LAYERS) {
    if (map.getLayer(layer)) map.setLayoutProperty(layer, "visibility", visibility);
  }
}

export function setTrafficVisibility(map: maplibregl.Map, visible: boolean) {
  for (const layer of TRAFFIC_LAYERS) {
    if (map.getLayer(layer)) map.setLayoutProperty(layer, "visibility", visible ? "visible" : "none");
  }
  if (visible && map.isStyleLoaded()) refreshTrafficTiles(map);
}

export function refreshTrafficTiles(map: maplibregl.Map) {
  for (const layer of [...TRAFFIC_LAYERS, "mapbox-live-traffic-flow"]) {
    if (map.getLayer(layer)) map.removeLayer(layer);
  }
  if (map.getSource(TRAFFIC_SOURCE)) map.removeSource(TRAFFIC_SOURCE);
  if (map.getSource(TRAFFIC_INCIDENTS_SOURCE)) map.removeSource(TRAFFIC_INCIDENTS_SOURCE);
  if (map.getSource("mapbox-live-traffic")) map.removeSource("mapbox-live-traffic");
  addTrafficGeometry(map, true);
  map.triggerRepaint();
}

export function collapseAttributionControl(map: maplibregl.Map) {
  const control = map.getContainer().querySelector<HTMLDetailsElement>(".maplibregl-ctrl-attrib");
  control?.classList.remove("maplibregl-compact-show");
  control?.removeAttribute("open");
}

const AREA_VIEW_KEEP_LABEL_PREFIXES = ["road", "route", "place", "water", "traffic", "active-route", "safety", "camera", "crossing", "parking", "ev", "postcode", "landmark", "area"];
let areaLabelVisibility = new Map<string, string>();

export function setAreaViewMode(map: maplibregl.Map, active: boolean) {
  const layers = map.getStyle()?.layers ?? [];
  for (const layer of layers) {
    if (layer.type !== "symbol") continue;
    const id = layer.id;
    if (AREA_VIEW_KEEP_LABEL_PREFIXES.some((prefix) => id.startsWith(prefix))) continue;
    if (!map.getLayer(id)) continue;
    if (active) {
      if (!areaLabelVisibility.has(id)) {
        areaLabelVisibility.set(id, (layer.layout?.visibility as string | undefined) ?? "visible");
        map.setLayoutProperty(id, "visibility", "none");
      }
    } else {
      const restore = areaLabelVisibility.get(id) ?? (layer.layout?.visibility as string | undefined) ?? "visible";
      map.setLayoutProperty(id, "visibility", restore);
    }
  }
  if (!active) areaLabelVisibility.clear();
}

export function waitForMapStyle(map: maplibregl.Map, signal: AbortSignal, timeoutMs = 6_000) {
  if (map.isStyleLoaded()) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const startedAt = performance.now();
    let timer = 0;
    const finish = (callback: () => void) => {
      window.clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      callback();
    };
    const onAbort = () => finish(() => reject(new DOMException("Route cancelled", "AbortError")));
    const check = () => {
      if (signal.aborted) {
        onAbort();
      } else if (map.isStyleLoaded()) {
        finish(resolve);
      } else if (performance.now() - startedAt >= timeoutMs) {
        finish(() => reject(new Error("The map could not finish preparing the route.")));
      } else {
        timer = window.setTimeout(check, 120);
      }
    };
    signal.addEventListener("abort", onAbort, { once: true });
    check();
  });
}

export function ensureRouteLayers(map: maplibregl.Map) {
  if (!map.getSource("active-route")) map.addSource("active-route", { type: "geojson", data: EMPTY_ROUTE_DATA as never });
  const before = map.getLayer("road-name") ? "road-name" : undefined;
  if (!map.getLayer("active-route-casing")) {
    map.addLayer({
      id: "active-route-casing",
      type: "line",
      source: "active-route",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#f7f4ff", "line-width": ["interpolate", ["linear"], ["zoom"], 10, 9, 14, 14, 18, 21], "line-opacity": 0.96 },
    }, before);
  }
  if (!map.getLayer("active-route-line")) {
    map.addLayer({
      id: "active-route-line",
      type: "line",
      source: "active-route",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#6844e4", "line-width": ["interpolate", ["linear"], ["zoom"], 10, 5.5, 14, 9, 18, 15], "line-opacity": 0.94 },
    }, before);
  }
}

export function setRouteData(map: maplibregl.Map, route: CalculatedRoute | null) {
  const source = map.getSource("active-route") as maplibregl.GeoJSONSource | undefined;
  source?.setData(route ? {
    type: "FeatureCollection",
    features: [{ type: "Feature", properties: {}, geometry: route.geometry }],
  } : { type: "FeatureCollection", features: [] });
  for (const layer of ["active-route-casing", "active-route-line"]) {
    if (map.getLayer(layer)) map.setLayoutProperty(layer, "visibility", route ? "visible" : "none");
  }
  map.triggerRepaint();
}

export function formatMiles(miles: number) {
  if (miles < 0.1) return "<0.1";
  return miles.toFixed(1);
}
