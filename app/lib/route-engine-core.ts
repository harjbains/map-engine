export type RoutePoint = { latitude: number; longitude: number };

export type RouteProfile = "fast" | "short" | "avoid-lanes";

export type WayTags = Record<string, string>;

export type GraphWay = {
  id: number;
  highway: string;
  tags: WayTags;
  nodes: number[];
};

export type GraphNode = { id: number; latitude: number; longitude: number };

export type RoadClass =
  | "motorway"
  | "trunk"
  | "primary"
  | "secondary"
  | "tertiary"
  | "unclassified"
  | "residential"
  | "living_street"
  | "service"
  | "track"
  | "road";

export type DirectedEdge = {
  to: number;
  weight: number;
  wayId: number;
};

export type TraversedEdge = {
  from: number;
  to: number;
  wayId: number;
  metres: number;
};

export type RoutePlan = {
  coordinates: RoutePoint[];
  metres: number;
  durationSeconds: number;
  minorMetres: number;
  finalMinorMetres: number;
};

export type TurnInstruction = {
  arrow: string;
  road: string;
  distanceMiles: number;
};

const CLASS_SPEED_MPH: Record<RoadClass, number> = {
  motorway: 65,
  trunk: 58,
  primary: 44,
  secondary: 39,
  tertiary: 34,
  unclassified: 22,
  residential: 19,
  living_street: 10,
  service: 14,
  track: 11,
  road: 16,
};

const CLASS_PENALTY: Record<RoadClass, number> = {
  motorway: 1,
  trunk: 1,
  primary: 1,
  secondary: 1.05,
  tertiary: 1.15,
  unclassified: 1.95,
  residential: 2.25,
  living_street: 3.4,
  service: 3.1,
  track: 5.2,
  road: 2.7,
};

const CLASS_PENALTY_FAST: Record<RoadClass, number> = {
  motorway: 1,
  trunk: 1,
  primary: 1.05,
  secondary: 1.1,
  tertiary: 1.2,
  unclassified: 1.35,
  residential: 1.5,
  living_street: 2.2,
  service: 2,
  track: 3,
  road: 1.8,
};

const CLASS_PENALTY_SHORT: Record<RoadClass, number> = {
  motorway: 1,
  trunk: 1,
  primary: 1,
  secondary: 1,
  tertiary: 1,
  unclassified: 1,
  residential: 1,
  living_street: 1.35,
  service: 1,
  track: 1,
  road: 1,
};

const MINOR_CLASSES = new Set<RoadClass>(["unclassified", "residential", "living_street", "service", "track", "road"]);

export function roadClassOf(highway: string): RoadClass | null {
  const base = (highway ?? "").replace(/_link$/, "");
  if (base in CLASS_SPEED_MPH) return base as RoadClass;
  return null;
}

export function isMinorRoad(highway: string): boolean {
  const roadClass = roadClassOf(highway);
  return roadClass ? MINOR_CLASSES.has(roadClass) : true;
}

export function classSpeedMph(highway: string): number {
  const roadClass = roadClassOf(highway);
  return roadClass ? CLASS_SPEED_MPH[roadClass] : 8;
}

export function classPenalty(highway: string, profile: RouteProfile = "fast"): number {
  const roadClass = roadClassOf(highway);
  if (!roadClass) return profile === "fast" ? 14 : 1;
  if (profile === "short") return CLASS_PENALTY_SHORT[roadClass];
  if (profile === "avoid-lanes") return CLASS_PENALTY[roadClass];
  return CLASS_PENALTY_FAST[roadClass];
}

