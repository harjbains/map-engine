export const runtime = "edge";

import { parseTrafficTile, proxyTrafficTile, tomTomKey, trafficError } from "../../../../../../lib/tomtom-traffic-server";

type RouteContext = { params: Promise<{ z: string; x: string; y: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const key = tomTomKey();
  if (!key) return trafficError(503, "TomTom traffic is not configured.");

  const { z, x, y } = await context.params;
  const tile = parseTrafficTile(z, x, y);
  if (!tile) return trafficError(400, "Invalid incident tile coordinates.");
  const { zoom, column, row } = tile;

  const url = new URL(`https://api.tomtom.com/traffic/map/4/tile/incidents/${zoom}/${column}/${row}.pbf`);
  url.searchParams.set("key", key);
  return proxyTrafficTile(url, "incident");
}
