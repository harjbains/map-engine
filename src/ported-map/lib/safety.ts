import type { Point } from "./driving";

export type SafetyKind =
  | "restricted"
  | "restriction_entrance"
  | "traffic_signal"
  | "speed_camera"
  | "average_speed_zone"
  | "road_closure"
  | "roadworks"
  | "speed_bump"
  | "one_way"
  | "no_entry"
  | "turn_restriction"
  | "speed_limit"
  | "access_zone"
  | "rail_crossing"
  | "dimension_limit"
  | "clean_air_zone"
  | "ev_charger"
  | "parking";

type SafetyGeometry =
  | { type: "Point"; coordinates: [number, number] }
  | { type: "LineString"; coordinates: [number, number][] };

export type SafetyFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    id: string;
    properties: { kind: SafetyKind; label: string; direction?: number; roadName?: string; speedLimit?: number };
    geometry: SafetyGeometry;
  }>;
};

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  geometry?: Array<{ lat: number; lon: number }>;
  members?: Array<{
    type: "node" | "way" | "relation";
    ref: number;
    role: string;
    lat?: number;
    lon?: number;
    geometry?: Array<{ lat: number; lon: number }>;
  }>;
  tags?: Record<string, string>;
};

type TrafficSignalPoint = { latitude: number; longitude: number };

type SafetyCacheEntry = {
  savedAt: number;
  centre: Point;
  radiusMetres: number;
  data: SafetyFeatureCollection;
};

const CACHE_KEY = "map-engine-safety-overlay-v20";
const LEGACY_CACHE_KEYS = ["map-engine-safety-overlay-v19", "map-engine-safety-overlay-v18", "map-engine-safety-overlay-v17", "map-engine-safety-overlay-v16"];
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;
const CACHE_MAX_AREAS = 30;
const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
];
const OVERPASS_URLS = typeof __STATIC_BUILD__ !== "undefined" && __STATIC_BUILD__
  ? OVERPASS_MIRRORS
  : ["/api/overpass", ...OVERPASS_MIRRORS];
const SIGNAL_CLUSTER_METRES = 60;
const ROUNDABOUT_SIGNAL_CLUSTER_METRES = 24;
const ROUNDABOUT_ASSOCIATION_METRES = 45;
const MOTOR_ROAD_CLASS_RE = /^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|road)(?:_link)?$/;
const NON_ROAD_CONSTRUCTION_RE = /\b(hs2|high\s*speed\s*2|railway|rail\s*line|metro|tramway|canal|footway|cycleway|bridleway)\b/i;

// Council enforcement records confirm Pipers Row and the adjoining Victoria Square bus gate;
// the present OSM Pipers Row ways omit vehicle-access tags, so retain this narrow fallback.
const WOLVERHAMPTON_RESTRICTION_CENTRE = { latitude: 52.5857, longitude: -2.1230 };
const WOLVERHAMPTON_CURATED_RESTRICTIONS: SafetyFeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "curated/pipers-row-bus-lane",
      properties: { kind: "restricted", label: "BUS LANE" },
      geometry: {
        type: "LineString",
        coordinates: [
          [-2.1227361, 52.5850140], [-2.1227669, 52.5851598],
          [-2.1227990, 52.5853222], [-2.1228134, 52.5853843],
          [-2.1228392, 52.5854821], [-2.1229018, 52.5857321],
          [-2.1229516, 52.5858812], [-2.1229617, 52.5859059],
        ],
      },
    },
    {
      type: "Feature",
      id: "curated/victoria-square-bus-gate-road",
      properties: { kind: "restricted", label: "BUS LANE" },
      geometry: {
        type: "LineString",
        coordinates: [
          [-2.1229940, 52.5860051], [-2.1230084, 52.5860643],
          [-2.1230207, 52.5861111], [-2.1231023, 52.5863867],
          [-2.1231498, 52.5865620], [-2.1231746, 52.5866360],
        ],
      },
    },
    {
      type: "Feature",
      id: "curated/victoria-square-bus-gate-entry",
      properties: { kind: "restriction_entrance", label: "BUS GATE" },
      geometry: { type: "Point", coordinates: [-2.1229940, 52.5860051] },
    },
  ],
};

function isBusDesignated(tags: Record<string, string>) {
  return /^(yes|designated|permissive)$/.test(tags.bus ?? "")
    || /^(yes|designated|permissive)$/.test(tags.psv ?? "");
}

function isBusAccessOnly(tags: Record<string, string>) {
  const carsProhibited = [tags.access, tags.vehicle, tags.motor_vehicle, tags.motorcar]
    .some((value) => /^(no|private)$/.test(value ?? ""));
  return carsProhibited && isBusDesignated(tags);
}

function isExplicitBusLane(tags: Record<string, string>) {
  const signedBusway = [tags.busway, tags["busway:left"], tags["busway:right"], tags["busway:both"]]
    .some((value) => /^(lane|opposite|opposite_lane)$/.test(value ?? ""));
  const busesHaveLane = [tags["bus:lanes"], tags["psv:lanes"]]
    .some((value) => /(designated|yes)/.test(value ?? ""));
  const carsExcludedFromLane = [tags["access:lanes"], tags["vehicle:lanes"], tags["motor_vehicle:lanes"], tags["motorcar:lanes"]]
    .some((value) => /(no|private)/.test(value ?? ""));
  return signedBusway || (busesHaveLane && carsExcludedFromLane);
}

function isNonRoadProject(tags: Record<string, string>) {
  if (tags.railway || tags.building || tags.landuse || tags.waterway || tags.aeroway) return true;
  if (/^(rail|railway|light_rail|subway|tram|monorail|high_speed_rail|yes)$/i.test(tags.construction ?? "") && !tags.highway) {
    return true;
  }
  const meta = `${tags.name ?? ""} ${tags.description ?? ""} ${tags.note ?? ""} ${tags.operator ?? ""} ${tags.project ?? ""} ${tags.ref ?? ""}`;
  return NON_ROAD_CONSTRUCTION_RE.test(meta);
}

function isMotorRoadWayConstruction(tags: Record<string, string>) {
  if (isNonRoadProject(tags)) return false;
  if (tags.highway === "construction") {
    // Only include if the planned highway class is a motor vehicle road (or unspecified motor road, not footway/cycleway/path/rail)
    if (!tags.construction) return true;
    return MOTOR_ROAD_CLASS_RE.test(tags.construction);
  }
  if (tags.highway === "roadworks") return true;
  if (MOTOR_ROAD_CLASS_RE.test(tags.highway ?? "")) {
    return Boolean(tags.construction && !/^(no|false)$/i.test(tags.construction)) || Boolean(tags.roadworks);
  }
  return false;
}

function distanceMetres(a: TrafficSignalPoint, b: TrafficSignalPoint) {
  const earthRadius = 6_371_000;
  const latitudeDelta = (b.latitude - a.latitude) * Math.PI / 180;
  const longitudeDelta = (b.longitude - a.longitude) * Math.PI / 180;
  const latitudeA = a.latitude * Math.PI / 180;
  const latitudeB = b.latitude * Math.PI / 180;
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function elementPoint(element: OverpassElement): TrafficSignalPoint | null {
  if (typeof element.lat === "number" && typeof element.lon === "number") {
    return { latitude: element.lat, longitude: element.lon };
  }
  if (element.center) return { latitude: element.center.lat, longitude: element.center.lon };
  const geometry = element.geometry ?? [];
  if (geometry.length) {
    const middle = geometry[Math.floor(geometry.length / 2)];
    return { latitude: middle.lat, longitude: middle.lon };
  }
  const memberGeometry = (element.members ?? []).flatMap((member) => member.geometry ?? []);
  if (memberGeometry.length) {
    const middle = memberGeometry[Math.floor(memberGeometry.length / 2)];
    return { latitude: middle.lat, longitude: middle.lon };
  }
  return null;
}

function pointFeature(element: OverpassElement, kind: SafetyKind, label: string) {
  const point = elementPoint(element);
  if (!point) return null;
  return {
    type: "Feature" as const,
    id: `${element.type}/${element.id}/${kind}`,
    properties: { kind, label, direction: undefined as number | undefined },
    geometry: { type: "Point" as const, coordinates: [point.longitude, point.latitude] as [number, number] },
  };
}

function wayFeature(element: OverpassElement, kind: SafetyKind, label: string, reverse = false) {
  const coordinates = (element.geometry ?? []).map(({ lon, lat }) => [lon, lat] as [number, number]);
  if (reverse) coordinates.reverse();
  if (coordinates.length < 2) return null;
  return {
    type: "Feature" as const,
    id: `${element.type}/${element.id}/${kind}`,
    properties: { kind, label },
    geometry: { type: "LineString" as const, coordinates },
  };
}

function bearingBetweenDegrees(from: { lat: number; lon: number }, to: { lat: number; lon: number }) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const longitudeDelta = toRad(to.lon - from.lon);
  const y = Math.sin(longitudeDelta) * Math.cos(toRad(to.lat));
  const x = Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat))
    - Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(longitudeDelta);
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

