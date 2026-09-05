import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 700, height: 700 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto('http://localhost:4310/components/11-settings/index.html');
await page.waitForTimeout(900);
// click each edge chip, screenshot stage only
const states = ['loading','empty','error','offline','permission'];
for (const s of states) {
  await page.click(`.dev-controls .chip[data-state="${s}"]`);
  await page.waitForTimeout(450);
  await page.screenshot({ path: `reviews/11-settings/judge-r1/states/${s}.png`, clip: { x: 50, y: 50, width: 600, height: 600 } });
}
// detail sheet: open Display row
await page.click('.dev-controls .chip[data-state="normal"]');
await page.waitForTimeout(400);
await page.click('.stage [aria-label^="Display brightness"]');
await page.waitForTimeout(600);
await page.screenshot({ path: 'reviews/11-settings/judge-r1/states/sheet-display.png', clip: { x: 50, y: 50, width: 600, height: 600 } });
// close sheet, open lens access sheet
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
const lens = await page.$('.stage [aria-label*="Lens"]');
if (lens) { await lens.click(); await page.waitForTimeout(600); }
await page.screenshot({ path: 'reviews/11-settings/judge-r1/states/sheet-lens.png', clip: { x: 50, y: 50, width: 600, height: 600 } });
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
// search: type to trigger inline empty
await page.click('#searchInput').catch(()=>{});
await page.keyboard.type('zzz');
await page.waitForTimeout(500);
await page.screenshot({ path: 'reviews/11-settings/judge-r1/states/search-empty.png', clip: { x: 50, y: 50, width: 600, height: 600 } });
console.log(JSON.stringify({ errors }, null, 2));
await browser.close();
