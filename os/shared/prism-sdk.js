/* Prism SDK — the surface a third-party app actually calls.
 *
 * This file runs INSIDE the app's sandboxed iframe. The frame is served with
 * sandbox="allow-scripts" and deliberately WITHOUT allow-same-origin, so the
 * app has an opaque origin: no host DOM, no host storage, no cookies, no
 * same-origin fetch. postMessage is the only way out, and every capability
 * below is a brokered round trip the wearer can deny.
 *
 * Deliberately a CLASSIC script, not an ES module. An opaque origin makes every
 * module fetch a CORS request, and a static file server sends no CORS headers,
 * so `<script type="module">` cannot load inside the sandbox. A developer
 * includes it the plain way:
 *
 *   <script src="/os/shared/prism-sdk.js"></script>
 *   <script>
 *     prism.ready().then(ctx => { ... });
 *   </script>
 */
(function () {
  'use strict';

  var PROTOCOL = 1;
  var HOST = window.parent;

  var seq = 0;
  var pending = new Map();
  var listeners = new Map();
  var started = false;
  var context = null;

  var readyResolve;
  var readyPromise = new Promise(function (r) { readyResolve = r; });

  /* Errors the app can branch on. A string message is not a contract; a code
     is. Every rejection from this SDK carries one. */
  function PrismError(code, message, detail) {
    var e = Error.call(this, message || code);
    this.name = 'PrismError';
    this.message = e.message;
    this.stack = e.stack;
    this.code = code;
    this.detail = detail;
  }
  PrismError.prototype = Object.create(Error.prototype);
  PrismError.prototype.constructor = PrismError;

  function post(msg) {
    msg.__prism = PROTOCOL;
    /* Opaque origin means we cannot name the host origin here; '*' is correct
       and safe because the payload carries no secrets and the host verifies us
       by frame identity (event.source), not by an origin string. */
    HOST.postMessage(msg, '*');
  }

  function call(method, params) {
    var id = 'c' + (++seq);
    return new Promise(function (resolve, reject) {
      pending.set(id, { resolve: resolve, reject: reject });
      post({ type: 'app:call', id: id, method: method, params: params });
    });
  }

  function emit(event, data) {
    var set = listeners.get(event);
    if (!set) return;
    set.forEach(function (fn) {
      try { fn(data); } catch (err) { console.error('[prism] listener for "' + event + '" threw', err); }
    });
  }

  window.addEventListener('message', function (e) {
    /* The only window that may drive this app is the one that embedded it. */
    if (e.source !== HOST) return;
    var m = e.data;
    if (!m || m.__prism !== PROTOCOL) return;

    if (m.type === 'host:ready') {
      context = m.context;
      readyResolve(context);
      return;
    }

    if (m.type === 'host:reply') {
      var p = pending.get(m.id);
      if (!p) return;
      pending.delete(m.id);
      if (m.ok) p.resolve(m.data);
      else p.reject(new PrismError(
        (m.error && m.error.code) || 'unknown',
        m.error && m.error.message,
        m.error && m.error.detail
      ));
      return;
    }

    if (m.type === 'host:event') emit(m.event, m.data);
  });

  var prism = {
    get context() { return context; },

    /* Announce the app is alive. The host runs a watchdog: an app that never
       calls ready() is shown to the wearer as not responding, with a way out. */
    ready: function () {
      if (!started) { started = true; post({ type: 'app:ready' }); }
      return readyPromise;
    },

    on: function (event, fn) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(fn);
      return function () { var s = listeners.get(event); if (s) s.delete(fn); };
    },

    permissions: {
      /* Resolves 'granted' | 'denied' | 'prompt' without ever showing UI. */
      query: function (name) { return call('permissions.query', { name: name }); },
      /* Shows the wearer a grant sheet. Resolves 'granted' or 'denied' — it does
         NOT reject, because a denial is a normal outcome an app must render. */
      request: function (name) { return call('permissions.request', { name: name }); },
    },

    location: {
      /* Rejects PrismError('permission-denied') if the wearer said no. */
      get: function () { return call('location.get'); },
    },

    /* Per-app key/value store held by the host. The opaque origin has no usable
       storage of its own, and this keeps one app's data out of another's. */
    storage: {
      get: function (key) { return call('storage.get', { key: key }); },
      set: function (key, value) { return call('storage.set', { key: key, value: value }); },
      remove: function (key) { return call('storage.remove', { key: key }); },
      keys: function () { return call('storage.keys'); },
    },

    /* Brokered network. Rejects PrismError('offline') when the link is down —
       apps are expected to render that, not swallow it. */
    fetch: function (url, opts) { return call('net.fetch', { url: url, opts: opts }); },

    notify: function (payload) { return call('notify', payload); },

    /* The app's one glanceable line on the home surface while it is not focused.
       Deliberately a short string: this display is 600px wide and one eye. */
    setBadge: function (text) { return call('hud.setBadge', { text: text }); },

    close: function () { return call('lifecycle.close'); },
  };

  window.PrismError = PrismError;
  window.prism = prism;
})();
