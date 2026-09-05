import { chromium } from 'playwright';

const out = '/Users/dhruv2mars/dev/github/prism-os/reviews/07-camera/judge-r1';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1120, height: 820 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto('http://localhost:4310/components/07-camera/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

// photo mode + 3s countdown + capture, then wait well past completion
await page.evaluate(() => window.__setCameraMode('photo'));
await page.evaluate(() => document.getElementById('countdownBtn').click());
await page.evaluate(() => window.__doCapture());
await page.waitForTimeout(4500);
await page.locator('.stage').screenshot({ path: `${out}/verify-countdown-aftermath.png` });

// geometry: does strip-wrap bottom exceed the stage?
const geom = await page.evaluate(() => {
  const s = document.querySelector('.stage').getBoundingClientRect();
  const strip = document.querySelector('.strip-wrap')?.getBoundingClientRect();
  const vp = document.querySelector('.cam-viewport').getBoundingClientRect();
  return {
    stageBottom: s.bottom, stripBottom: strip?.bottom, overflowPx: strip ? +(strip.bottom - s.bottom).toFixed(1) : null,
    viewportBottom: vp.bottom,
  };
});
console.log(JSON.stringify(geom, null, 2));
await browser.close();
