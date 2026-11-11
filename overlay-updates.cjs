const fs = require('fs');

let overlay = fs.readFileSync('src/map/V3UberOverlay.tsx', 'utf8');

overlay = overlay.replace(/onSavePlan: \(targetPence: number, weights: Array<WorkWeight \| null>\) => Promise<UberDashboard>;/, `onSavePlan: (amTargets: number[], pmTargets: number[]) => Promise<UberDashboard>;`);
overlay = overlay.replace(/onStartShift: \(startEarnings: number\) => Promise<UberDashboard>;/, `onStartShift: (shiftType: 'am' | 'pm', startEarnings: number) => Promise<UberDashboard>;`);
overlay = overlay.replace(/onSave=\{async \(targetPence, weights\) => \{ await onSavePlan\(targetPence, weights\);/, `onSave={async (amTargets, pmTargets) => { await onSavePlan(amTargets, pmTargets);`);

fs.writeFileSync('src/map/V3UberOverlay.tsx', overlay);