export function cameraEnforcementDirection(element: OverpassElement): number | null {
  if (element.type === "node") {
    const rawDirection = element.tags?.direction ?? element.tags?.["camera:direction"];
    if (!rawDirection) return null;
    const degrees = Number(rawDirection);
    if (!Number.isFinite(degrees)) return null;
    return ((degrees % 360) + 360) % 360;
  }
  if (element.type === "way") {
    const coords = element.geometry ?? [];
    if (coords.length < 2) return null;
    const from = coords[0];
    const to = coords[coords.length - 1];
    return bearingBetweenDegrees({ lat: from.lat, lon: from.lon }, { lat: to.lat, lon: to.lon });
  }
  if (element.type === "relation") {
    const from = (element.members ?? []).find((member) => member.role === "from");
    const to = (element.members ?? []).find((member) => member.role === "to");
    if (from?.lat !== undefined && from.lon !== undefined && to?.lat !== undefined && to.lon !== undefined) {
      return bearingBetweenDegrees({ lat: from.lat, lon: from.lon }, { lat: to.lat, lon: to.lon });
    }
  }
  return null;
}

function normaliseSpeedLimit(value = "") {
  const match = value.match(/\b(5|10|15|20|25|30|40|50|60|70)\b/);
  return match?.[1] ?? null;
}

function dimensionLabel(tags: Record<string, string>) {
  if (tags.maxheight) return `H ${tags.maxheight}`;
  if (tags.maxwidth) return `W ${tags.maxwidth}`;
  if (tags.maxweight) return `T ${tags.maxweight}`;
  return null;
}

function curatedRestrictions(centre: Point, radiusMetres: number) {
  return distanceMetres(centre, WOLVERHAMPTON_RESTRICTION_CENTRE) <= radiusMetres + 1_000
    ? WOLVERHAMPTON_CURATED_RESTRICTIONS
    : { type: "FeatureCollection" as const, features: [] };
}

function clusterTrafficSignals(points: TrafficSignalPoint[], radiusMetres = SIGNAL_CLUSTER_METRES, connectNeighbours = true) {
  const remaining = new Set(points.map((_, index) => index));
  const clusters: TrafficSignalPoint[] = [];
  while (remaining.size) {
    const first = remaining.values().next().value as number;
    remaining.delete(first);
    const members = [first];
    const memberLimit = connectNeighbours ? Number.POSITIVE_INFINITY : 1;
    for (let cursor = 0; cursor < members.length && cursor < memberLimit; cursor += 1) {
      const member = points[members[cursor]];
      for (const candidate of [...remaining]) {
        if (distanceMetres(member, points[candidate]) <= radiusMetres) {
          remaining.delete(candidate);
          members.push(candidate);
        }
      }
    }
    clusters.push({
      latitude: members.reduce((total, index) => total + points[index].latitude, 0) / members.length,
      longitude: members.reduce((total, index) => total + points[index].longitude, 0) / members.length,
    });
  }
  return clusters;
}

function distanceToPathMetres(point: TrafficSignalPoint, path: TrafficSignalPoint[]) {
  if (path.length < 2) return Number.POSITIVE_INFINITY;
  const latitudeScale = 110_574;
  const longitudeScale = 111_320 * Math.cos(point.latitude * Math.PI / 180);
  let nearest = Number.POSITIVE_INFINITY;
  for (let index = 1; index < path.length; index += 1) {
    const start = path[index - 1];
    const end = path[index];
    const startX = (start.longitude - point.longitude) * longitudeScale;
    const startY = (start.latitude - point.latitude) * latitudeScale;
    const endX = (end.longitude - point.longitude) * longitudeScale;
    const endY = (end.latitude - point.latitude) * latitudeScale;
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const lengthSquared = deltaX ** 2 + deltaY ** 2;
    const progress = lengthSquared ? Math.max(0, Math.min(1, -(startX * deltaX + startY * deltaY) / lengthSquared)) : 0;
    nearest = Math.min(nearest, Math.hypot(startX + progress * deltaX, startY + progress * deltaY));
  }
  return nearest;
}

const overpassQueue: (() => void)[] = [];
let overpassActive = 0;

async function acquireOverpassSlot() {
  if (overpassActive < 2) {
    overpassActive++;
    return;
  }
  return new Promise<void>((resolve) => overpassQueue.push(resolve));
}

function releaseOverpassSlot() {
  const next = overpassQueue.shift();
  if (next) {
    next();
  } else {
    overpassActive--;
  }
}

async function requestOverpass(endpoint: string, query: string, delayMs: number, controllers: AbortController[], parentSignal?: AbortSignal, hardTimeoutMs?: number) {
  const controller = new AbortController();
  controllers.push(controller);
  if (parentSignal?.aborted) controller.abort();
  else if (parentSignal) parentSignal.addEventListener("abort", () => controller.abort(), { once: true });
  if (delayMs) {
    await new Promise<void>((resolve, reject) => {
      const delay = window.setTimeout(resolve, delayMs);
      controller.signal.addEventListener("abort", () => {
        window.clearTimeout(delay);
        reject(new DOMException("Request cancelled", "AbortError"));
      }, { once: true });
    });
  }
  const declaredTimeout = query ? (query.match(/\[timeout:(\d+)\]/)?.[1] ?? "") : "";
  const timeoutCap = declaredTimeout ? Number(declaredTimeout) * 1_000 + 5_000 : 20_000;
  const timeout = window.setTimeout(() => controller.abort(), Math.min(30_000, hardTimeoutMs ?? timeoutCap));
  try {
    await acquireOverpassSlot();
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Accept": "application/json, */*", "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Overpass ${response.status}`);
    return await response.json() as { elements?: OverpassElement[] };
  } finally {
    window.clearTimeout(timeout);
    releaseOverpassSlot();
  }
}

export async function fetchOverpass(query: string, initialDelayMs = 0, fallbackDelayMs = 2_000, parentSignal?: AbortSignal, hardTimeoutMs?: number) {
  const controllers: AbortController[] = [];
  try {
    if (parentSignal?.aborted) throw new DOMException("Request cancelled", "AbortError");
    return await Promise.any(OVERPASS_URLS.map((endpoint, index) => requestOverpass(endpoint, query, initialDelayMs + index * fallbackDelayMs, controllers, parentSignal, hardTimeoutMs)));
  } catch (error) {
    if (parentSignal?.aborted) throw new DOMException("Request cancelled", "AbortError");
    if ((error as Error).name === "AbortError") throw new Error("Route data request timed out.");
    throw error;
  } finally {
    controllers.forEach((controller) => controller.abort());
  }
}

function readSafetyCacheEntries() {
  try {
    for (const oldKey of LEGACY_CACHE_KEYS) {
      localStorage.removeItem(oldKey);
    }
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const cached = JSON.parse(raw) as { entries?: SafetyCacheEntry[] };
    return (cached.entries ?? []).filter((entry) => entry.data?.type === "FeatureCollection" && Date.now() - entry.savedAt < CACHE_MAX_AGE_MS);
  } catch {
    return [];
  }
}

export function readCachedSafetyFeatures(centre?: Point): SafetyFeatureCollection | null {
  const entries = readSafetyCacheEntries()
    .filter((entry) => !centre || distanceMetres(centre, entry.centre) <= entry.radiusMetres * 1.45)
    .sort((left, right) => right.savedAt - left.savedAt);
  if (!entries.length) return null;
  const features: SafetyFeatureCollection["features"] = [];
  const featureIds = new Set<string>();
  const trafficSignals: Point[] = [];
  for (const feature of entries.flatMap((entry) => entry.data.features)) {
    if (featureIds.has(feature.id)) continue;
    if (feature.properties.kind === "traffic_signal" && feature.geometry.type === "Point") {
      const point = { latitude: feature.geometry.coordinates[1], longitude: feature.geometry.coordinates[0] };
      if (trafficSignals.some((candidate) => distanceMetres(point, candidate) < 12)) continue;
      trafficSignals.push(point);
    }
    featureIds.add(feature.id);
    features.push(feature);
  }
  return { type: "FeatureCollection", features };
}

function saveSafetyFeatures(centre: Point, radiusMetres: number, data: SafetyFeatureCollection) {
  try {
    const entries = readSafetyCacheEntries().filter((entry) => distanceMetres(centre, entry.centre) > Math.max(900, radiusMetres * 0.45));
    entries.unshift({ savedAt: Date.now(), centre, radiusMetres, data });
    localStorage.setItem(CACHE_KEY, JSON.stringify({ entries: entries.slice(0, CACHE_MAX_AREAS) }));
  } catch { /* The map can continue without a cached safety overlay. */ }
}

