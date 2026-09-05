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
const allowAll = async () => {
  for (let i = 0; i < 5; i++) {
    const allow = page.locator('.sheet .act', { hasText: /^Allow$/ });
    if (await allow.count()) { await allow.first().click(); await page.waitForTimeout(450); } else break;
  }
};

// A. transit with network allowed -> live data
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await page.locator('.app-row', { hasText: 'Transit' }).first().click();
await page.waitForTimeout(500);
await allowAll();
await page.waitForTimeout(800);
await shot('flow-transit-live');

// B. stalled app via lab
await page.locator('.foot .act', { hasText: 'Back' }).click();
await page.locator('.lab-rail .lab-btn', { hasText: 'Launch an app that hangs' }).click();
await page.waitForTimeout(3400);
await shot('flow-stalled');
await page.locator('.foot .act', { hasText: 'Close app' }).click();

// C. scale 2.0 launcher
await page.goto(base + '?scale=2.0', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await shot('flow-scale-200');

// D. scale 2.0 with app + prompt
await page.locator('.app-row', { hasText: 'Waypoint' }).first().click();
await page.waitForTimeout(500);
await shot('flow-scale200-prompt');
await allowAll();
await page.waitForTimeout(700);
await shot('flow-scale200-app');

// E. scale 3.1
await page.goto(base + '?scale=3.1', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await shot('flow-scale-310');

// F. reduced motion + prompt
await page.goto(base + '?rm=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await page.locator('.app-row', { hasText: 'Transit' }).first().click();
await page.waitForTimeout(500);
await shot('flow-rm-prompt');

// G. broken package install via lab
await page.locator('.lab-rail .lab-btn', { hasText: 'Install a broken package' }).click();
await page.waitForTimeout(800);
await shot('flow-broken-pkg');

console.log('ERRORS:', JSON.stringify(errs, null, 2));
await browser.close();
