const fs = require('fs');

let repo = fs.readFileSync('src/uber/repository.ts', 'utf8');

const newMethod = `
  async saveAmPmPlan(weekStart: LocalDate, amTargets: number[], pmTargets: number[]): Promise<WeekPlanDay[]> {
    if (amTargets.length !== 7 || pmTargets.length !== 7) throw new Error("targets must contain Monday through Sunday");
    const result = await this.client.rpc("set_uber_week_plan_am_pm_targets", { p_week_start: weekStart, p_am_targets: amTargets, p_pm_targets: pmTargets });
    return throwOnError(result).map(planDayFromRow);
  }
`;

repo = repo.replace(/async saveWeekWeights/, newMethod + '\n  async saveWeekWeights');

// Also update startShift to take shiftType
repo = repo.replace(/async startShift\(date: LocalDate, startEarnings: number\)/, "async startShift(date: LocalDate, startEarnings: number, shiftType: 'am' | 'pm')");
repo = repo.replace(/start_earnings_pence: startEarnings,/g, "start_earnings_pence: startEarnings,\n      shift_type: shiftType,");

fs.writeFileSync('src/uber/repository.ts', repo);
