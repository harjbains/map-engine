import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Driver View ships as an isolated, feature-flagged module", async () => {
  const [config, screen, boundary, view, adapter, barrel, css, mapEngine] = await Promise.all([
    readFile(new URL("../app/driver-view/DriverViewConfig.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/driver-view/DriverViewScreen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/driver-view/DriverViewErrorBoundary.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/driver-view/DriverView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/driver-view/DriverViewAdapter.ts", import.meta.url), "utf8"),
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
  assert.match(screen, /motion-stopped/);
  assert.match(screen, /--driver-tilt/);
  assert.match(screen, /--motion-duration/);
  assert.match(view, /className="driver-view-toggle/);
  assert.match(css, /\.driver-view-screen \{/);
  assert.match(css, /@keyframes driver-view-dash-flow/);
  assert.match(css, /@keyframes driver-view-streak-flow/);
  assert.match(css, /\.driver-view-scene\.motion-stopped/);

  assert.match(barrel, /export \{ DriverView \}/);
});