const fs = require('fs');

let file = fs.readFileSync('src/dashboard/Dashboard.tsx', 'utf8');

const regexHero = /<section className="hero-panel">[\s\S]*?<\/section>/m;

const newHero = `{(() => {
  const pct = dashboard.todayTargetPence > 0 ? Math.floor((dashboard.todayEarningsPence / dashboard.todayTargetPence) * 100) : 0;
  const hash = [...dashboard.today].reduce((acc, char) => acc + char.charCodeAt(0), 0) % 4;
  let title = "LET'S GET STARTED";
  let sub = "First milestone awaits";

  if (pct >= 100) {
    const msgs = [
      { title: "BONUS TIME!", sub: "Every extra £ counts" },
      { title: "TARGET COMPLETE", sub: "You've earned your gold" },
      { title: "GOLD UNLOCKED", sub: "Extra earnings unlocked" },
      { title: "LEVEL COMPLETE", sub: "Another milestone achieved" }
    ];
    ({title, sub} = msgs[hash % msgs.length]);
  } else if (pct >= 90) {
    const msgs = [
      { title: "SO CLOSE!", sub: "Nearly at your target" },
      { title: "BONUS TIME AHEAD", sub: "One more milestone" },
      { title: "THE FINISH LINE", sub: "Almost there" },
      { title: "GOLD IN SIGHT", sub: "Your next level awaits" }
    ];
    ({title, sub} = msgs[hash % msgs.length]);
  } else if (pct >= 75) {
    const msgs = [
      { title: "FINAL STRETCH", sub: "Target in sight" },
      { title: "CLOSING IN", sub: "You're getting closer" },
      { title: "ALMOST THERE", sub: "Keep the momentum" },
      { title: "TARGET IN SIGHT", sub: "Bonus time awaits" }
    ];
    ({title, sub} = msgs[hash % msgs.length]);
  } else if (pct >= 50) {
    const msgs = [
      { title: "HALFWAY THERE", sub: "Keep that momentum" },
      { title: "LOOKING GOOD", sub: "Target getting closer" },
      { title: "STAY IN THE GAME", sub: "Keep building your total" },
      { title: "OVER HALFWAY", sub: "The next level awaits" }
    ];
    ({title, sub} = msgs[hash % msgs.length]);
  } else if (pct >= 25) {
    const msgs = [
      { title: "NICE START", sub: "Keep building" },
      { title: "MOMENTUM BUILDING", sub: "You're on your way" },
      { title: "KEEP IT ROLLING", sub: "Next milestone awaits" },
      { title: "FIND YOUR RHYTHM", sub: "Every £5 adds up" }
    ];
    ({title, sub} = msgs[hash % msgs.length]);
  } else {
    const msgs = [
      { title: "LET'S GET STARTED", sub: "First milestone awaits" },
      { title: "GAME ON", sub: "Every ride counts" },
      { title: "BUILD MOMENTUM", sub: "The day is yours" },
      { title: "FIRST STEPS", sub: "Get the ball rolling" }
    ];
    ({title, sub} = msgs[hash % msgs.length]);
  }

  const nextSquareTarget = Math.floor(dashboard.todayEarningsPence / 500) * 500 + 500;
  const nextSquareAmount = nextSquareTarget - dashboard.todayEarningsPence;
  const isBonus = pct >= 100;

  return (
    <section className="hero-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div className="eyebrow" style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em' }}>TODAY</div>
          <div className="hero-money" style={{ fontSize: '2.5rem', fontWeight: 800, color: '#197a48', lineHeight: 1 }}>{gbp(dashboard.todayEarningsPence)}</div>
          <div className="target-line" style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '4px' }}>{dashboard.todayTargetPence === null ? "No target planned" : \`Target: \${gbp(dashboard.todayTargetPence)}\`}</div>
        </div>

        <div style={{ flex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginTop: '16px' }}>
          <div style={{ background: '#dbeafe', color: '#3b82f6', padding: '4px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{title}</div>
          <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '4px' }}>{sub}</div>
        </div>

        <div style={{ flex: 1, textAlign: 'right' }}>
          <div className="eyebrow" style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em' }}>NEXT {isBonus ? "MILESTONE" : "SQUARE"}</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0369a1', lineHeight: 1, marginTop: '4px' }}>{gbp(nextSquareAmount)}</div>
          <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '4px' }}>Until {gbp(nextSquareTarget)}</div>
        </div>
      </div>
      <div style={{ marginTop: '-4px' }}>
        <AnimatedProgressBar earningsPence={dashboard.todayEarningsPence} targetPence={dashboard.todayTargetPence || 0} forecastBand={dashboard.forecastBand || 'grey'} darkMode={darkMode} />
      </div>
    </section>
  );
})()}`;

file = file.replace(regexHero, newHero);

// Also replace the FORECAST metric
const regexForecast = /<Metric icon="🔮" label="FORECAST"[\s\S]*?<\/Metric>/m;

const newForecast = `{(() => {
  const band = dashboard.forecastBand || 'grey';
  const hash = [...dashboard.today].reduce((acc, char) => acc + char.charCodeAt(0), 0) % 3;
  let title = "BUILD YOUR MOMENTUM";
  let sub = "Next level: TEAL";

  if (band === 'gold') {
    title = "GOLD TERRITORY!";
    const subs = ["GOLD forecast unlocked!", "Your higher earnings band", "Every extra £ adds to your total"];
    sub = subs[hash % subs.length];
  } else if (band === 'teal') {
    title = "YOU'RE IN THE GAME!";
    const subs = ["TEAL unlocked!", "Your week is building", "GOLD is the next milestone"];
    sub = subs[hash % subs.length];
  } else {
    title = "BUILD YOUR MOMENTUM";
    const subs = ["Next level: TEAL", "Keep building your week", "Every extra £ moves you closer"];
    sub = subs[hash % subs.length];
  }

  return (
    <Metric icon="🔮" label="FORECAST" value={gbp(dashboard.weeklyForecastPence || 0)} detail={
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ 
          color: band === 'gold' ? '#eab308' : band === 'teal' ? '#06b6d4' : '#64748b', 
          fontWeight: 'bold', fontSize: '0.85rem'
        }}>
          {title}
        </span>
        <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{sub}{dashboard.provisionalForecast ? " (Provisional)" : ""}</span>
      </div>
    } />
  );
})()}`;

file = file.replace(regexForecast, newForecast);

fs.writeFileSync('src/dashboard/Dashboard.tsx', file);
