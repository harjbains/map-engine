import test from "node:test";
import assert from "node:assert/strict";

const core = await import("../app/lib/route-engine-core.ts");

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