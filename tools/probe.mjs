#!/usr/bin/env bun
/* Prism OS probe + gate.
   usage: bun tools/probe.mjs <url> [outdir]

   Screenshots the stage, then enforces the gate. The gate encodes the defects
   that recurred across 22 critic verdicts so a builder cannot ship them again:
   dev chrome inside the stage, engineering tokens in user-visible copy, stage
   overflow, unhonored reduced motion, console/page errors.

   Exit 0 = gate green. Exit 1 = gate red, fix before reporting done. */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const url = process.argv[2];
const outArg = process.argv[3];
if (!url) { console.error('usage: bun tools/probe.mjs <url> [outdir]'); process.exit(2); }
if (outArg?.startsWith('-')) {
  console.error(`outdir looks like a flag: ${outArg}\nusage: bun tools/probe.mjs <url> [outdir]`);
  process.exit(2);
}
const out = resolve(outArg ?? `reviews/probe-${Date.now()}`);
mkdirSync(out, { recursive: true });

/* Engineering vocabulary that must never reach a user's eyes. Matched against
   RENDERED text, not source — `class="tabular"` is correct, the word "tabular"
   painted on the display is a defect. */
const DEV_TOKENS = [
  'tabular', 'prism-ease', 'cubic-bezier', 'var(--', 'mat-glass', 'mat-raised',
  'mat-sheet', 'ink-40', 'ink-60', 'ink-80', 'stroke-focus', 'gaze-focus',
  'dur-base', 'ease-prism', 'r-pill', 'sp-4', 'backdrop-filter', 'z-index',
  'innerHTML', 'undefined', 'NaN', '[object Object]',
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1120, height: 820 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

const consoleMsgs = [];
const pageErrors = [];
const failedReqs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) consoleMsgs.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => pageErrors.push(String(e)));
page.on('requestfailed', (r) => failedReqs.push(`${r.url()} :: ${r.failure()?.errorText}`));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);

const FOCUS_SEL = '[data-focusable],button,a,[role="button"],[role="tab"],[role="switch"],input,select,textarea';

