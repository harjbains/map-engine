"use client";

import { useEffect, useRef, type RefObject } from "react";
import maplibregl from "maplibre-gl";
import type { Destination, VehicleFix } from "./config";
import { bearingBetween, distanceKm } from "./map-navigation";
import { formatMiles } from "./map-routing-layers";

const CARDINAL_16 = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

export function HomeCompass({ home, mapRef, fixRef, hasFix }: {
  home: Destination | undefined;
  mapRef: RefObject<maplibregl.Map | null>;
  fixRef: RefObject<VehicleFix | null>;
  hasFix: boolean;
}) {
  const arrowRef = useRef<SVGSVGElement | null>(null);
  const discRef = useRef<HTMLDivElement | null>(null);
  const captionRef = useRef<HTMLSpanElement | null>(null);
  const homeMarkerRef = useRef<maplibregl.Marker | null>(null);

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
      const point = CARDINAL_16[Math.round(deg / 22.5) % 16];
      const arrow = arrowRef.current;
      if (arrow && arrow.style.transform !== `rotate(${deg}deg)`) arrow.style.transform = `rotate(${deg}deg)`;
      const caption = captionRef.current;
      const captionText = `${milesText} mi · ${point}`;
      if (caption && caption.textContent !== captionText) caption.textContent = captionText;
      const aria = `Pointing to home, ${Math.round(deg)} degrees (${point}), ${milesText} miles away`;
      const disc = discRef.current;
      if (disc && disc.getAttribute("aria-label") !== aria) disc.setAttribute("aria-label", aria);
    };
    renderTick();
    return () => window.cancelAnimationFrame(rafId);
  }, [home, hasFix, mapRef, fixRef]);

  useEffect(() => {
    if (!home) return;
    const map = mapRef.current;
    if (!map) return;
    if (!homeMarkerRef.current) {
      const element = document.createElement("div");
      element.className = "home-map-marker";
      element.title = "Home saved position";
      const icon = document.createElement("span");
      icon.textContent = "⌂";
      element.appendChild(icon);
      homeMarkerRef.current = new maplibregl.Marker({ element, anchor: "bottom" })
        .setLngLat([home.longitude, home.latitude])
        .addTo(map);
    } else {
      homeMarkerRef.current.setLngLat([home.longitude, home.latitude]);
    }
    return () => { homeMarkerRef.current?.remove(); homeMarkerRef.current = null; };
  }, [home, mapRef]);

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