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
  assert.match(scene, /buildScene/);
  assert.match(scene, /renderScene/);
  assert.match(scene, /computeApproach/);
  assert.match(renderer, /export function localiseRoute/);
  assert.match(renderer, /export function zAtMetres/);
  assert.match(renderer, /export function buildEvents/);
  assert.match(renderer, /export function computeApproach/);
  assert.match(renderer, /export function buildScene/);
  assert.match(renderer, /export function renderScene/);
  assert.match(renderer, /const CAM_H = 1\.5/);
  assert.match(renderer, /horizon: Math\.round\(height \* 0\.45\)/);
  assert.match(renderer, /BUILDING_COLOURS:/);
  assert.match(renderer, /footprint\.kind/);
  assert.match(renderer, /export const ROAD_FIRST/);
  assert.match(renderer, /function drawRoundabouts/);
  assert.match(renderer, /\.roundabouts = \[\]/);
  assert.match(renderer, /rb\.ring\.map\(\(point\) => project\(scene, point\.x, point\.z\)\)/);
  assert.match(renderer, /function drawJunctionMouths/);
  assert.match(renderer, /mouthHalf = 2\.6/);
  assert.match(renderer, /branch\.kind === "side"/);
  assert.match(renderer, /edgeBreaks/);
  assert.match(renderer, /DEFAULT_HEIGHTS/);
  assert.match(renderer, /function drawPavements/);
  assert.match(renderer, /quad\.kind === "shop"/);
  assert.match(renderer, /quad\.kind === "office"/);
  assert.match(renderer, /quad\.kind === "civic"/);
  assert.match(renderer, /function drawBranchLabels/);
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
  assert.match(road, /way\["building"\]\(/);
  assert.match(road, /buildings: Array<\{ ring: Array<\[number, number\]>; height: number; kind: BuildingKind \}>/);
  assert.match(road, /RoadJunction/);
  assert.match(road, /junctions: RoadJunction\[\]/);
  assert.match(road, /detectJunctions/);
  assert.match(road, /RoundaboutData/);
  assert.match(road, /roundabouts: RoundaboutData\[\]/);
  assert.match(road, /detectRoundabouts/);
  assert.match(road, /junction !== "roundabout"/);
  assert.match(road, /radiusMetres/);
  assert.match(road, /roundabouts: detectRoundabouts/);
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
  assert.match(renderer, /side: 1 \| -1/);
  assert.match(renderer, /side: runSum > 0 \? 1 : -1/);
  assert.match(renderer, /export function zAtMetres/);
  assert.match(renderer, /export function buildEvents/);
  assert.match(renderer, /export function computeApproach/);

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

test("resolveRoadAhead includes the real buildings beside the road and drops far ones", () => {
  const elements = [
    { type: "node", id: 1, lat: 51.0, lon: -2.0 },
    { type: "node", id: 2, lat: 51.0, lon: -1.9995 },
    { type: "node", id: 11, lat: 51.0001, lon: -2.0003 },
    { type: "node", id: 12, lat: 51.0001, lon: -2.0001 },
    { type: "node", id: 13, lat: 51.0002, lon: -2.0001 },
    { type: "node", id: 14, lat: 51.0002, lon: -2.0003 },
    { type: "node", id: 21, lat: 51.002, lon: -1.996 },
    { type: "node", id: 22, lat: 51.002, lon: -1.9959 },
    { type: "node", id: 23, lat: 51.0021, lon: -1.9959 },
    { type: "node", id: 24, lat: 51.0021, lon: -1.996 },
    { type: "way", id: 100, nodes: [1, 2], tags: { highway: "residential", name: "Building Lane" } },
    { type: "way", id: 200, nodes: [11, 12, 13, 14, 11], tags: { building: "house", "building:levels": "3" } },
    { type: "way", id: 300, nodes: [21, 22, 23, 24, 21], tags: { building: "yes" } },
  ];
  const resolved = roadAhead.resolveRoadAhead(elements, { lat: 51.0, lon: -2.0 }, 90);
  assert.ok(resolved);
  assert.equal(resolved.buildings.length, 1, "only the building beside the road is kept, the 220 m one is dropped");
  assert.equal(resolved.buildings[0].ring.length, 4, "the footprint ring is preserved as lon/lat pairs");
  assert.equal(resolved.buildings[0].height, 9, "height comes from building:levels (3 storeys)");
  assert.equal(resolved.buildings[0].kind, "house", "building=house is classified as a house");
  const [lon, lat] = resolved.buildings[0].ring[0];
  assert.ok(Math.abs(lon - -2.0003) < 1e-6 && Math.abs(lat - 51.0001) < 1e-6);
});

test("resolveRoadAhead detects side roads branching left and right from the trace", () => {
  const elements = [
    { type: "node", id: 1, lat: 51.0, lon: -2.0 },
    { type: "node", id: 2, lat: 51.0002, lon: -2.0 },
    { type: "node", id: 3, lat: 51.0005, lon: -1.9996 },
    { type: "node", id: 4, lat: 51.0002, lon: -2.0003 },
    { type: "node", id: 5, lat: 51.0002, lon: -1.9997 },
    { type: "way", id: 30, nodes: [1, 2, 3], tags: { highway: "primary", name: "Main Street" } },
    { type: "way", id: 40, nodes: [2, 4], tags: { highway: "residential", name: "Acacia Avenue" } },
    { type: "way", id: 50, nodes: [2, 5], tags: { highway: "tertiary", name: "Cross Lane" } },
  ];
  const resolved = roadAhead.resolveRoadAhead(elements, { lat: 51.0, lon: -2.0 }, 0);
  assert.ok(resolved);
  assert.ok(resolved.junctions.length >= 2, "the left and right side roads are both detected");
  const left = resolved.junctions.find((j) => j.side === -1);
  const right = resolved.junctions.find((j) => j.side === 1);
  assert.ok(left, "Acacia Avenue branches to the left when heading north");
  assert.ok(left.metres > 0 && left.metres < 60, "the junction is within 60 m of the start");
  assert.equal(left.name, "Acacia Avenue");
  assert.ok(right, "Cross Lane branches to the right");
  assert.equal(right.name, "Cross Lane");
});

test("resolveRoadAhead extracts a real roundabout ring with its island radius and named exits", () => {
  const ringLat = 51.0002;
  const ringLon = -2.0;
  const rLat = 0.00022;
  const rLon = 0.0003;
  const ringNodes = [
    [ringLat + rLat, ringLon],
    [ringLat + rLat / 2, ringLon + rLon * 0.87],
    [ringLat - rLat / 2, ringLon + rLon * 0.87],
    [ringLat - rLat, ringLon],
    [ringLat - rLat / 2, ringLon - rLon * 0.87],
    [ringLat + rLat / 2, ringLon - rLon * 0.87],
  ];
  const elements = [
    { type: "node", id: 1, lat: 51.0, lon: -2.0 },
    { type: "node", id: 2, lat: 51.0001, lon: -2.0 },
    ...ringNodes.map(([lat, lon], index) => ({ type: "node", id: 11 + index, lat, lon })),
    { type: "node", id: 21, lat: 51.00031, lon: -1.9995 },
    { type: "way", id: 100, nodes: [1, 2, 11], tags: { highway: "residential", name: "Approach Road" } },
    { type: "way", id: 200, nodes: [11, 12, 13, 14, 15, 16, 11], tags: { highway: "secondary", junction: "roundabout" } },
    { type: "way", id: 300, nodes: [12, 21], tags: { highway: "tertiary", name: "Harborne Road" } },
  ];
  const resolved = roadAhead.resolveRoadAhead(elements, { lat: 51.0, lon: -2.0 }, 0);
  assert.ok(resolved);
  assert.equal(resolved.roundabouts.length, 1, "the roundabout way is extracted");
  const rb = resolved.roundabouts[0];
  assert.ok(rb.ring.length >= 5, "the ring is kept as a real polygon");
  assert.ok(rb.radiusMetres > 10 && rb.radiusMetres < 40, `island radius ${rb.radiusMetres} matches the ring extent`);
  assert.ok(Math.abs(rb.centre[0] - ringLon) < 0.0001 && Math.abs(rb.centre[1] - ringLat) < 0.0001, "the centre sits inside the ring");
  const exit = rb.exits.find((e) => e.name === "Harborne Road");
  assert.ok(exit, "the spoke road becomes a named exit");
  assert.ok(Math.abs(exit.join[0] - (ringLon + rLon * 0.87)) < 0.0001, "the exit joins the ring at its shared node");
  assert.ok(Math.abs(exit.outward[0] - -1.9995) < 0.0001 && Math.abs(exit.outward[1] - 51.00031) < 0.0001, "the exit points away from the ring");
});

test("a junction is recognisable from geometry alone even when its street name is hidden", async () => {
  const branch = {
    z: 40,
    side: 1,
    kind: "side",
    name: null,
    cross: false,
  };
  const gaps = renderer.edgeBreaks([branch], 1);
  assert.equal(gaps.length, 1, "the side road breaks the edge line into a gap");
  assert.ok(Math.abs(gaps[0][0] - (40 - 2.6)) < 1e-9, "the boundary opens 2.6 m before the junction");
  assert.ok(Math.abs(gaps[0][1] - (40 + 2.6)) < 1e-9, "the boundary opens 2.6 m after the junction");
  const opposite = renderer.edgeBreaks([branch], -1);
  assert.equal(opposite.length, 0, "only the side the road is on gets the opening");
  const mouths = (await readFile(new URL("../app/driver-view/DriverViewRenderer.ts", import.meta.url), "utf8")).match(/function drawJunctionMouths[\s\S]*?\n}/);
  assert.ok(mouths, "the renderer draws the joining road surface at each side-road mouth");
  assert.match(mouths[0], /branch\.kind !== "side"/, "geometry opens regardless of the street name");
});

