import type { DayRecord, DayStatus, LocalDate, MilesTenths, Pence, WeekPlan, WeekPlanDay, WorkWeight, UberSession } from "./types.js";
import { datesInWeek, londonToday, weekStartForDate } from "./calendar.js";

const STORAGE_PREFIX = "map_engine_v3_";

export class LocalUberRepository {
  private getItem<T>(key: string, fallback: T): T {
    if (typeof window === "undefined" || !window.localStorage) return fallback;
    try {
      const val = window.localStorage.getItem(STORAGE_PREFIX + key);
      return val ? JSON.parse(val) : fallback;
    } catch {
      return fallback;
    }
  }

  private setItem<T>(key: string, value: T): void {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    } catch {
      // ignore storage quota errors
    }
  }

  async getWeekPlan(weekStart: LocalDate): Promise<WeekPlan | null> {
    const plans = this.getItem<Record<string, WeekPlan>>("plans", {});
    return plans[weekStart] ?? null;
  }

  async createWeekPlan(weekStart: LocalDate, weeklyTargetPence: Pence, workingDays: boolean[]): Promise<WeekPlan> {
    const plans = this.getItem<Record<string, WeekPlan>>("plans", {});
    const now = new Date().toISOString();
    const plan: WeekPlan = { weekStart, weeklyTargetPence, createdAt: now, updatedAt: now };
    plans[weekStart] = plan;
    this.setItem("plans", plans);

    const allDays = this.getItem<Record<string, WeekPlanDay[]>>("plan_days", {});
    const dates = datesInWeek(weekStart);
    allDays[weekStart] = dates.map((date, idx) => ({
      weekStart,
      date,
      isWorking: workingDays[idx] ?? false,
      workWeight: "normal",
      createdAt: now,
      updatedAt: now,
    }));
    this.setItem("plan_days", allDays);

    return plan;
  }

  async updateWeeklyTarget(weekStart: LocalDate, weeklyTargetPence: Pence): Promise<WeekPlan> {
    const plans = this.getItem<Record<string, WeekPlan>>("plans", {});
    const now = new Date().toISOString();
    const existing = plans[weekStart] || { weekStart, weeklyTargetPence, createdAt: now, updatedAt: now };
    existing.weeklyTargetPence = weeklyTargetPence;
    existing.updatedAt = now;
    plans[weekStart] = existing;
    this.setItem("plans", plans);
    return existing;
  }

  async getPlanDays(weekStart: LocalDate): Promise<WeekPlanDay[]> {
    const allDays = this.getItem<Record<string, WeekPlanDay[]>>("plan_days", {});
    if (allDays[weekStart]) return allDays[weekStart];
    const now = new Date().toISOString();
    const dates = datesInWeek(weekStart);
    const days: WeekPlanDay[] = dates.map((date) => ({
      weekStart,
      date,
      isWorking: true,
      workWeight: "normal",
      createdAt: now,
      updatedAt: now,
    }));
    allDays[weekStart] = days;
    this.setItem("plan_days", allDays);
    return days;
  }

  async saveWeekWeights(weekStart: LocalDate, weights: Array<WorkWeight | null>): Promise<WeekPlanDay[]> {
    const allDays = this.getItem<Record<string, WeekPlanDay[]>>("plan_days", {});
    const now = new Date().toISOString();
    const dates = datesInWeek(weekStart);
    const existingDays = allDays[weekStart] || [];
    const days: WeekPlanDay[] = dates.map((date, idx) => {
      const weight = weights[idx] ?? null;
      const isWorking = weight !== null;
      const workWeight = weight ?? "normal";
      const existing = existingDays.find((d) => d.date === date);
      return {
        weekStart,
        date,
        isWorking,
        workWeight,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
    });
    allDays[weekStart] = days;
    this.setItem("plan_days", allDays);
    return days;
  }

  async getDayRecordsForWeek(weekStart: LocalDate): Promise<DayRecord[]> {
    const records = this.getItem<Record<string, DayRecord>>("day_records", {});
    const dates = datesInWeek(weekStart);
    return dates.map((d) => records[d]).filter((r): r is DayRecord => Boolean(r));
  }

  async getDayRecord(date: LocalDate): Promise<DayRecord | null> {
    const records = this.getItem<Record<string, DayRecord>>("day_records", {});
    return records[date] ?? null;
  }

  async saveDayRecord(
    date: LocalDate,
    grossEarningsPence: Pence,
    businessMilesTenths: MilesTenths,
    trips: number,
    status: Exclude<DayStatus, "missed">
  ): Promise<DayRecord> {
    const records = this.getItem<Record<string, DayRecord>>("day_records", {});
    const now = new Date().toISOString();
    const existing = records[date];
    const updated: DayRecord = {
      date,
      grossEarningsPence,
      businessMilesTenths,
      trips,
      status,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    records[date] = updated;
    this.setItem("day_records", records);
    return updated;
  }

  currentWeekStart(): LocalDate {
    return weekStartForDate(londonToday());
  }

  async getSession(date: LocalDate): Promise<UberSession | null> {
    const sessions = this.getItem<Record<string, UberSession>>("sessions", {});
    return sessions[date] ?? null;
  }

  async getSessionsForWeek(weekStart: LocalDate): Promise<UberSession[]> {
    const sessions = this.getItem<Record<string, UberSession>>("sessions", {});
    const dates = datesInWeek(weekStart);
    return dates.map(d => sessions[d]).filter((s): s is UberSession => Boolean(s));
  }

  async startSession(date: LocalDate): Promise<UberSession> {
    const sessions = this.getItem<Record<string, UberSession>>("sessions", {});
    const now = new Date().toISOString();
    const existing = sessions[date];
    const session: UberSession = existing ? { ...existing, status: "active", lastResumedAt: now } : { date, status: "active", lastResumedAt: now, activeSeconds: 0 };
    sessions[date] = session;
    this.setItem("sessions", sessions);
    return session;
  }

  async pauseSession(date: LocalDate): Promise<UberSession> {
    const sessions = this.getItem<Record<string, UberSession>>("sessions", {});
    const existing = sessions[date];
    if (!existing || existing.status !== "active") return existing ?? { date, status: "paused", lastResumedAt: new Date().toISOString(), activeSeconds: 0 };
    const now = new Date();
    const elapsed = Math.floor((now.getTime() - new Date(existing.lastResumedAt).getTime()) / 1000);
    existing.activeSeconds += elapsed;
    existing.status = "paused";
    existing.lastResumedAt = now.toISOString();
    sessions[date] = existing;
    this.setItem("sessions", sessions);
    return existing;
  }

  async resumeSession(date: LocalDate): Promise<UberSession> {
    const sessions = this.getItem<Record<string, UberSession>>("sessions", {});
    const existing = sessions[date];
    if (!existing || existing.status !== "paused") return existing ?? { date, status: "active", lastResumedAt: new Date().toISOString(), activeSeconds: 0 };
    existing.status = "active";
    existing.lastResumedAt = new Date().toISOString();
    sessions[date] = existing;
    this.setItem("sessions", sessions);
    return existing;
  }

  async endSession(date: LocalDate): Promise<UberSession> {
    const sessions = this.getItem<Record<string, UberSession>>("sessions", {});
    const existing = sessions[date];
    if (!existing || existing.status === "completed") return existing ?? { date, status: "completed", lastResumedAt: new Date().toISOString(), activeSeconds: 0 };
    if (existing.status === "active") {
      const now = new Date();
      const elapsed = Math.floor((now.getTime() - new Date(existing.lastResumedAt).getTime()) / 1000);
      existing.activeSeconds += elapsed;
      existing.lastResumedAt = now.toISOString();
    }
    existing.status = "completed";
    sessions[date] = existing;
    this.setItem("sessions", sessions);
    return existing;
  }
}
