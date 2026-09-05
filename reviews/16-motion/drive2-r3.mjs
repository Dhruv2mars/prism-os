import { chromium } from 'playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1120, height: 820 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto('http://localhost:4310/components/16-motion/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const stage = page.locator('.stage');
const out = '/Users/dhruv2mars/dev/github/prism-os/reviews/16-motion/judge-r3';

// 1. outdoor world, card state: contrast check
await page.evaluate(() => {
  const b = [...document.querySelectorAll('[data-lab] .lab-btn')].find((x) => x.textContent.trim() === 'Outdoor');
  b?.click();
});
await page.waitForTimeout(600);
await stage.screenshot({ path: `${out}/w-outdoor-card.png` });
await page.evaluate(() => {
  const b = [...document.querySelectorAll('[data-lab] .lab-btn')].find((x) => x.textContent.trim() === 'Gaze lands on the card');
  b?.click();
});
await page.waitForTimeout(500);
await stage.screenshot({ path: `${out}/w-outdoor-lit.png` });
await page.evaluate(() => {
  const b = [...document.querySelectorAll('[data-lab] .lab-btn')].find((x) => x.textContent.trim() === 'Permission denied');
  b?.click();
});
await page.waitForTimeout(500);
await stage.screenshot({ path: `${out}/w-outdoor-denied.png` });

// 2. interrupt continuity: sample tray+card heights during a choppy gaze on/off storm
await page.evaluate(() => {
  const b = [...document.querySelectorAll('[data-lab] .lab-btn')].find((x) => x.textContent.trim() === 'Ready');
  b?.click();
});
await page.waitForTimeout(700);
const samples = await page.evaluate(async () => {
  const btns = [...document.querySelectorAll('[data-lab] .lab-btn')];
  const byLabel = (t) => btns.find((b) => b.textContent.trim() === t);
  const card = document.querySelector('[data-card]');
  const tray = card.querySelector('[data-tray]');
  const out2 = [];
  const t0 = performance.now();
  byLabel('Gaze lands on the card')?.click();
  const iv = setInterval(() => {
    out2.push({
      t: Math.round(performance.now() - t0),
      card: Math.round(card.getBoundingClientRect().height),
      tray: Math.round(tray.getBoundingClientRect().height),
      running: card.getAnimations().length + tray.getAnimations().length,
    });
  }, 40);
  setTimeout(() => byLabel('Gaze leaves the card')?.click(), 120);
  setTimeout(() => byLabel('Gaze lands on the card')?.click(), 220);
  setTimeout(() => byLabel('Gaze leaves the card')?.click(), 300);
  await new Promise((r) => setTimeout(r, 800));
  clearInterval(iv);
  return out2;
});
console.log('INTERRUPT SAMPLES (t,cardH,trayH,runningAnims)');
console.log(samples.map((s) => `${s.t}ms card=${s.card} tray=${s.tray} anims=${s.running}`).join('\n'));

// 3. keyboard reachability inside stage: tab to card, enter expands
await page.evaluate(() => {
  const b = [...document.querySelectorAll('[data-lab] .lab-btn')].find((x) => x.textContent.trim() === 'Ready');
  b?.click();
});
await page.waitForTimeout(700);
await page.keyboard.press('Tab');
const focused = await page.evaluate(() => {
  const a = document.activeElement;
  return { tag: a.tagName, cls: a.className, inStage: !!a.closest('.stage'), label: a.getAttribute('aria-label')?.slice(0, 60) };
});
console.log('FOCUSED AFTER TAB:', JSON.stringify(focused));
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
await stage.screenshot({ path: `${out}/w-keyboard-expand.png` });
const expanded = await page.evaluate(() => document.querySelector('[data-card]')?.getAttribute('aria-expanded'));
console.log('ARIA-EXPANDED AFTER ENTER:', expanded);

await browser.close();
