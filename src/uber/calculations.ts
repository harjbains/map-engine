import { datesInWeek } from "./calendar.js";
import type { DailyTargetAllocation, DashboardDay, DayRecord, Pence, WeekPlan, WeekPlanDay, WeeklySummary, LocalDate } from "./types.js";

/**
 * Allocates whole pennies by integer half-weight units in Monday-to-Sunday order.
 * No target is allocated when no day is planned; that is a valid plan state.
 */
export function allocateDailyTargets(weeklyTargetPence: Pence, planDays: WeekPlanDay[]): DailyTargetAllocation[] {
  if (!Number.isInteger(weeklyTargetPence) || weeklyTargetPence < 0) throw new Error("weekly target must be non-negative pence");
  const planned = [...planDays].filter((day) => day.isWorking).sort((a, b) => a.date.localeCompare(b.date));
  if (planned.length === 0) return [];
  const units = { light: 3, normal: 4, heavy: 6 } as const;
  const totalUnits = planned.reduce((total, day) => total + units[day.workWeight], 0);
  let remainder = weeklyTargetPence;
  const allocations = planned.map((day) => {
    const targetPence = Math.floor(weeklyTargetPence * units[day.workWeight] / totalUnits);
    remainder -= targetPence;
    return { date: day.date, targetPence };
  });
  for (let index = 0; index < remainder; index++) allocations[index % allocations.length]!.targetPence++;
  return allocations;
}

export function deriveWeeklySummary(plan: WeekPlan, planDays: WeekPlanDay[], records: DayRecord[]): WeeklySummary {
  const dates = new Set(datesInWeek(plan.weekStart));
  const weekRecords = records.filter((record) => dates.has(record.date));
  const weeklyEarningsPence = weekRecords.reduce((total, record) => total + record.grossEarningsPence, 0);
  const weeklyMilesTenths = weekRecords.reduce((total, record) => total + record.businessMilesTenths, 0);
  return {
    weekStart: plan.weekStart,
    weeklyTargetPence: plan.weeklyTargetPence,
    weeklyEarningsPence,
    weeklyMilesTenths,
    remainingTargetPence: plan.weeklyTargetPence - weeklyEarningsPence,
    dailyTargets: allocateDailyTargets(plan.weeklyTargetPence, planDays.filter((day) => day.weekStart === plan.weekStart)),
  };
}

/** Builds display-ready facts from persisted plan/actual rows, without storing any derived values. */
export function deriveDashboardDays(plan: WeekPlan, planDays: WeekPlanDay[], records: DayRecord[]): DashboardDay[] {
  const targetByDate = new Map(allocateDailyTargets(plan.weeklyTargetPence, planDays).map((target) => [target.date, target.targetPence]));
  const planByDate = new Map(planDays.map((day) => [day.date, day]));
  const actualByDate = new Map(records.map((record) => [record.date, record]));
  return datesInWeek(plan.weekStart).map((date) => {
    const actual = actualByDate.get(date);
    const planDay = planByDate.get(date);
    return {
      date,
      isWorking: planDay?.isWorking ?? false,
      workWeight: planDay?.isWorking ? planDay.workWeight : null,
      actualPence: actual?.grossEarningsPence ?? null,
      actualMilesTenths: actual?.businessMilesTenths ?? null,
      targetPence: targetByDate.get(date) ?? null,
      status: actual?.status ?? "unrecorded",
    };
  });
}

/** 
 * Forecast uses actual weekly earnings, recorded working time (across all sessions in the week), 
 * and the remaining planned working time. Cap at £1200 as requested.
 */
export function calculateWeeklyForecast(
  summary: WeeklySummary,
  sessions: import("./types.js").UberSession[],
  planDays: WeekPlanDay[],
  records: DayRecord[],
  today: LocalDate
): { amount: Pence; band: "grey" | "teal" | "gold" | null } {
  let totalActiveSeconds = 0;
  
  // Calculate active seconds from all recorded sessions in the week
  for (const session of sessions) {
    let sessionSeconds = session.activeSeconds;
    if (session.status === "active") {
      const elapsed = Math.floor((new Date().getTime() - new Date(session.lastResumedAt).getTime()) / 1000);
      sessionSeconds += Math.max(0, elapsed);
    }
    totalActiveSeconds += sessionSeconds;
  }

  // Calculate planned units for days that haven't been completed yet
  // If today is working and session is active/paused, remaining time today + future days
  const units = { light: 3, normal: 4, heavy: 6 } as const;
  
  // Figure out remaining planned units.
  // A day is "completed" if it's in the past relative to `today`, or if its record says "completed".
  const planned = planDays.filter(day => day.isWorking);
  
  let remainingUnits = 0;
  for (const day of planned) {
    const record = records.find(r => r.date === day.date);
    if (day.date < today || record?.status === "completed" || record?.status === "missed") {
      continue;
    }
    
    // If it's today and we have a session, we should estimate remaining time.
    // For simplicity: if it's not completed, we count its full units towards "remaining potential"
    // EXCEPT, if it's today and we're partially through, we might want a fraction. 
    // But since `totalActiveSeconds` is what we have so far, and we are forecasting:
    // A simple approach: (Current Pence / Current Seconds) * (Total Planned Seconds)
    // How many seconds is one "unit"? Let's assume 1 "normal" (4 units) = 8 hours = 28800 seconds. 
    // So 1 unit = 2 hours = 7200 seconds.
    remainingUnits += units[day.workWeight];
  }
  
  // If no time worked yet, fallback to target
  let projectedPence = summary.weeklyTargetPence;
  
  if (totalActiveSeconds > 3600 && summary.weeklyEarningsPence > 0) {
    // Pence per second
    const pps = summary.weeklyEarningsPence / totalActiveSeconds;
    
    // Remaining planned seconds = remainingUnits * 7200
    const remainingSeconds = remainingUnits * 7200;
    
    projectedPence = summary.weeklyEarningsPence + Math.floor(pps * remainingSeconds);
  } else if (remainingUnits > 0) {
    // Not enough data to extrapolate, just use target
    projectedPence = summary.weeklyTargetPence;
  } else {
    // No remaining units, forecast is just what we earned
    projectedPence = summary.weeklyEarningsPence;
  }
  
  // Cap at £1200 (120,000 pence)
  projectedPence = Math.min(projectedPence, 120_000);

  // Forecast bands: Grey: £500-£600, Teal: £650-£850, Gold: £900-£1100
  let band: "grey" | "teal" | "gold" | null = null;
  if (projectedPence >= 900_00) band = "gold";
  else if (projectedPence >= 650_00) band = "teal";
  else if (projectedPence >= 500_00) band = "grey";

  return { amount: projectedPence, band };
}
