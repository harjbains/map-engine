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

const CACHE_KEY = "map-engine-safety-overlay-v23";
const LEGACY_CACHE_KEYS = ["map-engine-safety-overlay-v21", "map-engine-safety-overlay-v20", "map-engine-safety-overlay-v19", "map-engine-safety-overlay-v18", "map-engine-safety-overlay-v17", "map-engine-safety-overlay-v16"];
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

// Official West Midlands Police (wmsafetycameras.co.uk) Average Speed Camera routes.
// Exclusively these routes are permanently coloured in Magenta on the map.
export const KNOWN_WEST_MIDLANDS_AVG_SPEED_PAIRS: Array<{
  id: string;
  roadLabel: string;
  roadKeys: string[];
  a: TrafficSignalPoint;
  b: TrafficSignalPoint;
  speed: string;
  maxLateralMetres?: number;
}> = [
  // 1a. A34 Birmingham Road between Lake Avenue and Charlemont Road, Walsall (30 mph, IDs 4410, 4411)
  {
    id: "wmp-4410-4411-a34-birmingham-rd-lake-charlemont",
    roadLabel: "A34 Birmingham Road",
    roadKeys: ["name:birmingham road", "ref:A34"],
    a: { latitude: 52.572043, longitude: -1.959669 },
    b: { latitude: 52.567785, longitude: -1.951758 },
    speed: "30",
    maxLateralMetres: 130,
  },
  // 1b. A34 Birmingham Road between Beacon Road and Chapel Lane, Walsall (30 mph, ID 4412)
  {
    id: "wmp-4412-a34-birmingham-rd-beacon-chapel",
    roadLabel: "A34 Birmingham Road",
    roadKeys: ["name:birmingham road", "ref:A34"],
    a: { latitude: 52.563915, longitude: -1.946237 },
    b: { latitude: 52.559200, longitude: -1.940100 },
    speed: "30",
    maxLateralMetres: 130,
  },
  // 1c. A34 Birmingham Road between Wilderness Lane and Lodge Road, Sandwell (30 mph, ID 4413)
  {
    id: "wmp-4413-a34-birmingham-rd-wilderness-lodge",
    roadLabel: "A34 Birmingham Road",
    roadKeys: ["name:birmingham road", "ref:A34"],
    a: { latitude: 52.556403, longitude: -1.936432 },
    b: { latitude: 52.550800, longitude: -1.930100 },
    speed: "30",
    maxLateralMetres: 130,
  },
  // 2. A34 New Town Row between New John St West and Newbury Road, Birmingham (30 mph, ID 181)
  {
    id: "wmp-181-a34-new-town-row",
    roadLabel: "A34 New Town Row",
    roadKeys: ["name:new town row", "name:newtown row", "ref:A34"],
    a: { latitude: 52.493020, longitude: -1.895550 },
    b: { latitude: 52.498290, longitude: -1.895600 },
    speed: "30",
    maxLateralMetres: 110,
  },
  // 3. A34 Stratford Road Between B4102 Marshall Lake Road and Dog Kennel Lane, Solihull (40 mph, IDs 339, 340)
  {
    id: "wmp-339-340-a34-stratford-rd-marshall-dogkennel",
    roadLabel: "A34 Stratford Road",
    roadKeys: ["name:stratford road", "ref:A34"],
    a: { latitude: 52.410620, longitude: -1.825600 },
    b: { latitude: 52.393925, longitude: -1.824048 },
    speed: "40",
    maxLateralMetres: 150,
  },
  // 4. A34 Stratford Road Between Dog Kennel Lane and M42 Junction 4, Solihull (40 mph, IDs 337, 338)
  {
    id: "wmp-337-338-a34-stratford-rd-dogkennel-m42",
    roadLabel: "A34 Stratford Road",
    roadKeys: ["name:stratford road", "ref:A34"],
    a: { latitude: 52.393925, longitude: -1.824048 },
    b: { latitude: 52.379789, longitude: -1.787769 },
    speed: "40",
    maxLateralMetres: 160,
  },
  // 5. A3400 Stratford Road between Avenue Albert and School Road, Solihull (30 mph, IDs 2313, 2314)
  {
    id: "wmp-2313-2314-a3400-stratford-rd",
    roadLabel: "A3400 Stratford Road",
    roadKeys: ["name:stratford road", "ref:A3400"],
    a: { latitude: 52.361200, longitude: -1.781600 },
    b: { latitude: 52.353200, longitude: -1.776800 },
    speed: "30",
    maxLateralMetres: 120,
  },
  // 6. A38 Bristol Road between Priory Road and Speedwell Road, Birmingham (30 mph, IDs 928, 929)
  {
    id: "wmp-928-929-a38-bristol-rd",
    roadLabel: "A38 Bristol Road",
    roadKeys: ["name:bristol road", "ref:A38"],
    a: { latitude: 52.462521, longitude: -1.904237 },
    b: { latitude: 52.456700, longitude: -1.909200 },
    speed: "30",
    maxLateralMetres: 120,
  },
  // 7. A41 Black Country New Road between Moxley Junction and Patent Shaft Roundabout (40 mph, IDs 4418, 4419)
  {
    id: "wmp-4418-4419-a41-bcnr-moxley-patentshaft",
    roadLabel: "A41 Black Country New Road",
    roadKeys: ["name:black country new road", "ref:A41"],
    a: { latitude: 52.560260, longitude: -2.046355 },
    b: { latitude: 52.556500, longitude: -2.035447 },
    speed: "40",
    maxLateralMetres: 140,
  },
  // 8. A4114 London Road between Daventry Road and Ringway St Johns, Coventry (30 mph, IDs 520, 521)
  {
    id: "wmp-520-521-a4114-london-rd",
    roadLabel: "A4114 London Road",
    roadKeys: ["name:london road", "ref:A4114"],
    a: { latitude: 52.402185, longitude: -1.499863 },
    b: { latitude: 52.394938, longitude: -1.495389 },
    speed: "30",
    maxLateralMetres: 130,
  },
  // 9. A4123 Birmingham New Road between Priory Road and Burnt Tree, Dudley (40 mph, IDs 1049, 1050)
  {
    id: "wmp-1049-1050-a4123-priory-burnttree",
    roadLabel: "A4123 Birmingham New Road",
    roadKeys: ["name:birmingham new road", "name:new birmingham road", "ref:A4123"],
    a: { latitude: 52.527628, longitude: -2.084752 },
    b: { latitude: 52.507830, longitude: -2.039680 },
    speed: "40",
    maxLateralMetres: 240,
  },
  // 10. A4123 Wolverhampton Road between Bleakhouse Road and Pound Road, Sandwell (40 mph, IDs 4420, 4421)
  {
    id: "wmp-4420-4421-a4123-pound-bleakhouse",
    roadLabel: "A4123 Wolverhampton Road",
    roadKeys: ["name:wolverhampton road", "ref:A4123"],
    a: { latitude: 52.488130, longitude: -2.018780 },
    b: { latitude: 52.471617, longitude: -1.998055 },
    speed: "40",
    maxLateralMetres: 160,
  },
  // 11. A4148 Broadway North Between Persehouse Street and Princes Avenue, Walsall (30 mph, IDs 4414, 4415)
  {
    id: "wmp-4414-4415-a4148-broadway-north",
    roadLabel: "A4148 Broadway North",
    roadKeys: ["name:broadway north", "ref:A4148"],
    a: { latitude: 52.588234, longitude: -1.972525 },
    b: { latitude: 52.585716, longitude: -1.965251 },
    speed: "30",
    maxLateralMetres: 120,
  },
  // 12. A4444 Black Country New Road between The Lunt Junction and Moxley Junction (40 mph, IDs 4416, 4417)
  {
    id: "wmp-4416-4417-a4444-bcnr-lunt-moxley",
    roadLabel: "A4444 Black Country New Road",
    roadKeys: ["name:black country new road", "ref:A4444"],
    a: { latitude: 52.568085, longitude: -2.054076 },
    b: { latitude: 52.561280, longitude: -2.050387 },
    speed: "40",
    maxLateralMetres: 140,
  },
  // 13. A449 Stafford Rd between Oxley Ave and Greenwood Rd, Wolverhampton (40 mph, IDs 736, 737)
  {
    id: "wmp-736-737-a449-stafford-rd",
    roadLabel: "A449 Stafford Road",
    roadKeys: ["name:stafford road", "ref:A449"],
    a: { latitude: 52.608500, longitude: -2.126500 },
    b: { latitude: 52.615843, longitude: -2.131525 },
    speed: "40",
    maxLateralMetres: 140,
  },
  // 14. A45 Coventry Road between Berkley Road and Rowland Road/Steyning Road, Birmingham (40 mph, IDs 926, 927)
  {
    id: "wmp-926-927-a45-coventry-rd",
    roadLabel: "A45 Coventry Road",
    roadKeys: ["name:coventry road", "ref:A45"],
    a: { latitude: 52.463190, longitude: -1.830630 },
    b: { latitude: 52.461110, longitude: -1.805780 },
    speed: "40",
    maxLateralMetres: 140,
  },
  // 15. A4540 Belgrave Middleway / Leebank Middleway between Five Ways and Haden Circus Roundabout (40 mph, IDs 174, 175)
  {
    id: "wmp-174-a4540-leebank-middleway",
    roadLabel: "A4540 Lee Bank Middleway",
    roadKeys: ["name:lee bank middleway", "name:leebank middleway", "name:belgrave middleway", "ref:A4540"],
    a: { latitude: 52.472280, longitude: -1.915600 },
    b: { latitude: 52.467805, longitude: -1.904438 },
    speed: "40",
    maxLateralMetres: 120,
  },
  {
    id: "wmp-175-a4540-belgrave-middleway",
    roadLabel: "A4540 Belgrave Middleway",
    roadKeys: ["name:belgrave middleway", "name:lee bank middleway", "ref:A4540"],
    a: { latitude: 52.467805, longitude: -1.904438 },
    b: { latitude: 52.463590, longitude: -1.888780 },
    speed: "40",
    maxLateralMetres: 140,
  },
  // 16. A4540 New John St West between Hospital Street and Lucas Circus, Birmingham (30 mph, IDs 178, 179)
  {
    id: "wmp-178-179-a4540-new-john-st-west",
    roadLabel: "A4540 New John Street West",
    roadKeys: ["name:new john street west", "name:new john st west", "ref:A4540"],
    a: { latitude: 52.493860, longitude: -1.906016 },
    b: { latitude: 52.493038, longitude: -1.901629 },
    speed: "30",
    maxLateralMetres: 110,
  },
  // 17. A456 Hagley Road between Lordswood Road and Portland Road, Birmingham (30 mph, IDs 924, 925)
  {
    id: "wmp-924-925-a456-hagley-rd",
    roadLabel: "A456 Hagley Road",
    roadKeys: ["name:hagley road", "ref:A456"],
    a: { latitude: 52.472830, longitude: -1.966890 },
    b: { latitude: 52.471963, longitude: -1.937567 },
    speed: "30",
    maxLateralMetres: 150,
  },
  // 18. A458 Windmill Hill between Lye and Halesowen, Dudley (30 mph, IDs 939, 940)
  {
    id: "wmp-939-940-a458-windmill-hill",
    roadLabel: "A458 Windmill Hill",
    roadKeys: ["name:windmill hill", "name:colley gate", "ref:A458"],
    a: { latitude: 52.459408, longitude: -2.085156 },
    b: { latitude: 52.457083, longitude: -2.078560 },
    speed: "30",
    maxLateralMetres: 120,
  },
  // 19. A4600 Ansty Road Between Sewall Highway & Clifford Bridge Rd, Coventry (40 mph, IDs 1552, 1553)
  {
    id: "wmp-1552-1553-a4600-ansty-rd",
    roadLabel: "A4600 Ansty Road",
    roadKeys: ["name:ansty road", "ref:A4600"],
    a: { latitude: 52.418181, longitude: -1.457556 },
    b: { latitude: 52.420413, longitude: -1.452338 },
    speed: "40",
    maxLateralMetres: 120,
  },
  // 20. Allard Way between London Road and Binley Road, Coventry (40 mph, IDs 548, 549)
  {
    id: "wmp-548-549-allard-way",
    roadLabel: "Allard Way",
    roadKeys: ["name:allard way", "ref:A4082"],
    a: { latitude: 52.390560, longitude: -1.481599 },
    b: { latitude: 52.404284, longitude: -1.460610 },
    speed: "40",
    maxLateralMetres: 160,
  },
  // 21. B4098 Tamworth Road between Bennetts Road Roundabout and Long Lane, Coventry (30 mph, IDs 538, 539)
  {
    id: "wmp-538-539-b4098-tamworth-rd",
    roadLabel: "B4098 Tamworth Road",
    roadKeys: ["name:tamworth road", "ref:B4098"],
    a: { latitude: 52.435895, longitude: -1.531844 },
    b: { latitude: 52.445032, longitude: -1.543298 },
    speed: "30",
    maxLateralMetres: 140,
  },
  // 22. B4110 London Road between Allard Way and Robert Close, Coventry (30 mph, IDs 1556, 1557)
  {
    id: "wmp-1556-1557-b4110-london-rd",
    roadLabel: "B4110 London Road",
    roadKeys: ["name:london road", "ref:B4110", "ref:A4114"],
    a: { latitude: 52.390016, longitude: -1.481613 },
    b: { latitude: 52.380196, longitude: -1.468091 },
    speed: "30",
    maxLateralMetres: 140,
  },
  // 23. B4114 Bradford Road between Chester Road and Old Croft Lane, Solihull (30 mph, IDs 334, 336)
  {
    id: "wmp-334-336-b4114-bradford-rd",
    roadLabel: "B4114 Bradford Road",
    roadKeys: ["name:bradford road", "name:collector road", "ref:B4114"],
    a: { latitude: 52.501830, longitude: -1.779400 },
    b: { latitude: 52.502020, longitude: -1.774210 },
    speed: "30",
    maxLateralMetres: 120,
  },
  // 24. B425 Lode Lane between Henley Crescent and Moat Lane, Solihull (30 mph, IDs 326, 327)
  {
    id: "wmp-326-327-b425-lode-lane",
    roadLabel: "B425 Lode Lane",
    roadKeys: ["name:lode lane", "ref:B425", "ref:B4102"],
    a: { latitude: 52.438980, longitude: -1.783640 },
    b: { latitude: 52.426037, longitude: -1.776790 },
    speed: "30",
    maxLateralMetres: 140,
  },
  // 25. Bell Green Road between Old Church Road and Sewall Highway, Coventry (30 mph, IDs 528, 529)
  {
    id: "wmp-528-529-bell-green-rd",
    roadLabel: "Bell Green Road",
    roadKeys: ["name:bell green road", "ref:B4109"],
    a: { latitude: 52.436121, longitude: -1.475865 },
    b: { latitude: 52.432735, longitude: -1.481125 },
    speed: "30",
    maxLateralMetres: 120,
  },
  // 26. Binley Road between Bray Lane & Sky Blue Way, Coventry (30 mph, IDs 516, 518)
  {
    id: "wmp-516-518-binley-rd",
    roadLabel: "Binley Road",
    roadKeys: ["name:binley road", "ref:A428"],
    a: { latitude: 52.406800, longitude: -1.489500 },
    b: { latitude: 52.406189, longitude: -1.481914 },
    speed: "30",
    maxLateralMetres: 120,
  },
  // 27. Foleshill Road between Eagle Street and Ringway St Nicholas, Coventry (30 mph, IDs 534, 535)
  {
    id: "wmp-534-535-foleshill-rd",
    roadLabel: "Foleshill Road",
    roadKeys: ["name:foleshill road", "ref:B4113"],
    a: { latitude: 52.413769, longitude: -1.509492 },
    b: { latitude: 52.419054, longitude: -1.507256 },
    speed: "30",
    maxLateralMetres: 120,
  },
  // 28. Hearsall Common between Broad Lane and Queensland Avenue, Coventry (30 mph, IDs 556, 557)
  {
    id: "wmp-556-557-hearsall-common",
    roadLabel: "Hearsall Common",
    roadKeys: ["name:hearsall common", "ref:B4101"],
    a: { latitude: 52.404048, longitude: -1.545470 },
    b: { latitude: 52.404946, longitude: -1.535410 },
    speed: "30",
    maxLateralMetres: 120,
  },
  // 29. Hearsall Lane between Queensland Avenue and Spon End, Coventry (30 mph, IDs 558, 559)
  {
    id: "wmp-558-559-hearsall-lane",
    roadLabel: "Hearsall Lane",
    roadKeys: ["name:hearsall lane", "ref:B4101"],
    a: { latitude: 52.405044, longitude: -1.535310 },
    b: { latitude: 52.408345, longitude: -1.530141 },
    speed: "30",
    maxLateralMetres: 120,
  },
  // 30. Henley Road between Newhall Road & Woodway Lane, Coventry (30 mph, IDs 522, 523)
  {
    id: "wmp-522-523-henley-rd",
    roadLabel: "Henley Road",
    roadKeys: ["name:henley road", "ref:B4082"],
    a: { latitude: 52.430420, longitude: -1.462086 },
    b: { latitude: 52.428826, longitude: -1.446834 },
    speed: "30",
    maxLateralMetres: 130,
  },
  // 31. Hinckley Road between Wigston Road and Woodway Lane, Coventry (40 mph, IDs 530, 531)
  {
    id: "wmp-530-531-hinckley-rd",
    roadLabel: "Hinckley Road",
    roadKeys: ["name:hinckley road", "ref:A4600"],
    a: { latitude: 52.425095, longitude: -1.443855 },
    b: { latitude: 52.430346, longitude: -1.438321 },
    speed: "40",
    maxLateralMetres: 120,
  },
  // 32. Kenilworth Road between A45 Kenpas Highway and Leamington Road, Coventry (40 mph, IDs 546, 547)
  {
    id: "wmp-546-547-kenilworth-rd",
    roadLabel: "Kenilworth Road",
    roadKeys: ["name:kenilworth road", "ref:A429"],
    a: { latitude: 52.386505, longitude: -1.534930 },
    b: { latitude: 52.396339, longitude: -1.517011 },
    speed: "40",
    maxLateralMetres: 140,
  },
  // 33. Keresley Road between Brownshill Green Road and Tamworth Road, Coventry (30 mph, IDs 544, 545)
  {
    id: "wmp-544-545-keresley-rd",
    roadLabel: "Keresley Road",
    roadKeys: ["name:keresley road"],
    a: { latitude: 52.428647, longitude: -1.529087 },
    b: { latitude: 52.435564, longitude: -1.531717 },
    speed: "30",
    maxLateralMetres: 120,
  },
  // 34. Longford Road / Bedworth Road between Oban Road and Windmill Road, Coventry (30 mph, IDs 526, 527)
  {
    id: "wmp-526-527-longford-bedworth-rd",
    roadLabel: "Longford Road",
    roadKeys: ["name:longford road", "name:bedworth road", "ref:B4113"],
    a: { latitude: 52.444252, longitude: -1.488684 },
    b: { latitude: 52.453614, longitude: -1.485271 },
    speed: "30",
    maxLateralMetres: 130,
  },
  // 35. Old Church Road between Foleshill Road and Mannion Avenue, Coventry (30 mph, IDs 532, 533)
  {
    id: "wmp-532-533-old-church-rd",
    roadLabel: "Old Church Road",
    roadKeys: ["name:old church road", "ref:B4109"],
    a: { latitude: 52.440501, longitude: -1.508609 },
    b: { latitude: 52.437922, longitude: -1.492107 },
    speed: "30",
    maxLateralMetres: 130,
  },
  // 36. Radford Road between Ringway St Nicholas and Brownshill Green Road, Coventry (30 mph, IDs 542, 543)
  {
    id: "wmp-542-543-radford-rd",
    roadLabel: "Radford Road",
    roadKeys: ["name:radford road", "ref:B4098"],
    a: { latitude: 52.411848, longitude: -1.515194 },
    b: { latitude: 52.428345, longitude: -1.528805 },
    speed: "30",
    maxLateralMetres: 150,
  },
  // 37. Stoney Stanton Road between Howard Street and Crabmill Lane, Coventry (30 mph, IDs 536, 537)
  {
    id: "wmp-536-537-stoney-stanton-rd",
    roadLabel: "Stoney Stanton Road",
    roadKeys: ["name:stoney stanton road", "ref:B4109"],
    a: { latitude: 52.414690, longitude: -1.504458 },
    b: { latitude: 52.427238, longitude: -1.491383 },
    speed: "30",
    maxLateralMetres: 150,
  },
  // 38. The Scotchill / Burnaby Road between Beake Avenue and Keresley Road, Coventry (30 mph, IDs 524, 525)
  {
    id: "wmp-524-525-scotchill-burnaby-rd",
    roadLabel: "Burnaby Road / The Scotchill",
    roadKeys: ["name:the scotchill", "name:burnaby road"],
    a: { latitude: 52.435381, longitude: -1.522757 },
    b: { latitude: 52.435717, longitude: -1.531385 },
    speed: "30",
    maxLateralMetres: 120,
  },
  // 39. Walsgrave Road between Briton Road and Church Lane, Coventry (30 mph, IDs 540, 541)
  {
    id: "wmp-540-541-walsgrave-rd",
    roadLabel: "Walsgrave Road",
    roadKeys: ["name:walsgrave road", "ref:A4600"],
    a: { latitude: 52.411638, longitude: -1.480215 },
    b: { latitude: 52.411365, longitude: -1.475118 },
    speed: "30",
    maxLateralMetres: 110,
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

    const isMajorRoadGeometry =
      cls === "trunk" || cls === "primary" || cls === "secondary" || cls === "tertiary";
    if (keys.length === 0 && !isMajorRoadGeometry) continue;

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
      const hasKeyMatch = keys.length > 0 && pair.roadKeys.some((k) => keys.includes(k));
      if (!hasKeyMatch && keys.length > 0) continue;

      const lateralLimit = hasKeyMatch
        ? (pair.maxLateralMetres ?? 160)
        : Math.min(pair.maxLateralMetres ?? 120, 34);

      for (let lineIdx = 0; lineIdx < lines.length; lineIdx += 1) {
        const clipped = clipCoordsBetweenCameras(lines[lineIdx], pair.a, pair.b, lateralLimit);
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

function averageSpeedZoneFeatures(_hazardElements: OverpassElement[], regulationElements: OverpassElement[]): SafetyFeatureCollection {
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

  for (const element of roadWays) {
    const tags = element.tags ?? {};
    const coords = (element.geometry ?? []).map(({ lon, lat }) => [lon, lat] as [number, number]);
    const roadKeys: string[] = [];
    if (tags.ref) {
      for (const part of tags.ref.split(/[;/,]+/)) {
        const cleaned = part.trim().toUpperCase();
        if (cleaned) roadKeys.push(`ref:${cleaned}`);
      }
    }
    if (tags.name) {
      roadKeys.push(`name:${tags.name.trim().toLowerCase()}`);
    }
    if (roadKeys.length === 0) continue;

    const roadLabel = tags.ref && tags.name && !tags.name.includes(tags.ref)
      ? `${tags.ref} ${tags.name}`
      : tags.name ?? tags.ref ?? null;

    // Match exclusively against the official West Midlands Police Average Speed Camera routes
    for (const pair of KNOWN_WEST_MIDLANDS_AVG_SPEED_PAIRS) {
      if (!pair.roadKeys.some((k) => roadKeys.includes(k))) continue;
      const clipped = clipCoordsBetweenCameras(coords, pair.a, pair.b, pair.maxLateralMetres ?? 180);
      if (clipped) {
        addZoneCoordinates(
          `way/${element.id}/${pair.id}/average_speed_zone`,
          clipped,
          pair.speed,
          pair.roadLabel || roadLabel,
        );
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
