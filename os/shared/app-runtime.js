/* Prism app runtime — the host half of the platform.
 *
 * Owns the things an app is not allowed to own: the sandbox it runs in, the
 * permissions it is granted, the storage it reads, the network it reaches, and
 * the moment it is suspended or killed. The app never touches any of these
 * directly; it asks across postMessage and the wearer can always say no.
 *
 * This module renders no UI of its own beyond the iframe. It emits events and
 * the surface decides how they look, so the same runtime backs the Web Apps
 * screen, the permission manager, and the developer simulator.
 */

import { validateManifest, PERMISSIONS } from '/os/shared/app-manifest.js';

const PROTOCOL = 1;

/* An app that has not said "ready" by now is not going to. The wearer gets a
   way out rather than an empty rectangle. */
const READY_TIMEOUT = 4000;
/* A single brokered call may not hang the app forever either. */
const CALL_TIMEOUT = 8000;

export class AppRuntime {
  constructor(opts = {}) {
    this.container = opts.container || null;
    this.appsRoot = opts.appsRoot || '/os/apps';
    this.online = opts.online !== false;

    /* id -> { manifest, base } */
    this.installed = new Map();
    /* id -> { manifest, frame, status, badge, since, error } */
    this.instances = new Map();
    /* id -> { permission -> 'granted' | 'denied' } */
    this.grants = new Map();
    /* id -> Map(key -> value). Per app, so one app cannot read another's. */
    this.stores = new Map();

    this.focused = null;
    this._listeners = new Map();
    this._pendingPrompt = null;

    this._onMessage = this._onMessage.bind(this);
    window.addEventListener('message', this._onMessage);
  }

  /* ---------- events ---------- */

  on(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(fn);
    return () => this._listeners.get(event)?.delete(fn);
  }

  emit(event, data) {
    const set = this._listeners.get(event);
    if (!set) return;
    for (const fn of [...set]) {
      try { fn(data); } catch (err) { console.error(`[runtime] listener for "${event}" threw`, err); }
    }
  }

  /* ---------- install ---------- */

  /* Fetches and validates a manifest. Resolves with the validation result so an
     install sheet can show every problem at once; it does not throw on an
     invalid manifest, only on a manifest it could not read at all. */
  async inspect(id) {
    const base = `${this.appsRoot}/${id}`;
    let raw;
    try {
      const res = await fetch(`${base}/manifest.json`, { cache: 'no-store' });
      if (!res.ok) {
        return { valid: false, errors: [{ field: '(fetch)', message: `manifest.json returned ${res.status}.` }], warnings: [], manifest: null, base };
      }
      raw = await res.json();
    } catch (err) {
      return { valid: false, errors: [{ field: '(fetch)', message: `Could not read manifest.json — ${err.message}` }], warnings: [], manifest: null, base };
    }
    const result = validateManifest(raw);
    /* The folder is the address. A manifest claiming another app's id would let
       one package shadow another at install time. */
    if (result.valid && result.manifest.id !== id) {
      return {
        valid: false,
        warnings: result.warnings,
        errors: [{ field: 'id', message: `Manifest id "${result.manifest.id}" does not match its folder "${id}".` }],
        manifest: null,
        base,
      };
    }
    return { ...result, base };
  }

  async install(id) {
    const result = await this.inspect(id);
    if (!result.valid) {
      this.emit('install-failed', { id, errors: result.errors });
      return result;
    }
    this.installed.set(id, { manifest: result.manifest, base: result.base });
    if (!this.grants.has(id)) this.grants.set(id, {});
    if (!this.stores.has(id)) this.stores.set(id, new Map());
    this.emit('installed', { id, manifest: result.manifest });
    this.emit('change');
    return result;
  }

  uninstall(id) {
    this.kill(id);
    this.installed.delete(id);
    this.grants.delete(id);
    /* Uninstall means the data goes too. Leaving it behind so a reinstall
       silently inherits old grants and old state is a privacy bug. */
    this.stores.delete(id);
    this.emit('uninstalled', { id });
    this.emit('change');
  }

