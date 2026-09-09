"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { computeApproach } from "./DriverViewRenderer";
import type { ApproachInfo, SceneControls } from "./DriverViewAdapter";
import { DriverViewMap } from "./DriverViewMap";

export function DriverViewScene({ controls, onApproach }: {
  controls: MutableRefObject<SceneControls>;
  onApproach?: (info: ApproachInfo | null) => void;
}) {
  const onApproachRef = useRef(onApproach);
  const lastApproachKeyRef = useRef<string | null>(null);
  onApproachRef.current = onApproach;

  useEffect(() => {
    let frame = 0;
    let disposed = false;

    const tick = () => {
      if (disposed) return;
      const ctrl = controls.current;
      let info: ApproachInfo | null = null;
      if (ctrl.position && (ctrl.route.length >= 2 || ctrl.roadContext)) {
        const coordinates = ctrl.route.length >= 2 ? ctrl.route : (ctrl.roadContext?.trace ?? []);
        const steps = ctrl.route.length >= 2 ? ctrl.routeSteps : (ctrl.roadContext?.steps ?? []);
        info = computeApproach(coordinates, ctrl.position, ctrl.headingDegrees ?? ctrl.position.bearing, steps);
      }
      const key = info ? `${info.kind}|${info.label}|${Math.round(info.metres / 5)}` : "";
      if (key !== lastApproachKeyRef.current) {
        lastApproachKeyRef.current = key;
        onApproachRef.current?.(info);
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
    };
  }, [controls]);

  return <DriverViewMap controls={controls} />;
}