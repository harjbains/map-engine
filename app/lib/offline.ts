import type { Point } from "./driving";
import { fetchSafetyFeatures } from "./safety";

export const MAP_CACHE = "map-engine-map-v1";
const TILEJSON_URL = "https://tiles.openfreemap.org/planet";

export type OfflinePack = {
  centre: Point;
  radiusKm: number;
  tiles: number;
  downloadedAt: string;
  safetyIncluded: boolean;
};

type TileJson = { tiles: string[] };

function lonToTileX(lon: number, zoom: number) {
  return Math.floor(((lon + 180) / 360) * 2 ** zoom);
}

function latToTileY(lat: number, zoom: number) {
  const radians = lat * Math.PI / 180;
  return Math.floor((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2 * 2 ** zoom);
}

export async function buildOfflineUrls(centre: Point, radiusKm: number): Promise<string[]> {
  const tileJsonResponse = await fetch(TILEJSON_URL, { cache: "no-store" });
  if (!tileJsonResponse.ok) throw new Error("Map source is unavailable while preparing the pack.");
  const tileJson = await tileJsonResponse.json() as TileJson;
  const pattern = tileJson.tiles?.[0];
  if (!pattern) throw new Error("The map source did not provide a tile address.");

  const latitudeDelta = radiusKm / 110.574;
  const longitudeDelta = radiusKm / (111.32 * Math.max(0.2, Math.cos(centre.latitude * Math.PI / 180)));
  const urls = new Set<string>();
  for (let zoom = 7; zoom <= 16; zoom += 1) {
    const dimension = 2 ** zoom;
    const minX = lonToTileX(centre.longitude - longitudeDelta, zoom);
    const maxX = lonToTileX(centre.longitude + longitudeDelta, zoom);
    const minY = latToTileY(centre.latitude + latitudeDelta, zoom);
    const maxY = latToTileY(centre.latitude - latitudeDelta, zoom);
    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        const wrappedX = ((x % dimension) + dimension) % dimension;
        urls.add(pattern.replace("{z}", String(zoom)).replace("{x}", String(wrappedX)).replace("{y}", String(y)));
      }
    }
  }
  return [
    TILEJSON_URL,
    "https://tiles.openfreemap.org/fonts/Noto%20Sans%20Regular/0-255.pbf",
    ...urls,
  ];
}

export async function downloadOfflinePack(
  centre: Point,
  radiusKm: number,
  onProgress: (completed: number, total: number) => void,
  signal: AbortSignal,
): Promise<OfflinePack> {
  if (!("caches" in window)) throw new Error("Offline storage is not supported by this browser.");
  await navigator.storage?.persist?.().catch(() => false);
  const urls = await buildOfflineUrls(centre, radiusKm);
  if (urls.length > 8_000) throw new Error("This pack is too large for safe browser storage. Choose a smaller area.");
  const totalFiles = urls.length + 1;
  const cache = await caches.open(MAP_CACHE);
  let cursor = 0;
  let complete = 0;
  onProgress(0, totalFiles);
  const worker = async () => {
    while (cursor < urls.length) {
      if (signal.aborted) throw new DOMException("Download cancelled", "AbortError");
      const url = urls[cursor++];
      const cached = await cache.match(url);
      if (!cached) {
        const response = await fetch(url, { cache: "no-store", signal });
        if (!response.ok && response.type !== "opaque") throw new Error(`A map tile failed to download (${response.status}).`);
        await cache.put(url, response.clone());
      }
      complete += 1;
      if (complete === urls.length || complete % 25 === 0) onProgress(complete, totalFiles);
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  const currentUrls = new Set(urls);
  const cachedRequests = await cache.keys();
  await Promise.all(cachedRequests.filter((request) => !currentUrls.has(request.url)).map((request) => cache.delete(request)));
  let safetyIncluded = false;
  try {
    await fetchSafetyFeatures(centre, radiusKm * 1_000);
    safetyIncluded = true;
  } catch {
    // Keep the usable base-map download when a public safety-data endpoint is temporarily unavailable.
  }
  onProgress(totalFiles, totalFiles);
  return { centre, radiusKm, tiles: urls.length - 2, downloadedAt: new Date().toISOString(), safetyIncluded };
}

export async function clearOfflinePack() {
  if ("caches" in window) await caches.delete(MAP_CACHE);
}
