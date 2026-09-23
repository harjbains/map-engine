import type { V3SupabaseClient } from "../supabase/client.js";
import type { Database } from "../supabase/database.types.js";
import { londonToday, weekStartForDate } from "./calendar.js";
import { gbpFromPence, milesFromTenths, penceFromGbp, tenthsFromMiles } from "./money.js";
import type { DayRecord, DayStatus, LocalDate, MilesTenths, Pence, WeekPlan, WeekPlanDay, WorkWeight, UberSession } from "./types.js";

type PlanRow = Database["public"]["Tables"]["uber_week_plans"]["Row"];
type PlanDayRow = Database["public"]["Tables"]["uber_week_plan_days"]["Row"];
type DayRecordRow = Database["public"]["Tables"]["uber_day_records"]["Row"];
type SessionRow = Database["public"]["Tables"]["uber_sessions"]["Row"];

const planFromRow = (row: PlanRow): WeekPlan => ({ weekStart: row.week_start as LocalDate, weeklyTargetPence: penceFromGbp(row.weekly_target), createdAt: row.created_at, updatedAt: row.updated_at });
const planDayFromRow = (row: PlanDayRow): WeekPlanDay => ({ weekStart: row.week_start as LocalDate, date: row.date as LocalDate, isWorking: row.is_working, workWeight: row.work_weight, createdAt: row.created_at, updatedAt: row.updated_at });
const recordFromRow = (row: DayRecordRow): DayRecord => ({ date: row.date as LocalDate, grossEarningsPence: penceFromGbp(row.gross_earnings), businessMilesTenths: tenthsFromMiles(row.business_miles), trips: row.trips, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at });
const sessionFromRow = (row: SessionRow): UberSession => ({ date: row.date as LocalDate, status: row.status, lastResumedAt: row.last_resumed_at, activeSeconds: row.active_seconds });

function throwOnError<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error("Supabase returned no data");
  return result.data;
}

export class UberRepository {
  constructor(private readonly client: V3SupabaseClient) {}

  async createWeekPlan(weekStart: LocalDate, weeklyTargetPence: Pence, workingDays: boolean[]): Promise<WeekPlan> {
    if (workingDays.length !== 7) throw new Error("workingDays must contain Monday through Sunday");
    const result = await this.client.rpc("create_uber_week_plan", { p_week_start: weekStart, p_weekly_target: Number(gbpFromPence(weeklyTargetPence)), p_working_days: workingDays });
    return planFromRow(throwOnError(result));
  }

  async updateWeeklyTarget(weekStart: LocalDate, weeklyTargetPence: Pence): Promise<WeekPlan> {
    const result = await this.client.rpc("set_uber_weekly_target", { p_week_start: weekStart, p_weekly_target: Number(gbpFromPence(weeklyTargetPence)) });
    return planFromRow(throwOnError(result));
  }

  async setPlanDay(weekStart: LocalDate, date: LocalDate, isWorking: boolean): Promise<WeekPlanDay> {
    const result = await this.client.rpc("set_uber_week_plan_day", { p_week_start: weekStart, p_date: date, p_is_working: isWorking });
    return planDayFromRow(throwOnError(result));
  }

  async saveWeekWeights(weekStart: LocalDate, weights: Array<WorkWeight | null>): Promise<WeekPlanDay[]> {
    if (weights.length !== 7) throw new Error("weights must contain Monday through Sunday");
    const result = await this.client.rpc("set_uber_week_plan_weights", { p_week_start: weekStart, p_weights: weights });
    return throwOnError(result).map(planDayFromRow);
  }

  async saveDayRecord(date: LocalDate, grossEarningsPence: Pence, businessMilesTenths: MilesTenths, trips: number, status: Exclude<DayStatus, "missed">): Promise<DayRecord> {
    const result = await this.client.rpc("upsert_uber_day_record", { p_date: date, p_gross_earnings: Number(gbpFromPence(grossEarningsPence)), p_business_miles: Number(milesFromTenths(businessMilesTenths)), p_trips: trips, p_status: status });
    return recordFromRow(throwOnError(result));
  }

  async markDayMissed(date: LocalDate): Promise<DayRecord> {
    const result = await this.client.rpc("mark_uber_day_missed", { p_date: date });
    return recordFromRow(throwOnError(result));
  }

  async getWeekPlan(weekStart: LocalDate): Promise<WeekPlan | null> {
    const result = await this.client.from("uber_week_plans").select("*").eq("week_start", weekStart).maybeSingle();
    if (result.error) throw new Error(result.error.message);
    return result.data ? planFromRow(result.data) : null;
  }

  async getPlanDays(weekStart: LocalDate): Promise<WeekPlanDay[]> {
    const result = await this.client.from("uber_week_plan_days").select("*").eq("week_start", weekStart).order("date");
    if (result.error) throw new Error(result.error.message);
    return (result.data ?? []).map(planDayFromRow);
  }

  async getDayRecordsForWeek(weekStart: LocalDate): Promise<DayRecord[]> {
    const endDate = new Date(`${weekStart}T00:00:00Z`);
    endDate.setUTCDate(endDate.getUTCDate() + 6);
    const result = await this.client.from("uber_day_records").select("*").gte("date", weekStart).lte("date", endDate.toISOString().slice(0, 10)).order("date");
    if (result.error) throw new Error(result.error.message);
    return (result.data ?? []).map(recordFromRow);
  }

  async getDayRecord(date: LocalDate): Promise<DayRecord | null> {
    const result = await this.client.from("uber_day_records").select("*").eq("date", date).maybeSingle();
    if (result.error) throw new Error(result.error.message);
    return result.data ? recordFromRow(result.data) : null;
  }

  currentWeekStart(): LocalDate { return weekStartForDate(londonToday()); }

  async getSession(date: LocalDate): Promise<UberSession | null> {
    const result = await this.client.rpc("get_uber_session", { p_date: date }).maybeSingle();
    if (result.error) throw new Error(result.error.message);
    return result.data ? sessionFromRow(result.data) : null;
  }

  async getSessionsForWeek(weekStart: LocalDate): Promise<UberSession[]> {
    const endDate = new Date(`${weekStart}T00:00:00Z`);
    endDate.setUTCDate(endDate.getUTCDate() + 6);
    const result = await this.client.from("uber_sessions").select("*").gte("date", weekStart).lte("date", endDate.toISOString().slice(0, 10)).order("date");
    if (result.error) throw new Error(result.error.message);
    return (result.data ?? []).map(sessionFromRow);
  }

  async startSession(date: LocalDate): Promise<UberSession> {
    const result = await this.client.rpc("start_uber_session", { p_date: date });
    return sessionFromRow(throwOnError(result));
  }

  async pauseSession(date: LocalDate): Promise<UberSession> {
    const result = await this.client.rpc("pause_uber_session", { p_date: date });
    return sessionFromRow(throwOnError(result));
  }

  async resumeSession(date: LocalDate): Promise<UberSession> {
    const result = await this.client.rpc("resume_uber_session", { p_date: date });
    return sessionFromRow(throwOnError(result));
  }

  async endSession(date: LocalDate): Promise<UberSession> {
    const result = await this.client.rpc("end_uber_session", { p_date: date });
    return sessionFromRow(throwOnError(result));
  }
}