function trafficSignalFeatures(elements: OverpassElement[]): SafetyFeatureCollection {
  const trafficSignals: TrafficSignalPoint[] = [];
  const roundabouts = elements
    .filter((element) => element.type === "way" && (element.tags?.junction === "roundabout" || element.tags?.junction === "circular"))
    .map((element) => (element.geometry ?? []).map(({ lat, lon }) => ({ latitude: lat, longitude: lon })))
    .filter((path) => path.length >= 2);

  for (const element of elements) {
    if (element.tags?.highway === "traffic_signals" && typeof element.lon === "number" && typeof element.lat === "number") {
      trafficSignals.push({ latitude: element.lat, longitude: element.lon });
    }
  }

  const roundaboutSignals = trafficSignals.filter((signal) => roundabouts.some((path) => distanceToPathMetres(signal, path) <= ROUNDABOUT_ASSOCIATION_METRES));
  const ordinarySignals = trafficSignals.filter((signal) => !roundaboutSignals.includes(signal));
  const signalIcons = [
    ...clusterTrafficSignals(ordinarySignals, 35, false),
    ...clusterTrafficSignals(roundaboutSignals, ROUNDABOUT_SIGNAL_CLUSTER_METRES, false),
  ];
  return {
    type: "FeatureCollection",
    features: signalIcons.map((signal, index) => ({
      type: "Feature" as const,
      id: `traffic-signal-junction/${index}/${signal.latitude.toFixed(5)}/${signal.longitude.toFixed(5)}`,
      properties: { kind: "traffic_signal" as const, label: "Traffic lights" },
      geometry: { type: "Point" as const, coordinates: [signal.longitude, signal.latitude] },
    })),
  };
}

function roadRuleFeatures(elements: OverpassElement[]): SafetyFeatureCollection {
  const features: SafetyFeatureCollection["features"] = [];
  const featureIds = new Set<string>();
  const add = (feature: SafetyFeatureCollection["features"][number] | null) => {
    if (!feature || featureIds.has(feature.id)) return;
    featureIds.add(feature.id);
    features.push(feature);
  };

  for (const element of elements) {
    const tags = element.tags ?? {};
    if (element.type === "way") {
      const pedestrian = tags.highway === "pedestrian" || tags.highway === "living_street";
      const generalAccessRestricted = /^(no|private)$/.test(tags.access ?? "") && !isBusDesignated(tags);
      if (pedestrian || generalAccessRestricted) {
        add(wayFeature(element, "access_zone", pedestrian ? "PEDESTRIAN" : "ACCESS"));
      }

      const calming = tags.traffic_calming ? /^(bump|table|hump|cushion|yes|rumble_strip|chicanes?|island)$/i.test(tags.traffic_calming) : false;
      if (calming) add(pointFeature(element, "speed_bump", "BUMP"));

      const dimension = dimensionLabel(tags);
      if (dimension) add(pointFeature(element, "dimension_limit", dimension));
    }

    if (element.type === "node") {
      const sign = `${tags.traffic_sign ?? ""};${tags["traffic_sign:forward"] ?? ""};${tags["traffic_sign:backward"] ?? ""}`;
      if (/no[_ ]?entry|GB:601/i.test(sign)) add(pointFeature(element, "no_entry", "NO ENTRY"));
      const calming = tags.traffic_calming ? /^(bump|table|hump|cushion|yes|rumble_strip|chicanes?|island)$/i.test(tags.traffic_calming) : false;
      if (calming || tags.barrier === "bump" || /557/i.test(sign)) add(pointFeature(element, "speed_bump", "BUMP"));
      if (tags.railway === "level_crossing" || tags.railway === "tram_crossing") {
        add(pointFeature(element, "rail_crossing", tags.railway === "tram_crossing" ? "TRAM" : "RAIL"));
      }
      const dimension = dimensionLabel(tags);
      if (dimension) add(pointFeature(element, "dimension_limit", dimension));
    }

    if (element.type === "relation" && tags.type === "restriction") {
      const via = element.members?.find((member) => member.role === "via");
      const geometry = via?.geometry ?? [];
      const middle = geometry[Math.floor(geometry.length / 2)];
      const latitude = via?.lat ?? middle?.lat;
      const longitude = via?.lon ?? middle?.lon;
      if (typeof latitude === "number" && typeof longitude === "number") {
        const restriction = tags.restriction ?? "turn restriction";
        const label = restriction.startsWith("only_") ? "TURN ONLY" : "NO TURN";
        add({
          type: "Feature",
          id: `relation/${element.id}/turn_restriction`,
          properties: { kind: "turn_restriction", label },
          geometry: { type: "Point", coordinates: [longitude, latitude] },
        });
      }
    }
  }
  return { type: "FeatureCollection", features };
}

function speedLimitFeatures(elements: OverpassElement[]): SafetyFeatureCollection {
  const features: SafetyFeatureCollection["features"] = [];
  for (const element of elements) {
    if (element.type !== "way") continue;
    const speed = normaliseSpeedLimit(element.tags?.maxspeed);
    const feature = speed ? wayFeature(element, "speed_limit", speed) : null;
    if (feature) features.push(feature);
  }
  return { type: "FeatureCollection", features };
}

function isExplicitAverageSpeedElement(tags: Record<string, string>) {
  return (
    tags.enforcement === "average_speed" ||
    tags["camera:type"] === "average_speed" ||
    tags.speed_camera === "average_speed" ||
    tags.safety_camera === "average_speed" ||
    tags["maxspeed:enforcement"] === "average" ||
    tags["enforcement:maxspeed"] === "average" ||
    /average[_ -]?speed|specs\b|vector\s*sr/i.test(
      `${tags.name ?? ""} ${tags.description ?? ""} ${tags.note ?? ""} ${tags["maxspeed:type"] ?? ""} ${tags["source:maxspeed"] ?? ""} ${tags["maxspeed:enforcement"] ?? ""} ${tags["enforcement:maxspeed"] ?? ""}`,
    )
  );
}

