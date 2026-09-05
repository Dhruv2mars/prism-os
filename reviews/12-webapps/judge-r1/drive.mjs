import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = 'http://localhost:4310/components/12-webapps/index.html';
const out = 'reviews/12-webapps/judge-r1';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1120, height: 820 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

const stage = page.locator('.stage');
const shot = async (name) => { await page.waitForTimeout(650); await stage.screenshot({ path: `${out}/${name}.png` }); console.log('shot', name); };

// 1. open Transit -> permission sheet should rise
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await page.locator('.app-row', { hasText: 'Transit' }).first().click();
await shot('flow-prompt');

// 2. Deny -> back to app? or launcher; then reopen and Allow
const denyVisible = await page.locator('.sheet').count();
if (denyVisible) {
  await page.locator('.sheet .act', { hasText: "Don't allow" }).click();
  await shot('flow-after-deny');
  await page.locator('.app-row', { hasText: 'Transit' }).first().click();
  await page.waitForTimeout(500);
  await page.locator('.sheet .act', { hasText: 'Allow' }).click();
}
await shot('flow-transit-running');

// 3. pause/resume row + back
// 4. permissions manager
await page.locator('.foot .act', { hasText: 'Back' }).click();
await page.locator('.foot .act', { hasText: 'Permissions' }).click();
await shot('flow-permissions');

// cycle one state
const st = page.locator('.perm-state').first();
await st.click();
await shot('flow-perm-cycled');

// 5. back to launcher, open stalled app via lab rail
await page.locator('.foot .act', { hasText: 'Back' }).click();
await page.locator('.lab button', { hasText: 'Launch an app that hangs' }).click();
await shot('flow-stalled');

// 6. reload with text scale 2.0
await page.goto(base + '?scale=2.0', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await shot('flow-scale-200');

// 7. text scale 3.1
await page.goto(base + '?scale=3.1', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await shot('flow-scale-310');

// 8. scale 2 + open app with prompt at scale
await page.goto(base + '?scale=2.0', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await page.locator('.app-row', { hasText: 'Waypoint' }).first().click();
await shot('flow-scale200-prompt');

console.log('ERRORS:', JSON.stringify(errs, null, 2));
await browser.close();
