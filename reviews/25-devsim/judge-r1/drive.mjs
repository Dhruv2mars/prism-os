import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = 'http://localhost:4310/components/25-devsim/index.html';
const out = '/Users/dhruv2mars/dev/github/prism-os/reviews/25-devsim/judge-r1/states';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1120, height: 820 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(m.text()); });

async function shot(url, name, opts = {}) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(opts.wait ?? 900);
  if (opts.clickLabel) {
    const btn = page.locator(`[data-lab] .lab-btn`, { hasText: opts.clickLabel }).first();
    await btn.click();
    await page.waitForTimeout(opts.waitAfterClick ?? 900);
  }
  if (opts.move) {
    const box = await page.locator('.stage').boundingBox();
    for (let i = 0; i <= 16; i++) await page.mouse.move(box.x + (box.width / 16) * i, box.y + box.height * 0.5, { steps: 2 });
    if (opts.hover) {
      const t = page.locator(opts.hover).first();
      const tb = await t.boundingBox().catch(() => null);
      if (tb) await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2, { steps: 3 });
    }
  }
  await page.locator('.stage').screenshot({ path: `${out}/${name}.png` });
  console.log('shot', name, errors.length ? 'ERRORS: ' + errors.join(' | ') : '');
}

await shot(`${base}?state=ready`, 'ready', { move: true });
await shot(`${base}?state=loading`, 'loading');
await shot(`${base}?state=empty`, 'empty');
await shot(`${base}?state=error`, 'error');
await shot(`${base}?state=offline`, 'offline');
await shot(`${base}?state=denied`, 'denied');
await shot(`${base}?state=ready`, 'sheet-log', { clickLabel: 'Open the call log' });
await shot(`${base}?state=ready`, 'sheet-perms', { clickLabel: 'Open permissions' });
await shot(`${base}?state=ready`, 'sheet-prompt', { clickLabel: 'Open permissions', waitAfterClick: 400, move: true, hover: 'button.row' });
await shot(`${base}?state=ready`, 'hang', { clickLabel: 'Run a build that hangs', wait: 2600 });
await shot(`${base}?state=ready`, 'refused', { clickLabel: 'Run a refused build' });
await shot(`${base}?state=ready`, 'log-filled', { clickLabel: 'Run the sample build', waitAfterClick: 1200 });
await shot(`${base}?state=ready&scale=1.6`, 'scale-160');
await shot(`${base}?state=ready&scale=2.3`, 'scale-230');
await shot(`${base}?state=ready&scale=3.1`, 'scale-310');
await shot(`${base}?state=ready&scale=2.3`, 'scale-230-sheet-log', { clickLabel: 'Open the call log' });
await shot(`${base}?state=empty&scale=3.1`, 'scale-310-empty');
await shot(`${base}?state=ready&rm=1`, 'rm-sheet', { clickLabel: 'Open permissions' });
await shot(`${base}?state=ready&world=night`, 'world-night');
await shot(`${base}?state=ready&world=outdoor`, 'world-outdoor');
await shot(`${base}?state=ready&lab=0`, 'nolab');

console.log('TOTAL PAGE/CONSOLE ERRORS:', errors.length);
errors.forEach((e) => console.log('  -', e));
await browser.close();
