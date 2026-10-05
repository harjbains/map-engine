const fs = require('fs');

let file = fs.readFileSync('src/App.tsx', 'utf8');

const shiftMethods = `
  const startShift = useCallback(async (startEarnings: number) => {
    const refreshed = await service.startShift(dashboard?.today, startEarnings);
    if (!refreshed) throw new Error("No current week plan exists");
    setDashboard(refreshed);
    return refreshed;
  }, [service, dashboard]);

  const endShift = useCallback(async (shiftId: string, endEarnings: number) => {
    const refreshed = await service.endShift(shiftId, dashboard?.today, endEarnings);
    if (!refreshed) throw new Error("No current week plan exists");
    setDashboard(refreshed);
    return refreshed;
  }, [service, dashboard]);
`;

file = file.replace(/const startSession = useCallback[\s\S]*?const endSession = useCallback.*?\n.*?return refreshed;\n\s*\}, \[service, dashboard\]\);/s, shiftMethods);

file = file.replace(/onStartSession=\{startSession\}[\s\S]*?onEndSession=\{endSession\}/s, `onStartShift={startShift} onEndShift={endShift}`);

fs.writeFileSync('src/App.tsx', file);