test("zAtMetres interpolates local depth and computeApproach reports the next junction", () => {
  const points = [
    { x: 0, z: 0 },
    { x: 0, z: 100 },
  ];
  assert.equal(renderer.zAtMetres(points, 0), 0);
  assert.equal(renderer.zAtMetres(points, 100), 100);
  assert.ok(Math.abs(renderer.zAtMetres(points, 40) - 40) < 0.01);
  const approach = renderer.computeApproach(
    [
      [-2.0, 51.0],
      [-2.0, 51.0003],
      [-1.9997, 51.0003],
    ],
    { lat: 51.0, lon: -2.0 },
    0,
    [{ arrow: "↱", road: "Acacia Avenue", metres: 40 }],
  );
  assert.ok(approach, "the corner ahead is detected");
  assert.equal(approach.label, "Acacia Avenue");
  assert.equal(approach.arrow, "↱");
  assert.equal(approach.kind, "junction");
  assert.ok(approach.metres >= 30 && approach.metres <= 75, `approach distance ${approach.metres} sits at the corner`);
  const none = renderer.computeApproach([[-2.0, 51.0], [-2.0, 51.0001]], { lat: 51.0, lon: -2.0 }, 0, []);
  assert.equal(none, null, "a straight road with no steps reports no approach");
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