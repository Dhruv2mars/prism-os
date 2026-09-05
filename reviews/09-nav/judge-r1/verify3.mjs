import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1020 } });
await page.goto('http://localhost:4310/components/09-nav/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
// hover center of mute button within the stage element itself
const box = await page.locator('#stage, .stage').first().boundingBox();
console.log('stage box:', JSON.stringify(box));
const mute = await page.locator('button[aria-label*="Mute voice"]').boundingBox();
console.log('mute box:', JSON.stringify(mute));
await page.mouse.move(mute.x + mute.width/2, mute.y + mute.height/2);
await page.waitForTimeout(250);
console.log('gaze-focus after hover:', await page.evaluate(() => [...document.querySelectorAll('.gaze-focus')].map(e => e.getAttribute('aria-label'))));
await page.waitForTimeout(900); // exceed dwell 350ms
console.log('after dwell: muted?', await page.evaluate(() => document.body.innerText.includes('Muted')));
console.log('banner text:', await page.evaluate(() => { const b=document.querySelector('.banner, [class*="banner"]'); return b ? b.innerText : 'none'; }));
await page.screenshot({ path: 'reviews/09-nav/judge-r1/states/dwell-result.png' });
await browser.close();
