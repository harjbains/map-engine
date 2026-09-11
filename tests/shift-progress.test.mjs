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
    controlRequest: "uberEngine.shift.controlRequest",
    mileageRequest: "uberEngine.shift.mileageRequest",
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
  hasActiveShift: true,
  dailyTarget: 150,
  todayEarnings: 105,
  dailyProgress: 0.7,
  remaining: 45,
  ridesRemaining: 9,
  activeMinutes: 288,
  hourlyRate: 21.88,
  targetRate: 20,
  weeklyTarget: 900,
  weeklyEarnings: 612.5,
  weeklyProgress: 0.68,
  weeklyMinutes: 960,
  weeklyRemaining: 287.5,
  businessMilesToday: 47,
  businessMilesWeek: 214,
  updatedAt: Date.now(),
};

test("parses the rich shift state object the modal needs", () => {
  const parsed = shiftProgress.parseShiftState(values({ "uberEngine.shift.state": JSON.stringify(VALID_STATE) }));
  assert.ok(parsed);
  assert.equal(parsed.dailyTarget, 150);
  assert.equal(parsed.todayEarnings, 105);
  assert.equal(parsed.remaining, 45);
  assert.equal(parsed.ridesRemaining, 9);
  assert.equal(parsed.activeMinutes, 288);
  assert.equal(parsed.hourlyRate, 21.88);
  assert.equal(parsed.weeklyTarget, 900);
  assert.equal(parsed.weeklyEarnings, 612.5);
  assert.equal(parsed.dailyProgress, 0.7);
  assert.equal(parsed.weeklyProgress, 0.68);
  assert.equal(parsed.shiftActive, true);
  assert.equal(parsed.hasActiveShift, true);
  assert.equal(parsed.paused, false);
  assert.equal(parsed.businessMilesToday, 47);
  assert.equal(parsed.businessMilesWeek, 214);
});

test("treats an inactive published state as hidden for the collapsed bar but parsable for the modal", () => {
  const inactive = { ...VALID_STATE, shiftActive: false, updatedAt: Date.now() };
  const stored = values({ "uberEngine.shift.state": JSON.stringify(inactive) });
  const parsed = shiftProgress.parseShiftState(stored);
  assert.ok(parsed);
  assert.equal(parsed.shiftActive, false);
});

