import { chromium } from 'playwright';

const base = 'http://localhost:4310/components/03-wm/index.html';
const outDir = 'reviews/03-wm/judge-r1';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE-ERR:', m.text()); });

// 1. close all windows organically via the sheet close buttons
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
for (let i = 0; i < 4; i++) {
  const btns = page.locator('[data-stage] .win-sheet [data-action="close"]');
  const n = await btns.count();
  if (n === 0) break;
  await btns.last().click();
  await page.waitForTimeout(350);
}
await page.waitForTimeout(400);
const state = await page.evaluate(() => window.__wm.getState());
console.log('after organic close-all:', JSON.stringify(state));
const cnt = await page.evaluate(() => document.querySelector('[data-stage]').children.length);
console.log('stage child elements:', cnt);
await page.locator('[data-stage]').screenshot({ path: `${outDir}/drive-closeall.png` });

// 2. text scale 2.0 via lab slider
await page.goto(base + '?scale=2', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.locator('[data-stage]').screenshot({ path: `${outDir}/drive-scale20.png` });
const scaleInfo = await page.evaluate(() => ({
  a11y: getComputedStyle(document.documentElement).getPropertyValue('--a11y-scale'),
  stageScale: getComputedStyle(document.querySelector('[data-stage]')).getPropertyValue('--stage-scale'),
  titleFont: getComputedStyle(document.querySelector('.win-title')).fontSize,
  sheetH: document.querySelector('.win-sheet').getBoundingClientRect().height,
}));
console.log('scale2:', JSON.stringify(scaleInfo));

// 3. swipe left twice (gesture dismissal)
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(500);
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(500);
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(600);
console.log('after 3 swipes:', JSON.stringify(await page.evaluate(() => window.__wm.getState())));
await page.locator('[data-stage]').screenshot({ path: `${outDir}/drive-swipes.png` });

await browser.close();
console.log('done');