export function distanceMetres(a: RoutePoint, b: RoutePoint): number {
  const earthRadius = 6_371_000;
  const latitudeDelta = (b.latitude - a.latitude) * Math.PI / 180;
  const longitudeDelta = (b.longitude - a.longitude) * Math.PI / 180;
  const latitudeA = a.latitude * Math.PI / 180;
  const latitudeB = b.latitude * Math.PI / 180;
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function parseWidth(tags: WayTags): number | null {
  const raw = tags.width ?? tags.est_width;
  if (!raw) return null;
  const numeric = raw.match(/(\d+(?:\.\d+)?)/);
  return numeric ? Number(numeric[1]) : null;
}

export function roadModifiers(tags: WayTags, profile: RouteProfile = "fast"): number {
  let factor = 1;
  const width = parseWidth(tags);
  if (width !== null) {
    if (profile === "avoid-lanes") {
      if (width < 3.2) factor *= 1.9;
      else if (width <= 4.5) factor *= 1.35;
    } else if (profile === "fast") {
      if (width < 3.2) factor *= 1.35;
      else if (width <= 4.5) factor *= 1.15;
    }
  }
  if (tags.lanes === "1") factor *= profile === "short" ? 1.05 : (profile === "avoid-lanes" ? 1.3 : 1.15);
  const surface = tags.surface ?? "";
  if (/(cobblestone|pebblestone|gravel|dirt|earth|ground|grass|mud|sand|clay|paved)$/.test(surface)) {
    factor *= profile === "short" ? 1.2 : (profile === "avoid-lanes" ? 1.55 : 1.35);
  }
  if (tags.highway === "track" && tags.tracktype) {
    const rating: Record<string, number> = { grade1: 0.9, grade2: 1, grade3: 1.6, grade4: 2.7, grade5: 3.6 };
    const base = rating[tags.tracktype] ?? 1.2;
    factor *= profile === "short" ? 1 + (base - 1) * 0.35 : (profile === "avoid-lanes" ? base : 1 + (base - 1) * 0.5);
  }
  return factor;
}

export function isAccessRestricted(tags: WayTags): boolean {
  return [tags.access, tags.vehicle, tags.motor_vehicle, tags.motorcar]
    .some((value) => /^(no|private)$/.test(value ?? ""));
}

export function accessPenalty(tags: WayTags): number {
  if (/^(no|private)$/.test(tags.access ?? "") || /^(no|private)$/.test(tags.vehicle ?? "")) return 6;
  if (/^(no|private)$/.test(tags.motor_vehicle ?? "") || /^(no|private)$/.test(tags.motorcar ?? "")) return 10;
  return 1;
}

export function roadWeightPerMetre(highway: string, tags: WayTags, profile: RouteProfile = "fast"): number {
  let secondsPerMetre = 1 / (classSpeedMph(highway) * 0.44704);
  if (profile === "short") secondsPerMetre = 1 / (38 * 0.44704);
  return secondsPerMetre * classPenalty(highway, profile) * roadModifiers(tags, profile) * accessPenalty(tags);
}

export function oneWayOf(highway: string, tags: WayTags): 1 | 0 | -1 {
  const value = tags.oneway ?? "";
  if (value === "yes" || value === "true" || value === "1") return 1;
  if (value === "-1" || value === "reverse") return -1;
  if (value === "no" || value === "false" || value === "0") return 0;
  if (tags.junction === "roundabout") return 1;
  if (highway === "motorway" || highway === "motorway_link") return 1;
  return 0;
}

export type RoadGraph = {
  adjacency: Map<number, DirectedEdge[]>;
  wayInfo: Map<number, { highway: string; name: string; ref: string; metres: number }>;
  nodes: Map<number, GraphNode>;
};

function polylineMetres(way: GraphWay, nodes: Map<number, GraphNode>): number {
  let metres = 0;
  for (let index = 1; index < way.nodes.length; index += 1) {
    const from = nodes.get(way.nodes[index - 1]);
    const to = nodes.get(way.nodes[index]);
    if (from && to) metres += distanceMetres(from, to);
  }
  return metres;
}

export function buildRoadGraph(ways: GraphWay[], nodes: Map<number, GraphNode>, profile: RouteProfile = "fast"): RoadGraph {
  const adjacency = new Map<number, DirectedEdge[]>();
  const wayInfo = new Map<number, { highway: string; name: string; ref: string; metres: number }>();
  const pushEdge = (from: number, to: number, weight: number, wayId: number) => {
    const edges = adjacency.get(from);
    if (edges) edges.push({ to, weight, wayId });
    else adjacency.set(from, [{ to, weight, wayId }]);
  };

  for (const way of ways) {
    if (!roadClassOf(way.highway) || way.nodes.length < 2) continue;
    if (!way.nodes.every((id) => nodes.has(id))) continue;
    const weightPerMetre = roadWeightPerMetre(way.highway, way.tags, profile);
    const metres = polylineMetres(way, nodes);
    if (!Number.isFinite(weightPerMetre) || !Number.isFinite(metres) || metres <= 0) continue;
    wayInfo.set(way.id, {
      highway: way.highway,
      name: (way.tags.name ?? "").trim(),
      ref: (way.tags.ref ?? "").trim(),
      metres,
    });
    const direction = oneWayOf(way.highway, way.tags);
    for (let index = 1; index < way.nodes.length; index += 1) {
      const fromNode = way.nodes[index - 1];
      const toNode = way.nodes[index];
      const from = nodes.get(fromNode);
      const to = nodes.get(toNode);
      if (!from || !to) continue;
      const segmentMetres = distanceMetres(from, to);
      const weight = segmentMetres * weightPerMetre;
      if (direction >= 0) pushEdge(fromNode, toNode, weight, way.id);
      if (direction <= 0) pushEdge(toNode, fromNode, weight, way.id);
    }
  }
  return { adjacency, wayInfo, nodes };
}

export function snapNearestNode(graph: Pick<RoadGraph, "nodes">, point: RoutePoint, maxMetres = 900): number | null {
  let closest: number | null = null;
  let closestMetres = maxMetres;
  for (const [id, node] of graph.nodes) {
    const distance = distanceMetres(point, node);
    if (distance <= closestMetres) {
      closestMetres = distance;
      closest = id;
    }
  }
  return closest;
}

type HeapEntry = { node: number; cost: number };

class MinHeap {
  private items: HeapEntry[] = [];

  push(entry: HeapEntry) {
    const items = this.items;
    items.push(entry);
    let index = items.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (items[parent].cost <= items[index].cost) break;
      [items[parent], items[index]] = [items[index], items[parent]];
      index = parent;
    }
  }

  pop(): HeapEntry | null {
    const items = this.items;
    if (!items.length) return null;
    const head = items[0];
    const tail = items.pop() as HeapEntry;
    if (items.length) {
      items[0] = tail;
      let index = 0;
      for (;;) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (left < items.length && items[left].cost < items[smallest].cost) smallest = left;
        if (right < items.length && items[right].cost < items[smallest].cost) smallest = right;
        if (smallest === index) break;
        [items[smallest], items[index]] = [items[index], items[smallest]];
        index = smallest;
      }
    }
    return head;
  }

  get size() {
    return this.items.length;
  }
}

