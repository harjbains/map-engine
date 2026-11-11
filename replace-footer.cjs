const fs = require('fs');

const path = 'src/map/V3UberOverlay.tsx';
let content = fs.readFileSync(path, 'utf8');

const replacementFooter = `<footer className="uber-session-footer" style={{ height: 'auto', padding: '6px 12px', flexDirection: 'column', alignItems: 'stretch' }}>
        <div className="session-progress" style={{ borderRight: 'none', padding: 0, flexDirection: 'column', height: 'auto', gap: '6px', background: 'transparent', cursor: 'default', position: 'relative', zIndex: 20 }}>
          
          {!activeShift ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '4px 0' }}>
              <span style={{ fontSize: '18px', fontWeight: 800, color: darkMode ? '#94a3b8' : '#64748b' }}>NO ACTIVE SHIFT</span>
              <button onClick={() => handleStartClick()} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: '6px', fontSize: '14px', fontWeight: 800, cursor: 'pointer', zIndex: 30, position: 'relative' }}>START SHIFT</button>
            </div>
          ) : (
            (() => {
              const todayPlan = dashboard.days.find(d => d.date === dashboard.today);
              const shiftTargetPence = activeShift.shiftType === 'am' ? (todayPlan?.amTargetPence || 0) : (activeShift.shiftType === 'pm' ? (todayPlan?.pmTargetPence || 0) : 0);
              const shiftEarningsPence = dashboard.todayEarningsPence - activeShift.startEarningsPence;
              const remainingTarget = Math.max(0, shiftTargetPence - shiftEarningsPence);
              const isFinal25 = remainingTarget <= 2500 && remainingTarget > 0;
              const isTargetUnlocked = shiftTargetPence > 0 && shiftEarningsPence >= shiftTargetPence;
              
              // Top squares (£1 each)
              let topSquares = Math.floor(shiftEarningsPence / 100) % 25;
              if (topSquares === 0 && shiftEarningsPence > 0) {
                topSquares = 25;
              }
              
              // Bottom squares (£5 each)
              const totalBottomSquares = Math.floor(shiftTargetPence / 500);
              const filledBottomSquares = Math.min(totalBottomSquares, Math.floor(shiftEarningsPence / 500));
              
              const filledColor = darkMode ? '#10b981' : '#059669'; // Green
              const emptyColor = darkMode ? '#334155' : '#cbd5e1';
              const glowClass = isFinal25 ? 'final-25-glow' : '';
              const celebrationColor = isTargetUnlocked ? '#eab308' : filledColor;
              
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {/* TEXT HEADER ROW */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: 800, color: goldText }}>
                    <span style={{ color: darkMode ? '#cbd5e1' : '#475569' }}>{activeShift.shiftType?.toUpperCase() || 'UNKNOWN'} SHIFT</span>
                    <span>{isTargetUnlocked ? 'SHIFT ACHIEVED' : \`\\u00A3\${Math.floor(remainingTarget / 100)} TO TARGET\`}</span>
                  </div>
                  
                  {/* TOP ROW: £1 SQUARES */}
                  <div className={glowClass} style={{ display: 'flex', gap: '2px', width: '100%', height: '10px' }}>
                    {Array.from({length: 25}).map((_, i) => (
                      <div key={'top-'+i} style={{ flex: 1, backgroundColor: i < topSquares ? (isTargetUnlocked ? '#eab308' : filledColor) : emptyColor, borderRadius: '2px' }} />
                    ))}
                  </div>
                  
                  {/* BOTTOM ROW: £5 SQUARES */}
                  <div className={glowClass} style={{ display: 'flex', gap: '2px', width: '100%', height: '10px' }}>
                    {totalBottomSquares > 0 ? Array.from({length: totalBottomSquares}).map((_, i) => (
                      <div key={'bot-'+i} style={{ flex: 1, backgroundColor: i < filledBottomSquares ? (isTargetUnlocked ? '#eab308' : filledColor) : emptyColor, borderRadius: '2px' }} />
                    )) : (
                      <div style={{ flex: 1, backgroundColor: emptyColor, borderRadius: '2px' }} />
                    )}
                  </div>
                  
                  {/* TEXT FOOTER ROW */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                    <span style={{ fontSize: '18px', fontWeight: 800, color: darkMode ? '#cbd5e1' : '#475569' }}>
                      \\u00A3{Math.floor(shiftEarningsPence / 100)}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '18px', fontWeight: 800, color: darkMode ? '#cbd5e1' : '#475569' }}>
                        \\u00A3{Math.floor(shiftTargetPence / 100)}
                      </span>
                      <button onClick={(e) => { e.stopPropagation(); onEndShift(activeShift.id, dashboard.todayEarningsPence); }} style={{ background: 'transparent', color: darkMode ? '#ef4444' : '#dc2626', border: \`1px solid \${darkMode ? '#ef4444' : '#dc2626'}\`, padding: '3px 9px', borderRadius: '6px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', zIndex: 30, position: 'relative' }}>
                        END
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()
          )}
        </div>
        
        {/* Clickable Zones & Shift Controls */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', zIndex: 10, borderRadius: '12px', overflow: 'hidden' }}>
          <button type="button" onClick={() => { setReturnTo("closed"); setModal("dashboard"); }} style={{ flex: 1, background: 'transparent', border: 'none', cursor: 'pointer' }} />
          <button type="button" onClick={() => { setReturnTo("closed"); setModal("editor"); }} style={{ flex: 1, background: 'transparent', border: 'none', cursor: 'pointer' }} />
        </div>
        
      </footer>`;

const footerStart = content.indexOf('<footer className="uber-session-footer"');
const footerEnd = content.indexOf('</footer>', footerStart) + '</footer>'.length;

const newContent = content.substring(0, footerStart) + replacementFooter + content.substring(footerEnd);
fs.writeFileSync(path, newContent);
console.log("Footer replaced successfully");
