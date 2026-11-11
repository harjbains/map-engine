const fs = require('fs');
let code = fs.readFileSync('src/map/V3UberOverlay.tsx', 'utf8');

// Add state for shift select prompt
code = code.replace(/const \[showStartPrompt, setShowStartPrompt\] = useState\(false\);/, `const [showStartPrompt, setShowStartPrompt] = useState(false);
  const [shiftSelectPrompt, setShiftSelectPrompt] = useState(false);`);

// Add handleStartClick function
const handleStartClickCode = `
  const handleStartClick = () => {
    setShowStartPrompt(false);
    const todayPlan = dashboard.days.find(d => d.date === dashboard.today);
    const todayShifts = (dashboard.shifts ?? []).filter(s => s.date === dashboard.today);
    const amWorked = todayShifts.some(s => s.shiftType === 'am');
    const pmWorked = todayShifts.some(s => s.shiftType === 'pm');
    
    const amPlanned = (todayPlan?.amTargetPence ?? 0) > 0;
    const pmPlanned = (todayPlan?.pmTargetPence ?? 0) > 0;
    
    if (amPlanned && !pmPlanned && !amWorked) {
      onStartShift('am', dashboard.todayEarningsPence);
    } else if (pmPlanned && !amPlanned && !pmWorked) {
      onStartShift('pm', dashboard.todayEarningsPence);
    } else if (!amWorked && pmWorked) {
      onStartShift('am', dashboard.todayEarningsPence);
    } else if (!pmWorked && amWorked) {
      onStartShift('pm', dashboard.todayEarningsPence);
    } else {
      setShiftSelectPrompt(true);
    }
  };
`;
code = code.replace(/return <>;/, handleStartClickCode + '\n  return <>;');

// Replace button calls
code = code.replace(/onStartShift\(dashboard\.todayEarningsPence\)/g, 'handleStartClick()');

// Render the shift select prompt
const shiftSelectRender = `
        {shiftSelectPrompt && !activeShift && (
          <div style={{ position: 'absolute', inset: 16, background: darkMode ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.95)', borderRadius: '16px', zIndex: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', border: \`1px solid \${trackBorder}\`, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: '20px', fontWeight: 900, color: primaryText, textAlign: 'center' }}>START SHIFT</div>
            <div style={{ display: 'flex', gap: '16px', width: '80%' }}>
              <button onClick={() => { setShiftSelectPrompt(false); onStartShift('am', dashboard.todayEarningsPence); }} style={{ flex: 1, padding: '16px', background: '#0f4a66', border: '1px solid #53cfff', borderRadius: '12px', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#94a3b8' }}>AM</span>
                <span style={{ fontSize: '20px', fontWeight: 900 }}>£{Math.floor((dashboard.days.find(d => d.date === dashboard.today)?.amTargetPence ?? 0) / 100)}</span>
              </button>
              <button onClick={() => { setShiftSelectPrompt(false); onStartShift('pm', dashboard.todayEarningsPence); }} style={{ flex: 1, padding: '16px', background: '#4a1d4a', border: '1px solid #f472b6', borderRadius: '12px', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#94a3b8' }}>PM</span>
                <span style={{ fontSize: '20px', fontWeight: 900 }}>£{Math.floor((dashboard.days.find(d => d.date === dashboard.today)?.pmTargetPence ?? 0) / 100)}</span>
              </button>
            </div>
            <button onClick={() => setShiftSelectPrompt(false)} style={{ marginTop: '16px', padding: '12px 24px', background: 'transparent', color: darkMode ? '#94a3b8' : '#64748b', borderRadius: '8px', border: \`1px solid \${trackBorder}\`, fontSize: '14px', fontWeight: 700 }}>CANCEL</button>
          </div>
        )}
`;

code = code.replace(/\{showStartPrompt && !activeShift && modal === "closed" && \(/, shiftSelectRender + '\n        {showStartPrompt && !activeShift && modal === "closed" && (');

fs.writeFileSync('src/map/V3UberOverlay.tsx', code);
