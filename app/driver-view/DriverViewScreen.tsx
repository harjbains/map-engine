"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createDriverViewData, type ApproachInfo, type DriverViewProps, type SceneControls } from "./DriverViewAdapter.ts";
import { fetchRoadContext, resolveRoadAhead } from "./DriverViewRoad.ts";
import { DriverViewSimulation } from "./DriverViewSimulator.ts";
import { DriverViewScene } from "./DriverViewScene.tsx";
import { DRIVER_VIEW_EXIT_LABEL } from "./DriverViewConfig.ts";

const METRES_PER_DEGREE_LATITUDE = 111_320;
const SIM_TICK_SECONDS = 0.25;
const DEFAULT_SIM_ORIGIN = { lat: 52.4757, lon: -1.8900 };

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
  const [simStatus, setSimStatus] = useState<"idle" | "running" | "paused" | "finished">("idle");
  const [simFix, setSimFix] = useState<{ lat: number; lon: number; bearing: number; speedMph: number; accuracy: number } | null>(null);
  const [simMeta, setSimMeta] = useState<{ targetMph: number | null; remainingMetres: number | null }>({ targetMph: null, remainingMetres: null });
  const [roadStatus, setRoadStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [roadName, setRoadName] = useState<string | null>(null);
  const fixRef = useRef<{ lat: number; lon: number; bearing: number; speedMph: number; accuracy: number } | null>(null);
  const simRef = useRef<DriverViewSimulation | null>(null);
  const priorSpeedRef = useRef(0);
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

  const simActive = simStatus !== "idle";
  const liveFix = props.fix
    ? { lat: props.fix.latitude, lon: props.fix.longitude, bearing: props.fix.bearing, speedMph: props.fix.speedMph, accuracy: props.fix.accuracy }
    : null;
  const effectiveFix = simActive ? simFix : liveFix;
  fixRef.current = effectiveFix;
  const simMoving = simStatus === "running";
  const speedMph = simActive ? (simMoving ? (simFix?.speedMph ?? 0) : 0) : data.speedMph;
  const headingDegrees = simActive && simFix ? Math.round(simFix.bearing) % 360 : data.headingDegrees;
  const gpsLocked = simActive || data.gpsLocked;
  const limitMph = simActive ? (simMeta.targetMph ?? data.speedLimitMph) : data.speedLimitMph;
  const overspeed = limitMph !== null && speedMph > limitMph + 4;

  useEffect(() => {
    sceneControlsRef.current = {
      speedMph,
      tilt,
      headingDegrees: effectiveFix ? headingDegrees : data.headingDegrees,
      gpsLocked,
      position: effectiveFix ? { lat: effectiveFix.lat, lon: effectiveFix.lon, bearing: effectiveFix.bearing } : null,
      route: props.route?.geometry?.coordinates ?? [],
      routeSteps: props.route?.steps ?? [],
      roadContext: roadContextRef.current,
    };
  }, [speedMph, tilt, headingDegrees, gpsLocked, effectiveFix, data.headingDegrees, props.route]);

  useEffect(() => {
    simRef.current = props.route
      ? new DriverViewSimulation(props.route.geometry.coordinates, props.route.segmentMaxMph ?? [])
      : null;
    priorSpeedRef.current = 0;
    setSimFix(null);
    setSimMeta({ targetMph: null, remainingMetres: null });
    setSimStatus("idle");
  }, [props.route]);

  const gpsActive = simActive || data.gpsLocked;
  useEffect(() => {
    if (!gpsActive) {
      roadContextRef.current = null;
      sceneControlsRef.current = { ...sceneControlsRef.current, roadContext: null };
      setRoadStatus("idle");
      setRoadName(null);
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
      setRoadStatus("loading");
      try {
        const elements = await fetchRoadContext({ lat: fix.lat, lon: fix.lon }, fix.bearing, controller.signal);
        if (disposed) return;
        const resolved = resolveRoadAhead(elements, { lat: fix.lat, lon: fix.lon }, fix.bearing);
        roadContextRef.current = resolved;
        sceneControlsRef.current = { ...sceneControlsRef.current, roadContext: roadContextRef.current };
        setRoadStatus("ok");
        setRoadName(resolved?.roadName ?? null);
      } catch {
        if (disposed) return;
        roadContextRef.current = null;
        sceneControlsRef.current = { ...sceneControlsRef.current, roadContext: null };
        setRoadStatus("error");
      }
    };
    probe();
    const timer = window.setInterval(probe, 10_000);
    return () => {
      disposed = true;
      controller?.abort();
      window.clearInterval(timer);
    };
  }, [gpsActive]);

  useEffect(() => {
    if (simStatus !== "running") return;
    const tick = () => {
      const sim = simRef.current;
      if (!sim) {
        setSimStatus("idle");
        return;
      }
      const next = sim.advance(SIM_TICK_SECONDS, priorSpeedRef.current);
      if (!next) {
        priorSpeedRef.current = 0;
        setSimFix((fix) => (fix ? { ...fix, speedMph: 0 } : fix));
        setSimMeta({ targetMph: null, remainingMetres: 0 });
        setSimStatus("finished");
        return;
      }
      priorSpeedRef.current = next.speedMph;
      setSimFix({ lat: next.lat, lon: next.lon, bearing: next.bearing, speedMph: next.speedMph, accuracy: 5 });
      setSimMeta({ targetMph: next.targetMph, remainingMetres: next.remainingMetres });
    };
    const timer = window.setInterval(tick, SIM_TICK_SECONDS * 1_000);
    return () => window.clearInterval(timer);
  }, [simStatus]);

  const startSim = () => {
    let sim = simRef.current;
    if (!sim) {
      const origin = simFix ?? effectiveFix ?? DEFAULT_SIM_ORIGIN;
      const headingDegreesNow = simFix?.bearing ?? effectiveFix?.bearing ?? 0;
      const distanceMetres = 40_000;
      const north = Math.cos(headingDegreesNow * Math.PI / 180) * distanceMetres;
      const east = Math.sin(headingDegreesNow * Math.PI / 180) * distanceMetres;
      const end = {
        lat: origin.lat + north / METRES_PER_DEGREE_LATITUDE,
        lon: origin.lon + east / (METRES_PER_DEGREE_LATITUDE * Math.cos(origin.lat * Math.PI / 180)),
      };
      sim = new DriverViewSimulation([[origin.lon, origin.lat], [end.lon, end.lat]], [30]);
      simRef.current = sim;
    }
    sim.reset();
    priorSpeedRef.current = 0;
    setSimStatus("running");
  };

  const togglePause = () => {
    if (simStatus === "running") {
      priorSpeedRef.current = 0;
      setSimFix((fix) => (fix ? { ...fix, speedMph: 0 } : fix));
      setSimStatus("paused");
    } else if (simStatus === "paused") {
      setSimStatus("running");
    }
  };

  const stopSim = () => {
    simRef.current?.reset();
    priorSpeedRef.current = 0;
    setSimFix(null);
    setSimMeta({ targetMph: null, remainingMetres: null });
    setSimStatus("idle");
  };

  useEffect(() => {
    if (headingDegrees === null) {
      previousBearingRef.current = null;
      setTilt(0);
      return;
    }
    const previous = previousBearingRef.current;
    previousBearingRef.current = headingDegrees;
    if (previous === null) return;
    let delta = headingDegrees - previous;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    setTilt(Math.max(-9, Math.min(9, delta)));
    const timer = window.setTimeout(() => setTilt(0), 380);
    return () => window.clearTimeout(timer);
  }, [headingDegrees]);

  const roadStatusLabel = roadStatus === "ok"
    ? (roadName ?? "mapped")
    : roadStatus === "loading"
      ? "loading…"
      : roadStatus === "error"
        ? "error, retrying"
        : "no GPS";

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
            <i className={`driver-view-gps-dot${gpsLocked ? " locked" : ""}`} />
            {simActive && <em>SIM</em>}
            <span>{gpsLocked && effectiveFix ? `${effectiveFix.lat?.toFixed(6) ?? "…"}, ${effectiveFix.lon?.toFixed(6) ?? "…"}` : "No GPS fix yet"}</span>
          </div>
        </header>
        <span className={`driver-view-road-status is-${roadStatus}`} role="status">
          ROAD DATA: {roadStatusLabel}
        </span>
        {approach && (
          <div className="driver-view-approach" role="status">
            <span>{approach.kind === "roundabout" ? "↻" : approach.arrow}</span>
            <b>{approach.label}</b>
            <em>{approach.metres <= 40 ? "NOW" : `${Math.max(10, Math.round(approach.metres / 10) * 10)} m`}</em>
          </div>
        )}
        <div className="driver-view-dial">
          <div className={`driver-view-speed${overspeed ? " overspeed" : ""}`}>
            <b>{Math.round(speedMph)}</b>
            <span>mph</span>
          </div>
          <div className="driver-view-dial-rows">
            <div className="driver-view-limit">
              <span>LIMIT</span>
              <b>{limitMph === null ? "—" : limitMph}</b>
            </div>
            <div className="driver-view-heading">
              <span>HEADING</span>
              <b>{headingDegrees === null ? "—" : `${headingDegrees}°`}</b>
            </div>
          </div>
        </div>
        <aside className="driver-view-inline">
          <div className="driver-view-inline-row"><span>ROAD</span><b>{roadName ?? data.currentRoad ?? "…"}</b></div>
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
          <div className="driver-view-sim">
            <span className="driver-view-sim-label">SIMULATION</span>
            <div className="driver-view-sim-controls">
              <button type="button" onClick={startSim} disabled={simStatus === "running" || simStatus === "paused"}>Start</button>
              <button type="button" onClick={togglePause} disabled={simStatus !== "running" && simStatus !== "paused"}>
                {simStatus === "paused" ? "Resume" : "Pause"}
              </button>
              <button type="button" onClick={stopSim} disabled={simStatus === "idle"}>Stop</button>
            </div>
            {(simActive || simStatus === "finished") && (
              <span className="driver-view-sim-status">
                {simStatus === "running" ? `${Math.round(speedMph)} mph` : simStatus === "paused" ? "Paused" : "Finished"}
                {simMeta.remainingMetres !== null ? ` · ${Math.max(0, Math.round(simMeta.remainingMetres))} m left` : ""}
              </span>
            )}
          </div>
          <button type="button" className="driver-view-exit" onClick={props.onToggle}>{DRIVER_VIEW_EXIT_LABEL}</button>
        </footer>
      </div>
    </section>
  );
}