// Known West Midlands (Wolverhampton, Black Country, Birmingham, Solihull & Coventry)
// average speed camera spans so all enforced corridors render in solid Magenta.
export const KNOWN_WEST_MIDLANDS_AVG_SPEED_PAIRS: Array<{
  id: string;
  roadLabel: string;
  roadKeys: string[];
  a: TrafficSignalPoint;
  b: TrafficSignalPoint;
  speed: string;
  maxLateralMetres?: number;
}> = [
  // 1. A4123 Birmingham New Road / Wolverhampton Road (Wolverhampton -> Coseley -> Dudley -> Oldbury -> Quinton)
  {
    id: "wm-a4123-wolves-lanesfield",
    roadLabel: "A4123 Birmingham New Road",
    roadKeys: ["name:birmingham new road", "name:birmingham road", "ref:A4123"],
    a: { latitude: 52.57042, longitude: -2.11849 },
    b: { latitude: 52.56072, longitude: -2.11134 },
    speed: "40",
  },
  {
    id: "wm-a4123-lanesfield-coseley",
    roadLabel: "A4123 Birmingham New Road",
    roadKeys: ["name:birmingham new road", "ref:A4123"],
    a: { latitude: 52.56072, longitude: -2.11134 },
    b: { latitude: 52.54954, longitude: -2.09555 },
    speed: "40",
  },
  {
    id: "wm-a4123-coseley-dudley",
    roadLabel: "A4123 Birmingham New Road",
    roadKeys: ["name:birmingham new road", "name:new birmingham road", "ref:A4123"],
    a: { latitude: 52.54954, longitude: -2.09555 },
    b: { latitude: 52.52453, longitude: -2.08241 },
    speed: "40",
  },
  {
    id: "wm-a4123-dudley-burnt-tree",
    roadLabel: "A4123 Birmingham New Road",
    roadKeys: ["name:birmingham new road", "name:new birmingham road", "name:wolverhampton road", "ref:A4123"],
    a: { latitude: 52.52453, longitude: -2.08241 },
    b: { latitude: 52.50351, longitude: -2.03340 },
    speed: "40",
  },
  {
    id: "wm-a4123-oldbury-brandhall",
    roadLabel: "A4123 Wolverhampton Road",
    roadKeys: ["name:wolverhampton road", "name:birmingham new road", "ref:A4123"],
    a: { latitude: 52.50351, longitude: -2.03340 },
    b: { latitude: 52.48813, longitude: -2.01878 },
    speed: "40",
  },
  {
    id: "wm-a4123-brandhall-quinton",
    roadLabel: "A4123 Wolverhampton Road",
    roadKeys: ["name:wolverhampton road", "name:wolverhampton road south", "ref:A4123"],
    a: { latitude: 52.48813, longitude: -2.01878 },
    b: { latitude: 52.47132, longitude: -1.99741 },
    speed: "40",
  },
  // 2. A41 Bilston Road / Wellington Road — Wolverhampton -> Priestfield -> Bilston
  {
    id: "wm-a41-bilston-road",
    roadLabel: "A41 Bilston Road",
    roadKeys: ["name:bilston road", "name:wellington road", "ref:A41"],
    a: { latitude: 52.57620, longitude: -2.10450 },
    b: { latitude: 52.56279, longitude: -2.06591 },
    speed: "40",
  },
  // 3. A41 Black Country New Road / The Expressway — Moxley -> Wednesbury -> West Bromwich
  {
    id: "wm-a41-bcnr-north",
    roadLabel: "A41 Black Country New Road",
    roadKeys: ["name:black country new road", "ref:A41"],
    a: { latitude: 52.56380, longitude: -2.01800 },
    b: { latitude: 52.54850, longitude: -2.00550 },
    speed: "40",
  },
  {
    id: "wm-a41-bcnr-south",
    roadLabel: "A41 Black Country New Road",
    roadKeys: ["name:black country new road", "name:the expressway", "ref:A41"],
    a: { latitude: 52.54850, longitude: -2.00550 },
    b: { latitude: 52.52350, longitude: -1.99600 },
    speed: "50",
  },
  // 4. A449 Stafford Road — Wolverhampton Oxley -> Fordhouses -> M54 J2
  {
    id: "wm-a449-stafford-road",
    roadLabel: "A449 Stafford Road",
    roadKeys: ["name:stafford road", "ref:A449"],
    a: { latitude: 52.59020, longitude: -2.11450 },
    b: { latitude: 52.62200, longitude: -2.12100 },
    speed: "40",
  },
  // 5. A454 Willenhall Road & Keyway / Black Country Route — Wolverhampton -> Willenhall -> Darlaston
  {
    id: "wm-a454-willenhall-road",
    roadLabel: "A454 Willenhall Road",
    roadKeys: ["name:willenhall road", "ref:A454"],
    a: { latitude: 52.58150, longitude: -2.09950 },
    b: { latitude: 52.57780, longitude: -2.06100 },
    speed: "30",
  },
  {
    id: "wm-a454-keyway-bcr",
    roadLabel: "A454 Black Country Route",
    roadKeys: ["name:the keyway", "name:black country route", "ref:A454", "ref:A463"],
    a: { latitude: 52.57780, longitude: -2.06100 },
    b: { latitude: 52.57350, longitude: -2.02100 },
    speed: "40",
  },
  // 6. A4124 Wednesfield Road / Lichfield Road — Wolverhampton -> Wednesfield -> Bloxwich
  {
    id: "wm-a4124-wednesfield-lichfield",
    roadLabel: "A4124 Wednesfield Road",
    roadKeys: ["name:wednesfield road", "name:lichfield road", "name:wolverhampton road", "ref:A4124"],
    a: { latitude: 52.59050, longitude: -2.10600 },
    b: { latitude: 52.60850, longitude: -2.04500 },
    speed: "30",
  },
  // 7. A4540 Birmingham Ring Road Middleway (Full Ring: Lee Bank, Belgrave, Highgate, Lawley, Dartmouth, Newtown, Icknield, Ladywood)
  {
    id: "wm-a4540-leebank-belgrave",
    roadLabel: "A4540 Lee Bank Middleway",
    roadKeys: ["name:lee bank middleway", "name:belgrave middleway", "ref:A4540"],
    a: { latitude: 52.47350, longitude: -1.91850 },
    b: { latitude: 52.46380, longitude: -1.88350 },
    speed: "40",
  },
  {
    id: "wm-a4540-highgate-lawley",
    roadLabel: "A4540 Lawley Middleway",
    roadKeys: ["name:highgate middleway", "name:lawley middleway", "ref:A4540"],
    a: { latitude: 52.46380, longitude: -1.88350 },
    b: { latitude: 52.48280, longitude: -1.87420 },
    speed: "40",
  },
  {
    id: "wm-a4540-dartmouth-newtown",
    roadLabel: "A4540 Dartmouth Middleway",
    roadKeys: ["name:dartmouth middleway", "name:newtown middleway", "ref:A4540"],
    a: { latitude: 52.48280, longitude: -1.87420 },
    b: { latitude: 52.49550, longitude: -1.90850 },
    speed: "40",
  },
  {
    id: "wm-a4540-icknield-ladywood",
    roadLabel: "A4540 Ladywood Middleway",
    roadKeys: ["name:icknield street", "name:ladywood middleway", "ref:A4540"],
    a: { latitude: 52.49550, longitude: -1.90850 },
    b: { latitude: 52.47350, longitude: -1.91850 },
    speed: "30",
  },
  // 8. A456 Hagley Road & Hagley Road West — Quinton -> Bearwood -> Edgbaston -> Five Ways
  {
    id: "wm-a456-hagley-west",
    roadLabel: "A456 Hagley Road West",
    roadKeys: ["name:hagley road west", "name:hagley road", "ref:A456"],
    a: { latitude: 52.47132, longitude: -1.99741 },
    b: { latitude: 52.47283, longitude: -1.96689 },
    speed: "40",
  },
  {
    id: "wm-a456-hagley-road",
    roadLabel: "A456 Hagley Road",
    roadKeys: ["name:hagley road", "ref:A456"],
    a: { latitude: 52.47283, longitude: -1.96689 },
    b: { latitude: 52.47220, longitude: -1.92350 },
    speed: "30",
  },
  // 9. A41 Soho Road / Holyhead Road — Handsworth -> Hockley
  {
    id: "wm-a41-soho-holyhead",
    roadLabel: "A41 Soho Road",
    roadKeys: ["name:soho road", "name:holyhead road", "ref:A41"],
    a: { latitude: 52.50750, longitude: -1.94600 },
    b: { latitude: 52.49334, longitude: -1.89601 },
    speed: "30",
  },
  // 10. A34 Birchfield Road / Walsall Road — Newtown -> Perry Barr -> Great Barr
  {
    id: "wm-a34-birchfield-road",
    roadLabel: "A34 Birchfield Road",
    roadKeys: ["name:newtown row", "name:birchfield road", "name:walsall road", "ref:A34"],
    a: { latitude: 52.49950, longitude: -1.89700 },
    b: { latitude: 52.52408, longitude: -1.93040 },
    speed: "30",
  },
  {
    id: "wm-a34-walsall-road",
    roadLabel: "A34 Walsall Road",
    roadKeys: ["name:walsall road", "name:birchfield road", "ref:A34"],
    a: { latitude: 52.52408, longitude: -1.93040 },
    b: { latitude: 52.55810, longitude: -1.93721 },
    speed: "30",
  },
  // 11. A38 Bristol Road & Bristol Road South — Edgbaston -> Selly Oak & Northfield -> Longbridge
  {
    id: "wm-a38-bristol-road",
    roadLabel: "A38 Bristol Road",
    roadKeys: ["name:bristol street", "name:bristol road", "ref:A38"],
    a: { latitude: 52.46700, longitude: -1.89950 },
    b: { latitude: 52.44100, longitude: -1.93550 },
    speed: "30",
  },
  {
    id: "wm-a38-bristol-road-south",
    roadLabel: "A38 Bristol Road South",
    roadKeys: ["name:bristol road south", "name:sir herbert austin way", "ref:A38"],
    a: { latitude: 52.41650, longitude: -1.96600 },
    b: { latitude: 52.39300, longitude: -1.98850 },
    speed: "40",
  },
  // 12. A38 Tyburn Road & Kingsbury Road — Gravelly Hill -> Erdington -> Minworth
  {
    id: "wm-a38-tyburn-kingsbury",
    roadLabel: "A38 Tyburn Road",
    roadKeys: ["name:tyburn road", "name:kingsbury road", "ref:A38"],
    a: { latitude: 52.51150, longitude: -1.85500 },
    b: { latitude: 52.52450, longitude: -1.78500 },
    speed: "40",
  },
  // 13. A45 Small Heath Highway & Coventry Road — Bordesley -> Yardley -> Sheldon -> Airport
  {
    id: "wm-a45-small-heath-yardley",
    roadLabel: "A45 Coventry Road",
    roadKeys: ["name:small heath highway", "name:coventry road", "ref:A45"],
    a: { latitude: 52.46950, longitude: -1.86500 },
    b: { latitude: 52.46050, longitude: -1.81150 },
    speed: "40",
  },
  {
    id: "wm-a45-yardley-airport",
    roadLabel: "A45 Coventry Road",
    roadKeys: ["name:coventry road", "ref:A45"],
    a: { latitude: 52.46050, longitude: -1.81150 },
    b: { latitude: 52.44650, longitude: -1.73200 },
    speed: "40",
  },
  // 14. A47 Heartlands Parkway / Fort Parkway — Nechells -> Bromford -> Castle Bromwich
  {
    id: "wm-a47-heartlands-fort",
    roadLabel: "A47 Heartlands Parkway",
    roadKeys: ["name:heartlands parkway", "name:fort parkway", "name:nechells parkway", "ref:A47"],
    a: { latitude: 52.48950, longitude: -1.87250 },
    b: { latitude: 52.50750, longitude: -1.79500 },
    speed: "40",
  },
  // 15. A4040 Outer Circle — Bromford Lane / Stechford / Stockfield Road
  {
    id: "wm-a4040-bromford-stockfield",
    roadLabel: "A4040 Outer Circle",
    roadKeys: ["name:bromford lane", "name:station road", "name:stockfield road", "ref:A4040"],
    a: { latitude: 52.49950, longitude: -1.82500 },
    b: { latitude: 52.46200, longitude: -1.81100 },
    speed: "30",
  },
  // 16. B4121 Shenley Lane / West Boulevard — Quinton -> Weoley Castle -> Selly Oak
  {
    id: "wm-b4121-shenley-west-blvd",
    roadLabel: "B4121 Shenley Lane",
    roadKeys: ["name:shenley lane", "name:west boulevard", "ref:B4121"],
    a: { latitude: 52.45650, longitude: -1.98100 },
    b: { latitude: 52.43250, longitude: -1.95400 },
    speed: "30",
  },
  // 17. A34 Stratford Road — Hall Green -> Shirley -> Monkspath -> M42 J4
  {
    id: "wm-a34-stratford-road",
    roadLabel: "A34 Stratford Road",
    roadKeys: ["name:stratford road", "ref:A34"],
    a: { latitude: 52.43200, longitude: -1.84200 },
    b: { latitude: 52.38200, longitude: -1.79200 },
    speed: "30",
  },
  // 18. A452 Collector Road & Chester Road — Castle Bromwich -> Chelmsley Wood
  {
    id: "wm-a452-collector-chester",
    roadLabel: "A452 Collector Road",
    roadKeys: ["name:collector road", "name:chester road", "ref:A452", "ref:B4102"],
    a: { latitude: 52.50800, longitude: -1.77800 },
    b: { latitude: 52.48200, longitude: -1.71600 },
    speed: "40",
  },
  // 19. A45 Coventry Highway (Dunchurch / Fletchamstead / Kenpas Highway)
  {
    id: "wm-a45-coventry-highway",
    roadLabel: "A45 Fletchamstead Highway",
    roadKeys: ["name:dunchurch highway", "name:fletchamstead highway", "name:kenpas highway", "ref:A45"],
    a: { latitude: 52.42200, longitude: -1.58800 },
    b: { latitude: 52.38200, longitude: -1.49800 },
    speed: "40",
  },
  // 20. A444 Jimmy Hill Way / Phoenix Way (Coventry)
  {
    id: "wm-a444-coventry",
    roadLabel: "A444 Phoenix Way",
    roadKeys: ["name:jimmy hill way", "name:phoenix way", "ref:A444"],
    a: { latitude: 52.44800, longitude: -1.49200 },
    b: { latitude: 52.39800, longitude: -1.49500 },
    speed: "50",
  },
  // 21. A4600 Ansty Road / Sky Blue Way (Coventry)
  {
    id: "wm-a4600-ansty-road",
    roadLabel: "A4600 Ansty Road",
    roadKeys: ["name:sky blue way", "name:ansty road", "name:hinckley road", "ref:A4600"],
    a: { latitude: 52.40850, longitude: -1.48800 },
    b: { latitude: 52.43250, longitude: -1.42500 },
    speed: "30",
  },
];

