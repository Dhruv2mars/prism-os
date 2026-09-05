import { chromium } from 'playwright';
import fs from 'fs';

const outDir = 'reviews/09-nav/judge-r1';
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 900 } });

const consoleErrors = [];
const pageErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => pageErrors.push(String(e)));

await page.goto('http://localhost:4310/components/09-nav/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

// stage only screenshots: clip the .stage element
const stage = page.locator('[data-stage]');

async function shot(name) {
  await page.waitForTimeout(500);
  await stage.screenshot({ path: `${outDir}/${name}.png` });
}

// 1. default
await shot('s-normal');

// 2. drive each edge state via window.__setNavState
for (const s of ['loading', 'empty', 'error', 'offline', 'permission']) {
  await page.evaluate(id => window.__setNavState(id), s);
  await shot(`s-${s}`);
}

// back to normal, test reroute click (in error state banner behaviour too)
await page.evaluate(() => window.__setNavState('normal'));
await shot('s-normal-back');

// 3. gaze hover on a control — move mouse over Reroute button
const reroute = page.locator('button', { hasText: 'Reroute' }).first();
await reroute.hover();
await shot('s-hover-reroute');

// 4. click reroute in normal state (should advance/reroute)
await reroute.click();
await shot('s-after-reroute');

// 5. keyboard: Tab cycling
await page.keyboard.press('Tab');
await page.keyboard.press('Tab');
await shot('s-tab-focus');

// 6. toggle avoid tolls
await page.evaluate(() => window.__setNavState('normal'));
const tolls = page.locator('.switch, [role="switch"]').first();
if (await tolls.count()) { await tolls.click(); await page.waitForTimeout(700); }
await shot('s-tolls-on');

// 7. 2x text scale
await page.emulateMedia({ reducedMotion: 'reduce' });
const ctx = await browser.newContext({ viewport: { width: 800, height: 900 }, deviceScaleFactor: 2 });
const p2 = await ctx.newPage();
await p2.goto('http://localhost:4310/components/09-nav/index.html', { waitUntil: 'networkidle' });
await p2.waitForTimeout(600);
// try to bump text scale if piece supports it
const canScale = await p2.evaluate(() => {
  if (window.__setTextScale) { window.__setTextScale(1.5); return 'api'; }
  document.documentElement.style.fontSize = '24px';
  return 'root-font';
});
await p2.waitForTimeout(400);
await p2.locator('[data-stage]').screenshot({ path: `${outDir}/s-textscale-${canScale}.png` });
await p2.locator('.device').screenshot({ path: `${outDir}/s-textscale-full.png` });

// 8. step chip advance (gaze+ dwell on next turn)
await page.locator('.step-chip').nth(1).click().catch(()=>{});
await shot('s-step2');

console.log(JSON.stringify({ consoleErrors, pageErrors, canScale }, null, 2));
await browser.close();
