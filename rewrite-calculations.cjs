const fs = require('fs');

let file = fs.readFileSync('src/uber/calculations.ts', 'utf8');

// I will just replace everything from export function calculateWeeklyForecast to the end of the file.
const startIndex = file.indexOf('export function calculateWeeklyForecast');
if (startIndex !== -1) {
  file = file.substring(0, startIndex);
}

const newImplementation = `export function calculateWeeklyForecast(
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
`;

fs.writeFileSync('src/uber/calculations.ts', file + newImplementation);
