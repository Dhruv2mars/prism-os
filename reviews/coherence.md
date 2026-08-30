# Prism OS — Coherence Wave 2 — Live Probe Report

**Date:** 2026-08-27 · **Probe:** `bun tools/probe.mjs` @ `http://localhost:4310/components/{00..15}/index.html` + `/index.html` · **Runner:** fresh context · **Server:** `python3 -m http.server 4310` (pid 9125)

Me run 17 probes. All pass base gate.

## 1. Probe Gate — Zero Errors, 600×600, Reduced Motion

All 16 pieces + shell pass strict probe audit. Snapshot + report in `reviews/probe-verify-*`.

| # | Piece | URL | stage | consoleMsgs | pageErrors | failedReqs | focusable | unlabeled | sub10px | lowAlpha | reducedMotion | hiddenFocus | Verdict |
|---|-------|-----|-------|-------------|------------|------------|-----------|-----------|---------|----------|---------------|-------------|---------|
| 00 | foundation | `/00-foundation/index.html` | 600x600 | 0 | 0 | 0 | 19 | 0 | 0 | 0 | true | 0 | **PASS** |
| 01 | boot + recovery | `/01-boot/index.html` | 600x600 | 0 | 0 | 0 | 2 | 0 | 0 | 0 | true | 0 | **PASS** |
| 02 | home | `/02-home/index.html` | 600x600 | 0 | 0 | 0 | 21 | 0 | 0 | 0 | true | 0 | **PASS** |
| 03 | wm | `/03-wm/index.html` | 600x600 | 0 | 0 | 0 | 27 | 0 | 0 | 0 | true | 0 | **PASS** |
| 04 | gestures | `/04-gestures/index.html` | 600x600 | 0 | 0 | 0 | 15 | 0 | 0 | 0 | true | 0 | **PASS** |
| 05 | notifications | `/05-notifications/index.html` | 600x600 | 0 | 0 | 0 | 28 | 0 | 0 | 0 | true | 0 | **PASS** |
| 06 | assistant | `/06-assistant/index.html` | 600x600 | 0 | 0 | 0 | 12 | 0 | 0 | 0 | true | 0 | **PASS** |
| 07 | camera | `/07-camera/index.html` | 600x600 | 0 | 0 | 0 | 23 | 0 | 0 | 0 | true | 0 | **PASS** |
| 08 | captions | `/08-captions/index.html` | 600x600 | 0 | 0 | 0 | 12 | 0 | 0 | 0 | true | 0 | **PASS** |
| 09 | nav | `/09-nav/index.html` | 600x600 | 0 | 0 | 0 | 14 | 0 | 0 | 0 | true | 0 | **PASS** |
| 10 | messages | `/10-messages/index.html` | 600x600 | 0 | 0 | 0 | 20 | 0 | 0 | 0 | true | 0 | **PASS** |
| 11 | settings | `/11-settings/index.html` | 600x600 | 0 | 0 | 0 | 36 | 0 | 0 | 0 | true | 0 | **PASS** |
| 12 | webapps | `/12-webapps/index.html` | 600x600 | 0 | 0 | 0 | 29 | 0 | 0 | 0 | true | 0 | **PASS** |
| 13 | a11y | `/13-a11y/index.html` | 600x600 | 0 | 0 | 0 | 37 | 0 | 0 | 0 | true | 0 | **PASS** |
| 14 | onboarding | `/14-onboarding/index.html` | 600x600 | 0 | 0 | 0 | 17 | 0 | 0 | 0 | true | 0 | **PASS** |
| 15 | hud | `/15-hud/index.html` | 600x600 | 0 | 0 | 0 | 19 | 0 | 0 | 0 | true | 0 | **PASS** |
| — | **shell** | `/index.html` | 600x600 | 0 | 0 | 0 | 19 | 0 | 0 | 0 | true | 0 | **PASS** |

No gaps at probe gate. Stage exact `600x600` via `os/shared/design-system.css:88-100` (.stage). Reduced-motion sheet present in all (`@media (prefers-reduced-motion: reduce)` in design-system.css:265-271 + per-piece overrides). Focus discipline perfect: `unlabeledIconButtons=0`, `hiddenFocusables=0` across board.

## 2. Coherence — 6 Axes

### 2.1 Design Tokens — Mostly Coherent, One Outlier

**Expect:** `var(--mat-glass)`, `var(--mat-raised)`, `var(--mat-sheet)`, `var(--mat-sunken)`, `var(--stroke-glass)`, `var(--stroke-focus)`, `var(--blur-glass)`, `var(--r-lg)`, `var(--accent)` reused, never hard-coded glass.

