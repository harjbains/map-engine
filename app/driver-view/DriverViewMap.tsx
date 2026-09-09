"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import maplibregl from "maplibre-gl";
import { styleJsonUrl } from "../lib/tomtom-client";
import type { SceneControls } from "./DriverViewAdapter";

const DRIVER_VIEW_PITCH = 78;
const DRIVER_VIEW_ZOOM = 17;
const ROUTE_SOURCE = "driver-route";
const ROUTE_LAYER = "driver-route-line";
const SIGNAL_SOURCE = "driver-signals";
const SIGNAL_LAYER = "driver-signal-markers";

export function DriverViewMap({ controls }: { controls: MutableRefObject<SceneControls> }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const routeMarkerRef = useRef<maplibregl.Marker | null>(null);
  const signalMarkersRef = useRef<maplibregl.Marker[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const map = new maplibregl.Map({
      container: node,
      style: styleJsonUrl(),
      center: [-1.89, 52.475],
      zoom: DRIVER_VIEW_ZOOM,
      pitch: DRIVER_VIEW_PITCH,
      bearing: 0,
      attributionControl: false,
      maxPitch: 85,
      minPitch: 60,
      interactive: false,
      dragPan: false,
      scrollZoom: false,
      touchZoomRotate: false,
      doubleClickZoom: false,
      keyboard: false,
      touchPitch: false,
    });
    mapRef.current = map;

    map.on("error", (event) => {
      if (setError) setError(event?.error ? String(event.error.message ?? event.error) : "Map error");
    });

    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) mapRef.current.resize();
    });
    resizeObserver.observe(node);

    map.on("load", () => {
      map.resize();
      if (map.getLayer("building-3d")) {
        map.setPaintProperty("building-3d", "fill-extrusion-opacity", 0.92);
      }
      if (map.getLayer("building-flat")) {
        map.setPaintProperty("building-flat", "fill-opacity", 0.0);
      }
      map.addSource(ROUTE_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: ROUTE_LAYER,
        type: "line",
        source: ROUTE_SOURCE,
        paint: {
          "line-color": "#5caaf4",
          "line-width": 4,
          "line-opacity": 0.9,
        },
      });
      map.addLayer(
        {
          id: ROUTE_LAYER + "-outline",
          type: "line",
          source: ROUTE_SOURCE,
          paint: {
            "line-color": "#ffffff",
            "line-width": 7,
            "line-opacity": 0.35,
          },
        },
        ROUTE_LAYER,
      );
      map.addSource(SIGNAL_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: SIGNAL_LAYER,
        type: "circle",
        source: SIGNAL_SOURCE,
        paint: {
          "circle-radius": 5,
          "circle-color": "#ff4a3d",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
        },
      });
    });

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let frame = 0;
    let lastBearing: number | null = null;
    let lastLat = 0;
    let lastLon = 0;

    const tick = () => {
      const ctrl = controls.current;
      const pos = ctrl.position;
      if (pos) {
        const bearing = pos.bearing;
        if (lastBearing === null || Math.abs(bearing - lastBearing) > 0.3) {
          map.setBearing(-bearing);
          lastBearing = bearing;
        }
        if (Math.abs(pos.lat - lastLat) > 1e-6 || Math.abs(pos.lon - lastLon) > 1e-6) {
          map.setCenter([pos.lon, pos.lat]);
          lastLat = pos.lat;
          lastLon = pos.lon;
        }
      }

      const route = ctrl.route;
      if (route && route.length >= 2 && map.isSourceLoaded(ROUTE_SOURCE)) {
        const source = map.getSource(ROUTE_SOURCE) as maplibregl.GeoJSONSource;
        source?.setData({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: { type: "LineString", coordinates: route },
              properties: {},
            },
          ],
        });
      }

      const roadCtx = ctrl.roadContext;
      if (roadCtx && map.isSourceLoaded(SIGNAL_SOURCE)) {
        const features: GeoJSON.Feature[] = (roadCtx.signals ?? []).map(([lon, lat]) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [lon, lat] },
          properties: {},
        }));
        const source = map.getSource(SIGNAL_SOURCE) as maplibregl.GeoJSONSource;
        source?.setData({ type: "FeatureCollection", features });
      }

      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [controls]);

  return (
    <>
      <div ref={containerRef} className="driver-view-map" />
      {error && (
        <div className="driver-view-map-error" role="alert">
          MAP: {error}
        </div>
      )}
    </>
  );
}
