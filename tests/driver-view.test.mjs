import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const roadAhead = await import("../app/driver-view/DriverViewRoad.ts");
const simulator = await import("../app/driver-view/DriverViewSimulator.ts");
const renderer = await import("../app/driver-view/DriverViewRenderer.ts");

test("Driver View ships as an isolated, feature-flagged module", async () => {
  const [config, screen, boundary, view, adapter, renderer, scene, barrel, css, road, simulatorFile, mapEngine] = await Promise.all([
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
    readFile(new URL("../app/driver-view/DriverViewSimulator.ts", import.meta.url), "utf8"),
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
  assert.match(simulatorFile, /export class DriverViewSimulation/);
  assert.match(simulatorFile, /advance\(seconds: number, priorSpeedMph: number\)/);
  assert.match(simulatorFile, /positionAt\(metresAlong: number\)/);
  assert.match(screen, /new DriverViewSimulation\(/);
  assert.match(screen, /driver-view-sim/);
  assert.match(screen, /SIMULATION/);
  assert.match(screen, /driver-view-road-status/);
  assert.match(screen, /roadStatus/);
  assert.match(screen, /fetchRoadContext/);
  assert.match(screen, /resolveRoadAhead/);
  assert.match(screen, /roadContext: roadContextRef\.current/);
  assert.match(screen, /position: effectiveFix \? \{ lat: effectiveFix\.lat, lon: effectiveFix\.lon, bearing: effectiveFix\.bearing \} : null/);
  assert.match(screen, /route: props\.route\?\.geometry\?\.coordinates \?\? \[\]/);
  assert.match(screen, /routeSteps: props\.route\?\.steps \?\? \[\]/);
  assert.match(screen, /onApproach=\{setApproach\}/);
  assert.match(screen, /driver-view-approach/);
  assert.match(scene, /onApproach\?: \(info: ApproachInfo \| null\) => void/);
  assert.match(css, /\.driver-view-approach \{/);
  assert.match(css, /\.driver-view-scene \{/);
  assert.match(css, /\.driver-view-scene-canvas \{/);
  assert.match(renderer, /headingCur/);
  assert.match(renderer, /scene\.headingCur/);

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

test("localiseRoute keeps corner vertices so the road bends instead of cutting straight through", () => {
  const position = { lat: 51.0, lon: -2.0 };
  const points = renderer.localiseRoute(
    [
      [-2.0, 51.0],
      [-2.0, 51.001],
      [-1.9995, 51.001],
    ],
    position,
    0,
    950,
  );
  assert.equal(points.length, 3, "the corner point and the road beyond it must not be merged away");
  assert.ok(Math.abs(points[1].z - points[2].z) < 10, "the turning vertex is at nearly the same depth as the corner");
  assert.ok(points[2].x > 10, "the road beyond the corner is kept and bends east");
  const merged = renderer.localiseRoute(
    [
      [-2.0, 51.0],
      [-2.0, 51.000005],
      [-1.999995, 51.000005],
    ],
    position,
    0,
    950,
  );
  assert.ok(merged.length < 3, "sub-metre jitter from dense OSM nodes is still merged away");
});

test("DriverViewSimulation follows the route at each road's max speed", () => {
  const coordinates = [
    [-2.0, 51.0],
    [-2.0, 51.0045],
    [-1.99286, 51.0045],
  ];
  const { DriverViewSimulation } = simulator;
  const simulation = new DriverViewSimulation(coordinates, [30, 40]);
  assert.ok(simulation.totalMetres > 990 && simulation.totalMetres < 1015);
  const start = simulation.advance(10, 0);
  assert.ok(start);
  assert.equal(start.speedMph, 30, "speed eases up to and clamps at the first road's max speed");
  assert.equal(start.targetMph, 30);
  assert.ok(Math.abs(start.metresAlong - 30 * 0.44704 * 10) < 5, `expected ~134 m travelled, got ${start.metresAlong}`);
  assert.ok(Math.abs((start.bearing + 360) % 360) < 1, "starts travelling north on the first segment");
  let fix = start;
  for (let index = 0; index < 40; index += 1) {
    const next = simulation.advance(3, fix.speedMph);
    if (!next) break;
    fix = next;
  }
  assert.equal(fix.targetMph, 40, "the second stretch is a 40 mph road");
  assert.ok(Math.abs((fix.bearing + 360) % 360 - 90) < 1, "now travelling east along the second road");
  assert.ok(fix.speedMph > 30, "speed has eased past 30 mph towards the 40 mph road max");
});

test("DriverViewSimulation advances to the road end and then reports it is finished", () => {
  const { DriverViewSimulation } = simulator;
  const simulation = new DriverViewSimulation([[-2.0, 51.0], [-2.0, 51.001]], [20]);
  let fix = null;
  let steps = 0;
  for (let index = 0; index < 10_000; index += 1) {
    const next = simulation.advance(1, fix?.speedMph ?? 0);
    steps = index + 1;
    if (!next) break;
    fix = next;
  }
  assert.ok(steps < 10_000, "the loop must end rather than advancing past the road");
  assert.ok(fix);
  assert.ok(fix.remainingMetres < 10, `the last fix should sit within one tick of the road end, got ${fix.remainingMetres}`);
  assert.equal(simulation.remainingMetres, 0);
  assert.equal(simulation.advance(1, 0), null);
});