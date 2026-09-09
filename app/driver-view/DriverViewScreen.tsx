"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createDriverViewData, type ApproachInfo, type DriverViewProps, type SceneControls } from "./DriverViewAdapter";
import { fetchRoadContext, resolveRoadAhead } from "./DriverViewRoad";
import { DriverViewScene } from "./DriverViewScene";
import { DRIVER_VIEW_EXIT_LABEL } from "./DriverViewConfig";

function metresBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const latitudeDelta = (b.lat - a.lat) * Math.PI / 180;
  const longitudeDelta = (b.lon - a.lon) * Math.PI / 180;
  const latitudeA = a.lat * Math.PI / 180;
  const latitudeB = b.lat * Math.PI / 180;
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function DriverViewScreen(props: DriverViewProps) {
  const data = useMemo(() => createDriverViewData(props), [props]);
  const previousBearingRef = useRef<number | null>(null);
  const [tilt, setTilt] = useState(0);
  const [approach, setApproach] = useState<ApproachInfo | null>(null);
  const fixRef = useRef(props.fix);
  fixRef.current = props.fix;
  const roadContextRef = useRef<SceneControls["roadContext"]>(null);
  const sceneControlsRef = useRef<SceneControls>({
    speedMph: 0,
    tilt: 0,
    headingDegrees: null,
    gpsLocked: false,
    position: null,
    route: [],
    routeSteps: [],
    roadContext: null,
  });

  useEffect(() => {
    sceneControlsRef.current = {
      speedMph: data.speedMph,
      tilt,
      headingDegrees: data.headingDegrees,
      gpsLocked: data.gpsLocked,
      position: props.fix ? { lat: props.fix.lat, lon: props.fix.lon, bearing: props.fix.bearing } : null,
      route: props.route?.geometry?.coordinates ?? [],
      routeSteps: props.route?.steps ?? [],
      roadContext: roadContextRef.current,
    };
  }, [data, tilt, props.fix, props.route]);

  useEffect(() => {
    if (!data.gpsLocked) {
      roadContextRef.current = null;
      sceneControlsRef.current = { ...sceneControlsRef.current, roadContext: null };
      return;
    }
    let disposed = false;
    let controller: AbortController | null = null;
    const lastFetch = { lat: 0, lon: 0 };
    const probe = async () => {
      const fix = fixRef.current;
      if (!fix || disposed) return;
      if (lastFetch.lat !== 0 && metresBetween(lastFetch, { lat: fix.lat, lon: fix.lon }) < 500) return;
      lastFetch.lat = fix.lat;
      lastFetch.lon = fix.lon;
      controller?.abort();
      controller = new AbortController();
      const elements = await fetchRoadContext({ lat: fix.lat, lon: fix.lon }, fix.bearing, controller.signal);
      if (disposed) return;
      roadContextRef.current = resolveRoadAhead(elements, { lat: fix.lat, lon: fix.lon }, fix.bearing);
      sceneControlsRef.current = { ...sceneControlsRef.current, roadContext: roadContextRef.current };
    };
    probe();
    const timer = window.setInterval(probe, 15_000);
    return () => {
      disposed = true;
      controller?.abort();
      window.clearInterval(timer);
    };
  }, [data.gpsLocked]);

  useEffect(() => {
    if (data.headingDegrees === null) {
      previousBearingRef.current = null;
      setTilt(0);
      return;
    }
    const previous = previousBearingRef.current;
    previousBearingRef.current = data.headingDegrees;
    if (previous === null) return;
    let delta = data.headingDegrees - previous;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    setTilt(Math.max(-9, Math.min(9, delta)));
    const timer = window.setTimeout(() => setTilt(0), 380);
    return () => window.clearTimeout(timer);
  }, [data.headingDegrees]);

  return (
    <section className="driver-view-screen" aria-label="Driver View (experimental)">
      <div className="driver-view-scene" aria-hidden="true">
        <DriverViewScene controls={sceneControlsRef} onApproach={setApproach} />
      </div>
      <div className="driver-view-hud">
        <header className="driver-view-header">
          <div className="driver-view-brand">
            <strong>DRIVER VIEW</strong>
            <span>EXPERIMENTAL</span>
          </div>
          <div className="driver-view-gps" aria-live="polite">
            <i className={`driver-view-gps-dot${data.gpsLocked ? " locked" : ""}`} />
            <span>{data.gpsLocked ? `${data.lat?.toFixed(6) ?? "…"}, ${data.lon?.toFixed(6) ?? "…"}` : "No GPS fix yet"}</span>
          </div>
        </header>
        {approach && (
          <div className="driver-view-approach" role="status">
            <span>{approach.kind === "roundabout" ? "↻" : approach.arrow}</span>
            <b>{approach.label}</b>
            <em>{approach.metres <= 40 ? "NOW" : `${Math.max(10, Math.round(approach.metres / 10) * 10)} m`}</em>
          </div>
        )}
        <div className="driver-view-dial">
          <div className={`driver-view-speed${data.overspeed ? " overspeed" : ""}`}>
            <b>{data.speedMph}</b>
            <span>mph</span>
          </div>
          <div className="driver-view-dial-rows">
            <div className="driver-view-limit">
              <span>LIMIT</span>
              <b>{data.speedLimitMph === null ? "—" : data.speedLimitMph}</b>
            </div>
            <div className="driver-view-heading">
              <span>HEADING</span>
              <b>{data.headingDegrees === null ? "—" : `${data.headingDegrees}°`}</b>
            </div>
          </div>
        </div>
        <aside className="driver-view-inline">
          <div className="driver-view-inline-row"><span>ROAD</span><b>{data.currentRoad ?? "…"}</b></div>
          <div className="driver-view-inline-row"><span>LOCALITY</span><b>{data.currentLocality ?? "…"}</b></div>
          <div className="driver-view-inline-row"><span>NEXT</span><b>{data.nextInstruction ?? "—"}</b></div>
          <div className="driver-view-inline-row"><span>TO</span><b>{data.destination ?? "No destination"}</b></div>
          {data.remainingMiles !== null && data.remainingMinutes !== null && (
            <div className="driver-view-inline-row driver-view-inline-journey">
              <span>JOURNEY</span>
              <b>{Math.round(data.remainingMiles * 10) / 10} mi · {data.remainingMinutes} min{data.arrivalTime ? ` · ${data.arrivalTime}` : ""}</b>
            </div>
          )}
        </aside>
        <footer className="driver-view-footer">
          <button type="button" className="driver-view-exit" onClick={props.onToggle}>{DRIVER_VIEW_EXIT_LABEL}</button>
        </footer>
      </div>
    </section>
  );
}