"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { buildScene, renderScene, type SceneState } from "./DriverViewRenderer";
import type { SceneControls } from "./DriverViewAdapter";

export function DriverViewScene({ controls }: { controls: MutableRefObject<SceneControls> }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<SceneState | null>(null);

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
      const scene = sceneRef.current;
      if (scene) renderScene(ctx, scene, controls.current, dt);
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