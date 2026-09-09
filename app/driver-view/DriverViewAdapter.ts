import type { ActiveRoute, VehicleFix } from "../map-engine/config";

export type DriverViewProps = {
  enabled: boolean;
  active: boolean;
  onToggle: () => void;
  fix: VehicleFix | null;
  route: ActiveRoute | null;
  currentRoad: string | null;
  currentLocality: string | null;
  speedLimitMph: number | null;
  speedMph: number;
  remainingMiles: number | null;
  remainingMinutes: number | null;
  arrivalTime: string | null;
};

export type DriverViewData = {
  gpsLocked: boolean;
  headingDegrees: number | null;
  speedMph: number;
  speedLimitMph: number | null;
  overspeed: boolean;
  lat: number | null;
  lon: number | null;
  currentRoad: string | null;
  currentLocality: string | null;
  destination: string | null;
  nextInstruction: string | null;
  remainingMiles: number | null;
  remainingMinutes: number | null;
  arrivalTime: string | null;
};

export type SceneControls = {
  speedMph: number;
  tilt: number;
  headingDegrees: number | null;
  gpsLocked: boolean;
};

export function createDriverViewData(props: DriverViewProps): DriverViewData {
  const { fix, route, currentRoad, currentLocality, speedLimitMph, speedMph, remainingMiles, remainingMinutes, arrivalTime } = props;
  return {
    gpsLocked: fix !== null,
    headingDegrees: fix ? Math.round(fix.bearing) % 360 : null,
    speedMph,
    speedLimitMph,
    overspeed: speedLimitMph !== null && speedMph > speedLimitMph + 4,
    lat: fix?.lat ?? null,
    lon: fix?.lon ?? null,
    currentRoad,
    currentLocality,
    destination: route
      ? `${route.destination.name}${route.destination.context ? `, ${route.destination.context}` : ""}`
      : null,
    nextInstruction: route?.instruction
      ? `${route.instruction.arrow} ${route.instruction.road}`
      : null,
    remainingMiles,
    remainingMinutes,
    arrivalTime,
  };
}