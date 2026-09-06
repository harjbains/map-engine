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
    let rafId = 0;
    const renderTick = () => {
      rafId = window.requestAnimationFrame(renderTick);
      const map = mapRef.current;
      const fix = fixRef.current;
      if (!map || !fix) return;
      const deg = (bearingBetween(fix, home) - map.getBearing() + 360) % 360;
      const miles = distanceKm(fix, home) * 0.621371;
      const milesText = formatMiles(miles);
      const arrow = arrowRef.current;
      if (arrow && arrow.style.transform !== `rotate(${deg}deg)`) arrow.style.transform = `rotate(${deg}deg)`;
      const caption = captionRef.current;
      if (caption && caption.textContent !== milesText) caption.textContent = milesText;
      const aria = `Pointing to home ${Math.round(deg)} degrees, ${milesText} miles away`;
      const disc = discRef.current;
      if (disc && disc.getAttribute("aria-label") !== aria) disc.setAttribute("aria-label", aria);
    };
    renderTick();
    return () => window.cancelAnimationFrame(rafId);
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