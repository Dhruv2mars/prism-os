import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1020 } });
await page.goto('http://localhost:4310/components/09-nav/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
// three clicks -> arrive card
for (let i=0;i<3;i++){ await page.locator('#turnCard').click(); await page.waitForTimeout(400); }
const stage = await page.locator('.stage').boundingBox();
await page.screenshot({ path: 'reviews/09-nav/judge-r1/states/arrive-card.png', clip: stage });
// gaze focus class check
const focus = await page.evaluate(() => {
  const gazed = document.querySelectorAll('.gaze-focus');
  return [...gazed].map(e => e.className);
});
console.log('gaze-focus elements after arrive:', JSON.stringify(focus));
// check core gaze wiring
const hasGaze = await page.evaluate(() => typeof window.__setNavState);
console.log('setNavState exposed:', hasGaze);
await browser.close();
