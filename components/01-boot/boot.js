import { createOS } from '/os/shared/core.js';

const os = createOS(document.querySelector('[data-stage]'));
const stage = os.stage;
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const HOLD = new URLSearchParams(location.search).get('hold');

const CAPTIONS = ['Optics calibrated', 'Sensors online', 'Secure boot verified'];
const CAPTION_FAIL = 'Boot halted · preparing recovery';
const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
const EASE_FN = (t) => 1 - Math.pow(1 - t, 3);

let phase = 'idle';
let timers = [];
let tweens = [];
let sbEl = null;

const after = (ms, fn) => { const id = setTimeout(fn, RM ? Math.min(ms, 40) : ms); timers.push(id); return id; };
const clearAll = () => { timers.forEach(clearTimeout); timers = []; tweens.forEach((t) => t.cancel()); tweens = []; };

function tween(dur, step, done, ease = EASE_FN) {
  if (RM || dur <= 0) { step(1); done && done(); return { cancel() {} }; }
  const t0 = performance.now();
  let id = 0;
  const frame = (now) => {
    const t = Math.min(1, (now - t0) / dur);
    step(ease(t));
    if (t < 1) id = requestAnimationFrame(frame);
    else done && done();
  };
  id = requestAnimationFrame(frame);
  const h = { cancel: () => cancelAnimationFrame(id) };
  tweens.push(h);
  return h;
}

function layer(cls, html) {
  const el = document.createElement('section');
  el.className = `b-layer ${cls}`;
  el.innerHTML = html;
  return el;
}
function swapIn(el) {
  stage.appendChild(el);
  if (!RM) el.animate(
    [{ opacity: 0, transform: 'scale(0.985)', filter: 'blur(8px)' }, { opacity: 1, transform: 'scale(1)', filter: 'blur(0)' }],
    { duration: 260, easing: EASE });
}
function swapOut(el, cb) {
  if (!el) { cb && cb(); return; }
  if (RM) { el.remove(); cb && cb(); return; }
  el.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(1.012)', filter: 'blur(6px)' }],
    { duration: 260, easing: EASE }).finished
    .then(() => { el.remove(); cb && cb(); }).catch(() => {});
}

const chip = document.getElementById('stateChip');
const setChip = (t) => { if (chip) chip.textContent = t; };

/* ---------- logo ---------- */

const TRI = 'M120 74 L172 162 L68 162 Z';
const BEAM_IN = 'M18 118 H94';
const BEAM_INNER = 'M94 118 L158 138';
const RAYS = [
  ['#ff8d8d', 221, 147],
  ['#ffcf7a', 228, 154],
  ['#a9e6a2', 238, 163],
  ['#7cc7ff', 225, 165],
  ['#b79bff', 215, 166],
];
const rayPath = (r) => `M158 138 L${r[1]} ${r[2]}`;

function logoSVG({ arc = true } = {}) {
  const raysGlow = RAYS.map((r) => `<path class="rayg draw" data-dur="280" data-delay="120" stroke="${r[0]}" d="${rayPath(r)}"/>`).join('');
  const rays = RAYS.map((r, i) => `<path class="ray draw" data-dur="260" data-delay="${120 + i * 18}" stroke="${r[0]}" d="${rayPath(r)}"/>`).join('');
  return `
  <svg class="b-logo" width="258" height="258" viewBox="0 0 240 240" aria-hidden="true">
    <defs>
      <linearGradient id="arcGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#56b8ff"/><stop offset="1" stop-color="#eaf4ff"/>
      </linearGradient>
      <filter id="rayBlur" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="2.4"/>
      </filter>
      <clipPath id="prismClip"><path d="${TRI}"/></clipPath>
    </defs>
    ${arc ? `
    <circle class="b-arc-track" cx="120" cy="124" r="103"/>
    <circle class="b-arc" cx="120" cy="124" r="103" transform="rotate(-90 120 124)" pathLength="1000"/>` : ''}
    <path class="b-tri-glow draw" data-dur="260" data-delay="0" d="${TRI}"/>
    <path class="b-tri draw" data-dur="260" data-delay="0" d="${TRI}"/>
    <g clip-path="url(#prismClip)">
      <rect class="b-sheen" x="30" y="50" width="44" height="140" fill="rgba(255,255,255,0.10)" transform="skewX(-18)"/>
    </g>
    <path class="chrom r draw" data-dur="260" data-delay="20" d="${BEAM_IN}" transform="translate(-1.2,-0.5)"/>
    <path class="chrom bl draw" data-dur="260" data-delay="20" d="${BEAM_IN}" transform="translate(1.2,0.6)"/>
    <path class="beam-main draw" data-dur="260" data-delay="20" d="${BEAM_IN}"/>
    <circle class="b-glint" cx="94" cy="118" r="3"/>
    <path class="chrom r draw" data-dur="260" data-delay="90" d="${BEAM_INNER}" transform="translate(-0.7,-0.3)" opacity="0.55"/>
    <path class="chrom bl draw" data-dur="260" data-delay="90" d="${BEAM_INNER}" transform="translate(0.8,0.4)" opacity="0.55"/>
    <path class="beam-main draw" data-dur="260" data-delay="90" d="${BEAM_INNER}" style="stroke-width:2"/>
    <g filter="url(#rayBlur)">${raysGlow}</g>
    ${rays}
  </svg>`;
}

