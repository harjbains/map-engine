import type maplibregl from "maplibre-gl";
import type { Point } from "../lib/driving";
import type { ActiveRoute, VehicleFix } from "./config";

const ROAD_LABEL_LAYERS = ["road-name", "route-motorway", "route-a", "route-b"];
const ARRIVAL_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });

export function distanceKm(a: Point, b: Point) {
  const lat = (a.latitude + b.latitude) / 2 * Math.PI / 180;
  const x = (a.longitude - b.longitude) * Math.cos(lat) * 111.32;
  const y = (a.latitude - b.latitude) * 110.574;
  return Math.hypot(x, y);
}

export function bearingBetween(a: Point, b: Point) {
  const latitudeDelta = (b.latitude - a.latitude) * Math.PI / 180;
  const longitudeDelta = (b.longitude - a.longitude) * Math.PI / 180;
  const y = Math.sin(longitudeDelta) * Math.cos(b.latitude * Math.PI / 180);
  const x = Math.cos(a.latitude * Math.PI / 180) * Math.sin(b.latitude * Math.PI / 180)
    - Math.sin(a.latitude * Math.PI / 180) * Math.cos(b.latitude * Math.PI / 180) * Math.cos(longitudeDelta);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

export function headingDifference(fromDegrees: number, toDegrees: number) {
  return (fromDegrees - toDegrees + 540) % 360 - 180;
}

export function liveRouteProgress(route: ActiveRoute, position: Point, now: number) {
  const coordinates = route.geometry.coordinates;
  let totalGeometryKm = 0;
  let completedGeometryKm = 0;
  let closestDistanceKm = Number.POSITIVE_INFINITY;
  let distanceBeforeSegmentKm = 0;
  const latitudeScale = Math.cos(position.latitude * Math.PI / 180);
  const point = { x: position.longitude * latitudeScale, y: position.latitude };

  for (let index = 1; index < coordinates.length; index += 1) {
    const previous = { latitude: coordinates[index - 1][1], longitude: coordinates[index - 1][0] };
    const next = { latitude: coordinates[index][1], longitude: coordinates[index][0] };
    const segmentKm = distanceKm(previous, next);
    totalGeometryKm += segmentKm;
    const start = { x: previous.longitude * latitudeScale, y: previous.latitude };
    const end = { x: next.longitude * latitudeScale, y: next.latitude };
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const denominator = dx * dx + dy * dy;
    const fraction = denominator === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / denominator));
    const projected = { x: start.x + fraction * dx, y: start.y + fraction * dy };
    const separationKm = Math.hypot((point.x - projected.x) * 111.32, (point.y - projected.y) * 110.574);
    if (separationKm < closestDistanceKm) {
      closestDistanceKm = separationKm;
      completedGeometryKm = distanceBeforeSegmentKm + segmentKm * fraction;
    }
    distanceBeforeSegmentKm += segmentKm;
  }

  const completedFraction = totalGeometryKm > 0 ? Math.max(0, Math.min(1, completedGeometryKm / totalGeometryKm)) : 0;
  const remainingMiles = Math.max(0, route.distanceMiles * (1 - completedFraction));
  const remainingMinutes = remainingMiles < 0.05 ? 0 : Math.max(1, Math.ceil(route.durationMinutes * (remainingMiles / Math.max(route.distanceMiles, 0.01))));
  const arrivalTime = ARRIVAL_TIME_FORMATTER.format(new Date(now + remainingMinutes * 60_000));
  return { remainingMiles, remainingMinutes, arrivalTime };
}

export function vehicleScreenOffset(map: maplibregl.Map): [number, number] {
  return [0, Math.round(map.getContainer().clientHeight * 0.15)];
}

export function positionVehicleMarker(map: maplibregl.Map, vehicle: HTMLDivElement, fix: VehicleFix, anchored: boolean) {
  const container = map.getContainer();
  const point = anchored
    ? { x: container.clientWidth / 2, y: container.clientHeight * 0.65 }
    : map.project([fix.longitude, fix.latitude]);
  vehicle.style.left = `${point.x}px`;
  vehicle.style.top = `${point.y}px`;
  vehicle.style.transform = `translate(-50%, -50%) rotate(${fix.bearing - map.getBearing()}deg)`;
}

function distanceToSegment(point: { x: number; y: number }, start: { x: number; y: number }, end: { x: number; y: number }) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const fraction = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - (start.x + fraction * dx), point.y - (start.y + fraction * dy));
}

