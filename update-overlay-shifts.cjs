const fs = require('fs');

let file = fs.readFileSync('src/map/V3UberOverlay.tsx', 'utf8');

// Replace props
file = file.replace(/onStartSession: \(\) => Promise<UberDashboard>;[\s\S]*?onEndSession: \(\) => Promise<UberDashboard>;/, `onStartShift: (startEarnings: number) => Promise<UberDashboard>;
  onEndShift: (shiftId: string, endEarnings: number) => Promise<UberDashboard>;`);
file = file.replace(/onStartSession, onPauseSession, onResumeSession, onEndSession/, `onStartShift, onEndShift`);

// Remove MilestoneCelebration
file = file.replace(/import \{ MilestoneCelebration \} from "\.\/MilestoneCelebration\.js";\r?\n/g, '');
file = file.replace(/<MilestoneCelebration transition=\{activeTransition\} onComplete=\{\(\) => setActiveTransition\(null\)\} \/>\r?\n/g, '');

// Replace old session logic with active shift logic
const shiftLogic = `
  const activeShift = dashboard.shifts?.find(s => s.status === 'active');
  const [showStartPrompt, setShowStartPrompt] = useState(false);

  useEffect(() => {
    if (!activeShift) {
      const timer = window.setTimeout(() => setShowStartPrompt(true), 5 * 60 * 1000);
      return () => window.clearTimeout(timer);
    } else {
      setShowStartPrompt(false);
    }
  }, [activeShift]);

  // Calculate live duration of active shift
  const [liveSeconds, setLiveSeconds] = useState(0);
  useEffect(() => {
    if (activeShift) {
      const startMs = new Date(activeShift.startTimestamp).getTime();
      setLiveSeconds(Math.floor((Date.now() - startMs) / 1000));
      const timer = window.setInterval(() => {
        setLiveSeconds(Math.floor((Date.now() - startMs) / 1000));
      }, 1000);
      return () => window.clearInterval(timer);
    }
  }, [activeShift]);

  const hrs = Math.floor(liveSeconds / 3600);
  const mins = Math.floor((liveSeconds % 3600) / 60);

  const shiftEarnings = activeShift ? dashboard.todayEarningsPence - activeShift.startEarningsPence : 0;
  const shiftPph = liveSeconds > 0 ? (shiftEarnings / (liveSeconds / 3600)) : 0;
`;
file = file.replace(/\/\/ Derived session info.*?(?=const goldText = darkMode)/s, shiftLogic);

// Replace 3 clickable zones with 2 clickable zones
file = file.replace(/\{\/\* 3 Clickable Zones \*\/\}.*?<\/div>/s, `{/* 2 Clickable Zones */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', zIndex: 10, borderRadius: '12px', overflow: 'hidden' }}>
          <button 
            type="button" 
            onClick={() => { setReturnTo("closed"); setModal("dashboard"); }} 
            style={{ flex: 1, background: 'transparent', border: 'none', cursor: 'pointer' }}
            aria-label="Open Dashboard"
          />
          <button 
            type="button" 
            onClick={() => { setReturnTo("closed"); setModal("editor"); }} 
            style={{ flex: 1, background: 'transparent', border: 'none', cursor: 'pointer' }}
            aria-label="Update earnings"
          />
        </div>`);

fs.writeFileSync('src/map/V3UberOverlay.tsx', file);
