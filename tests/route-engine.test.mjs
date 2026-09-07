import test from "node:test";
import assert from "node:assert/strict";

const core = await import("../app/lib/route-engine-core.ts");
const safety = await import("../app/lib/safety.ts");
const layers = await import("../app/map-engine/safety-layers.ts");

const node = (id, latitude, longitude) => ({ id, latitude, longitude });
const way = (id, highway, nodes, tags = {}) => ({ id, highway, tags, nodes });

test("weights penalise minor and narrow rural roads", () => {
  const primary = core.roadWeightPerMetre("primary", {});
  const unclassified = core.roadWeightPerMetre("unclassified", {});
  const track = core.roadWeightPerMetre("track", { surface: "gravel" });
  assert.ok(primary < unclassified);
  assert.ok(unclassified < track);
  assert.ok(core.roadWeightPerMetre("tertiary", { width: "4.2" }) > core.roadWeightPerMetre("tertiary", {}));
  assert.ok(core.roadWeightPerMetre("tertiary", { lanes: "1" }) > core.roadWeightPerMetre("tertiary", {}));
  assert.ok(core.roadWeightPerMetre("primary", { access: "no" }) > primary);
});

test("one-way, roundabout and two-way roads build directed edges", () => {
  const nodes = new Map([
    [1, node(1, 52.0, -2.0)],
    [2, node(2, 52.0, -2.001)],
    [3, node(3, 52.0, -2.002)],
  ]);
  const graph = core.buildRoadGraph([
    way(10, "tertiary", [1, 2], { oneway: "yes" }),
    way(11, "tertiary", [2, 3], {}),
    way(12, "primary", [1, 3], { junction: "roundabout" }),
  ], nodes);
  assert.equal(graph.adjacency.get(1)?.some((edge) => edge.to === 2), true);
  assert.equal(graph.adjacency.get(2)?.some((edge) => edge.to === 1), false);
  assert.equal(graph.adjacency.get(2)?.some((edge) => edge.to === 3), true);
  assert.equal(graph.adjacency.get(3)?.some((edge) => edge.to === 2), true);
  assert.equal(graph.adjacency.get(3)?.filter((edge) => edge.wayId === 12).length, 0);
  assert.equal(graph.adjacency.get(1)?.filter((edge) => edge.wayId === 12).length, 1);
  assert.equal(core.isMinorRoad("track"), true);
  assert.equal(core.isMinorRoad("primary"), false);
});

test("fast profile prefers a pseudo main road over a shorter direct lane", () => {
  const { nodes, ways } = profileFixture();
  const graph = core.buildRoadGraph(ways, nodes);
  const path = core.findShortestPath(graph, 1, 6);
  assert.ok(path);
  assert.equal(path.some((edge) => edge.wayId === 20), true);
  assert.equal(path.some((edge) => edge.wayId === 21), true);
  assert.equal(path.some((edge) => edge.wayId === 22), true);
  assert.equal(path.some((edge) => edge.wayId === 27), false);
  const plan = core.computeRoutePlan(path, graph);
  assert.ok(plan);
  assert.ok(plan.metres > 0);
  assert.ok(plan.durationSeconds > 0);
  assert.ok(plan.minorMetres > 0);
  assert.ok(plan.finalMinorMetres > 0 && plan.finalMinorMetres <= plan.minorMetres);
  const disconnected = core.findShortestPath(graph, 1, 7);
  assert.equal(disconnected, null);
});

test("fast, short and avoid-lanes profiles choose different roads", () => {
  const { nodes, ways } = profileFixture();
  const fast = core.findShortestPath(core.buildRoadGraph(ways, nodes, "fast"), 1, 6);
  const short = core.findShortestPath(core.buildRoadGraph(ways, nodes, "short"), 1, 6);
  const avoid = core.findShortestPath(core.buildRoadGraph(ways, nodes, "avoid-lanes"), 1, 6);
  assert.ok(fast && short && avoid);
  assert.equal(fast.some((edge) => edge.wayId === 20), true);
  assert.equal(fast.some((edge) => edge.wayId === 27), false);
  assert.equal(short.some((edge) => edge.wayId === 27), true);
  assert.equal(short.some((edge) => edge.wayId === 20), false);
  assert.equal(avoid.some((edge) => edge.wayId === 20), true);
  assert.equal(avoid.some((edge) => edge.wayId === 27), false);
  assert.ok(core.roadWeightPerMetre("track", {}, "fast") < core.roadWeightPerMetre("track", {}, "avoid-lanes"));
  assert.equal(core.roadWeightPerMetre("motorway", {}, "short"), core.roadWeightPerMetre("unclassified", {}, "short"));
  assert.ok(core.roadWeightPerMetre("tertiary", { lanes: "1" }) > core.roadWeightPerMetre("tertiary", {}));
});

