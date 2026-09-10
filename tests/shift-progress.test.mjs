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
    state: "uberEngine.shift.state",
    syncRequest: "uberEngine.shift.syncRequest",
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
  assert.equal(shiftProgress.parseShiftState(() => null), null, "no shared state");
  for (const value of ["", "abc", "null", "[]", "{}", JSON.stringify({ version: 2 })]) {
    assert.equal(shiftProgress.parseShiftState(values({ "uberEngine.shift.state": value })), null, value);
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

const VALID_STATE = {
  version: 1,
  date: "2026-09-10",
  shiftActive: true,
  paused: false,
  dailyTarget: 150,
  todayEarnings: 105,
  dailyProgress: 0.7,
  remaining: 45,
  targetUnitsRemaining: 9,
  activeMinutes: 288,
  hourlyRate: 21.88,
  targetRate: 20,
  weeklyTarget: 900,
  weeklyEarnings: 612.5,
  weeklyProgress: 0.68,
  weeklyMinutes: 960,
  weeklyRemaining: 287.5,
  updatedAt: Date.now(),
};

test("parses the rich shift state object the modal needs", () => {
  const parsed = shiftProgress.parseShiftState(values({ "uberEngine.shift.state": JSON.stringify(VALID_STATE) }));
  assert.ok(parsed);
  assert.equal(parsed.dailyTarget, 150);
  assert.equal(parsed.todayEarnings, 105);
  assert.equal(parsed.remaining, 45);
  assert.equal(parsed.targetUnitsRemaining, 9);
  assert.equal(parsed.activeMinutes, 288);
  assert.equal(parsed.hourlyRate, 21.88);
  assert.equal(parsed.weeklyTarget, 900);
  assert.equal(parsed.weeklyEarnings, 612.5);
  assert.equal(parsed.dailyProgress, 0.7);
  assert.equal(parsed.weeklyProgress, 0.68);
  assert.equal(parsed.shiftActive, true);
});

test("treats an inactive published state as hidden for the collapsed bar but parsable for the modal", () => {
  const inactive = { ...VALID_STATE, shiftActive: false, updatedAt: Date.now() };
  const stored = values({ "uberEngine.shift.state": JSON.stringify(inactive) });
  const parsed = shiftProgress.parseShiftState(stored);
  assert.ok(parsed);
  assert.equal(parsed.shiftActive, false);
});

test("refuses stale rich state and clamps out-of-range progress fields", () => {
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const stale = { ...VALID_STATE, updatedAt: now - 13 * hour };
  assert.equal(shiftProgress.parseShiftState(values({ "uberEngine.shift.state": JSON.stringify(stale) }), now), null);
  const over = { ...VALID_STATE, dailyProgress: 1.4, weeklyProgress: -0.2, remaining: -10, updatedAt: now };
  const parsed = shiftProgress.parseShiftState(values({ "uberEngine.shift.state": JSON.stringify(over) }), now);
  assert.ok(parsed);
  assert.equal(parsed.dailyProgress, 1, "clamped to 1");
  assert.equal(parsed.weeklyProgress, 0, "clamped to 0");
  assert.equal(parsed.remaining, 0, "remaining clamped to 0");
});

test("builds and parses the documented total sync request", () => {
  const raw = shiftProgress.buildSyncRequest("2026-09-10", 105);
  const parsed = shiftProgress.parseSyncRequest(values({ "uberEngine.shift.syncRequest": raw }));
  assert.ok(parsed);
  assert.equal(parsed.date, "2026-09-10");
  assert.equal(parsed.total, 105);
  for (const value of ["", "abc", "null", "{}", '{"total":null}']) {
    assert.equal(shiftProgress.parseSyncRequest(values({ "uberEngine.shift.syncRequest": value })), null, value);
  }
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
  assert.match(mapEngineEntry, /<UberShiftProgress onOpen=\{/);
  assert.doesNotMatch(component, /location\.assign/);
  assert.match(component, /onOpen/);
  assert.match(component, /aria-label="Open today's Uber Engine shift dashboard"/);
  assert.match(css, /\.shift-progress/);
  assert.match(css, /\.shift-fill/);
  assert.match(css, /\.shift-scrim/);
  assert.match(css, /\.shift-modal/);
  assert.match(css, /\.drive-shell\.dark \.shift-progress/);
  assert.match(lib, /uberEngine\.shift\.progress/);
  assert.match(lib, /uberEngine\.shift\.active/);
  assert.match(lib, /uberEngine\.shift\.updatedAt/);
  assert.match(lib, /uberEngine\.shift\.state/);
  assert.match(lib, /uberEngine\.shift\.syncRequest/);
  assert.match(contract, /harjbains\.github\.io\/map-engine/);
  assert.match(contract, /harjbains\.github\.io\/uber-engine/);
  assert.match(contract, /uberEngine\.shift\.progress/);
  assert.match(contract, /uberEngine\.shift\.syncRequest/);
  assert.doesNotMatch(css, /£|Earnings|Income/);
  assert.doesNotMatch(component, /£|Earnings|Income/);
  assert.doesNotMatch(mapEngineEntry.slice(mapEngineEntry.indexOf("UberShiftProgress")), /£|Earnings|Income/);
});