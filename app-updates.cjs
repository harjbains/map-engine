const fs = require('fs');

let app = fs.readFileSync('src/App.tsx', 'utf8');

app = app.replace(/const savePlan = useCallback\(async \(targetPence: number, weights: Array<WorkWeight \| null>\) => \{[\s\S]*?\}, \[service, dashboard\]\);/, `const savePlan = useCallback(async (amTargets: number[], pmTargets: number[]) => {
    const refreshed = await service.saveAmPmPlan(amTargets, pmTargets, dashboard?.today);
    if (!refreshed) throw new Error("No current week plan exists");
    setDashboard(refreshed);
    return refreshed;
  }, [service, dashboard]);`);

app = app.replace(/const startShift = useCallback\(async \(startEarnings: number\) => \{[\s\S]*?\}, \[service, dashboard\]\);/, `const startShift = useCallback(async (shiftType: 'am' | 'pm', startEarnings: number) => {
    const refreshed = await service.startShift(shiftType, dashboard?.today, startEarnings);
    if (!refreshed) throw new Error("No current week plan exists");
    setDashboard(refreshed);
    return refreshed;
  }, [service, dashboard]);`);

fs.writeFileSync('src/App.tsx', app);