  /* ---------- lifecycle ---------- */

  launch(id) {
    const entry = this.installed.get(id);
    if (!entry) throw new Error(`App "${id}" is not installed.`);

    const existing = this.instances.get(id);
    if (existing) {
      if (existing.status === 'suspended') this.resume(id);
      this.focus(id);
      return existing;
    }

    const frame = document.createElement('iframe');
    frame.className = 'app-frame';
    frame.setAttribute('title', entry.manifest.name);
    /* allow-scripts and nothing else. Withholding allow-same-origin is what
       gives the frame an opaque origin: it cannot reach host DOM, host storage,
       cookies, or same-origin network. Adding allow-same-origin here alongside
       allow-scripts would let the frame remove its own sandbox attribute. */
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.setAttribute('referrerpolicy', 'no-referrer');
    frame.setAttribute('loading', 'eager');
    frame.src = `${entry.base}/${entry.manifest.entry}`;

    const inst = {
      id,
      manifest: entry.manifest,
      frame,
      status: 'launching',
      badge: entry.manifest.badge || '',
      since: Date.now(),
      error: null,
      calls: 0,
    };
    this.instances.set(id, inst);

    inst.watchdog = setTimeout(() => {
      if (inst.status === 'launching') {
        inst.status = 'unresponsive';
        inst.error = { code: 'no-ready', message: `${entry.manifest.name} did not start.` };
        this.emit('unresponsive', { id, instance: inst });
        this.emit('change');
      }
    }, READY_TIMEOUT);

    if (this.container) this.container.appendChild(frame);
    this.focus(id);
    this.emit('launching', { id, instance: inst });
    this.emit('change');
    return inst;
  }

  focus(id) {
    this.focused = id;
    this.emit('focus', { id });
    this.emit('change');
  }

  suspend(id) {
    const inst = this.instances.get(id);
    if (!inst || inst.status === 'suspended') return;
    inst.status = 'suspended';
    /* Tell the app first so it can stop its own timers, then make the frame
       non-interactive. A suspended app that keeps animating is not suspended. */
    this._send(inst, { type: 'host:event', event: 'suspend' });
    inst.frame.setAttribute('inert', '');
    inst.frame.setAttribute('aria-hidden', 'true');
    this.emit('suspended', { id });
    this.emit('change');
  }

  resume(id) {
    const inst = this.instances.get(id);
    if (!inst || inst.status !== 'suspended') return;
    inst.status = 'running';
    inst.frame.removeAttribute('inert');
    inst.frame.removeAttribute('aria-hidden');
    this._send(inst, { type: 'host:event', event: 'resume' });
    this.emit('resumed', { id });
    this.emit('change');
  }

  kill(id) {
    const inst = this.instances.get(id);
    if (!inst) return;
    clearTimeout(inst.watchdog);
    inst.frame.remove();
    this.instances.delete(id);
    if (this.focused === id) this.focused = null;
    /* A killed app must not be able to resolve a call it made before it died. */
    if (this._pendingPrompt?.id === id) this._resolvePrompt('denied');
    this.emit('killed', { id });
    this.emit('change');
  }

  /* ---------- permissions ---------- */

  permissionState(id, name) {
    return this.grants.get(id)?.[name] ?? 'prompt';
  }

  setPermission(id, name, state) {
    const g = this.grants.get(id) || {};
    if (state === 'prompt') delete g[name];
    else g[name] = state;
    this.grants.set(id, g);
    /* The app is told immediately. A revoke that the app only discovers on its
       next call leaves stale data on screen claiming a capability it lost. */
    const inst = this.instances.get(id);
    if (inst) this._send(inst, { type: 'host:event', event: 'permissionchange', data: { name, state } });
    this.emit('permission-changed', { id, name, state });
    this.emit('change');
  }

  revokeAll(id) {
    for (const name of Object.keys(this.grants.get(id) || {})) this.setPermission(id, name, 'prompt');
  }

