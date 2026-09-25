const fs = require('fs');

let file = fs.readFileSync('src/dashboard/Dashboard.tsx', 'utf8');

// Fix alignItems: 'stretch' and width: '100%'
file = file.replace(
  /<section className="hero-panel" style=\{\{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' \}\}>/g,
  `<section className="hero-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '16px', padding: '16px', width: '100%' }}>`
);

file = file.replace(
  /<div style=\{\{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' \}\}>/g,
  `<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>`
);

// Make the motivational message larger and punchier
file = file.replace(
  /<div style=\{\{ background: '#dbeafe', color: '#3b82f6', padding: '4px 12px', borderRadius: '12px', fontSize: '0\.75rem', fontWeight: 700, whiteSpace: 'nowrap' \}\}>\{title\}<\/div>/g,
  `<div style={{ background: '#dbeafe', color: '#3b82f6', padding: '6px 16px', borderRadius: '16px', fontSize: '0.9rem', fontWeight: 800, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</div>`
);

file = file.replace(
  /<div style=\{\{ fontSize: '0\.8rem', color: '#475569', marginTop: '4px' \}\}>\{sub\}<\/div>/g,
  `<div style={{ fontSize: '0.95rem', color: '#334155', marginTop: '6px', fontWeight: 600 }}>{sub}</div>`
);

fs.writeFileSync('src/dashboard/Dashboard.tsx', file);
