const fs = require('fs');

let file = fs.readFileSync('src/uber/milestones.ts', 'utf8');

const startIndex = file.indexOf('export function deriveEarningsTransition');
if (startIndex !== -1) {
  file = file.substring(0, startIndex);
}

const newImplementation = `export function deriveEarningsTransition(before: UberDashboard, after: UberDashboard, id: number): EarningsTransition | null {
  if (before.today !== after.today || before.summary.weekStart !== after.summary.weekStart) return null;
  const increased = after.todayEarningsPence > before.todayEarningsPence;
  if (!increased) return null;
  
  const oldSquares = Math.floor(before.todayEarningsPence / 500);
  const newSquares = Math.floor(after.todayEarningsPence / 500);
  
  if (newSquares <= oldSquares) return null; // Only trigger if a square was crossed

  let candyText = "";
  let subText = "";
  let milestone: EarningsMilestone = "micro";
  
  const combo = newSquares - oldSquares;
  if (combo >= 4) {
    candyText = \`\${combo} SQUARE COMBO!\`;
    subText = \`£\${combo * 5} of progress unlocked\`;
  } else if (oldSquares < 50 && newSquares >= 50) {
    candyText = "DOUBLE BOARD COMPLETE!";
    subText = "£250 unlocked";
    milestone = "cycle";
  } else if (oldSquares < 25 && newSquares >= 25) {
    candyText = "BOARD COMPLETE!";
    subText = "£125 unlocked";
    milestone = "cycle";
  } else if (oldSquares < 20 && newSquares >= 20) {
    candyText = "CENTURY CLUB!";
    subText = "£100 unlocked";
  } else if (oldSquares < 15 && newSquares >= 15) {
    candyText = "KEEP IT ROLLING!";
  } else if (oldSquares < 10 && newSquares >= 10) {
    candyText = "DOUBLE DIGITS!";
  } else if (oldSquares < 5 && newSquares >= 5) {
    candyText = "FIVE DOWN!";
  } else if (oldSquares < 1 && newSquares >= 1) {
    candyText = "FIRST SQUARE UNLOCKED";
  }

  // Also check if we hit daily target
  const dailyTarget = after.todayTargetPence;
  if (dailyTarget !== null && dailyTarget > 0 && before.todayEarningsPence < dailyTarget && after.todayEarningsPence >= dailyTarget) {
    milestone = "daily";
    if (!candyText) {
      candyText = "TARGET ACQUIRED!";
      subText = "DAILY GOAL CRUSHED";
    }
  }

  // Set default if no special text
  if (!candyText && combo > 1) {
    candyText = \`\${combo} SQUARES!\`;
    subText = "Keep building";
  } else if (!candyText) {
    candyText = "SWEET!";
    subText = "KEEP IT UP";
  }
  
  return { id, cycleCrossed: milestone === "cycle", milestone, candyText, subText, oldSquares, newSquares };
}
`;

fs.writeFileSync('src/uber/milestones.ts', file + newImplementation);
