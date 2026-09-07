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
};

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
  pub: 2,
  restaurant: 2,
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
  const around = `(around:${Math.round(radiusMetres)},${centre.latitude.toFixed(6)},${centre.longitude.toFixed(6)})`;
  const query = `[out:json][timeout:15];(
nwr${around}["amenity"]["name"];
nwr${around}["shop"]["name"];
nwr${around}["tourism"]["name"];
nwr${around}["leisure"]["name"];
way${around}["landuse"~"^(retail|commercial)$"]["name"];
);out center tags qt;`;
  const payload = await fetchOverpass(query, 0, 1_200, signal, 30_000);
  const elements: OverpassElement[] = payload?.elements ?? [];
  const landmarks: Landmark[] = [];
  for (const element of elements) {
    const tags = element.tags ?? {};
    const category = classifyLandmark(tags);
    if (!category) continue;
    const point = element.lat !== undefined && element.lon !== undefined
      ? { latitude: element.lat, longitude: element.lon }
      : element.center ? { latitude: element.center.lat, longitude: element.center.lon } : null;
    if (!point) continue;
    landmarks.push({
      id: `${element.type}/${element.id}`,
      name: tags.name ?? tags.brand ?? LANDMARK_LABELS[category],
      category,
      priority: LANDMARK_PRIORITIES[category],
      latitude: point.latitude,
      longitude: point.longitude,
    });
  }
  return landmarks;
}