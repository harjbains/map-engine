import { datesInWeek } from "./calendar.js";
import type { DailyTargetAllocation, DashboardDay, DayRecord, Pence, WeekPlan, WeekPlanDay, WeeklySummary, LocalDate } from "./types.js";

/** Map-Engine working week boundary is 04:00. */
export function londonWorkingDay(now = new Date()): LocalDate {
  const d = new Date(now);
  d.setUTCMinutes(d.getUTCMinutes() - d.getTimezoneOffset());
  if (d.getUTCHours() < 4) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d.toISOString().slice(0, 10) as LocalDate;
}

export function allocateDailyTargets(weeklyTargetPence: Pence, planDays: WeekPlanDay[]): DailyTargetAllocation[] {
  // We no longer allocate weights. The target is just the explicit sum of AM + PM for each day.
  return planDays.map(day => ({
    date: day.date,
    targetPence: (day.amTargetPence ?? 0) + (day.pmTargetPence ?? 0)
  }));
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

export function deriveDashboardDays(plan: WeekPlan, planDays: WeekPlanDay[], records: DayRecord[]): DashboardDay[] {
  const targetByDate = new Map(allocateDailyTargets(plan.weeklyTargetPence, planDays).map((target) => [target.date, target.targetPence]));
  const planByDate = new Map(planDays.map((day) => [day.date, day]));
  const actualByDate = new Map(records.map((record) => [record.date, record]));
  return datesInWeek(plan.weekStart).map((date) => {
    const actual = actualByDate.get(date);
    const planDay = planByDate.get(date);
    const isWorking = planDay?.isWorking ?? false;
    return {
      date,
      isWorking,
      workWeight: isWorking ? planDay!.workWeight : null,
      amTargetPence: planDay?.amTargetPence ?? 0,
      pmTargetPence: planDay?.pmTargetPence ?? 0,
      actualPence: actual?.grossEarningsPence ?? null,
      actualMilesTenths: actual?.businessMilesTenths ?? null,
      targetPence: targetByDate.get(date) ?? null,
      status: actual?.status ?? "unrecorded",
    };
  });
}

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
  if (completedTargetPence > 0) performanceRatio = completedActualPence / completedTargetPence;
  else provisional = true;

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

  let band: "grey" | "teal" | "gold" | null = "grey";
  if (projectedPence >= 900_00) band = "gold";
  else if (projectedPence >= 650_00) band = "teal";

  return { amount: projectedPence, band, provisional };
}
