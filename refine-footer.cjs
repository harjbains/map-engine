const fs = require('fs');
let c = fs.readFileSync('src/map/V3UberOverlay.tsx', 'utf8');

const footerStart = c.indexOf('<footer className={`uber-session-footer');
const footerEnd = c.indexOf('</footer>', footerStart) + '</footer>'.length;

const replacementFooter = `<footer className={\`uber-session-footer \${activeShift && !(!activeShift && false) ? (activeShift.shiftType === 'am' || activeShift.shiftType === 'pm' ? '' : '') : ''}\`} style={{ 
  height: 'auto', 
  padding: '10px 16px', 
  flexDirection: 'column', 
  alignItems: 'stretch',
  background: activeShift ? (() => {
    const todayPlan = dashboard.days.find(d => d.date === dashboard.today);
    const shiftTarget = activeShift.shiftType === 'am' ? (todayPlan?.amTargetPence || 0) : (activeShift.shiftType === 'pm' ? (todayPlan?.pmTargetPence || 0) : 0);
    const shiftEarnings = dashboard.todayEarningsPence - activeShift.startEarningsPence;
    const remaining = Math.max(0, shiftTarget - shiftEarnings);
    const final25 = remaining <= 2500 && remaining > 0;
    const unlocked = shiftTarget > 0 && shiftEarnings >= shiftTarget;
    if (unlocked) return darkMode ? '#064e3b' : '#dcfce7'; // green bg
    if (final25) return darkMode ? '#422006' : '#fef9c3'; // yellow bg
    return darkMode ? '#1e293b' : '#f0f9ff'; // normal bg
  })() : (darkMode ? '#1e293b' : '#f0f9ff'),
  borderColor: activeShift ? (() => {
    const todayPlan = dashboard.days.find(d => d.date === dashboard.today);
    const shiftTarget = activeShift.shiftType === 'am' ? (todayPlan?.amTargetPence || 0) : (activeShift.shiftType === 'pm' ? (todayPlan?.pmTargetPence || 0) : 0);
    const shiftEarnings = dashboard.todayEarningsPence - activeShift.startEarningsPence;
    const remaining = Math.max(0, shiftTarget - shiftEarnings);
    const final25 = remaining <= 2500 && remaining > 0;
    const unlocked = shiftTarget > 0 && shiftEarnings >= shiftTarget;
    if (unlocked) return darkMode ? '#059669' : '#86efac';
    if (final25) return darkMode ? '#b45309' : '#fde047';
    return darkMode ? 'rgba(255,255,255,0.1)' : '#bae6fd';
  })() : undefined,
  boxShadow: activeShift ? (() => {
    const todayPlan = dashboard.days.find(d => d.date === dashboard.today);
    const shiftTarget = activeShift.shiftType === 'am' ? (todayPlan?.amTargetPence || 0) : (activeShift.shiftType === 'pm' ? (todayPlan?.pmTargetPence || 0) : 0);
    const shiftEarnings = dashboard.todayEarningsPence - activeShift.startEarningsPence;
    const remaining = Math.max(0, shiftTarget - shiftEarnings);
    if (remaining <= 2500 && remaining > 0) return darkMode ? '0 0 15px rgba(245,158,11,0.3)' : '0 0 15px rgba(250,204,21,0.5)';
    return undefined;
  })() : undefined,
  transition: 'background 0.5s ease, box-shadow 0.5s ease'
}}>
        
  {/* Clickable Zones & Shift Controls */}
  <div style={{ position: 'absolute', inset: 0, display: 'flex', zIndex: 10, borderRadius: '12px', overflow: 'hidden' }}>
    <button type="button" onClick={() => { setReturnTo("closed"); setModal("dashboard"); }} style={{ flex: 1, background: 'transparent', border: 'none', cursor: 'pointer' }} />
    <button type="button" onClick={() => { setReturnTo("closed"); setModal("editor"); }} style={{ flex: 1, background: 'transparent', border: 'none', cursor: 'pointer' }} />
  </div>

  <div className="session-progress" style={{ borderRight: 'none', padding: 0, height: 'auto', gap: '6px', background: 'transparent', cursor: 'default', position: 'relative', zIndex: 20, pointerEvents: 'none', width: '100%', display: 'flex', alignItems: 'center' }}>
    
    {!activeShift ? (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '4px 0' }}>
        <span style={{ fontSize: '18px', fontWeight: 800, color: darkMode ? '#94a3b8' : '#64748b' }}>NO ACTIVE SHIFT</span>
        <button onClick={(e) => { e.stopPropagation(); handleStartClick(); }} style={{ pointerEvents: 'auto', background: '#3b82f6', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: '6px', fontSize: '14px', fontWeight: 800, cursor: 'pointer' }}>START SHIFT</button>
      </div>
    ) : (
      (() => {
        const todayPlan = dashboard.days.find(d => d.date === dashboard.today);
        const shiftTargetPence = activeShift.shiftType === 'am' ? (todayPlan?.amTargetPence || 0) : (activeShift.shiftType === 'pm' ? (todayPlan?.pmTargetPence || 0) : 0);
        const shiftEarningsPence = dashboard.todayEarningsPence - activeShift.startEarningsPence;
        const remainingTarget = Math.max(0, shiftTargetPence - shiftEarningsPence);
        const isFinal25 = remainingTarget <= 2500 && remainingTarget > 0;
        const isTargetUnlocked = shiftTargetPence > 0 && shiftEarningsPence >= shiftTargetPence;
        
        let topSquares = Math.floor(shiftEarningsPence / 100) % 25;
        if (topSquares === 0 && shiftEarningsPence > 0) {
          topSquares = 25;
        }
        
        const totalBottomSquares = Math.floor(shiftTargetPence / 500);
        const filledBottomSquares = Math.min(totalBottomSquares, Math.floor(shiftEarningsPence / 500));
        
        const filledColor = isTargetUnlocked ? '#22c55e' : (isFinal25 ? '#f59e0b' : '#3b82f6');
        const emptyColor = darkMode ? '#334155' : '#cbd5e1';
        
        const textColor = darkMode ? '#f8fafc' : '#0f172a';
        const mutedText = darkMode ? '#94a3b8' : '#475569';
        const targetColor = isTargetUnlocked ? '#16a34a' : (isFinal25 ? '#d97706' : '#d97706');
        
        return (
          <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            
            {/* LEFT: INFO */}
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: '40px' }}>
              <span style={{ fontSize: '10px', fontWeight: 900, color: mutedText, letterSpacing: '0.5px' }}>{activeShift.shiftType?.toUpperCase() || 'UNKNOWN'} SHIFT</span>
              <span style={{ fontSize: '24px', fontWeight: 900, color: textColor, lineHeight: 1.1 }}>£{Math.floor(shiftEarningsPence / 100)}</span>
            </div>
            
            {/* MIDDLE: SQUARES */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', overflow: 'hidden', padding: '2px 0' }}>
              {/* TOP ROW */}
              <div className={isFinal25 ? 'final-25-glow' : ''} style={{ display: 'flex', gap: '3px', height: '6px' }}>
                {Array.from({length: 25}).map((_, i) => (
                  <div key={'top-'+i} style={{ flex: '0 1 8px', minWidth: '2px', height: '6px', backgroundColor: i < topSquares ? filledColor : emptyColor, borderRadius: '2px', transition: 'background-color 0.3s' }} />
                ))}
              </div>
              
              {/* BOTTOM ROW */}
              <div className={isFinal25 ? 'final-25-glow' : ''} style={{ display: 'flex', gap: '3px', height: '10px' }}>
                {totalBottomSquares > 0 ? Array.from({length: totalBottomSquares}).map((_, i) => (
                  <div key={'bot-'+i} style={{ flex: '0 1 12px', minWidth: '2px', height: '10px', backgroundColor: i < filledBottomSquares ? filledColor : emptyColor, borderRadius: '3px', transition: 'background-color 0.3s' }} />
                )) : (
                  <div style={{ flex: '0 1 12px', height: '10px', backgroundColor: emptyColor, borderRadius: '3px' }} />
                )}
              </div>
            </div>
            
            {/* RIGHT-MIDDLE: TARGET */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: '40px', justifyContent: 'center' }}>
              {isTargetUnlocked ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '13px', fontWeight: 900 }}>✓</div>
                </div>
              ) : (
                <>
                  <span style={{ fontSize: '22px', fontWeight: 900, color: targetColor, lineHeight: 1.1 }}>£{Math.floor(remainingTarget / 100)}</span>
                  <span style={{ fontSize: '9px', fontWeight: 800, color: mutedText, letterSpacing: '0.2px' }}>TO TARGET</span>
                </>
              )}
            </div>
            
            {/* RIGHT: END BUTTON */}
            <button onClick={(e) => { e.stopPropagation(); onEndShift(activeShift.id, dashboard.todayEarningsPence); }} style={{ pointerEvents: 'auto', background: '#fff', color: '#ef4444', border: '1px solid #ef4444', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 900, cursor: 'pointer', zIndex: 30 }}>
              END
            </button>
            
          </div>
        );
      })()
    )}
  </div>
</footer>`;

c = c.substring(0, footerStart) + replacementFooter + c.substring(footerEnd);
fs.writeFileSync('src/map/V3UberOverlay.tsx', c);
console.log("Squares sized applied");