function primeDraws(root) {
  root.querySelectorAll('.draw').forEach((p) => {
    if (RM) return;
    const L = p.getTotalLength();
    let dur = +(p.dataset.dur || 260);
    // clamp to spec 200-320
    dur = Math.max(200, Math.min(320, dur));
    const delay = Math.min(120, +(p.dataset.delay || 0));
    p.style.strokeDasharray = `${L}`;
    p.style.strokeDashoffset = `${L}`;
    p.style.transition = 'none';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      p.style.transition = `stroke-dashoffset ${dur}ms ${EASE} ${delay}ms`;
      p.style.strokeDashoffset = '0';
    }));
  });
}
function finishDraws(root) {
  root.querySelectorAll('.draw').forEach((p) => {
    p.style.transition = 'none';
    p.style.strokeDasharray = 'none';
    p.style.strokeDashoffset = '0';
  });
}

const arcOf = (root) => root.querySelector('.b-arc');
const setArc = (arc, p) => { if (arc) arc.style.strokeDashoffset = String(1000 * (1 - Math.min(1, Math.max(0, p)))); };

function swapCaption(el, text) {
  if (el.textContent === text) return;
  if (RM) { el.textContent = text; return; }
  el.animate([{ opacity: 1, filter: 'blur(0)' }, { opacity: 0, filter: 'blur(4px)' }],
    { duration: 200, easing: EASE }).finished.then(() => {
      el.textContent = text;
      el.animate([{ opacity: 0, filter: 'blur(4px)' }, { opacity: 1, filter: 'blur(0)' }],
        { duration: 260, easing: EASE });
    }).catch(() => { el.textContent = text; });
}

/* ---------- cold boot ---------- */

