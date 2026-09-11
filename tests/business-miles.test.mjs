import test from "node:test";
import assert from "node:assert/strict";
import { isoOf, mondayOf, parseBusinessMiles, parseShiftDays, rememberDay, setTodaysMiles, weekDays, weekMiles } from "../app/lib/business-miles.ts";

test("parses the business miles store leniently", () => {
  assert.deepEqual(parseBusinessMiles(null), {});
  assert.deepEqual(parseBusinessMiles(""), {});
  assert.deepEqual(parseBusinessMiles("[]"), {});
  assert.deepEqual(parseBusinessMiles('{"2026-09-11":47}'), { "2026-09-11": 47 });
  assert.deepEqual(parseBusinessMiles('{"2026-09-11":"47","bad-date":10,"2026-09-12":-3,"2026-09-13":12}'), {
    "2026-09-11": 47,
    "2026-09-13": 12,
  }, "non-date keys, negatives and zero are dropped");
});

test("isoOf renders the local calendar date", () => {
  const d = new Date(2026, 8, 11, 13, 5); // Sep 11 2026 local
  assert.equal(isoOf(d.getTime()), "2026-09-11");
});

test("weekMiles sums only the current Mon-Sun week", () => {
  const nowMs = Date.parse("2026-09-11T12:00:00");
  const monday = mondayOf(nowMs);
  const store = {
    [isoOf(monday)]: 30,
    [isoOf(monday + 2 * 24 * 60 * 60 * 1000)]: 40,
    [isoOf(monday - 24 * 60 * 60 * 1000)]: 999,
    [isoOf(monday + 7 * 24 * 60 * 60 * 1000)]: 999,
  };
  assert.equal(weekMiles(store, nowMs), 70, "last week and next week are excluded");
  assert.equal(mondayOf(nowMs), Date.parse("2026-09-07T00:00:00"), "the week starts on Monday");
});

test("setTodaysMiles records under today's local date and recomputes the week", () => {
  const nowMs = Date.parse("2026-09-11T12:00:00");
  const first = setTodaysMiles(47, nowMs);
  assert.equal(first.today, 47);
  assert.equal(first.store[isoOf(nowMs)], 47);
  assert.equal(first.week, 47);

  const plus = setTodaysMiles(56, nowMs);
  assert.equal(plus.today, 56, "updating today overwrites the previous record");
  assert.equal(plus.week, 56);
});

test("parses the shift day journal leniently", () => {
  assert.deepEqual(parseShiftDays(null), {});
  assert.deepEqual(parseShiftDays("{}"), {});
  assert.deepEqual(parseShiftDays('{"2026-09-11":{"earnings":130,"minutes":300}}'), {
    "2026-09-11": { earnings: 130, minutes: 300 },
  });
  assert.deepEqual(parseShiftDays('{"2026-09-10":{"earnings":0,"minutes":0},"2026-09-09":{"earnings":"12"}}'), {}, "zero-earnings days are dropped");
});

test("weekDays builds MON-SUN cells for the current week", () => {
  const nowMs = Date.parse("2026-09-11T12:00:00");
  const monday = mondayOf(nowMs);
  const journal = {
    [isoOf(monday)]: { earnings: 118, minutes: 340 },
    [isoOf(nowMs)]: { earnings: 130, minutes: 300 },
  };
  const cells = weekDays(journal, nowMs);
  assert.equal(cells.length, 7);
  assert.deepEqual(cells.map((cell) => cell.label), ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]);
  assert.equal(cells[0].date, isoOf(monday));
  assert.equal(cells[0].earnings, 118);
  const today = cells.find((cell) => cell.date === isoOf(nowMs));
  assert.ok(today);
  assert.equal(today.earnings, 130);
  assert.equal(cells.reduce((sum, cell) => sum + cell.earnings, 0), 248);
  assert.equal(cells.find((cell) => cell.earnings === 0).earnings, 0, "missing days default to zero");
});

test("rememberDay returns the updated journal without throwing outside a browser", () => {
  const journal = rememberDay("2026-09-11", 130, 300);
  assert.deepEqual(journal["2026-09-11"], { earnings: 130, minutes: 300 });
});