/**
 * Clips a road polyline to the span [0, 1] between two endpoint cameras A and B
 * so only the road stretch strictly between the entry and exit cameras is coloured.
 */
export function clipCoordsBetweenCameras(
  coords: [number, number][],
  camA: TrafficSignalPoint,
  camB: TrafficSignalPoint,
  maxLateralMetres = 380,
): [number, number][] | null {
  if (coords.length < 2) return null;
  const latScale = 111_320;
  const lonScale = 111_320 * Math.cos(((camA.latitude + camB.latitude) * 0.5 * Math.PI) / 180);
  const dx = (camB.longitude - camA.longitude) * lonScale;
  const dy = (camB.latitude - camA.latitude) * latScale;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 60 * 60) return null; // Cameras must be at least 60m apart

  const projectFraction = (lon: number, lat: number) => {
    const px = (lon - camA.longitude) * lonScale;
    const py = (lat - camA.latitude) * latScale;
    return (px * dx + py * dy) / lenSq;
  };

  const perpendicularMetres = (lon: number, lat: number) => {
    const px = (lon - camA.longitude) * lonScale;
    const py = (lat - camA.latitude) * latScale;
    const t = Math.max(0, Math.min(1, (px * dx + py * dy) / lenSq));
    return Math.hypot(px - t * dx, py - t * dy);
  };

  const clipped: [number, number][] = [];
  for (let i = 0; i < coords.length - 1; i += 1) {
    const p0 = coords[i];
    const p1 = coords[i + 1];
    const t0 = projectFraction(p0[0], p0[1]);
    const t1 = projectFraction(p1[0], p1[1]);

    if ((t0 < 0 && t1 < 0) || (t0 > 1 && t1 > 1)) continue;

    let startPt: [number, number] = p0;
    let endPt: [number, number] = p1;
    const dt = t1 - t0;

    if (Math.abs(dt) > 1e-6) {
      if (t0 < 0) {
        const alpha = (0 - t0) / dt;
        startPt = [p0[0] + alpha * (p1[0] - p0[0]), p0[1] + alpha * (p1[1] - p0[1])];
      } else if (t0 > 1) {
        const alpha = (1 - t0) / dt;
        startPt = [p0[0] + alpha * (p1[0] - p0[0]), p0[1] + alpha * (p1[1] - p0[1])];
      }
      if (t1 < 0) {
        const alpha = (0 - t0) / dt;
        endPt = [p0[0] + alpha * (p1[0] - p0[0]), p0[1] + alpha * (p1[1] - p0[1])];
      } else if (t1 > 1) {
        const alpha = (1 - t0) / dt;
        endPt = [p0[0] + alpha * (p1[0] - p0[0]), p0[1] + alpha * (p1[1] - p0[1])];
      }
    }

    if (clipped.length === 0) {
      clipped.push(startPt);
    }
    const last = clipped[clipped.length - 1];
    if (Math.hypot(endPt[0] - last[0], endPt[1] - last[1]) > 1e-6) {
      clipped.push(endPt);
    }
  }

  if (clipped.length < 2) return null;

  // Verify the clipped road segment lies within maxLateralMetres of the corridor axis
  const clippedMid = clipped[Math.floor(clipped.length / 2)];
  if (perpendicularMetres(clippedMid[0], clippedMid[1]) > maxLateralMetres) return null;

  // Verify the clipped segment runs along the corridor axis (excludes perpendicular cross-streets / roundabouts)
  const firstPt = clipped[0];
  const lastPt = clipped[clipped.length - 1];
  const segDx = (lastPt[0] - firstPt[0]) * lonScale;
  const segDy = (lastPt[1] - firstPt[1]) * latScale;
  const segLen = Math.hypot(segDx, segDy);
  if (segLen < 6) return null;
  const cosAngle = Math.abs(segDx * dx + segDy * dy) / (segLen * Math.sqrt(lenSq));
  if (cosAngle < 0.42) return null;

  return clipped;
}

