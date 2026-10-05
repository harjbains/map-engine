const fs = require('fs');
let file = fs.readFileSync('src/map/V3UberOverlay.tsx', 'utf8');

file = file.replace(/import type \{ UberDashboard, WeeklySummary, WorkWeight \} from "\.\.\/uber\/types\.js";/, 'import type { UberDashboard, WeeklySummary, WorkWeight, UberShift } from "../uber/types.js";');
file = file.replace(/import \{ MilestoneCelebration \} from "\.\/MilestoneCelebration\.js";\r?\n/, '');

// Props
file = file.replace(/onStartSession: \(\) => Promise<UberDashboard>;[\s\S]*?onEndSession: \(\) => Promise<UberDashboard>;/, 
  'onStartShift: (startEarnings: number) => Promise<UberDashboard>;\n  onEndShift: (shiftId: string, endEarnings: number) => Promise<UberDashboard>;');
file = file.replace(/onStartSession, onPauseSession, onResumeSession, onEndSession/, 'onStartShift, onEndShift');

// Replace everything between useStates and hrs/mins with shift logic
file = file.replace(/\/\/ Derived session info.*?(?=const hrs = Math\.floor)/s, 
`  const activeShift = dashboard.shifts?.find(s => s.status === 'active');
  const [showStartPrompt, setShowStartPrompt] = useState(false);

  useEffect(() => {
    if (!activeShift) {
      const timer = window.setTimeout(() => setShowStartPrompt(true), 5 * 60 * 1000);
      return () => window.clearTimeout(timer);
    } else {
      setShowStartPrompt(false);
    }
  }, [activeShift]);

  const [liveSeconds, setLiveSeconds] = useState(0);
  useEffect(() => {
    if (activeShift && activeShift.startTimestamp) {
      const startMs = new Date(activeShift.startTimestamp).getTime();
      setLiveSeconds(Math.floor((Date.now() - startMs) / 1000));
      const timer = window.setInterval(() => {
        setLiveSeconds(Math.floor((Date.now() - startMs) / 1000));
      }, 1000);
      return () => window.clearInterval(timer);
    } else {
      setLiveSeconds(0);
    }
  }, [activeShift]);

  const shiftEarnings = activeShift ? dashboard.todayEarningsPence - activeShift.startEarningsPence : 0;
  const shiftPph = liveSeconds > 0 ? Math.floor(shiftEarnings / (liveSeconds / 3600)) : 0;
  const pphPercent = Math.min(100, Math.floor((shiftPph / 3000) * 100)); // £30/hr is 100%
  const pphColor = shiftPph >= 2000 ? "#10b981" : (shiftPph >= 1500 ? "#eab308" : "#ef4444");

  `);

// Remove MilestoneCelebration
file = file.replace(/<MilestoneCelebration.*?setActiveTransition\(null\)\} \/>\r?\n/, '');

// Add Shift Prompt
const shiftPrompt = `
      {showStartPrompt && !activeShift && modal === "closed" && (
        <div style={{ position: 'absolute', inset: 16, background: darkMode ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.95)', borderRadius: '16px', zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', border: \`1px solid \${trackBorder}\`, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
          <div style={{ fontSize: '20px', fontWeight: 900, color: primaryText, textAlign: 'center' }}>ARE YOU WORKING?<br/><span style={{ color: goldText, fontSize: '16px' }}>SHIFT STARTED?</span></div>
          <button onClick={() => { setShowStartPrompt(false); onStartShift(dashboard.todayEarningsPence); }} style={{ padding: '12px 24px', background: '#3b82f6', color: '#fff', borderRadius: '8px', border: 'none', fontSize: '16px', fontWeight: 800, width: '80%' }}>START SHIFT</button>
          <button onClick={() => setShowStartPrompt(false)} style={{ padding: '12px 24px', background: 'transparent', color: darkMode ? '#94a3b8' : '#64748b', borderRadius: '8px', border: \`1px solid \${trackBorder}\`, fontSize: '14px', fontWeight: 700, width: '80%' }}>NO - NOT WORKING</button>
        </div>
      )}
`;

// Add Start/End Shift buttons and PPH to footer
const footerRepl = `
        {/* PPH ROW */}
        {activeShift && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: darkMode ? '#94a3b8' : '#64748b', width: '40px' }}>£/HR</span>
            <div style={{ height: '8px', borderRadius: '4px', border: \`1px solid \${trackBorder}\`, flex: 1, background: trackBg, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: \`\${pphPercent}%\`, background: pphColor, transition: 'width 0.3s ease' }} />
            </div>
            <span style={{ fontSize: '12px', fontWeight: 800, color: pphColor, width: '30px', textAlign: 'right' }}>£{Math.floor(shiftPph / 100)}</span>
          </div>
        )}

        {/* BOTTOM ROW */}
`;
file = file.replace(/\{\/\* BOTTOM ROW \*\/\}/, footerRepl);

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
file = file.replace(/\{\/\* 2 Clickable Zones \*\/\}.*?<\/div>/s, zonesRepl);

// Wait! The previous replace changed "3 Clickable Zones" to "2 Clickable Zones". So I match that.

file = file.replace(/<footer className="uber-session-footer"/, shiftPrompt + '    <footer className="uber-session-footer"');

fs.writeFileSync('src/map/V3UberOverlay.tsx', file);
