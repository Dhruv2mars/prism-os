/* Prism OS — simulator lab harness.
   Renders every developer control OUTSIDE the 600x600 stage, in a fixed right
   rail. The stage contains only the OS. This is not a style preference: dev
   chrome inside the stage was the single most-cited defect across 22 critic
   verdicts.

   Usage:
     import { mountLab, mountWorld } from '/os/shared/lab.js';
     mountWorld(stage, 'street');
     const lab = mountLab({
       piece: '02-home',
       title: 'Home',
       states: ['ready', 'loading', 'empty', 'error', 'offline', 'denied'],
       onState: (s) => render(s),
       actions: [{ label: 'Incoming call', run: () => ... }],
     });

   State is also drivable from the URL so a critic can screenshot any state:
     ?state=offline   ?scale=1.6   ?rm=1   ?world=room
*/

const LABEL = {
  ready: 'Ready',
  loading: 'Loading',
  empty: 'Empty',
  error: 'Error',
  offline: 'Offline',
  denied: 'Permission denied',
};

export function params() {
  return new URLSearchParams(location.search);
}

/* ---------------------------------------------------------------- world ----
   A transparent display shows the real world through every pixel. Without a
   world layer behind the UI, scrims are judged as opaque panels floating in
   nowhere — cited as "material honesty" failure on most pieces. This paints a
   plausible passthrough scene at the bottom of the stage so glass reads as glass.
*/
const WORLDS = {
  street: `
    radial-gradient(70% 55% at 22% 82%, rgba(255,176,92,0.30), transparent 62%),
    radial-gradient(50% 40% at 78% 24%, rgba(120,166,255,0.26), transparent 68%),
    linear-gradient(178deg, #2c3d5c 0%, #1e2c45 34%, #24304a 58%, #3a3630 78%, #23201d 100%)`,
  room: `
    radial-gradient(60% 48% at 74% 20%, rgba(255,226,178,0.30), transparent 66%),
    radial-gradient(70% 60% at 18% 88%, rgba(88,116,160,0.24), transparent 62%),
    linear-gradient(180deg, #3a3a3c 0%, #2b2b2e 46%, #232326 72%, #1b1b1e 100%)`,
  outdoor: `
    radial-gradient(64% 50% at 62% 14%, rgba(255,236,196,0.40), transparent 62%),
    radial-gradient(80% 62% at 26% 92%, rgba(96,132,96,0.30), transparent 60%),
    linear-gradient(180deg, #5d7ea6 0%, #7d9bbd 30%, #6f7f6a 62%, #414636 100%)`,
  night: `
    radial-gradient(50% 40% at 80% 78%, rgba(255,150,80,0.20), transparent 64%),
    radial-gradient(60% 50% at 20% 16%, rgba(70,96,150,0.24), transparent 66%),
    linear-gradient(180deg, #10141d 0%, #0c1017 50%, #080a0f 100%)`,
};

export function mountWorld(stage, kind = 'street') {
  let el = stage.querySelector('[data-world]');
  if (!el) {
    el = document.createElement('div');
    el.setAttribute('data-world', '');
    el.setAttribute('aria-hidden', 'true');
    Object.assign(el.style, {
      position: 'absolute', inset: '0', zIndex: '0', pointerEvents: 'none',
      transition: 'background-image 300ms cubic-bezier(0.32,0.72,0,1)',
    });
    stage.prepend(el);
  }
  el.style.backgroundImage = WORLDS[kind] ?? WORLDS.street;
  el.dataset.world = kind;
  /* a faint grain keeps the passthrough from reading as flat vector fill */
  el.style.boxShadow = 'inset 0 0 120px rgba(0,0,0,0.45)';
  return el;
}

/* ------------------------------------------------------------------ lab ----- */


/* The gaze cursor is a reticle, not a sticker. Two rules, both systemic:
   it stays invisible until the wearer actually looks or gestures, and when
   it is visible it composites as a ring so glyphs read straight through it.
   design-system.css is frozen, so the override ships here and every piece
   inherits it by calling mountLab. */
