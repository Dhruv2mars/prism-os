import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = 'http://localhost:4310/components/17-audio-haptics/index.html';
const OUT = '/Users/dhruv2mars/dev/github/prism-os/reviews/17-audio-haptics/judge-r3';
mkdirSync(OUT, { recursive: true });

const shots = [
  ['state-loading', '?state=Loading'],
  ['state-blocked', '?state=Sound%20blocked'],
  ['state-nooutput', '?state=No%20output'],
  ['state-nomotor', '?state=No%20motor'],
  ['state-offline', '?state=Offline'],
  ['scale-130', '?scale=1.3'],
  ['scale-175', '?scale=1.75'],
  ['scale-300', '?scale=3'],
  ['mono', '?'], // will click Mono toggle after load
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

for (const [name, q] of shots) {
  if (name === 'mono') continue;
  await page.goto(BASE + q, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const stage = page.locator('[data-stage]');
  await stage.screenshot({ path: `${OUT}/stage-${name}.png` });
  console.log('shot', name);
}

// mono via toggle click
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Mono audio' }).click();
await page.waitForTimeout(400);
await page.locator('[data-stage]').screenshot({ path: `${OUT}/stage-mono.png` });
console.log('shot mono');

// tactile
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Haptics only' }).click();
await page.waitForTimeout(400);
await page.locator('[data-stage]').screenshot({ path: `${OUT}/stage-tactile.png` });
console.log('shot tactile');

// arrive cue (az -50) via rail
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Arrive', exact: true }).last().click();
await page.waitForTimeout(400);
await page.locator('[data-stage]').screenshot({ path: `${OUT}/stage-arrive.png` });
console.log('shot arrive');

// offline world check — dark world vs bright outdoor with same UI
await page.goto(BASE + '?world=outdoor', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.locator('[data-stage]').screenshot({ path: `${OUT}/stage-outdoor.png` });
console.log('shot outdoor');

console.log('console errors:', errors.length, errors.slice(0, 5));
await browser.close();
