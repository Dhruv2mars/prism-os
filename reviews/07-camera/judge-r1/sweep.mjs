import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const out = '/Users/dhruv2mars/dev/github/prism-os/reviews/07-camera/judge-r1';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1120, height: 820 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(m.type() + ': ' + m.text()); });

await page.goto('http://localhost:4310/components/07-camera/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

async function stageShot(name) {
  await page.waitForTimeout(650);
  await page.locator('.stage').screenshot({ path: `${out}/state-${name}.png` });
}

// 1. empty
await page.evaluate(() => window.__setCameraEdge('empty'));
await stageShot('empty');

// 2. loading
await page.evaluate(() => window.__setCameraEdge('loading'));
await stageShot('loading');

// 3. error
await page.evaluate(() => window.__setCameraEdge('error'));
await stageShot('error');

// 4. offline
await page.evaluate(() => window.__setCameraEdge('offline'));
await stageShot('offline');

// 5. permission
await page.evaluate(() => window.__setCameraEdge('permission'));
await stageShot('permission');

// 6. back to normal, capture a photo
await page.evaluate(() => window.__setCameraEdge('normal'));
await page.evaluate(() => window.__doCapture());
await stageShot('after-capture');

// 7. video mode + start recording (timer running)
await page.evaluate(() => window.__setCameraMode('video'));
await page.evaluate(() => window.__doCapture());
await stageShot('recording');

// stop recording
await page.evaluate(() => window.__doCapture());
await stageShot('after-video-stop');

// 8. grid on
await page.evaluate(() => document.getElementById('gridBtn').click());
await stageShot('grid-on');

// 9. countdown 3s mid-count
await page.evaluate(() => document.getElementById('countdownBtn').click());
await page.evaluate(() => window.__doCapture());
await page.waitForTimeout(900);
await stageShot('countdown');

// wait for capture to finish
await page.waitForTimeout(3000);

// 10. context sheet via long-press on viewfinder
const vf = await page.locator('#vfCard').boundingBox();
await page.mouse.move(vf.x + vf.width / 2, vf.y + vf.height / 2);
await page.mouse.down();
await page.waitForTimeout(700);
await page.mouse.up();
await stageShot('ctx-sheet');

// 11. text scale 2x — emulate by zooming stage content via font-size bump on root of stage
const p2 = await ctx.newPage();
await p2.goto('http://localhost:4310/components/07-camera/index.html', { waitUntil: 'networkidle' });
await p2.waitForTimeout(500);
await p2.evaluate(() => { document.querySelector('.stage').style.fontSize = '200%'; });
await p2.locator('.stage').screenshot({ path: `${out}/stage-textscale2x.png` });

console.log(JSON.stringify({ errors }, null, 2));
await browser.close();
