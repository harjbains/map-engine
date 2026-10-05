const fs = require('fs');
let file = fs.readFileSync('src/map/V3UberOverlay.tsx', 'utf8');

const safetyPrompt = `
  // Long Inactivity Safety Net
  const [showInactivityPrompt, setShowInactivityPrompt] = useState(false);
  useEffect(() => {
    if (activeShift) {
      // Check if last activity was > 2 hours ago
      // We don't have "last activity" explicitly yet, so we'll use activeShift.startTimestamp as a stand-in if the shift is very long, or just track it via the last time we updated earnings.
      // Since it says "no meaningful earnings/activity", and we don't have an activity log yet, we can check if the shift is > 12 hours long as a simple fallback, or just skip it for V1 since we have no way to detect "meaningful earnings" timestamps without a new DB column for "last_earnings_update_at".
    }
  }, [activeShift]);
`;

// Actually, wait, without modifying the database to store "last_earnings_update_at", I can't easily tell if it's been 2 hours since activity. The user says "prefer deriving values... if the existing architecture makes that cleaner". I will skip the inactivity prompt for this exact commit and tell the user we need an activity timestamp for it, OR I can just use `Date.now() - activeShift.startTimestamp > 12 hours` as a rough check. I'll leave it as is for now since "DO NOT OVERCOMPLICATE V1" is the core principle.

