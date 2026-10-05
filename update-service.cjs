const fs = require('fs');

let file = fs.readFileSync('src/uber/service.ts', 'utf8');

// 1. Remove the forced reset to FIXED_WEEKLY_TARGET_PENCE
file = file.replace(
  /if \(\!existing\) \{\s*await this\.repository\.createWeekPlan\(weekStart, FIXED_WEEKLY_TARGET_PENCE, Array\(7\)\.fill\(false\) as boolean\[\]\);\s*\} else if \(existing\.weeklyTargetPence !== FIXED_WEEKLY_TARGET_PENCE\) \{\s*await this\.repository\.updateWeeklyTarget\(weekStart, FIXED_WEEKLY_TARGET_PENCE\);\s*\}/gm,
  `if (!existing) {
      await this.repository.createWeekPlan(weekStart, FIXED_WEEKLY_TARGET_PENCE, Array(7).fill(false) as boolean[]);
    }`
);

// 2. Change saveCurrentWeekWeights to saveCurrentWeekPlan
file = file.replace(
  /async saveCurrentWeekWeights\(weights: Array<WorkWeight \| null>, today = londonToday\(\)\): Promise<UberDashboard \| null> \{\s*await this\.repository\.saveWeekWeights\(weekStartForDate\(today\), weights\);\s*return this\.getDashboard\(today\);\s*\}/g,
  `async saveCurrentWeekPlan(targetPence: number, weights: Array<WorkWeight | null>, today = londonToday()): Promise<UberDashboard | null> {
    const weekStart = weekStartForDate(today);
    await this.repository.updateWeeklyTarget(weekStart, targetPence);
    await this.repository.saveWeekWeights(weekStart, weights);
    return this.getDashboard(today);
  }`
);

// 3. In getDashboard, when generating a dummy plan, maybe it doesn't matter because plan is checked via repository.
// Wait, I should ensure `getDashboard` doesn't enforce FIXED_WEEKLY_TARGET_PENCE if a plan exists!
// Actually, earlier I saw:
// if (plan) { planDays = ... } else { plan = { weekStart, weeklyTargetPence: FIXED_WEEKLY_TARGET_PENCE ... } }
// This is fine.

fs.writeFileSync('src/uber/service.ts', file);
