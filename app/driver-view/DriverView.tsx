"use client";

import "./driver-view.css";
import { DRIVER_VIEW_ENTER_LABEL } from "./DriverViewConfig";
import { DriverViewErrorBoundary } from "./DriverViewErrorBoundary";
import { DriverViewScreen } from "./DriverViewScreen";
import type { DriverViewProps } from "./DriverViewAdapter";

export function DriverView(props: DriverViewProps) {
  const { enabled, active, onToggle } = props;

  if (!enabled) return null;

  if (!active) {
    return (
      <button type="button" className="driver-view-toggle" onClick={onToggle} aria-label={DRIVER_VIEW_ENTER_LABEL}>
        {DRIVER_VIEW_ENTER_LABEL}
      </button>
    );
  }

  return (
    <DriverViewErrorBoundary onExit={onToggle}>
      <DriverViewScreen {...props} />
    </DriverViewErrorBoundary>
  );
}