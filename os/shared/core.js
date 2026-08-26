/* Prism OS runtime. FROZEN: builders import createOS, never edit. */

export function createOS(stage, opts = {}) {
  const bus = new EventTarget();
  const on = (type, fn) => bus.addEventListener(type, fn);
  const emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));

  const state = {
    battery: opts.battery ?? 0.82,
    charging: false,
    thermal: 'nominal',
    dnd: false,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    scale: opts.scale ?? 1.15,
  };

  /* ---- stage scale + world backdrop ---- */
  stage.style.setProperty('--stage-scale', state.scale);

  /* ---- gaze cursor ---- */
  const cursor = document.createElement('div');
  cursor.className = 'gaze-cursor';
  stage.appendChild(cursor);
  let cx = 300, cy = 300, tx = cx, ty = cy;
  let focused = null;
  const lerp = () => {
    cx += (tx - cx) * 0.28; cy += (ty - cy) * 0.28;
    cursor.style.transform = `translate(${cx}px, ${cy}px)`;
    requestAnimationFrame(lerp);
  };
  requestAnimationFrame(lerp);

  const setFocus = (el) => {
    if (focused === el) return;
    if (focused) { focused.classList.remove('gaze-focus'); focused.removeAttribute('aria-describedby'); }
    focused = el;
    if (focused) focused.classList.add('gaze-focus');
    emit('focuschange', { el: focused });
  };

  const targetFromPoint = (x, y) => {
    cursor.style.visibility = 'hidden';
    const el = document.elementFromPoint(x, y);
    cursor.style.visibility = '';
    return el?.closest('[data-focusable],button,a,[role="button"],[role="tab"],input,select') ?? null;
  };

  stage.addEventListener('pointermove', (e) => {
    const r = stage.getBoundingClientRect();
    tx = (e.clientX - r.left) / state.scale;
    ty = (e.clientY - r.top) / state.scale;
    setFocus(targetFromPoint(tx, ty));
  });
  stage.addEventListener('pointerdown', (e) => {
    const r = stage.getBoundingClientRect();
    const x = (e.clientX - r.left) / state.scale, y = (e.clientY - r.top) / state.scale;
    setFocus(targetFromPoint(x, y));
    if (focused) { focused.click(); }
    else emit('tapvoid', {});
  });

  /* dwell activation */
  let dwellTimer = null;
  if (opts.dwell) {
    const armDwell = () => {
      clearTimeout(dwellTimer);
      if (!focused) return;
      cursor.classList.add('dwell');
      dwellTimer = setTimeout(() => {
        cursor.classList.remove('dwell');
        focused?.click();
      }, opts.dwellMs ?? 350);
    };
    bus.addEventListener('focuschange', armDwell);
    stage.addEventListener('pointermove', armDwell);
  }

  /* ---- gesture router: temple touchpad (drag anywhere on stage edges or two-finger) ---- */
  let swipeOrigin = null;
  stage.addEventListener('pointerdown', (e) => { swipeOrigin = { x: e.clientX, y: e.clientY }; });
  stage.addEventListener('pointerup', (e) => {
    if (!swipeOrigin) return;
    const dx = e.clientX - swipeOrigin.x, dy = e.clientY - swipeOrigin.y;
    swipeOrigin = null;
    if (Math.hypot(dx, dy) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) emit(dx < 0 ? 'swipeleft' : 'swiperight', { dx });
    else emit(dy < 0 ? 'swipeup' : 'swipedown', { dy });
  });

  /* keyboard mirror of hardware input */
  addEventListener('keydown', (e) => {
    const scroller = stage.querySelector('.stage-scroll');
    switch (e.key) {
      case 'ArrowUp': scroller?.scrollBy({ top: -180, behavior: 'smooth' }); emit('swipedown', {}); break;
      case 'ArrowDown': scroller?.scrollBy({ top: 180, behavior: 'smooth' }); emit('swipeup', {}); break;
      case 'ArrowLeft': emit('swipeleft', {}); break;
      case 'ArrowRight': emit('swiperight', {}); break;
      case 'Enter': focused?.click(); break;
      case ' ': e.preventDefault(); emit('capture', {}); break;
      case 'Escape': emit('back', {}); break;
      case 'Tab': {
        e.preventDefault();
        const items = [...stage.querySelectorAll('[data-focusable],button,a,[role="button"]')]
          .filter((el) => el.offsetParent !== null);
        if (!items.length) break;
        const i = items.indexOf(document.activeElement);
        items[(i + 1) % items.length].focus({ preventScroll: false });
        break;
      }
    }
  });

  /* ---- statusbar ---- */
  const fmtClock = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  function statusbar(extraHTML = '') {
    const bar = document.createElement('header');
    bar.className = 'statusbar';
    bar.innerHTML = `
      <div class="cluster"><time class="tabular">${fmtClock(new Date())}</time></div>
      ${extraHTML}
      <div class="cluster">
        <span class="dot ok" data-sb-net title="connected"></span>
        <span aria-label="battery" style="display:inline-flex;align-items:center;gap:5px">
          <svg width="20" height="11" viewBox="0 0 24 12" fill="none">
            <rect x="0.75" y="0.75" width="19.5" height="10.5" rx="3" stroke="rgba(255,255,255,.5)" stroke-width="1"/>
            <rect x="2.4" y="2.4" width="${16.2 * state.battery}" height="7.2" rx="1.6" fill="#fff"/>
            <path d="M22.5 4v4c1-.35 1.5-1.1 1.5-2s-.5-1.65-1.5-2z" fill="rgba(255,255,255,.5)"/>
          </svg><span class="tabular">${Math.round(state.battery * 100)}%</span>
        </span>
      </div>`;
    setInterval(() => { const t = bar.querySelector('time'); if (t) t.textContent = fmtClock(new Date()); }, 10000);
    return bar;
  }

  /* ---- banners / toasts ---- */
  function banner(html, { timeout = 4200, top = 52 } = {}) {
    const el = document.createElement('div');
    el.className = 'banner'; el.style.top = `${top}px`; el.innerHTML = html;
    stage.appendChild(el);
    const kill = () => el.animate(
      [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-14px)' }],
      { duration: 220, easing: 'ease-in' }
    ).finished.then(() => el.remove());
    if (!state.reducedMotion && timeout) setTimeout(kill, timeout);
    el.addEventListener('pointerdown', kill);
    return el;
  }

  /* ---- window manager (stack of app surfaces) ---- */
  const wm = {
    stack: [],
    open(id, build) {
      const layer = document.createElement('section');
      layer.className = 'wm-layer sheet-in';
      layer.dataset.app = id;
      layer.setAttribute('role', 'dialog');
      layer.setAttribute('aria-label', id);
      Object.assign(layer.style, { position: 'absolute', inset: '0', zIndex: String(400 + wm.stack.length) });
      build(layer);
      stage.appendChild(layer);
      wm.stack.push(layer);
      emit('appopen', { id });
      return layer;
    },
    close(id) {
      const i = wm.stack.findIndex((l) => l.dataset.app === id);
      if (i < 0) return;
      const [layer] = wm.stack.splice(i, 1);
      const out = layer.animate(
        [{ opacity: 1, transform: 'scale(1)', filter: 'blur(0)' },
         { opacity: 0, transform: 'scale(0.96)', filter: 'blur(6px)' }],
        { duration: state.reducedMotion ? 1 : 240, easing: 'cubic-bezier(0.32,0.72,0,1)' }
      );
      out.finished.then(() => { layer.remove(); emit('appclose', { id }); });
    },
    top() { return wm.stack[wm.stack.length - 1] ?? null; },
  };

  on('back', () => { const t = wm.top(); if (t) wm.close(t.dataset.app); });

  /* ---- capture button ---- */
  on('capture', () => emit('shutter', { at: Date.now() }));

  return { stage, bus, on, emit, state, statusbar, banner, wm, cursor };
}

export default createOS;