export function hardenGaze(stage = document.querySelector('.stage')) {
  if (!stage) return;

  if (!document.querySelector('style[data-gaze-fix]')) {
    const st = document.createElement('style');
    st.setAttribute('data-gaze-fix', '');
    st.textContent = `
      .stage .gaze-cursor {
        opacity: 0;
        background: transparent;
        box-shadow:
          inset 0 0 0 1.5px rgba(255, 255, 255, 0.92),
          0 0 0 1px rgba(0, 0, 0, 0.35),
          0 0 12px rgba(86, 184, 255, 0.45);
        transition: opacity var(--dur-fast) var(--ease-prism);
      }
      .stage .gaze-cursor[data-awake] { opacity: 1; }
      /* When gaze lands on something, that thing lights up and the reticle steps
         out of the way. A dot painted over a word the wearer is trying to read is
         the reticle competing with the content it exists to point at. */
      .stage:has(.gaze-focus) .gaze-cursor { opacity: 0; }
      /* Over words, the reticle has nothing to point at and everything to
         obscure, so it only ever paints over open space. */
      .stage .gaze-cursor[data-over-content] { opacity: 0; }
      :root[data-reduced-motion] .stage .gaze-cursor { transition: none; }
    `;
    document.head.appendChild(st);
  }

  const cursor = stage.querySelector('.gaze-cursor');
  if (!cursor || cursor.hasAttribute('data-gaze-bound')) return;
  cursor.setAttribute('data-gaze-bound', '');

  let idle;
  const sleep = () => cursor.removeAttribute('data-awake');
  const wake = () => {
    cursor.setAttribute('data-awake', '');
    clearTimeout(idle);
    idle = setTimeout(sleep, 2600);
  };
  for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel']) {
    stage.addEventListener(ev, wake, { passive: true });
  }
  window.addEventListener('keydown', wake, { passive: true });

  /* core.js hit-tests with stage-local coordinates against a viewport-space API,
     so the stage transform shifts what it thinks the wearer is looking at. It is
     frozen, so the correction lives here: hit-test in viewport space and settle
     .gaze-focus on the element actually under the gaze. Registered after core's
     own listener, so it always has the last word. core's dwell then arms on the
     corrected focus, so a 350ms hold on a real target activates it. */
  const HIT = '[data-focusable],button,a,[role="button"],[role="tab"],input,select';
  let hot = null;
  const settle = (el) => {
    if (hot === el) return;
    hot = el;
    for (const n of stage.querySelectorAll('.gaze-focus')) {
      if (n !== hot) n.classList.remove('gaze-focus');
    }
    if (hot) hot.classList.add('gaze-focus');
  };
  const aim = (e) => {
    cursor.style.visibility = 'hidden';
    const under = document.elementFromPoint(e.clientX, e.clientY);
    cursor.style.visibility = '';
    const t = under?.closest(HIT);
    settle(t && stage.contains(t) ? t : null);
    const openSpace = !under || under === stage || under.hasAttribute('data-world')
      || ![...under.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim());
    cursor.toggleAttribute('data-over-content', !openSpace);
  };
  stage.addEventListener('pointermove', aim, { passive: true });
  stage.addEventListener('pointerdown', aim, { passive: true });
  stage.addEventListener('pointerleave', () => settle(null), { passive: true });
}

