import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const shiftProgress = await import("../app/lib/shift-progress.ts");

const values = (entries) => (key) => entries[key] ?? null;

test("publishes the documented integration keys under the uberEngine namespace", () => {
  assert.deepEqual(shiftProgress.SHIFT_PROGRESS_KEYS, {
    progress: "uberEngine.shift.progress",
    active: "uberEngine.shift.active",
    updatedAt: "uberEngine.shift.updatedAt",
  });
  assert.ok(shiftProgress.SHIFT_PROGRESS_MAX_AGE_MS > 0);
  assert.ok(shiftProgress.SHIFT_PROGRESS_MAX_AGE_MS <= 24 * 60 * 60 * 1000);
});

test("parses a valid dailyProgress fraction into the only value Map Engine needs", () => {
  assert.equal(shiftProgress.parseShiftProgress(values({ "uberEngine.shift.progress": "0.70" })), 0.7);
  assert.equal(shiftProgress.parseShiftProgress(values({ "uberEngine.shift.progress": "0" })), 0);
  assert.equal(shiftProgress.parseShiftProgress(values({ "uberEngine.shift.progress": "1" })), 1);
  assert.equal(shiftProgress.parseProgressValue("0.25"), 0.25);
  assert.equal(shiftProgress.parseProgressValue("1.9"), 1, "out-of-range progress is clamped");
  assert.equal(shiftProgress.parseProgressValue("-0.4"), 0, "negative progress is clamped");
});

test("returns null on missing or malformed data without throwing", () => {
  assert.equal(shiftProgress.parseShiftProgress(() => null), null, "no shared storage");
  for (const value of ["abc", "true", "", "  ", "NaN", "Infinity", "{}", "null"]) {
    assert.equal(shiftProgress.parseShiftProgress(values({ "uberEngine.shift.progress": value })), null, value);
  }
});

test("hides when the shift is not active and treats an absent flag as active", () => {
  const stopped = { "uberEngine.shift.progress": "0.5", "uberEngine.shift.active": "false" };
  assert.equal(shiftProgress.parseShiftProgress(values(stopped)), null);
  const running = { "uberEngine.shift.progress": "0.5", "uberEngine.shift.active": "true" };
  assert.equal(shiftProgress.parseShiftProgress(values(running)), 0.5);
  const noFlag = { "uberEngine.shift.progress": "0.5" };
  assert.equal(shiftProgress.parseShiftProgress(values(noFlag)), 0.5, "active is optional");
});

test("hides stale data within a fixed reference time and tolerates malformed updatedAt", () => {
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const stale = { "uberEngine.shift.progress": "0.7", "uberEngine.shift.updatedAt": String(now - 13 * hour) };
  assert.equal(shiftProgress.parseShiftProgress(values(stale), now), null, "older than the 12-hour maximum hides");
  const fresh = { "uberEngine.shift.progress": "0.7", "uberEngine.shift.updatedAt": String(now - hour), };
  assert.equal(shiftProgress.parseShiftProgress(values(fresh), now), 0.7);
  const edge = { "uberEngine.shift.progress": "0.7", "uberEngine.shift.updatedAt": String(now - 12 * hour) };
  assert.equal(shiftProgress.parseShiftProgress(values(edge), now), 0.7, "exactly the maximum age is still shown");
  const iso = { "uberEngine.shift.progress": "0.7", "uberEngine.shift.updatedAt": new Date(now - hour).toISOString() };
  assert.equal(shiftProgress.parseShiftProgress(values(iso), now), 0.7, "ISO-8601 timestamps are accepted");
  const garbage = { "uberEngine.shift.progress": "0.7", "uberEngine.shift.updatedAt": "not-a-date" };
  assert.equal(shiftProgress.parseShiftProgress(values(garbage), now), 0.7, "unknown updatedAt is ignored");
});

test("ships as an isolated component with a documented connection point and no financial wording", async () => {
  const [mapEngineEntry, component, css, config, lib, contract] = await Promise.all([
    readFile(new URL("../app/MapEngine.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/map-engine/UberShiftProgress.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/map-engine.css", import.meta.url), "utf8"),
    readFile(new URL("../app/map-engine/config.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/shift-progress.ts", import.meta.url), "utf8"),
    readFile(new URL("../docs/Uber-Shift-Progress-Integration.md", import.meta.url), "utf8"),
  ]);
  assert.match(mapEngineEntry, /UberShiftProgress/);
  assert.match(mapEngineEntry, /<UberShiftProgress \/>/);
  assert.match(component, /location\.assign/);
  assert.match(component, /aria-label="Open the Uber Engine dashboard"/);
  assert.match(config, /UBER_ENGINE_URL = "https:\/\/harjbains\.github\.io\/uber-engine\/"/);
  assert.match(css, /\.shift-progress/);
  assert.match(css, /\.shift-fill/);
  assert.match(css, /\.drive-shell\.dark \.shift-progress/);
  assert.match(lib, /uberEngine\.shift\.progress/);
  assert.match(lib, /uberEngine\.shift\.active/);
  assert.match(lib, /uberEngine\.shift\.updatedAt/);
  assert.match(contract, /harjbains\.github\.io\/map-engine/);
  assert.match(contract, /harjbains\.github\.io\/uber-engine/);
  assert.match(contract, /uberEngine\.shift\.progress/);
  assert.doesNotMatch(css, /£|Earnings|Income/);
  assert.doesNotMatch(component, /£|Earnings|Income/);
  assert.doesNotMatch(mapEngineEntry.slice(mapEngineEntry.indexOf("UberShiftProgress")), /£|Earnings|Income/);
});