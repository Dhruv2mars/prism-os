#!/usr/bin/env bun
/* Probe harness: screenshot + audit a component page.
   usage: bun tools/probe.mjs <url> [outdir] */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const url = process.argv[2];
const out = resolve(process.argv[3] ?? `reviews/probe-${Date.now()}`);
if (!url) { console.error('usage: bun tools/probe.mjs <url> [outdir]'); process.exit(2); }
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 900 }, deviceScaleFactor: 2 });

const consoleMsgs = [];
const pageErrors = [];
const failedReqs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) consoleMsgs.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => pageErrors.push(String(e)));
page.on('requestfailed', (r) => failedReqs.push(`${r.url()} :: ${r.failure()?.errorText}`));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

const audit = await page.evaluate(() => {
  const stage = document.querySelector('.stage');
  const q = (s) => [...document.querySelectorAll(s)];
  const focusables = q('[data-focusable],button,a,[role="button"],[role="tab"],input,[role="switch"]').filter((el) => el.offsetParent !== null);
  const unlabeled = focusables.filter((el) => {
    const label = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || '').trim();
    return label.length === 0;
  });
  const tiny = q('*').filter((el) => {
    if (!el.childNodes.length || !el.textContent.trim()) return false;
    if (el.children.length) return false;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    return fs < 10;
  });
  const lowAlpha = q('*').filter((el) => {
    if (el.children.length || !el.textContent.trim()) return false;
    const c = getComputedStyle(el).color;
    const m = c.match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\)/);
    if (!m) return false;
    const a = m[4] === undefined ? 1 : parseFloat(m[4]);
    return a < 0.38;
  });
  let sheetHasReducedMotion = false;
  for (const sheet of document.styleSheets) {
    try { for (const r of sheet.cssRules) { if (r.media?.mediaText.includes('prefers-reduced-motion')) sheetHasReducedMotion = true; } }
    catch {}
  }
  const offscreen = focusables.filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width === 0 || r.height === 0;
  }).length;
  return {
    stagePresent: !!stage,
    stageSize: stage ? `${stage.offsetWidth}x${stage.offsetHeight}` : null,
    focusableCount: focusables.length,
    unlabeledIconButtons: unlabeled.map((e) => e.outerHTML.slice(0, 90)),
    subTenPxTextCount: tiny.length,
    lowAlphaTextCount: lowAlpha.length,
    reducedMotionSupport: sheetHasReducedMotion,
    hiddenFocusables: offscreen,
    title: document.title,
  };
});

/* sweep gaze across the stage to exercise hover/focus states, then rest center */
const box = await page.locator('.stage').boundingBox().catch(() => null);
if (box) {
  for (let i = 0; i <= 20; i++) {
    await page.mouse.move(box.x + (box.width / 20) * i, box.y + box.height * 0.5, { steps: 2 });
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.35);
}
await page.waitForTimeout(700);

await page.screenshot({ path: `${out}/full.png`, fullPage: false });
if (box) {
  await page.locator('.stage').screenshot({ path: `${out}/stage.png` });
}

const report = { url, probedAt: new Date().toISOString(), consoleMsgs, pageErrors, failedReqs, ...audit };
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
