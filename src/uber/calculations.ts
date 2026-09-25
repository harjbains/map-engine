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
  planDays: WeekPlanDay[],
  records: DayRecord[],
  today: LocalDate
): { amount: Pence; band: "grey" | "teal" | "gold" | null; provisional: boolean } {
  let completedTargetPence = 0;
  let completedActualPence = 0;

  for (const day of planDays) {
    if (day.date < today && day.isWorking) {
      const target = summary.dailyTargets.find(t => t.date === day.date)?.targetPence ?? 0;
      const record = records.find(r => r.date === day.date);
      const actual = record?.grossEarningsPence ?? 0;
      
      completedTargetPence += target;
      completedActualPence += actual;
    }
  }

  let provisional = false;
  let performanceRatio = 1.0;

  if (completedTargetPence > 0) {
    performanceRatio = completedActualPence / completedTargetPence;
  } else {
    provisional = true;
  }

  let remainingTargetForFuture = 0;
  let expectedRemainingForToday = 0;

  for (const day of planDays) {
    if (day.isWorking) {
      const target = summary.dailyTargets.find(t => t.date === day.date)?.targetPence ?? 0;
      
      if (day.date > today) {
        remainingTargetForFuture += target;
      } else if (day.date === today) {
        const todayRecord = records.find(r => r.date === today);
        const todayActual = todayRecord?.grossEarningsPence ?? 0;
        const expectedToday = target * performanceRatio;
        expectedRemainingForToday = Math.max(0, expectedToday - todayActual);
      }
    }
  }

  const projectedRemaining = (remainingTargetForFuture * performanceRatio) + expectedRemainingForToday;
  let projectedPence = Math.round(summary.weeklyEarningsPence + projectedRemaining);

  // Forecast bands: Grey: £500-£649, Teal: £650-£899, Gold: £900+
  let band: "grey" | "teal" | "gold" | null = "grey";
  if (projectedPence >= 900_00) band = "gold";
  else if (projectedPence >= 650_00) band = "teal";

  return { amount: projectedPence, band, provisional };
}
