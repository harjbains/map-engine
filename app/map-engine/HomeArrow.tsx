"use client";

import { useEffect, useRef, type RefObject } from "react";
import type maplibregl from "maplibre-gl";
import type { Destination, VehicleFix } from "./config";
import { distanceKm } from "./map-navigation";
import { formatMiles } from "./map-routing-layers";

export function HomeArrow({ home, visible, mapRef, fixRef, hasFix }: {
  home: Destination | undefined;
  visible: boolean;
  mapRef: RefObject<maplibregl.Map | null>;
  fixRef: RefObject<VehicleFix | null>;
  hasFix: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const glyphRef = useRef<HTMLDivElement | null>(null);
  const labelRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!visible || !home || !hasFix) return;
    const update = () => {
      const map = mapRef.current;
      const fix = fixRef.current;
      if (!map || !fix || !map.loaded()) return;
      let homeScreen;
      let vehScreen;
      try {
        homeScreen = map.project([home.longitude, home.latitude]);
        vehScreen = map.project([fix.longitude, fix.latitude]);
      } catch {
        return;
      }
      if (!homeScreen || !vehScreen || !Number.isFinite(homeScreen.x) || !Number.isFinite(homeScreen.y) || !Number.isFinite(vehScreen.x) || !Number.isFinite(vehScreen.y)) return;
      const rect = map.getContainer().getBoundingClientRect();
      const anchorX = Math.min(Math.max(vehScreen.x, 60), rect.width - 60);
      const anchorY = Math.min(Math.max(vehScreen.y, 80), rect.height - 80);
      const dx = homeScreen.x - anchorX;
      const dy = homeScreen.y - anchorY;
      if (Math.hypot(dx, dy) < 1) return;
      const deg = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
      if (wrapRef.current) {
        wrapRef.current.style.left = `${anchorX}px`;
        wrapRef.current.style.top = `${anchorY}px`;
      }
      if (glyphRef.current) glyphRef.current.style.transform = `rotate(${deg}deg)`;
      if (labelRef.current) labelRef.current.textContent = `HOME · ${formatMiles(distanceKm(fix, home) * 0.621371)} mi`;
    };
    update();
    const map = mapRef.current;
    if (map) {
      if (!map.loaded()) map.once("load", update);
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
    <div className="home-arrow" ref={wrapRef} role="status" aria-live="polite">
      <div className="home-arrow-glyph" ref={glyphRef} aria-hidden="true">
        <svg viewBox="0 0 200 160" aria-hidden="true"><path d="M100 8 190 64 112 58 112 152 88 152 88 58 10 64Z" /></svg>
      </div>
      <span className="home-arrow-label" ref={labelRef}>HOME</span>
    </div>
  );
}