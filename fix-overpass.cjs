import fs from 'fs';

let content = fs.readFileSync('src/ported-map/lib/safety.ts', 'utf8');

const queueCode = `
const overpassQueue: (() => void)[] = [];
let overpassActive = 0;

async function acquireOverpassSlot() {
  if (overpassActive < 2) {
    overpassActive++;
    return;
  }
  return new Promise<void>((resolve) => overpassQueue.push(resolve));
}

function releaseOverpassSlot() {
  const next = overpassQueue.shift();
  if (next) {
    next();
  } else {
    overpassActive--;
  }
}
`;

content = content.replace(
  'async function requestOverpass',
  queueCode + '\nasync function requestOverpass'
);

content = content.replace(
  'const response = await fetch(endpoint, {',
  'await acquireOverpassSlot();\n    const response = await fetch(endpoint, {'
);

content = content.replace(
  'window.clearTimeout(timeout);',
  'window.clearTimeout(timeout);\n    releaseOverpassSlot();'
);

fs.writeFileSync('src/ported-map/lib/safety.ts', content);
