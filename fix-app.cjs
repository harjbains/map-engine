const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf8');
app = app.replace(
  /const savePlan = useCallback\(async \(weights: Array<WorkWeight \| null>\) => \{\s*const refreshed = await service\.saveCurrentWeekWeights\(weights, dashboard\?\.today\);/g,
  `const savePlan = useCallback(async (targetPence: number, weights: Array<WorkWeight | null>) => {
    const refreshed = await service.saveCurrentWeekPlan(targetPence, weights, dashboard?.today);`
);
fs.writeFileSync('src/App.tsx', app);
