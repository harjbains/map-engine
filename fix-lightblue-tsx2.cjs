const fs = require('fs');
let tsx = fs.readFileSync('src/map/V3UberOverlay.tsx', 'utf8');

const newColors = `  const primaryText = darkMode ? "#ffffff" : "#197a48";
  const trackBg = darkMode ? "#334155" : "#e0f2fe";
  const trackBorder = darkMode ? "#000" : "#bae6fd";
  const starBoxBg = darkMode ? "#1e293b" : "#ffffff";
  const starBoxBorder = darkMode ? "#334155" : "#bae6fd";
  const goldText = darkMode ? "#eab308" : "#d97706";`;

tsx = tsx.replace(/const primaryText = [\s\S]*?const goldText = .*?;/, newColors);
fs.writeFileSync('src/map/V3UberOverlay.tsx', tsx);
