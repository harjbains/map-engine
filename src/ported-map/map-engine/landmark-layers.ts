import maplibregl from "maplibre-gl";
import type { VisibleLandmark } from "./map-navigation";

const chipsById = new Map<string, { marker: maplibregl.Marker; dot: HTMLElement; name: HTMLElement }>();

function buildChip() {
  const element = document.createElement("div");
  element.className = "landmark-chip";
  const dot = document.createElement("i");
  dot.className = "landmark-dot";
  const name = document.createElement("strong");
  element.append(dot, name);
  return { element, dot, name };
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
        dot: built.dot,
        name: built.name,
      };
      chip.marker.setLngLat([landmark.longitude, landmark.latitude]).addTo(map);
      chipsById.set(landmark.id, chip);
    }
    chip.dot.dataset.category = landmark.category;
    const trimmed = landmark.name.length > 24 ? `${landmark.name.substring(0, 23).trimEnd()}…` : landmark.name;
    chip.name.textContent = trimmed;
  }
}

export function clearLandmarkChips() {
  for (const [id, chip] of chipsById) {
    chip.marker.remove();
    chipsById.delete(id);
  }
}