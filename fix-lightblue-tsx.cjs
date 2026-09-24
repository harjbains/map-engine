const fs = require('fs');
let tsx = fs.readFileSync('src/map/V3UberOverlay.tsx', 'utf8');

// replace the color definitions
const oldColors = `  const primaryText = darkMode ? "#ffffff" : "#0f172a";
  const trackBg = darkMode ? "#334155" : "#e2e8f0";
  const trackBorder = darkMode ? "#000" : "rgba(0,0,0,0.1)";
  const starBoxBg = darkMode ? "#1e293b" : "#f8fafc";
  const starBoxBorder = darkMode ? "#334155" : "#e2e8f0";
  const goldText = darkMode ? "#eab308" : "#d97706";`;

const newColors = `  const primaryText = darkMode ? "#ffffff" : "#0f172a";
  const trackBg = darkMode ? "#334155" : "#e0f2fe";
  const trackBorder = darkMode ? "#000" : "#bae6fd";
  const starBoxBg = darkMode ? "#1e293b" : "#ffffff";
  const starBoxBorder = darkMode ? "#334155" : "#bae6fd";
  const goldText = darkMode ? "#eab308" : "#d97706";`;

tsx = tsx.replace(oldColors, newColors);
fs.writeFileSync('src/map/V3UberOverlay.tsx', tsx);
