import type { Point } from "./driving.ts";
import { STORAGE_KEYS } from "../map-engine/config.ts";
import { CURRENT_TIME_WINDOW_MINUTES, pickupMatchesWindow } from "./pickup-time-matcher.ts";

export type PickupRecord = {
  pickup_id: string;
  latitude: number;
  longitude: number;
  timestamp: number;
  date: string;
  time: string;
  time_window: string;
  day_of_week: number;
  hour: number;
  created_at: number;
};

export type PickupCluster = {
  records: PickupRecord[];
  latitude: number;
  longitude: number;
};

export type PickupFeature = {
  type: "Feature";
  id: string;
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: { matchesWindow: boolean; count: number };
};

export type PickupFeatureCollection = { type: "FeatureCollection"; features: PickupFeature[] };

export const PICKUP_MAX_RECORDS = 500;
export const PICKUP_CLUSTER_RADIUS_METRES = 50;

let storedRecords: PickupRecord[] | null = null;

function zeroPad(value: number): string {
  return String(value).padStart(2, "0");
}

function isValidPickupRecord(value: unknown): value is PickupRecord {
  const record = value as Partial<PickupRecord>;
  return typeof record.pickup_id === "string"
    && Number.isFinite(record.latitude) && Number.isFinite(record.longitude)
    && typeof record.timestamp === "number"
    && typeof record.date === "string" && typeof record.time === "string"
    && typeof record.day_of_week === "number" && typeof record.hour === "number";
}

function persistRecords(records: PickupRecord[]) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.pickupHistory, JSON.stringify(records));
  } catch { /* Storage full or unavailable — keep the session copy. */ }
}

function readStoredRecords(): PickupRecord[] {
  if (storedRecords !== null) return storedRecords;
  storedRecords = [];
  const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(STORAGE_KEYS.pickupHistory);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) storedRecords = parsed.filter(isValidPickupRecord).slice(-PICKUP_MAX_RECORDS);
    } catch { storedRecords = []; }
  }
  return storedRecords;
}

export function readPickupHistory(): PickupRecord[] {
  return readStoredRecords();
}

export function createPickupRecord(position: Point, now: Date = new Date()): PickupRecord {
  const hour = now.getHours();
  const minute = now.getMinutes();
  const windowIndex = hour * 2 + (minute >= 30 ? 1 : 0);
  const windowStartMinutes = windowIndex * 30;
  const windowEndMinutes = Math.min((windowIndex + 1) * 30, 1440);
  const startLabel = `${zeroPad(Math.floor(windowStartMinutes / 60))}:${zeroPad(windowStartMinutes % 60)}`;
  const endLabel = `${zeroPad(Math.floor(windowEndMinutes / 60))}:${zeroPad(windowEndMinutes % 60)}`;
  return {
    pickup_id: `pk_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    latitude: position.latitude,
    longitude: position.longitude,
    timestamp: now.getTime(),
    date: `${now.getFullYear()}-${zeroPad(now.getMonth() + 1)}-${zeroPad(now.getDate())}`,
    time: `${zeroPad(hour)}:${zeroPad(minute)}`,
    time_window: `${startLabel}-${endLabel}`,
    day_of_week: now.getDay(),
    hour,
    created_at: now.getTime(),
  };
}

export function recordPickupAt(position: Point, now: Date = new Date()): PickupRecord[] {
  const record = createPickupRecord(position, now);
  const next = [...readStoredRecords(), record].slice(-PICKUP_MAX_RECORDS);
  storedRecords = next;
  persistRecords(next);
  return next;
}

export function pickupDistanceMetres(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const metresPerLatitudeDegree = 111_320;
  const metresPerLongitudeDegree = metresPerLatitudeDegree * Math.cos(a.latitude * Math.PI / 180);
  const deltaLatitude = (a.latitude - b.latitude) * metresPerLatitudeDegree;
  const deltaLongitude = (a.longitude - b.longitude) * metresPerLongitudeDegree;
  return Math.hypot(deltaLatitude, deltaLongitude);
}

export function clusterPickupRecords(records: PickupRecord[], radiusMetres = PICKUP_CLUSTER_RADIUS_METRES): PickupCluster[] {
  const clusters: PickupCluster[] = [];
  for (const record of records) {
    const matching = clusters.find((cluster) => pickupDistanceMetres(record, cluster) <= radiusMetres);
    if (matching) {
      matching.records.push(record);
      matching.latitude = matching.records.reduce((sum, item) => sum + item.latitude, 0) / matching.records.length;
      matching.longitude = matching.records.reduce((sum, item) => sum + item.longitude, 0) / matching.records.length;
    } else {
      clusters.push({ records: [record], latitude: record.latitude, longitude: record.longitude });
    }
  }
  return clusters;
}

export function pickupFeatureCollection(records: PickupRecord[], now: Date = new Date(), windowMinutes = CURRENT_TIME_WINDOW_MINUTES): PickupFeatureCollection {
  const clusters = clusterPickupRecords(records);
  return {
    type: "FeatureCollection",
    features: clusters.map((cluster) => ({
      type: "Feature",
      id: cluster.records[0].pickup_id,
      geometry: { type: "Point", coordinates: [cluster.longitude, cluster.latitude] },
      properties: {
        matchesWindow: cluster.records.some((record) => pickupMatchesWindow(record, now, windowMinutes)),
        count: cluster.records.length,
      },
    })),
  };
}