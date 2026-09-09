import type { RouteStep } from "../lib/routing.ts";
import {
  buildRoadGraph,
  distanceMetres,
  snapNearestNode,
  type DirectedEdge,
  type GraphNode,
  type GraphWay,
} from "../lib/route-engine-core.ts";
import { fetchOverpass } from "../lib/safety.ts";
import { localiseRoute } from "./DriverViewRenderer.ts";

export const DRIVABLE_HIGHWAY = "^motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|residential|living_street|service|track|road$";

export type RoadJunction = {
  metres: number;
  side: 1 | -1;
  name: string | null;
};

export const BUILDING_KINDS = ["house", "apartments", "shop", "office", "industrial", "civic", "other"] as const;
export type BuildingKind = (typeof BUILDING_KINDS)[number];

export type RoadAhead = {
  trace: Array<[number, number]>;
  steps: RouteStep[];
  signals: Array<[number, number]>;
  buildings: Array<{ ring: Array<[number, number]>; height: number; kind: BuildingKind }>;
  junctions: RoadJunction[];
  roadName: string | null;
};

export type RealBuilding = { ring: Array<[number, number]>; height: number; kind: BuildingKind };

type RoadElement = {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  nodes?: number[];
};

function bearingBetweenNodes(from: GraphNode, to: GraphNode): number {
  return (Math.atan2(to.longitude - from.longitude, to.latitude - from.latitude) * 180 / Math.PI + 360) % 360;
}

function angleDeviation(from: number, to: number): number {
  let deviation = to - from;
  while (deviation > 180) deviation -= 360;
  while (deviation < -180) deviation += 360;
  return Math.abs(deviation);
}

function signedAngle(from: number, to: number): number {
  let deviation = to - from;
  while (deviation > 180) deviation -= 360;
  while (deviation < -180) deviation += 360;
  return deviation;
}

export function roadContextBounds(position: { lat: number; lon: number }, headingDegrees: number, aheadMetres = 1600, halfWidthMetres = 850): { south: number; west: number; north: number; east: number } {
  const radians = (headingDegrees * Math.PI) / 180;
  const cosLat = Math.cos((position.lat * Math.PI) / 180);
  const centreLat = position.lat + (aheadMetres * 0.6 * Math.cos(radians)) / 111320;
  const centreLon = position.lon + (aheadMetres * 0.6 * Math.sin(radians)) / (111320 * cosLat);
  const latPad = halfWidthMetres / 111320;
  const lonPad = halfWidthMetres / (111320 * cosLat);
  return {
    south: centreLat - latPad,
    west: centreLon - lonPad,
    north: centreLat + latPad,
    east: centreLon + lonPad,
  };
}

export async function fetchRoadContext(position: { lat: number; lon: number }, headingDegrees: number, signal: AbortSignal): Promise<RoadElement[]> {
  const bounds = roadContextBounds(position, headingDegrees);
  const query = `[out:json][timeout:20];(` +
    `way["highway"~"${DRIVABLE_HIGHWAY}"](${bounds.south.toFixed(5)},${bounds.west.toFixed(5)},${bounds.north.toFixed(5)},${bounds.east.toFixed(5)});` +
    `node["highway"="traffic_signals"](${bounds.south.toFixed(5)},${bounds.west.toFixed(5)},${bounds.north.toFixed(5)},${bounds.east.toFixed(5)});` +
    `node["highway"="mini_roundabout"](${bounds.south.toFixed(5)},${bounds.west.toFixed(5)},${bounds.north.toFixed(5)},${bounds.east.toFixed(5)});` +
    `way["building"](${bounds.south.toFixed(5)},${bounds.west.toFixed(5)},${bounds.north.toFixed(5)},${bounds.east.toFixed(5)});` +
    `);(._;>;);out body 1600;`;
  try {
    const payload = await fetchOverpass(query, 0, 1400, signal, 10_000);
    const elements = payload?.elements as RoadElement[] | undefined;
    return Array.isArray(elements) ? elements : [];
  } catch {
    return [];
  }
}

