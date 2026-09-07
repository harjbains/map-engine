import type { Point } from "./driving";
import { nearestMainRoadMetres } from "./driving.ts";
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
};

const DRIVABLE_HIGHWAYS = new Set(["motorway", "trunk", "primary", "secondary", "tertiary", "unclassified", "residential", "living_street", "motorway_link", "trunk_link", "primary_link", "secondary_link", "tertiary_link"]);
const ROAD_MAX_METRES = 250;

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
  church: 3,
  school: 3,
  community: 3,
  small: 3,
};

const AMENITY_RANK: Partial<Record<string, LandmarkCategory>> = {
  fuel: "petrol",
  pub: "pub",
  bar: "pub",
  biergarten: "pub",
  fast_food: "fast_food",
  restaurant: "restaurant",
  place_of_worship: "church",
  pharmacy: "pharmacy",
  school: "school",
  community_centre: "community",
};

const SHOP_RANK: Partial<Record<string, LandmarkCategory>> = {
  supermarket: "supermarket",
  wholesale: "supermarket",
  hypermarket: "supermarket",
  department_store: "large_shop",
  mall: "large_shop",
  shopping_centre: "large_shop",
  furniture: "large_shop",
  electronics: "large_shop",
  doityourself: "large_shop",
  homeware: "large_shop",
  car: "car_dealer",
  motorcycle: "car_dealer",
  garden_centre: "garden_centre",
  convenience: "small",
  newsagent: "small",
  bakery: "small",
  butcher: "small",
  chemist: "small",
  other: "small",
};

const LEISURE_RANK: Partial<Record<string, LandmarkCategory>> = {
  sports_centre: "leisure",
  leisure_centre: "leisure",
  swimming_pool: "leisure",
  water_park: "leisure",
  fitness_centre: "leisure",
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
  if (tags.shop) {
    const kind = SHOP_RANK[tags.shop];
    if (kind) return kind;
  }
  if (tags.leisure) {
    const kind = LEISURE_RANK[tags.leisure];
    if (kind) return kind;
  }
  if (tags.tourism === "hotel" || tags.tourism === "motel") return "hotel";
  if (tags.landuse === "retail" || tags.landuse === "commercial") return "retail_park";
  return null;
}

export async function fetchLandmarks(centre: Point, radiusMetres = 3_000, signal?: AbortSignal): Promise<Landmark[]> {
  const roadRadius = Math.min(radiusMetres, 2_500);
  let poiPayload: { elements?: OverpassElement[] } | null = null;
  for (const radius of [radiusMetres, Math.min(radiusMetres, 1_600)]) {
    const poiQuery = `[out:json][timeout:20];(
nwr(around:${Math.round(radius)},${centre.latitude.toFixed(6)},${centre.longitude.toFixed(6)})["amenity"]["name"];
nwr(around:${Math.round(radius)},${centre.latitude.toFixed(6)},${centre.longitude.toFixed(6)})["shop"]["name"];
nwr(around:${Math.round(radius)},${centre.latitude.toFixed(6)},${centre.longitude.toFixed(6)})["tourism"]["name"];
nwr(around:${Math.round(radius)},${centre.latitude.toFixed(6)},${centre.longitude.toFixed(6)})["leisure"]["name"];
way(around:${Math.round(radius)},${centre.latitude.toFixed(6)},${centre.longitude.toFixed(6)})["landuse"~"^(retail|commercial)$"]["name"];
);out center tags qt;`;
    try {
      poiPayload = await fetchOverpass(poiQuery, 0, 1_200, signal, 30_000);
      break;
    } catch {
      poiPayload = null;
    }
  }
  if (!poiPayload) return [];
  const roadQuery = `[out:json][timeout:20];way(around:${Math.round(roadRadius)},${centre.latitude.toFixed(6)},${centre.longitude.toFixed(6)})["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street)(_link)?$"];out tags geom qt;`;
  const roadPayload = await fetchOverpass(roadQuery, 0, 1_200, signal, 20_000).catch(() => null);
  const roadLines: Array<Array<{ lat: number; lon: number }>> = [];
  for (const element of roadPayload?.elements ?? []) {
    const tags = element.tags ?? {};
    if (typeof tags.highway === "string" && DRIVABLE_HIGHWAYS.has(tags.highway) && Array.isArray(element.geometry)) {
      roadLines.push(element.geometry as Array<{ lat: number; lon: number }>);
    }
  }
  const landmarks: Landmark[] = [];
  for (const element of poiPayload?.elements ?? []) {
    const tags = element.tags ?? {};
    const category = classifyLandmark(tags);
    if (!category) continue;
    const point = element.lat !== undefined && element.lon !== undefined
      ? { latitude: element.lat, longitude: element.lon }
      : element.center ? { latitude: element.center.lat, longitude: element.center.lon } : null;
    if (!point) continue;
    const mainroadMetres = roadLines.length ? nearestMainRoadMetres(point, roadLines) : 0;
    if (mainroadMetres > ROAD_MAX_METRES) continue;
    landmarks.push({
      id: `${element.type}/${element.id}`,
      name: tags.name ?? tags.brand ?? LANDMARK_LABELS[category],
      category,
      priority: LANDMARK_PRIORITIES[category],
      latitude: point.latitude,
      longitude: point.longitude,
      mainroadMetres,
    });
  }
  return landmarks;
}