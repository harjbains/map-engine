import type { Point } from "./driving";
import { fetchOverpass } from "./safety";

export type LandmarkCategory =
  | "petrol"
  | "supermarket"
  | "fast_food"
  | "car_dealer"
  | "retail_park"
  | "large_shop"
  | "pub"
  | "restaurant"
  | "hotel"
  | "pharmacy"
  | "leisure"
  | "garden_centre"
  | "church"
  | "school"
  | "community"
  | "small";

export type LandmarkPriority = 1 | 2 | 3;

export type Landmark = Point & {
  id: string;
  name: string;
  category: LandmarkCategory;
  priority: LandmarkPriority;
  mainroadMetres: number;
  roadName: string | null;
  roadCandidates: string[];
};

const DRIVABLE_HIGHWAYS = new Set([
  "motorway",
  "trunk",
  "primary",
  "secondary",
  "tertiary",
  "unclassified",
  "residential",
  "living_street",
  "motorway_link",
  "trunk_link",
  "primary_link",
  "secondary_link",
  "tertiary_link",
]);
const ROAD_MAX_METRES = 68;

export const LANDMARK_LABELS: Record<LandmarkCategory, string> = {
  petrol: "Petrol station",
  supermarket: "Supermarket",
  fast_food: "Fast food",
  car_dealer: "Car dealer",
  retail_park: "Retail park",
  large_shop: "Large store",
  pub: "Pub",
  restaurant: "Restaurant",
  hotel: "Hotel",
  pharmacy: "Pharmacy",
  leisure: "Leisure centre",
  garden_centre: "Garden centre",
  church: "Place of worship",
  school: "School",
  community: "Community building",
  small: "Local business",
};

export const LANDMARK_PRIORITIES: Record<LandmarkCategory, LandmarkPriority> = {
  petrol: 1,
  supermarket: 1,
  fast_food: 1,
  car_dealer: 1,
  retail_park: 1,
  large_shop: 1,
  pub: 1,
  restaurant: 1,
  hotel: 2,
  pharmacy: 2,
  leisure: 2,
  garden_centre: 2,
  church: 2,
  school: 2,
  community: 3,
  small: 2,
};

const AMENITY_RANK: Partial<Record<string, LandmarkCategory>> = {
  fuel: "petrol",
  charging_station: "petrol",
  pub: "pub",
  bar: "pub",
  biergarten: "pub",
  nightclub: "pub",
  fast_food: "fast_food",
  cafe: "restaurant",
  restaurant: "restaurant",
  ice_cream: "fast_food",
  food_court: "restaurant",
  place_of_worship: "church",
  pharmacy: "pharmacy",
  hospital: "pharmacy",
  clinic: "pharmacy",
  doctors: "pharmacy",
  dentist: "pharmacy",
  veterinary: "pharmacy",
  school: "school",
  college: "school",
  university: "school",
  kindergarten: "school",
  community_centre: "community",
  library: "community",
  townhall: "community",
  police: "community",
  fire_station: "community",
  post_office: "small",
  bank: "small",
  cinema: "leisure",
  theatre: "leisure",
  arts_centre: "leisure",
  car_wash: "car_dealer",
  car_rental: "car_dealer",
};

const IGNORED_SHOPS = new Set(["vacant", "no", "none", "yes", "kiosk"]);

const SHOP_RANK: Partial<Record<string, LandmarkCategory>> = {
  supermarket: "supermarket",
  wholesale: "supermarket",
  hypermarket: "supermarket",
  Cash_and_carry: "supermarket",
  department_store: "large_shop",
  mall: "large_shop",
  shopping_centre: "large_shop",
  furniture: "large_shop",
  electronics: "large_shop",
  doityourself: "large_shop",
  homeware: "large_shop",
  hardware: "large_shop",
  carpet: "large_shop",
  bed: "large_shop",
  kitchen: "large_shop",
  bathroom_furnishing: "large_shop",
  trade: "large_shop",
  variety_store: "large_shop",
  car: "car_dealer",
  motorcycle: "car_dealer",
  car_repair: "car_dealer",
  car_parts: "car_dealer",
  tyres: "car_dealer",
  garden_centre: "garden_centre",
  chemist: "pharmacy",
  optician: "pharmacy",
};

const LEISURE_RANK: Partial<Record<string, LandmarkCategory>> = {
  sports_centre: "leisure",
  leisure_centre: "leisure",
  swimming_pool: "leisure",
  water_park: "leisure",
  fitness_centre: "leisure",
  stadium: "leisure",
  golf_course: "leisure",
  bowling_alley: "leisure",
  ice_rink: "leisure",
  park: "leisure",
  bingo: "leisure",
};

const TOURISM_RANK: Partial<Record<string, LandmarkCategory>> = {
  hotel: "hotel",
  motel: "hotel",
  guest_house: "hotel",
  hostel: "hotel",
  attraction: "leisure",
  museum: "leisure",
  gallery: "leisure",
  theme_park: "leisure",
  zoo: "leisure",
};

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  geometry?: Array<{ lat: number; lon: number }>;
  tags?: Record<string, string>;
};

export function classifyLandmark(tags: Record<string, string>): LandmarkCategory | null {
  if (tags.amenity) {
    const kind = AMENITY_RANK[tags.amenity];
    if (kind) return kind;
  }
  if (tags.shop && !IGNORED_SHOPS.has(tags.shop)) {
    return SHOP_RANK[tags.shop] ?? "small";
  }
  if (tags.leisure) {
    const kind = LEISURE_RANK[tags.leisure];
    if (kind) return kind;
  }
  if (tags.tourism) {
    const kind = TOURISM_RANK[tags.tourism];
    if (kind) return kind;
  }
  if (tags.healthcare) return "pharmacy";
  if (tags.craft) return "small";
  if (tags.landuse === "retail" || tags.landuse === "commercial") return "retail_park";
  return null;
}