const audit = await page.evaluate(({ FOCUS_SEL, DEV_TOKENS }) => {
  const stage = document.querySelector('.stage');
  const q = (s, root = document) => [...root.querySelectorAll(s)];
  const vis = (el) => {
    if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.02;
  };

  const allFocus = q(FOCUS_SEL).filter(vis);
  const inStage = stage ? allFocus.filter((el) => stage.contains(el)) : [];
  const inLab = allFocus.filter((el) => el.closest('[data-lab]'));

  /* dev chrome inside the stage: the top defect across every verdict */
  const labInsideStage = stage ? q('[data-lab],.lab-rail,.lab-btn', stage).length : 0;

  /* rendered-text token leak scan — walk visible text nodes only */
  const leaks = [];
  if (stage) {
    const walker = document.createTreeWalker(stage, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const t = n.nodeValue.trim();
      if (!t) continue;
      const parent = n.parentElement;
      if (!parent || !vis(parent)) continue;
      for (const tok of DEV_TOKENS) {
        if (t.toLowerCase().includes(tok.toLowerCase())) {
          leaks.push({ token: tok, text: t.slice(0, 90), el: parent.tagName + '.' + (parent.className || '') });
        }
      }
    }
  }

  /* focus discipline heuristic: how many elements read as "loud" at rest.
     Loud = large-ish, high opacity, and either accent-tinted, bordered bright,
     or set in heavy/large type. One is the target; many is the failure. */
  let loud = [];
  if (stage) {
    loud = q('*', stage).filter((el) => {
      if (el.closest('[data-lab]') || el.hasAttribute('data-world')) return false;
      if (!vis(el)) return false;
      const r = el.getBoundingClientRect();
      if (r.width < 34 || r.height < 22) return false;
      if (r.width > 560 && r.height > 520) return false; /* full-bleed containers */
      const cs = getComputedStyle(el);
      if (parseFloat(cs.opacity) < 0.7) return false;
      const fs = parseFloat(cs.fontSize) || 0;
      const fw = parseInt(cs.fontWeight) || 400;
      const bigType = fs >= 20 || (fs >= 15 && fw >= 650);
      const bg = cs.backgroundColor || '';
      const m = bg.match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\)/);
      const bgA = m ? (m[4] === undefined ? 1 : parseFloat(m[4])) : 0;
      const tinted = bgA > 0.3;
      const glow = (cs.boxShadow || '').includes('rgb') && !(cs.boxShadow || '').includes('inset');
      return bigType || tinted || glow;
    }).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`);
  }

  /* material honesty: alpha of the largest surfaces sitting over the world */
  const surfaces = stage ? q('*', stage).filter((el) => {
    if (el.closest('[data-lab]') || el.hasAttribute('data-world') || !vis(el)) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 140 && r.height >= 80;
  }).slice(0, 40).map((el) => {
    const cs = getComputedStyle(el);
    return {
      el: `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`,
      bg: cs.backgroundColor, bgImage: (cs.backgroundImage || '').slice(0, 70),
      backdrop: cs.backdropFilter || cs.webkitBackdropFilter || 'none',
    };
  }) : [];

  const unlabeled = inStage.filter((el) => {
    const label = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || '').trim();
    return label.length === 0;
  });
  const tiny = (stage ? q('*', stage) : []).filter((el) => {
    if (el.closest('[data-lab]')) return false;
    if (!el.childNodes.length || !el.textContent.trim() || el.children.length) return false;
    return parseFloat(getComputedStyle(el).fontSize) < 10;
  });

  let sheetHasReducedMotion = false;
  for (const sheet of document.styleSheets) {
    try { for (const r of sheet.cssRules) { if (r.media?.mediaText.includes('prefers-reduced-motion')) sheetHasReducedMotion = true; } }
    catch { /* cross-origin sheet */ }
  }

  const scroller = stage?.querySelector('.stage-scroll');
  const overflow = stage ? {
    stageScrollH: stage.scrollHeight, stageClientH: stage.clientHeight,
    innerScrollH: scroller?.scrollHeight ?? null, innerClientH: scroller?.clientHeight ?? null,
  } : null;

  const labStates = [...document.querySelectorAll('[data-lab] .lab-btn')]
    .map((b) => b.textContent.trim());

  return {
    stagePresent: !!stage,
    stageSize: stage ? `${stage.offsetWidth}x${stage.offsetHeight}` : null,
    inStageFocusables: inStage.length,
    labFocusables: inLab.length,
    totalFocusables: allFocus.length,
    labInsideStage,
    devTokenLeaks: leaks,
    loudElementCount: loud.length,
    loudElements: loud.slice(0, 24),
    surfaces: surfaces.slice(0, 12),
    unlabeledIconButtons: unlabeled.map((e) => e.outerHTML.slice(0, 90)),
    subTenPxTextCount: tiny.length,
    reducedMotionSupport: sheetHasReducedMotion,
    hasLab: !!document.querySelector('[data-lab]'),
    labControls: labStates,
    overflow,
    title: document.title,
  };
}, { FOCUS_SEL, DEV_TOKENS });

/* sweep gaze across the stage to exercise hover/focus, then rest slightly high */
const box = await page.locator('.stage').boundingBox().catch(() => null);
if (box) {
  for (let i = 0; i <= 20; i++) {
    await page.mouse.move(box.x + (box.width / 20) * i, box.y + box.height * 0.5, { steps: 2 });
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.35);
}
await page.waitForTimeout(700);

await page.screenshot({ path: `${out}/full.png`, fullPage: false });
if (box) await page.locator('.stage').screenshot({ path: `${out}/stage.png` });

/* capture every lab state so edge states are visible without code changes */
const shots = ['full.png', 'stage.png'];
const stateBtns = await page.$$('[data-lab] .lab-group:first-of-type .lab-btn');
for (let i = 0; i < stateBtns.length && i < 8; i++) {
  const name = (await stateBtns[i].textContent())?.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || `s${i}`;
  await stateBtns[i].click();
  await page.waitForTimeout(650);
  const f = `stage-${name}.png`;
  await page.locator('.stage').screenshot({ path: `${out}/${f}` }).catch(() => {});
  shots.push(f);
}

/* reduced-motion pass: does the surface actually still work with motion off */
const rmPage = await ctx.newPage();
await rmPage.emulateMedia({ reducedMotion: 'reduce' });
const rmErrors = [];
rmPage.on('pageerror', (e) => rmErrors.push(String(e)));
await rmPage.goto(url, { waitUntil: 'networkidle' });
await rmPage.waitForTimeout(900);
const rmCheck = await rmPage.evaluate(() => {
  const stage = document.querySelector('.stage');
  if (!stage) return { ok: false, why: 'no stage' };
  const animating = [...stage.querySelectorAll('*')].filter((el) => {
    const cs = getComputedStyle(el);
    const dur = (cs.animationDuration || '0s').split(',').map((d) => parseFloat(d) * (d.includes('ms') ? 1 : 1000));
    const inf = (cs.animationIterationCount || '').includes('infinite');
    return inf && Math.max(...dur, 0) > 50;
  }).length;
  return { ok: animating === 0, infiniteAnimations: animating, contentPresent: stage.innerText.trim().length > 0 };
});
await rmPage.locator('.stage').screenshot({ path: `${out}/stage-reduced-motion.png` }).catch(() => {});
shots.push('stage-reduced-motion.png');
await rmPage.close();

/* ------------------------------------------------------------------ gate --- */
const violations = [];
if (consoleMsgs.length) violations.push(`console: ${consoleMsgs.length} error/warning — ${consoleMsgs[0]}`);
if (pageErrors.length) violations.push(`pageerror: ${pageErrors.length} — ${pageErrors[0]}`);
if (failedReqs.length) violations.push(`failed request: ${failedReqs[0]}`);
if (!audit.stagePresent) violations.push('no .stage element');
else if (audit.stageSize !== '600x600') violations.push(`stage is ${audit.stageSize}, must be 600x600`);
if (audit.labInsideStage > 0) violations.push(`${audit.labInsideStage} lab/dev control(s) INSIDE the stage — dev chrome must live in the rail`);
if (audit.devTokenLeaks.length) {
  const t = [...new Set(audit.devTokenLeaks.map((l) => l.token))].join(', ');
  violations.push(`engineering token(s) rendered as user-facing text: ${t} — e.g. "${audit.devTokenLeaks[0].text}"`);
}
if (!audit.reducedMotionSupport) violations.push('no prefers-reduced-motion rule found');
if (!rmCheck.ok) violations.push(`reduced motion not honored: ${rmCheck.infiniteAnimations} infinite animation(s) still running`);
if (rmErrors.length) violations.push(`pageerror under reduced motion: ${rmErrors[0]}`);
if (audit.overflow && audit.overflow.stageScrollH > audit.overflow.stageClientH + 2) {
  violations.push(`stage itself overflows (${audit.overflow.stageScrollH} > ${audit.overflow.stageClientH}) — content truncated; use .stage-scroll for intentional scroll`);
}
if (audit.unlabeledIconButtons.length) violations.push(`${audit.unlabeledIconButtons.length} focusable(s) with no accessible name`);
if (audit.subTenPxTextCount > 0) violations.push(`${audit.subTenPxTextCount} text node(s) under 10px`);

const warnings = [];
if (!audit.hasLab) warnings.push('no lab rail mounted — critics cannot reach edge states; import mountLab from /os/shared/lab.js');
if (audit.inStageFocusables > 12) warnings.push(`${audit.inStageFocusables} in-stage focusables at rest — dense for a 600x600 glasses display`);
if (audit.loudElementCount > 4) warnings.push(`focus discipline: ${audit.loudElementCount} elements read as loud at rest, target is 1 — ${audit.loudElements.slice(0, 8).join(', ')}`);

const gate = { pass: violations.length === 0, violations, warnings };
const report = {
  url, probedAt: new Date().toISOString(),
  gate, consoleMsgs, pageErrors, failedReqs,
  reducedMotion: rmCheck, screenshots: shots,
  ...audit,
};
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));

console.log(JSON.stringify(report, null, 2));
console.log('\n' + '='.repeat(60));
console.log(gate.pass ? 'GATE: PASS' : `GATE: FAIL (${violations.length})`);
violations.forEach((v) => console.log('  x ' + v));
warnings.forEach((w) => console.log('  ! ' + w));
console.log(`screenshots: ${out}`);
console.log('='.repeat(60));

await browser.close();
process.exit(gate.pass ? 0 : 1);
