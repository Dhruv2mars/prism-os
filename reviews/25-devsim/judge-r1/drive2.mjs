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

async function settle(t = 800) { await page.waitForTimeout(t); }

// Load ready, deny the prompt, then open the call log
await page.goto(`${base}?state=ready`, { waitUntil: 'networkidle' });
await settle(900);
await page.locator('.sheet button', { hasText: "Don't allow" }).click();
await settle(600);
// let the sample app make brokered calls so the log has entries
await settle(2500);
await page.locator('.stage button', { hasText: 'Calls' }).click();
await settle(700);
await page.locator('.stage').screenshot({ path: `${out}/sheet-log2.png` });
// escape closes
await page.keyboard.press('Escape');
await settle(500);

// permissions sheet
await page.locator('.stage button', { hasText: 'Permissions' }).click();
await settle(700);
await page.locator('.stage').screenshot({ path: `${out}/sheet-perms2.png` });
// toggle a permission row (gaze click), then screenshot
const row = page.locator('.sheet button.row').first();
await row.click();
await settle(500);
await page.locator('.stage').screenshot({ path: `${out}/sheet-perms-toggled.png` });
await page.keyboard.press('Escape');
await settle(400);

// the hung build -> "Not responding" state (wait long enough for watchdog)
await page.goto(`${base}?state=ready`, { waitUntil: 'networkidle' });
await settle(800);
await page.locator(`[data-lab] .lab-btn`, { hasText: "Don't allow" }).isVisible().catch(() => {});
// deny prompt if present
const deny = page.locator('.sheet button', { hasText: "Don't allow" });
if (await deny.count()) { await deny.click(); await settle(400); }
await page.locator(`[data-lab] .lab-btn`, { hasText: 'Run a build that hangs' }).click();
await settle(9000);
await page.locator('.stage').screenshot({ path: `${out}/hang-notresponding.png` });

// 310%: open prompt, press Why?, screenshot the why sheet
await page.goto(`${base}?state=ready&scale=3.1`, { waitUntil: 'networkidle' });
await settle(1000);
const why = page.locator('.sheet button', { hasText: 'Why?' });
if (await why.count()) {
  await why.click();
  await settle(600);
  await page.locator('.stage').screenshot({ path: `${out}/scale-310-why.png` });
}

// nolab ready without prompt: use empty state
await page.goto(`${base}?state=empty&lab=0`, { waitUntil: 'networkidle' });
await settle(800);
await page.locator('.stage').screenshot({ path: `${out}/nolab-empty.png` });

console.log('TOTAL PAGE/CONSOLE ERRORS:', errors.length);
errors.forEach((e) => console.log('  -', e));
await browser.close();