function pointToRoadDistanceMetres(
  point: Point,
  line: Array<{ lat: number; lon: number }>,
  latitudeScale: number,
  fixedX: number,
  fixedY: number,
): number {
  let nearest = Number.POSITIVE_INFINITY;
  for (let index = 1; index < line.length; index += 1) {
    const start = line[index - 1];
    const end = line[index];
    const startX = start.lon * latitudeScale;
    const endX = end.lon * latitudeScale;
    const dx = endX - startX;
    const dy = end.lat - start.lat;
    const denominator = dx * dx + dy * dy;
    const fraction = denominator === 0 ? 0 : Math.max(0, Math.min(1, ((fixedX - startX) * dx + (fixedY - start.lat) * dy) / denominator));
    const projectedX = startX + fraction * dx;
    const projectedY = start.lat + fraction * dy;
    const metres = Math.hypot((fixedX - projectedX) * 111_320, (fixedY - projectedY) * 110_574);
    if (metres < nearest) nearest = metres;
  }
  return nearest;
}

function bboxAround(centre: Point, radiusMetres: number): string {
  const latDelta = radiusMetres / 110_574;
  const lonDelta = radiusMetres / (111_320 * Math.max(0.2, Math.cos(centre.latitude * Math.PI / 180)));
  const south = (centre.latitude - latDelta).toFixed(5);
  const west = (centre.longitude - lonDelta).toFixed(5);
  const north = (centre.latitude + latDelta).toFixed(5);
  const east = (centre.longitude + lonDelta).toFixed(5);
  return `${south},${west},${north},${east}`;
}

export async function fetchLandmarks(centre: Point, radiusMetres = 2_000, signal?: AbortSignal): Promise<Landmark[]> {
  let payload: { elements?: OverpassElement[] } | null = null;
  for (const radius of [Math.min(radiusMetres, 2_200), Math.min(radiusMetres, 1_300)]) {
    const bbox = bboxAround(centre, radius);
    const query = `[out:json][timeout:18];(
nwr["amenity"]["name"](${bbox});
nwr["shop"]["name"](${bbox});
nwr["tourism"]["name"](${bbox});
nwr["leisure"]["name"](${bbox});
nwr["healthcare"]["name"](${bbox});
nwr["craft"]["name"](${bbox});
way["landuse"~"^(retail|commercial)$"]["name"](${bbox});
)->.pois;.pois out center tags qt;way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street)(_link)?$"](${bbox})->.roads;.roads out tags geom qt;`;
    try {
      payload = await fetchOverpass(query, 0, 900, signal, 30_000);
      break;
    } catch {
      payload = null;
    }
  }
  if (!payload?.elements?.length) return [];

  const roadLines: Array<{ labels: string[]; geom: Array<{ lat: number; lon: number }> }> = [];
  const poiElements: OverpassElement[] = [];

  for (const element of payload.elements) {
    const tags = element.tags ?? {};
    if (element.type === "way" && typeof tags.highway === "string" && DRIVABLE_HIGHWAYS.has(tags.highway) && Array.isArray(element.geometry)) {
      const labels: string[] = [];
      if (tags.name) labels.push(tags.name);
      if (tags.ref) {
        for (const part of tags.ref.split(/[;/,]+/)) {
          const trimmed = part.trim();
          if (trimmed) labels.push(trimmed);
        }
      }
      if (tags.ref && tags.name && !tags.name.includes(tags.ref)) {
        labels.push(`${tags.ref} ${tags.name}`);
      }
      roadLines.push({ labels, geom: element.geometry });
    } else if (tags.name || tags.brand) {
      poiElements.push(element);
    }
  }

  const landmarks: Landmark[] = [];
  const seenIds = new Set<string>();

  for (const element of poiElements) {
    const id = `${element.type}/${element.id}`;
    if (seenIds.has(id)) continue;
    const tags = element.tags ?? {};
    const category = classifyLandmark(tags);
    if (!category) continue;
    const point = element.lat !== undefined && element.lon !== undefined
      ? { latitude: element.lat, longitude: element.lon }
      : element.center ? { latitude: element.center.lat, longitude: element.center.lon } : null;
    if (!point) continue;

    const latitudeScale = Math.cos(point.latitude * Math.PI / 180);
    const fixedX = point.longitude * latitudeScale;
    const fixedY = point.latitude;

    let nearestMetres = roadLines.length ? Number.POSITIVE_INFINITY : 0;
    let primaryRoadName: string | null = tags["addr:street"] ?? null;
    const candidateSet = new Set<string>();
    if (tags["addr:street"]) candidateSet.add(tags["addr:street"]);

    for (const road of roadLines) {
      const metres = pointToRoadDistanceMetres(point, road.geom, latitudeScale, fixedX, fixedY);
      if (metres < nearestMetres) {
        nearestMetres = metres;
        if (road.labels[0]) primaryRoadName = road.labels[0];
      }
      if (metres <= ROAD_MAX_METRES) {
        for (const label of road.labels) candidateSet.add(label);
      }
    }

    if (nearestMetres > ROAD_MAX_METRES) continue;
    seenIds.add(id);

    landmarks.push({
      id,
      name: (tags.name ?? tags.brand ?? LANDMARK_LABELS[category]).trim(),
      category,
      priority: LANDMARK_PRIORITIES[category],
      latitude: point.latitude,
      longitude: point.longitude,
      mainroadMetres: nearestMetres,
      roadName: primaryRoadName,
      roadCandidates: Array.from(candidateSet),
    });
  }

  return landmarks;
}