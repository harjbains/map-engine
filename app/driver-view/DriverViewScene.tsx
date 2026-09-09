"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { buildScene, computeApproach, renderScene, type SceneState } from "./DriverViewRenderer";
import type { ApproachInfo, SceneControls } from "./DriverViewAdapter";

export function DriverViewScene({ controls, onApproach }: {
  controls: MutableRefObject<SceneControls>;
  onApproach?: (info: ApproachInfo | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<SceneState | null>(null);
  const onApproachRef = useRef(onApproach);
  const lastApproachKeyRef = useRef<string | null>(null);
  onApproachRef.current = onApproach;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let frame = 0;
    let last = performance.now();
    let disposed = false;

    const tick = (now: number) => {
      if (disposed) return;
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
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
      const scene = sceneRef.current;
      if (scene) {
        renderScene(ctx, scene, ctrl, dt);
      }
      frame = requestAnimationFrame(tick);
    };

    const resize = () => {
      const parent = canvas.parentElement;
      const width = Math.max(1, parent?.clientWidth ?? 1);
      const height = Math.max(1, parent?.clientHeight ?? 1);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sceneRef.current = buildScene(width, height);
    };

    const observer = new ResizeObserver(resize);
    if (canvas.parentElement) observer.observe(canvas.parentElement);
    resize();
    frame = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [controls]);

  return <canvas ref={canvasRef} className="driver-view-scene-canvas" />;
}