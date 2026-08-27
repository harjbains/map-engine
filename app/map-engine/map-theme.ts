import type maplibregl from "maplibre-gl";

export const ROAD_WIDTH_SCALE = 0.75;
export const B_ROAD_WIDTH_SCALE = 0.56;
export const MOTORWAY_WIDTH_SCALE = 0.45;
export const LOCAL_ROAD_WIDTH_SCALE = 0.48;

const scaleRoadWidthOutput = (value: unknown, scale: number): unknown => {
  if (typeof value === "number") return value * scale;
  if (Array.isArray(value) && value[0] === "case") {
    return ["case", value[1], scaleRoadWidthOutput(value[2], scale), scaleRoadWidthOutput(value[3], scale)];
  }
  return value;
};

const scaleRoadWidth = (width: unknown[], scale = ROAD_WIDTH_SCALE) => width.map((value, index) => index >= 4 && index % 2 === 0 ? scaleRoadWidthOutput(value, scale) : value);
const IS_RAMP = ["==", ["get", "ramp"], 1];
const MOTORWAY_CASING_WIDTH = scaleRoadWidth(["interpolate", ["exponential", 1.3], ["zoom"], 5, ["case", IS_RAMP, 1.5, 3], 8, ["case", IS_RAMP, 2.75, 5.5], 10, ["case", IS_RAMP, 4.25, 8.5], 12, ["case", IS_RAMP, 6, 12], 14, ["case", IS_RAMP, 9.5, 19], 17, ["case", IS_RAMP, 17, 34], 19, ["case", IS_RAMP, 24, 48]], MOTORWAY_WIDTH_SCALE);
const MOTORWAY_WIDTH = scaleRoadWidth(["interpolate", ["exponential", 1.3], ["zoom"], 5, ["case", IS_RAMP, 0.9, 1.8], 8, ["case", IS_RAMP, 1.75, 3.5], 10, ["case", IS_RAMP, 3, 6], 12, ["case", IS_RAMP, 4.5, 9], 14, ["case", IS_RAMP, 7.5, 15], 17, ["case", IS_RAMP, 14, 28], 19, ["case", IS_RAMP, 20, 40]], MOTORWAY_WIDTH_SCALE);
const A_ROAD_CASING_WIDTH = scaleRoadWidth(["interpolate", ["exponential", 1.3], ["zoom"], 5, ["case", IS_RAMP, 1.5, 2.25], 8, ["case", IS_RAMP, 2.75, 4.1], 10, ["case", IS_RAMP, 4.25, 6.4], 12, ["case", IS_RAMP, 6, 9], 14, ["case", IS_RAMP, 9.5, 14.25], 17, ["case", IS_RAMP, 17, 25.5], 19, ["case", IS_RAMP, 24, 36]]);
const A_ROAD_WIDTH = scaleRoadWidth(["interpolate", ["exponential", 1.3], ["zoom"], 5, ["case", IS_RAMP, 0.9, 1.35], 8, ["case", IS_RAMP, 1.75, 2.6], 10, ["case", IS_RAMP, 3, 4.5], 12, ["case", IS_RAMP, 4.5, 6.75], 14, ["case", IS_RAMP, 7.5, 11.25], 17, ["case", IS_RAMP, 14, 21], 19, ["case", IS_RAMP, 20, 30]]);
const B_ROAD_CASING_WIDTH = scaleRoadWidth(["interpolate", ["exponential", 1.3], ["zoom"], 5, 3, 8, 5.5, 10, 8.5, 12, 12, 14, 19, 17, 34, 19, 48], B_ROAD_WIDTH_SCALE);
const B_ROAD_WIDTH = scaleRoadWidth(["interpolate", ["exponential", 1.3], ["zoom"], 5, 1.8, 8, 3.5, 10, 6, 12, 9, 14, 15, 17, 28, 19, 40], B_ROAD_WIDTH_SCALE);
const SERVICE_ROAD = ["==", ["get", "class"], "service"];
const LOCAL_ROAD_CASING_WIDTH = scaleRoadWidth(["interpolate", ["exponential", 1.3], ["zoom"], 5, 3, 8, 5.5, 10, 8.5, 12, 12, 14, 19, 17, 34, 19, 48], LOCAL_ROAD_WIDTH_SCALE);
const LOCAL_ROAD_WIDTH = scaleRoadWidth(["interpolate", ["exponential", 1.3], ["zoom"], 5, 1.8, 8, 3.5, 10, 6, 12, 9, 14, 15, 17, 28, 19, 40], LOCAL_ROAD_WIDTH_SCALE);

