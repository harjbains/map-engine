const fs = require('fs');

let code = fs.readFileSync('src/map/V3UberOverlay.tsx', 'utf8');

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

code = code.replace(/return </, handleStartClickCode + '\n  return <');

fs.writeFileSync('src/map/V3UberOverlay.tsx', code);
