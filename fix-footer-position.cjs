const fs = require('fs');
let tsx = fs.readFileSync('src/map/V3UberOverlay.tsx', 'utf8');

// Fix 1: Remove position: relative from the footer to fix layout bug
tsx = tsx.replace(
  /className="uber-session-footer" style=\{\{ height: 'auto', padding: '12px 16px', flexDirection: 'column', alignItems: 'stretch', position: 'relative' \}\}/,
  `className="uber-session-footer" style={{ height: 'auto', padding: '12px 16px', flexDirection: 'column', alignItems: 'stretch' }}`
);

// Fix 2: Set returnTo = "closed" when opening from footer zones
tsx = tsx.replace(
  /onClick=\{\(\) => setModal\("dashboard"\)\}/,
  `onClick={() => { setReturnTo("closed"); setModal("dashboard"); }}`
);

tsx = tsx.replace(
  /onClick=\{\(\) => setModal\("editor"\)\}/,
  `onClick={() => { setReturnTo("closed"); setModal("editor"); }}`
);

// Fix 3: Handle returnTo = "closed" inside DailyEarningsPanel and MileagePanel onCancel
tsx = tsx.replace(
  /onCancel=\{\(\) => setModal\(returnTo === "history" \? "history" : "dashboard"\)\}/g,
  `onCancel={() => setModal(returnTo === "history" ? "history" : (returnTo === "closed" ? "closed" : "dashboard"))}`
);

fs.writeFileSync('src/map/V3UberOverlay.tsx', tsx);