const NIGHT_LOCAL_FILL = ["match", ["get", "class"],
  "tertiary", "#687278",
  ["residential", "unclassified", "living_street"], "#50595e",
  "minor", "#454e53",
  "service", "#343b3f",
  "#454e53",
];
const NIGHT_LOCAL_CASING = ["match", ["get", "class"],
  "tertiary", "#252c30",
  ["residential", "unclassified", "living_street"], "#20272a",
  ["minor", "service"], "#1b2124",
  "#20272a",
];

const MAP_THEME_PAINTS = {
  day: [
    ["background", "background-color", "#f1efe8"],
    ["residential", "fill-color", "#ece8df"],
    ["vegetation", "fill-color", "#dce8ce"],
    ["park", "fill-color", "#d7e6c5"],
    ["water", "fill-color", "#bddfec"],
    ["waterway", "line-color", "#72b4cf"],
    ["building-flat", "fill-color", "#d9d2c8"],
    ["building-flat", "fill-outline-color", "#aaa195"],
    ["building-flat", "fill-opacity", ["interpolate", ["linear"], ["zoom"], 13, 0.12, 15, 0.34, 18, 0.45]],
    ["building-3d", "fill-extrusion-color", "#cbc5bc"],
    ["building-3d", "fill-extrusion-opacity", ["interpolate", ["linear"], ["zoom"], 14, 0.16, 17, 0.34]],
    ["path", "line-color", "#aa8174"],
    ["road-motorway-casing", "line-color", "#183f62"],
    ["road-motorway-casing", "line-width", MOTORWAY_CASING_WIDTH],
    ["road-motorway", "line-color", "#367dbf"],
    ["road-motorway", "line-width", MOTORWAY_WIDTH],
    ["road-a-casing", "line-color", "#28573a"],
    ["road-a-casing", "line-width", A_ROAD_CASING_WIDTH],
    ["road-a", "line-color", "#3f7f54"],
    ["road-a", "line-width", A_ROAD_WIDTH],
    ["road-b-casing", "line-color", "#667a84"],
    ["road-b-casing", "line-width", B_ROAD_CASING_WIDTH],
    ["road-b", "line-color", "#9fb3be"],
    ["road-b", "line-width", B_ROAD_WIDTH],
    ["road-local-casing", "line-color", ["match", ["get", "class"], "tertiary", "#89867f", ["residential", "unclassified", "living_street"], "#9b978f", "minor", "#aaa69e", "service", "#b9b6af", "#9b978f"]],
    ["road-local-casing", "line-width", LOCAL_ROAD_CASING_WIDTH],
    ["road-local", "line-color", ["case", SERVICE_ROAD, "#deded7", "#fffdf7"]],
    ["road-local", "line-width", LOCAL_ROAD_WIDTH],
    ["road-name", "text-color", "#282622"],
    ["road-name", "text-halo-color", "#fffdf7"],
    ["road-name", "text-halo-width", 2.2],
    ["route-motorway", "text-color", "#fff"],
    ["route-motorway", "text-halo-color", "#245d91"],
    ["route-a", "text-color", "#ffffff"],
    ["route-a", "text-halo-color", "#28573a"],
    ["route-a", "text-halo-width", 7],
    ["route-b", "text-color", "#182126"],
    ["route-b", "text-halo-color", "#9fb3be"],
    ["route-b", "text-halo-width", 7],
    ["place", "text-color", "#2c302e"],
    ["place", "text-halo-color", "#f1efe8"],
  ],
  night: [
    ["background", "background-color", "#0b0f11"],
    ["residential", "fill-color", "#11171a"],
    ["vegetation", "fill-color", "#111d17"],
    ["park", "fill-color", "#17251d"],
    ["water", "fill-color", "#143247"],
    ["waterway", "line-color", "#285b74"],
    ["building-flat", "fill-color", "#20272b"],
    ["building-flat", "fill-outline-color", "#2a3439"],
    ["building-flat", "fill-opacity", ["interpolate", ["linear"], ["zoom"], 13, 0.1, 16, 0.3, 18, 0.38]],
    ["building-3d", "fill-extrusion-color", "#263036"],
    ["building-3d", "fill-extrusion-opacity", ["interpolate", ["linear"], ["zoom"], 14, 0.12, 17, 0.28]],
    ["path", "line-color", "#303a3f"],
    ["road-motorway-casing", "line-color", "#0e2b43"],
    ["road-motorway-casing", "line-width", MOTORWAY_CASING_WIDTH],
    ["road-motorway", "line-color", "#347fc2"],
    ["road-motorway", "line-width", MOTORWAY_WIDTH],
    ["road-a-casing", "line-color", "#1a3d29"],
    ["road-a-casing", "line-width", A_ROAD_CASING_WIDTH],
    ["road-a", "line-color", "#4f9a68"],
    ["road-a", "line-width", A_ROAD_WIDTH],
    ["road-b-casing", "line-color", "#303b42"],
    ["road-b-casing", "line-width", B_ROAD_CASING_WIDTH],
    ["road-b", "line-color", "#718792"],
    ["road-b", "line-width", B_ROAD_WIDTH],
    ["road-local-casing", "line-color", NIGHT_LOCAL_CASING],
    ["road-local-casing", "line-width", LOCAL_ROAD_CASING_WIDTH],
    ["road-local", "line-color", NIGHT_LOCAL_FILL],
    ["road-local", "line-width", LOCAL_ROAD_WIDTH],
    ["road-name", "text-color", "#e2e7e9"],
    ["road-name", "text-halo-color", "#171d20"],
    ["road-name", "text-halo-width", 2.4],
    ["route-motorway", "text-color", "#f7fbff"],
    ["route-motorway", "text-halo-color", "#225e92"],
    ["route-a", "text-color", "#ffffff"],
    ["route-a", "text-halo-color", "#28573a"],
    ["route-a", "text-halo-width", 7],
    ["route-b", "text-color", "#ffffff"],
    ["route-b", "text-halo-color", "#526873"],
    ["route-b", "text-halo-width", 7],
    ["place", "text-color", "#b9c8ce"],
    ["place", "text-halo-color", "#0b0f11"],
  ],
};

