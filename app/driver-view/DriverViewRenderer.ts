import type { ApproachInfo } from "./DriverViewAdapter";

export type RouteEvent = {
  x: number;
  z: number;
  metres: number;
  kind: "junction" | "roundabout";
  turn: number;
  side: 1 | -1;
  label: string;
  arrow: string;
};

export function localiseRoute(coordinates: Array<[number, number]>, position: { lat: number; lon: number }, headingDegrees: number, maxZ = 950): Array<{ x: number; z: number }> {
  const cosLat = Math.cos((position.lat * Math.PI) / 180);
  const sinH = Math.sin((headingDegrees * Math.PI) / 180);
  const cosH = Math.cos((headingDegrees * Math.PI) / 180);
  const points: Array<{ x: number; z: number }> = [];
  for (const [lon, lat] of coordinates) {
    const east = (lon - position.lon) * 111320 * cosLat;
    const north = (lat - position.lat) * 111320;
    const x = east * cosH - north * sinH;
    const z = east * sinH + north * cosH;
    if (z < -4) continue;
    if (z > maxZ) break;
    if (points.length) {
      const last = points[points.length - 1];
      if (Math.abs(x - last.x) < 0.8 && Math.abs(z - last.z) < 0.8) continue;
    }
    points.push({ x, z });
  }
  return points;
}

export function zAtMetres(points: Array<{ x: number; z: number }>, metres: number): number {
  if (points.length === 0) return 0;
  let travelled = 0;
  for (let i = 1; i < points.length; i += 1) {
    const segment = Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
    if (travelled + segment >= metres) {
      const fraction = segment > 0.0001 ? (metres - travelled) / segment : 0;
      return points[i - 1].z + (points[i].z - points[i - 1].z) * fraction;
    }
    travelled += segment;
  }
  return points[points.length - 1].z;
}

export function buildEvents(points: Array<{ x: number; z: number }>, steps: Array<{ arrow: string; road: string; metres: number }>): RouteEvent[] {
  const events: RouteEvent[] = [];
  if (points.length < 2) return events;
  let stepIndex = 0;
  const emit = (index: number, metresAt: number, roundabout: boolean, turn: number) => {
    const step = steps[Math.min(stepIndex, Math.max(0, steps.length - 1))];
    if (steps.length) stepIndex += 1;
    events.push({
      x: points[index].x,
      z: points[index].z,
      metres: metresAt,
      kind: roundabout ? "roundabout" : "junction",
      turn: runSum,
      side: runSum > 0 ? 1 : -1,
      label: step?.road || (roundabout ? "Roundabout" : "Next road"),
      arrow: step?.arrow || (roundabout ? "↻" : "↑"),
    });
  };
  let metres = 0;
  let heading: number | null = null;
  let runSum = 0;
  let runIndex = -1;
  let runActive = false;
  let runDistance = 0;
  const finishRun = () => {
    if (runActive && Math.abs(runSum) >= 8) {
      if (Math.abs(runSum) >= 150 && runDistance <= 200) emit(runIndex, metres, true, runSum);
      else emit(runIndex, metres, false, runSum);
    }
    runActive = false;
    runSum = 0;
    runIndex = -1;
    runDistance = 0;
  };
  for (let i = 1; i < points.length; i += 1) {
    const dx = points[i].x - points[i - 1].x;
    const dz = points[i].z - points[i - 1].z;
    const segment = Math.hypot(dx, dz);
    metres += segment;
    if (segment < 0.05) continue;
    let currentHeading = Math.atan2(dx, dz);
    if (heading === null) {
      heading = currentHeading;
      continue;
    }
    let delta = currentHeading - heading;
    heading = currentHeading;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    const degrees = (delta * 180) / Math.PI;
    if (Math.abs(degrees) >= 8) {
      if (runActive && Math.sign(runSum) !== Math.sign(degrees)) finishRun();
      if (!runActive) {
        runIndex = i;
        runActive = true;
        runSum = degrees;
        runDistance = segment;
      } else {
        runSum += degrees;
        runDistance += segment;
      }
    } else {
      finishRun();
    }
  }
  finishRun();
  return events;
}

function nearestApproach(event: RouteEvent): ApproachInfo {
  return {
    kind: event.kind,
    label: event.label,
    metres: Math.max(0, event.metres),
    arrow: event.arrow,
  };
}

export function computeApproach(coordinates: Array<[number, number]>, position: { lat: number; lon: number }, headingDegrees: number, steps: Array<{ arrow: string; road: string; metres: number }>): ApproachInfo | null {
  const points = localiseRoute(coordinates, position, headingDegrees, 950);
  const events = buildEvents(points, steps);
  if (events.length === 0) return null;
  let nearest: RouteEvent | null = null;
  for (const event of events) {
    if (event.metres < 12) continue;
    if (nearest === null || event.metres < nearest.metres) nearest = event;
  }
  return nearest ? nearestApproach(nearest) : null;
}