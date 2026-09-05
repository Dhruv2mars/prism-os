import { chromium } from 'playwright';

const BASE = 'http://localhost:4310/components/17-audio-haptics/index.html';
const OUT = '/Users/dhruv2mars/dev/github/prism-os/reviews/17-audio-haptics/judge-r3';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await page.goto(BASE, { waitUntil: 'networkidle' });

// 1. drag the field to ~120 deg right and read bearing
const field = page.locator('.field');
const box = await field.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 + box.width * 0.42, box.y + box.height / 2 - box.height * 0.18, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(300);
console.log('after drag bearing:', await page.locator('.bearing').textContent());
await page.screenshot({ path: `${OUT}/stage-dragged.png`, clip: { x: box.x - 10, y: box.y - 10, width: box.width + 20, height: box.height + 20 } });

// 2. keyboard: focus field, arrow right
await page.locator('.field').focus();
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(200);
console.log('after ArrowRight bearing:', await page.locator('.bearing').textContent());

// 3. play a cue and capture mid-animation
await page.getByRole('button', { name: 'Play cue' }).click();
await page.waitForTimeout(120);
await page.locator('[data-stage]').screenshot({ path: `${OUT}/stage-playing.png` });
await page.waitForTimeout(600);
console.log('after play, score lit?', await page.locator('.score').getAttribute('class'));

// 4. tab order walk
await page.goto(BASE, { waitUntil: 'networkidle' });
const order = [];
for (let i = 0; i < 10; i++) {
  await page.keyboard.press('Tab');
  const info = await page.evaluate(() => {
    const a = document.activeElement;
    return a ? `${a.tagName}.${a.className.split(' ')[0] || ''} "${(a.textContent || a.getAttribute('aria-label') || '').slice(0, 22)}"` : 'none';
  });
  order.push(info);
}
console.log('tab order:', JSON.stringify(order, null, 1));

// 5. capture key (Space) fires capture cue
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.keyboard.press('Space');
await page.waitForTimeout(250);
console.log('after Space, cue name:', await page.locator('h1.name').textContent());

// 6. Esc behavior / swipe via arrow keys? temple swipe = arrows in os core
console.log('console errors:', errors.length, errors.slice(0, 5));
await browser.close();
