import { chromium } from 'playwright';
const out = '/Users/dhruv2mars/dev/github/prism-os/reviews/14-onboarding/judge-r1/states';
const base = 'http://localhost:4310/components/14-onboarding/index.html';
const shots = [
  ['step1-perms', '?step=1'],
  ['step2-pair', '?step=2'],
  ['step3-calib', '?step=3'],
  ['step4-done', '?step=4'],
  ['state-loading', '?state=loading'],
  ['state-empty', '?state=empty'],
  ['state-error', '?state=error'],
  ['state-offline', '?state=offline'],
  ['state-denied', '?state=denied'],
  ['scale-200-perms', '?scale=2&step=1'],
  ['scale-200-welcome', '?scale=2'],
];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 2240, height: 1640 } });
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
for (const [name, q] of shots) {
  await page.goto(base + q, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  const stage = page.locator('.stage');
  await stage.screenshot({ path: `${out}/${name}.png` });
  if (name.startsWith('scale')) {
    await page.screenshot({ path: `${out}/${name}-full.png` });
  }
}
console.log('errors:', errs.length, errs.slice(0,5));
await browser.close();
