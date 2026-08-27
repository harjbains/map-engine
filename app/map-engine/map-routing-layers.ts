import type maplibregl from "maplibre-gl";
import type { CalculatedRoute } from "../lib/routing";

const EMPTY_ROUTE_DATA = { type: "FeatureCollection", features: [] } as const;
export const TRAFFIC_SOURCE = "tomtom-live-traffic";
const TRAFFIC_LAYER = "tomtom-live-traffic-flow";
const TRAFFIC_INCIDENT_SOURCE = "tomtom-live-incidents";
const TRAFFIC_INCIDENT_FLOW_LAYER = "tomtom-live-incident-flow";
const TRAFFIC_INCIDENT_POINT_LAYER = "tomtom-live-incident-points";
const TRAFFIC_INCIDENT_LABEL_LAYER = "tomtom-live-incident-labels";
const TRAFFIC_LAYERS = [TRAFFIC_LAYER, TRAFFIC_INCIDENT_FLOW_LAYER, TRAFFIC_INCIDENT_POINT_LAYER, TRAFFIC_INCIDENT_LABEL_LAYER];

function trafficTileUrl() {
  return `/api/traffic/{z}/{x}/{y}?refresh=${Math.floor(Date.now() / 60_000)}`;
}

function trafficIncidentTileUrl() {
  return `/api/traffic/incidents/{z}/{x}/{y}?refresh=${Math.floor(Date.now() / 60_000)}`;
}

export function ensureTrafficLayer(map: maplibregl.Map) {
  if (!map.getSource(TRAFFIC_SOURCE)) {
    map.addSource(TRAFFIC_SOURCE, {
      type: "vector",
      tiles: [trafficTileUrl()],
      minzoom: 5,
      maxzoom: 22,
      attribution: "Traffic © TomTom",
    });
  }
  if (!map.getSource(TRAFFIC_INCIDENT_SOURCE)) {
    map.addSource(TRAFFIC_INCIDENT_SOURCE, {
      type: "vector",
      tiles: [trafficIncidentTileUrl()],
      minzoom: 5,
      maxzoom: 22,
      attribution: "Traffic incidents © TomTom",
    });
  }
  const before = map.getLayer("active-route-casing") ? "active-route-casing" : map.getLayer("road-name") ? "road-name" : undefined;
  if (!map.getLayer(TRAFFIC_LAYER)) {
    map.addLayer({
      id: TRAFFIC_LAYER,
      type: "line",
      source: TRAFFIC_SOURCE,
      "source-layer": "Traffic flow",
      minzoom: 7,
      filter: ["<=", ["get", "traffic_level"], 0.88],
      layout: { visibility: "none", "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ["case", ["<=", ["get", "traffic_level"], 0.45], "#7f1d29", ["<=", ["get", "traffic_level"], 0.75], "#d33d32", "#a84608"],
        "line-width": ["interpolate", ["linear"], ["zoom"], 7, 1.5, 12, 5, 15, 9, 18, 16],
        "line-opacity": 0.96,
      },
    }, before);
  }
  if (!map.getLayer(TRAFFIC_INCIDENT_FLOW_LAYER)) {
    map.addLayer({
      id: TRAFFIC_INCIDENT_FLOW_LAYER,
      type: "line",
      source: TRAFFIC_INCIDENT_SOURCE,
      "source-layer": "Traffic incident flow",
      minzoom: 8,
      layout: { visibility: "none", "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ["step", ["coalesce", ["get", "magnitude"], 0], "#b75b1c", 2, "#d84332", 3, "#831f27"],
        "line-width": ["interpolate", ["linear"], ["zoom"], 8, 2, 12, 4, 16, 8],
        "line-opacity": 0.9,
        "line-dasharray": [1.5, 1],
      },
    }, before);
  }
  if (!map.getLayer(TRAFFIC_INCIDENT_POINT_LAYER)) {
    map.addLayer({
      id: TRAFFIC_INCIDENT_POINT_LAYER,
      type: "circle",
      source: TRAFFIC_INCIDENT_SOURCE,
      "source-layer": "Traffic incident POI",
      minzoom: 9,
      layout: { visibility: "none" },
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 7, 14, 10, 18, 13],
        "circle-color": ["match", ["coalesce", ["get", "icon_category_0"], 0], 1, "#cf332d", 6, "#8f1f27", 7, "#d45a18", 8, "#7f1d29", 9, "#b75b1c", 11, "#316f91", 14, "#a84608", "#a84608"],
        "circle-stroke-color": "#fffdf8",
        "circle-stroke-width": 2,
        "circle-opacity": 0.98,
      },
    });
  }
  if (!map.getLayer(TRAFFIC_INCIDENT_LABEL_LAYER)) {
    map.addLayer({
      id: TRAFFIC_INCIDENT_LABEL_LAYER,
      type: "symbol",
      source: TRAFFIC_INCIDENT_SOURCE,
      "source-layer": "Traffic incident POI",
      minzoom: 9,
      layout: {
        visibility: "none",
        "text-field": ["match", ["coalesce", ["get", "icon_category_0"], 0], 1, "!", 6, "J", 7, "L", 8, "×", 9, "W", 11, "~", 14, "B", "!"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 9, 9, 14, 12, 18, 15],
        "text-font": ["Noto Sans Regular"],
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      },
      paint: { "text-color": "#ffffff", "text-halo-color": "rgba(0,0,0,.18)", "text-halo-width": 0.5 },
    });
  }
}

export function setTrafficVisibility(map: maplibregl.Map, visible: boolean) {
  for (const layer of TRAFFIC_LAYERS) {
    if (map.getLayer(layer)) map.setLayoutProperty(layer, "visibility", visible ? "visible" : "none");
  }
}

export function refreshTrafficTiles(map: maplibregl.Map) {
  const source = map.getSource(TRAFFIC_SOURCE) as maplibregl.VectorTileSource | undefined;
  source?.setTiles([trafficTileUrl()]);
  const incidentSource = map.getSource(TRAFFIC_INCIDENT_SOURCE) as maplibregl.VectorTileSource | undefined;
  incidentSource?.setTiles([trafficIncidentTileUrl()]);
}

export function collapseAttributionControl(map: maplibregl.Map) {
  const control = map.getContainer().querySelector<HTMLDetailsElement>(".maplibregl-ctrl-attrib");
  control?.classList.remove("maplibregl-compact-show");
  control?.removeAttribute("open");
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
