const fs = require('fs');

let file = fs.readFileSync('src/uber/service.ts', 'utf8');

// Replace saveCurrentWeekWeights
file = file.replace(
  /async saveCurrentWeekWeights\(weights: Array<WorkWeight \| null>, today = londonToday\(\)\): Promise<UberDashboard \| null> \{\s*await this\.repository\.saveWeekWeights\(weekStartForDate\(today\), weights\);\s*return this\.getDashboard\(today\);\s*\}/g,
  `async saveCurrentWeekPlan(targetPence: number, weights: Array<WorkWeight | null>, today = londonToday()): Promise<UberDashboard | null> {
    const weekStart = weekStartForDate(today);
    await this.repository.updateWeeklyTarget(weekStart, targetPence);
    await this.repository.saveWeekWeights(weekStart, weights);
    return this.getDashboard(today);
  }`
);

fs.writeFileSync('src/uber/service.ts', file);
