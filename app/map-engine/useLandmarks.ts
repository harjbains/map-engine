import { useEffect, useMemo, useRef, useState } from "react";
import { fetchLandmarks, type Landmark } from "../lib/landmarks";
import type { VehicleFix } from "./config";
import { distanceKm, landmarksAhead, type VisibleLandmark } from "./map-navigation";

type UseLandmarksOptions = {
  fix: VehicleFix | null;
  mapReady: boolean;
  enabled: boolean;
  online: boolean;
};

const REFETCH_INTERVAL_MS = 45_000;
const REFETCH_MOVEMENT_KM = 0.9;
const FETCH_RADIUS_METRES = 3_000;

export function useLandmarks({ fix, mapReady, enabled, online }: UseLandmarksOptions) {
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const fetchedAtRef = useRef(0);
  const fetchedLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const runningRef = useRef(false);

  useEffect(() => {
    if (!enabled || !mapReady || !online || !fix || runningRef.current) return;
    const now = Date.now();
    const lastLocation = fetchedLocationRef.current;
    const moved = lastLocation ? distanceKm(lastLocation, fix) >= REFETCH_MOVEMENT_KM : false;
    if (!moved && now - fetchedAtRef.current < REFETCH_INTERVAL_MS) return;
    fetchedAtRef.current = now;
    fetchedLocationRef.current = fix;
    runningRef.current = true;
    void fetchLandmarks(fix, FETCH_RADIUS_METRES)
      .then((next) => setLandmarks(next))
      .catch(() => {})
      .finally(() => { runningRef.current = false; });
  }, [fix, mapReady, enabled, online]);

  const visible = useMemo(() => {
    if (!enabled || !fix) return [] as VisibleLandmark[];
    return landmarksAhead(fix, landmarks);
  }, [fix, landmarks, enabled]);

  return { visible };
}