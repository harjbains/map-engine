"use client";

import { useEffect, useRef, type RefObject } from "react";
import type maplibregl from "maplibre-gl";
import type { Destination, VehicleFix } from "./config";
import { bearingBetween, distanceKm } from "./map-navigation";
import { formatMiles } from "./map-routing-layers";

export function HomeCompass({ home, mapRef, fixRef, hasFix }: {
  home: Destination | undefined;
  mapRef: RefObject<maplibregl.Map | null>;
  fixRef: RefObject<VehicleFix | null>;
  hasFix: boolean;
}) {
  const arrowRef = useRef<SVGSVGElement | null>(null);
  const discRef = useRef<HTMLDivElement | null>(null);
  const captionRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!home || !hasFix) return;
    const update = () => {
      const map = mapRef.current;
      const fix = fixRef.current;
      if (!map || !fix) return;
      const deg = bearingBetween(fix, home) - map.getBearing();
      const degNorm = ((deg % 360) + 360) % 360;
      if (arrowRef.current) arrowRef.current.style.transform = `rotate(${deg}deg)`;
      const miles = distanceKm(fix, home) * 0.621371;
      if (captionRef.current) captionRef.current.textContent = formatMiles(miles);
      if (discRef.current) discRef.current.setAttribute("aria-label", `Pointing to home ${Math.round(degNorm)} degrees, ${formatMiles(miles)} miles away`);
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
  }, [home, hasFix, mapRef, fixRef]);

  if (!home || !hasFix) return null;

  return (
    <div ref={discRef} className="home-compass" role="img" aria-label="Home direction compass">
      <svg ref={arrowRef} className="home-compass-arrow" viewBox="0 0 64 64" aria-hidden="true">
        <path d="M32 4 38 50 32 44 26 50Z" fill="currentColor" />
        <circle cx="32" cy="32" r="3.5" fill="currentColor" opacity="0.55" />
      </svg>
      <span className="home-compass-label"><b>⌂</b><em ref={captionRef} aria-hidden="true">--</em></span>
    </div>
  );
}