export function mountLab(cfg = {}) {
  const {
    piece = '', title = '', states = [], onState = null,
    actions = [], toggles = [], worlds = true,
    onScale = null, onReducedMotion = null,
  } = cfg;

  const p = params();
  /* ?lab=0 drops the developer rail. The shell embeds pieces at close to their
     real size, and 248px of simulator controls inside that window would be
     both cropped and beside the point — the wearer never sees them. URL state
     still drives the piece, so a critic can still screenshot any state. */
  const showRail = p.get('lab') !== '0';
  if (showRail) document.body.classList.add('has-lab');

  if (!document.querySelector('link[data-lab-css]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = '/os/shared/lab.css';
    link.setAttribute('data-lab-css', '');
    document.head.appendChild(link);
  }

  const rail = document.createElement('aside');
  rail.className = 'lab-rail';
  rail.setAttribute('data-lab', '');
  rail.setAttribute('aria-label', 'Simulator controls');

  const head = document.createElement('div');
  head.className = 'lab-head';
  head.innerHTML = `<span>Simulator</span><b></b>`;
  head.querySelector('b').textContent = title || piece;
  rail.appendChild(head);

  const api = {
    state: p.get('state') || states[0] || 'ready',
    scale: parseFloat(p.get('scale') || '1'),
    reducedMotion: p.get('rm') === '1',
    world: p.get('world') || 'street',
    rail,
  };

  const group = (heading) => {
    const g = document.createElement('div');
    g.className = 'lab-group';
    if (heading) { const h = document.createElement('h4'); h.textContent = heading; g.appendChild(h); }
    rail.appendChild(g);
    return g;
  };

  /* --- states --- */
  let stateBtns = [];
  if (states.length) {
    const g = group('State');
    stateBtns = states.map((s) => {
      const b = document.createElement('button');
      b.className = 'lab-btn';
      b.type = 'button';
      b.textContent = LABEL[s] ?? s;
      b.setAttribute('aria-pressed', String(s === api.state));
      b.addEventListener('click', () => api.setState(s));
      g.appendChild(b);
      return b;
    });
  }

  api.setState = (s) => {
    api.state = s;
    stateBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(states[i] === s)));
    const u = new URL(location.href); u.searchParams.set('state', s);
    history.replaceState(null, '', u);
    onState?.(s);
  };

  /* --- actions --- */
  if (actions.length) {
    const g = group('Simulate');
    actions.forEach((a) => {
      const b = document.createElement('button');
      b.className = 'lab-btn'; b.type = 'button';
      b.textContent = a.label;
      b.addEventListener('click', () => a.run?.(api));
      g.appendChild(b);
    });
  }

  /* --- custom toggles --- */
  if (toggles.length) {
    const g = group('Options');
    toggles.forEach((t) => {
      const b = document.createElement('button');
      b.className = 'lab-btn'; b.type = 'button';
      b.textContent = t.label;
      let on = !!t.initial;
      b.setAttribute('aria-pressed', String(on));
      b.addEventListener('click', () => { on = !on; b.setAttribute('aria-pressed', String(on)); t.run?.(on, api); });
      if (on) t.run?.(true, api);
      g.appendChild(b);
    });
  }

  /* --- accessibility: text scale + reduced motion, system-wide --- */
  const ag = group('Accessibility');

  const scaleWrap = document.createElement('div');
  scaleWrap.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <span style="font-size:11px;font-weight:600">Text size</span>
      <span class="lab-val" data-scale-val></span></div>`;
  const range = document.createElement('input');
  range.type = 'range'; range.className = 'lab-range';
  range.min = '0.8'; range.max = '3.1'; range.step = '0.1'; range.value = String(api.scale);
  range.setAttribute('aria-label', 'Text size');
  const scaleVal = scaleWrap.querySelector('[data-scale-val]');
  const applyScale = (v) => {
    api.scale = v;
    scaleVal.textContent = `${Math.round(v * 100)}%`;
    document.documentElement.style.setProperty('--a11y-scale', String(v));
    const u = new URL(location.href); u.searchParams.set('scale', String(v));
    history.replaceState(null, '', u);
    onScale?.(v);
  };
  range.addEventListener('input', () => applyScale(parseFloat(range.value)));
  scaleWrap.appendChild(range);
  ag.appendChild(scaleWrap);

  const rmBtn = document.createElement('button');
  rmBtn.className = 'lab-btn'; rmBtn.type = 'button';
  rmBtn.textContent = 'Reduced motion';
  rmBtn.setAttribute('aria-pressed', String(api.reducedMotion));
  const applyRM = (on) => {
    api.reducedMotion = on;
    rmBtn.setAttribute('aria-pressed', String(on));
    document.documentElement.toggleAttribute('data-reduced-motion', on);
    const u = new URL(location.href);
    if (on) u.searchParams.set('rm', '1'); else u.searchParams.delete('rm');
    history.replaceState(null, '', u);
    onReducedMotion?.(on);
  };
  rmBtn.addEventListener('click', () => applyRM(!api.reducedMotion));
  ag.appendChild(rmBtn);

  /* --- world behind the glass --- */
  if (worlds) {
    const g = group('World behind lens');
    Object.keys(WORLDS).forEach((k) => {
      const b = document.createElement('button');
      b.className = 'lab-btn'; b.type = 'button';
      b.textContent = k[0].toUpperCase() + k.slice(1);
      b.setAttribute('aria-pressed', String(k === api.world));
      b.addEventListener('click', () => {
        api.world = k;
        [...g.querySelectorAll('.lab-btn')].forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        const stage = document.querySelector('.stage');
        if (stage) mountWorld(stage, k);
        const u = new URL(location.href); u.searchParams.set('world', k);
        history.replaceState(null, '', u);
      });
      g.appendChild(b);
    });
  }

  const note = document.createElement('p');
  note.className = 'lab-note';
  note.textContent = 'Simulator chrome. Never rendered on device. Arrows swipe · Enter press · Space capture · Esc back · Tab cycle.';
  rail.appendChild(note);

  if (showRail) document.body.appendChild(rail);

  /* apply URL-driven initial conditions */
  applyScale(api.scale);
  if (api.reducedMotion) applyRM(true);
  const stage = document.querySelector('.stage');
  if (stage && worlds) mountWorld(stage, api.world);
  if (states.length) onState?.(api.state);

  /* after the piece has mounted, so the cursor exists */
  queueMicrotask(() => hardenGaze());

  return api;
}

export default mountLab;