  /* Called by the surface when the wearer answers the grant sheet. */
  answerPrompt(decision) {
    this._resolvePrompt(decision === 'granted' ? 'granted' : 'denied');
  }

  _resolvePrompt(decision) {
    const p = this._pendingPrompt;
    if (!p) return;
    this._pendingPrompt = null;
    this.setPermission(p.id, p.name, decision);
    p.resolve(decision);
    this.emit('prompt-closed', { id: p.id, name: p.name, decision });
  }

  _requestPermission(id, name) {
    const state = this.permissionState(id, name);
    if (state === 'granted' || state === 'denied') return Promise.resolve(state);
    if (this._pendingPrompt) {
      /* One sheet at a time on a 600px display. A second ask queues behind the
         first rather than stacking two decisions in one eye. */
      return this._pendingPrompt.promise.then(() => this._requestPermission(id, name));
    }
    const inst = this.instances.get(id);
    let resolve;
    const promise = new Promise((r) => { resolve = r; });
    this._pendingPrompt = {
      id, name, promise, resolve,
      meta: PERMISSIONS[name],
      reason: inst?.manifest.permissionReasons?.[name] || '',
      appName: inst?.manifest.name || id,
    };
    this.emit('permission-request', this._pendingPrompt);
    this.emit('change');
    return promise;
  }

  get pendingPrompt() { return this._pendingPrompt; }

  /* ---------- network ---------- */

  setOnline(on) {
    this.online = !!on;
    for (const inst of this.instances.values()) {
      this._send(inst, { type: 'host:event', event: this.online ? 'online' : 'offline' });
    }
    this.emit('online-changed', { online: this.online });
    this.emit('change');
  }

  /* ---------- bridge ---------- */

  _send(inst, msg) {
    if (!inst?.frame?.contentWindow) return;
    inst.frame.contentWindow.postMessage({ __prism: PROTOCOL, ...msg }, '*');
  }

  _instanceForSource(source) {
    for (const inst of this.instances.values()) {
      if (inst.frame.contentWindow === source) return inst;
    }
    return null;
  }

  _onMessage(e) {
    const m = e.data;
    if (!m || m.__prism !== PROTOCOL) return;
    /* Identity is the frame, never the origin string. A sandboxed frame has
       origin "null", which is not a name anyone can be trusted by — but a
       contentWindow reference cannot be forged by the frame's own content. */
    const inst = this._instanceForSource(e.source);
    if (!inst) return;

    if (m.type === 'app:ready') {
      clearTimeout(inst.watchdog);
      if (inst.status === 'launching' || inst.status === 'unresponsive') {
        inst.status = 'running';
        inst.error = null;
        this._send(inst, {
          type: 'host:ready',
          context: {
            id: inst.id,
            name: inst.manifest.name,
            online: this.online,
            display: { width: 600, height: 600, eye: 'right' },
            granted: Object.entries(this.grants.get(inst.id) || {})
              .filter(([, v]) => v === 'granted').map(([k]) => k),
          },
        });
        this.emit('ready', { id: inst.id, instance: inst });
        this.emit('change');
      }
      return;
    }

    if (m.type === 'app:call') {
      inst.calls++;
      this.emit('call', { id: inst.id, method: m.method, params: m.params });
      let settled = false;
      const reply = (ok, payload) => {
        if (settled) return;
        settled = true;
        this._send(inst, ok
          ? { type: 'host:reply', id: m.id, ok: true, data: payload }
          : { type: 'host:reply', id: m.id, ok: false, error: payload });
      };
      /* No brokered call may hang forever. An app awaiting a reply that never
         comes is a dead end, and dead ends are the one thing forbidden. */
      setTimeout(() => reply(false, { code: 'timeout', message: `"${m.method}" timed out.` }), CALL_TIMEOUT);

      this._dispatch(inst, m.method, m.params || {})
        .then((data) => reply(true, data))
        .catch((err) => reply(false, { code: err.code || 'error', message: err.message, detail: err.detail }));
    }
  }

