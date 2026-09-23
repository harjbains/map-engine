import { useEffect, type RefObject } from "react";
import type maplibregl from "maplibre-gl";

declare global {
  interface Window {
    __mapEngine?: maplibregl.Map;
  }
}

export function useViewDebugHud(mapRef: RefObject<maplibregl.Map | null>, mapReady: boolean) {
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || typeof window === "undefined") return;
    if (!new URLSearchParams(window.location.search).has("map-engine-debug")) return;
    window.__mapEngine = map;
    const readout = document.createElement("span");
    const hud = document.createElement("div");
    hud.className = "debug-hud";
    hud.append(readout);
    map.getContainer().append(hud);
    const refresh = () => {
      readout.textContent = `z${map.getZoom().toFixed(1)} · ${map.getCenter().lat.toFixed(4)}, ${map.getCenter().lng.toFixed(4)}`;
    };
    map.on("move", refresh);
    refresh();
    return () => {
      map.off("move", refresh);
      hud.remove();
    };
  }, [mapRef, mapReady]);
}