/**
 * Extracts solid Magenta Average Speed Zone features directly from loaded MapLibre vector tile
 * road features ('transportation_name' / 'transportation') so West Midlands corridors are
 * immediately coloured at any zoom level even before Overpass finishes.
 */
export function extractTileAverageSpeedZones(
  tileFeatures: Array<{
    id?: string | number;
    properties?: Record<string, unknown> | null;
    geometry?: { type?: string; coordinates?: unknown } | null;
  }>,
): SafetyFeatureCollection {
  const features: SafetyFeatureCollection["features"] = [];
  const seenIds = new Set<string>();

  for (const feat of tileFeatures) {
    const props = feat.properties ?? {};
    const cls = String(props.class ?? "").toLowerCase();
    const subclass = String(props.subclass ?? "").toLowerCase();
    if (cls.includes("roundabout") || subclass.includes("roundabout") || props.ramp === 1 || props.ramp === true) {
      continue;
    }

    const keys: string[] = [];
    const rawRef = typeof props.ref === "string" ? props.ref : "";
    if (rawRef) {
      for (const part of rawRef.split(/[;/,\s]+/)) {
        const cleaned = part.trim().toUpperCase();
        if (cleaned) keys.push(`ref:${cleaned}`);
      }
    }
    const rawName = typeof props.name_en === "string"
      ? props.name_en
      : typeof props.name === "string"
      ? props.name
      : "";
    if (rawName) {
      keys.push(`name:${rawName.trim().toLowerCase()}`);
    }
    if (keys.length === 0) continue;

    const geom = feat.geometry;
    if (!geom) continue;
    const lines: [number, number][][] =
      geom.type === "LineString"
        ? [geom.coordinates as [number, number][]]
        : geom.type === "MultiLineString"
        ? (geom.coordinates as [number, number][][])
        : [];
    if (lines.length === 0) continue;

    for (const pair of KNOWN_WEST_MIDLANDS_AVG_SPEED_PAIRS) {
      if (!pair.roadKeys.some((k) => keys.includes(k))) continue;
      for (let lineIdx = 0; lineIdx < lines.length; lineIdx += 1) {
        const clipped = clipCoordsBetweenCameras(lines[lineIdx], pair.a, pair.b, pair.maxLateralMetres ?? 380);
        if (!clipped) continue;
        const startCoord = clipped[0];
        const endCoord = clipped[clipped.length - 1];
        const sig = `tile-avg/${pair.id}/${startCoord[0].toFixed(4)},${startCoord[1].toFixed(4)}-${endCoord[0].toFixed(4)},${endCoord[1].toFixed(4)}`;
        if (seenIds.has(sig)) continue;
        seenIds.add(sig);
        const speedLimit = Number(pair.speed);
        features.push({
          type: "Feature",
          id: sig,
          properties: {
            kind: "average_speed_zone",
            label: `AVG ${pair.speed} MPH`,
            roadName: pair.roadLabel,
            speedLimit: Number.isFinite(speedLimit) ? speedLimit : undefined,
          },
          geometry: { type: "LineString", coordinates: clipped },
        });
      }
    }
  }

  return { type: "FeatureCollection", features };
}

