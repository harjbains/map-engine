import maplibregl from "maplibre-gl";
import type { VisibleLandmark } from "./map-navigation";

const chipsById = new Map<string, { marker: maplibregl.Marker; name: HTMLElement; miles: HTMLElement }>();

function milesText(miles: number) {
  return `${miles < 0.1 ? "<0.1" : miles.toFixed(1)} mi`;
}

function buildChip() {
  const element = document.createElement("div");
  element.className = "landmark-chip";
  const name = document.createElement("strong");
  element.append(name);
  return { element, name };
}

export function setLandmarkChips(map: maplibregl.Map, landmarks: VisibleLandmark[]) {
  const wanted = new Map(landmarks.map((landmark) => [landmark.id, landmark]));
  for (const [id, chip] of chipsById) {
    if (!wanted.has(id)) {
      chip.marker.remove();
      chipsById.delete(id);
    }
  }
  for (const landmark of landmarks) {
    let chip = chipsById.get(landmark.id);
    if (!chip) {
      const built = buildChip();
      chip = {
        marker: new maplibregl.Marker({ element: built.element, anchor: "bottom" }),
        name: built.name,
        miles: document.createElement("span"), // unused stub
      };
      chip.marker.setLngLat([landmark.longitude, landmark.latitude]).addTo(map);
      chipsById.set(landmark.id, chip);
    }
    const trimmed = landmark.name.length > 30 ? landmark.name.substring(0, 30) + "..." : landmark.name;
    chip.name.textContent = trimmed;
  }
}

export function clearLandmarkChips() {
  for (const [id, chip] of chipsById) {
    chip.marker.remove();
    chipsById.delete(id);
  }
}