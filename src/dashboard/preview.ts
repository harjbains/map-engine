import { deriveDashboardDays, deriveWeeklySummary } from "../uber/calculations.js";
import type { UberDashboard, WeekPlan, WeekPlanDay, DayRecord, LocalDate } from "../uber/types.js";

/** Visual-only fallback for local development when no Supabase browser config exists. */
export function dashboardPreview(): UberDashboard {
  const plan: WeekPlan = { weekStart: "2026-09-14", weeklyTargetPence: 75_000, createdAt: "", updatedAt: "" };
  const planDays: WeekPlanDay[] = ["14", "15", "16", "17", "18", "19", "20"].map((day, index) => ({ weekStart: plan.weekStart, date: `2026-09-${day}` as LocalDate, isWorking: true, workWeight: index === 1 || index === 6 ? "light" : index === 4 || index === 5 ? "heavy" : "normal", createdAt: "", updatedAt: "" }));
  const records: DayRecord[] = [
    ["2026-09-14", 7_840, 124, "completed"], ["2026-09-15", 5_600, 91, "completed"], ["2026-09-16", 7_200, 143, "completed"], ["2026-09-17", 6_400, 124, "working"], ["2026-09-18", 8_600, 0, "unrecorded"],
  ].filter((row) => row[3] !== "unrecorded").map(([date, grossEarningsPence, businessMilesTenths, status]) => ({ date: date as DayRecord["date"], grossEarningsPence: grossEarningsPence as number, businessMilesTenths: businessMilesTenths as number, trips: 7, status: status as DayRecord["status"], createdAt: "", updatedAt: "" }));
  const summary = deriveWeeklySummary(plan, planDays, records);
  const today = "2026-09-17" as const;
  const todayRecord = records.find((record) => record.date === today)!;
  const todayTargetPence = summary.dailyTargets.find((target) => target.date === today)!.targetPence;
  return { today, summary, todayEarningsPence: todayRecord.grossEarningsPence, todayMilesTenths: todayRecord.businessMilesTenths, todayTargetPence, aheadBehindPence: todayRecord.grossEarningsPence - todayTargetPence, todayTrips: 5, weeklyForecastPence: 650_00, forecastBand: 'teal', session: null, days: deriveDashboardDays(plan, planDays, records) };
}
