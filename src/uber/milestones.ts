import { UBER_CYCLE_PENCE } from "./progress.js";
import type { UberDashboard } from "./types.js";

export type EarningsMilestone = "daily" | "weekly" | "cycle" | "streak" | "micro" | null;
export type EarningsTransition = { 
  id: number; 
  cycleCrossed: boolean; 
  milestone: EarningsMilestone;
  candyText?: string;
  subText?: string;
  oldSquares: number;
  newSquares: number;
};

let currentStreak = 0;
let lastUpdateTimestamp = 0;

export function deriveEarningsTransition(before: UberDashboard, after: UberDashboard, id: number): EarningsTransition | null {
  if (before.today !== after.today || before.summary.weekStart !== after.summary.weekStart) return null;
  const increased = after.todayEarningsPence > before.todayEarningsPence;
  if (!increased) return null;
  
  const now = Date.now();
  if (now - lastUpdateTimestamp > 2 * 60 * 60 * 1000) {
    currentStreak = 1;
  } else {
    currentStreak += 1;
  }
  lastUpdateTimestamp = now;
  
  const segmentCrossed = Math.floor(after.todayEarningsPence / 500) > Math.floor(before.todayEarningsPence / 500);
  const cycleCrossed = Math.floor(after.todayEarningsPence / 2500) > Math.floor(before.todayEarningsPence / 2500);
  
  const weeklyTarget = after.summary.weeklyTargetPence;
  const weekly = weeklyTarget > 0 && before.summary.weeklyEarningsPence < weeklyTarget && after.summary.weeklyEarningsPence >= weeklyTarget;
  
  const dailyTarget = after.todayTargetPence;
  const daily = dailyTarget !== null && dailyTarget > 0 && before.todayEarningsPence < dailyTarget && after.todayEarningsPence >= dailyTarget;
  
  let milestone: EarningsMilestone = null;
  let candyText = "";
  let subText = "";

  if (weekly) {
    milestone = "weekly";
    candyText = "UNSTOPPABLE!";
    subText = "WEEKLY TARGET REACHED";
  } else if (daily) {
    milestone = "daily";
    candyText = "TARGET ACQUIRED!";
    subText = "DAILY GOAL CRUSHED";
  } else if (cycleCrossed) {
    milestone = "cycle";
    candyText = "CRUSHING IT!";
    subText = "BLOCK CLEARED";
  } else if (currentStreak > 1 && currentStreak % 3 === 0) {
    milestone = "streak";
    candyText = "ON FIRE!";
    subText = "STREAK:  RIDES";
  } else if (segmentCrossed && Math.random() > 0.5) {
    milestone = "micro";
    candyText = "SWEET!";
    subText = "KEEP IT UP";
  }
  
  return segmentCrossed || milestone ? { id, cycleCrossed: segmentCrossed, milestone, candyText, subText, oldSquares: Math.floor(before.todayEarningsPence / 500), newSquares: Math.floor(after.todayEarningsPence / 500) } : null;
}
