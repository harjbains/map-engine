import type { Point } from "./driving";

export type SafetyKind =
  | "restricted"
  | "restriction_entrance"
  | "traffic_signal"
  | "speed_camera"
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
    properties: { kind: SafetyKind; label: string };
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

const CACHE_KEY = "map-engine-safety-overlay-v14";
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;
const CACHE_MAX_AREAS = 10;
const OVERPASS_MIRRORS = ["https://maps.mail.ru/osm/tools/overpass/api/interpreter"];
const OVERPASS_URLS = typeof __STATIC_BUILD__ !== "undefined" && __STATIC_BUILD__
  ? OVERPASS_MIRRORS
  : ["/api/overpass", ...OVERPASS_MIRRORS];
const SIGNAL_CLUSTER_METRES = 60;
const ROUNDABOUT_SIGNAL_CLUSTER_METRES = 24;
const ROUNDABOUT_ASSOCIATION_METRES = 45;
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
    properties: { kind, label },
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

async function requestOverpass(endpoint: string, query: string, delayMs: number, controllers: AbortController[]) {
  const controller = new AbortController();
  controllers.push(controller);
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
  const timeoutCap = declaredTimeout ? Number(declaredTimeout) * 1_000 + 3_000 : 20_000;
  const timeout = window.setTimeout(() => controller.abort(), Math.min(30_000, timeoutCap));
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: new URLSearchParams({ data: query }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Overpass ${response.status}`);
    return await response.json() as { elements?: OverpassElement[] };
  } finally {
    window.clearTimeout(timeout);
  }
}

async function fetchOverpass(query: string, initialDelayMs = 0, fallbackDelayMs = 1_400) {
  const controllers: AbortController[] = [];
  try {
    return await Promise.any(OVERPASS_URLS.map((endpoint, index) => requestOverpass(endpoint, query, initialDelayMs + index * fallbackDelayMs, controllers)));
  } finally {
    controllers.forEach((controller) => controller.abort());
  }
}

function readSafetyCacheEntries() {
  try {
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
    .filter((element) => element.type === "way" && element.tags?.junction === "roundabout")
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
    ...clusterTrafficSignals(ordinarySignals),
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

      const dimension = dimensionLabel(tags);
      if (dimension) add(pointFeature(element, "dimension_limit", dimension));
    }

    if (element.type === "node") {
      const sign = `${tags.traffic_sign ?? ""};${tags["traffic_sign:forward"] ?? ""};${tags["traffic_sign:backward"] ?? ""}`;
      if (/no[_ ]?entry|GB:601/i.test(sign)) add(pointFeature(element, "no_entry", "NO ENTRY"));
      const calming = tags.traffic_calming ? /^(bump|table|hump|cushion)$/.test(tags.traffic_calming) : false;
      if (calming || tags.barrier === "bump") add(pointFeature(element, "speed_bump", "BUMP"));
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

function roadClosureFeatures(elements: OverpassElement[]): SafetyFeatureCollection {
  const features: SafetyFeatureCollection["features"] = [];
  for (const element of elements) {
    if (element.type !== "way") continue;
    const tags = element.tags ?? {};
    const roadClass = tags.highway === "construction" ? (tags.construction || "road") : tags.highway;
    const motorRoad = /^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|road)(?:_link)?$/.test(roadClass ?? "");
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
    if (element.type !== "way") continue;
    const tags = element.tags ?? {};
    if (tags.highway !== "construction" && !tags.construction) continue;
    const label = tags.name ? `WORKS · ${tags.name}` : "ROAD WORKS";
    const feature = wayFeature(element, "roadworks", label);
    if (feature) features.push(feature);
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
      label = tags.enforcement === "average_speed" ? "Average speed" : "Speed camera";
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
      if (feature) features.push(feature);
    }
  }
  return features;
}

export async function fetchSafetyFeatures(
  centre: Point,
  radiusMetres = 2_800,
  onTrafficSignals?: (signals: SafetyFeatureCollection) => void,
  onRestrictions?: (restrictions: SafetyFeatureCollection) => void,
  onRoadRules?: (rules: SafetyFeatureCollection) => void,
  onAmenities?: (amenities: SafetyFeatureCollection) => void,
  onClosures?: (closures: SafetyFeatureCollection) => void,
): Promise<SafetyFeatureCollection> {
  const around = `(around:${Math.round(radiusMetres)},${centre.latitude.toFixed(6)},${centre.longitude.toFixed(6)})`;
  const restrictionAround = `(around:${Math.round(Math.min(radiusMetres, 2_400))},${centre.latitude.toFixed(6)},${centre.longitude.toFixed(6)})`;
  const trafficQuery = `[out:json][timeout:7];node${around}["highway"="traffic_signals"];out body qt;`;
  const cameraQuery = `[out:json][timeout:6];(node${around}["highway"="speed_camera"];nwr${around}["enforcement"~"^(speed|maximum_speed|maxspeed|average_speed)$"];);out body qt;`;
  const closureQuery = `[out:json][timeout:8];(
way${restrictionAround}["highway"]["construction"]["access"~"^(no|private)$"];
way${restrictionAround}["highway"]["construction"]["vehicle"~"^(no|private)$"];
way${restrictionAround}["highway"]["construction"]["motor_vehicle"~"^(no|private)$"];
way${restrictionAround}["highway"]["construction"]["motorcar"~"^(no|private)$"];
);out body geom qt;`;
  const roadworksQuery = `[out:json][timeout:10];(
way${around}["highway"="construction"];
way${around}["highway"]["construction"];
);out body geom qt;`;
  const busLaneQuery = `[out:json][timeout:8];(
way${restrictionAround}["highway"]["busway"~"^(lane|opposite|opposite_lane)$"];
way${restrictionAround}["highway"]["busway:left"~"^(lane|opposite|opposite_lane)$"];
way${restrictionAround}["highway"]["busway:right"~"^(lane|opposite|opposite_lane)$"];
way${restrictionAround}["highway"]["busway:both"~"^(lane|opposite|opposite_lane)$"];
way${restrictionAround}["highway"]["bus:lanes"~"(designated|yes)"]["access:lanes"~"(no|private)"];
way${restrictionAround}["highway"]["bus:lanes"~"(designated|yes)"]["vehicle:lanes"~"(no|private)"];
way${restrictionAround}["highway"]["bus:lanes"~"(designated|yes)"]["motor_vehicle:lanes"~"(no|private)"];
way${restrictionAround}["highway"]["bus:lanes"~"(designated|yes)"]["motorcar:lanes"~"(no|private)"];
way${restrictionAround}["highway"]["psv:lanes"~"(designated|yes)"]["access:lanes"~"(no|private)"];
way${restrictionAround}["highway"]["psv:lanes"~"(designated|yes)"]["vehicle:lanes"~"(no|private)"];
way${restrictionAround}["highway"]["psv:lanes"~"(designated|yes)"]["motor_vehicle:lanes"~"(no|private)"];
way${restrictionAround}["highway"]["psv:lanes"~"(designated|yes)"]["motorcar:lanes"~"(no|private)"];
);out body geom qt;`;
  const restrictionQuery = `[out:json][timeout:8];(
way${restrictionAround}["highway"]["access"~"^(no|private)$"]["bus"~"^(yes|designated|permissive)$"];
way${restrictionAround}["highway"]["access"~"^(no|private)$"]["psv"~"^(yes|designated|permissive)$"];
way${restrictionAround}["highway"]["vehicle"~"^(no|private)$"]["bus"~"^(yes|designated|permissive)$"];
way${restrictionAround}["highway"]["vehicle"~"^(no|private)$"]["psv"~"^(yes|designated|permissive)$"];
way${restrictionAround}["highway"]["motor_vehicle"~"^(no|private)$"]["bus"~"^(yes|designated|permissive)$"];
way${restrictionAround}["highway"]["motor_vehicle"~"^(no|private)$"]["psv"~"^(yes|designated|permissive)$"];
way${restrictionAround}["highway"]["motorcar"~"^(no|private)$"]["bus"~"^(yes|designated|permissive)$"];
way${restrictionAround}["highway"]["motorcar"~"^(no|private)$"]["psv"~"^(yes|designated|permissive)$"];
node${restrictionAround}["barrier"="bus_trap"];
node${restrictionAround}["access"~"^(no|private)$"]["bus"~"^(yes|designated|permissive)$"];
node${restrictionAround}["access"~"^(no|private)$"]["psv"~"^(yes|designated|permissive)$"];
node${restrictionAround}["vehicle"~"^(no|private)$"]["bus"~"^(yes|designated|permissive)$"];
node${restrictionAround}["vehicle"~"^(no|private)$"]["psv"~"^(yes|designated|permissive)$"];
node${restrictionAround}["motor_vehicle"~"^(no|private)$"]["bus"~"^(yes|designated|permissive)$"];
node${restrictionAround}["motor_vehicle"~"^(no|private)$"]["psv"~"^(yes|designated|permissive)$"];
node${restrictionAround}["motorcar"~"^(no|private)$"]["bus"~"^(yes|designated|permissive)$"];
node${restrictionAround}["motorcar"~"^(no|private)$"]["psv"~"^(yes|designated|permissive)$"];
);out body geom qt;`;
  const detailQuery = `[out:json][timeout:12];(
way${around}["junction"="roundabout"]["highway"];
node${around}["highway"="speed_camera"];
nwr${around}["enforcement"~"^(speed|maximum_speed|maxspeed|average_speed)$"];
relation${around}["type"="enforcement"]["enforcement"~"^(speed|maximum_speed|maxspeed|average_speed)$"];
);out body geom qt;`;
  const roadRuleQuery = `[out:json][timeout:12];(
way${around}["highway"~"^(pedestrian|living_street)$"];
way${around}["highway"]["maxheight"];
way${around}["highway"]["maxwidth"];
way${around}["highway"]["maxweight"];
node${around}["traffic_sign"~"(no[_ ]?entry|GB:601)",i];
node${around}["traffic_sign:forward"~"(no[_ ]?entry|GB:601)",i];
node${around}["traffic_sign:backward"~"(no[_ ]?entry|GB:601)",i];
  node${around}["traffic_calming"~"^(bump|table|hump|cushion)$"];
  node${around}["barrier"="bump"];
  node${around}["railway"~"^(level_crossing|tram_crossing)$"];
node${around}["maxheight"];
node${around}["maxwidth"];
node${around}["maxweight"];
);out body geom qt;`;
  const turnQuery = `[out:json][timeout:12];relation${around}["type"="restriction"];out body geom qt;`;
  const speedQuery = `[out:json][timeout:14];way${around}["highway"]["maxspeed"];out body geom qt;`;
  const amenityQuery = `[out:json][timeout:15];(
node${around}["amenity"~"^(charging_station|parking)$"];
way${around}["amenity"~"^(charging_station|parking)$"];
relation${around}["boundary"="low_emission_zone"];
way${around}["boundary"="low_emission_zone"];
);out body center qt;`;
  const curated = curatedRestrictions(centre, radiusMetres);
  const progressiveRestrictions = [...curated.features];
  const publishRestrictions = (collection: SafetyFeatureCollection) => {
    for (const feature of collection.features) {
      if (!progressiveRestrictions.some((candidate) => candidate.id === feature.id)) progressiveRestrictions.push(feature);
    }
    onRestrictions?.({ type: "FeatureCollection", features: progressiveRestrictions });
  };
  if (curated.features.length) publishRestrictions(curated);
  const signalRequest = fetchOverpass(trafficQuery, 0, 550).then((payload) => {
    const signalElements = payload.elements ?? [];
    const signals = trafficSignalFeatures(signalElements);
    onTrafficSignals?.(signals);
    return signalElements;
  });
  const cameraRequest = fetchOverpass(cameraQuery, 60, 500).then((payload) => {
    const cameras: SafetyFeatureCollection = { type: "FeatureCollection", features: detailFeatures(payload.elements ?? []) };
    if (cameras.features.length) onRoadRules?.(cameras);
    return cameras;
  });
  const closureRequest = fetchOverpass(closureQuery, 80, 600).then((payload) => {
    const closures = roadClosureFeatures(payload.elements ?? []);
    onClosures?.(closures);
    return closures;
  });
  const roadworksRequest = fetchOverpass(roadworksQuery, 100, 600).then((payload) => {
    const works = roadWorksFeatures(payload.elements ?? []);
    if (works.features.length) onRoadRules?.(works);
    return works;
  });
  const busLaneRequest = fetchOverpass(busLaneQuery, 40, 550).then((payload) => {
    const busLanes: SafetyFeatureCollection = { type: "FeatureCollection", features: detailFeatures(payload.elements ?? []) };
    publishRestrictions(busLanes);
    return busLanes;
  });
  const restrictionRequest = fetchOverpass(restrictionQuery, 120, 650).then((payload) => {
    const restrictions: SafetyFeatureCollection = {
      type: "FeatureCollection",
      features: detailFeatures(payload.elements ?? []),
    };
    publishRestrictions(restrictions);
    return restrictions;
  });
  const detailRequest = fetchOverpass(detailQuery, 180, 600).then((payload) => {
    const elements = payload.elements ?? [];
    const details: SafetyFeatureCollection = { type: "FeatureCollection", features: detailFeatures(elements) };
    if (details.features.length) onRoadRules?.(details);
    return elements;
  });
  const roadRuleRequest = fetchOverpass(roadRuleQuery, 240, 750).then((payload) => {
    const rules = roadRuleFeatures(payload.elements ?? []);
    onRoadRules?.(rules);
    return rules;
  });
  const turnRequest = fetchOverpass(turnQuery, 650, 850).then((payload) => {
    const rules = roadRuleFeatures(payload.elements ?? []);
    onRoadRules?.(rules);
    return rules;
  });
  const speedRequest = fetchOverpass(speedQuery, 1_050, 900).then((payload) => {
    const limits = speedLimitFeatures(payload.elements ?? []);
    onRoadRules?.(limits);
    return limits;
  });
  const amenityRequest = fetchOverpass(amenityQuery, 700, 900).then((payload) => {
    const amenities = driverAmenityFeatures(payload.elements ?? []);
    onAmenities?.(amenities);
    return amenities;
  });
  const [signals, closures, roadworks, busLanes, restrictions, cameras, details, roadRules, turns, speedLimits, amenities] = await Promise.allSettled([
    signalRequest,
    closureRequest,
    roadworksRequest,
    busLaneRequest,
    restrictionRequest,
    cameraRequest,
    detailRequest,
    roadRuleRequest,
    turnRequest,
    speedRequest,
    amenityRequest,
  ]);
  if ([signals, closures, roadworks, busLanes, restrictions, cameras, details, roadRules, turns, speedLimits, amenities].every((result) => result.status === "rejected")) throw new Error("Safety overlay unavailable");
  const signalFeatures = signals.status === "fulfilled"
    ? trafficSignalFeatures([...signals.value, ...(details.status === "fulfilled" ? details.value : [])])
    : { type: "FeatureCollection" as const, features: [] };
  if (signalFeatures.features.length) onTrafficSignals?.(signalFeatures);
  const features = [
    ...signalFeatures.features,
    ...(closures.status === "fulfilled" ? closures.value.features : []),
    ...(roadworks.status === "fulfilled" ? roadworks.value.features : []),
    ...curated.features,
    ...(busLanes.status === "fulfilled" ? busLanes.value.features : []),
    ...(restrictions.status === "fulfilled" ? restrictions.value.features : []),
    ...(cameras.status === "fulfilled" ? cameras.value.features : []),
    ...(details.status === "fulfilled" ? detailFeatures(details.value) : []),
    ...(roadRules.status === "fulfilled" ? roadRules.value.features : []),
    ...(turns.status === "fulfilled" ? turns.value.features : []),
    ...(speedLimits.status === "fulfilled" ? speedLimits.value.features : []),
    ...(amenities.status === "fulfilled" ? amenities.value.features : []),
  ];

  const data: SafetyFeatureCollection = { type: "FeatureCollection", features };
  saveSafetyFeatures(centre, radiusMetres, data);
  return data;
}