export function roadFeatureLabel(feature: { properties: Record<string, unknown> | null }) {
  const properties = feature.properties as Record<string, unknown> | null;
  const ref = typeof properties?.ref === "string" ? properties.ref : "";
  const name = typeof properties?.name_en === "string" ? properties.name_en : typeof properties?.name === "string" ? properties.name : "";
  return ref && name && !name.includes(ref) ? `${ref} ${name}` : name || ref || null;
}

export function nearestNamedRoad(map: maplibregl.Map, point: Point) {
  const target = map.project([point.longitude, point.latitude]);
  const labelLayers = ROAD_LABEL_LAYERS.filter((id) => Boolean(map.getLayer(id)));
  if (labelLayers.length) {
    const directlyUnderPointer = map.queryRenderedFeatures(target, { layers: labelLayers });
    const directName = directlyUnderPointer.map(roadFeatureLabel).find(Boolean);
    if (directName) return directName;
    const labelsNearPointer = map.queryRenderedFeatures(
      [[target.x - 16, target.y - 16], [target.x + 16, target.y + 16]],
      { layers: labelLayers },
    );
    const nearbyName = labelsNearPointer.map(roadFeatureLabel).find(Boolean);
    if (nearbyName) return nearbyName;
  }
  let nearest: { label: string; distance: number } | null = null;
  for (const feature of map.querySourceFeatures("openmaptiles", { sourceLayer: "transportation_name" })) {
    const label = roadFeatureLabel(feature);
    if (!label || (feature.geometry.type !== "LineString" && feature.geometry.type !== "MultiLineString")) continue;
    const geometry = feature.geometry as { type: "LineString" | "MultiLineString"; coordinates: [number, number][] | [number, number][][] };
    const lines = geometry.type === "LineString" ? [geometry.coordinates as [number, number][]] : geometry.coordinates as [number, number][][];
    let featureDistance = Number.POSITIVE_INFINITY;
    for (const line of lines) {
      for (let index = 1; index < line.length; index += 1) {
        featureDistance = Math.min(featureDistance, distanceToSegment(target, map.project(line[index - 1]), map.project(line[index])));
      }
    }
    if (!nearest || featureDistance < nearest.distance) nearest = { label, distance: featureDistance };
  }
  return nearest && nearest.distance <= 56 ? nearest.label : null;
}

export function nearestLocality(map: maplibregl.Map, point: Point) {
  const priorities: Record<string, number> = { city: 0, town: 1, village: 2, borough: 3, suburb: 4, quarter: 5, neighbourhood: 6 };
  let best: { name: string; score: number } | null = null;
  for (const feature of map.querySourceFeatures("openmaptiles", { sourceLayer: "place" })) {
    const geometry = feature.geometry as { type?: string; coordinates?: number[] };
    if (geometry.type !== "Point" || !Array.isArray(geometry.coordinates)) continue;
    const properties = feature.properties as Record<string, unknown> | null;
    const name = typeof properties?.name_en === "string" ? properties.name_en : typeof properties?.name === "string" ? properties.name : "";
    const localityClass = typeof properties?.class === "string" ? properties.class : "";
    if (!name || priorities[localityClass] === undefined) continue;
    const candidate = { latitude: geometry.coordinates[1], longitude: geometry.coordinates[0] };
    const score = distanceKm(point, candidate) + priorities[localityClass] * 1.5;
    if (!best || score < best.score) best = { name, score };
  }
  return best?.name ?? null;
}

export function distanceFromRouteMetres(route: Pick<CalculatedRoute, "geometry">, point: Point) {
  let nearestMetres = Number.POSITIVE_INFINITY;
  const latitudeScale = Math.cos(point.latitude * Math.PI / 180);
  const fixed = { x: point.longitude * latitudeScale, y: point.latitude };
  const coordinates = route.geometry.coordinates;
  for (let index = 1; index < coordinates.length; index += 1) {
    const start = coordinates[index - 1];
    const end = coordinates[index];
    const startX = start[0] * latitudeScale;
    const endX = end[0] * latitudeScale;
    const dx = endX - startX;
    const dy = end[1] - start[1];
    const denominator = dx * dx + dy * dy;
    const fraction = denominator === 0 ? 0 : Math.max(0, Math.min(1, ((fixed.x - startX) * dx + (fixed.y - start[1]) * dy) / denominator));
    const projected = { x: startX + fraction * dx, y: start[1] + fraction * dy };
    const metres = Math.hypot((fixed.x - projected.x) * 111_320, (fixed.y - projected.y) * 110_574);
    if (metres < nearestMetres) nearestMetres = metres;
  }
  return nearestMetres;
}
