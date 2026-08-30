#!/usr/bin/env bun
/* Regenerates dashboard/live.html (the public postplan page) from PROGRESS.json.
   Every upload is a full snapshot, so this rebuilds the whole page each time. */
import { readFileSync, writeFileSync } from 'node:fs';

const P = JSON.parse(readFileSync('PROGRESS.json', 'utf8'));
const e = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const ST = {
  queued:   ['#7c869e', 'rgba(124,134,158,.13)', 'queued'],
  building: ['#ffc247', 'rgba(255,194,71,.13)', 'building'],
  critic:   ['#56b8ff', 'rgba(86,184,255,.13)', 'in review'],
  fixing:   ['#ff9d5d', 'rgba(255,157,93,.13)', 'fixing'],
  passed:   ['#4cd47c', 'rgba(76,212,124,.13)', 'passed'],
};
const badge = (s) => { const [fg, bg, label] = ST[s] ?? ST.queued;
  return `<span class="badge" style="color:${fg};background:${bg}">${e(label)}</span>`; };

const pips = (n) => `<span class="pips" title="two consecutive passes required">${
  [0, 1].map((i) => `<i style="background:${i < (n || 0) ? '#4cd47c' : 'rgba(255,255,255,.12)'}"></i>`).join('')}</span>`;

