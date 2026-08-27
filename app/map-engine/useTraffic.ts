import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type maplibregl from "maplibre-gl";
import { trafficDelayPercent, type RoadTraffic, type TrafficHealthState, type TrafficProbeResponse } from "../lib/traffic";
import type { VehicleFix } from "./config";
import { refreshTrafficTiles, setTrafficVisibility } from "./map-routing-layers";

type UseTrafficOptions = {
  mapRef: RefObject<maplibregl.Map | null>;
  latestFixRef: RefObject<VehicleFix | null>;
  mapReady: boolean;
  enabled: boolean;
  online: boolean;
};

export function useTraffic({ mapRef, latestFixRef, mapReady, enabled, online }: UseTrafficOptions) {
  const updatedAtRef = useRef<number | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [health, setHealth] = useState<TrafficHealthState>("checking");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [roadTraffic, setRoadTraffic] = useState<RoadTraffic | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/traffic/status", { cache: "no-store" })
      .then((response) => response.json() as Promise<TrafficProbeResponse>)
      .then((result) => {
        if (cancelled) return;
        setConfigured(Boolean(result.configured));
        if (!result.configured) setHealth("error");
      })
      .catch(() => {
        if (cancelled) return;
        setConfigured(false);
        setHealth("error");
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setHealth("off");
      setRoadTraffic(null);
      return;
    }
    if (!mapReady || configured !== true || !online) {
      setHealth(configured === null ? "checking" : "error");
      return;
    }
    let cancelled = false;
    let requestRunning = false;
    const refresh = async () => {
      if (requestRunning) return;
      const map = mapRef.current;
      if (!map?.isStyleLoaded()) return;
      setTrafficVisibility(map, true);
      refreshTrafficTiles(map);
      const vehicleFix = latestFixRef.current;
      const centre = map.getCenter();
      const point = vehicleFix ?? { latitude: centre.lat, longitude: centre.lng };
      const params = new URLSearchParams({ lat: String(point.latitude), lon: String(point.longitude) });
      requestRunning = true;
      if (updatedAtRef.current === null) setHealth("checking");
      try {
        const response = await fetch(`/api/traffic/status?${params}`, { cache: "no-store" });
        const result = await response.json() as TrafficProbeResponse;
        if (cancelled) return;
        if (!result.configured) {
          setConfigured(false);
          setHealth("error");
          setRoadTraffic(null);
        } else if (response.ok && result.status === "live" && result.flow && result.checkedAt) {
          updatedAtRef.current = result.checkedAt;
          setUpdatedAt(result.checkedAt);
          setHealth("live");
          setRoadTraffic(vehicleFix ? result.flow : null);
        } else {
          setHealth(updatedAtRef.current === null ? "error" : "stale");
        }
      } catch {
        if (!cancelled) setHealth(updatedAtRef.current === null ? "error" : "stale");
      } finally {
        requestRunning = false;
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [mapReady, configured, enabled, online, mapRef, latestFixRef]);

  const reset = useCallback((nextEnabled: boolean) => {
    updatedAtRef.current = null;
    setUpdatedAt(null);
    setRoadTraffic(null);
    setHealth(nextEnabled ? "checking" : "off");
  }, []);

  const state: TrafficHealthState = !enabled ? "off" : !online || configured === false ? "error" : configured === null ? "checking" : health;
  const delayPercent = roadTraffic ? trafficDelayPercent(roadTraffic) : null;
  const updatedTime = updatedAt ? new Date(updatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : null;
  const title = state === "live" && roadTraffic
    ? `TomTom live · ${Math.round(roadTraffic.currentSpeed)} mph now, ${Math.round(roadTraffic.freeFlowSpeed)} mph normally · ${Math.round(roadTraffic.confidence * 100)}% confidence · checked ${updatedTime}`
    : state === "live" ? `TomTom traffic live · checked ${updatedTime}`
      : state === "stale" ? `TomTom traffic is stale · last successful check ${updatedTime}`
        : state === "checking" ? "Checking TomTom traffic…"
          : state === "off" ? "Live traffic is switched off"
            : !online ? "Traffic unavailable while offline" : "TomTom traffic unavailable";

  return { configured, state, title, roadTraffic, delayPercent, reset };
}
