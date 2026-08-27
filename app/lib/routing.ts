import type { Destination } from "./geocoding";

type RoutePoint = { latitude: number; longitude: number };

type OsrmStep = {
  distance?: number;
  name?: string;
  ref?: string;
  maneuver?: { type?: string; modifier?: string; exit?: number };
};

type OsrmResponse = {
  code?: string;
  routes?: Array<{
    distance?: number;
    duration?: number;
    geometry?: { type?: string; coordinates?: [number, number][] };
    legs?: Array<{ steps?: OsrmStep[] }>;
  }>;
};

export type RouteInstruction = {
  arrow: string;
  road: string;
  distanceMiles: number;
};

export type CalculatedRoute = {
  geometry: { type: "LineString"; coordinates: [number, number][] };
  distanceMiles: number;
  durationMinutes: number;
  instruction: RouteInstruction | null;
};

function instructionArrow(step: OsrmStep) {
  if (step.maneuver?.type?.includes("roundabout")) return "↻";
  const modifier = step.maneuver?.modifier ?? "straight";
  if (modifier.includes("left")) return "↰";
  if (modifier.includes("right")) return "↱";
  if (modifier === "uturn") return "↶";
  return "↑";
}

function instructionRoad(step: OsrmStep) {
  const name = step.name?.trim() ?? "";
  const ref = step.ref?.trim() ?? "";
  if (ref && name && !name.toLowerCase().includes(ref.toLowerCase())) return `${ref} ${name}`;
  return name || ref || "Continue";
}

export async function calculateRoute(origin: RoutePoint, destination: Destination, signal: AbortSignal): Promise<CalculatedRoute> {
  const coordinates = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const parameters = new URLSearchParams({
    alternatives: "false",
    steps: "true",
    geometries: "geojson",
    overview: "full",
  });
  const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?${parameters}`, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Routing service returned ${response.status}.`);
  const payload = await response.json() as OsrmResponse;
  const route = payload.routes?.[0];
  const routeCoordinates = route?.geometry?.coordinates;
  if (payload.code !== "Ok" || !route || route.geometry?.type !== "LineString" || !routeCoordinates?.length) {
    throw new Error("No driving route was found.");
  }

  const steps = route.legs?.flatMap((leg) => leg.steps ?? []) ?? [];
  const nextStep = steps.find((step) => step.maneuver?.type !== "depart" && step.maneuver?.type !== "arrive" && (step.distance ?? 0) > 0);
  return {
    geometry: { type: "LineString", coordinates: routeCoordinates },
    distanceMiles: (route.distance ?? 0) / 1609.344,
    durationMinutes: Math.max(1, Math.round((route.duration ?? 0) / 60)),
    instruction: nextStep ? {
      arrow: instructionArrow(nextStep),
      road: instructionRoad(nextStep),
      distanceMiles: (nextStep.distance ?? 0) / 1609.344,
    } : null,
  };
}
