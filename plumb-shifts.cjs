const fs = require('fs');

// 1. Update repository.ts
let repo = fs.readFileSync('src/uber/repository.ts', 'utf8');
const repoUpdates = `
  async updateShift(shiftId: string, updates: { startTimestamp?: string, endTimestamp?: string, startEarningsPence?: number, endEarningsPence?: number }): Promise<any> {
    const patch: any = {};
    if (updates.startTimestamp !== undefined) patch.start_timestamp = updates.startTimestamp;
    if (updates.endTimestamp !== undefined) patch.end_timestamp = updates.endTimestamp;
    if (updates.startEarningsPence !== undefined) patch.start_earnings_pence = updates.startEarningsPence;
    if (updates.endEarningsPence !== undefined) patch.end_earnings_pence = updates.endEarningsPence;
    
    const result = await this.client.from("uber_shifts").update(patch).eq("id", shiftId).select().single();
    if (result.error) throw new Error(result.error.message);
    return result.data;
  }

  async deleteShift(shiftId: string): Promise<void> {
    const result = await this.client.from("uber_shifts").delete().eq("id", shiftId);
    if (result.error) throw new Error(result.error.message);
  }
`;
repo = repo.replace(/async startSession/g, repoUpdates + '\n  async startSession');
fs.writeFileSync('src/uber/repository.ts', repo);

// 2. Update service.ts
let svc = fs.readFileSync('src/uber/service.ts', 'utf8');
svc = svc.replace(/"startShift" \| "endShift">\) \{\}/, '"startShift" | "endShift" | "updateShift" | "deleteShift">) {}');
const svcUpdates = `
  async updateShift(shiftId: string, updates: { startTimestamp?: string, endTimestamp?: string, startEarningsPence?: number, endEarningsPence?: number }, today = londonToday()): Promise<UberDashboard | null> {
    await this.repository.updateShift(shiftId, updates);
    return this.getDashboard(today);
  }

  async deleteShift(shiftId: string, today = londonToday()): Promise<UberDashboard | null> {
    await this.repository.deleteShift(shiftId);
    return this.getDashboard(today);
  }
`;
svc = svc.replace(/async startSession/g, svcUpdates + '\n  async startSession');
fs.writeFileSync('src/uber/service.ts', svc);

// 3. Update App.tsx
let app = fs.readFileSync('src/App.tsx', 'utf8');
const appUpdates = `
  const updateShift = useCallback(async (shiftId: string, updates: { startTimestamp?: string, endTimestamp?: string, startEarningsPence?: number, endEarningsPence?: number }) => {
    const refreshed = await service.updateShift(shiftId, updates, dashboard?.today);
    if (!refreshed) throw new Error("No current week plan exists");
    setDashboard(refreshed);
    return refreshed;
  }, [service, dashboard]);

  const deleteShift = useCallback(async (shiftId: string) => {
    const refreshed = await service.deleteShift(shiftId, dashboard?.today);
    if (!refreshed) throw new Error("No current week plan exists");
    setDashboard(refreshed);
    return refreshed;
  }, [service, dashboard]);
`;
app = app.replace(/const startShift =/g, appUpdates + '\n  const startShift =');
app = app.replace(/onStartShift=\{startShift\} onEndShift=\{endShift\}/g, `onStartShift={startShift} onEndShift={endShift} onUpdateShift={updateShift} onDeleteShift={deleteShift}`);
fs.writeFileSync('src/App.tsx', app);

// 4. Update MapEngine.tsx
let me = fs.readFileSync('src/ported-map/MapEngine.tsx', 'utf8');
me = me.replace(/onSignOut, onStartShift, onEndShift, transition \}: \{/, `onSignOut, onStartShift, onEndShift, onUpdateShift, onDeleteShift, transition }: {`);
me = me.replace(/onEndShift: \(shiftId: string, endEarnings: number\) => Promise<UberDashboard>;/, `onEndShift: (shiftId: string, endEarnings: number) => Promise<UberDashboard>;\n  onUpdateShift?: (shiftId: string, updates: any) => Promise<UberDashboard>;\n  onDeleteShift?: (shiftId: string) => Promise<UberDashboard>;`);
me = me.replace(/onStartShift=\{onStartShift\} onEndShift=\{onEndShift\}/, `onStartShift={onStartShift} onEndShift={onEndShift} onUpdateShift={onUpdateShift} onDeleteShift={onDeleteShift}`);
fs.writeFileSync('src/ported-map/MapEngine.tsx', me);

// 5. Update V3UberOverlay.tsx
let overlay = fs.readFileSync('src/map/V3UberOverlay.tsx', 'utf8');
overlay = overlay.replace(/onSignOut, onStartShift, onEndShift, transition, darkMode, onToggleDarkMode \}: \{/, `onSignOut, onStartShift, onEndShift, onUpdateShift, onDeleteShift, transition, darkMode, onToggleDarkMode }: {`);
overlay = overlay.replace(/onEndShift: \(shiftId: string, endEarnings: number\) => Promise<UberDashboard>;/, `onEndShift: (shiftId: string, endEarnings: number) => Promise<UberDashboard>;\n  onUpdateShift?: (shiftId: string, updates: any) => Promise<UberDashboard>;\n  onDeleteShift?: (shiftId: string) => Promise<UberDashboard>;`);
overlay = overlay.replace(/<ShiftHistoryPanel darkMode=\{darkMode\} dashboard=\{dashboard\} onClose=\{/g, `<ShiftHistoryPanel darkMode={darkMode} dashboard={dashboard} onUpdateShift={onUpdateShift} onDeleteShift={onDeleteShift} onClose={`);
fs.writeFileSync('src/map/V3UberOverlay.tsx', overlay);