test("reads ridesRemaining and still falls back to the legacy targetUnitsRemaining key", () => {
  const legacy = { ...VALID_STATE, targetUnitsRemaining: 7, ridesRemaining: undefined, updatedAt: Date.now() };
  delete legacy.ridesRemaining;
  const parsedLegacy = shiftProgress.parseShiftState(values({ "uberEngine.shift.state": JSON.stringify(legacy) }));
  assert.equal(parsedLegacy.ridesRemaining, 7, "legacy key keeps working while stale publishes linger");

  const both = { ...VALID_STATE, targetUnitsRemaining: 7, updatedAt: Date.now() };
  const parsedBoth = shiftProgress.parseShiftState(values({ "uberEngine.shift.state": JSON.stringify(both) }));
  assert.equal(parsedBoth.ridesRemaining, 9, "the rides key takes precedence over the legacy key");
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

test("caches the rich state snapshot so useSyncExternalStore sees stable identity", () => {
  const stored = values({ "uberEngine.shift.state": JSON.stringify(VALID_STATE) });
  const first = shiftProgress.parseShiftStateCached(stored);
  const second = shiftProgress.parseShiftStateCached(stored);
  assert.ok(first);
  assert.strictEqual(first, second, "same stored JSON yields the same object identity");
  assert.equal(second.todayEarnings, 105);
  const changed = { ...VALID_STATE, todayEarnings: 155, updatedAt: Date.now() };
  const updated = shiftProgress.parseShiftStateCached(values({ "uberEngine.shift.state": JSON.stringify(changed) }));
  assert.ok(updated);
  assert.notStrictEqual(updated, first, "a new stored JSON yields a new object");
  assert.strictEqual(shiftProgress.parseShiftStateCached(stored).todayEarnings, 105, "restoring the old JSON restores the cached object");
  assert.strictEqual(shiftProgress.parseShiftStateCached(() => null), null, "missing state stays null and stable");
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

test("builds and parses the shift control request channel", () => {
  const start = shiftProgress.buildControlRequest("start");
  const parsedStart = shiftProgress.parseControlRequest(values({ "uberEngine.shift.controlRequest": start }));
  assert.ok(parsedStart);
  assert.equal(parsedStart.action, "start");
  assert.equal(parsedStart.miles, null);
  assert.ok(parsedStart.requestedAt > 0);

  const end = shiftProgress.buildControlRequest("end", { miles: 64.3 });
  const parsedEnd = shiftProgress.parseControlRequest(values({ "uberEngine.shift.controlRequest": end }));
  assert.ok(parsedEnd);
  assert.equal(parsedEnd.action, "end");
  assert.equal(parsedEnd.miles, 64.3);

  const negative = shiftProgress.parseControlRequest(values({ "uberEngine.shift.controlRequest": shiftProgress.buildControlRequest("end", { miles: -5 }) }));
  assert.ok(negative);
  assert.equal(negative.miles, 0, "negative miles are clamped to zero");

  assert.equal(shiftProgress.parseControlRequest(() => null), null);
  for (const value of ["", "abc", "null", "{}", '{"action":"bogus"}', '{"action":"end","miles":"abc"}']) {
    assert.equal(shiftProgress.parseControlRequest(values({ "uberEngine.shift.controlRequest": value })), null, value);
  }
});

test("builds and parses the business mileage request channel", () => {
  const raw = shiftProgress.buildMileageRequest("2026-09-11", 56);
  const parsed = shiftProgress.parseMileageRequest(values({ "uberEngine.shift.mileageRequest": raw }));
  assert.ok(parsed);
  assert.equal(parsed.date, "2026-09-11");
  assert.equal(parsed.miles, 56);
  assert.ok(parsed.requestedAt > 0);

  const clamped = shiftProgress.parseMileageRequest(values({ "uberEngine.shift.mileageRequest": shiftProgress.buildMileageRequest("2026-09-11", -4) }));
  assert.ok(clamped);
  assert.equal(clamped.miles, 0, "negative miles are clamped to zero");

  assert.equal(shiftProgress.parseMileageRequest(() => null), null);
  for (const value of ["", "abc", "null", "{}", '{"miles":"abc"}', '{"date":"2026-09-11"}']) {
    assert.equal(shiftProgress.parseMileageRequest(values({ "uberEngine.shift.mileageRequest": value })), null, value);
  }
});

test("ships as an isolated component with a documented connection point and no financial wording", async () => {
  const [mapEngineEntry, component, modal, css, config, lib, contract] = await Promise.all([
    readFile(new URL("../app/MapEngine.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/map-engine/UberShiftProgress.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/map-engine/UberShiftModal.tsx", import.meta.url), "utf8"),
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
  assert.match(modal, /parseShiftStateCached/, "the modal memoises its store snapshot");
  assert.match(modal, /ShiftModalBoundary/, "the modal is guarded by an error boundary");
  assert.match(modal, /buildControlRequest/, "the modal drives the shared shift control channel");
  assert.match(modal, /START SHIFT/, "day view can start a shift");
  assert.match(modal, /RESUME|PAUSE/, "day view can pause and resume a running shift");
  assert.match(modal, /END SHIFT/, "day view can end a running shift");
  assert.match(modal, /hasActiveShift/, "the modal tracks a running shift independently of the today target");
  assert.match(modal, /Today's business miles/, "ending a shift asks for today's total business miles");
  assert.match(mapEngineEntry, /ShiftModalBoundary/);
  assert.match(css, /\.shift-progress/);
  assert.match(css, /\.shift-track/);
  assert.match(css, /\.shift-seg/, "the bottom bar is a full-width strip of ride segments");
  assert.match(css, /\.shift-end-box/, "ending a shift reveals the mileage entry box");
  assert.match(css, /\.shift-control-btn/, "shift control buttons are styled");
  assert.match(css, /\.shift-donut-fill\.inner/, "the inner hour ring styles are preserved for a possible analytical return");
  assert.match(css, /\.shift-donut-hrs/, "the hour ring caption styles are preserved");
  assert.match(modal, /ridesRemaining/, "the modal still tracks remaining rides when optimistic state is rebuilt");
  assert.doesNotMatch(modal, /rides left/, "the rides-left panel is removed from the lean dashboard");
  assert.doesNotMatch(modal, /shift-donut-hrs/, "the hour ring and its caption are not rendered while driving");
  assert.doesNotMatch(modal, /to target/, "no hours/time-to-target wording is shown in the lean dashboard");
  assert.match(modal, /UPDATE MILEAGE/, "the control row opens the mileage editor");
  assert.match(modal, /SAVE MILEAGE/, "the mileage editor saves the driver's total");
  assert.match(modal, /businessMilesToday/, "the modal tracks today's recorded business miles");
  assert.match(modal, /setPhase\("week"\)/, "tapping the WEEK target opens the weekly sheet");
  assert.match(modal, /TESLA UI/, "removed analytics are documented as intentionally disabled");
  assert.match(modal, /UPDATE EARNINGS/, "the control row opens the running-total editor");
  assert.match(modal, /SAVE &amp; UPDATE/, "the editor saves the synced total");
  assert.match(modal, /BACK TO DASHBOARD/, "the confirmation returns to the dashboard");
  assert.match(modal, /ADJUST TOTAL AGAIN/, "the confirmation lets the total be adjusted again");
  assert.doesNotMatch(modal, /WEEK VIEW/, "a separate week-view toggle is no longer needed - both targets are on one screen");
  assert.match(component, /<b>\{label\}<\/b>/, "the collapsed bar draws the ride counts inside the segments");
  assert.match(component, /% 5 === 0/, "bar counts land on intervals of five");
  assert.match(component, /rides \+ 10/, "the bar is sized to the day target plus a ten-ride tail");
  assert.match(css, /\.shift-seg b/, "in-segment ride counts are styled");
  assert.match(css, /font-size:clamp\(12px, calc\(\(100vw - 22px\) \/ var\(--cells, 60\) \* 1\.05\), 28px\)/, "segment count labels scale up 2-3x to fit wider cells");
  assert.match(css, /\.active-route-panel \{ position:absolute; bottom:104px;/, "the route details panel sits clear of the shift bar");
  assert.match(css, /\.shift-dash/, "the modal body zones the lean dashboard");
  assert.match(css, /\.shift-targets/, "today and week targets sit side by side");
  assert.match(css, /\.shift-metrics/, "the rate and mileage metrics sit in a row");
  assert.match(css, /\.shift-week-day/, "the weekly sheet renders the seven-day strip");
  assert.match(css, /\.shift-mile-steppers/, "the mileage editor uses large stepper controls");
  assert.match(css, /\.shift-tiles/, "the statistics tile styles are preserved under the TESLA UI comment");
  assert.match(css, /\.shift-panel\.rides em/, "the rides-left figure renders large and blue");
  assert.match(css, /\.shift-scrim/);
  assert.match(css, /\.shift-modal/);
  assert.match(css, /\.drive-shell\.dark \.shift-progress/);
  assert.match(lib, /uberEngine\.shift\.progress/);
  assert.match(lib, /uberEngine\.shift\.active/);
  assert.match(lib, /uberEngine\.shift\.updatedAt/);
  assert.match(lib, /uberEngine\.shift\.state/);
  assert.match(lib, /uberEngine\.shift\.syncRequest/);
  assert.match(lib, /uberEngine\.shift\.controlRequest/);
  assert.match(contract, /harjbains\.github\.io\/map-engine/);
  assert.match(contract, /harjbains\.github\.io\/uber-engine/);
  assert.match(contract, /uberEngine\.shift\.progress/);
  assert.match(contract, /uberEngine\.shift\.syncRequest/);
  assert.match(contract, /uberEngine\.shift\.controlRequest/);
  assert.doesNotMatch(css, /£|Earnings|Income/);
  assert.doesNotMatch(component, /£/, "the collapsed bar never renders a currency figure (segments only)");
  assert.doesNotMatch(mapEngineEntry.slice(mapEngineEntry.indexOf("UberShiftProgress")), /£|Earnings|Income/);
});