export function findShortestPath(graph: RoadGraph, startId: number, goalId: number): TraversedEdge[] | null {
  if (startId === goalId) return [];
  const previous = new Map<number, { from: number; edge: DirectedEdge }>();
  const bestCost = new Map<number, number>();
  const visited = new Set<number>();
  const heap = new MinHeap();
  heap.push({ node: startId, cost: 0 });
  while (heap.size) {
    const current = heap.pop();
    if (!current || visited.has(current.node)) continue;
    if (current.node === goalId) break;
    visited.add(current.node);
    const edges = graph.adjacency.get(current.node);
    if (!edges) continue;
    for (const edge of edges) {
      if (visited.has(edge.to)) continue;
      const candidate = current.cost + edge.weight;
      if (candidate >= (bestCost.get(edge.to) ?? Number.POSITIVE_INFINITY)) continue;
      bestCost.set(edge.to, candidate);
      previous.set(edge.to, { from: current.node, edge });
      heap.push({ node: edge.to, cost: candidate });
    }
  }
  if (!previous.has(goalId)) return null;
  const path: TraversedEdge[] = [];
  let cursor = goalId;
  while (cursor !== startId) {
    const hop = previous.get(cursor);
    if (!hop) return null;
    path.push({ from: hop.from, to: cursor, wayId: hop.edge.wayId, metres: 0 });
    cursor = hop.from;
  }
  path.reverse();
  for (const step of path) {
    const fromPoint = graph.nodes.get(step.from);
    const toPoint = graph.nodes.get(step.to);
    if (fromPoint && toPoint) step.metres = distanceMetres(fromPoint, toPoint);
  }
  return path;
}

