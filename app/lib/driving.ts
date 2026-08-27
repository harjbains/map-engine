export const MPS_TO_MPH = 2.2369362920544;

export type Point = { latitude: number; longitude: number };

export function toMph(metresPerSecond: number): number {
  return Math.max(0, metresPerSecond) * MPS_TO_MPH;
}

export function smooth(previous: number | null, sample: number, alpha: number): number {
  return previous === null ? sample : previous + alpha * (sample - previous);
}

export function smoothBearing(previous: number | null, target: number, alpha = 0.3): number {
  if (previous === null) return ((target % 360) + 360) % 360;
  const delta = ((target - previous + 540) % 360) - 180;
  return (previous + delta * alpha + 360) % 360;
}

export function dynamicZoom(speedMph: number): number {
  const interpolate = (from: number, to: number, fraction: number) => from + (to - from) * Math.max(0, Math.min(1, fraction));
  if (speedMph <= 10) return interpolate(16.7, 16.5, speedMph / 10);
  if (speedMph <= 30) return interpolate(16.5, 16, (speedMph - 10) / 20);
  if (speedMph <= 50) return interpolate(16, 15.5, (speedMph - 30) / 20);
  if (speedMph <= 70) return interpolate(15.5, 14.8, (speedMph - 50) / 20);
  return 14.6;
}

export function pointAhead(point: Point, bearingDegrees: number, distanceMetres: number): Point {
  const earthRadius = 6_371_000;
  const angularDistance = distanceMetres / earthRadius;
  const bearing = bearingDegrees * Math.PI / 180;
  const lat1 = point.latitude * Math.PI / 180;
  const lon1 = point.longitude * Math.PI / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
    Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const lon2 = lon1 + Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
    Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
  );
  return { latitude: lat2 * 180 / Math.PI, longitude: lon2 * 180 / Math.PI };
}
