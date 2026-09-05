import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const out = '/Users/dhruv2mars/dev/github/prism-os/reviews/16-motion/judge-r3';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1120, height: 820 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

await page.goto('http://localhost:4310/components/16-motion/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
const stage = page.locator('.stage');

// --- 1. measure real animation durations on the card entrance ---
const timings = await page.evaluate(() => new Promise((res) => {
  const surface = document.querySelector('main.surface');
  const before = surface.getAnimations();
  // trigger a fresh paint via lab action "A message arrives" equivalent: step via keyboard
  // instead measure what's available: run a state flip through lab buttons
  const btns = [...document.querySelectorAll('[data-lab] .lab-btn')];
  const byLabel = (t) => btns.find((b) => b.textContent.trim() === t);
  const anims = [];
  const obs = new PerformanceObserver((list) => {
    for (const e of list.getEntries()) anims.push({ name: e.animationName ?? '', dur: e.duration });
  });
  try { obs.observe({ type: 'animation', buffered: true }); } catch {}
  byLabel('Loading')?.click();
  setTimeout(() => {
    const wa = surface.querySelector('.edge')?.getAnimations({ subtree: true }).map(a => ({
      dur: a.effect?.getTiming().duration, easing: a.effect?.getTiming().easing,
    })) ?? [];
    res({ webAnims: wa, cssAnims: anims.filter(a => a.dur > 1) });
  }, 200);
}));
console.log('TIMINGS', JSON.stringify(timings));

// helper: click lab button by label
const act = async (t) => {
  const ok = await page.evaluate((label) => {
    const b = [...document.querySelectorAll('[data-lab] .lab-btn')].find((x) => x.textContent.trim() === label);
    if (b) { b.click(); return true; } return false;
  }, t);
  return ok;
};
const shot = (n) => stage.screenshot({ path: `${out}/${n}.png` });
const shotAt = async (n, ms) => { await page.waitForTimeout(ms); await shot(n); };

// --- 2. states ---
await act('Loading');   await shotAt('s-loading', 400);
await act('Empty');     await shotAt('s-empty', 400);
await act('Error');     await shotAt('s-error', 400);
await act('Offline');   await shotAt('s-offline', 400);
await act('Permission denied'); await shotAt('s-denied', 400);

// back to ready
await act('Ready'); await page.waitForTimeout(700);

// --- 3. signature move: gaze lands on card (tray grows) ---
await act('Gaze lands on the card');
await page.waitForTimeout(60);  await shot('m1-grow-early');
await page.waitForTimeout(120); await shot('m2-grow-mid');
await page.waitForTimeout(300); await shot('m3-grow-done');

// gaze leaves -> closes
await act('Gaze leaves the card');
await page.waitForTimeout(150); await shot('m4-close-mid');
await page.waitForTimeout(400); await shot('m5-close-done');

// --- 4. open thread (expand detail) ---
await act('Open the thread');
await page.waitForTimeout(120); await shot('m6-thread-mid');
await page.waitForTimeout(350); await shot('m7-thread-done');

// --- 5. interrupt the grow mid-flight ---
await act('Ready'); await page.waitForTimeout(600);
await act('Interrupt the grow');
await shot('m8-interrupt-grow-a');
await page.waitForTimeout(60); await shot('m9-interrupt-grow-b');
await page.waitForTimeout(500); await shot('m10-interrupt-grow-settled');

// --- 6. dismiss + undo trail ---
await act('Ready'); await page.waitForTimeout(600);
await act('Dismiss with a flick');
await page.waitForTimeout(100); await shot('m11-exit-mid');
await page.waitForTimeout(500); await shot('m12-exit-done');
await act('Undo the dismiss');
await page.waitForTimeout(500); await shot('m13-undo');

// --- 7. reply failure inline ---
await act('Ready'); await page.waitForTimeout(600);
await act('Reply fails to send');
await page.waitForTimeout(200); await shot('m14-listening');
await page.waitForTimeout(600); await shot('m15-fail-inline');

// --- 8. two dismisses at once ---
await act('Ready'); await page.waitForTimeout(600);
await act('Two dismisses at once');
await page.waitForTimeout(100); await shot('m16-two-dismiss-mid');
await page.waitForTimeout(600); await shot('m17-two-dismiss-done');

// --- 9. text scale 170% ---
await page.evaluate(() => {
  const r = document.querySelector('[data-lab] input[type="range"]');
  if (r) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(r, '170');
    r.dispatchEvent(new Event('input', { bubbles: true }));
    r.dispatchEvent(new Event('change', { bubbles: true }));
  }
});
await page.waitForTimeout(500);
await shot('x1-scale170');
// does it scroll? content height
const scroll170 = await page.evaluate(() => {
  const s = document.querySelector('main.surface');
  return { sh: s.scrollHeight, ch: s.clientHeight };
});
console.log('SCALE170 scroll', JSON.stringify(scroll170));

// --- 10. reduced motion + action ---
const rmPage = await ctx.newPage();
await rmPage.emulateMedia({ reducedMotion: 'reduce' });
await rmPage.goto('http://localhost:4310/components/16-motion/index.html', { waitUntil: 'networkidle' });
await rmPage.waitForTimeout(800);
await rmPage.evaluate(() => {
  const b = [...document.querySelectorAll('[data-lab] .lab-btn')].find((x) => x.textContent.trim() === 'Dismiss with a flick');
  b?.click();
});
await rmPage.waitForTimeout(300);
await rmPage.locator('.stage').screenshot({ path: `${out}/x2-reduced-motion-dismiss.png` });
const rmStill = await rmPage.evaluate(() => document.querySelector('main.surface').innerText.slice(0, 120));
console.log('RM after dismiss:', JSON.stringify(rmStill));

console.log('PAGE ERRORS:', JSON.stringify(errs));
await browser.close();
