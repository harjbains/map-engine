const fs = require('fs');
let svc = fs.readFileSync('src/uber/service.ts', 'utf8');

// Replace saveCurrentWeekPlan
const newSave = `
  async saveAmPmPlan(amTargets: number[], pmTargets: number[], today = londonToday()): Promise<UberDashboard | null> {
    const weekStart = weekStartForDate(today);
    const sumPence = [...amTargets, ...pmTargets].reduce((a, b) => a + b, 0);
    await this.repository.updateWeeklyTarget(weekStart, sumPence);
    await this.repository.saveAmPmPlan(weekStart, amTargets, pmTargets);
    return this.getDashboard(today);
  }
`;
svc = svc.replace(/async saveCurrentWeekPlan[\s\S]*?return this\.getDashboard\(today\);\n  \}/, newSave);

// Update startShift
svc = svc.replace(/async startShift\(today = londonToday\(\), startEarnings = 0\):/, "async startShift(shiftType: 'am' | 'pm', today = londonToday(), startEarnings = 0):");
svc = svc.replace(/await this\.repository\.startShift\(today, startEarnings\);/, "await this.repository.startShift(today, startEarnings, shiftType);");

// Also add to constructor Pick
svc = svc.replace(/"updateWeeklyTarget" \| "saveWeekWeights"/, '"updateWeeklyTarget" | "saveWeekWeights" | "saveAmPmPlan"');

fs.writeFileSync('src/uber/service.ts', svc);
