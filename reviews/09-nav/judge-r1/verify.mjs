import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1020 } });
await page.goto('http://localhost:4310/components/09-nav/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
console.log('INITIAL header:', await page.locator('#routeSummary').innerText(), '|', await page.locator('#etaPill').innerText());
await page.locator('.toggle').click();
await page.waitForTimeout(600);
console.log('TOLL-ON header:', await page.locator('#routeSummary').innerText(), '|', await page.locator('#etaPill').innerText());
console.log('TOLL-ON progressMeta:', await page.locator('#progressMeta').innerText());
// gaze cursor visible?
const gaze = await page.evaluate(() => {
  const g = document.querySelector('.gaze-cursor, [class*="gaze"]');
  return g ? getComputedStyle(g).display : 'none-found';
});
console.log('gaze cursor el:', gaze);
// arrive flow
await page.evaluate(() => window.__setNavState('normal'));
for (let i=0;i<4;i++){ await page.locator('#turnCard').click(); await page.waitForTimeout(350); }
await page.waitForTimeout(300);
console.log('AFTER 4 clicks turnCard text:', (await page.locator('#turnCard').innerText()).replace(/\s+/g,' '));
const stage = await page.locator('.stage').boundingBox();
await page.screenshot({ path: 'reviews/09-nav/judge-r1/states/arrived-real.png', clip: stage });
await browser.close();
