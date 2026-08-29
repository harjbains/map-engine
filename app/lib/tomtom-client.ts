import type { RoadTraffic, TrafficProbeResponse } from "./traffic";

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

function numeric(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function tomTomKey() {
  return typeof __TOMTOM_API_KEY__ === "string" ? __TOMTOM_API_KEY__.trim() : "";
}

export const APP_BASE = typeof __STATIC_BUILD__ !== "undefined" && __STATIC_BUILD__ ? "/map-engine/" : "/";

export function appUrl(path: string) {
  return `${APP_BASE}${path.replace(/^\/+/, "")}`;
}

export function styleJsonUrl() {
  return appUrl("map-style.json");
}

export function trafficTileUrl(refreshToken?: number) {
  const key = tomTomKey();
  if (!key) return "";
  return `https://api.tomtom.com/traffic/map/4/tile/flow/relative/{z}/{x}/{y}.pbf?trafficLevelStep=0.02&key=${encodeURIComponent(key)}&refresh=${refreshToken ?? Math.floor(Date.now() / 60_000)}`;
}

export function trafficIncidentTileUrl(refreshToken?: number) {
  const key = tomTomKey();
  if (!key) return "";
  return `https://api.tomtom.com/traffic/map/4/tile/incidents/{z}/{x}/{y}.pbf?key=${encodeURIComponent(key)}&refresh=${refreshToken ?? Math.floor(Date.now() / 60_000)}`;
}

export async function probeTraffic(latitude: number, longitude: number): Promise<TrafficProbeResponse> {
  const key = tomTomKey();
  if (!key) return { configured: false, status: "error" };
  const url = new URL("https://api.tomtom.com/traffic/services/4/flowSegmentData/relative/15/json");
  url.searchParams.set("key", key);
  url.searchParams.set("point", `${latitude},${longitude}`);
  url.searchParams.set("unit", "mph");
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      console.warn(`[traffic] health probe failed with TomTom status ${response.status}`);
      return { configured: true, status: "error", checkedAt: Date.now(), latencyMs: Date.now() - startedAt, providerStatus: response.status };
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
    return { configured: true, status: "live", checkedAt: Date.now(), latencyMs: Date.now() - startedAt, flow };
  } catch (error) {
    console.error("[traffic] health probe request failed", error);
    return { configured: true, status: "error", checkedAt: Date.now(), latencyMs: Date.now() - startedAt };
  }
}