function startBoot(mode = 'normal') {
  clearAll();
  phase = mode === 'fail' ? 'boot-fail' : 'boot';
  setChip(mode === 'fail' ? 'boot · fail' : 'boot');
  document.querySelectorAll('.b-layer').forEach((l) => l.remove());
  sbEl?.remove(); sbEl = null;

  const scrimClass = mode === 'fail' ? 'b-scrim amber' : 'b-scrim';
  const warnHTML = `
    <div class="b-warn" role="img" aria-label="Warning: boot failure detected">
      <svg viewBox="0 0 24 24" fill="none"><path d="M12 3.2 L21.6 19.6 H2.4 Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 9.4 v4.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="16.6" r="1.05" fill="currentColor"/></svg>
    </div>`;
  const el = layer('b-boot', `
    <div class="${scrimClass}"></div>
    <div class="b-core">
      ${logoSVG()}
      <div class="b-caption" role="status"></div>
    </div>
    ${warnHTML}
    <div class="b-hint">Tap anywhere to skip</div>`);
  stage.appendChild(el);

  const cap = el.querySelector('.b-caption');
  const hint = el.querySelector('.b-hint');
  const warn = el.querySelector('.b-warn');
  const logo = el.querySelector('.b-logo');
  const arc = arcOf(el);
  primeDraws(el);
  if (RM) finishDraws(el);

  let completed = false;
  const finishTo = (fn, fast) => {
    if (completed) return;
    completed = true;
    clearAll();
    finishDraws(el);
    logo.classList.add('done');
    setArc(arc, 1);
    cap.textContent = mode === 'fail' ? CAPTION_FAIL : CAPTIONS[2];
    after(fast ? 200 : 260, fn);
  };

  el.addEventListener('pointerdown', () => {
    if (HOLD) return;
    if (phase === 'boot') finishTo(startHandoff, true);
    else if (phase === 'boot-fail') finishTo(showRecovery, true);
  });

  if (HOLD === 'boot') {
    finishDraws(el); logo.classList.add('done'); setArc(arc, 1);
    cap.textContent = CAPTIONS[2];
    hint.classList.add('show');
    phase = 'hold'; setChip('hold · boot');
    after(40, () => {
      el.remove();
      startHandoff();
    });
    return;
  }
  if (HOLD === 'fail') {
    finishDraws(el); setArc(arc, 0.62); warn.classList.add('show');
    cap.textContent = CAPTION_FAIL;
    hint.classList.remove('show');
    phase = 'hold'; setChip('hold · fail');
    after(40, () => {
      el.remove();
      showRecovery();
    });
    return;
  }

  // silent precise: single caption, no theatre
  after(220, () => { swapCaption(cap, CAPTIONS[2]); });

  /* glint + arc — 260ms prism-ease, actually fills 1000->0 */
  after(RM ? 20 : 60, () => el.querySelector('.b-glint')?.classList.add('pop'));
  after(RM ? 20 : 80, () => {
    if (mode === 'fail') {
      tween(260, (p) => setArc(arc, p * 0.62), null, EASE_FN);
    } else {
      tween(260, (p) => setArc(arc, p), null, EASE_FN);
    }
  });

  after(280, () => hint.classList.add('show'));

  if (mode === 'fail') {
    after(320, () => { swapCaption(cap, CAPTION_FAIL); warn.classList.add('show'); });
    after(720, () => finishTo(showRecovery, false));
  } else {
    after(520, () => { logo.classList.add('done'); });
    after(720, () => finishTo(startHandoff, false));
  }
}

/* ---------- handoff ---------- */

