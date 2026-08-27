export type TrafficHealthState = "off" | "checking" | "live" | "stale" | "error";

export type RoadTraffic = {
  currentSpeed: number;
  freeFlowSpeed: number;
  currentTravelTime: number;
  freeFlowTravelTime: number;
  confidence: number;
  roadClosure: boolean;
  roadClass: string;
};

export type TrafficProbeResponse = {
  configured: boolean;
  status: "configured" | "live" | "error";
  checkedAt?: number;
  latencyMs?: number;
  providerStatus?: number;
  flow?: RoadTraffic;
};

export function trafficDelayPercent(flow: RoadTraffic) {
  if (flow.roadClosure) return 100;
  if (flow.freeFlowSpeed <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((1 - flow.currentSpeed / flow.freeFlowSpeed) * 100)));
}
