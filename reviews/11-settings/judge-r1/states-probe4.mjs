import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 700, height: 700 } });
await page.goto('http://localhost:4310/components/11-settings/index.html');
await page.waitForTimeout(900);
await page.click('.stage [aria-label^="Display brightness"]');
await page.waitForTimeout(900);
const m = await page.evaluate(() => {
  const stage = document.querySelector('[data-stage]') || document.querySelector('.stage');
  const sheet = document.getElementById('detailSheet');
  const sr = stage.getBoundingClientRect(), fr = sheet.getBoundingClientRect();
  return { stage: { x: sr.x, y: sr.y, w: sr.width, h: sr.height }, sheet: { x: fr.x, y: fr.y, w: fr.width, h: fr.height },
    sheetOverflowsStage: fr.x < sr.x || fr.y < sr.y || fr.right > sr.right || fr.bottom > sr.bottom,
    stageOverflowCSS: getComputedStyle(stage).overflow };
});
console.log(JSON.stringify(m));
await browser.close();
