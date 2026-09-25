import { deriveDashboardDays, deriveWeeklySummary, calculateWeeklyForecast } from "./calculations.js";
import { londonToday, weekStartForDate } from "./calendar.js";
import type { UberRepository } from "./repository.js";
import { FIXED_WEEKLY_TARGET_PENCE, type LocalDate, type UberDashboard, type WeeklySummary, type WorkWeight, type WeekPlanDay, type DayRecord, type UberSession } from "./types.js";

/** Read composition only; all writes stay in the approved repository RPCs. */
export class UberWeekService {
  constructor(private readonly repository: Pick<UberRepository, "getWeekPlan" | "getPlanDays" | "getDayRecordsForWeek" | "getDayRecord" | "saveDayRecord" | "createWeekPlan" | "updateWeeklyTarget" | "saveWeekWeights" | "getSession" | "getSessionsForWeek" | "startSession" | "pauseSession" | "resumeSession" | "endSession">) {}

  /** Only the current week is initialized or brought to the fixed V3 target. */
  async initializeCurrentWeek(today = londonToday()): Promise<void> {
    const weekStart = weekStartForDate(today);
    const existing = await this.repository.getWeekPlan(weekStart);
    if (!existing) {
      await this.repository.createWeekPlan(weekStart, FIXED_WEEKLY_TARGET_PENCE, Array(7).fill(false) as boolean[]);
    } else if (existing.weeklyTargetPence !== FIXED_WEEKLY_TARGET_PENCE) {
      await this.repository.updateWeeklyTarget(weekStart, FIXED_WEEKLY_TARGET_PENCE);
    }
  }

  async getWeeklyHistory(currentWeek = weekStartForDate(londonToday()), count = 8): Promise<WeeklySummary[]> {
    const starts = Array.from({ length: count }, (_, offset) => {
      const date = new Date(`${currentWeek}T12:00:00Z`);
      date.setUTCDate(date.getUTCDate() - offset * 7);
      return date.toISOString().slice(0, 10) as LocalDate;
    });
    const summaries = await Promise.all(starts.map((start) => this.getWeeklySummary(start)));
    return summaries.filter((summary): summary is WeeklySummary => summary !== null);
  }

  async saveCurrentWeekWeights(weights: Array<WorkWeight | null>, today = londonToday()): Promise<UberDashboard | null> {
    await this.repository.saveWeekWeights(weekStartForDate(today), weights);
    return this.getDashboard(today);
  }

  async getWeeklySummary(weekStart: LocalDate): Promise<WeeklySummary | null> {
    const plan = await this.repository.getWeekPlan(weekStart);
    if (!plan) return null;
    const [planDays, records] = await Promise.all([
      this.repository.getPlanDays(weekStart),
      this.repository.getDayRecordsForWeek(weekStart),
    ]);
    return deriveWeeklySummary(plan, planDays, records);
  }

  async getDashboard(today = londonToday()): Promise<UberDashboard | null> {
    const weekStart = weekStartForDate(today);
    let plan = await this.repository.getWeekPlan(weekStart);
    let planDays: WeekPlanDay[] = [];
    let records: DayRecord[] = await this.repository.getDayRecordsForWeek(weekStart);
    
    if (plan) {
      planDays = await this.repository.getPlanDays(weekStart);
    } else {
      plan = { weekStart, weeklyTargetPence: FIXED_WEEKLY_TARGET_PENCE, createdAt: "", updatedAt: "" };
    }
    
    const summary = deriveWeeklySummary(plan, planDays, records);
    const days = deriveDashboardDays(plan, planDays, records);
    const sessions = await this.repository.getSessionsForWeek(weekStart);
    const forecast = calculateWeeklyForecast(summary, planDays, records, today);
    const todayDay = days.find((day) => day.date === today);
    const todayRecord = records.find((record) => record.date === today);
    const todayEarningsPence = todayRecord?.grossEarningsPence ?? 0;
    const todayTargetPence = todayDay?.targetPence ?? null;
    return {
      today,
      summary,
      todayEarningsPence,
      todayMilesTenths: todayRecord?.businessMilesTenths ?? 0,
      todayTargetPence,
      todayTrips: todayRecord?.trips ?? 0,
      aheadBehindPence: todayTargetPence === null ? null : todayEarningsPence - todayTargetPence,
      weeklyForecastPence: forecast.amount,
      provisionalForecast: forecast.provisional,
      forecastBand: forecast.band,
      session: sessions.find(s => s.date === today) ?? null,
      days,
    };
  }

  /** One approved mutation: changes only today's earnings and preserves today's other actuals. */
  async saveTodayEarnings(previewPence: number, today = londonToday()): Promise<UberDashboard | null> {
    if (!Number.isInteger(previewPence) || previewPence < 0) throw new Error("Preview earnings must be non-negative whole pence");
    const existing = await this.repository.getDayRecord(today);
    const status = existing?.status === "missed" ? "completed" : existing?.status ?? "working";
    
    let newTrips = existing?.trips ?? 0;
    if (previewPence > (existing?.grossEarningsPence ?? 0)) {
      newTrips += 1;
    }

    await this.repository.saveDayRecord(
      today,
      previewPence,
      existing?.businessMilesTenths ?? 0,
      newTrips,
      status,
    );
    return this.getDashboard(today);
  }

  async saveTodayMileage(milesTenths: number, today = londonToday()): Promise<UberDashboard | null> {
    if (!Number.isInteger(milesTenths) || milesTenths < 0) throw new Error("Mileage must be non-negative tenths of a mile");
    const existing = await this.repository.getDayRecord(today);
    if (existing?.status === "missed" && milesTenths === 0) return this.getDashboard(today);
    await this.repository.saveDayRecord(today, existing?.grossEarningsPence ?? 0, milesTenths, existing?.trips ?? 0,
      existing?.status === "missed" ? "completed" : existing?.status ?? "working");
    return this.getDashboard(today);
  }

  async startSession(today = londonToday()): Promise<UberDashboard | null> {
    await this.repository.startSession(today);
    return this.getDashboard(today);
  }

  async pauseSession(today = londonToday()): Promise<UberDashboard | null> {
    await this.repository.pauseSession(today);
    return this.getDashboard(today);
  }

  async resumeSession(today = londonToday()): Promise<UberDashboard | null> {
    await this.repository.resumeSession(today);
    return this.getDashboard(today);
  }

  async endSession(today = londonToday()): Promise<UberDashboard | null> {
    await this.repository.endSession(today);
    return this.getDashboard(today);
  }
}
