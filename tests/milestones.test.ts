import assert from "node:assert/strict";
import test from "node:test";
import { deriveEarningsTransition } from "../src/uber/milestones.js";
import type { UberDashboard } from "../src/uber/types.js";

const dashboard = (today: number, week: number, target: number | null = 10_000): UberDashboard => ({
  today: "2026-09-18", summary: { weekStart: "2026-09-14", weeklyTargetPence: 75_000, weeklyEarningsPence: week, weeklyMilesTenths: 0, remainingTargetPence: 75_000 - week, dailyTargets: [] },
  todayEarningsPence: today, todayMilesTenths: 0, todayTargetPence: target, todayTrips: 0, weeklyForecastPence: 0, forecastBand: 'grey', session: null, aheadBehindPence: target === null ? null : today - target, days: [],
});

test("a persisted £25 boundary flashes only on an increasing earnings transition", () => {
  assert.deepEqual(deriveEarningsTransition(dashboard(2_400, 20_000), dashboard(2_600, 20_200), 1), { id: 1, cycleCrossed: true, milestone: null });
  assert.equal(deriveEarningsTransition(dashboard(2_600, 20_200), dashboard(2_600, 20_200), 2), null);
});

test("daily and weekly milestones fire only when crossed from below", () => {
  assert.equal(deriveEarningsTransition(dashboard(9_900, 70_000), dashboard(10_100, 70_200), 3)?.milestone, "daily");
  assert.equal(deriveEarningsTransition(dashboard(14_000, 74_900), dashboard(14_200, 75_100), 4)?.milestone, "weekly");
  assert.equal(deriveEarningsTransition(dashboard(15_000, 76_000), dashboard(16_000, 77_000), 5), null);
  assert.equal(deriveEarningsTransition(dashboard(9_900, 70_000, null), dashboard(10_100, 70_200, null), 6)?.milestone, null);
});

test("historical or decreasing changes never celebrate", () => {
  assert.equal(deriveEarningsTransition(dashboard(10_000, 75_000), dashboard(9_000, 74_000), 1), null);
  assert.equal(deriveEarningsTransition(dashboard(9_900, 74_900), { ...dashboard(10_100, 75_100), today: "2026-09-19" }, 2), null);
});