**Evidence:**

- `os/shared/design-system.css:1-59` defines all tokens. All 16 import it (`<link href="/os/shared/design-system.css">` verified `components/*/index.html:7`). `os/shared/core.js` frozen runtime intact.
- Token refs per file (grep `mat-*` etc): `00:15`, `02:9`, `03:2`, `04:3`, `05:5`, `06:3`, `07:4`, `08:6`, `09:8`, `10:9`, `11:7`, `12:6`, `13:5`, `14:3`, `15:5`, `01:0`. All except `01-boot` use `mat-glass/raised/sheet` directly.
- `01-boot` intentionally uses opaque `background:#020407` for scrim (`components/01-boot/boot.css:10-14`) — valid for boot hardware black, but breaks material honesty pattern. `boot.js:1` still imports `createOS` correctly. Counted as **coherent by exception** (boot world not lens).
- All pieces use `var(--stroke-glass)` + `var(--stroke-focus)` + `var(--blur-glass/heavy)` + `var(--r-lg/pill)` + `var(--ink-*)` + `var(--accent)`. Spot-checked: `02-home:68` token refs, `10-messages:107`, etc.
- No piece hard-codes a glass gradient as raw rgba without token, except boot scrim. Good.

**Coherent?** YES — 15/16 reuse tokens heavily, 01-boot deviation justified. Recommendation: add `/* boot scrim is opaque black — intentional */` comment already present partially, but add token alias `--mat-boot: #020407` to keep token vocabulary pure.

### 2.2 Outside-Stage Dev Chrome — Coherent

**Expect:** Edge-state controls live **outside** `.stage` bounding box, `position:fixed` below stage, `z-index:1000`, not inside `stage.png` screenshot. Guard `.stage .dev-controls{display:none !important}` everywhere.

**Evidence:**

- `components/02-home/index.html:34-63` pattern: `.stage-shell{600x600 grid}` + `.dev-controls{position:fixed; left:50%; bottom:18px; transform:translateX(-50%); z-index:1000; background:rgba(10,15,23,0.74); outline:1px solid var(--stroke-glass); backdrop-filter:blur(16px)}`
- Identical block in `03-wm:24-43` (adds `.edge-row` top + `.wm-toolbar` bottom), `04-gestures:21`, `05-notifications:22-42`, `06-assistant:23`, `07-camera:23-42`, `08-captions:23-42`, `09-nav:23-42`, `10-messages:22-41`, `11-settings:22-41`, `12-webapps:22-41`, `13-a11y:33-52`, `14-onboarding:22-45`, `15-hud:22-41`, `00-foundation:190` (lab-bar as toolbar), `01-boot:196-205` (console-row same pill + fixed).
- All have `.stage .dev-controls{display:none !important}` guard except `00`/`01` which use alternate class names but same effect (`00` lab-bar outside grid, `01` console-row fixed bottom 18px).
- Probe confirms not inside stage: sweep `box` does not capture dev chrome, `stage.png` unchanged.

**Coherent?** YES — pattern consistent across 16. Recommendation: standardize class name to `.dev-controls` everywhere (00 uses `.lab-bar`, 01 uses `.console-row` — rename alias for grep consistency, no functional gap).

### 2.3 Motion — Coherent With Minor Outliers

**Expect:** `cubic-bezier(0.32, 0.72, 0, 1)` via `var(--ease-prism)` (`design-system.css:55`), durations `200-320ms` (`--dur-fast 160ms`, `--dur-base 260ms`, `--dur-slow 380ms`), interruptible, reduced-motion disables to `0.01ms`.

**Evidence:**

- `design-system.css:55-58` defines `--ease-prism` + durations. `core.js:140-172` uses `easing:'cubic-bezier(0.32,0.72,0,1)'` / `var(--ease-prism)` for banner + wm sheet.
- Per-file ease counts: `00:15`, `02:25`, `03:24`, `04:37`, `05:39`, `06:26`, `07:52`, `08:30`, `09:33`, `10:62`, `11:28`, `12:28`, `13:37`, `14:46`, `15:51`, `01-boot.css:11` + `boot.js:13` (EASE constant `'cubic-bezier(0.32, 0.72, 0, 1)'` + `EASE_FN`).
- Durations inside spec `200-320` dominate: `260ms` appears in all files as primary. Outliers >320ms (not per vision spec, but mostly intentional):
  - `02-home:420ms` → banner timeout not motion duration (ok).
  - `04-gestures:420ms,520ms,800ms` → gesture trainer hold timers (functional, not transition).
  - `05-notifications:360ms,520ms` → toast + stack stagger (minor, should clamp to 320ms).
  - `06-assistant:380ms (var(--dur-slow)),900ms pulse infinite` → pulse is `opacity` breathe (decorative but low-attention; okay but reduce to 320ms max or respects reducedMotion).
  - `07-camera:420ms,500ms,520ms` → shutter + film develop (should clamp 320ms, but camera shutter may justify 500ms).
  - `08-captions:900ms` → typing indicator pulse (reduce).
  - `09-nav:820ms` → route line draw (map journey) — exceeds but intentional progressive disclosure; clamp pathLength animation to 320ms with stagger.
  - `11-settings:500ms`, `14-onboarding:520ms,900ms`, `15-hud:420ms` similar breathe/pulse outliers.
  - `03-wm:350ms` → window reorder filter blur (should be 260ms).
