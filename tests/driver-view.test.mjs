import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Driver View ships as an isolated, feature-flagged module", async () => {
  const [config, screen, boundary, view, adapter, renderer, scene, barrel, css, mapEngine] = await Promise.all([
    readFile(new URL("../app/driver-view/DriverViewConfig.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/driver-view/DriverViewScreen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/driver-view/DriverViewErrorBoundary.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/driver-view/DriverView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/driver-view/DriverViewAdapter.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/driver-view/DriverViewRenderer.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/driver-view/DriverViewScene.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/driver-view/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/driver-view/driver-view.css", import.meta.url), "utf8"),
    readFile(new URL("../app/MapEngine.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(config, /export const ENABLE_DRIVER_VIEW = true/);
  assert.match(mapEngine, /app\/driver-view|driver-view/);
  assert.match(adapter, /createDriverViewData/);

  assert.match(boundary, /class DriverViewErrorBoundary extends Component/);
  assert.match(boundary, /getDerivedStateFromError/);
  assert.match(view, /DriverViewErrorBoundary/);
  assert.match(view, /DriverViewScreen/);

  assert.match(screen, /aria-label="Driver View \(experimental\)"/);
  assert.match(screen, /className="driver-view-exit"/);
  assert.match(screen, /DriverViewScene controls=\{sceneControlsRef\}/);
  assert.match(view, /className="driver-view-toggle/);
  assert.match(scene, /className="driver-view-scene-canvas"/);
  assert.match(scene, /ResizeObserver/);
  assert.match(renderer, /export function buildScene/);
  assert.match(renderer, /export function renderScene/);
  assert.match(renderer, /function drawBlock/);
  assert.match(renderer, /function drawRoad/);
  assert.match(renderer, /function localRoutePoints/);
  assert.match(renderer, /function clX/);
  assert.match(renderer, /function drawRouteRibbon/);
  assert.match(adapter, /SceneControls = \{/);
  assert.match(adapter, /position: \{ lat: number; lon: number; bearing: number \} \| null/);
  assert.match(adapter, /route: Array<\[number, number\]>/);
  assert.match(screen, /position: props\.fix \? \{ lat: props\.fix\.lat, lon: props\.fix\.lon, bearing: props\.fix\.bearing \} : null/);
  assert.match(screen, /route: props\.route\?\.geometry\?\.coordinates \?\? \[\]/);
  assert.match(css, /\.driver-view-scene \{/);
  assert.match(css, /\.driver-view-scene-canvas \{/);

  assert.match(barrel, /export \{ DriverView \}/);
});