function averageSpeedZoneFeatures(hazardElements: OverpassElement[], regulationElements: OverpassElement[]): SafetyFeatureCollection {
  const features: SafetyFeatureCollection["features"] = [];
  const seenIds = new Set<string>();

  const addZoneCoordinates = (
    id: string,
    coordinates: [number, number][],
    speedStr: string | null,
    roadLabel: string | null,
  ) => {
    if (seenIds.has(id) || coordinates.length < 2) return;
    seenIds.add(id);
    const speedLimit = speedStr ? Number(speedStr) : undefined;
    const label = speedStr ? `AVG ${speedStr} MPH` : "AVG SPEED ZONE";
    features.push({
      type: "Feature",
      id,
      properties: {
        kind: "average_speed_zone",
        label,
        roadName: roadLabel ?? undefined,
        speedLimit: Number.isFinite(speedLimit) ? speedLimit : undefined,
      },
      geometry: { type: "LineString", coordinates },
    });
  };

  // Collect explicit average speed cameras and all speed cameras (for same-road-name corridor detection)
  const avgCameraPoints: Array<{ point: TrafficSignalPoint; speed: string | null }> = [];
  const allCameraPoints: Array<{ point: TrafficSignalPoint; speed: string | null }> = [];
  // Also collect explicit camera pairs defined by enforcement relations (from -> to)
  const relationPairs: Array<{ a: TrafficSignalPoint; b: TrafficSignalPoint; speed: string | null; name: string | null }> = [];
  const allElements = [...hazardElements, ...regulationElements];

  for (const element of allElements) {
    const tags = element.tags ?? {};
    const explicitAvg = isExplicitAverageSpeedElement(tags);

    if (element.type === "way" && explicitAvg && Array.isArray(element.geometry) && element.geometry.length >= 2) {
      if (tags.junction === "roundabout" || tags.junction === "circular") continue;
      const speed = normaliseSpeedLimit(tags.maxspeed);
      const roadLabel = tags.ref && tags.name ? `${tags.ref} ${tags.name}` : tags.name ?? tags.ref ?? null;
      const coordinates = element.geometry.map(({ lon, lat }) => [lon, lat] as [number, number]);
      addZoneCoordinates(`way/${element.id}/average_speed_zone`, coordinates, speed, roadLabel);
    }

    if (element.type === "relation" && explicitAvg && Array.isArray(element.members)) {
      const speed = normaliseSpeedLimit(tags.maxspeed);
      const roadLabel = tags.name ?? tags.ref ?? null;
      let addedMemberWay = false;
      for (const member of element.members) {
        if (member.type === "way" && Array.isArray(member.geometry) && member.geometry.length >= 2) {
          const coordinates = member.geometry.map(({ lon, lat }) => [lon, lat] as [number, number]);
          addZoneCoordinates(`way/${member.ref}/average_speed_zone`, coordinates, speed, roadLabel);
          addedMemberWay = true;
        }
      }
      if (!addedMemberWay) {
        const nodeMembers = element.members.filter(
          (m) => m.type === "node" && typeof m.lat === "number" && typeof m.lon === "number",
        );
        if (nodeMembers.length >= 2) {
          relationPairs.push({
            a: { latitude: nodeMembers[0].lat!, longitude: nodeMembers[0].lon! },
            b: { latitude: nodeMembers[nodeMembers.length - 1].lat!, longitude: nodeMembers[nodeMembers.length - 1].lon! },
            speed,
            name: roadLabel,
          });
        }
      }
    }

    const speedEnforcement = /^(speed|maximum_speed|maxspeed|average_speed)$/.test(tags.enforcement ?? "");
    if (tags.highway === "speed_camera" || speedEnforcement) {
      const pt = elementPoint(element);
      if (pt) {
        const camEntry = {
          point: pt,
          speed: normaliseSpeedLimit(tags.maxspeed ?? tags["maxspeed:enforcement"]),
        };
        allCameraPoints.push(camEntry);
        if (explicitAvg) {
          avgCameraPoints.push(camEntry);
        }
      }
    }
  }

  // Candidate main-carriageway road ways (exclude roundabouts and link/slip roads)
  const roadWays = regulationElements.filter((el) => {
    if (el.type !== "way" || !el.tags?.highway || !Array.isArray(el.geometry) || el.geometry.length < 2) return false;
    if (el.tags.junction === "roundabout" || el.tags.junction === "circular") return false;
    if (/_link$/.test(el.tags.highway)) return false;
    return true;
  });

  if (roadWays.length === 0) {
    return { type: "FeatureCollection", features };
  }

  type RoadWayInfo = {
    element: OverpassElement;
    path: TrafficSignalPoint[];
    coords: [number, number][];
    roadKeys: string[];
    nameKey: string | null;
    roadLabel: string | null;
    speed: string | null;
    nearAvgCameraIndices: number[];
    nearAllCameraIndices: number[];
  };

  const wayInfos: RoadWayInfo[] = roadWays.map((element) => {
    const tags = element.tags ?? {};
    const path = (element.geometry ?? []).map(({ lat, lon }) => ({ latitude: lat, longitude: lon }));
    const coords = (element.geometry ?? []).map(({ lon, lat }) => [lon, lat] as [number, number]);
    const keys: string[] = [];
    if (tags.ref) {
      for (const part of tags.ref.split(/[;/,]+/)) {
        const cleaned = part.trim().toUpperCase();
        if (cleaned) keys.push(`ref:${cleaned}`);
      }
    }
    const nameKey = tags.name ? `name:${tags.name.trim().toLowerCase()}` : null;
    if (nameKey) {
      keys.push(nameKey);
    }
    const roadLabel = tags.ref && tags.name && !tags.name.includes(tags.ref)
      ? `${tags.ref} ${tags.name}`
      : tags.name ?? tags.ref ?? null;
    const speed = normaliseSpeedLimit(tags.maxspeed);
    const nearAvgCameraIndices: number[] = [];
    const nearAllCameraIndices: number[] = [];

    for (let i = 0; i < avgCameraPoints.length; i += 1) {
      if (distanceToPathMetres(avgCameraPoints[i].point, path) <= 38) {
        nearAvgCameraIndices.push(i);
      }
    }

    for (let i = 0; i < allCameraPoints.length; i += 1) {
      if (distanceToPathMetres(allCameraPoints[i].point, path) <= 32) {
        nearAllCameraIndices.push(i);
      }
    }

    return { element, path, coords, roadKeys: keys, nameKey, roadLabel, speed, nearAvgCameraIndices, nearAllCameraIndices };
  });

  // Group explicit average-speed cameras by road key (ref or name)
  const roadKeyAvgCameras = new Map<string, Set<number>>();
  // Group all speed cameras strictly by road NAME (never ref alone, so differently named roads like Penn Rd vs Birmingham Rd never bridge)
  const roadNameAllCameras = new Map<string, Set<number>>();

  for (const info of wayInfos) {
    if (info.nearAvgCameraIndices.length > 0) {
      for (const key of info.roadKeys) {
        let set = roadKeyAvgCameras.get(key);
        if (!set) {
          set = new Set<number>();
          roadKeyAvgCameras.set(key, set);
        }
        for (const idx of info.nearAvgCameraIndices) set.add(idx);
      }
    }
    if (info.nameKey && info.nearAllCameraIndices.length > 0) {
      let set = roadNameAllCameras.get(info.nameKey);
      if (!set) {
        set = new Set<number>();
        roadNameAllCameras.set(info.nameKey, set);
      }
      for (const idx of info.nearAllCameraIndices) set.add(idx);
    }
  }

  // Build camera pairs (start camera -> end camera)
  const activePairs: Array<{ roadKeys: string[] | null; a: TrafficSignalPoint; b: TrafficSignalPoint; speed: string | null }> = [
    ...relationPairs.map((pair) => ({ roadKeys: null, a: pair.a, b: pair.b, speed: pair.speed })),
    ...KNOWN_WEST_MIDLANDS_AVG_SPEED_PAIRS.map((pair) => ({
      roadKeys: pair.roadKeys,
      a: pair.a,
      b: pair.b,
      speed: pair.speed,
    })),
  ];

  for (const [roadKey, camSet] of roadKeyAvgCameras.entries()) {
    const indices = [...camSet];
    if (indices.length < 2) continue;
    let bestPair: { a: TrafficSignalPoint; b: TrafficSignalPoint; dist: number; speed: string | null } | null = null;
    for (let i = 0; i < indices.length; i += 1) {
      for (let j = i + 1; j < indices.length; j += 1) {
        const camA = avgCameraPoints[indices[i]];
        const camB = avgCameraPoints[indices[j]];
        const dist = distanceMetres(camA.point, camB.point);
        if (dist >= 80 && dist <= 3_500 && (!bestPair || dist > bestPair.dist)) {
          bestPair = { a: camA.point, b: camB.point, dist, speed: camA.speed ?? camB.speed };
        }
      }
    }
    if (bestPair) {
      activePairs.push({ roadKeys: [roadKey], a: bestPair.a, b: bestPair.b, speed: bestPair.speed });
    }
  }

  for (const [nameKey, camSet] of roadNameAllCameras.entries()) {
    const indices = [...camSet];
    if (indices.length < 2) continue;
    // Require cameras on the exact same named road to be at least 220m apart (excludes single spot camera pairs on opposite carriageways)
    let bestPair: { a: TrafficSignalPoint; b: TrafficSignalPoint; dist: number; speed: string | null } | null = null;
    for (let i = 0; i < indices.length; i += 1) {
      for (let j = i + 1; j < indices.length; j += 1) {
        const camA = allCameraPoints[indices[i]];
        const camB = allCameraPoints[indices[j]];
        const dist = distanceMetres(camA.point, camB.point);
        if (dist >= 220 && dist <= 3_200 && (!bestPair || dist > bestPair.dist)) {
          bestPair = { a: camA.point, b: camB.point, dist, speed: camA.speed ?? camB.speed };
        }
      }
    }
    if (bestPair) {
      activePairs.push({ roadKeys: [nameKey], a: bestPair.a, b: bestPair.b, speed: bestPair.speed });
    }
  }

  // Colour only the road stretch strictly between camera A and camera B
  for (const info of wayInfos) {
    for (const pair of activePairs) {
      if (pair.roadKeys !== null && !pair.roadKeys.some((k) => info.roadKeys.includes(k))) continue;
      const clipped = clipCoordsBetweenCameras(info.coords, pair.a, pair.b, 380);
      if (clipped) {
        addZoneCoordinates(
          `way/${info.element.id}/average_speed_zone`,
          clipped,
          info.speed ?? pair.speed,
          info.roadLabel,
        );
        break;
      }
    }
  }

  return { type: "FeatureCollection", features };
}

function roadClosureFeatures(elements: OverpassElement[]): SafetyFeatureCollection {
  const features: SafetyFeatureCollection["features"] = [];
  for (const element of elements) {
    if (element.type !== "way") continue;
    const tags = element.tags ?? {};
    if (isNonRoadProject(tags)) continue;
    const roadClass = tags.highway === "construction" ? (tags.construction || "road") : tags.highway;
    const motorRoad = MOTOR_ROAD_CLASS_RE.test(roadClass ?? "");
    const accessClosed = [tags.access, tags.vehicle, tags.motor_vehicle, tags.motorcar]
      .some((value) => /^(no|private)$/.test(value ?? ""));
    if (!motorRoad || (tags.highway !== "construction" && !(tags.construction && accessClosed))) continue;
    const feature = wayFeature(element, "road_closure", tags.name ? `CLOSED · ${tags.name}` : "ROAD CLOSED");
    if (feature) features.push(feature);
  }
  return { type: "FeatureCollection", features };
}

function roadWorksFeatures(elements: OverpassElement[]): SafetyFeatureCollection {
  const features: SafetyFeatureCollection["features"] = [];
  for (const element of elements) {
    const tags = element.tags ?? {};
    if (isNonRoadProject(tags)) continue;
    if (element.type === "way") {
      if (!isMotorRoadWayConstruction(tags)) continue;
      const label = tags.name ? `WORKS · ${tags.name}` : "ROAD WORKS";
      const feature = wayFeature(element, "roadworks", label);
      if (feature) features.push(feature);
    } else if (element.type === "node") {
      if (tags.highway !== "construction" && tags.highway !== "roadworks" && tags.hazard !== "roadworks") continue;
      const label = tags.name ? `WORKS · ${tags.name}` : "ROAD WORKS";
      const feature = pointFeature(element, "roadworks", label);
      if (feature) features.push(feature);
    }
  }
  return { type: "FeatureCollection", features };
}

function driverAmenityFeatures(elements: OverpassElement[]): SafetyFeatureCollection {
  const features: SafetyFeatureCollection["features"] = [];
  for (const element of elements) {
    const tags = element.tags ?? {};
    let kind: SafetyKind | null = null;
    let label = "";
    if (tags.amenity === "charging_station") {
      kind = "ev_charger";
      label = "EV";
    } else if (tags.amenity === "parking") {
      kind = "parking";
      label = "P";
    } else if (tags.boundary === "low_emission_zone") {
      kind = "clean_air_zone";
      label = tags.short_name ?? tags.ref ?? "CAZ";
    }
    if (kind) {
      const feature = pointFeature(element, kind, label);
      if (feature) features.push(feature);
    }
  }
  return { type: "FeatureCollection", features };
}

