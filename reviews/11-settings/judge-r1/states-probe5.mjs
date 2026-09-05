import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 700, height: 700 } });
await page.goto('http://localhost:4310/components/11-settings/index.html');
await page.waitForTimeout(1200);
// rest state, full stage crop (stage is 690x690 at 5,5 in 700 viewport)
await page.screenshot({ path: 'reviews/11-settings/judge-r1/states/rest-full.png', clip: { x: 5, y: 5, width: 690, height: 690 } });
// toggle a switch to see feedback
const tog = await page.$('.stage .toggle');
if (tog) { await tog.click(); await page.waitForTimeout(500); }
await page.screenshot({ path: 'reviews/11-settings/judge-r1/states/toggle-feedback.png', clip: { x: 5, y: 5, width: 690, height: 690 } });
await browser.close();
