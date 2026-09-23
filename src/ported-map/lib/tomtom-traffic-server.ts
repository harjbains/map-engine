export type TrafficTileCoordinates = { zoom: number; column: number; row: number };

export function tomTomKey() {
  return process.env.TOMTOM_API_KEY?.trim() ?? "";
}

export function parseTrafficTile(z: string, x: string, y: string): TrafficTileCoordinates | null {
  if (![z, x, y].every((value) => /^\d+$/.test(value))) return null;
  const zoom = Number(z);
  const column = Number(x);
  const row = Number(y);
  const tileLimit = 2 ** zoom;
  if (zoom < 0 || zoom > 22 || column < 0 || row < 0 || column >= tileLimit || row >= tileLimit) return null;
  return { zoom, column, row };
}

export function trafficError(status: number, message: string, providerStatus?: number) {
  return Response.json(
    { error: message, providerStatus },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function proxyTrafficTile(url: URL, label: string) {
  try {
    const response = await fetch(url, { cf: { cacheTtl: 30, cacheEverything: true } } as RequestInit);
    if (!response.ok) {
      console.warn(`[traffic] ${label} tile failed with TomTom status ${response.status}`);
      const status = response.status === 401 || response.status === 403 || response.status === 429 ? response.status : 502;
      return trafficError(status, "TomTom traffic data is temporarily unavailable.", response.status);
    }
    return new Response(response.body, {
      headers: {
        "Content-Type": response.headers.get("Content-Type") ?? "application/vnd.mapbox-vector-tile",
        "Cache-Control": "public, max-age=30, s-maxage=30",
        "X-Traffic-Provider": "TomTom",
      },
    });
  } catch (error) {
    console.error(`[traffic] ${label} tile request failed`, error);
    return trafficError(502, "TomTom traffic data could not be reached.");
  }
}
