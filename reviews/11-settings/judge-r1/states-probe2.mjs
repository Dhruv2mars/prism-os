import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 700, height: 700 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
await page.goto('http://localhost:4310/components/11-settings/index.html');
await page.waitForTimeout(900);
// open Display sheet via dispatch click on the row
const row = await page.$('.stage [role="button"][aria-label^="Display brightness"]');
if (row) { await row.click(); await page.waitForTimeout(900); }
await page.screenshot({ path: 'reviews/11-settings/judge-r1/states/sheet-display2.png', clip: { x: 50, y: 50, width: 600, height: 600 } });
// drag slider to change value, screenshot
const sl = await page.$('.stage input[type="range"]');
if (sl) {
  const box = await sl.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2);
    await page.mouse.down(); await page.mouse.up();
    await page.waitForTimeout(500);
  }
}
await page.screenshot({ path: 'reviews/11-settings/judge-r1/states/sheet-slider.png', clip: { x: 50, y: 50, width: 600, height: 600 } });
// back out via Esc
await page.keyboard.press('Escape'); await page.waitForTimeout(500);
// fresh search test
const inp = await page.$('#searchInput');
if (inp) { await inp.click(); await page.keyboard.type('zzzz'); await page.waitForTimeout(800); }
await page.screenshot({ path: 'reviews/11-settings/judge-r1/states/search-empty2.png', clip: { x: 50, y: 50, width: 600, height: 600 } });
// clear via the Clear chip if present
const clr = await page.$('.stage [aria-label="Clear search"]');
if (clr) { await clr.click(); await page.waitForTimeout(500); }
console.log(JSON.stringify({ errors }, null, 2));
await browser.close();
