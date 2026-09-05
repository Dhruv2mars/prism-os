import { chromium } from 'playwright';

const base = 'http://localhost:4310/components/00-foundation/index.html';
const out = 'reviews/00-foundation/judge-r4';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE-ERR', m.text()); });
page.on('pageerror', (e) => console.log('PAGE-ERR', e.message));

await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

// click "Next specimen" 6 times, screenshotting each specimen
for (let i = 1; i <= 6; i++) {
  await page.getByRole('button', { name: 'Next specimen' }).click();
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${out}/specimen-${i}.png`, clip: { x: 0, y: 0, width: 760, height: 800 } });
}

// gaze-focus look: hover the main focal element on the Focus specimen (should be dwell tile)
await page.hover('.ftile');
await page.waitForTimeout(700);
await page.screenshot({ path: `${out}/dwell-hover.png`, clip: { x: 0, y: 0, width: 760, height: 800 } });

// keyboard focus ring on a control row (Controls specimen = step 5)
for (let i = 0; i < 6; i++) { await page.getByRole('button', { name: 'Previous specimen' }).click(); await page.waitForTimeout(250); }
for (let i = 1; i <= 5; i++) { await page.getByRole('button', { name: 'Next specimen' }).click(); await page.waitForTimeout(250); }
await page.keyboard.press('Tab');
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/kb-focus.png`, clip: { x: 0, y: 0, width: 760, height: 800 } });

await browser.close();
console.log('OK');
