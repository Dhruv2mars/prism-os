import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = 'reviews/13-a11y/judge-r1';
const URL = 'http://localhost:4310/components/13-a11y/index.html';

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 2 });
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + e.message));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

const stage = page.locator('.stage');
const shots = [];

async function snapState(chipLabel, name) {
  await page.getByRole('button', { name: new RegExp(chipLabel, 'i') }).first().click();
  await page.waitForTimeout(450);
  await stage.screenshot({ path: `${OUT}/state-${name}.png` });
  shots.push(`state-${name}.png`);
}

// 1. banner evidence: click the 100% scale chip and capture the banner that appears
await page.locator('.scale-chip[data-scale="100"]').click();
await page.waitForTimeout(250);
await stage.screenshot({ path: `${OUT}/banner-scale.png` });
shots.push('banner-scale.png');
await page.waitForTimeout(1500);

// reduced-motion toggle banner (contains cubic-bezier text per source)
const motionRow = page.locator('.a11y-row', { hasText: 'Reduced motion' }).first();
await motionRow.click();
await page.waitForTimeout(250);
await stage.screenshot({ path: `${OUT}/banner-motion.png` });
shots.push('banner-motion.png');
await page.waitForTimeout(2100);

// back to normal
await page.getByRole('button', { name: 'Show Normal state' }).click();
await page.waitForTimeout(400);

// 2. edge states via the dev-control chips outside the stage
await snapState('Show Loading state', 'loading');
await snapState('Show Empty state', 'empty');
await snapState('Show Error state', 'error');
// capture error retry mid-flight
await page.locator('#retryBtn').click();
await page.waitForTimeout(500);
await stage.screenshot({ path: `${OUT}/state-error-retrying.png` });
shots.push('state-error-retrying.png');
await page.waitForTimeout(900);

await snapState('Show Offline state', 'offline');
await snapState('Show Blocked state', 'blocked');

// 3. high contrast + 150% scale on normal
await page.getByRole('button', { name: 'Show Normal state' }).click();
await page.waitForTimeout(500);
const contrastRow = page.locator('.a11y-row', { hasText: 'High contrast' }).first();
await contrastRow.click();
await page.locator('.scale-chip[data-scale="150"]').click();
await page.waitForTimeout(500);
await stage.screenshot({ path: `${OUT}/state-hc-150.png` });
shots.push('state-hc-150.png');

// 4. keyboard traversal: Tab x5 and screenshot focus rings
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
for (let i = 0; i < 5; i++) await page.keyboard.press('Tab');
await page.waitForTimeout(300);
await stage.screenshot({ path: `${OUT}/kbd-tab5.png` });
shots.push('kbd-tab5.png');

// scroll viewport to bottom to inspect lower groups
await page.getByRole('button', { name: 'Show Normal state' }).click();
await page.waitForTimeout(400);
await page.locator('.a11y-viewport').evaluate(el => el.scrollTo(0, el.scrollHeight));
await page.waitForTimeout(400);
await stage.screenshot({ path: `${OUT}/state-bottom.png` });
shots.push('state-bottom.png');

const bannerTexts = await page.evaluate(() => Array.from(document.querySelectorAll('.banner')).map(b => b.textContent));
console.log(JSON.stringify({ consoleErrors, bannerTexts, shots }, null, 2));
await browser.close();
