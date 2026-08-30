# Prism OS

**The operating system for smart glasses.**

A spatial operating system for monocular smart-glasses displays (Meta Ray-Ban Display class hardware), built as a high-fidelity browser simulator. Target quality bar: Apple visionOS and Meta Horizon OS. Not "inspired by" — competitive with.

## Hardware model (fixed)

- Display: one eye, 600x600 px square viewport ("the stage"), ~20 deg FOV, transparent-lens world behind UI. Everything is a translucent dark scrim over the world. High ambient light is assumed.
- Input:
  - Head gaze = pointer. Gaze moves a small cursor dot with halo. Hover = focus. Dwell (~350 ms) or click = activate.
  - Capture button on frame: photo/video shutter, also acts as "select" in menus.
  - Temple touchpad: forward/back swipe = scroll / navigate back, tap = select, long-press = context.
  - Voice: "Hey Prism" wake phrase opens the assistant orb anywhere.
- Keyboard mirrors (for simulator): arrows = temple swipe, Enter = press, Space = capture, Esc = back/wrist-flick-dismiss, Tab = cycle focus.

## Non-negotiable quality bar

A piece passes only if a fresh critic, judging actual rendered output (never builder claims), would rank it at or above what visionOS or Horizon OS ships for the same surface. Rubric every critic scores 1-10:

1. Glanceability — meaning extracted in under 1 s from arm's length. Nothing marginal.
2. Focus discipline — exactly one obvious focal element per moment; gaze focus states are unmistakable.
3. Material honesty — scrims read as glass over the world, never as opaque panels floating nowhere.
4. Motion — 200-320 ms, interruptible, eased `cubic-bezier(0.32, 0.72, 0, 1)`. No bounce abuse, no linear tweens, nothing decorative that costs attention.
5. Typography — SF-Pro-class stack, optical hierarchy in 3 sizes max per card, tabular numerals for timers/stats.
6. Edge states — empty, loading, error, offline, permission-denied all designed, not defaulted.
7. Dependability — any crash/failure path lands somewhere safe and recoverable. No dead ends, ever.
8. Accessibility — text scale, contrast, reduced-motion, mono-audio cues, colorblind-safe accents.
9. Delight — one earned signature moment per piece. Earned means it serves function.

## Architecture

Static site. No build step, no framework. Vanilla ES modules + CSS custom properties.

```
os/shared/design-system.css   tokens + materials + primitives (FROZEN - builders import, never edit)
os/shared/core.js             OS runtime: bus, WM, gaze cursor, gesture router, toasts
components/<id>/index.html    one self-contained showcase page per piece
index.html                    integrated shell (boot -> home -> apps)
tools/probe.mjs               playwright screenshot + audit harness
reviews/<id>/round-N.json     critic verdicts
PROGRESS.json                 live status consumed by dashboard
```

## Stage conventions (every page)

```html
<body>
  <div class="device">
    <div class="stage" data-stage>
      <!-- 600x600 UI lives here -->
    </div>
  </div>
</body>
<script type="module">
  import { createOS } from '/os/shared/core.js';
  const os = createOS(document.querySelector('[data-stage]'));
</script>
```

The device frame is presentation only (simulator chrome). The stage itself must be perfect at 600x600 and acceptable when scaled 1x-2x.

## Builder rules

- Import `/os/shared/design-system.css` and `/os/shared/core.js`. Do not modify them. Local overrides go in your own folder-scoped stylesheet using token vars.
- No external network deps. No fonts CDN. System font stack only.
- Every interactive element reachable by gaze focus, keyboard, and visible focus ring.
- Ship edge states inside the showcase: a control row to trigger empty/loading/error/offline variants so critics can see them without code changes.
- Self-verify before reporting done: run `bun tools/probe.mjs http://localhost:4310/components/<id>/index.html`, confirm zero console errors, then commit-quality files (orchestrator commits).

## Critic protocol

1. Fresh context. Never read builder notes or chat summaries. Evidence = rendered output only.
2. Run the probe yourself against `http://localhost:4310/components/<id>/index.html`. Read your own screenshots.
3. Blind side-by-side: first describe how visionOS solves this surface, how Horizon OS solves it, and how the artifact under review solves it, as System A/B/C. Score each on the rubric. Pick winners per criterion. Only then reveal which is ours.
4. If ours loses on any criterion, name the SINGLE biggest gap concretely (element, expected vs got). Verdict JSON goes to `reviews/<id>/round-N.json`.
5. Pass requires: ours ranked first overall OR tied-first with zero named gaps. Harsh is the job. "Good enough" is a fail.
