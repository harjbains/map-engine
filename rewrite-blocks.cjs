const fs = require('fs');
let file = fs.readFileSync('src/map/V3UberOverlay.tsx', 'utf8');

// Replace target block
file = file.replace(
  /let currentMaxTarget = dashboard\.todayTargetPence \|\| 0;[\s\S]*?let topRightText = remainingPence > 0 \? `\$\{Math\.floor\(remainingPence \/ 100\)\} TO NEXT MILESTONE` : "MILESTONE REACHED";/gm,
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
  const avgTripPence = dashboard.todayTrips > 0 ? (dashboard.todayEarningsPence / dashboard.todayTrips) : 450;

  let topLeftText = isTargetUnlocked ? "BONUS TIME" : (isNearlyReached ? "ALMOST THERE" : "ON TRACK");
  if (!isTargetUnlocked && dailyTargetPence > 0) {
    topLeftText += \` · TARGET: £\${Math.floor(dailyTargetPence / 100)}\`;
  }
  let topRightText = \`\${Math.floor(remainingToBlock / 100)} TO NEXT BLOCK\`;`
);

// Replace tripsLeft calculation
file = file.replace(
  /const tripsLeft = remainingPence === 0 \? 0 : Math\.max\(1, Math\.ceil\(remainingPence \/ avgTripPence\)\);\s*const visualStars = Math\.min\(tripsLeft, 7\);/g,
  `const squaresLeft = Math.ceil(remainingToBlock / 500);
  const visualStars = Math.min(squaresLeft, 5);`
);

// Replace {tripsLeft > 0 ? ( ... {tripsLeft} left ... ) : ( ... TARGET MET ... )}
// with squaresLeft logic
file = file.replace(
  /\{tripsLeft > 0 \? \(/g,
  `{squaresLeft > 0 ? (`
);

file = file.replace(
  /\{tripsLeft\} left/g,
  `{squaresLeft} left`
);

// We should replace TARGET MET with TARGET MET if we are just looking at squaresLeft. But squaresLeft is always > 0 (unless we hit it exactly? wait, remainingToBlock is at least 1? No, if todayEarnings % 2500 == 0, wait, blockIndex is Math.floor(.../2500). If it's exactly 2500, blockIndex is 1, blockTarget is 5000, remaining is 2500. So remaining is ALWAYS > 0. So squaresLeft is always 5.
// Ah, if we hit the block exactly, the new block target is the NEXT one! So squaresLeft will be 5, percent will be 0.
// This is exactly what the user wants: "revert to 100,125,150,175 and so on".

// And replace the bottom right target text:
file = file.replace(
  /\{Math\.floor\(currentMaxTarget \/ 100\)\}/g,
  `{Math.floor(blockTargetPence / 100)}`
);

fs.writeFileSync('src/map/V3UberOverlay.tsx', file);
