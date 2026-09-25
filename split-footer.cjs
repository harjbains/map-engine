const fs = require('fs');
let tsx = fs.readFileSync('src/map/V3UberOverlay.tsx', 'utf8');

let newFooter = `
      <footer className="uber-session-footer" style={{ height: 'auto', padding: '12px 16px', flexDirection: 'column', alignItems: 'stretch', position: 'relative' }}>
        <div className="session-progress" style={{ borderRight: 'none', padding: 0, flexDirection: 'column', height: 'auto', gap: '8px', background: 'transparent', cursor: 'default' }}>
`;

// Replace the start
tsx = tsx.replace(
  /<footer className="uber-session-footer" style=\{\{ height: 'auto', padding: '12px 16px', flexDirection: 'column', alignItems: 'stretch' \}\}>\s*<button type="button" className="session-progress" onClick=\{\(\) => setModal\("editor"\)\} aria-label="Open Update Earnings screen" style=\{\{ borderRight: 'none', padding: 0, flexDirection: 'column', height: 'auto', gap: '8px', background: 'transparent' \}\}>/,
  newFooter.trim()
);

let newEnd = `
        </div>
        
        {/* 3 Clickable Zones */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', zIndex: 10, borderRadius: '12px', overflow: 'hidden' }}>
          <button 
            type="button" 
            onClick={() => setModal("dashboard")} 
            style={{ flex: 1, background: 'transparent', border: 'none', cursor: 'pointer' }}
            aria-label="Open Dashboard"
          />
          <button 
            type="button" 
            onClick={() => setModal("editor")} 
            style={{ flex: 1, background: 'transparent', border: 'none', cursor: 'pointer' }}
            aria-label="Update earnings"
          />
          <button 
            type="button" 
            onClick={() => setActiveTransition({ 
              id: Date.now(), 
              cycleCrossed: false, 
              milestone: null, 
              oldSquares: Math.floor(dashboard.todayEarningsPence / 500), 
              newSquares: Math.floor(dashboard.todayEarningsPence / 500) 
            })} 
            style={{ flex: 1, background: 'transparent', border: 'none', cursor: 'pointer' }}
            aria-label="Display tiles"
          />
        </div>
      </footer>
`;

tsx = tsx.replace(
  /<\/button>\s*<\/footer>/,
  newEnd.trim()
);

fs.writeFileSync('src/map/V3UberOverlay.tsx', tsx);