test("evaluateRouteProfiles returns all three options from one corridor", () => {
  const { nodes, ways } = profileFixture();
  const origin = { latitude: 52.0, longitude: -2.0 };
  const destination = { latitude: 52.0, longitude: -2.0046 };
  const evaluated = core.evaluateRouteProfiles(ways, nodes, origin, destination);
  assert.ok(evaluated.fast);
  assert.ok(evaluated.short);
  assert.ok(evaluated["avoid-lanes"]);
  assert.ok(evaluated.fast.distanceMiles > 0);
  assert.ok(evaluated.fast.durationMinutes > 0);
  assert.ok(evaluated.fast.coordinates[0][0] === origin.longitude);
  assert.ok(evaluated.short.distanceMiles < evaluated.fast.distanceMiles);
  assert.ok(evaluated["avoid-lanes"].distanceMiles <= evaluated.fast.distanceMiles * 1.5);
  assert.ok(evaluated.fast.finalMinorRoadMiles > 0);
});

function profileFixture() {
  const nodes = new Map([
    [1, node(1, 52.0, -2.0)],
    [2, node(2, 52.0004, -2.001)],
    [3, node(3, 52.0004, -2.004)],
    [6, node(6, 52.0, -2.0046)],
    [7, node(7, 52.1, -3.0)],
    [8, node(8, 52.1, -3.001)],
  ]);
  const ways = [
    way(20, "trunk", [1, 2], {}),
    way(21, "trunk", [2, 3], {}),
    way(22, "track", [3, 6], {}),
    way(27, "track", [1, 6], {}),
    way(26, "primary", [7, 8], {}),
  ];
  return { nodes, ways };
}

test("first-turn instruction arrives at a three-way junction", () => {
  const nodes = new Map([
    [1, node(1, 51.999, -2.0000)],
    [2, node(2, 52.000, -2.0000)],
    [3, node(3, 52.000, -1.9992)],
    [4, node(4, 52.000, -2.0008)],
  ]);
  const graph = core.buildRoadGraph([
    way(30, "primary", [1, 2], {}),
    way(31, "primary", [2, 3], { name: "Main Street" }),
    way(32, "primary", [2, 4], {}),
  ], nodes);
  const path = core.findShortestPath(graph, 1, 3);
  assert.ok(path);
  const instruction = core.buildTurnInstruction(path, graph);
  assert.ok(instruction);
  assert.equal(instruction.arrow, "↱");
  assert.equal(instruction.road, "Main Street");
  assert.ok(instruction.distanceMiles > 0);
});

test("camera enforcement direction is read from a fixed camera direction tag", () => {
  const nodeCamera = { type: "node", id: 1, tags: { highway: "speed_camera", direction: "230" } };
  assert.equal(safety.cameraEnforcementDirection(nodeCamera), 230);
  assert.equal(safety.cameraEnforcementDirection({ type: "node", id: 2, tags: { highway: "speed_camera", direction: "475" } }), 115);
  assert.equal(safety.cameraEnforcementDirection({ type: "node", id: 3, tags: { highway: "speed_camera" } }), null);
  assert.equal(safety.cameraEnforcementDirection({ type: "node", id: 4, tags: { highway: "speed_camera", direction: "north" } }), null);
});

test("camera enforcement direction follows the segment geometry of an enforcement way", () => {
  const westToEast = {
    type: "way", id: 5, tags: { enforcement: "speed" },
    geometry: [{ lat: 52.0, lon: -2.0 }, { lat: 52.0, lon: -1.9 }],
  };
  const direction = safety.cameraEnforcementDirection(westToEast);
  assert.ok(Math.abs((direction ?? -1) - 90) < 1, `expected eastwards (~90) but got ${direction}`);
});

test("camera enforcement direction follows the from/to members of an enforcement relation", () => {
  const relation = {
    type: "relation", id: 6, tags: { type: "enforcement", enforcement: "average_speed" },
    members: [
      { type: "node", ref: 10, role: "from", lat: 52.0, lon: -1.0 },
      { type: "node", ref: 11, role: "via", lat: 52.0, lon: -0.99 },
      { type: "node", ref: 12, role: "to", lat: 52.0, lon: -0.95 },
    ],
  };
  const direction = safety.cameraEnforcementDirection(relation);
  assert.ok(Math.abs((direction ?? -1) - 90) < 1, `expected eastwards (~90) but got ${direction}`);
});