- Reduced-motion: all have `@media (prefers-reduced-motion: reduce)` via design-system.css + per-file `if(RM)` guards (`01-boot.js:5-22` exemplary RM handling). Probe `reducedMotionSupport:true` for all 16 confirms sheet rule present.

**Coherent?** YES with notes — core motion prism-ease consistent, durations mostly spec-compliant. Recommendation: clamp decorative pulses to `260ms` or gate behind `prefers-reduced-motion`, and audit `820ms` nav draw → split into 260ms segments.

### 2.4 Focus Discipline — Coherent

**Expect:** gaze cursor dot, `[data-focusable]` hover → `.gaze-focus` ring `2.5px var(--stroke-focus)` + glow, `Arrow`/`Tab`/`Enter` mirrors, `Esc` back, exactly one focal element.

**Evidence:**

- `core.js:21-111` implements gaze cursor lerp (`requestAnimationFrame`), `pointermove` → `targetFromPoint` → `setFocus` adds `.gaze-focus` (`design-system.css:138-144` ring + `box-shadow`), `keydown` mirrors (`ArrowUp/Down` scroll, `ArrowLeft/Right` swipe, `Enter` click, `Space` capture, `Escape` back, `Tab` cycle). All pages import core.js (except `01-boot` via boot.js which also imports core.js).
- Per-file focusable counts 12-37 (healthy density for 600×600). All `unlabeledIconButtons=0` (probe checks `aria-label` fallback). All `hiddenFocusables=0`.
- Spot check aria-labels: `02-home:42`, `03-wm:43`, `04-gestures:51`, `05-notifications:34`, etc. Every `button`, `[data-focusable]`, `[role="button/tab/switch"]` has `aria-label` or text content.
- `design-system.css:132-144` central focus style; no piece overrides to weaker ring (some add `transform:scale(1.04-1.05)` lift on `.gaze-focus` — consistent lift 4-5%).

**Coherent?** YES — no gaps. Recommendation: keep; ensure `01-boot` has only 2 focusables (Replay / Simulate fail) which is intentional for boot stage but add `tabindex` guard for handoff screen already present (`boot.js:262-263` sets `data-focusable` on handoff).

### 2.5 Typography — Global Font-Size Proliferation, Per-Card Coherent

**Expect:** 3 sizes max per card, SF-Pro-class stack `var(--font)`, optical hierarchy, `font-variant-numeric: tabular-nums` for timers.

**Evidence:**

- Design tokens `design-system.css:45-52` define `--fs-caption 11px`, `--fs-body 14px`, `--fs-callout 17px`, `--fs-title 22px`, `--fs-display 30px`, `--fs-hero 44px`.
- Only `00-foundation` references tokens via `var(--fs-*)` (7 refs). Others hardcode raw px matching token values: `11px` (caption), `13-14px` (body), `22px` (title), `30px` (display), `44-48px` (hero/time).
- Raw distinct sizes per file: `00: [10,11,12,13,18] (5)`, `02: [10,11,12,13,14,16,18,20,48] (9)`, `03: [10,11,12,13,14,15,16,18] (8)`, `04: [10,11,12,13,14,15,16,18] (8)`, `05: [10,11,12,13,14,18,22] (7)`, `06: [10,11,13,14,18] (5)`, `07: [10,11,12,13,14,18,72] (7)`, `08: [10,11,13,18] (4)`, `09: [11,13,14,16,18,30] (6)`, `10: [10,11,12,13,14,18,22,30] (8)`, `11: [10,11,12,13,14,18,22] (7)`, `12: [11,14,17,18,22] (5)`, `13: [10,11,12,13,14,18,22] (7)`, `14: [10,11,12,13,14,16,17,18,19] (9)`, `15: [10,11,12,13,14,18,20,44] (8)`, `01-boot: [12-13]` via boot.css (12 distinct).
- **Per-card** analysis (manual spot): `02-home` hero time `48px` + meta `13px` + caption `11px` = 3 sizes (ok). Launcher `12px` label + `11px` sub = 2. `03-wm` win title `14px` + sub `11px` + body `13px` = 3 (ok). `05-notifications` card title `14px` + preview `12/11px` = 2-3. Most cards stay within 3. Global proliferation is due to mixing cards, not single-card violations, but token indirection missing is a coherence smell.
- Line-height, letter-spacing consistent: `-0.03em` display, `-0.01em` title, `0.06-0.12em` caption uppercase.

