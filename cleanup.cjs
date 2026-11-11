const fs = require('fs');

const path = 'src/map/V3UberOverlay.tsx';
let content = fs.readFileSync(path, 'utf8');

// Regex or string replace to clean up unused variables
// We'll just carefully replace them.
const toRemove = [
  "const dailyTargetPence = dashboard.todayTargetPence || 0;",
  "const isTargetUnlocked = dailyTargetPence > 0 && dashboard.todayEarningsPence >= dailyTargetPence;",
  "const blockIndex = Math.floor(dashboard.todayEarningsPence / 2500);",
  "const blockTargetPence = (blockIndex + 1) * 2500;",
  "const blockProgressPence = dashboard.todayEarningsPence % 2500;",
  "const percent = (blockProgressPence / 2500) * 100;",
  "const remainingToBlock = blockTargetPence - dashboard.todayEarningsPence;",
  "const remainingToDaily = Math.max(0, dailyTargetPence - dashboard.todayEarningsPence);",
  "const isNearlyReached = !isTargetUnlocked && remainingToDaily > 0 && remainingToDaily <= 1000;",
  "const barColor = isTargetUnlocked ? \"#eab308\" : \"#3b82f6\";",
  "const avgTripPence = dashboard.todayTrips > 0 ? (dashboard.todayEarningsPence / dashboard.todayTrips) : 450;",
  "let topLeftText = isTargetUnlocked ? \"BONUS TIME\" : (isNearlyReached ? \"ALMOST THERE\" : \"ON TRACK\");",
  "let topRightText = `${Math.floor(remainingToBlock / 100)} TO NEXT BLOCK`;"
];

for (const line of toRemove) {
  content = content.replace(line, "");
}

// Remove the logic that modifies topLeftText and topRightText
content = content.replace(/const hour = currentTime.getHours\(\);[\s\S]*?if \(!localStorage\.getItem\(\`morning_commitment_\$\{todayStr\}\`\)\) \{/, `const hour = currentTime.getHours();\n    if (showCompletion) {\n      // do nothing\n    } else if (hour === 9) {\n      // do nothing\n    }\n    if (h >= 11 && h < 15) {\n      if (!localStorage.getItem(\`morning_commitment_\${todayStr}\`)) {`);

fs.writeFileSync(path, content);
console.log("Cleanup done");
