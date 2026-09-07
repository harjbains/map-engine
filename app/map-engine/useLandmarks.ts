import { useEffect, useRef, useState } from "react";
import { fetchLandmarks, type Landmark } from "../lib/landmarks";
import { pointAhead } from "../lib/driving.ts";
import type { ActiveRoute, VehicleFix } from "./config";
import { distanceKm, LANDMARK_CHIP_LIMIT, stickyLandmarksAhead, type VisibleLandmark } from "./map-navigation";

type UseLandmarksOptions = {
  fix: VehicleFix | null;
  mapReady: boolean;
  enabled: boolean;
  online: boolean;
  route: ActiveRoute | null;
};

const REFETCH_INTERVAL_MS = 45_000;
const REFETCH_MOVEMENT_KM = 0.9;
const FETCH_RADIUS_METRES = 4_000;
const FETCH_AHEAD_METRES = 800;

export function useLandmarks({ fix, mapReady, enabled, online, route }: UseLandmarksOptions) {
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const fetchedAtRef = useRef(0);
  const fetchedLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const runningRef = useRef(false);
  const previousVisibleRef = useRef([] as VisibleLandmark[]);
  const [visible, setVisible] = useState([] as VisibleLandmark[]);

  useEffect(() => {
    if (!enabled || !mapReady || !online || !fix || runningRef.current) return;
    const now = Date.now();
    const lastLocation = fetchedLocationRef.current;
    const moved = lastLocation ? distanceKm(lastLocation, fix) >= REFETCH_MOVEMENT_KM : false;
    if (!moved && now - fetchedAtRef.current < REFETCH_INTERVAL_MS) return;
    fetchedAtRef.current = now;
    fetchedLocationRef.current = fix;
    runningRef.current = true;
    const centre = fix.speedMph < 8 ? fix : pointAhead(fix, fix.bearing, FETCH_AHEAD_METRES);
    void fetchLandmarks(centre, FETCH_RADIUS_METRES)
      .then((next) => setLandmarks(next))
      .catch(() => {})
      .finally(() => { runningRef.current = false; });
  }, [fix, mapReady, enabled, online]);

  useEffect(() => {
    const next = enabled && fix ? stickyLandmarksAhead(fix, landmarks, previousVisibleRef.current, LANDMARK_CHIP_LIMIT, route) : [];
    previousVisibleRef.current = next;
    setVisible(next);
  }, [fix, landmarks, enabled, route]);

  return { visible };
}