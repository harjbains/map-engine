const fs = require('fs');

let file = fs.readFileSync('src/ported-map/MapEngine.tsx', 'utf8');

file = file.replace(/onStartSession: \(\) => Promise<UberDashboard>;[\s\S]*?onEndSession: \(\) => Promise<UberDashboard>;/, `onStartShift: (startEarnings: number) => Promise<UberDashboard>;
  onEndShift: (shiftId: string, endEarnings: number) => Promise<UberDashboard>;`);

file = file.replace(/onStartSession, onPauseSession, onResumeSession, onEndSession/, `onStartShift, onEndShift`);

file = file.replace(/onStartSession=\{onStartSession\} onPauseSession=\{onPauseSession\} onResumeSession=\{onResumeSession\} onEndSession=\{onEndSession\}/, `onStartShift={onStartShift} onEndShift={onEndShift}`);

fs.writeFileSync('src/ported-map/MapEngine.tsx', file);
