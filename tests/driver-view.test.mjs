import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const roadAhead = await import("../app/driver-view/DriverViewRoad.ts");

test("Driver View ships as an isolated, feature-flagged module", async () => {
  const [config, screen, boundary, view, adapter, renderer, scene, barrel, css, road, mapEngine] = await Promise.all([
    readFile(new URL("../app/driver-view/DriverViewConfig.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/driver-view/DriverViewScreen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/driver-view/DriverViewErrorBoundary.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/driver-view/DriverView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/driver-view/DriverViewAdapter.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/driver-view/DriverViewRenderer.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/driver-view/DriverViewScene.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/driver-view/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/driver-view/driver-view.css", import.meta.url), "utf8"),
    readFile(new URL("../app/driver-view/DriverViewRoad.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/MapEngine.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(config, /export const ENABLE_DRIVER_VIEW = true/);
  assert.match(mapEngine, /app\/driver-view|driver-view/);
  assert.match(adapter, /createDriverViewData/);

  assert.match(boundary, /class DriverViewErrorBoundary extends Component/);
  assert.match(boundary, /getDerivedStateFromError/);
  assert.match(view, /DriverViewErrorBoundary/);
  assert.match(view, /DriverViewScreen/);

  assert.match(screen, /aria-label="Driver View \(experimental\)"/);
  assert.match(screen, /className="driver-view-exit"/);
  assert.match(screen, /DriverViewScene controls=\{sceneControlsRef\}/);
  assert.match(view, /className="driver-view-toggle/);
  assert.match(scene, /className="driver-view-scene-canvas"/);
  assert.match(scene, /ResizeObserver/);
  assert.match(renderer, /export function buildScene/);
  assert.match(renderer, /export function renderScene/);
  assert.match(renderer, /export function localiseRoute/);
  assert.match(renderer, /function drawBlock/);
  assert.match(renderer, /function drawRoad/);
  assert.match(renderer, /function drawRouteRibbon/);
  assert.match(renderer, /function buildEvents/);
  assert.match(renderer, /function drawSignboard/);
  assert.match(renderer, /function drawTrafficLight/);
  assert.match(renderer, /function drawJunctionOverlay/);
  assert.match(renderer, /function drawJunctions/);
  assert.match(adapter, /SceneControls = \{/);
  assert.match(adapter, /position: \{ lat: number; lon: number; bearing: number \} \| null/);
  assert.match(adapter, /route: Array<\[number, number\]>/);
  assert.match(adapter, /routeSteps: RouteStep\[\]/);
  assert.match(adapter, /roadContext: RoadAhead \| null/);
  assert.match(adapter, /ApproachInfo = \{/);
  assert.match(road, /export const DRIVABLE_HIGHWAY/);
  assert.match(road, /export function roadContextBounds/);
  assert.match(road, /export async function fetchRoadContext/);
  assert.match(road, /export function resolveRoadAhead/);
  assert.match(screen, /fetchRoadContext/);
  assert.match(screen, /resolveRoadAhead/);
  assert.match(screen, /roadContext: roadContextRef\.current/);
  assert.match(screen, /position: props\.fix \? \{ lat: props\.fix\.lat, lon: props\.fix\.lon, bearing: props\.fix\.bearing \} : null/);
  assert.match(screen, /route: props\.route\?\.geometry\?\.coordinates \?\? \[\]/);
  assert.match(screen, /routeSteps: props\.route\?\.steps \?\? \[\]/);
  assert.match(screen, /onApproach=\{setApproach\}/);
  assert.match(screen, /driver-view-approach/);
  assert.match(scene, /onApproach\?: \(info: ApproachInfo \| null\) => void/);
  assert.match(css, /\.driver-view-approach \{/);
  assert.match(css, /\.driver-view-scene \{/);
  assert.match(css, /\.driver-view-scene-canvas \{/);

  assert.match(barrel, /export \{ DriverView \}/);
});

test("resolveRoadAhead traces the road the vehicle is driving on with its junction names", () => {
  const elements = [
    { type: "node", id: 1, lat: 51.0, lon: -2.0 },
    { type: "node", id: 2, lat: 51.0002, lon: -2.0 },
    { type: "node", id: 3, lat: 51.0005, lon: -1.9996 },
    { type: "node", id: 9, lat: 51.0002, lon: -2.0, tags: { highway: "traffic_signals" } },
    { type: "way", id: 30, nodes: [1, 2, 3], tags: { highway: "primary", name: "Main Street" } },
  ];
  const resolved = roadAhead.resolveRoadAhead(elements, { lat: 51.0, lon: -2.0 }, 0);
  assert.ok(resolved);
  assert.equal(resolved.roadName, "Main Street");
  assert.ok(resolved.trace.length >= 3);
  assert.equal(resolved.steps.length, 1);
  assert.equal(resolved.steps[0].arrow, "↱");
  assert.equal(resolved.steps[0].road, "Main Street");
  assert.ok(resolved.steps[0].metres > 0);
  assert.ok(resolved.signals.some(([lon, lat]) => lon === -2.0 && lat === 51.0002));
});