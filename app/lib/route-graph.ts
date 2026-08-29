import type { Destination } from "./geocoding";
import type { CalculatedRoute, RouteInstruction } from "./routing";
import { fetchOverpass } from "./safety";
import {
  buildRoadGraph,
  buildTurnInstruction,
  computeRoutePlan,
  distanceMetres,
  findShortestPath,
  snapNearestNode,
  type GraphNode,
  type GraphWay,
  type RoutePoint,
  type RouteProfile,
  type WayTags,
} from "./route-engine-core";

type OverpassElement = {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  tags?: WayTags;
  nodes?: number[];
};

const CORRIDOR_CACHE_KEY = "map-engine-route-corridor-v1";
const CORRIDOR_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1_000;
const MAX_CORRIDOR_WAYS = 8_000;
const MAX_CORRIDOR_NODES = 60_000;
const CORRIDOR_SNAP_METRES = 900;

const DRIVABLE_HIGHWAY = "^motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|residential|living_street|service|track|road$";

type Corridor = { ways: GraphWay[]; nodes: GraphNode[] };

type CorridorCacheEntry = {
  savedAt: number;
  key: string;
  corridor: Corridor;
};

type CorridorBounds = { south: number; west: number; north: number; east: number };

function corridorKey(a: RoutePoint, b: RoutePoint) {
  return `${a.latitude.toFixed(3)},${a.longitude.toFixed(3)}>${b.latitude.toFixed(3)},${b.longitude.toFixed(3)}`;
}

function corridorBounds(a: RoutePoint, b: RoutePoint): CorridorBounds {
  const gapMetres = distanceMetres(a, b);
  const paddingKilometres = Math.max(1.5, Math.min(6, gapMetres / 1_000 * 0.06 + 0.8));
  const midLatitude = (a.latitude + b.latitude) / 2;
  const latitudePad = paddingKilometres / 110.574;
  const longitudePad = paddingKilometres / (111.32 * Math.max(0.2, Math.cos(midLatitude * Math.PI / 180)));
  return {
    south: Math.min(a.latitude, b.latitude) - latitudePad,
    west: Math.min(a.longitude, b.longitude) - longitudePad,
    north: Math.max(a.latitude, b.latitude) + latitudePad,
    east: Math.max(a.longitude, b.longitude) + longitudePad,
  };
}

function corridorQuery(bounds: CorridorBounds): string {
  return `[out:json][timeout:45];way["highway"~"${DRIVABLE_HIGHWAY}"](${bounds.south.toFixed(5)},${bounds.west.toFixed(5)},${bounds.north.toFixed(5)},${bounds.east.toFixed(5)});(._;>;);out body;`;
}

function readCorridorCache(key: string): Corridor | null {
  try {
    const raw = localStorage.getItem(CORRIDOR_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CorridorCacheEntry;
    if (parsed.key !== key || !Array.isArray(parsed.corridor?.ways) || !Array.isArray(parsed.corridor?.nodes)) return null;
    if (Date.now() - parsed.savedAt > CORRIDOR_CACHE_MAX_AGE_MS) return null;
    return parsed.corridor;
  } catch {
    return null;
  }
}

function saveCorridorCache(key: string, corridor: Corridor) {
  try {
    const serialised = JSON.stringify({ savedAt: Date.now(), key, corridor });
    if (serialised.length > 1_200_000) return;
    localStorage.setItem(CORRIDOR_CACHE_KEY, serialised);
  } catch {
    // The corridor cache is disposable; routing must still work without it.
  }
}

function extractCorridor(elements: OverpassElement[]): Corridor {
  const nodes: GraphNode[] = [];
  for (const element of elements) {
    if (element.type !== "node" || typeof element.lat !== "number" || typeof element.lon !== "number") continue;
    nodes.push({ id: element.id, latitude: element.lat, longitude: element.lon });
  }
  const ways: GraphWay[] = [];
  for (const element of elements) {
    if (element.type !== "way" || !element.tags?.highway || !Array.isArray(element.nodes) || element.nodes.length < 2) continue;
    ways.push({ id: element.id, highway: element.tags.highway, tags: element.tags, nodes: element.nodes });
  }
  return { ways, nodes };
}

export async function fetchRouteCorridor(a: RoutePoint, b: RoutePoint, signal?: AbortSignal): Promise<Corridor> {
  const key = corridorKey(a, b);
  const cached = readCorridorCache(key);
  if (cached) return cached;
  const payload = await fetchOverpass(corridorQuery(corridorBounds(a, b)), 0, 500, signal, 12_000);
  const corridor = extractCorridor(payload.elements ?? []);
  if (corridor.ways.length >= MAX_CORRIDOR_WAYS || corridor.nodes.length >= MAX_CORRIDOR_NODES) {
    throw new Error("This journey is too large for on-device routing. Showing the fastest route instead.");
  }
  saveCorridorCache(key, corridor);
  return corridor;
}

export async function calculateWeightedRoute(
  origin: RoutePoint,
  destination: Destination,
  signal: AbortSignal,
  profile: RouteProfile = "fast",
): Promise<CalculatedRoute> {
  const destinationPoint = { latitude: destination.latitude, longitude: destination.longitude };
  const corridor = await fetchRouteCorridor(origin, destinationPoint, signal);
  const nodes = new Map(corridor.nodes.map((node) => [node.id, node]));
  const graph = buildRoadGraph(corridor.ways, nodes, profile);
  const startNode = snapNearestNode(graph, origin, CORRIDOR_SNAP_METRES);
  const goalNode = snapNearestNode(graph, destinationPoint, CORRIDOR_SNAP_METRES);
  if (startNode === null || goalNode === null) throw new Error("The start or destination could not be reached from mapped roads.");
  signal.throwIfAborted?.();
  const path = findShortestPath(graph, startNode, goalNode);
  if (!path) throw new Error("No suitable route was found.");
  const plan = computeRoutePlan(path, graph);
  if (!plan || !plan.coordinates.length) throw new Error("No suitable route was found.");
  const instruction: RouteInstruction | null = buildTurnInstruction(path, graph);
  let coordinates: [number, number][] = plan.coordinates.map((point) => [point.longitude, point.latitude]);
  coordinates = coordinates.map((coordinate, index) => index === 0
    ? [origin.longitude, origin.latitude]
    : (index === coordinates.length - 1 ? [destination.longitude, destination.latitude] : coordinate));
  return {
    geometry: { type: "LineString", coordinates },
    distanceMiles: plan.metres / 1609.344,
    durationMinutes: Math.max(1, Math.round(plan.durationSeconds / 60)),
    instruction,
    minorRoadMiles: plan.minorMetres / 1609.344,
    finalMinorRoadMiles: plan.finalMinorMetres / 1609.344,
  };
}

export type PreferredRouteResult = {
  route: CalculatedRoute;
  fallback: boolean;
};

export async function calculatePreferredRoute(
  origin: RoutePoint,
  destination: Destination,
  signal: AbortSignal,
  profile: RouteProfile = "fast",
): Promise<PreferredRouteResult> {
  try {
    return { route: await calculateWeightedRoute(origin, destination, signal, profile), fallback: false };
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    const { calculateRoute } = await import("./routing");
    return { route: await calculateRoute(origin, destination, signal), fallback: true };
  }
}