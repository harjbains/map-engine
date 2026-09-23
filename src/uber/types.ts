/** Calendar-only ISO date interpreted in the Europe/London business calendar. */
export type LocalDate = `${number}-${number}-${number}`;
export type DayStatus = "working" | "completed" | "missed";
export type WorkWeight = "light" | "normal" | "heavy";
export const FIXED_WEEKLY_TARGET_PENCE = 75_000;

/** Integer minor units avoid floating-point money errors. */
export type Pence = number;
/** Integer tenths of a business mile avoid floating-point mileage errors. */
export type MilesTenths = number;

export type SessionStatus = "active" | "paused" | "completed";

export interface UberSession {
  date: LocalDate;
  status: SessionStatus;
  lastResumedAt: string;
  activeSeconds: number;
}

export interface WeekPlan {
  weekStart: LocalDate;
  weeklyTargetPence: Pence;
  createdAt: string;
  updatedAt: string;
}

export interface WeekPlanDay {
  weekStart: LocalDate;
  date: LocalDate;
  isWorking: boolean;
  workWeight: WorkWeight;
  createdAt: string;
  updatedAt: string;
}

export interface DayRecord {
  date: LocalDate;
  grossEarningsPence: Pence;
  businessMilesTenths: MilesTenths;
  trips: number;
  status: DayStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DailyTargetAllocation {
  date: LocalDate;
  targetPence: Pence;
}

export interface WeeklySummary {
  weekStart: LocalDate;
  weeklyTargetPence: Pence;
  weeklyEarningsPence: Pence;
  weeklyMilesTenths: MilesTenths;
  remainingTargetPence: Pence;
  dailyTargets: DailyTargetAllocation[];
}

export interface DashboardDay {
  date: LocalDate;
  isWorking: boolean;
  workWeight: WorkWeight | null;
  actualPence: Pence | null;
  actualMilesTenths: number | null;
  targetPence: Pence | null;
  status: DayStatus | "unrecorded";
}

export interface UberDashboard {
  today: LocalDate;
  summary: WeeklySummary;
  todayEarningsPence: Pence;
  todayMilesTenths: MilesTenths;
  todayTargetPence: Pence | null;
  todayTrips: number;
  aheadBehindPence: Pence | null;
  weeklyForecastPence: Pence | null;
  forecastBand: "grey" | "teal" | "gold" | null;
  session: UberSession | null;
  days: DashboardDay[];
}