test("traffic signals are filtered to the corridor of travel ahead", () => {
  const position = { latitude: 52.0, longitude: -2.0, bearing: 90, speedMph: 30 };
  const signal = (id, latitude, longitude) => ({
    type: "Feature",
    id,
    geometry: { type: "Point", coordinates: [longitude, latitude] },
    properties: { kind: "traffic_signal" },
  });
  const bump = {
    type: "Feature",
    id: "bump-t",
    geometry: { type: "Point", coordinates: [-2.0, 52.01] },
    properties: { kind: "speed_bump" },
  };
  const data = {
    type: "FeatureCollection",
    features: [
      signal("signal-ahead", 52.0, -1.999),
      signal("signal-toofar", 52.0, -1.98),
      signal("signal-side", 52.006, -2.0),
      signal("signal-behind", 52.0, -2.004),
      signal("signal-mismatch", 52.0, -1.997),
      signal("signal-main", 52.0, -1.996),
      signal("signal-unnamed", 52.0, -1.995),
      bump,
    ],
  };
  const roads = {
    "-1.997": "High Street",
    "-1.996": "Main Street",
  };
  const filtered = layers.filterSignalsToTravelCorridor(data, {
    position,
    bearing: 90,
    currentRoad: "Main Street",
    roadNameAt: (point) => roads[String(point.longitude)] ?? null,
  });
  const kept = filtered.features.map((feature) => feature.id);
  assert.deepEqual(kept, ["signal-ahead", "signal-main", "signal-unnamed", "bump-t"]);

  const unfiltered = layers.filterSignalsToTravelCorridor(data, { position, bearing: 90, currentRoad: null });
  const idsWithoutRoad = unfiltered.features.map((feature) => feature.id);
  assert.deepEqual(idsWithoutRoad, ["signal-ahead", "signal-mismatch", "signal-main", "signal-unnamed", "bump-t"]);
});

const navigation = await import("../app/map-engine/map-navigation.ts");

function landmark(id, name, latitude, longitude) {
  return { id, name, category: "supermarket", latitude, longitude };
}

test("landmarksAhead ranks landmarks inside the forward cone by distance", () => {
  const fix = { latitude: 52.0, longitude: -2.0, bearing: 0, accuracy: 10, speedMph: 30 };
  const visible = navigation.landmarksAhead(fix, [
    landmark("l1", "TESCO EXTRA", 52.001, -2.0),
    landmark("l2", "BMW", 52.006, -2.0),
    landmark("l3", "THE CROWN", 52.011, -2.0),
    landmark("l4", "east-petrol", 52.0, -1.99),
    landmark("l5", "behind-pub", 51.99, -2.0),
    landmark("l6", "far-and-missing", 52.08, -2.0),
  ]);
  const ids = visible.map((entry) => entry.id);
  assert.deepEqual(ids, ["l1", "l2", "l3"]);
  assert.ok(visible[0].miles < visible[1].miles);
  assert.ok(visible[1].miles < visible[2].miles);
  assert.ok(visible[0].name === "TESCO EXTRA");
});

test("landmarksAhead drops passed and out-of-cone landmarks, and honours the limit", () => {
  const fix = { latitude: 52.0, longitude: -2.0, bearing: 90, accuracy: 10, speedMph: 30 };
  const ahead = navigation.landmarksAhead(fix, [
    landmark("north", "NORTH", 52.006, -2.0),
    landmark("south", "SOUTH", 51.994, -2.0),
    landmark("west", "WEST", 52.0, -2.004),
    landmark("east", "EAST", 52.0, -1.99),
  ]);
  const ids = ahead.map((entry) => entry.id);
  assert.deepEqual(ids, ["east"]);
  assert.equal(ahead[0].relativeDegrees <= 45, true);

  const limited = navigation.landmarksAhead(fix, [
    landmark("a", "A", 52.0, -1.967),
    landmark("b", "B", 52.0, -1.977),
    landmark("c", "C", 52.0, -1.987),
    landmark("d", "D", 52.0, -1.997),
  ]);
  assert.equal(limited.length, 3);
  assert.equal(limited[2].id, "b");
});

test("landmarksAhead keeps only the nearest label inside a 500 metre cluster", () => {
  const fix = { latitude: 52.0, longitude: -2.0, bearing: 0, accuracy: 10, speedMph: 30 };
  const visible = navigation.landmarksAhead(fix, [
    landmark("near-1", "TESCO", 52.001, -2.0),
    landmark("near-2", "ASDA", 52.0018, -2.0),
    landmark("further", "MCDONALDS", 52.007, -2.0),
  ], 3, 45, 5, 500);
  assert.deepEqual(visible.map((entry) => entry.id), ["near-1", "further"]);
});