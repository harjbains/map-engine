const fs = require('fs');
let c = fs.readFileSync('src/map/V3UberOverlay.tsx', 'utf8');

c = c.replace(
  'onStartShift: (startEarnings: number) => Promise<UberDashboard>;',
  "onStartShift: (shiftType: 'am' | 'pm', startEarnings: number) => Promise<UberDashboard>;"
);

c = c.replace(
  'onSavePlan: (targetPence: number, weights: (WorkWeight | null)[]) => Promise<UberDashboard>;',
  'onSavePlan: (amTargets: number[], pmTargets: number[]) => Promise<UberDashboard>;'
);

c = c.replace(
  'onUpdateShift: (shiftId: string, updates: any) => Promise<void>;',
  'onUpdateShift?: (shiftId: string, updates: any) => Promise<void>;'
);

c = c.replace(
  'onDeleteShift: (shiftId: string) => Promise<void>;',
  'onDeleteShift?: (shiftId: string) => Promise<void>;'
);

fs.writeFileSync('src/map/V3UberOverlay.tsx', c);
console.log("Props updated!");
