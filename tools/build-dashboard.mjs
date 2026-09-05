#!/usr/bin/env bun
/* Regenerates dashboard/progress.html from PROGRESS.json */
import { readFileSync, writeFileSync } from 'node:fs';

const P = JSON.parse(readFileSync('PROGRESS.json', 'utf8'));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const badge = (st) => {
  const map = {
    queued: ['#8b93a7', 'rgba(139,147,167,.15)'],
    building: ['#ffc247', 'rgba(255,194,71,.14)'],
    critic: ['#56b8ff', 'rgba(86,184,255,.14)'],
    fixing: ['#ff9d5d', 'rgba(255,157,93,.14)'],
    passed: ['#4cd47c', 'rgba(76,212,124,.14)'],
  };
  const [fg, bg] = map[st] ?? map.queued;
  return `<span style="background:${bg};color:${fg};padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase">${esc(st)}</span>`;
};

const pips = (n) => `<span style="display:inline-flex;gap:3px;vertical-align:middle">${[0, 1].map((i) =>
  `<span style="width:7px;height:7px;border-radius:50%;background:${i < n ? '#4cd47c' : 'rgba(255,255,255,.13)'}"></span>`).join('')}</span>`;

const cell = 'padding:9px 13px;border-bottom:1px solid rgba(255,255,255,.06)';

const waveBlock = (w) => {
  const ps = P.pieces.filter((p) => p.wave === w.wave);
  const done = ps.filter((p) => p.status === 'passed').length;
  const rows = ps.map((p) => `
<tr>
  <td style="${cell};font-weight:600;white-space:nowrap">${esc(p.id)}<div style="font-weight:400;color:#8b93a7;font-size:12px">${esc(p.name)}</div></td>
  <td style="${cell}">${badge(p.status)}</td>
  <td style="${cell};color:#8b93a7;font-variant-numeric:tabular-nums">R${p.round}</td>
  <td style="${cell}" title="two consecutive passes required">${pips(p.consecutivePasses ?? 0)}</td>
  <td style="${cell};color:#c6cdd9;font-size:13px">${p.verdict ? esc(p.verdict) : '<span style="color:#58607a">—</span>'}${p.gap ? `<div style="color:#ff9d5d;font-size:12px;margin-top:3px">gap: ${esc(p.gap)}</div>` : ''}</td>
</tr>`).join('\n');
  return `
<section style="margin-bottom:26px">
  <h2 style="font-size:13px;letter-spacing:.02em;margin:0 0 3px;display:flex;align-items:baseline;gap:9px">
    <span style="color:#58607a;font-size:11px;text-transform:uppercase;letter-spacing:.12em">Wave ${w.wave}</span>
    <span style="font-weight:700">${esc(w.name)}</span>
    <span style="color:${done === ps.length ? '#4cd47c' : '#58607a'};font-weight:600;font-variant-numeric:tabular-nums">${done}/${ps.length}</span>
  </h2>
  <p style="color:#58607a;font-size:12px;line-height:1.5;margin:0 0 9px;max-width:70ch">${esc(w.rationale)}</p>
  <table style="width:100%;border-collapse:collapse;background:rgba(255,255,255,.03);border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,.07)">
    <tbody>${rows}</tbody>
  </table>
</section>`;
};

const log = P.log.slice(-16).map((l) => `<div style="display:flex;gap:10px;padding:3px 0"><span style="color:#58607a;font-variant-numeric:tabular-nums;white-space:nowrap">${esc(l.t)}</span><span style="color:#aab2c5">${esc(l.msg)}</span></div>`).join('\n');

const blocked = (P.blocked ?? []).map((b) => `
<div style="border:1px solid rgba(255,157,93,.3);background:rgba(255,157,93,.07);border-radius:12px;padding:12px 14px;margin-bottom:9px">
  <div style="font-weight:700;font-size:13px;color:#ffb989">${esc(b.item)}</div>
  <div style="color:#8b93a7;font-size:12px;margin-top:2px">${esc(b.status)}</div>
  <div style="color:#aab2c5;font-size:12px;line-height:1.55;margin-top:6px">${esc(b.detail)}</div>
  ${b.workaround ? `<div style="color:#aab2c5;font-size:12px;line-height:1.55;margin-top:5px"><b style="color:#c6cdd9">Workaround </b>${esc(b.workaround)}</div>` : ''}
  ${b.residual ? `<div style="color:#8b93a7;font-size:12px;line-height:1.55;margin-top:5px"><b style="color:#c6cdd9">Residual </b>${esc(b.residual)}</div>` : ''}
</div>`).join('\n');

const done = P.pieces.filter((p) => p.status === 'passed').length;
const total = P.pieces.length;
const pct = total ? Math.round((done / total) * 100) : 0;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Prism OS — build progress</title></head>
<body style="margin:0;background:#0a0e17;color:#eef1f7;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,sans-serif">
<div style="max-width:900px;margin:0 auto;padding:40px 22px 70px">
  <header style="display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:6px">
    <h1 style="font-size:26px;font-weight:800;letter-spacing:-0.02em;margin:0">Prism OS <span style="color:#56b8ff;font-weight:700">build progress</span></h1>
    <span style="color:#8b93a7;font-size:13px;font-variant-numeric:tabular-nums">${esc(P.updated)} UTC · wave ${P.wave}</span>
  </header>
  <p style="color:#8b93a7;margin:0 0 14px;font-size:14px">${esc(P.tagline)}</p>
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
    <div style="flex:1;height:8px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden">
      <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#2f9dff,#56b8ff);transition:width .5s"></div>
    </div>
    <span style="font-variant-numeric:tabular-nums;font-weight:700;font-size:14px;color:${done === total ? '#4cd47c' : '#c6cdd9'}">${done}/${total} passed</span>
  </div>
  <p style="color:#58607a;font-size:12px;line-height:1.6;margin:0 0 26px;max-width:78ch">${esc(P.passRule ?? '')}</p>
  ${(P.waves ?? []).map(waveBlock).join('\n')}
  ${blocked ? `<h2 style="font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:#58607a;margin:26px 0 9px">Blocked / deviations</h2>${blocked}` : ''}
  <h2 style="font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:#58607a;margin:26px 0 8px">Build log</h2>
  <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:14px 16px;font-size:13px;line-height:1.55">${log || '<span style="color:#58607a">starting…</span>'}</div>
  <p style="color:#58607a;font-size:12px;margin-top:24px;line-height:1.6;max-width:78ch">Every piece is built by one agent and judged by a fresh-context critic that runs the probe itself and inspects only rendered output, scored blind against a named visionOS screen and a named Horizon OS screen across nine criteria. ${esc(P.doneDefinition ?? '')}</p>
</div></body></html>`;

writeFileSync('dashboard/progress.html', html);
console.log(`dashboard written — ${done}/${total} passed`);