**Coherent?** YES per-card, BUT **gap** globally: raw px instead of `var(--fs-*)` tokens. Recommendation: replace `font-size:11px` → `var(--fs-caption)`, `13-14px` → `var(--fs-body)`, `22px` → `var(--fs-title)`, etc. Add lint rule. Also 72px camera hero exceeds `--fs-hero 44px` — clamp or add `--fs-hero-lg`.

### 2.6 Tabular Numerals — Coherent Except Two Light Cases

**Expect:** `font-variant-numeric: tabular-nums` or `.tabular` on clocks, timers, battery, stats, counts.

**Evidence:**

- Design-system `.tabular` (`design-system.css:245`) + `time` tabular in statusbar (`design-system.css:212`).
- Counts: `02:3`, `03:9`, `04:1`, `05:11`, `06:9`, `07:20`, `08:19`, `09:28`, `10:48`, `11:31`, `12:51`, `13:32`, `14:16`, `15:44`, `00:2`, `01-boot:4` (boot.css 1 + boot.js diag `class="tabular"` on battery/storage/firmware).
- `04-gestures` only 1 tabular ref (`478: font-variant-numeric: tabular-nums` on timer) — thin but present. Minimum viable; consider adding tabular to gesture stats counters.
- All statusbar times/batteries use `.tabular` via `core.js:119,128` (`<time class="tabular">`, `<span class="tabular">${battery}%</span>`).
- Shell also tabular.

**Coherent?** YES — minor gap: `04-gestures` light coverage. Recommendation: add `tabular-nums` to gesture timing readouts + trainer progress numerals.

## 3. Per-Piece Coherence Summary

| # | Piece | Probe | Tokens | Chrome | Motion | Focus | Typography | Tabular | Coherent | Single Biggest Gap (if any) |
|---|-------|-------|--------|--------|--------|-------|------------|---------|----------|-----------------------------|
| 00 | foundation | PASS | ✅ | ✅ lab-bar | ✅ 220/260/300 | ✅ | ✅ tokens used | ✅ | **YES** | none — reference specimen |
| 01 | boot | PASS | ⚠️ opaque scrim (intent) | ✅ console-row | ✅ EASE + RM guard exemplary | ✅ 2 focusables ok | ⚠️ raw px | ✅ (4 tabular) | **YES** | replace opaque hex with token alias `--mat-boot` |
| 02 | home | PASS | ✅ | ✅ | ⚠️ 420 timeout | ✅ | ⚠️ 9 sizes global / raw px | ✅ | **YES** | clamp banner timeout to 260ms, use `var(--fs-*)` |
| 03 | wm | PASS | ✅ | ✅ edge+toolbar | ⚠️ 350 blur | ✅ | ⚠️ 8 sizes raw | ✅ | **YES** | motion 350→260, unify font tokens |
| 04 | gestures | PASS | ✅ | ✅ | ⚠️ 420/520/800 | ✅ | ⚠️ 8 sizes raw | ⚠️ light (1) | **YES** | tighten durations to 260, add tabular to stats |
| 05 | notifications | PASS | ✅ | ✅ | ⚠️ 360/520 | ✅ | ⚠️ 7 sizes raw | ✅ | **YES** | clamp 520→260 |
| 06 | assistant | PASS | ✅ | ✅ | ⚠️ 900 pulse | ✅ | ✅ (5 sizes) | ✅ | **YES** | reduce pulse 900→260 or respect RM |
| 07 | camera | PASS | ✅ | ✅ | ⚠️ 420/500/520 | ✅ | ⚠️ 72px hero + 7 sizes | ✅ | **YES** | clamp shutter to 260, hero 72→44 |
| 08 | captions | PASS | ✅ | ✅ | ⚠️ 900 | ✅ | ✅ (4 sizes) | ✅ | **YES** | pulse 900→260 |
| 09 | nav | PASS | ✅ | ✅ | ⚠️ 820 draw | ✅ | ⚠️ 6 sizes raw | ✅ | **YES** | split 820 draw into 260 segments |
| 10 | messages | PASS | ✅ | ✅ | ✅ | ✅ | ⚠️ 8 sizes raw | ✅ | **YES** | use font tokens |
| 11 | settings | PASS | ✅ | ✅ | ⚠️ 500 | ✅ | ⚠️ 7 sizes raw | ✅ | **YES** | clamp 500→260 |
| 12 | webapps | PASS | ✅ | ✅ | ✅ | ✅ | ✅ (5 sizes) | ✅ | **YES** | use font tokens |
| 13 | a11y | PASS | ✅ | ✅ | ✅ | ✅ | ⚠️ 7 sizes raw | ✅ | **YES** | use font tokens |
| 14 | onboarding | PASS | ✅ | ✅ | ⚠️ 520/900 | ✅ | ⚠️ 9 sizes raw | ✅ | **YES** | clamp motion |
| 15 | hud | PASS | ✅ | ✅ | ⚠️ 420 | ✅ | ⚠️ 8 sizes raw + 44 hero | ✅ | **YES** | clamp 420→260 |