/* score sparkline: ours per round against the visionOS reference line */
const spark = (h) => {
  if (!h || h.length < 1) return '<span class="dash">—</span>';
  const W = 108, H = 30, MAX = 90;
  const xs = (i) => h.length === 1 ? W / 2 : (i / (h.length - 1)) * (W - 4) + 2;
  const ys = (v) => H - 3 - (v / MAX) * (H - 6);
  const line = h.map((p, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)},${ys(p.ours).toFixed(1)}`).join(' ');
  const ref = h.length ? ys(h[h.length - 1].visionOS ?? 82) : 0;
  const last = h[h.length - 1];
  const delta = h.length > 1 ? last.ours - h[h.length - 2].ours : null;
  return `<span class="spark"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">
    <line x1="0" y1="${ref.toFixed(1)}" x2="${W}" y2="${ref.toFixed(1)}" stroke="rgba(255,255,255,.2)" stroke-dasharray="2 3" stroke-width="1"/>
    <path d="${line}" fill="none" stroke="#56b8ff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    ${h.map((p, i) => `<circle cx="${xs(i).toFixed(1)}" cy="${ys(p.ours).toFixed(1)}" r="${i === h.length - 1 ? 2.6 : 1.6}" fill="${p.verdict === 'pass' ? '#4cd47c' : '#56b8ff'}"/>`).join('')}
  </svg><b>${last.ours}<span>/90</span></b>${delta !== null ? `<em class="${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '+' : ''}${delta}</em>` : ''}</span>`;
};

const done = P.pieces.filter((p) => p.status === 'passed').length;
const total = P.pieces.length;
const pct = total ? (done / total) * 100 : 0;
const active = P.pieces.filter((p) => p.status === 'building' || p.status === 'critic' || p.status === 'fixing').length;
const rounds = P.pieces.reduce((a, p) => a + (p.round || 0), 0);

const waves = (P.waves ?? []).map((w) => {
  const ps = P.pieces.filter((p) => p.wave === w.wave);
  const d = ps.filter((p) => p.status === 'passed').length;
  const rows = ps.map((p) => `
    <tr>
      <td class="pid"><b>${e(p.id)}</b><span>${e(p.name)}</span></td>
      <td>${badge(p.status)}</td>
      <td class="num">R${p.round ?? 0}</td>
      <td>${pips(p.consecutivePasses)}</td>
      <td class="sp">${spark(p.history)}</td>
      <td class="gap">${p.gap ? `<span>${e(p.gap)}</span>` : '<span class="dash">—</span>'}</td>
    </tr>`).join('');
  return `<section class="wave">
    <header>
      <span class="wn">Wave ${w.wave}</span><h3>${e(w.name)}</h3>
      <span class="wc ${d === ps.length ? 'all' : ''}">${d}/${ps.length}</span>
    </header>
    <p class="why">${e(w.rationale)}</p>
    <div class="tw"><table>
      <thead><tr><th>piece</th><th>status</th><th>round</th><th>passes</th><th>score</th><th>open gap</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </section>`;
}).join('');

const log = (P.log ?? []).slice().reverse().map((l) =>
  `<li><span class="t">${e(l.t)}</span><span>${e(l.msg)}</span></li>`).join('');

const blocked = (P.blocked ?? []).map((b) => `<div class="blk">
  <b>${e(b.item)}</b><span class="bs">${e(b.status)}</span>
  <p>${e(b.detail)}</p>
  ${b.workaround ? `<p><em>Workaround.</em> ${e(b.workaround)}</p>` : ''}
  ${b.residual ? `<p><em>Residual.</em> ${e(b.residual)}</p>` : ''}
</div>`).join('');

const causes = (P.priorRun?.rootCauses ?? []).map((c) => `<li>${e(c)}</li>`).join('');
const counters = (P.countermeasures ?? []).map((c) => `<li>${e(c)}</li>`).join('');

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Prism OS — the gauntlet</title>
<style>
:root{--bg:#0a0e17;--ink:#eef1f7;--dim:#8b93a7;--faint:#59627a;--line:rgba(255,255,255,.08);--acc:#56b8ff}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.6 -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:980px;margin:0 auto;padding:52px 22px 90px}
h1{font-size:clamp(28px,5vw,40px);font-weight:800;letter-spacing:-.03em;margin:0 0 6px;line-height:1.1}
h1 span{color:var(--acc)}
.sub{color:var(--dim);margin:0 0 26px;font-size:16px}
.meta{color:var(--faint);font-size:13px;font-variant-numeric:tabular-nums}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin:22px 0 12px}
.stat{background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:13px;padding:13px 15px}
.stat b{display:block;font-size:24px;font-weight:800;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.stat span{color:var(--faint);font-size:11px;text-transform:uppercase;letter-spacing:.11em;font-weight:700}
.bar{height:9px;border-radius:99px;background:rgba(255,255,255,.07);overflow:hidden;margin:16px 0 8px}
.bar i{display:block;height:100%;background:linear-gradient(90deg,#2f9dff,#56b8ff);border-radius:99px}
.rule{color:var(--faint);font-size:13px;line-height:1.6;margin:0 0 34px;max-width:76ch}
.wave{margin-bottom:30px}
.wave header{display:flex;align-items:baseline;gap:10px;margin-bottom:3px;flex-wrap:wrap}
.wn{color:var(--faint);font-size:11px;text-transform:uppercase;letter-spacing:.13em;font-weight:700}
.wave h3{margin:0;font-size:17px;font-weight:700;letter-spacing:-.01em}
.wc{margin-left:auto;color:var(--faint);font-weight:700;font-variant-numeric:tabular-nums;font-size:14px}
.wc.all{color:#4cd47c}
.why{color:var(--faint);font-size:13px;margin:0 0 11px;max-width:80ch;line-height:1.55}
.tw{overflow-x:auto;background:rgba(255,255,255,.025);border:1px solid var(--line);border-radius:15px}
table{width:100%;border-collapse:collapse;min-width:660px}
th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--faint);font-weight:700;padding:11px 14px;border-bottom:1px solid var(--line)}
td{padding:11px 14px;border-bottom:1px solid rgba(255,255,255,.05);vertical-align:middle;font-size:13.5px}
tr:last-child td{border-bottom:0}
.pid b{display:block;font-weight:700;font-size:13px}
.pid span{color:var(--dim);font-size:12.5px}
.badge{padding:3px 10px;border-radius:99px;font-size:10.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;white-space:nowrap}
.num{color:var(--dim);font-variant-numeric:tabular-nums}
.pips{display:inline-flex;gap:4px}
.pips i{width:8px;height:8px;border-radius:50%;display:block}
.spark{display:inline-flex;align-items:center;gap:8px}
.spark b{font-variant-numeric:tabular-nums;font-weight:700;font-size:14px}
.spark b span{color:var(--faint);font-weight:600;font-size:11px}
.spark em{font-style:normal;font-size:11px;font-weight:700;font-variant-numeric:tabular-nums}
.spark em.up{color:#4cd47c}.spark em.down{color:#ff5d5d}
.gap span{color:#ffb989;font-size:12.5px;line-height:1.45;display:block;max-width:34ch}
.dash{color:var(--faint)}
h2{font-size:11px;text-transform:uppercase;letter-spacing:.13em;color:var(--faint);margin:34px 0 11px;font-weight:700}
.blk{border:1px solid rgba(255,157,93,.28);background:rgba(255,157,93,.06);border-radius:13px;padding:14px 16px;margin-bottom:10px}
.blk b{color:#ffb989;font-size:14px}
.blk .bs{color:var(--dim);font-size:12px;margin-left:8px}
.blk p{margin:7px 0 0;color:#aab2c5;font-size:13px;line-height:1.6}
.blk em{color:#dfe4ee;font-style:normal;font-weight:700}
ul.log{list-style:none;padding:0;margin:0;background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:14px;overflow:hidden}
ul.log li{display:flex;gap:13px;padding:9px 16px;border-bottom:1px solid rgba(255,255,255,.05);font-size:13px;line-height:1.55}
ul.log li:last-child{border-bottom:0}
ul.log .t{color:var(--faint);font-variant-numeric:tabular-nums;white-space:nowrap;min-width:52px}
ul.log li span:last-child{color:#aab2c5}
ol.why2{color:#aab2c5;font-size:13.5px;line-height:1.65;padding-left:20px;margin:0}
ol.why2 li{margin-bottom:6px}
footer{color:var(--faint);font-size:12.5px;line-height:1.65;margin-top:40px;border-top:1px solid var(--line);padding-top:18px;max-width:80ch}
a{color:var(--acc);text-decoration:none;border-bottom:1px solid rgba(86,184,255,.35)}
</style></head>
<body><div class="wrap">
<h1>Prism OS <span>the gauntlet</span></h1>
<p class="sub">${e(P.tagline)}</p>
<p class="meta">Updated ${e(P.updated)} UTC · run ${e(P.runId ?? '')} · <a href="${e(P.repo)}">${e(P.repo)}</a></p>

<div class="stats">
  <div class="stat"><b>${done}<span style="color:var(--faint);font-size:15px">/${total}</span></b><span>passed</span></div>
  <div class="stat"><b>${active}</b><span>agents live</span></div>
  <div class="stat"><b>${rounds}</b><span>rounds run</span></div>
  <div class="stat"><b>${(P.waves ?? []).length}</b><span>waves</span></div>
</div>
<div class="bar"><i style="width:${pct.toFixed(1)}%"></i></div>
<p class="rule">${e(P.passRule ?? '')}</p>

${waves}

<h2>Why the previous run stalled</h2>
<p class="why">${P.priorRun ? `${P.priorRun.verdicts} verdicts, every one a fail. Ours scored ${e(P.priorRun.oursRange)} against visionOS at ${e(P.priorRun.visionOSRange)}.` : ''}</p>
<ol class="why2">${causes}</ol>

<h2>What is different this time</h2>
<ol class="why2">${counters}</ol>

${blocked ? `<h2>Blocked &amp; deviations</h2>${blocked}` : ''}

<h2>Build log</h2>
<ul class="log">${log}</ul>

<footer>Every piece is built by one agent and judged by a fresh-context critic that runs the probe itself and reads only its own screenshots — never a builder's words. Each is scored blind as System A/B/C against a specifically named visionOS screen and a specifically named Horizon OS screen, across nine criteria worth 90 points: glanceability, focus discipline, material honesty, motion, typography, edge states, dependability, accessibility, delight.<br><br>${e(P.doneDefinition ?? '')}</footer>
</div></body></html>`;

writeFileSync('dashboard/live.html', html);
console.log(`live.html written — ${done}/${total} passed, ${active} active`);
