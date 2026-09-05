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
const shot = async (name) => { await page.waitForTimeout(700); await stage.screenshot({ path: `${out}/${name}.png` }); console.log('shot', name); };

// 1. open Transit, Allow network
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await page.locator('.app-row', { hasText: 'Transit' }).first().click();
await page.waitForTimeout(500);
// allow queued prompts (network, notifications, storage)
for (let i = 0; i < 4; i++) {
  const allow = page.locator('.sheet .act', { hasText: 'Allow' });
  if (await allow.count()) { await allow.first().click(); await page.waitForTimeout(400); }
}
await shot('flow-transit-data');

// 2. pause
await page.locator('.foot .act', { hasText: 'Pause' }).click();
await shot('flow-paused');
await page.locator('.foot .act', { hasText: 'Resume' }).click();

// 3. back -> launcher (running dot?), permissions manager
await page.locator('.foot .act', { hasText: 'Back' }).click();
await shot('flow-launcher-running');
await page.locator('.foot .act', { hasText: 'Permissions' }).click();
await shot('flow-permissions');
await page.locator('.perm-state').first().click();
await shot('flow-perm-cycled');

// 4. stalled app
await page.locator('.foot .act', { hasText: 'Back' }).click();
await page.locator('.lab-rail .lab-btn', { hasText: 'Launch an app that hangs' }).click();
await page.waitForTimeout(3200);
await shot('flow-stalled');

// 5. scales
await page.goto(base + '?scale=2.0', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await shot('flow-scale-200');
await page.goto(base + '?scale=2.0', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await page.locator('.app-row', { hasText: 'Waypoint' }).first().click();
await page.waitForTimeout(500);
for (let i = 0; i < 4; i++) {
  const allow = page.locator('.sheet .act', { hasText: 'Allow' });
  if (await allow.count()) { await allow.first().click(); await page.waitForTimeout(400); }
}
await shot('flow-scale200-app');

await page.goto(base + '?scale=3.1', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await shot('flow-scale-310');

// 6. reduced motion + open app
await page.goto(base + '?rm=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await page.locator('.app-row', { hasText: 'Transit' }).first().click();
await page.waitForTimeout(500);
await shot('flow-rm-prompt');

console.log('ERRORS:', JSON.stringify(errs, null, 2));
await browser.close();
