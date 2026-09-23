export const CURRENT_TIME_WINDOW_MINUTES = 60;

export type PickupTimeLike = { time: string };

export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function pickupMinutesOfDay(record: PickupTimeLike): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(record.time);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 24 || minutes < 0 || minutes > 59 || !Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  return (hours * 60 + minutes) % 1440;
}

export function pickupMatchesWindow(record: PickupTimeLike, now: Date, windowMinutes = CURRENT_TIME_WINDOW_MINUTES): boolean {
  const pickupMinutes = pickupMinutesOfDay(record);
  if (pickupMinutes === null) return false;
  const nowMinutes = minutesOfDay(now);
  const difference = Math.abs(pickupMinutes - nowMinutes) % 1440;
  return Math.min(difference, 1440 - difference) <= windowMinutes;
}