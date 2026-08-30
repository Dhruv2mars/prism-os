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

const rows = P.pieces.map((p) => `
<tr>
  <td style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.06);font-weight:600;white-space:nowrap">${esc(p.id)} ${esc(p.name)}</td>
  <td style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.06)">${badge(p.status)}</td>
  <td class="tab" style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.06);color:#8b93a7">R${p.round}</td>
  <td style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.06);color:#c6cdd9;font-size:13px">${p.verdict ? esc(p.verdict) : '<span style="color:#58607a">—</span>'}${p.gap ? `<div style="color:#ff9d5d;font-size:12px;margin-top:3px">gap: ${esc(p.gap)}</div>` : ''}</td>
</tr>`).join('\n');

const log = P.log.slice(-14).map((l) => `<div style="display:flex;gap:10px;padding:3px 0"><span style="color:#58607a;font-variant-numeric:tabular-nums;white-space:nowrap">${esc(l.t)}</span><span style="color:#aab2c5">${esc(l.msg)}</span></div>`).join('\n');

const done = P.pieces.filter((p) => p.status === 'passed').length;
const total = P.pieces.length;
const pct = total ? Math.round((done / total) * 100) : 0;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Prism OS — build progress</title></head>
<body style="margin:0;background:#0a0e17;color:#eef1f7;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,sans-serif">
<div style="max-width:860px;margin:0 auto;padding:40px 22px">
  <header style="display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:6px">
    <h1 style="font-size:26px;font-weight:800;letter-spacing:-0.02em;margin:0">Prism OS <span style="color:#56b8ff;font-weight:700">build progress</span></h1>
    <span class="tab" style="color:#8b93a7;font-size:13px;font-variant-numeric:tabular-nums">${esc(P.updated)} UTC · wave ${P.wave}</span>
  </header>
  <p style="color:#8b93a7;margin:0 0 18px;font-size:14px">${esc(P.tagline)}</p>
  <p style="margin:0 0 18px;font-size:13px"><a href="${esc(P.repo)}" style="color:#56b8ff;text-decoration:none;border-bottom:1px solid rgba(86,184,255,.4)">${esc(P.repo)}</a> · live demo served from <span class="tab" style="color:#8b93a7">/components/&lt;id&gt;/index.html</span></p>
  <div style="height:8px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden;margin-bottom:26px">
    <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#2f9dff,#56b8ff);transition:width .5s"></div>
  </div>
  <table style="width:100%;border-collapse:collapse;background:rgba(255,255,255,.03);border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,.07)">
    <thead><tr style="text-align:left">
      <th style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#58607a;border-bottom:1px solid rgba(255,255,255,.08)">piece</th>
      <th style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#58607a;border-bottom:1px solid rgba(255,255,255,.08)">status</th>
      <th style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#58607a;border-bottom:1px solid rgba(255,255,255,.08)">round</th>
      <th style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#58607a;border-bottom:1px solid rgba(255,255,255,.08)">latest verdict</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <h2 style="font-size:13px;text-transform:uppercase;letter-spacing:.12em;color:#58607a;margin:26px 0 8px">Build log</h2>
  <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:14px 16px;font-size:13px;line-height:1.55">${log || '<span style="color:#58607a">starting…</span>'}</div>
  <p style="color:#58607a;font-size:12px;margin-top:24px">Every piece is built by one agent and judged by a fresh-context critic that inspects rendered output only, scored against visionOS and Horizon OS side by side. Pass = ours ranked first or tied-first with zero named gaps.</p>
</div></body></html>`;

writeFileSync('dashboard/progress.html', html);
console.log(`dashboard written — ${done}/${total} passed`);