function buildCornerSteps(local: Array<{ x: number; z: number }>, wayAt: number[], graph: ReturnType<typeof buildRoadGraph>): RouteStep[] {
  const steps: RouteStep[] = [];
  if (local.length < 2) return steps;
  let heading: number | null = null;
  let metres = 0;
  let runSum = 0;
  let runIndex = -1;
  let runActive = false;
  let runDistance = 0;
  const finishRun = () => {
    if (runActive && Math.abs(runSum) >= 8) {
      const roundabout = Math.abs(runSum) >= 150 && runDistance <= 200;
      const index = Math.min(runIndex, wayAt.length - 1);
      const info = graph.wayInfo.get(wayAt[index] ?? 0);
      const road = info?.name || info?.ref || (roundabout ? "Roundabout" : "Next road");
      const arrow = roundabout ? "↻" : runSum > 0 ? "↱" : "↰";
      steps.push({ arrow, road, metres });
    }
    runActive = false;
    runSum = 0;
    runIndex = -1;
    runDistance = 0;
  };
  for (let i = 1; i < local.length; i += 1) {
    const dx = local[i].x - local[i - 1].x;
    const dz = local[i].z - local[i - 1].z;
    metres += Math.hypot(dx, dz);
    if (Math.hypot(dx, dz) < 0.05) continue;
    let current = Math.atan2(dx, dz);
    if (heading === null) {
      heading = current;
      continue;
    }
    let delta = current - heading;
    heading = current;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    const degrees = (delta * 180) / Math.PI;
    if (Math.abs(degrees) >= 8) {
      if (runActive && Math.sign(runSum) !== Math.sign(degrees)) finishRun();
      if (!runActive) {
        runIndex = i;
        runActive = true;
        runSum = degrees;
        runDistance = Math.hypot(dx, dz);
      } else {
        runSum += degrees;
        runDistance += Math.hypot(dx, dz);
      }
    } else {
      finishRun();
    }
  }
  finishRun();
  return steps;
}

function buildingKind(tags?: Record<string, string>): BuildingKind {
  const building = tags?.building;
  if (!building) return "other";
  if (tags?.shop || building === "retail" || building === "kiosk" || building === "supermarket" || building === "mall" || building === "department_store") return "shop";
  if (tags?.office || building === "office" || building === "commercial" || building === "bank") return "office";
  if (building === "apartments" || building === "apartment" || building === "flats" || building === "hotel" || building === "residential" || building === "dormitory") return "apartments";
  if (building === "warehouse" || building === "industrial" || building === "garage" || building === "garages" || building === "factory" || building === "manufacture" || building === "shed" || building === "storage" || building === "depot") return "industrial";
  if (building === "church" || building === "cathedral" || building === "chapel" || building === "mosque" || building === "school" || building === "hospital" || building === "university" || building === "college" || building === "civic" || building === "public" || building === "government") return "civic";
  return "house";
}

function buildingHeight(tags?: Record<string, string>): number {
  const metres = parseFloat(tags?.height ?? "");
  if (Number.isFinite(metres) && metres > 0) return Math.min(60, Math.max(3, metres));
  const levels = parseFloat(tags?.["building:levels"] ?? "");
  if (Number.isFinite(levels) && levels > 0) return Math.min(60, Math.max(3, levels * 3));
  return 6.5;
}

function ringFromNodes(wayNodes: number[], nodes: Map<number, GraphNode>): Array<[number, number]> {
  const ring: Array<[number, number]> = [];
  for (const id of wayNodes) {
    const node = nodes.get(id);
    if (!node) continue;
    const point: [number, number] = [node.longitude, node.latitude];
    const last = ring[ring.length - 1];
    if (last && Math.abs(last[0] - point[0]) < 1e-9 && Math.abs(last[1] - point[1]) < 1e-9) continue;
    ring.push(point);
  }
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first && last && first !== last && Math.abs(last[0] - first[0]) < 1e-9 && Math.abs(last[1] - first[1]) < 1e-9) ring.pop();
  return ring;
}

function nearestTraceMetres(lon: number, lat: number, coordinates: Array<[number, number]>): number {
  let best = Infinity;
  for (let i = 0; i < coordinates.length; i += 1) {
    const point = { latitude: coordinates[i][1], longitude: coordinates[i][0] };
    best = Math.min(best, distanceMetres({ latitude: lat, longitude: lon }, point));
    if (i === 0) continue;
    const previous = coordinates[i - 1];
    best = Math.min(
      best,
      distanceMetres(
        { latitude: lat, longitude: lon },
        { latitude: (previous[1] + coordinates[i][1]) / 2, longitude: (previous[0] + coordinates[i][0]) / 2 },
      ),
    );
  }
  return best;
}

function detectJunctions(graph: ReturnType<typeof buildRoadGraph>, trace: number[], nodes: Map<number, GraphNode>): RoadJunction[] {
  const junctions: RoadJunction[] = [];
  if (trace.length < 3) return junctions;
  const metresAt: number[] = [0];
  for (let i = 1; i < trace.length; i += 1) {
    const from = nodes.get(trace[i - 1]);
    const to = nodes.get(trace[i]);
    metresAt.push(metresAt[i - 1] + (from && to ? distanceMetres(from, to) : 0));
  }
  for (let i = 1; i < trace.length - 1; i += 1) {
    const id = trace[i];
    const previousId = trace[i - 1];
    const nextId = trace[i + 1];
    const here = nodes.get(id);
    const previous = nodes.get(previousId);
    if (!here || !previous) continue;
    const inbound = bearingBetweenNodes(previous, here);
    for (const edge of graph.adjacency.get(id) ?? []) {
      if (edge.to === previousId || edge.to === nextId) continue;
      const next = nodes.get(edge.to);
      if (!next) continue;
      const deviation = signedAngle(inbound, bearingBetweenNodes(here, next));
      if (Math.abs(deviation) < 10 || Math.abs(deviation) > 170) continue;
      const info = graph.wayInfo.get(edge.wayId);
      junctions.push({ metres: metresAt[i], side: deviation > 0 ? 1 : -1, name: info?.name || info?.ref || null });
    }
  }
  return junctions;
}