export function computeRoutePlan(path: TraversedEdge[], graph: RoadGraph): RoutePlan | null {
  if (!path.length) {
    const point = [...graph.nodes.values()][0];
    return point
      ? { coordinates: [{ latitude: point.latitude, longitude: point.longitude }], metres: 0, durationSeconds: 0, minorMetres: 0, finalMinorMetres: 0 }
      : null;
  }
  const coordinates: RoutePoint[] = [];
  let metres = 0;
  let durationSeconds = 0;
  let minorMetres = 0;
  for (const step of path) {
    const start = graph.nodes.get(step.from);
    const end = graph.nodes.get(step.to);
    if (!start || !end) continue;
    if (!coordinates.length) coordinates.push({ latitude: start.latitude, longitude: start.longitude });
    coordinates.push({ latitude: end.latitude, longitude: end.longitude });
    metres += step.metres;
    const info = graph.wayInfo.get(step.wayId);
    if (info) {
      const speed = classSpeedMph(info.highway) * 0.44704;
      durationSeconds += step.metres / speed;
      if (isMinorRoad(info.highway)) minorMetres += step.metres;
    }
  }
  let finalMinorMetres = 0;
  for (let index = path.length - 1; index >= 0; index -= 1) {
    const info = graph.wayInfo.get(path[index].wayId);
    if (info && isMinorRoad(info.highway)) {
      finalMinorMetres += path[index].metres;
      if (index === 0) continue;
      const previousInfo = graph.wayInfo.get(path[index - 1].wayId);
      const previousIsMinor = previousInfo ? isMinorRoad(previousInfo.highway) : false;
      if (!previousIsMinor) break;
    } else {
      break;
    }
  }
  return { coordinates, metres, durationSeconds, minorMetres, finalMinorMetres };
}

function bearingBetween(from: RoutePoint, to: RoutePoint): number {
  return (Math.atan2(to.longitude - from.longitude, to.latitude - from.latitude) * 180 / Math.PI + 360) % 360;
}

function arrowForTurn(deviation: number): string {
  const absolute = Math.abs(deviation);
  if (absolute >= 155) return "↶";
  if (deviation >= 35) return "↱";
  if (deviation <= -35) return "↰";
  return "↑";
}

export function buildTurnInstruction(path: TraversedEdge[], graph: RoadGraph, minimumFromStartMetres = 60): TurnInstruction | null {
  if (!path.length) return null;
  let travelled = 0;
  for (let index = 1; index < path.length; index += 1) {
    const incoming = path[index - 1];
    const outgoing = path[index];
    travelled += incoming.metres;
    if (travelled < minimumFromStartMetres) continue;
    const from = graph.nodes.get(incoming.from);
    const mid = graph.nodes.get(outgoing.from);
    const to = graph.nodes.get(outgoing.to);
    if (!from || !mid || !to) continue;
    const junctionEdges = graph.adjacency.get(outgoing.from) ?? [];
    const branches = new Set(junctionEdges.map((edge) => edge.wayId));
    if (branches.size < 3) continue;
    const inbound = bearingBetween(from, mid);
    const outbound = bearingBetween(mid, to);
    let deviation = outbound - inbound;
    while (deviation > 180) deviation -= 360;
    while (deviation < -180) deviation += 360;
    if (Math.abs(deviation) < 35) continue;
    const info = graph.wayInfo.get(outgoing.wayId);
    const road = info?.name || info?.ref || "Next road";
    return {
      arrow: arrowForTurn(deviation),
      road,
      distanceMiles: travelled / 1609.344,
    };
  }
  return null;
}