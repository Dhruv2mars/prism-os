import { chromium } from 'playwright';

const base = 'http://localhost:4310/components/03-wm/index.html';
const outDir = 'reviews/03-wm/judge-r1';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE-ERR:', m.text()); });

async function shoot(url, name, actions) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  if (actions) await actions();
  await page.waitForTimeout(400);
  const stage = page.locator('[data-stage]');
  await stage.screenshot({ path: `${outDir}/${name}.png` });
  console.log('shot', name);
}

await shoot(base, 'drive-overview', async () => {
  await page.evaluate(() => window.__wm.toggleOverview(true));
});
await shoot(base, 'drive-tiled', async () => {
  await page.evaluate(() => { window.__wm.setEdgeState('normal'); window.__wm.toggleOverview(false); });
  await page.getByRole('button', { name: 'Tiled layout' }).click();
});
await shoot(base, 'drive-limit', async () => {
  await page.evaluate(() => { window.__wm.setEdgeState('normal'); });
  for (let i = 0; i < 4; i++) await page.evaluate(() => window.__wm.openNewWindow());
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__wm.openNewWindow());
});
await shoot(base, 'drive-opened', async () => {
  await page.evaluate(() => window.__wm.openNewWindow());
});
await shoot(base, 'drive-minimized', async () => {
  await page.evaluate(() => { window.__wm.setEdgeState('normal'); window.__wm.toggleOverview(false); });
  await page.evaluate(() => { const t = document.querySelector('[data-stage] .win-layer:last-child')?.dataset.app; });
  await page.getByRole('button', { name: 'Minimize top' }).click();
  await page.waitForTimeout(500);
});
await shoot(base + '?scale=1.4', 'drive-scale14');
await shoot(base + '?world=night', 'drive-night');

await browser.close();
console.log('done');
