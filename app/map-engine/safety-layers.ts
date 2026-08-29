import type maplibregl from "maplibre-gl";
import type { Point } from "../lib/driving";
import type { SafetyFeatureCollection } from "../lib/safety";
import { distanceKm } from "./map-navigation";

const EMPTY_SAFETY_DATA: SafetyFeatureCollection = { type: "FeatureCollection", features: [] };
const TRAFFIC_LIGHT_IMAGE = "map-engine-traffic-light";
const ONE_WAY_ARROW_IMAGE = "map-engine-one-way-arrow";
const ROAD_CLOSURE_IMAGE = "map-engine-road-closure";
const ROADWORKS_IMAGE = "map-engine-roadworks";
const SPEED_BUMP_IMAGE = "map-engine-speed-bump";
const DRIVER_AMENITY_LAYERS = ["safety-clean-air-zone", "safety-ev-charger", "safety-parking"];

function pointToSegmentMetres(point: Point, start: [number, number], end: [number, number]) {
  const metresPerLatitudeDegree = 111_320;
  const metresPerLongitudeDegree = metresPerLatitudeDegree * Math.cos(point.latitude * Math.PI / 180);
  const startX = (start[0] - point.longitude) * metresPerLongitudeDegree;
  const startY = (start[1] - point.latitude) * metresPerLatitudeDegree;
  const endX = (end[0] - point.longitude) * metresPerLongitudeDegree;
  const endY = (end[1] - point.latitude) * metresPerLatitudeDegree;
  const segmentX = endX - startX;
  const segmentY = endY - startY;
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;
  const fraction = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(startX * segmentX + startY * segmentY) / lengthSquared));
  return Math.hypot(startX + fraction * segmentX, startY + fraction * segmentY);
}

export function speedLimitNearPoint(data: SafetyFeatureCollection | null, point: Point, maximumDistanceMetres = 35) {
  if (!data) return null;
  let nearestDistance = maximumDistanceMetres;
  let nearestLimit: number | null = null;
  for (const feature of data.features) {
    if (feature.properties.kind !== "speed_limit" || feature.geometry.type !== "LineString") continue;
    const limit = Number(feature.properties.label);
    if (!Number.isFinite(limit)) continue;
    for (let index = 1; index < feature.geometry.coordinates.length; index += 1) {
      const distance = pointToSegmentMetres(point, feature.geometry.coordinates[index - 1], feature.geometry.coordinates[index]);
      if (distance <= nearestDistance) {
        nearestDistance = distance;
        nearestLimit = limit;
      }
    }
  }
  return nearestLimit;
}

