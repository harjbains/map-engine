"use client";

import { useEffect, useRef, type RefObject } from "react";
import type maplibregl from "maplibre-gl";
import type { Destination, VehicleFix } from "./config";
import { bearingBetween, distanceKm } from "./map-navigation";
import { formatMiles } from "./map-routing-layers";

export function HomeArrow({ home, visible, mapRef, fixRef, hasFix }: {
  home: Destination | undefined;
  visible: boolean;
  mapRef: RefObject<maplibregl.Map | null>;
  fixRef: RefObject<VehicleFix | null>;
  hasFix: boolean;
}) {
  const glyphRef = useRef<HTMLDivElement | null>(null);
  const labelRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!visible || !home || !hasFix) return;
    const update = () => {
      const map = mapRef.current;
      const fix = fixRef.current;
      if (!map || !fix) return;
      const deg = bearingBetween(fix, home) - map.getBearing();
      if (glyphRef.current) glyphRef.current.style.transform = `rotate(${deg}deg)`;
      if (labelRef.current) labelRef.current.textContent = `HOME · ${formatMiles(distanceKm(fix, home) * 0.621371)} mi`;
    };
    update();
    const map = mapRef.current;
    if (map) {
      map.on("rotate", update);
      map.on("move", update);
    }
    const interval = window.setInterval(update, 250);
    return () => {
      window.clearInterval(interval);
      const current = mapRef.current;
      if (current) {
        current.off("rotate", update);
        current.off("move", update);
      }
    };
  }, [visible, home, hasFix, mapRef, fixRef]);

  if (!visible || !home || !hasFix) return null;

  return (
    <div className="home-arrow" role="status" aria-live="polite">
      <div className="home-arrow-glyph" ref={glyphRef} aria-hidden="true">
        <svg viewBox="0 0 200 160" aria-hidden="true"><path d="M100 8 190 64 112 58 112 152 88 152 88 58 10 64Z" /></svg>
      </div>
      <span className="home-arrow-label" ref={labelRef}>HOME</span>
    </div>
  );
}