const fs = require('fs');
let file = fs.readFileSync('src/map/V3UberOverlay.tsx', 'utf8');

const zonesRepl = `{/* Clickable Zones & Shift Controls */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', zIndex: 10, borderRadius: '12px', overflow: 'hidden' }}>
          <button type="button" onClick={() => { setReturnTo("closed"); setModal("dashboard"); }} style={{ flex: 1, background: 'transparent', border: 'none', cursor: 'pointer' }} />
          <button type="button" onClick={() => { setReturnTo("closed"); setModal("editor"); }} style={{ flex: 1, background: 'transparent', border: 'none', cursor: 'pointer' }} />
        </div>
        
        {/* Shift Buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px', zIndex: 20, position: 'relative' }}>
          {!activeShift ? (
            <button onClick={() => onStartShift(dashboard.todayEarningsPence)} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 800, width: '100%', cursor: 'pointer' }}>START SHIFT</button>
          ) : (
            <button onClick={() => onEndShift(activeShift.id, dashboard.todayEarningsPence)} style={{ background: 'transparent', color: darkMode ? '#ef4444' : '#dc2626', border: \`1px solid \${darkMode ? '#ef4444' : '#dc2626'}\`, padding: '6px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 800, width: '100%', cursor: 'pointer' }}>END SHIFT</button>
          )}
        </div>`;

file = file.replace(/\{\/\* 3 Clickable Zones \*\/\}.*?<\/div>/s, zonesRepl);

fs.writeFileSync('src/map/V3UberOverlay.tsx', file);
