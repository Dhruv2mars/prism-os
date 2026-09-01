/* Proves the developer portal documents the SDK that actually shipped.
 *
 * Documentation drift is invisible until a third-party developer wastes an
 * afternoon on it, so this gate resolves every documented method path against a
 * real `window.prism` inside a real sandboxed frame, and every documented
 * permission against the real catalogue. Exits non-zero on any failure.
 *
 *   bun tools/test-devportal.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.PRISM_BASE || 'http://localhost:4310';
const PORTAL = `${BASE}/components/24-devsdk/index.html`;
const HARNESS = `${BASE}/tools/runtime-harness.html`;

let passed = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) { passed++; console.log(`  ok   ${name}`); }
  else { failures.push({ name, detail }); console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`); }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

await page.goto(PORTAL, { waitUntil: 'networkidle' });

/* ---------- the page renders from the real modules ---------- */
console.log('\nportal');
{
  const real = await page.evaluate(async () => {
    const m = await import('/os/shared/app-manifest.js');
    return { perms: Object.keys(m.PERMISSIONS), cats: m.CATEGORIES, version: m.MANIFEST_VERSION };
  });

  const documented = await page.$$eval('#permRows tr td:first-child code', (n) => n.map((e) => e.textContent));
  check('every real permission is documented',
    real.perms.every((p) => documented.includes(p)),
    `real ${JSON.stringify(real.perms)} vs documented ${JSON.stringify(documented)}`);
  check('no permission is documented that does not exist',
    documented.every((p) => real.perms.includes(p)),
    JSON.stringify(documented));

  const pill = await page.textContent('#versionPill');
  check('manifest version comes from the module', pill === `manifest v${real.version}`, pill);

  const catLine = await page.textContent('#fieldRows');
  check('category list comes from the module',
    real.cats.every((c) => catLine.includes(c)), JSON.stringify(real.cats));

  const methods = await page.$$eval('[data-sdk-method]', (n) => n.map((e) => e.dataset.sdkMethod));
  check('the SDK reference is not empty', methods.length >= 10, String(methods.length));
}

/* ---------- the live validator is the real validator ---------- */
console.log('\nvalidator');
{
  await page.click('[data-sample="bad"]');
  await page.waitForFunction(() => document.querySelector('.verdict')?.classList.contains('bad'));
  const badFields = await page.$$eval('.issue.err .field', (n) => n.map((e) => e.textContent));
  check('a broken manifest is rejected in the page', badFields.length > 0);
  for (const f of ['id', 'name', 'version', 'entry', 'category', 'permissions']) {
    check(`  rejection names "${f}"`, badFields.some((x) => x === f || x.startsWith(f)),
      JSON.stringify(badFields));
  }

  await page.click('[data-sample="transit"]');
  await page.waitForFunction(() => document.querySelector('.verdict')?.classList.contains('ok'));
  check('a good manifest is accepted in the page', true);
  const normalized = await page.textContent('.normalized pre');
  check('the accepted result shows what the OS stores', /"id": "transit"/.test(normalized || ''));

  await page.fill('#manifestInput', '{ not json');
  await page.waitForFunction(() => /Not valid JSON/.test(document.querySelector('.verdict')?.textContent || ''));
  check('unparseable input is reported as JSON, not as a schema failure', true);
}

/* ---------- documented methods resolve on the shipped SDK ---------- */
console.log('\nsdk surface');
const documentedMethods = await page.$$eval('[data-sdk-method]', (n) => n.map((e) => e.dataset.sdkMethod));

const app = await browser.newPage({ viewport: { width: 900, height: 600 } });
app.on('pageerror', (e) => consoleErrors.push(`app pageerror: ${e.message}`));
await app.goto(HARNESS, { waitUntil: 'networkidle' });
await app.waitForFunction(() => window.rtReady === true);
await app.evaluate(() => window.rt.install('transit'));
await app.evaluate(() => window.rt.launch('transit'));
await app.waitForFunction(() => window.rt.instances.get('transit')?.status === 'running', null, { timeout: 8000 });

const frame = app.frames().find((f) => f.url().includes('/os/apps/transit/'));
check('the sample app is running in a real frame', !!frame, app.frames().map((f) => f.url()).join(', '));

