const fs = require('fs');

let overlay = fs.readFileSync('src/map/V3UberOverlay.tsx', 'utf8');

// The bottom row code looks like this:
/*
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: '2px' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, color: darkMode ? '#cbd5e1' : '#475569' }}>
                {Math.floor(dashboard.todayEarningsPence / 100)}
              </span>
            ...
            <span style={{ fontSize: '15px', fontWeight: 700, color: darkMode ? '#cbd5e1' : '#475569' }}>
                {Math.floor(blockTargetPence / 100)}
              </span>
          </div>
*/

// Replace the right side target span with a flex container holding the span and the buttons
const originalRightSpan = `<span style={{ fontSize: '15px', fontWeight: 700, color: darkMode ? '#cbd5e1' : '#475569' }}>
                {Math.floor(blockTargetPence / 100)}
              </span>`;

const newRightSide = `<div style={{ display: 'flex', alignItems: 'center', gap: '8px', zIndex: 20, position: 'relative' }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: darkMode ? '#cbd5e1' : '#475569' }}>
                {Math.floor(blockTargetPence / 100)}
              </span>
              {!activeShift ? (
                <button onClick={() => onStartShift(dashboard.todayEarningsPence)} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>START SHIFT</button>
              ) : (
                <button onClick={() => onEndShift(activeShift.id, dashboard.todayEarningsPence)} style={{ background: 'transparent', color: darkMode ? '#ef4444' : '#dc2626', border: \`1px solid \${darkMode ? '#ef4444' : '#dc2626'}\`, padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>END SHIFT</button>
              )}
            </div>`;

overlay = overlay.replace(originalRightSpan, newRightSide);

// Now remove the old full-width Shift Buttons div
const oldShiftButtons = `{/* Shift Buttons */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px', zIndex: 20, position: 'relative' }}>
            {!activeShift ? (
              <button onClick={() => onStartShift(dashboard.todayEarningsPence)} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 800, width: '100%', cursor: 'pointer' }}>START SHIFT</button>
            ) : (
              <button onClick={() => onEndShift(activeShift.id, dashboard.todayEarningsPence)} style={{ background: 'transparent', color: darkMode ? '#ef4444' : '#dc2626', border: \`1px solid \${darkMode ? '#ef4444' : '#dc2626'}\`, padding: '6px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 800, width: '100%', cursor: 'pointer' }}>END SHIFT</button>
            )}
          </div>`;

overlay = overlay.replace(oldShiftButtons, '');

fs.writeFileSync('src/map/V3UberOverlay.tsx', overlay);
