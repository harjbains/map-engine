const fs = require('fs');
let file = fs.readFileSync('src/map/V3UberOverlay.tsx', 'utf8');

// Replace target logic
file = file.replace(
  /let currentMaxTarget = dashboard\.todayTargetPence \|\| 0;[\s\S]*?const avgTripPence = dashboard\.todayTrips > 0 \? \(dashboard\.todayEarningsPence \/ dashboard\.todayTrips\) : 450;/g,
  `const dailyTargetPence = dashboard.todayTargetPence || 0;
  const isTargetUnlocked = dailyTargetPence > 0 && dashboard.todayEarningsPence >= dailyTargetPence;
  
  const blockIndex = Math.floor(dashboard.todayEarningsPence / 2500);
  const blockTargetPence = (blockIndex + 1) * 2500;
  
  const blockProgressPence = dashboard.todayEarningsPence % 2500;
  const percent = (blockProgressPence / 2500) * 100;
  
  const remainingToBlock = blockTargetPence - dashboard.todayEarningsPence;
  const remainingToDaily = Math.max(0, dailyTargetPence - dashboard.todayEarningsPence);
  const isNearlyReached = !isTargetUnlocked && remainingToDaily > 0 && remainingToDaily <= 1000;
  
  const barColor = isTargetUnlocked ? "#eab308" : "#3b82f6";
  const tripsLeft = Math.ceil(remainingToBlock / 500);
  const visualStars = Math.min(tripsLeft, 5);
  
  const avgTripPence = dashboard.todayTrips > 0 ? (dashboard.todayEarningsPence / dashboard.todayTrips) : 450;`
);

// Replace top row text logic
file = file.replace(
  /let topLeftText = targetUnlocked \? "BONUS TIME" : \(isNearlyReached \? "ALMOST THERE" : "ON TRACK"\);\s*let topRightText = remainingPence > 0 \? `\$\{Math\.floor\(remainingPence \/ 100\)\} TO NEXT MILESTONE` : "MILESTONE REACHED";/g,
  `let topLeftText = isTargetUnlocked ? "BONUS TIME" : (isNearlyReached ? "ALMOST THERE" : "ON TRACK");
  if (!isTargetUnlocked && dailyTargetPence > 0) {
    topLeftText += \` · TARGET: £\${Math.floor(dailyTargetPence / 100)}\`;
  }
  let topRightText = \`\${Math.floor(remainingToBlock / 100)} TO NEXT BLOCK\`;`
);

// Replace the bottom right target span
file = file.replace(
  /\{Math\.floor\(currentMaxTarget \/ 100\)\}/g,
  `{Math.floor(blockTargetPence / 100)}`
);

fs.writeFileSync('src/map/V3UberOverlay.tsx', file);
