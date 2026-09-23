import assert from "node:assert/strict";
import test from "node:test";
import { adjustDailyEarnings, startDailyEarningsSession, undoDailyEarnings } from "../src/uber/daily-earnings.js";
import { uberProgressCycle } from "../src/uber/progress.js";

test("each touch adjustment changes the unsaved preview in fixed pence", () => {
  let session = startDailyEarningsSession(6_400);
  for (const adjustment of [100, 1000, 2000, 5000, -100] as const) session = adjustDailyEarnings(session, adjustment);
  assert.equal(session.previewPence, 14_400);
  assert.equal(session.history.length, 5);
});

test("earnings preview never becomes negative", () => {
  const session = adjustDailyEarnings(startDailyEarningsSession(50), -100);
  assert.equal(session.previewPence, 0);
  assert.deepEqual(session.history, [-50]);
});

test("undo reverses one adjustment at a time until the starting earnings", () => {
  let session = startDailyEarningsSession(6_400);
  session = adjustDailyEarnings(session, 1000);
  session = adjustDailyEarnings(session, -100);
  assert.equal(undoDailyEarnings(session).previewPence, 7_400);
  assert.equal(undoDailyEarnings(undoDailyEarnings(session)).previewPence, 6_400);
  assert.equal(undoDailyEarnings(undoDailyEarnings(undoDailyEarnings(session))).previewPence, 6_400);
});

test("cancel has no persistence operation and the saved earnings drive the £25 cycle", () => {
  const session = adjustDailyEarnings(startDailyEarningsSession(6_400), 1000);
  assert.equal(session.originalPence, 6_400);
  assert.deepEqual(uberProgressCycle(session.previewPence), [100, 100, 100, 100, 80]);
});
