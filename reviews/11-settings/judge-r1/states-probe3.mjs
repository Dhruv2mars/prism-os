import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 700, height: 700 } });
await page.goto('http://localhost:4310/components/11-settings/index.html');
await page.waitForTimeout(900);
// 1) inspect row + click wiring
const diag1 = await page.evaluate(() => {
  const row = document.querySelector('.stage [aria-label^="Display brightness"]');
  const sheet = document.getElementById('detailSheet');
  const r = row.getBoundingClientRect(), s = sheet.getBoundingClientRect();
  return {
    rowRect: { x: r.x, y: r.y, w: r.width, h: r.height },
    sheetClass: sheet.className,
    sheetRect: { x: s.x, y: s.y, w: s.width, h: s.height },
    sheetDisplay: getComputedStyle(sheet).display,
    sheetVisibility: getComputedStyle(sheet).visibility,
    sheetOpacity: getComputedStyle(sheet).opacity,
    sheetHTMLlen: sheet.innerHTML.length,
  };
});
console.log('BEFORE CLICK', JSON.stringify(diag1));
await page.click('.stage [aria-label^="Display brightness"]');
await page.waitForTimeout(900);
const diag2 = await page.evaluate(() => {
  const sheet = document.getElementById('detailSheet');
  const s = sheet.getBoundingClientRect();
  return { sheetClass: sheet.className, sheetRect: { x: s.x, y: s.y, w: s.width, h: s.height }, sheetDisplay: getComputedStyle(sheet).display, sheetHTMLlen: sheet.innerHTML.length };
});
console.log('AFTER CLICK', JSON.stringify(diag2));
// 2) search filter diagnosis
const diag3 = await page.evaluate(() => {
  const inp = document.getElementById('searchInput');
  inp.focus();
  inp.value = 'zzzz';
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  return new Promise(res => setTimeout(() => {
    const groups = [...document.querySelectorAll('.stage .group')];
    const viewport = document.querySelector('.set-viewport');
    res({
      inputValue: inp.value,
      groupCount: groups.length,
      viewportHTMLsnippet: viewport.innerHTML.slice(0, 300),
      hasInlineEmpty: !!document.querySelector('.stage .card'),
    });
  }, 700));
});
console.log('AFTER SEARCH', JSON.stringify(diag3, null, 2));
await page.screenshot({ path: 'reviews/11-settings/judge-r1/states/search-empty3.png', clip: { x: 50, y: 50, width: 600, height: 600 } });
await browser.close();
