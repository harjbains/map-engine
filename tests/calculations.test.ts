import assert from "node:assert/strict";
import test from "node:test";
import { allocateDailyTargets, deriveDashboardDays, deriveWeeklySummary } from "../src/uber/calculations.js";
import { datesInWeek, londonToday, weekStartForDate } from "../src/uber/calendar.js";
import { gbpFromPence, penceFromGbp, tenthsFromMiles } from "../src/uber/money.js";
import { uberProgressCycle } from "../src/uber/progress.js";
import type { DayRecord, WeekPlan, WeekPlanDay } from "../src/uber/types.js";

const plan: WeekPlan = { weekStart: "2026-09-14", weeklyTargetPence: 10_000, createdAt: "", updatedAt: "" };
const day = (date: WeekPlanDay["date"], isWorking: boolean, workWeight: WeekPlanDay["workWeight"] = "normal"): WeekPlanDay => ({ weekStart: "2026-09-14", date, isWorking, workWeight, createdAt: "", updatedAt: "" });
const record = (date: DayRecord["date"], grossEarningsPence: number, businessMilesTenths: number): DayRecord => ({ date, grossEarningsPence, businessMilesTenths, trips: 1, status: "completed", createdAt: "", updatedAt: "" });

test("daily targets split whole pennies from Monday through Sunday", () => {
  const allocations = allocateDailyTargets(10_000, [
    day("2026-09-14", true), day("2026-09-15", true), day("2026-09-16", true), day("2026-09-17", false), day("2026-09-18", false), day("2026-09-19", false), day("2026-09-20", false),
  ]);
  assert.deepEqual(allocations.map((item) => item.targetPence), [3334, 3333, 3333]);
  assert.equal(allocations.reduce((total, item) => total + item.targetPence, 0), 10_000);
});

test("zero planned work days has no daily allocation", () => {
  assert.deepEqual(allocateDailyTargets(75_000, datesInWeek("2026-09-14").map((date) => day(date, false))), []);
});

test("LIGHT, NORMAL and HEAVY targets allocate exactly £750 with Monday-first pennies", () => {
  const weights = ["normal", "light", "normal", "normal", "heavy", "heavy", "light"] as const;
  const allocations = allocateDailyTargets(75_000, datesInWeek("2026-09-14").map((date, index) => day(date, true, weights[index]!)));
  assert.deepEqual(allocations.map((allocation) => allocation.targetPence), [10_715, 5_358, 10_714, 10_714, 16_071, 16_071, 5_357]);
  assert.equal(allocations.reduce((total, allocation) => total + allocation.targetPence, 0), 75_000);
});

test("OFF days receive no target and retained weight does not count", () => {
  const allocations = allocateDailyTargets(10_001, [day("2026-09-14", true, "light"), day("2026-09-15", false, "heavy"), day("2026-09-16", true, "heavy")]);
  assert.deepEqual(allocations.map((allocation) => allocation.targetPence), [2_501, 7_500]);
});

test("weekly summary includes actuals outside plan but excludes other weeks", () => {
  const summary = deriveWeeklySummary(plan, datesInWeek("2026-09-14").map((date, index) => day(date, index < 5)), [
    record("2026-09-14", 8_500, 215),
    record("2026-09-20", 10_000, 100),
    record("2026-09-21", 99_999, 999),
  ]);
  assert.equal(summary.weeklyEarningsPence, 18_500);
  assert.equal(summary.weeklyMilesTenths, 315);
  assert.equal(summary.remainingTargetPence, -8_500);
  assert.equal(summary.dailyTargets.length, 5);
});

test("dashboard day facts keep unrecorded, missed and actual states separate", () => {
  const days = deriveDashboardDays(plan, datesInWeek("2026-09-14").map((date, index) => day(date, index < 2)), [
    { ...record("2026-09-14", 0, 0), status: "missed" },
    record("2026-09-20", 8_500, 100),
  ]);
  assert.deepEqual(days.map((item) => [item.status, item.targetPence]), [
    ["missed", 5000], ["unrecorded", 5000], ["unrecorded", null], ["unrecorded", null], ["unrecorded", null], ["unrecorded", null], ["completed", null],
  ]);
});

test("money and mileage parsing preserve fixed precision", () => {
  assert.equal(penceFromGbp("142.05"), 14_205);
  assert.equal(gbpFromPence(14_205), "142.05");
  assert.equal(tenthsFromMiles("21.5"), 215);
  assert.throws(() => penceFromGbp("1.001"));
});

test("Uber map progress stays on the £25 five-cell cycle", () => {
  assert.deepEqual(uberProgressCycle(6_400), [100, 100, 80, 0, 0]);
  assert.deepEqual(uberProgressCycle(2_500), [100, 100, 100, 100, 100]);
  assert.deepEqual(uberProgressCycle(0), [0, 0, 0, 0, 0]);
});

test("calendar weeks use Monday starts and Europe/London date", () => {
  assert.equal(weekStartForDate("2026-09-20"), "2026-09-14");
  assert.equal(weekStartForDate("2026-09-21"), "2026-09-21");
  assert.deepEqual(datesInWeek("2026-09-14"), ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20"]);
  assert.equal(londonToday(new Date("2026-09-20T23:30:00.000Z")), "2026-09-21");
});