  async _dispatch(inst, method, params) {
    const id = inst.id;
    const declared = inst.manifest.permissions;

    /* A capability the manifest never declared is refused before the wearer is
       ever asked. Install time is the contract; runtime cannot widen it. */
    const needs = (name) => {
      if (!declared.includes(name)) {
        const e = new Error(`"${inst.manifest.name}" did not declare the "${name}" permission in its manifest.`);
        e.code = 'not-declared';
        throw e;
      }
      return this._requestPermission(id, name).then((state) => {
        if (state !== 'granted') {
          const e = new Error(`The wearer denied ${PERMISSIONS[name].label.toLowerCase()} access.`);
          e.code = 'permission-denied';
          throw e;
        }
      });
    };

    switch (method) {
      case 'permissions.query':
        return this.permissionState(id, params.name);

      case 'permissions.request': {
        if (!declared.includes(params.name)) {
          const e = new Error(`"${params.name}" is not declared in the manifest.`);
          e.code = 'not-declared';
          throw e;
        }
        return this._requestPermission(id, params.name);
      }

      case 'location.get': {
        await needs('location');
        /* Simulated fix. Real hardware would supply this; the shape is what an
           app codes against, including accuracy it must decide to trust. */
        return { lat: 37.7955, lon: -122.3937, accuracy: 12, label: 'Embarcadero, San Francisco' };
      }

      case 'storage.get': {
        await needs('storage');
        return this.stores.get(id)?.get(params.key) ?? null;
      }
      case 'storage.set': {
        await needs('storage');
        this.stores.get(id).set(params.key, params.value);
        this.emit('change');
        return true;
      }
      case 'storage.remove': {
        await needs('storage');
        this.stores.get(id).delete(params.key);
        return true;
      }
      case 'storage.keys': {
        await needs('storage');
        return [...(this.stores.get(id)?.keys() ?? [])];
      }

      case 'net.fetch': {
        await needs('network');
        if (!this.online) {
          const e = new Error('No connection.');
          e.code = 'offline';
          throw e;
        }
        return this._brokeredFetch(inst, params.url);
      }

      case 'notify': {
        await needs('notifications');
        const payload = {
          appId: id,
          appName: inst.manifest.name,
          title: String(params.title ?? '').slice(0, 40),
          body: String(params.body ?? '').slice(0, 90),
          at: Date.now(),
        };
        this.emit('notification', payload);
        return true;
      }

      case 'hud.setBadge': {
        inst.badge = String(params.text ?? '').slice(0, 28);
        this.emit('badge', { id, text: inst.badge });
        this.emit('change');
        return true;
      }

      case 'lifecycle.close':
        /* Let the current reply land before the frame is torn down. */
        setTimeout(() => this.kill(id), 0);
        return true;

      default: {
        const e = new Error(`Unknown method "${method}".`);
        e.code = 'unknown-method';
        throw e;
      }
    }
  }

  /* The only network an app gets. No real requests leave the device in this
     simulator — the build has no external dependencies by rule — so the broker
     answers from a fixture table and refuses anything it does not know, which
     is also what a deny-by-default policy would do on hardware. */
  async _brokeredFetch(inst, url) {
    const FIXTURES = {
      'https://api.prism.dev/transit/next': {
        line: 'N Judah', platform: 'Inbound', minutes: [3, 11, 18], updated: 'just now',
      },
      'https://api.prism.dev/weather/now': {
        tempC: 14, condition: 'Fog clearing', windKph: 18,
      },
    };
    await new Promise((r) => setTimeout(r, 220));
    const body = FIXTURES[url];
    if (!body) {
      const e = new Error(`No route to ${url}.`);
      e.code = 'blocked';
      e.detail = 'The network broker allows only declared endpoints.';
      throw e;
    }
    return { status: 200, body };
  }

  destroy() {
    window.removeEventListener('message', this._onMessage);
    for (const id of [...this.instances.keys()]) this.kill(id);
  }
}

export default AppRuntime;