function collectBuildings(elements: RoadElement[], nodes: Map<number, GraphNode>, coordinates: Array<[number, number]>): Array<{ ring: Array<[number, number]>; height: number; kind: BuildingKind }> {
  const buildings: Array<{ ring: Array<[number, number]>; height: number; kind: BuildingKind }> = [];
  for (const element of elements) {
    if (element.type !== "way" || !element.tags?.["building"] || !Array.isArray(element.nodes)) continue;
    const ring = ringFromNodes(element.nodes, nodes);
    if (ring.length < 3) continue;
    let lon = 0;
    let lat = 0;
    for (const [l, a] of ring) {
      lon += l;
      lat += a;
    }
    lon /= ring.length;
    lat /= ring.length;
    if (nearestTraceMetres(lon, lat, coordinates) > 60) continue;
    buildings.push({ ring, height: buildingHeight(element.tags), kind: buildingKind(element.tags) });
    if (buildings.length >= 60) break;
  }
  return buildings;
}

export function resolveRoadAhead(elements: RoadElement[], position: { lat: number; lon: number }, headingDegrees: number): RoadAhead | null {
  const nodes = new Map<number, GraphNode>();
  const ways: GraphWay[] = [];
  const signals: Array<[number, number]> = [];
  for (const element of elements) {
    if (element.type === "node" && typeof element.lat === "number" && typeof element.lon === "number" && typeof element.id === "number") {
      if (element.tags?.highway === "traffic_signals" || element.tags?.highway === "mini_roundabout") signals.push([element.lon, element.lat]);
      nodes.set(element.id, { id: element.id, latitude: element.lat, longitude: element.lon });
    } else if (element.type === "way" && element.tags?.highway && Array.isArray(element.nodes) && element.nodes.length > 1 && typeof element.id === "number") {
      ways.push({ id: element.id, highway: element.tags.highway, tags: element.tags, nodes: element.nodes });
    }
  }
  if (ways.length === 0 || nodes.size === 0) return null;
  const graph = buildRoadGraph(ways, nodes, "fast");
  const point = { latitude: position.lat, longitude: position.lon };
  const start = snapNearestNode(graph, point, 350);
  if (start === null) return null;
  const heading = ((headingDegrees % 360) + 360) % 360;
  const startNode = graph.nodes.get(start);
  if (!startNode) return null;
  let firstEdge: DirectedEdge | null = null;
  let firstDeviation = Infinity;
  for (const edge of graph.adjacency.get(start) ?? []) {
    const to = graph.nodes.get(edge.to);
    if (!to) continue;
    const deviation = angleDeviation(bearingBetweenNodes(startNode, to), heading);
    if (deviation > 110) continue;
    if (deviation < firstDeviation) {
      firstDeviation = deviation;
      firstEdge = edge;
    }
  }
  if (!firstEdge) return null;
  const trace: number[] = [start];
  const wayAt: number[] = [];
  const visited = new Set<number>([start]);
  let current = firstEdge.to;
  wayAt.push(firstEdge.wayId);
  let guard = 0;
  while (guard++ < 200 && visited.size < 180) {
    const previous = trace[trace.length - 1];
    if (visited.has(current)) break;
    visited.add(current);
    trace.push(current);
    const currentNode = graph.nodes.get(current);
    const previousNode = graph.nodes.get(previous);
    if (!currentNode || !previousNode) break;
    if (distanceMetres(point, currentNode) > 2400) break;
    const inbound = bearingBetweenNodes(previousNode, currentNode);
    const edges = graph.adjacency.get(current) ?? [];
    let chosen: DirectedEdge | null = null;
    let chosenDeviation = Infinity;
    for (const edge of edges) {
      if (edge.to === previous) continue;
      const next = graph.nodes.get(edge.to);
      if (!next) continue;
      const deviation = angleDeviation(bearingBetweenNodes(currentNode, next), inbound);
      if (deviation < chosenDeviation) {
        chosenDeviation = deviation;
        chosen = edge;
      }
    }
    if (!chosen) break;
    wayAt.push(chosen.wayId);
    current = chosen.to;
  }
  const coordinates: Array<[number, number]> = [];
  for (const id of trace) {
    const node = graph.nodes.get(id);
    if (node) coordinates.push([node.longitude, node.latitude]);
  }
  if (coordinates.length < 2) return null;
  const local = localiseRoute(coordinates, position, heading, 950);
  const steps = buildCornerSteps(local, wayAt, graph);
  const firstInfo = graph.wayInfo.get(wayAt[0] ?? 0);
  return {
    trace: coordinates,
    steps,
    signals,
    buildings: collectBuildings(elements, nodes, coordinates),
    junctions: detectJunctions(graph, trace, nodes),
    roadName: firstInfo?.name || firstInfo?.ref || null,
  };
}