function detailFeatures(elements: OverpassElement[]): SafetyFeatureCollection["features"] {
  const features: SafetyFeatureCollection["features"] = [];
  const seen = new Set<string>();
  for (const element of elements) {
    const tags = element.tags ?? {};
    let kind: SafetyKind | null = null;
    let label = "";
    const speedEnforcement = /^(speed|maximum_speed|maxspeed|average_speed)$/.test(tags.enforcement ?? "");
    if (tags.highway === "speed_camera" || speedEnforcement) {
      kind = "speed_camera";
      label = isExplicitAverageSpeedElement(tags) ? "Average speed" : "Speed camera";
    } else if (element.type === "way") {
      kind = "restricted";
      label = isBusAccessOnly(tags) || isExplicitBusLane(tags) ? "BUS LANE" : "";
    } else if (tags.barrier === "bus_trap" || isBusAccessOnly(tags)) {
      kind = "restriction_entrance";
      label = "BUS GATE";
    }
    if (!kind || !label) continue;
    const key = `${element.type}/${element.id}/${kind}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (element.type === "way" && kind !== "speed_camera") {
      const coordinates = (element.geometry ?? []).map(({ lon, lat }) => [lon, lat] as [number, number]);
      if (coordinates.length >= 2) features.push({ type: "Feature", id: key, properties: { kind, label }, geometry: { type: "LineString", coordinates } });
    } else {
      const feature = pointFeature(element, kind, label);
      if (feature) {
        if (kind === "speed_camera") {
          const direction = cameraEnforcementDirection(element);
          if (direction !== null) feature.properties.direction = direction;
        }
        features.push(feature);
      }
    }
  }
  return features;
}

export async function fetchSafetyFeatures(
  centre: Point,
  radiusMetres = 2_400,
  onTrafficSignals?: (signals: SafetyFeatureCollection) => void,
  onRestrictions?: (restrictions: SafetyFeatureCollection) => void,
  onRoadRules?: (rules: SafetyFeatureCollection) => void,
  onAmenities?: (amenities: SafetyFeatureCollection) => void,
  onClosures?: (closures: SafetyFeatureCollection) => void,
): Promise<SafetyFeatureCollection> {
  const radius = Math.min(radiusMetres, 2_400);
  const dLat = radius / 111_320;
  const dLon = radius / (111_320 * Math.cos(centre.latitude * Math.PI / 180));
  const minLat = (centre.latitude - dLat).toFixed(5);
  const maxLat = (centre.latitude + dLat).toFixed(5);
  const minLon = (centre.longitude - dLon).toFixed(5);
  const maxLon = (centre.longitude + dLon).toFixed(5);
  const bbox = `(${minLat},${minLon},${maxLat},${maxLon})`;

  // Primary fast hazards query: Traffic signals, road humps/calming, roadworks (motor highways only, no HS2/rail!), speed cameras, closures, crossings
  const hazardsQuery = `[out:json][timeout:15];(
  node${bbox}["highway"="traffic_signals"];
  node${bbox}["traffic_calming"];
  way${bbox}["traffic_calming"];
  node${bbox}["barrier"="bump"];
  node${bbox}["highway"="speed_camera"];
  nwr${bbox}["enforcement"~"^(speed|maximum_speed|maxspeed|average_speed)$"];
  way${bbox}["highway"="construction"];
  way${bbox}["highway"]["construction"];
  node${bbox}["highway"="construction"];
  node${bbox}["highway"="roadworks"];
  node${bbox}["traffic_sign"~"(no[_ ]?entry|GB:601)",i];
  node${bbox}["traffic_sign:forward"~"(no[_ ]?entry|GB:601)",i];
  node${bbox}["traffic_sign:backward"~"(no[_ ]?entry|GB:601)",i];
  node${bbox}["railway"~"^(level_crossing|tram_crossing)$"];
  way${bbox}["highway"~"^(pedestrian|living_street)$"];
  way${bbox}["junction"~"^(roundabout|circular)$"]["highway"];
);out body geom qt;`;

  // Secondary regulations query: Bus lanes, turn restrictions, speed limits, parking/EV
  const regulationsQuery = `[out:json][timeout:15];(
  way${bbox}["highway"]["busway"~"^(lane|opposite|opposite_lane)$"];
  way${bbox}["highway"]["bus:lanes"~"(designated|yes)"];
  way${bbox}["highway"]["access"~"^(no|private)$"]["bus"~"^(yes|designated|permissive)$"];
  node${bbox}["barrier"="bus_trap"];
  relation${bbox}["type"="restriction"];
  way${bbox}["highway"]["maxspeed"];
  way${bbox}["highway"~"^(trunk|primary|secondary)$"];
  node${bbox}["amenity"~"^(charging_station|parking)$"];
);out body geom qt;`;

  const curated = curatedRestrictions(centre, radiusMetres);
  const progressiveRestrictions = [...curated.features];
  const publishRestrictions = (collection: SafetyFeatureCollection) => {
    for (const feature of collection.features) {
      if (!progressiveRestrictions.some((candidate) => candidate.id === feature.id)) progressiveRestrictions.push(feature);
    }
    onRestrictions?.({ type: "FeatureCollection", features: progressiveRestrictions });
  };
  if (curated.features.length) publishRestrictions(curated);

  let rawHazardElements: OverpassElement[] = [];
  let rawRegulationElements: OverpassElement[] = [];

  const hazardRequest = fetchOverpass(hazardsQuery, 0, 1_500).then((payload) => {
    const elements = payload.elements ?? [];
    rawHazardElements = elements;
    const signals = trafficSignalFeatures(elements);
    if (signals.features.length) onTrafficSignals?.(signals);

    const rules = roadRuleFeatures(elements);
    if (rules.features.length) onRoadRules?.(rules);

    const closures = roadClosureFeatures(elements);
    if (closures.features.length) onClosures?.(closures);

    const works = roadWorksFeatures(elements);
    if (works.features.length) onRoadRules?.(works);

    const cameras: SafetyFeatureCollection = { type: "FeatureCollection", features: detailFeatures(elements) };
    if (cameras.features.length) onRoadRules?.(cameras);

    return { signals, rules, closures, works, cameras };
  });

  const regulationRequest = fetchOverpass(regulationsQuery, 300, 1_800).then((payload) => {
    const elements = payload.elements ?? [];
    rawRegulationElements = elements;
    const busLanes: SafetyFeatureCollection = { type: "FeatureCollection", features: detailFeatures(elements) };
    publishRestrictions(busLanes);

    const turns = roadRuleFeatures(elements);
    if (turns.features.length) onRoadRules?.(turns);

    const speedLimits = speedLimitFeatures(elements);
    if (speedLimits.features.length) onRoadRules?.(speedLimits);

    const amenities = driverAmenityFeatures(elements);
    if (amenities.features.length) onAmenities?.(amenities);

    return { busLanes, turns, speedLimits, amenities };
  });

  const [hazardsResult, regulationsResult] = await Promise.allSettled([
    hazardRequest,
    regulationRequest,
  ]);

  if (hazardsResult.status === "rejected" && regulationsResult.status === "rejected") {
    throw new Error("Safety overlay unavailable");
  }

  const features: SafetyFeatureCollection["features"] = [...curated.features];

  if (hazardsResult.status === "fulfilled") {
    const { signals, rules, closures, works, cameras } = hazardsResult.value;
    features.push(
      ...signals.features,
      ...rules.features,
      ...closures.features,
      ...works.features,
      ...cameras.features,
    );
  }

  if (regulationsResult.status === "fulfilled") {
    const { busLanes, turns, speedLimits, amenities } = regulationsResult.value;
    features.push(
      ...busLanes.features,
      ...turns.features,
      ...speedLimits.features,
      ...amenities.features,
    );
  }

  const avgZones = averageSpeedZoneFeatures(rawHazardElements, rawRegulationElements);
  if (avgZones.features.length) {
    onRoadRules?.(avgZones);
    features.push(...avgZones.features);
  }

  const data: SafetyFeatureCollection = { type: "FeatureCollection", features };
  saveSafetyFeatures(centre, radiusMetres, data);
  return data;
}
