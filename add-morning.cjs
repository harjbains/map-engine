const fs = require('fs');

let file = fs.readFileSync('src/map/V3UberOverlay.tsx', 'utf8');

// 1. Add currentTime state
file = file.replace(
  /const \[activeTransition, setActiveTransition\] = useState<EarningsTransition \| null>\(null\);/g,
  `const [activeTransition, setActiveTransition] = useState<EarningsTransition | null>(null);

  const [currentTime, setCurrentTime] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const [showCompletion, setShowCompletion] = useState(false);
  useEffect(() => {
    const todayStr = dashboard.today;
    const h = currentTime.getHours();
    if (h >= 11 && h < 15) {
      if (!localStorage.getItem(\`morning_commitment_\${todayStr}\`)) {
        setShowCompletion(true);
        localStorage.setItem(\`morning_commitment_\${todayStr}\`, "true");
      }
    } else {
      setShowCompletion(false);
    }
  }, [currentTime, dashboard.today]);

  useEffect(() => {
    if (showCompletion) {
      const timer = setTimeout(() => setShowCompletion(false), 3 * 60 * 1000);
      return () => clearTimeout(timer);
    }
  }, [showCompletion]);`
);

// 2. Compute Top Text
file = file.replace(
  /const avgTripPence = dashboard\.todayTrips > 0 \? \(dashboard\.todayEarningsPence \/ dashboard\.todayTrips\) : 450;/g,
  `const avgTripPence = dashboard.todayTrips > 0 ? (dashboard.todayEarningsPence / dashboard.todayTrips) : 450;

  let topLeftText = targetUnlocked ? "BONUS TIME" : (isNearlyReached ? "ALMOST THERE" : "ON TRACK");
  let topRightText = remainingPence > 0 ? \`\${Math.floor(remainingPence / 100)} TO NEXT MILESTONE\` : "MILESTONE REACHED";

  const hour = currentTime.getHours();
  if (showCompletion) {
    topLeftText = "MORNING COMMITMENT ACHIEVED ✓";
    topRightText = "11:00 REACHED";
  } else if (hour === 9) {
    const hash = Math.floor(dashboard.todayEarningsPence / 500);
    const msgs = [
      "STAY IN THE GAME",
      "YOUR MORNING ISN'T OVER YET",
      "KEEP YOUR OPTIONS OPEN UNTIL 11",
      "ANOTHER RIDE, ANOTHER STEP FORWARD",
      "KEEP BUILDING YOUR TESLA FUND"
    ];
    topLeftText = msgs[hash % msgs.length];
    topRightText = "11:00 FINISH";
  } else if (hour === 10) {
    const hash = Math.floor(dashboard.todayEarningsPence / 500);
    const msgs = [
      "FINAL HOUR",
      "YOUR 11:00 FINISH IS GETTING CLOSER",
      "ONE MORE RIDE COULD BUILD YOUR BONUS",
      "KEEP YOUR MORNING MOMENTUM",
      "EVERY EXTRA £5 BUILDS YOUR TESLA FUND"
    ];
    topLeftText = msgs[hash % msgs.length];
    topRightText = "11:00 FINISH";
  }`
);

// 3. Replace the actual render
file = file.replace(
  /<span>\{targetUnlocked \? "BONUS TIME" : \(isNearlyReached \? "ALMOST THERE" : "ON TRACK"\)\}<\/span>\s*<span>\{remainingPence > 0 \? `\$\{Math\.floor\(remainingPence \/ 100\)\} TO NEXT MILESTONE` : "MILESTONE REACHED"\}<\/span>/gm,
  `<span>{topLeftText}</span>
            <span>{topRightText}</span>`
);

fs.writeFileSync('src/map/V3UberOverlay.tsx', file);