export function applyMapTheme(map: maplibregl.Map, darkMode: boolean) {
  const theme = darkMode ? "night" : "day";
  for (const [layer, property, value] of MAP_THEME_PAINTS[theme] as Array<[string, string, unknown]>) {
    if (map.getLayer(layer)) map.setPaintProperty(layer, property, value as never);
  }
  if (map.getLayer("road-name")) {
    map.setLayoutProperty("road-name", "symbol-spacing", 275);
    map.setLayoutProperty("road-name", "text-padding", 0.5);
    map.setLayoutProperty("road-name", "text-allow-overlap", true);
    map.setLayoutProperty("road-name", "text-ignore-placement", false);
    map.setLayoutProperty("road-name", "text-optional", true);
    map.setLayoutProperty("road-name", "text-letter-spacing", 0.012);
    map.setLayoutProperty("road-name", "text-size", ["interpolate", ["linear"], ["zoom"], 13, 10.5, 15, 12.5, 17, 15.5, 19, 18]);
  }
  if (map.getLayer("place")) {
    map.setLayoutProperty("place", "text-letter-spacing", 0.025);
    map.setLayoutProperty("place", "text-size", ["interpolate", ["linear"], ["zoom"], 7, 12, 13, 17]);
  }
  const routeLayouts = [
    ["route-motorway", 260, ["interpolate", ["linear"], ["zoom"], 6, 12, 12, 15, 17, 18]],
    ["route-a", 250, ["interpolate", ["linear"], ["zoom"], 8, 11, 12, 14, 17, 17]],
    ["route-b", 285, ["interpolate", ["linear"], ["zoom"], 10, 10, 14, 13, 17, 15]],
  ] as const;
  for (const [layer, spacing, size] of routeLayouts) {
    if (map.getLayer(layer)) {
      map.setLayoutProperty(layer, "symbol-spacing", spacing);
      map.setLayoutProperty(layer, "text-size", size);
      map.setLayoutProperty(layer, "symbol-placement", "line-center");
      map.setLayoutProperty(layer, "text-rotation-alignment", "viewport");
      map.setLayoutProperty(layer, "text-pitch-alignment", "viewport");
      map.setLayoutProperty(layer, "text-rotate", 0);
      map.setLayoutProperty(layer, "text-allow-overlap", false);
      map.setLayoutProperty(layer, "text-ignore-placement", false);
    }
  }
}
