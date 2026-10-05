const fs = require('fs');

let pkg = fs.readFileSync('package.json', 'utf8');
pkg = pkg.replace(/"version": ".*?"/, '"version": "3.3.0"');
fs.writeFileSync('package.json', pkg);

let cl = fs.readFileSync('src/dashboard/ChangelogModal.tsx', 'utf8');
cl = cl.replace(/<h1>v3.*?<\/h1>/, '<h1>v3.3.0 Updates</h1>');
cl = cl.replace(/<p>Light Mode, visual upgrades, and bug fixes<\/p>/, '<p>Shift Tracking, UI refinements, and more</p>');

const newArticle = `
        <article style={{ background: "rgba(0,0,0,0.2)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)" }}>
          <h3 style={{ margin: "0 0 4px", color: "#35f1bd", fontSize: "16px" }}>Shift Tracking</h3>
          <p style={{ margin: 0, fontSize: "14px", opacity: 0.9 }}>You can now start and end multiple shifts in a day to track your true active £/hr. Check your shift history from the Dashboard!</p>
        </article>
`;
cl = cl.replace(/<div style=\{\{ padding: "10px 0".*?>/, `$&` + newArticle);
fs.writeFileSync('src/dashboard/ChangelogModal.tsx', cl);
