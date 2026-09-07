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
  const miles = document.createElement("span");
  element.append(name, miles);
  return { element, name, miles };
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
        miles: built.miles,
      };
      chip.marker.setLngLat([landmark.longitude, landmark.latitude]).addTo(map);
      chipsById.set(landmark.id, chip);
    }
    chip.name.textContent = landmark.name;
    chip.miles.textContent = milesText(landmark.miles);
  }
}

export function clearLandmarkChips() {
  for (const [id, chip] of chipsById) {
    chip.marker.remove();
    chipsById.delete(id);
  }
}