if (frame) {
  const resolved = await frame.evaluate((paths) => {
    const out = {};
    for (const p of paths) {
      let node = window.prism;
      for (const part of p.split('.')) node = node == null ? undefined : node[part];
      out[p] = typeof node;
    }
    return out;
  }, documentedMethods);

  for (const [path, type] of Object.entries(resolved)) {
    check(`prism.${path} exists on the shipped SDK`, type === 'function', `typeof = ${type}`);
  }

  const errShape = await frame.evaluate(() => ({
    ctor: typeof window.PrismError,
    code: new window.PrismError('offline', 'x').code,
  }));
  check('PrismError is exported with a code field', errShape.ctor === 'function' && errShape.code === 'offline',
    JSON.stringify(errShape));

  /* Documented events must be events the SDK will actually deliver. */
  const documentedEvents = await page.$$eval('#eventRows tr td:first-child code', (n) => n.map((e) => e.textContent));
  const known = ['suspend', 'resume', 'offline', 'online', 'permissionchange', 'displaychange'];
  check('documented events match the SDK event set',
    documentedEvents.length === known.length && documentedEvents.every((e) => known.includes(e)),
    JSON.stringify(documentedEvents));
}

/* ---------- documented error codes are codes the host can emit ---------- */
console.log('\nerror codes');
if (frame) {
  const documentedCodes = await page.$$eval('#errorRows tr td:first-child code', (n) => n.map((e) => e.textContent));

  /* Clear any grant sheet the sample app opened on its own, and pre-grant what
     it declared, so what follows measures refusals and not a queued prompt. */
  await app.evaluate(() => {
    if (window.rt.pendingPrompt) window.rt.answerPrompt('granted');
    for (const p of ['network', 'notifications', 'storage']) window.rt.setPermission('transit', p, 'granted');
  });

  /* Driven from INSIDE the sandbox, because that is the only vantage point a
     third-party developer ever has. A code they cannot observe from here is not
     a code worth documenting. */
  const emitted = await frame.evaluate(async () => {
    const raw = (method, params) => new Promise((resolve) => {
      const id = 'probe-' + Math.random().toString(36).slice(2);
      const onMsg = (e) => {
        const m = e.data;
        if (!m || m.__prism !== 1 || m.type !== 'host:reply' || m.id !== id) return;
        window.removeEventListener('message', onMsg);
        resolve(m.ok ? 'ok' : m.error.code);
      };
      window.addEventListener('message', onMsg);
      window.parent.postMessage({ __prism: 1, type: 'app:call', id, method, params }, '*');
    });
    const codes = [];
    /* Transit never declared location, so the host must refuse before asking. */
    codes.push(await raw('location.get', {}));
    codes.push(await raw('nonexistent.method', {}));
    codes.push(await raw('net.fetch', { url: 'https://evil.example.com/x' }));
    /* And the SDK's own rejection carries the same code, not a bare string. */
    try { await window.prism.location.get(); codes.push('ok'); }
    catch (err) { codes.push(err instanceof window.PrismError ? err.code : 'not-a-PrismError'); }
    return codes;
  });

  for (const code of emitted) {
    check(`host emits "${code}", and it is documented`, documentedCodes.includes(code),
      `documented: ${JSON.stringify(documentedCodes)}`);
  }
  check('the SDK rejects with a PrismError, not a string', !emitted.includes('not-a-PrismError'));

  const offlineCode = await app.evaluate(() => window.rt.setOnline(false)).then(() =>
    frame.evaluate(() => window.prism.fetch('https://api.prism.dev/weather/now')
      .then(() => 'ok', (e) => e.code)));
  check('going offline surfaces the documented "offline" code',
    offlineCode === 'offline' && documentedCodes.includes('offline'), String(offlineCode));
  await app.evaluate(() => window.rt.setOnline(true));
}

/* ---------- no errors anywhere ---------- */
console.log('\nhygiene');
check('no console or page errors', consoleErrors.length === 0, consoleErrors.join(' | '));

await browser.close();

console.log(`\n${failures.length ? 'DEV PORTAL GATE: FAIL' : 'DEV PORTAL GATE: PASS'} — ${passed} checks, ${failures.length} failures`);
if (failures.length) {
  for (const f of failures) console.log(`  - ${f.name}${f.detail ? `: ${f.detail}` : ''}`);
  process.exit(1);
}