const CHEV = `<div class="b-chev" aria-hidden="true"><svg width="38" height="22" viewBox="0 0 36 20" fill="none"><path d="M4 16 L18 5 L32 16" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;

function startHandoff() {
  clearAll();
  phase = 'handoff';
  setChip('handoff');
  const old = document.querySelector('.b-boot');
  swapOut(old, () => {
    if (!sbEl) { sbEl = os.statusbar(); stage.appendChild(sbEl); sbEl.animate(
      [{ opacity: 0 }, { opacity: 1 }], { duration: RM ? 1 : 260, easing: EASE }); }
    const el = layer('b-handoff', `
      ${CHEV}
      <h1 class="b-swipe-title">Swipe up to begin</h1>
      <p class="caption">ArrowUp key · or drag up on the stage</p>`);
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('data-focusable', '');
    el.setAttribute('aria-label', 'Swipe up to begin');
    el.addEventListener('click', beginHome);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); beginHome(); }
    });
    swapIn(el);
    el.focus({ preventScroll: true });
  });
}

function beginHome() {
  if (phase !== 'handoff') return;
  clearAll();
  phase = 'home';
  setChip('home ready');
  const el = layer('b-home', `
    <div class="card raised b-home-card">
      <span class="b-mini">
        <svg width="52" height="52" viewBox="0 0 240 240" fill="none" aria-hidden="true">
          <path d="${TRI}" stroke="rgba(255,255,255,0.92)" stroke-width="7" stroke-linejoin="round"/>
          <path d="${BEAM_IN}" stroke="#fff" stroke-width="7" stroke-linecap="round"/>
          ${RAYS.map((r) => `<path d="${rayPath(r)}" stroke="${r[0]}" stroke-width="5" stroke-linecap="round"/>`).join('')}
        </svg>
      </span>
      <h2 class="title">Prism ready</h2>
      <p class="caption">Home placeholder — boot sequence complete.</p>
      <span class="chip"><span class="dot ok"></span>All systems nominal</span>
    </div>`);
  swapOut(document.querySelector('.b-handoff'), () => swapIn(el));
}

/* ---------- recovery ---------- */

function showRecovery() {
  clearAll();
  phase = 'recovery';
  setChip('recovery');
  const batt = Math.round(os.state.battery * 100);
  const thermal = os.state.thermal === 'nominal' ? 'Nominal' : os.state.thermal;
  const el = layer('b-recovery', `
    <div class="card raised b-rec-card sheet-in" role="alertdialog" aria-label="Recovery">
      <header class="b-rec-head">
        <span class="b-warn-sm" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none"><path d="M12 3.2 L21.6 19.6 H2.4 Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 9.4 v4.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="16.6" r="1.05" fill="currentColor"/></svg>
        </span>
        <div>
          <h2>Recovery</h2>
          <p>Prism couldn’t finish booting. Your data is intact.</p>
        </div>
      </header>
      <dl class="b-diag">
        <div><dt>Battery</dt><dd class="tabular ok">${batt}%</dd></div>
        <div><dt>Storage free</dt><dd class="tabular">41.2 GB</dd></div>
        <div><dt>Thermal state</dt><dd>${thermal}</dd></div>
        <div><dt>Firmware</dt><dd class="tabular">PRISM 1.0 (build 26A)</dd></div>
      </dl>
      <div class="b-actions">
        <button class="btn primary" id="recRestart" data-focusable>Restart</button>
        <button class="btn destructive b-holdbtn" id="recReinstall" data-focusable aria-describedby="holdDesc">Reinstall Prism OS</button>
      </div>
      <p class="b-rec-foot" id="holdDesc">Hold “Reinstall” to confirm — release early to cancel.</p>
    </div>`);
  swapOut(document.querySelector('.b-boot'), () => {
    swapIn(el);
    wireHold(el.querySelector('#recReinstall'));
    el.querySelector('#recRestart').addEventListener('click', () => startBoot('normal'));
  });
}

function wireHold(btn) {
  const box = btn.getBoundingClientRect();
  const w = Math.max(120, Math.round(box.width)), h = Math.max(36, Math.round(box.height));
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'b-ring');
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', '2'); rect.setAttribute('y', '2');
  rect.setAttribute('width', String(w - 4)); rect.setAttribute('height', String(h - 4));
  rect.setAttribute('rx', String(Math.max(2, h / 2 - 2)));
  rect.setAttribute('pathLength', '100');
  svg.appendChild(rect);
  btn.appendChild(svg);

  let holding = false;
  let activeTweens = [];
  const SEG = 260;
  const STEPS = 3;
  const TOTAL = SEG * STEPS;

  const cancelHold = () => {
    if (!holding) return;
    holding = false;
    activeTweens.forEach((t) => t.cancel());
    activeTweens = [];
    rect.style.strokeDashoffset = '100';
  };

  const start = () => {
    if (holding || phase !== 'recovery') return;
    holding = true;
    rect.style.strokeDashoffset = '100';
    let stepIdx = 0;
    const runStep = () => {
      if (!holding) return;
      if (stepIdx >= STEPS) {
        holding = false;
        btn.textContent = 'Reinstalling…';
        btn.setAttribute('aria-label', 'Reinstalling Prism OS');
        after(260, () => startBoot('normal'));
        return;
      }
      const from = (stepIdx * 100) / STEPS;
      const to = ((stepIdx + 1) * 100) / STEPS;
      const tw = tween(SEG,
        (p) => { rect.style.strokeDashoffset = String(100 - (from + p * (to - from))); },
        () => { stepIdx += 1; runStep(); },
        EASE_FN);
      activeTweens.push(tw);
    };
    runStep();
  };

  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); try{ btn.setPointerCapture(e.pointerId);}catch{} start(); });
  btn.addEventListener('pointerup', cancelHold);
  btn.addEventListener('pointerleave', cancelHold);
  btn.addEventListener('pointercancel', cancelHold);
  btn.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); start(); }
  });
  btn.addEventListener('keyup', cancelHold);
}

/* ---------- global input mirrors ---------- */

os.on('swipeup', () => beginHome());
addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp' && phase === 'handoff') { e.preventDefault(); beginHome(); }
});

document.getElementById('cBoot')?.addEventListener('click', () => startBoot('normal'));
document.getElementById('cFail')?.addEventListener('click', () => startBoot('fail'));

startBoot(HOLD === 'fail' ? 'fail' : 'normal');