function createTrafficLightImage() {
  const pixelRatio = 3;
  const width = 18;
  const height = 34;
  const canvas = document.createElement("canvas");
  canvas.width = width * pixelRatio;
  canvas.height = height * pixelRatio;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.scale(pixelRatio, pixelRatio);
  const roundedRectangle = (x: number, y: number, rectangleWidth: number, rectangleHeight: number, radius: number) => {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + rectangleWidth - radius, y);
    context.quadraticCurveTo(x + rectangleWidth, y, x + rectangleWidth, y + radius);
    context.lineTo(x + rectangleWidth, y + rectangleHeight - radius);
    context.quadraticCurveTo(x + rectangleWidth, y + rectangleHeight, x + rectangleWidth - radius, y + rectangleHeight);
    context.lineTo(x + radius, y + rectangleHeight);
    context.quadraticCurveTo(x, y + rectangleHeight, x, y + rectangleHeight - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
  };
  roundedRectangle(0.75, 0.75, width - 1.5, height - 1.5, 4.5);
  context.fillStyle = "#080b0d";
  context.fill();
  context.lineWidth = 1.25;
  context.strokeStyle = "rgba(255,255,255,.92)";
  context.stroke();
  for (const [y, colour] of [[7.8, "#f12632"], [17, "#ffd451"], [26.2, "#48bd34"]] as const) {
    context.beginPath();
    context.arc(width / 2, y, 4.25, 0, Math.PI * 2);
    context.fillStyle = colour;
    context.fill();
    context.lineWidth = 0.7;
    context.strokeStyle = "#020304";
    context.stroke();
  }
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

function createOneWayArrowImage() {
  const pixelRatio = 3;
  const width = 22;
  const height = 14;
  const canvas = document.createElement("canvas");
  canvas.width = width * pixelRatio;
  canvas.height = height * pixelRatio;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.scale(pixelRatio, pixelRatio);
  context.beginPath();
  context.moveTo(1.5, 5);
  context.lineTo(12, 5);
  context.lineTo(12, 1.5);
  context.lineTo(20.5, 7);
  context.lineTo(12, 12.5);
  context.lineTo(12, 9);
  context.lineTo(1.5, 9);
  context.closePath();
  context.fillStyle = "#243b4b";
  context.fill();
  context.lineWidth = 1.4;
  context.strokeStyle = "rgba(255,255,255,.96)";
  context.stroke();
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

function createRoadClosureImage() {
  const pixelRatio = 3;
  const size = 26;
  const canvas = document.createElement("canvas");
  canvas.width = size * pixelRatio;
  canvas.height = size * pixelRatio;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.scale(pixelRatio, pixelRatio);
  context.translate(size / 2, size / 2);
  context.rotate(Math.PI / 4);
  context.fillStyle = "#df5948";
  context.strokeStyle = "#9f332b";
  context.lineWidth = 1.8;
  context.fillRect(-8, -8, 16, 16);
  context.strokeRect(-8, -8, 16, 16);
  context.rotate(-Math.PI / 4);
  context.fillStyle = "#ffffff";
  context.fillRect(-6, -1.6, 12, 3.2);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

function createRoadworksImage() {
  const pixelRatio = 3;
  const size = 26;
  const canvas = document.createElement("canvas");
  canvas.width = size * pixelRatio;
  canvas.height = size * pixelRatio;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.scale(pixelRatio, pixelRatio);
  context.beginPath();
  context.moveTo(13, 1.5);
  context.lineTo(21.5, 20);
  context.lineTo(4.5, 20);
  context.closePath();
  context.fillStyle = "#f2a513";
  context.strokeStyle = "#8a5a12";
  context.lineWidth = 1.5;
  context.fill();
  context.stroke();
  context.fillStyle = "#ffffff";
  context.fillRect(8.6, 10, 8.8, 3.1);
  context.fillRect(10.6, 15.5, 4.8, 2.7);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

function createSpeedBumpImage() {
  const pixelRatio = 3;
  const width = 22;
  const height = 16;
  const canvas = document.createElement("canvas");
  canvas.width = width * pixelRatio;
  canvas.height = height * pixelRatio;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.scale(pixelRatio, pixelRatio);
  context.fillStyle = "#f2f4f3";
  context.fillRect(0, 8.5, width, 7.5);
  context.fillStyle = "#c6ccca";
  context.fillRect(0, 11.5, width, 4.5);
  context.beginPath();
  context.arc(width / 2, 10.5, 5.2, Math.PI, 0);
  context.closePath();
  context.fillStyle = "#ffd451";
  context.strokeStyle = "#20272b";
  context.lineWidth = 1.3;
  context.fill();
  context.stroke();
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

export function ensureSafetyLayers(map: maplibregl.Map) {
  if (!map.getSource("safety-overlays")) map.addSource("safety-overlays", { type: "geojson", data: EMPTY_SAFETY_DATA as never });
  const trafficLightImage = createTrafficLightImage();
  if (trafficLightImage && !map.hasImage(TRAFFIC_LIGHT_IMAGE)) map.addImage(TRAFFIC_LIGHT_IMAGE, trafficLightImage, { pixelRatio: 3 });
  const oneWayArrowImage = createOneWayArrowImage();
  if (oneWayArrowImage && !map.hasImage(ONE_WAY_ARROW_IMAGE)) map.addImage(ONE_WAY_ARROW_IMAGE, oneWayArrowImage, { pixelRatio: 3 });
  const roadClosureImage = createRoadClosureImage();
  if (roadClosureImage && !map.hasImage(ROAD_CLOSURE_IMAGE)) map.addImage(ROAD_CLOSURE_IMAGE, roadClosureImage, { pixelRatio: 3 });
  const roadworksImage = createRoadworksImage();
  if (roadworksImage && !map.hasImage(ROADWORKS_IMAGE)) map.addImage(ROADWORKS_IMAGE, roadworksImage, { pixelRatio: 3 });
  const speedBumpImage = createSpeedBumpImage();
  if (speedBumpImage && !map.hasImage(SPEED_BUMP_IMAGE)) map.addImage(SPEED_BUMP_IMAGE, speedBumpImage, { pixelRatio: 3 });
  const before = map.getLayer("road-name") ? "road-name" : undefined;
  const add = (layer: maplibregl.LayerSpecification) => {
    if (!map.getLayer(layer.id)) map.addLayer(layer, before);
  };
  add({ id: "safety-restricted-casing", type: "line", source: "safety-overlays", minzoom: 13, filter: ["==", ["get", "kind"], "restricted"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#8a5965", "line-width": ["interpolate", ["linear"], ["zoom"], 13, 6, 17, 18], "line-opacity": 0.82 } });
  add({ id: "safety-restricted-line", type: "line", source: "safety-overlays", minzoom: 13, filter: ["==", ["get", "kind"], "restricted"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ef9db0", "line-width": ["interpolate", ["linear"], ["zoom"], 13, 3.5, 17, 11], "line-opacity": 0.86 } });
  add({ id: "safety-restricted-label", type: "symbol", source: "safety-overlays", minzoom: 13.5, filter: ["==", ["get", "kind"], "restricted"], layout: { "symbol-placement": "line", "symbol-spacing": 300, "text-field": ["get", "label"], "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 13.5, 7, 17, 10], "text-allow-overlap": true, "text-ignore-placement": true }, paint: { "text-color": "#59313c", "text-halo-color": "#f6becb", "text-halo-width": 4.5 } });
  add({ id: "safety-restriction-entry", type: "circle", source: "safety-overlays", minzoom: 13.5, filter: ["==", ["get", "kind"], "restriction_entrance"], paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 13.5, 5, 17, 8], "circle-color": "#ef9db0", "circle-stroke-color": "#8a5965", "circle-stroke-width": 2 } });
  add({ id: "safety-restriction-entry-label", type: "symbol", source: "safety-overlays", minzoom: 13.5, filter: ["==", ["get", "kind"], "restriction_entrance"], layout: { "text-field": "BUS\nGATE", "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 13.5, 7, 17, 9], "text-line-height": 0.9, "text-allow-overlap": true, "text-ignore-placement": true }, paint: { "text-color": "#59313c", "text-halo-color": "#f6becb", "text-halo-width": 4.5 } });
  add({ id: "safety-access-zone", type: "line", source: "safety-overlays", minzoom: 13.5, filter: ["==", ["get", "kind"], "access_zone"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#bd7a45", "line-width": ["interpolate", ["linear"], ["zoom"], 13.5, 3.2, 17, 7], "line-dasharray": [1.5, 1.2], "line-opacity": 0.78 } });
  add({ id: "safety-access-zone-label", type: "symbol", source: "safety-overlays", minzoom: 15, filter: ["==", ["get", "kind"], "access_zone"], layout: { "symbol-placement": "line", "symbol-spacing": 500, "text-field": ["get", "label"], "text-font": ["Noto Sans Regular"], "text-size": 8, "text-allow-overlap": false }, paint: { "text-color": "#5e4e42", "text-halo-color": "#fff8ed", "text-halo-width": 2.5 } });
  add({ id: "safety-road-closure-casing", type: "line", source: "safety-overlays", minzoom: 11.5, filter: ["==", ["get", "kind"], "road_closure"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#8f3029", "line-width": ["interpolate", ["linear"], ["zoom"], 11.5, 5, 17, 15], "line-opacity": 0.96 } });
  add({ id: "safety-road-closure-line", type: "line", source: "safety-overlays", minzoom: 11.5, filter: ["==", ["get", "kind"], "road_closure"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#df5948", "line-width": ["interpolate", ["linear"], ["zoom"], 11.5, 3, 17, 10], "line-opacity": 0.98 } });
  add({ id: "safety-road-closure-markers", type: "symbol", source: "safety-overlays", minzoom: 12.5, filter: ["==", ["get", "kind"], "road_closure"], layout: { "symbol-placement": "line", "symbol-spacing": ["interpolate", ["linear"], ["zoom"], 12.5, 90, 18, 140], "icon-image": ROAD_CLOSURE_IMAGE, "icon-size": ["interpolate", ["linear"], ["zoom"], 12.5, 0.72, 18, 1], "icon-rotation-alignment": "viewport", "icon-pitch-alignment": "viewport", "icon-allow-overlap": true, "icon-ignore-placement": true } });
  add({ id: "safety-road-closure-label", type: "symbol", source: "safety-overlays", minzoom: 14, filter: ["==", ["get", "kind"], "road_closure"], layout: { "symbol-placement": "line", "symbol-spacing": 420, "text-field": ["get", "label"], "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 14, 8, 18, 11], "text-offset": [0, 1.2], "text-allow-overlap": false }, paint: { "text-color": "#8f3029", "text-halo-color": "#fff7f3", "text-halo-width": 3 } });
  add({ id: "safety-roadworks-casing", type: "line", source: "safety-overlays", minzoom: 11.5, filter: ["==", ["get", "kind"], "roadworks"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#8a5a12", "line-width": ["interpolate", ["linear"], ["zoom"], 11.5, 5, 17, 14], "line-opacity": 0.92 } });
  add({ id: "safety-roadworks-line", type: "line", source: "safety-overlays", minzoom: 11.5, filter: ["==", ["get", "kind"], "roadworks"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#f2a513", "line-width": ["interpolate", ["linear"], ["zoom"], 11.5, 2.8, 17, 9], "line-dasharray": [4, 2], "line-opacity": 0.96 } });
  add({ id: "safety-roadworks-markers", type: "symbol", source: "safety-overlays", minzoom: 12.5, filter: ["==", ["get", "kind"], "roadworks"], layout: { "symbol-placement": "line", "symbol-spacing": ["interpolate", ["linear"], ["zoom"], 12.5, 110, 18, 170], "icon-image": ROADWORKS_IMAGE, "icon-size": ["interpolate", ["linear"], ["zoom"], 12.5, 0.68, 18, 0.95], "icon-rotation-alignment": "viewport", "icon-pitch-alignment": "viewport", "icon-allow-overlap": true, "icon-ignore-placement": true } });
  add({ id: "safety-roadworks-label", type: "symbol", source: "safety-overlays", minzoom: 14, filter: ["==", ["get", "kind"], "roadworks"], layout: { "symbol-placement": "line", "symbol-spacing": 400, "text-field": ["get", "label"], "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 14, 8, 18, 11], "text-allow-overlap": false }, paint: { "text-color": "#7a4e08", "text-halo-color": "#fff6dd", "text-halo-width": 3 } });
  add({ id: "safety-speed-bump", type: "symbol", source: "safety-overlays", minzoom: 13.5, filter: ["==", ["get", "kind"], "speed_bump"], layout: { "icon-image": SPEED_BUMP_IMAGE, "icon-size": ["interpolate", ["linear"], ["zoom"], 13.5, 0.85, 18, 1.1], "icon-allow-overlap": true, "icon-ignore-placement": true, "icon-pitch-alignment": "viewport", "icon-rotation-alignment": "viewport" } });
  add({ id: "safety-speed-bump-label", type: "symbol", source: "safety-overlays", minzoom: 14.5, filter: ["==", ["get", "kind"], "speed_bump"], layout: { "text-field": "BUMP", "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 14.5, 7, 18, 9], "text-offset": [0, 1.5], "text-allow-overlap": false }, paint: { "text-color": "#3d4a42", "text-halo-color": "#ffffff", "text-halo-width": 3 } });
  add({ id: "safety-one-way-arrows", type: "symbol", source: "openmaptiles", "source-layer": "transportation", minzoom: 13.5, filter: ["all", ["has", "oneway"], ["match", ["to-string", ["get", "oneway"]], ["1", "-1", "true", "yes"], true, false], ["match", ["get", "class"], ["motorway", "trunk", "primary", "secondary"], false, true]], layout: { "symbol-placement": "line", "symbol-spacing": ["interpolate", ["linear"], ["zoom"], 13.5, 74, 18, 120], "icon-image": ONE_WAY_ARROW_IMAGE, "icon-size": ["interpolate", ["linear"], ["zoom"], 13.5, 0.8, 18, 1.05], "icon-rotate": ["case", ["==", ["to-string", ["get", "oneway"]], "-1"], 180, 0], "icon-rotation-alignment": "map", "icon-pitch-alignment": "map", "icon-keep-upright": false, "icon-allow-overlap": true, "icon-ignore-placement": true } });
  add({ id: "safety-speed-limit", type: "symbol", source: "safety-overlays", minzoom: 14.5, filter: ["==", ["get", "kind"], "speed_limit"], layout: { "symbol-placement": "line", "symbol-spacing": 760, "text-field": ["get", "label"], "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 14.5, 8, 18, 11], "text-allow-overlap": false, "text-ignore-placement": false }, paint: { "text-color": "#15191c", "text-halo-color": "#ffffff", "text-halo-width": 3.5 } });
  add({ id: "safety-no-entry-disc", type: "circle", source: "safety-overlays", minzoom: 14, filter: ["==", ["get", "kind"], "no_entry"], paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 14, 5, 18, 8], "circle-color": "#d93636", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 } });
  add({ id: "safety-no-entry-bar", type: "symbol", source: "safety-overlays", minzoom: 14, filter: ["==", ["get", "kind"], "no_entry"], layout: { "text-field": "−", "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 14, 10, 18, 15], "text-allow-overlap": true, "text-ignore-placement": true }, paint: { "text-color": "#ffffff" } });
  add({ id: "safety-turn-restriction", type: "symbol", source: "safety-overlays", minzoom: 15, filter: ["==", ["get", "kind"], "turn_restriction"], layout: { "text-field": ["get", "label"], "text-font": ["Noto Sans Regular"], "text-size": 8, "text-offset": [0, 1.1], "text-allow-overlap": false }, paint: { "text-color": "#9c2028", "text-halo-color": "#fff6f6", "text-halo-width": 3 } });
  add({ id: "safety-rail-crossing", type: "symbol", source: "safety-overlays", minzoom: 13.5, filter: ["==", ["get", "kind"], "rail_crossing"], layout: { "text-field": ["concat", "⚠\n", ["get", "label"]], "text-font": ["Noto Sans Regular"], "text-size": 10, "text-line-height": 0.85, "text-allow-overlap": false }, paint: { "text-color": "#24282b", "text-halo-color": "#ffd95a", "text-halo-width": 4 } });
  add({ id: "safety-dimension-limit", type: "symbol", source: "safety-overlays", minzoom: 13.5, filter: ["==", ["get", "kind"], "dimension_limit"], layout: { "text-field": ["get", "label"], "text-font": ["Noto Sans Regular"], "text-size": 9, "text-allow-overlap": false }, paint: { "text-color": "#8d1d25", "text-halo-color": "#ffffff", "text-halo-width": 4 } });
  add({ id: "safety-clean-air-zone", type: "symbol", source: "safety-overlays", minzoom: 10, filter: ["==", ["get", "kind"], "clean_air_zone"], layout: { "visibility": "none", "text-field": ["get", "label"], "text-font": ["Noto Sans Regular"], "text-size": 10, "text-allow-overlap": false }, paint: { "text-color": "#155844", "text-halo-color": "#dff7eb", "text-halo-width": 4 } });
  add({ id: "safety-ev-charger", type: "symbol", source: "safety-overlays", minzoom: 14.5, filter: ["==", ["get", "kind"], "ev_charger"], layout: { "visibility": "none", "text-field": "EV", "text-font": ["Noto Sans Regular"], "text-size": 10, "text-allow-overlap": false }, paint: { "text-color": "#ffffff", "text-halo-color": "#267b63", "text-halo-width": 4 } });
  add({ id: "safety-parking", type: "symbol", source: "safety-overlays", minzoom: 15, filter: ["==", ["get", "kind"], "parking"], layout: { "visibility": "none", "text-field": "P", "text-font": ["Noto Sans Regular"], "text-size": 10, "text-allow-overlap": false }, paint: { "text-color": "#ffffff", "text-halo-color": "#2d69a7", "text-halo-width": 4 } });
  add({ id: "safety-signal-icon", type: "symbol", source: "safety-overlays", minzoom: 13, filter: ["==", ["get", "kind"], "traffic_signal"], layout: { "icon-image": TRAFFIC_LIGHT_IMAGE, "icon-size": ["interpolate", ["linear"], ["zoom"], 13, 0.8, 17, 1.15], "icon-allow-overlap": true, "icon-ignore-placement": true, "icon-pitch-alignment": "viewport", "icon-rotation-alignment": "viewport" } });
  add({ id: "safety-camera", type: "circle", source: "safety-overlays", minzoom: 12.5, filter: ["==", ["get", "kind"], "speed_camera"], paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 12.5, 9, 17, 13], "circle-color": "#ffd34d", "circle-stroke-color": "#20272b", "circle-stroke-width": 2.5 } });
  add({ id: "safety-camera-lens", type: "circle", source: "safety-overlays", minzoom: 12.5, filter: ["==", ["get", "kind"], "speed_camera"], paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 12.5, 3, 17, 5], "circle-color": "#20272b", "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.2 } });
  add({ id: "safety-camera-label", type: "symbol", source: "safety-overlays", minzoom: 13, filter: ["==", ["get", "kind"], "speed_camera"], layout: { "text-field": "CAM", "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 13, 7, 17, 9], "text-offset": [0, 2.1], "text-allow-overlap": true, "text-ignore-placement": true }, paint: { "text-color": "#20272b", "text-halo-color": "#ffd34d", "text-halo-width": 2.5 } });
  if (map.getLayer("safety-signal-icon")) map.moveLayer("safety-signal-icon");
}

export function setDriverAmenitiesVisibility(map: maplibregl.Map, visible: boolean) {
  for (const layer of DRIVER_AMENITY_LAYERS) {
    if (map.getLayer(layer)) map.setLayoutProperty(layer, "visibility", visible ? "visible" : "none");
  }
}

export function setSafetyData(map: maplibregl.Map, data: SafetyFeatureCollection) {
  const source = map.getSource("safety-overlays") as maplibregl.GeoJSONSource | undefined;
  source?.setData(data as never);
}

export function mergeSafetyData(...collections: Array<SafetyFeatureCollection | null | undefined>): SafetyFeatureCollection {
  const features: SafetyFeatureCollection["features"] = [];
  const featureIds = new Set<string>();
  const trafficSignals: Point[] = [];
  for (const feature of collections.flatMap((collection) => collection?.features ?? [])) {
    if (featureIds.has(feature.id)) continue;
    if (feature.properties.kind === "traffic_signal" && feature.geometry.type === "Point") {
      const point = { latitude: feature.geometry.coordinates[1], longitude: feature.geometry.coordinates[0] };
      if (trafficSignals.some((candidate) => distanceKm(point, candidate) < 0.012)) continue;
      trafficSignals.push(point);
    }
    featureIds.add(feature.id);
    features.push(feature);
  }
  return { type: "FeatureCollection", features };
}