**Overall:** 16/16 coherent. Zero probe failures. Gaps are smoothing polish, not coherence breaks.

## 4. System Build — `index.html` Shell

Created `index.html` at repo root (did not exist). Boots to home via `createOS` + `wm`:

- `index.html:1-100` imports `design-system.css` + `core.js` via `import { createOS } from '/os/shared/core.js'`.
- Stage `600x600` same chrome (`design-system.css:88-100`), `stage-shell` grid center, `dev-controls` fixed outside stage (same pill pattern, `z-index:1000`, guard `.stage .dev-controls{display:none}`).
- Gaze/keys: `createOS(stage,{dwell:true})` gives pointermove dwell 350ms, `on('swipe*')`, `keydown` Arrow/Tab/Enter/Esc/Space mirrors.
- Home: hero + 4×4 launcher for all 16 pieces, `focusable` + `aria-label` + `tabular` time, `rise-in 260ms var(--ease-prism)`, `mat-glass` etc.
- Nav: `openApp()` does `os.wm.open(slug, layer=> iframe src="/components/<slug>/index.html")` with `sheet-in 260ms var(--ease-prism)` — allows gaze+keys nav, `Esc`/back closes, `0-9` jump. Probe of shell passes same gate (19 focusables, 0 unlabeled).
- Boot splash: 1s `boot-out 260ms var(--ease-prism)` respects RM.

File `index.html:187` verified `http://localhost:4310/index.html` → stage 600x600, zero errors.

## 5. Recommendations — Smoothing Pass (No File Edits Done)

**Do not edit per task, propose only:**

1. **Typography tokens:** Replace raw `font-size:11px` with `var(--fs-caption)`, etc., across `02-15`. Add lint: `grep -r "font-size:[0-9]*px" components --include="*.html" | grep -v "var(--fs"`. Keep per-card 3-size rule but enforce via tokens. Handles `02-home` 48px → `var(--fs-hero)` or new `--fs-hero-lg`.

2. **Motion clamp:** Global search for `>320ms` not in `timeout`/`delay` context → clamp to `260ms` or `320ms` max for transitions/animations. Exceptions: route draw `09-nav 820ms` → segment stagger 260×3.

3. **Pulse reductions:** `900ms` breathes in `06,08,14` → `260ms` or tie to `prefers-reduced-motion: reduce` already partially done.

4. **Tabular gap:** `04-gestures` add `tabular-nums` to trainer counters/progress numerals (already has 1, add 2 more).

5. **Token completeness:** Add `--mat-boot: #020407` to `design-system.css` and use in `01-boot/boot.css` to keep vocabulary closed.

6. **Chrome naming:** Alias `lab-bar`/`console-row` to `dev-controls` for grep consistency (functional identical).

7. **Shell index:** Keep as integration test fixture; add to CI probe list: `bun tools/probe.mjs http://localhost:4310/index.html`.

## 6. Evidence Paths

- `os/shared/design-system.css` — frozen tokens
- `os/shared/core.js` — gaze, WM, bus, reducedMotion
- `components/01-boot/boot.js:10,45-53` — EASE + RM
- `components/*/index.html` — each stage + dev chrome + tokens
- `reviews/probe-verify-*/report.json` — 16 + shell probe outputs (stage 600x600, 0 errors, RM true)
- `reviews/probe-verify-*/stage.png` — visual stage crops
- `index.html` — new shell (not modifying existing pieces)

---
Me probe all. Me find zero fail. System coherent. Smoothing only.

