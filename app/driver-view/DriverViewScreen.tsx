"use client";

import { useMemo } from "react";
import { createDriverViewData, type DriverViewProps } from "./DriverViewAdapter";
import { DRIVER_VIEW_EXIT_LABEL } from "./DriverViewConfig";

export function DriverViewScreen(props: DriverViewProps) {
  const data = useMemo(() => createDriverViewData(props), [props]);

  return (
    <section className="driver-view-screen" aria-label="Driver View (experimental)">
      <div className="driver-view-scene" aria-hidden="true">
        <div className="driver-view-sky">
          <div className="driver-view-sun" />
        </div>
        <div className="driver-view-horizon" />
        <div className="driver-view-road">
          <div className="driver-view-dash" />
        </div>
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
        <dl className="driver-view-stats">
          <div><dt>ROAD</dt><dd>{data.currentRoad ?? "…"}</dd></div>
          <div><dt>LOCALITY</dt><dd>{data.currentLocality ?? "…"}</dd></div>
          <div><dt>NEXT</dt><dd>{data.nextInstruction ?? "—"}</dd></div>
          <div><dt>TO</dt><dd>{data.destination ?? "No destination set"}</dd></div>
          {data.remainingMiles !== null && data.remainingMinutes !== null && (
            <>
              <div><dt>DISTANCE</dt><dd>{Math.round(data.remainingMiles * 10) / 10} mi</dd></div>
              <div><dt>REMAINING</dt><dd>{data.remainingMinutes} min</dd></div>
              <div><dt>ARRIVE</dt><dd>{data.arrivalTime ?? "—"}</dd></div>
            </>
          )}
        </dl>
        <footer className="driver-view-footer">
          <small>The live map keeps running underneath — your route, GPS follow and settings are not reset when switching views.</small>
          <button type="button" className="driver-view-exit" onClick={props.onToggle}>{DRIVER_VIEW_EXIT_LABEL}</button>
        </footer>
      </div>
    </section>
  );
}