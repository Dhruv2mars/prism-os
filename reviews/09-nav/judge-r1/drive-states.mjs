import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1020 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto('http://localhost:4310/components/09-nav/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const states = ['loading','empty','error','offline','permission'];
const stage = await page.locator('.stage').boundingBox();
for (const s of states) {
  await page.evaluate(id => window.__setNavState(id), s);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `reviews/09-nav/judge-r1/states/state-${s}.png`, clip: stage });
}
await page.evaluate(() => window.__setNavState('normal'));
await page.waitForTimeout(400);
await page.locator('#turnCard').click();
await page.waitForTimeout(600);
await page.locator('#turnCard').click();
await page.waitForTimeout(600);
await page.screenshot({ path: 'reviews/09-nav/judge-r1/states/normal-step3.png', clip: stage });
await page.locator('#turnCard').click();
await page.waitForTimeout(400);
await page.locator('#turnCard').click();
await page.waitForTimeout(700);
await page.screenshot({ path: 'reviews/09-nav/judge-r1/states/normal-arrived.png', clip: stage });
await page.locator('.toggle').click();
await page.waitForTimeout(600);
await page.screenshot({ path: 'reviews/09-nav/judge-r1/states/toll-on.png', clip: stage });
await page.locator('.ctrl-btn.primary').click();
await page.waitForTimeout(1400);
await page.screenshot({ path: 'reviews/09-nav/judge-r1/states/reroute.png', clip: stage });
await page.locator('#muteBtn').click();
await page.waitForTimeout(400);
await page.screenshot({ path: 'reviews/09-nav/judge-r1/states/muted.png', clip: stage });
// text scale 2x
const ctx2 = await browser.newContext({ viewport: { width: 1400, height: 1020 } });
const p2 = await ctx2.newPage();
await p2.goto('http://localhost:4310/components/09-nav/index.html', { waitUntil: 'networkidle' });
await p2.addStyleTag({ content: 'html{font-size:30px !important}' });
await p2.waitForTimeout(500);
await p2.screenshot({ path: 'reviews/09-nav/judge-r1/states/textscale.png', clip: stage });
// gaze focus: move mouse over mute button (gaze cursor follows pointer presumably)
const ctx3 = await browser.newContext({ viewport: { width: 1400, height: 1020 } });
const p3 = await ctx3.newPage();
await p3.goto('http://localhost:4310/components/09-nav/index.html', { waitUntil: 'networkidle' });
await p3.waitForTimeout(400);
const mb = await p3.locator('#muteBtn').boundingBox();
await p3.mouse.move(mb.x + mb.width/2, mb.y + mb.height/2);
await p3.waitForTimeout(600);
await p3.screenshot({ path: 'reviews/09-nav/judge-r1/states/gaze-focus.png', clip: stage });
// hold dwell to see dwell ring / activation
await p3.waitForTimeout(900);
await p3.screenshot({ path: 'reviews/09-nav/judge-r1/states/gaze-dwell.png', clip: stage });
console.log(JSON.stringify({ errors }, null, 2));
await browser.close();
