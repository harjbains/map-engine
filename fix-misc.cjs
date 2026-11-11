const fs = require('fs');

// calculations.test.ts
let calcTest = fs.readFileSync('tests/calculations.test.ts', 'utf8');
calcTest = calcTest.replace(/workWeight: w,/g, 'workWeight: w, amTargetPence: w !== null ? 1000 : 0, pmTargetPence: 0,');
fs.writeFileSync('tests/calculations.test.ts', calcTest);

// preview.ts
let preview = fs.readFileSync('src/dashboard/preview.ts', 'utf8');
preview = preview.replace(/workWeight: "light" \| "normal" \| "heavy"/g, 'workWeight: "light" | "normal" | "heavy", amTargetPence: 5000, pmTargetPence: 0');
fs.writeFileSync('src/dashboard/preview.ts', preview);

// calculations.ts
let calc = fs.readFileSync('src/uber/calculations.ts', 'utf8');
calc = calc.replace(/export function deriveDashboardDays\([\s\S]*?\{[\s\S]*?return datesInWeek\(plan\.weekStart\)\.map\(\(date\) => \{[\s\S]*?const targetPence = dayPlan\?\.isWorking \? \(dailyTargets\.get\(date\) \?\? null\) : null;/m, `export function deriveDashboardDays(plan: WeekPlan, planDays: WeekPlanDay[], records: DayRecord[], today: LocalDate): DashboardDay[] {
  return datesInWeek(plan.weekStart).map((date) => {
    const dayPlan = planDays.find((d) => d.date === date);
    const record = records.find((r) => r.date === date);
    const isWorking = dayPlan?.isWorking ?? false;
    const targetPence = isWorking ? ((dayPlan?.amTargetPence ?? 0) + (dayPlan?.pmTargetPence ?? 0)) : null;`);
fs.writeFileSync('src/uber/calculations.ts', calc);

// local-repository.ts
let localRepo = fs.readFileSync('src/uber/local-repository.ts', 'utf8');
localRepo = localRepo.replace(/workWeight: "normal"/g, 'workWeight: "normal", amTargetPence: 5000, pmTargetPence: 5000');
localRepo = localRepo.replace(/workWeight: w ?? "normal"/g, 'workWeight: w ?? "normal", amTargetPence: w !== null ? 5000 : 0, pmTargetPence: w !== null ? 5000 : 0');
localRepo = localRepo.replace(/start_earnings_pence: startEarnings,/g, 'start_earnings_pence: startEarnings, shift_type: arguments[2] || "am",');
localRepo = localRepo.replace(/async saveAmPmPlan\(weekStart: LocalDate, amTargets: number\[\], pmTargets: number\[\]\): Promise<WeekPlanDay\[\]> \{[\s\S]*?\}/, `async saveAmPmPlan(weekStart: LocalDate, amTargets: number[], pmTargets: number[]): Promise<WeekPlanDay[]> { return []; }`);
fs.writeFileSync('src/uber/local-repository.ts', localRepo);
