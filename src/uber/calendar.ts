import type { LocalDate } from "./types.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function assertLocalDate(value: string): asserts value is LocalDate {
  if (!ISO_DATE.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`Expected an ISO calendar date, received: ${value}`);
  }
}

/** Returns the Monday of a calendar date. No UTC instant is persisted or inferred. */
export function weekStartForDate(date: LocalDate): LocalDate {
  assertLocalDate(date);
  const [year, month, day] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(year!, month! - 1, day!));
  const mondayOffset = (utc.getUTCDay() + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - mondayOffset);
  return utc.toISOString().slice(0, 10) as LocalDate;
}

export function datesInWeek(weekStart: LocalDate): LocalDate[] {
  if (weekStartForDate(weekStart) !== weekStart) {
    throw new Error("weekStart must be a Monday");
  }
  const [year, month, day] = weekStart.split("-").map(Number);
  const start = Date.UTC(year!, month! - 1, day!);
  return Array.from({ length: 7 }, (_, offset) =>
    new Date(start + offset * 86_400_000).toISOString().slice(0, 10) as LocalDate,
  );
}

/** The current user-facing date in the agreed Europe/London calendar, attributing hours before 04:00 to the previous day. */
export function londonToday(now = new Date()): LocalDate {
  // Midnight roller: subtract 4 hours from the current UTC instant.
  // This causes 00:00 - 03:59 London time to fall into the previous day's calendar date.
  const adjusted = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(adjusted);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}` as LocalDate;
}
