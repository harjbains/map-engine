export const runtime = "edge";

import type { RoadTraffic, TrafficProbeResponse } from "../../../lib/traffic";
import { tomTomKey } from "../../../lib/tomtom-traffic-server";

type TomTomFlowResponse = {
  flowSegmentData?: {
    frc?: string;
    currentSpeed?: number;
    freeFlowSpeed?: number;
    currentTravelTime?: number;
    freeFlowTravelTime?: number;
    confidence?: number;
    roadClosure?: boolean;
  };
};

function coordinate(value: string | null, minimum: number, maximum: number) {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}

function numeric(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export async function GET(request: Request) {
  const key = tomTomKey();
  if (!key) return Response.json({ configured: false, status: "error" } satisfies TrafficProbeResponse, { headers: { "Cache-Control": "no-store" } });

  const requestUrl = new URL(request.url);
  const latitude = coordinate(requestUrl.searchParams.get("lat"), -90, 90);
  const longitude = coordinate(requestUrl.searchParams.get("lon"), -180, 180);
  if (latitude === null || longitude === null) {
    return Response.json({ configured: true, status: "configured" } satisfies TrafficProbeResponse, { headers: { "Cache-Control": "no-store" } });
  }

  const url = new URL("https://api.tomtom.com/traffic/services/4/flowSegmentData/relative/15/json");
  url.searchParams.set("key", key);
  url.searchParams.set("point", `${latitude},${longitude}`);
  url.searchParams.set("unit", "mph");
  const startedAt = Date.now();

  try {
    const response = await fetch(url, { cf: { cacheTtl: 30, cacheEverything: true } } as RequestInit);
    if (!response.ok) {
      console.warn(`[traffic] health probe failed with TomTom status ${response.status}`);
      return Response.json(
        { configured: true, status: "error", checkedAt: Date.now(), latencyMs: Date.now() - startedAt, providerStatus: response.status } satisfies TrafficProbeResponse,
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }
    const payload = await response.json() as TomTomFlowResponse;
    const data = payload.flowSegmentData;
    if (!data) throw new Error("TomTom response did not contain flow segment data");
    const flow: RoadTraffic = {
      currentSpeed: numeric(data.currentSpeed),
      freeFlowSpeed: numeric(data.freeFlowSpeed),
      currentTravelTime: numeric(data.currentTravelTime),
      freeFlowTravelTime: numeric(data.freeFlowTravelTime),
      confidence: Math.max(0, Math.min(1, numeric(data.confidence))),
      roadClosure: data.roadClosure === true,
      roadClass: typeof data.frc === "string" ? data.frc : "",
    };
    return Response.json(
      { configured: true, status: "live", checkedAt: Date.now(), latencyMs: Date.now() - startedAt, flow } satisfies TrafficProbeResponse,
      { headers: { "Cache-Control": "no-store", "X-Traffic-Provider": "TomTom" } },
    );
  } catch (error) {
    console.error("[traffic] health probe request failed", error);
    return Response.json(
      { configured: true, status: "error", checkedAt: Date.now(), latencyMs: Date.now() - startedAt } satisfies TrafficProbeResponse,
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
