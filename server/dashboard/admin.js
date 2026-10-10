/* Eng Yuyu dashboard, vanilla JS single-page app */
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TZ = 'Africa/Mogadishu';
const money = n => '$' + Number(n || 0).toLocaleString('en');
const num = n => Number(n || 0).toLocaleString('en');
const compact = n => n >= 1e6 ? +(n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? +(n / 1e3).toFixed(1) + 'K' : String(n);
const fmtDT = ms => new Intl.DateTimeFormat('en', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(ms);
const fmtD = ms => new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(ms);
const ago = ms => { const s = (Date.now() - ms) / 1000; if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + ' min ago'; if (s < 86400) return Math.floor(s / 3600) + ' h ago'; if (s < 86400 * 30) return Math.floor(s / 86400) + ' d ago'; return fmtD(ms); };
const I = {
  overview: '<path d="M4 13h6V4H4zM14 20h6V11h-6zM14 8h6V4h-6zM4 20h6v-3H4z"/>',
  bookings: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  content: '<path d="M5 4h11l3 3v13H5zM9 11h6M9 15h6"/>',
  subscribers: '<path d="M4 6h16v12H4zM4 7l8 6 8-6"/>',
  messages: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.2-4.4A8 8 0 1 1 21 12Z"/>',
  traffic: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',
  blog: '<path d="M4 5h16v14H4zM8 9h8M8 13h5"/>',
  writers: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M17 5.5a3 3 0 0 1 0 5.5M18 14.3c1.8.7 3 2.4 3 4.7"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
};
const PAGES = [['overview', 'Overview'], ['bookings', 'Bookings'], ['blog', 'Blog'], ['writers', 'Writers'], ['content', 'Content'], ['subscribers', 'Newsletter'], ['messages', 'Messages'], ['traffic', 'Traffic'], ['settings', 'Settings']];

/* ---------- api ---------- */
async function api(path, opts = {}) {
  const r = await fetch('/api/admin' + path, { credentials: 'same-origin', ...opts, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'yy-admin', ...(opts.headers || {}) }, body: opts.body && typeof opts.body !== 'string' ? JSON.stringify(opts.body) : opts.body });
  if (r.status === 401) { showLogin(); throw new Error('auth'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Request failed');
  return j;
}
const toast = (msg, bad) => { const t = $('#toast'); t.textContent = msg; t.classList.toggle('bad', !!bad); t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2800); };
const guard = fn => async (...a) => { try { return await fn(...a); } catch (e) { if (e.message !== 'auth') toast(e.message || 'Something went wrong', true); } };

/* ---------- charts (inline SVG) ---------- */
function barsChart(items, { fmt = money, h = 190 } = {}) {
  const W = innerWidth < 820 ? 340 : 640, pad = { l: 40, r: 6, t: 12, b: 26 }, max = Math.max(1, ...items.map(i => i.v)), ticks = 4;
  const iw = (W - pad.l - pad.r) / items.length, bw = Math.min(34, iw * .62);
  let g = '';
  for (let i = 0; i <= ticks; i++) { const y = pad.t + (h - pad.t - pad.b) * (1 - i / ticks); g += `<line class="grid-l" x1="${pad.l}" x2="${W - pad.r}" y1="${y}" y2="${y}"/><text x="${pad.l - 8}" y="${y + 4}" text-anchor="end">${esc(fmt(Math.round(max * i / ticks)))}</text>`; }
  const bars = items.map((it, i) => { const bh = (h - pad.t - pad.b) * it.v / max, x = pad.l + iw * i + (iw - bw) / 2, y = h - pad.b - bh; return `<rect class="bar" x="${x}" y="${y}" width="${bw}" height="${Math.max(bh, 0)}" rx="5"><title>${esc(it.l)}: ${esc(fmt(it.v))}${it.extra ? ' · ' + esc(it.extra) : ''}</title></rect>${(items.length <= 8 || iw >= 30 || i % 2 === 0) ? `<text x="${x + bw / 2}" y="${h - 8}" text-anchor="middle">${esc(it.l)}</text>` : ''}`; }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${h}" role="img" aria-label="Bar chart">${g}${bars}</svg>`;
}
function areaChart(series, labels, { h = 200, colors = ['var(--blue)', '#7fb4ff'] } = {}) {
  const W = innerWidth < 820 ? 340 : 640, pad = { l: 38, r: 6, t: 12, b: 24 }, n = labels.length, max = Math.max(1, ...series.flat()), iw = (W - pad.l - pad.r) / Math.max(1, n - 1);
  const X = i => pad.l + iw * i, Y = v => pad.t + (h - pad.t - pad.b) * (1 - v / max);
  let g = ''; for (let i = 0; i <= 4; i++) { const y = pad.t + (h - pad.t - pad.b) * (1 - i / 4); g += `<line class="grid-l" x1="${pad.l}" x2="${W - pad.r}" y1="${y}" y2="${y}"/><text x="${pad.l - 6}" y="${y + 4}" text-anchor="end">${compact(Math.round(max * i / 4))}</text>`; }
  const step = Math.max(1, Math.ceil(n / (W < 400 ? 4 : 7))), xl = labels.map((l, i) => i % step === 0 ? `<text x="${X(i)}" y="${h - 6}" text-anchor="middle">${esc(l)}</text>` : '').join('');
  const paths = series.map((s, k) => { const pts = s.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`); const line = 'M' + pts.join('L'); const area = k === 0 ? `<path d="${line}L${X(n - 1)},${h - pad.b}L${X(0)},${h - pad.b}Z" fill="${colors[0]}" opacity=".12"/>` : ''; return area + `<path d="${line}" fill="none" stroke="${colors[k]}" stroke-width="2.2" stroke-linejoin="round"/>`; }).join('');
  const dots = labels.map((l, i) => `<rect x="${X(i) - iw / 2}" y="${pad.t}" width="${iw}" height="${h - pad.t - pad.b}" fill="transparent"><title>${esc(l)}: ${series.map(s => num(s[i])).join(' / ')}</title></rect>`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${h}" role="img" aria-label="Trend chart">${g}${xl}${paths}${dots}</svg>`;
}
function donut(items) {
  const total = items.reduce((a, i) => a + i.v, 0), cols = ['#006AFF', '#7fb4ff', '#0B1F3A', '#8fa6c4', '#25a0ff'], R = 42, C = 2 * Math.PI * R;
  let off = 0;
  const segs = total ? items.map((it, i) => { const len = C * it.v / total, s = `<circle cx="60" cy="60" r="${R}" fill="none" stroke="${cols[i % cols.length]}" stroke-width="18" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 60 60)"><title>${esc(it.l)}: ${num(it.v)}</title></circle>`; off += len; return s; }).join('') : `<circle cx="60" cy="60" r="${R}" fill="none" stroke="var(--surface2)" stroke-width="18"/>`;
  return `<div class="donut-wrap"><svg viewBox="0 0 120 120" role="img" aria-label="Share chart">${segs}<text x="60" y="58" text-anchor="middle" style="font:700 16px var(--fh);fill:var(--text)">${compact(total)}</text><text x="60" y="73" text-anchor="middle" style="font-size:9px;fill:var(--muted)">total</text></svg><div class="legend" style="flex-direction:column;gap:8px;margin:0">${items.map((it, i) => `<span><i style="background:${cols[i % cols.length]}"></i>${esc(it.l)} <b>${total ? Math.round(it.v / total * 100) : 0}%</b></span>`).join('')}</div></div>`;
}
const hbars = (entries, fmt = num) => { const max = Math.max(1, ...entries.map(e => e[1])); return entries.length ? entries.map(([k, v]) => `<div class="hbar"><span>${esc(k)}</span><span class="t"><b style="width:${v / max * 100}%"></b></span><span class="n">${fmt(v)}</span></div>`).join('') : '<p class="empty">No data yet</p>'; };
const spark = vals => { if (vals.length < 2) return ''; const max = Math.max(1, ...vals), W = 100, H = 40; return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="M${vals.map((v, i) => `${(i / (vals.length - 1) * W).toFixed(1)},${(H - 4 - v / max * (H - 8)).toFixed(1)}`).join('L')}"/></svg>`; };
const deltaChip = d => d === null || d === undefined ? '' : `<span class="delta ${d > 0 ? 'up' : d < 0 ? 'down' : 'flat'}">${d > 0 ? '▲' : d < 0 ? '▼' : '•'} ${Math.abs(d)}%</span>`;

/* ---------- shell ---------- */
let state = { page: 'overview', range: 30, bookingFilter: 'all', badge: {} };
function showLogin(which = 'loginForm') { $('#app').hidden = true; $('#login').hidden = false; ['loginForm', 'forgotForm', 'resetForm'].forEach(id => { $('#' + id).hidden = id !== which; });
  const f = { loginForm: '#un', resetForm: '#np1' }[which]; if (f) $(f).focus(); }
function showApp() { $('#login').hidden = true; $('#app').hidden = false; }
const PRIMARY = ['overview', 'bookings', 'blog', 'messages'];
function renderNav() {
  const link = ([id, label], cls = '') => `<a ${cls ? `class="${cls}" ` : ''}href="#/${id}" ${state.page === id ? 'aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true">${I[id]}</svg><span>${label}</span>${state.badge[id] ? `<span class="badge">${state.badge[id]}</span>` : ''}</a>`;
  $('#nav').innerHTML = PAGES.map(p => link(p)).join('');
  $('#tabbar').innerHTML = PAGES.filter(p => PRIMARY.includes(p[0])).map(p => link(p)).join('') + `<button type="button" id="moreBtn" ${PRIMARY.includes(state.page) ? '' : 'aria-current="page"'} aria-expanded="false" aria-controls="more"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></svg><span>More</span></button>`;
  $('#moreLinks').innerHTML = PAGES.filter(p => !PRIMARY.includes(p[0])).map(p => link(p)).join('');
  $('#moreBtn').onclick = () => toggleSheet();
}
function toggleSheet(open) {
  const o = open === undefined ? $('#more').hidden : open;
  $('#more').hidden = !o; $('#sheetBg').hidden = !o; $('#moreBtn') && $('#moreBtn').setAttribute('aria-expanded', o);
  document.body.style.overflow = o ? 'hidden' : '';
}
function renderSys(s) {
  const row = (ok, label) => `<span><i class="dot ${ok === 'mock' ? 'warn' : ok ? 'ok' : 'bad'}"></i>${label}${ok === 'mock' ? ' (demo)' : ''}</span>`;
  $('#sys').innerHTML = row(s.google, 'Google Calendar & email') + row(s.sifalo, 'Online payments');
}
const render = guard(async () => {
  const [page, arg] = (location.hash.replace('#/', '') || 'overview').split('/');
  state.page = PAGES.some(p => p[0] === page) ? page : 'overview';
  renderNav(); toggleSheet(false);
  const main = $('#main'); main.innerHTML = '<div class="grid kpis"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>';
  document.title = PAGES.find(p => p[0] === state.page)[1] + ': Dashboard';
  await views[state.page](main, arg);
  main.focus({ preventScroll: true });
});
async function refreshBadges() {
  try { const s = await api('/summary?range=' + state.range); state.badge = { messages: s.kpi.messages.unread || '', bookings: s.attention.filter(a => a.go === 'bookings').length || '' }; renderSys(s.system); renderNav(); return s; } catch { /* ignore */ }
}

/* ---------- views ---------- */
const views = {};

views.overview = async main => {
  const s = await api('/summary?range=' + state.range); state.badge = { messages: s.kpi.messages.unread || '', bookings: s.attention.filter(a => a.go === 'bookings').length || '' }; renderSys(s.system); renderNav();
  const k = s.kpi, hour = new Date().getHours(), greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const revSpark = s.weeks.map(w => w.revenue), pvSpark = s.traffic.daily.map(d => d.pv);
  const kpi = (lbl, val, sub, sp) => `<div class="card kpi"><span class="lbl">${lbl}</span><span class="val">${val}</span><span class="sub">${sub}</span>${sp || ''}</div>`;
  main.innerHTML = `
  <div class="head"><div><h1>${greet}, Yusuf</h1><p>Here is how your business is doing${s.system.mock ? ' <b>(demo data)</b>' : ''}.</p></div>
    <div class="seg" role="group" aria-label="Period">${[7, 30, 90].map(r => `<button data-range="${r}" aria-pressed="${r === s.range}">${r} days</button>`).join('')}</div></div>
  <div class="grid kpis">
    ${kpi('Revenue', money(k.revenue.value), `${deltaChip(k.revenue.delta)} vs previous · ${money(k.totalRevenue)} all time`, spark(revSpark))}
    ${kpi('Paid bookings', num(k.bookings.value), `${deltaChip(k.bookings.delta)} avg ${money(k.aov.value)} each`)}
    ${kpi('Upcoming sessions', num(k.upcoming.value), k.upcoming.next ? `Next: ${esc(k.upcoming.next.name)} · ${fmtDT(k.upcoming.next.start)}` : 'Nothing scheduled')}
    ${kpi('Page views', compact(k.views.value), `${deltaChip(k.views.delta)} ${num(k.views.visitors)} visitors`, spark(pvSpark))}
    ${kpi('Subscribers', num(k.subscribers.value), `+${num(k.subscribers.new)} new ${deltaChip(k.subscribers.delta)}`)}
    ${kpi('Checkout conversion', k.conversion.value === null ? '-' : k.conversion.value + '%', 'Started checkouts that paid')}
  </div>
  <div class="row r21">
    <section class="card"><h3>Smart summary <small>auto-generated</small></h3><div class="insights">${s.insights.length ? s.insights.map(i => `<div class="insight ${i.tone}"><i></i><span>${esc(i.text)}</span></div>`).join('') : '<p class="empty">Insights appear as data comes in.</p>'}</div></section>
    <section class="card"><h3>Needs attention</h3><div class="attn">${s.attention.length ? s.attention.map(a => `<a href="#/${a.go}${a.filter ? '/' + a.filter : ''}"><i class="dot ${a.tone === 'bad' ? 'bad' : a.tone === 'warn' ? 'warn' : 'ok'}"></i>${esc(a.text)}<span class="go">→</span></a>`).join('') : '<div><i class="dot ok"></i>All clear: nothing needs action.</div>'}</div></section>
  </div>
  <div class="row r21">
    <section class="card"><h3>Revenue by week <small>last 12 weeks</small></h3>${barsChart(s.weeks.map(w => ({ l: w.label, v: w.revenue, extra: w.bookings + ' bookings' })))}</section>
    <section class="card"><h3>Session mix <small>${s.range} days · revenue</small></h3>${donut(s.mix.map(m => ({ l: m.title, v: m.revenue })))}<div class="legend">${s.mix.map(m => `<span>${esc(m.title)}: ${m.count} × → ${money(m.revenue)}</span>`).join('')}</div></section>
  </div>
  <div class="row r21">
    <section class="card"><h3>Website traffic <small>page views / visitors</small></h3>${areaChart([s.traffic.daily.map(d => d.pv), s.traffic.daily.map(d => d.uv)], s.traffic.daily.map(d => d.day.slice(5)))}<div class="legend"><span><i style="background:var(--blue)"></i>Page views</span><span><i style="background:#7fb4ff"></i>Visitors</span></div></section>
    <section class="card"><h3>Top pages</h3>${hbars(Object.entries(s.traffic.pages).sort((a, b) => b[1] - a[1]))}<h3 style="margin-top:18px">Top sources</h3>${hbars(Object.entries(s.traffic.refs).sort((a, b) => b[1] - a[1]).slice(0, 5))}</section>
  </div>
  <div class="row r12">
    <section class="card"><h3>Busiest booking days <small>sessions by weekday</small></h3>${barsChart(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((l, i) => ({ l, v: s.weekdays[i] })), { fmt: n => n, h: 150 })}<p class="help">Availability in the next 14 days is <b>${s.utilization}%</b> booked.</p></section>
    <section class="card"><h3>Recent activity</h3>${s.activity.length ? s.activity.map(a => `<div class="item" style="padding:10px 12px;margin-bottom:8px"><div class="grow"><b style="font-weight:500">${esc(a.text)}</b><small>${ago(a.t)}</small></div></div>`).join('') : '<p class="empty">No activity yet</p>'}</section>
  </div>`;
  $$('[data-range]', main).forEach(b => b.onclick = () => { state.range = +b.dataset.range; render(); });
};

const STATUS = { paid: 'Paid', confirmed: 'Confirmed', pending: 'Awaiting payment', failed: 'Payment failed', expired: 'Expired', cancelled: 'Cancelled', paid_conflict: 'Needs reschedule' };
views.bookings = async (main, arg) => {
  const list = await api('/bookings'); const now = Date.now();
  let filter = arg || state.bookingFilter, q = '';
  const filters = [['all', 'All'], ['upcoming', 'Upcoming'], ['paid', 'Paid'], ['pending', 'Awaiting payment'], ['paid_conflict', 'Needs action'], ['expired', 'Expired'], ['cancelled', 'Cancelled']];
  const apply = () => list.filter(o => (filter === 'all' || (filter === 'upcoming' ? ['paid', 'confirmed'].includes(o.status) && o.start > now : filter === 'paid' ? ['paid', 'confirmed'].includes(o.status) : o.status === filter)) && (!q || (o.name + o.email + o.ref + o.title).toLowerCase().includes(q)));
  const paint = () => {
    const rows = apply();
    $('#bk-table').innerHTML = rows.length ? `<table class="t-bk"><thead><tr><th>Ref</th><th>Client</th><th>Session</th><th>When (Mogadishu)</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(o => `<tr>
      <td class="mono">${o.ref}</td><td><b>${esc(o.name)}</b><br><small style="color:var(--muted)">${esc(o.email)}</small></td><td>${esc(o.title)}<br><small style="color:var(--muted)">${o.min} min</small></td>
      <td>${fmtDT(o.start)}</td><td class="mono">${money(o.amount)}${o.payType ? `<br><small style="color:var(--muted)">${esc(o.payType)}</small>` : ''}</td>
      <td><span class="pill ${o.status}">${STATUS[o.status] || o.status}</span>${o.test ? ' <span class="pill test">TEST</span>' : ''}</td>
      <td><button class="btn sm" data-open="${o.id}">Manage</button></td></tr>`).join('')}</tbody></table>` : '<p class="empty">No bookings match.</p>';
    $$('[data-open]').forEach(b => b.onclick = () => openBooking(list.find(o => o.id === b.dataset.open)));
  };
  main.innerHTML = `<div class="head"><div><h1>Bookings</h1><p>${list.length} total · payments and meeting links are handled automatically.</p></div><a class="btn" href="/api/admin/bookings.csv">Export CSV</a></div>
  <div class="toolbar"><div class="chips" role="group" aria-label="Filter">${filters.map(([k, l]) => `<button class="chip" data-f="${k}" aria-pressed="${k === filter}">${l}</button>`).join('')}</div><input type="search" id="bk-q" placeholder="Search name, email, ref…" aria-label="Search bookings"></div>
  <div class="table-wrap" id="bk-table"></div>`;
  $$('[data-f]', main).forEach(b => b.onclick = () => { filter = state.bookingFilter = b.dataset.f; $$('[data-f]', main).forEach(x => x.setAttribute('aria-pressed', x === b)); paint(); });
  $('#bk-q').oninput = e => { q = e.target.value.toLowerCase(); paint(); };
  paint();
};
function openBooking(o) {
  const can = { resend: ['paid', 'confirmed'].includes(o.status), markpaid: !['paid', 'confirmed', 'cancelled'].includes(o.status), cancel: o.status !== 'cancelled', del: !['paid', 'confirmed'].includes(o.status) };
  dialog(`<h2>${esc(o.title)}: ${esc(o.name)}</h2>
   <div class="grid" style="grid-template-columns:1fr 1fr;gap:10px;font-size:.93rem">
    <div><small>Reference</small><br><b class="mono">${o.ref}</b></div><div><small>Status</small><br><span class="pill ${o.status}">${STATUS[o.status] || o.status}</span>${o.test ? ' <span class="pill test">TEST</span>' : ''}</div>
    <div><small>Session time (Mogadishu)</small><br><b>${fmtDT(o.start)}</b> · ${o.min} min</div><div><small>Amount</small><br><b>${money(o.amount)}</b> ${o.payType ? '· ' + esc(o.payType) : ''}</div>
    <div><small>Email</small><br><a href="mailto:${esc(o.email)}" style="color:var(--accent)">${esc(o.email)}</a></div><div><small>Created</small><br>${fmtD(o.createdAt)} (${ago(o.createdAt)})</div>
    ${o.sid ? `<div><small>Payment ID</small><br><span class="mono">${esc(o.sid)}</span></div>` : ''}${o.meet ? `<div><small>Google Meet</small><br><a href="${esc(o.meet)}" target="_blank" rel="noopener" style="color:var(--accent)">Open link</a></div>` : ''}
   </div>${o.note ? `<p style="background:var(--surface2);padding:12px;border-radius:10px;margin:0"><small>Client note</small><br>${esc(o.note)}</p>` : ''}
   <div class="actions">${can.resend ? '<button type="button" class="btn sm" data-a="resend">Resend approval email</button>' : ''}${can.markpaid ? '<button type="button" class="btn sm primary" data-a="markpaid">Mark as paid &amp; approve</button>' : ''}${can.cancel ? '<button type="button" class="btn sm danger" data-a="cancel">Cancel booking</button>' : ''}${can.del ? '<button type="button" class="btn sm danger" data-a="delete">Delete</button>' : ''}<button type="button" class="btn sm" data-close>Close</button></div>
   ${can.markpaid ? '<p class="help">“Mark as paid” is for payments you received outside the website (cash, bank). It creates the calendar event and sends the approval email.</p>' : ''}`);
  $$('[data-a]', $('#dlgForm')).forEach(b => b.onclick = guard(async () => {
    if (['cancel', 'delete'].includes(b.dataset.a) && !confirm(b.dataset.a === 'cancel' ? 'Cancel this booking? The calendar event is removed. Refunds are done in your payment account.' : 'Delete this record?')) return;
    b.disabled = true; await api(`/bookings/${o.id}/${b.dataset.a}`, { method: 'POST' }); toast('Done'); $('#dlg').close(); render();
  }));
}

/* content */
const CONTENT_TABS = [['events', 'Events'], ['media', 'Media'], ['partners', 'Partners'], ['ads', 'Partner ads'], ['community', 'Community links'], ['proof', 'Proof'], ['testimonials', 'Testimonials'], ['audience', 'Audience numbers']];
let contentCache = null;
views.content = async (main, arg) => {
  const tab = CONTENT_TABS.some(t => t[0] === arg) ? arg : 'events';
  contentCache = await api('/content');
  main.innerHTML = `<div class="head"><div><h1>Content</h1><p>Everything here updates the public website. Changes appear on the site within seconds.</p></div></div>
  <div class="tabs" role="tablist">${CONTENT_TABS.map(([k, l]) => `<button role="tab" data-t="${k}" aria-selected="${k === tab}">${l}</button>`).join('')}</div><div id="ct-body"></div>`;
  $$('[data-t]', main).forEach(b => b.onclick = () => { location.hash = '#/content/' + b.dataset.t; });
  const body = $('#ct-body');
  if (tab === 'audience') return audienceView(body);
  const items = contentCache[tab];
  const label = { posts: x => [x.en[0], `${x.cat} · ${x.date} · ${x.min} min`], events: x => [x.en[0], `${x.date} · ${(x.type || (x.tag && x.tag[0]) || 'event')}${x.place ? ' · ' + x.place : ''} · ${(x.images || []).length} photo${(x.images || []).length === 1 ? '' : 's'}`], media: x => [x.en, `${x.kind} · ${x.date}${x.outlet ? ' · ' + x.outlet : ''}`], partners: x => [typeof x === 'string' ? x : x.name, (typeof x === 'object' && x.logo) ? 'Logo added' + (x.dark === 'custom' && x.logoDark ? ' · separate dark logo' : x.dark === 'invert' ? ' · auto-white in dark mode' : '') : 'No logo yet: the name is shown as text'], community: x => [x.name, x.href], proof: x => [`${x.metric ? x.metric + ', ' : ''}${x.en[0]}`, x.en[1]], testimonials: x => [`${x.name}${x.role ? ' · ' + x.role : ''}`, x.en], ads: x => [`${x.partner}: ${x.en[0]}`, `${x.video ? 'Video clip' : 'Animated card'} · ${x.seconds || 12} s${x.enabled === false ? ' · hidden' : ' · live on the blog pages'}`] }[tab];
  body.innerHTML = `<div class="toolbar"><button class="btn primary" id="add">+ Add ${({ community: 'link', proof: 'proof item', testimonials: 'testimonial', media: 'media item', ads: 'partner ad' })[tab] || tab.slice(0, -1)}</button></div>${items.length ? items.map((x, i) => { const [a, b] = label(x); return `<div class="item">${tab === 'events' ? `<span class="p-thumb ev-thumb">${(x.images || [])[0] ? `<img src="${esc(x.images[0])}" alt="">` : `<i>▶</i>`}</span>` : ''}${tab === 'partners' ? `<span class="p-thumb">${(typeof x === 'object' && x.logo) ? `<img src="${esc(x.logo)}" alt="">` : `<i>${esc(String(a).slice(0, 1).toUpperCase())}</i>`}</span>` : ''}<div class="grow"><b>${esc(a)}</b><small>${esc(b)}</small></div><button class="btn sm" data-e="${i}">Edit</button><button class="btn sm danger" data-d="${i}">Delete</button></div>`; }).join('') : '<p class="empty">Nothing here yet.</p>'}`;
  const save = guard(async arr => { await api('/content/' + tab, { method: 'PUT', body: arr }); toast('Saved, live on the website'); render(); });
  $('#add').onclick = () => editItem(tab, null, arr => save([...items, arr]));
  $$('[data-e]', body).forEach(b => b.onclick = () => editItem(tab, items[+b.dataset.e], v => save(items.map((x, i) => i === +b.dataset.e ? v : x))));
  $$('[data-d]', body).forEach(b => b.onclick = () => { if (confirm('Delete this item from the website?')) save(items.filter((_, i) => i !== +b.dataset.d)); });
};
let currentImgs = [];
function cropTo169(file) {   // any photo -> 1280x720 JPEG (cover crop), small enough to upload
  return new Promise((ok, no) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const W = 1280, H = 720, c = document.createElement('canvas'); c.width = W; c.height = H;
      const r = Math.max(W / im.width, H / im.height), w = im.width * r, h = im.height * r;
      c.getContext('2d').drawImage(im, (W - w) / 2, (H - h) / 2, w, h); URL.revokeObjectURL(url);
      ok(c.toDataURL('image/jpeg', 0.86));
    };
    im.onerror = () => { URL.revokeObjectURL(url); no(new Error('Could not read that image')); }; im.src = url;
  });
}
function wireImageSlots(initial) {
  currentImgs = [...initial].slice(0, 4);
  const box = $('#f-imgs');
  const paint = () => {
    box.innerHTML = [0, 1, 2, 3].map(i => { const u = currentImgs[i];
      return `<div class="img-slot ${u ? 'has' : ''}" data-i="${i}">${u ? `<img src="${esc(u)}" alt="Photo ${i + 1}">${i === 0 ? '<span class="cover-badge">Cover</span>' : ''}<div class="is-actions">${i > 0 ? '<button type="button" class="btn sm" data-cover title="Make cover">★</button>' : ''}<button type="button" class="btn sm danger" data-del aria-label="Remove photo">✕</button></div>` : `<label class="is-add"><span>+ Add photo</span><input type="file" accept="image/*" hidden></label>`}</div>`; }).join('');
    $$('.img-slot', box).forEach(s => {
      const i = +s.dataset.i, f = $('input[type=file]', s);
      if (f) f.onchange = guard(async e => { const file = e.target.files[0]; if (!file) return; toast('Uploading…'); const data = await cropTo169(file); const r = await api('/upload', { method: 'POST', body: { data } }); currentImgs[Math.min(i, currentImgs.length)] = r.url; currentImgs = currentImgs.filter(Boolean).slice(0, 4); toast('Photo added'); paint(); });
      const del = $('[data-del]', s); if (del) del.onclick = () => { currentImgs.splice(i, 1); paint(); };
      const cv = $('[data-cover]', s); if (cv) cv.onclick = () => { const [u] = currentImgs.splice(i, 1); currentImgs.unshift(u); paint(); };
    });
  };
  paint();
}
function logoField(id, label, val, mode) {
  return `<div class="logo-field" data-lf="${id}"><label for="${id}">${label}</label>
    <div class="logo-prev ${mode}"><img alt="Logo preview" ${val ? `src="${esc(val)}"` : 'hidden'}><span class="lp-empty" ${val ? 'hidden' : ''}>No logo</span></div>
    <div class="lf-row"><label class="btn sm up">Upload image<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden></label><button type="button" class="btn sm" data-lf-clear>Remove</button></div>
    <input id="${id}" type="url" value="${esc(val)}" placeholder="…or paste an image link" maxlength="400">
    <p class="help">PNG, SVG, WebP or JPG up to 1 MB. A transparent PNG or SVG works best.</p></div>`;
}
function wireVideoField() {
  const input = $('#f-video'), state = $('#f-vid-state');
  const show = () => { state.textContent = input.value ? 'A video is attached.' : 'No video: an animated card will be shown.'; };
  $('#f-vid-file').onchange = guard(async e => {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 12e6) { toast('Video is too large (max 12 MB)', true); return; }
    state.textContent = 'Uploading… please wait';
    const r = await fetch('/api/admin/upload-video', { method: 'POST', credentials: 'same-origin', headers: { 'X-Requested-With': 'yy-admin', 'Content-Type': 'application/octet-stream' }, body: file }), j = await r.json().catch(() => ({}));
    if (!r.ok) { show(); toast(j.error || 'Upload failed', true); return; }
    input.value = j.url; show(); toast('Video uploaded');
  });
  $('#f-vid-clear').onclick = () => { input.value = ''; show(); };
}
function wireLogoFields() {
  const f = $('#dlgForm');
  $$('.logo-field[data-lf]', f).forEach(box => {   // image uploaders only (the ad video box has its own handler)
    const input = $('input[type=url]', box), img = $('img', box), empty = $('.lp-empty', box);
    const show = () => { const v = input.value.trim(); img.hidden = !v; empty.hidden = !!v; if (v) img.src = v; };
    input.oninput = show;
    $('input[type=file]', box).onchange = guard(async e => {
      const file = e.target.files[0]; if (!file) return;
      if (file.size > 1048576) { toast('Image is too large (max 1 MB)', true); return; }
      const data = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(file); });
      const r = await api('/upload', { method: 'POST', body: { data } }); input.value = r.url; show(); toast('Uploaded');
    });
    $('[data-lf-clear]', box).onclick = () => { input.value = ''; show(); };
  });
  const sel = $('#f-dark'); if (sel) sel.onchange = () => { $('#f-dark-box').hidden = sel.value !== 'custom'; };
}
function field(id, label, val, o = {}) { return `<div><label for="${id}">${label}</label>${o.area ? `<textarea id="${id}" rows="${o.rows || 3}" ${o.max ? `maxlength="${o.max}"` : ''}>${esc(val)}</textarea>` : o.opts ? `<select id="${id}">${o.opts.map(([v, l]) => `<option value="${v}" ${v === val ? 'selected' : ''}>${l}</option>`).join('')}</select>` : `<input id="${id}" type="${o.type || 'text'}" value="${esc(val)}" ${o.max ? `maxlength="${o.max}"` : ''} ${o.req ? 'required' : ''}>`}${o.help ? `<p class="help">${o.help}</p>` : ''}</div>`; }
function editItem(tab, x, done) {
  const v = x || {}, en = v.en || ['', ''], so = v.so || ['', ''];
  let html;
  if (tab === 'posts') html = `<h2>${x ? 'Edit' : 'New'} blog post</h2>${field('f-en0', 'Title (English)', en[0], { req: 1, max: 200 })}${field('f-en1', 'Summary (English)', en[1], { area: 1, max: 600 })}${field('f-so0', 'Title (Somali)', so[0], { max: 200 })}${field('f-so1', 'Summary (Somali)', so[1], { area: 1, max: 600 })}
    <div class="three">${field('f-cat', 'Category', v.cat || 'ai', { opts: [['ai', 'AI'], ['gadgets', 'Gadgets'], ['dev', 'Development'], ['growth', 'Digital Growth']] })}${field('f-date', 'Date', v.date || new Date().toISOString().slice(0, 10), { type: 'date' })}${field('f-min', 'Minutes to read', v.min || 5, { type: 'number' })}</div>${field('f-href', 'Link to full article (optional)', v.href || '', { help: 'URL to the full post, e.g. your blog or YouTube video.' })}`;
  else if (tab === 'events') { const imgs = (v.images || []).slice(0, 4), art = v.article || {}; html = `<h2>${x ? 'Edit' : 'New'} event</h2>
    <p class="help" style="margin:0">Conferences, talks, panels or events you attended. Add 1–4 photos (the first one is the cover), a title, date, place and the highlights.</p>
    ${field('f-type', 'Type', v.type || 'conference', { opts: [['conference', 'Conference'], ['talk', 'Talk'], ['panel', 'Panel'], ['attended', 'Attended'], ['workshop', 'Workshop'], ['media', 'Media'], ['other', 'Other']] })}
    <div class="two">${field('f-date', 'Date', v.date || new Date().toISOString().slice(0, 10), { type: 'date' })}${field('f-place', 'Location (e.g. Mogadishu, or Online)', v.place || '', { max: 120 })}</div>
    <div><label>Photos <small style="font-weight:400;color:var(--muted)">- up to 4, cropped to 16:9. The first photo is the cover.</small></label><div class="img-slots" id="f-imgs"></div></div>
    ${field('f-en0', 'Title (English)', en[0], { req: 1, max: 160 })}${field('f-en1', 'Short summary shown on the slide (English)', en[1], { area: 1, rows: 2, max: 400 })}${field('f-art-en', 'Highlights / article (English)', art.en || '', { area: 1, rows: 8, max: 6000, help: 'What happened, key moments, topics you covered. Leave a blank line between paragraphs.' })}
    ${field('f-so0', 'Title (Somali)', so[0], { max: 160 })}${field('f-so1', 'Short summary (Somali)', so[1], { area: 1, rows: 2, max: 400 })}${field('f-art-so', 'Highlights / article (Somali)', art.so || '', { area: 1, rows: 8, max: 6000 })}
    ${field('f-link', 'Link (registration, programme or article, optional)', v.link || '', { type: 'url' })}
    <div class="two">${field('f-icon', 'Icon (shown when there are no photos)', v.icon || 'mic', { opts: [['mic', 'Microphone'], ['cap', 'Graduation'], ['video', 'Video'], ['chart', 'Chart'], ['spark', 'Spark']] })}${field('f-feat', 'Highlight this event', v.feature ? '1' : '', { opts: [['', 'No'], ['1', 'Yes']] })}</div>`; }
  else if (tab === 'partners') { const o = typeof v === 'string' ? { name: v } : v; html = `<h2>${x ? 'Edit' : 'New'} partner</h2>${field('f-name', 'Brand name (used for accessibility; the website shows only the logo)', o.name || '', { req: 1, max: 60 })}${field('f-url', 'Website (optional: logo becomes a link)', o.url || '', { type: 'url' })}
    ${logoField('f-logo', 'Logo: light mode', o.logo || '', 'light')}
    ${field('f-dark', 'Dark mode', o.dark || 'same', { opts: [['same', 'Use the same logo'], ['custom', 'Upload a separate dark-mode logo'], ['invert', 'Turn the logo white automatically (for one-colour logos)']] })}
    <div id="f-dark-box" ${o.dark === 'custom' ? '' : 'hidden'}>${logoField('f-logod', 'Logo: dark mode (white or light version)', o.logoDark || '', 'dark')}</div>`; }
  else if (tab === 'ads') html = `<h2>${x ? 'Edit' : 'New'} partner ad</h2><p class="help" style="margin:0">Shown as a sliding “Sponsored” showcase on the blog pages. Ads appear as a <b>vertical 9:16 card</b> in the right-hand column of the <b>blog and Events &amp; Media pages</b>. Make the clip <b>1080 × 1920 (portrait Full HD)</b>, 10–15 seconds, or leave the video empty to show an animated card with the partner's logo. Only add an ad with the partner's permission.</p>
    ${field('f-partner', 'Partner name', v.partner || '', { req: 1, max: 60 })}
    <div class="two">${field('f-en0', 'Headline (English)', en[0], { req: 1, max: 100 })}${field('f-so0', 'Headline (Somali)', so[0], { max: 100 })}</div>
    <div class="two">${field('f-en1', 'Short text (English)', en[1], { area: 1, rows: 2, max: 220 })}${field('f-so1', 'Short text (Somali)', so[1], { area: 1, rows: 2, max: 220 })}</div>
    <div class="two">${field('f-cta-en', 'Button text (English)', (v.cta || [])[0] || '', { max: 30, help: 'Empty = “Learn more”' })}${field('f-cta-so', 'Button text (Somali)', (v.cta || [])[1] || '', { max: 30 })}</div>
    ${field('f-url', 'Partner link (https://…)', v.url || '', { type: 'url', help: 'Opens in a new tab and is marked as sponsored.' })}
    <div class="logo-field" id="f-vid-box"><label>Video clip (optional)</label><p class="help" id="f-vid-state">${v.video ? 'A video is attached.' : 'No video: an animated card will be shown.'}</p><div class="lf-row"><label class="btn sm up">Upload MP4 / WebM<input type="file" accept="video/mp4,video/webm" hidden id="f-vid-file"></label><button type="button" class="btn sm" id="f-vid-clear">Remove</button></div><input id="f-video" type="hidden" value="${esc(v.video || '')}"><p class="help">1080 × 1920 (9:16) works best; a landscape clip also works but is shown smaller on a dark card. Up to 12 MB (2–6 MB is typical). It plays muted, in a loop, while its slide is showing.</p></div>
    ${logoField('f-poster', 'Poster image (optional: shown before the video loads)', v.poster || '', 'light')}
    ${logoField('f-logo', 'Partner logo (used on the animated card; a white version works best)', v.logo || '', 'dark')}
    <p class="help" style="margin:0"><b>15-second story</b> (animation style only): a hook, up to 3 feature captions shown one after another with a moving highlight, then a “message sent” end card that shows the short text above. Keep captions under 40 characters.</p>
    <div class="two">${field('f-cap-en1', 'Feature caption 1 (English)', ((v.caps || {}).en || [])[0] || '', { max: 40 })}${field('f-cap-so1', 'Feature caption 1 (Somali)', ((v.caps || {}).so || [])[0] || '', { max: 40 })}</div><div class="two">${field('f-cap-en2', 'Feature caption 2 (English)', ((v.caps || {}).en || [])[1] || '', { max: 40 })}${field('f-cap-so2', 'Feature caption 2 (Somali)', ((v.caps || {}).so || [])[1] || '', { max: 40 })}</div><div class="two">${field('f-cap-en3', 'Feature caption 3 (English)', ((v.caps || {}).en || [])[2] || '', { max: 40 })}${field('f-cap-so3', 'Feature caption 3 (Somali)', ((v.caps || {}).so || [])[2] || '', { max: 40 })}</div>
    ${field('f-scene', 'Animation style (used when there is no video)', v.scene || '', { opts: [['', 'Simple logo card'], ['phone', 'Phone'], ['shield', 'Security shield'], ['wallet', 'Wallet']] })}
    <div class="three">${field('f-theme', 'Animated card colour', v.theme || 'blue', { opts: [['blue', 'Blue'], ['green', 'Green'], ['violet', 'Violet'], ['sunset', 'Sunset'], ['gold', 'Gold']] })}${field('f-secs', 'Seconds on screen (10–15)', v.seconds || 12, { type: 'number' })}${field('f-on', 'Show on the website', v.enabled === false ? '0' : '1', { opts: [['1', 'Yes'], ['0', 'No (hidden)']] })}</div>`;
  else if (tab === 'media') html = `<h2>${x ? 'Edit' : 'New'} media item</h2><p class="help" style="margin:0">A video, interview, podcast or article you appeared in. For YouTube links the thumbnail is added automatically.</p>${field('f-en', 'Title (English)', v.en || '', { req: 1, max: 160 })}${field('f-so', 'Title (Somali, optional)', v.so || '', { max: 160 })}${field('f-url', 'Link', v.url || '', { type: 'url', req: 1 })}<div class="three">${field('f-kind', 'Type', v.kind || 'video', { opts: [['video', 'Video'], ['interview', 'Interview'], ['podcast', 'Podcast'], ['show', 'Show'], ['article', 'Article']] })}${field('f-outlet', 'Outlet / show', v.outlet || '', { max: 80 })}${field('f-date', 'Date', v.date || new Date().toISOString().slice(0, 10), { type: 'date' })}</div>`;
  else if (tab === 'proof') html = `<h2>${x ? 'Edit' : 'New'} proof item</h2><p class="help" style="margin:0">Your own projects and real results, a number, a short title and one sentence. Example: “50, First 50 online orders for a local shop”.</p>${field('f-metric', 'Big number or word (e.g. 1M+, 50, 3x)', v.metric || '', { max: 24 })}${field('f-en0', 'Title (English)', en[0], { req: 1, max: 120 })}${field('f-en1', 'Description (English)', en[1], { area: 1, max: 320 })}${field('f-so0', 'Title (Somali)', so[0], { max: 120 })}${field('f-so1', 'Description (Somali)', so[1], { area: 1, max: 320 })}${field('f-href', 'Link (optional)', v.href || '', { type: 'url' })}`;
  else if (tab === 'testimonials') html = `<h2>${x ? 'Edit' : 'New'} testimonial</h2><p class="help" style="margin:0">Only add a testimonial with the client's permission. The section appears on the consulting page once there is at least one.</p>${field('f-name', 'Name', v.name || '', { req: 1, max: 60 })}${field('f-role', 'Role / business (optional)', v.role || '', { max: 80 })}${field('f-en', 'What they said (English)', v.en || '', { area: 1, rows: 4, max: 500 })}${field('f-so', 'What they said (Somali, optional)', v.so || '', { area: 1, rows: 4, max: 500 })}`;
  else html = `<h2>${x ? 'Edit' : 'New'} community link</h2>${field('f-name', 'Name', v.name || '', { req: 1, max: 40 })}${field('f-en', 'Description (English)', v.en || '')}${field('f-so', 'Description (Somali)', v.so || '')}<div class="two">${field('f-icon', 'Icon', v.icon || 'chat', { opts: [['play', 'Play'], ['chat', 'Chat'], ['users', 'People']] })}${field('f-href', 'Link', v.href || '', { type: 'url' })}</div>`;
  dialog(html + '<div class="actions"><button type="button" class="btn" data-close>Cancel</button><button type="submit" class="btn primary" id="f-save">Save</button></div>');
  if (tab === 'partners' || tab === 'ads') wireLogoFields();
  if (tab === 'ads') wireVideoField();
  if (tab === 'events') wireImageSlots(x ? (x.images || []) : []);
  $('#dlgForm').onsubmit = e => {
    e.preventDefault(); const g = id => $('#' + id).value.trim();
    let out;
    if (tab === 'posts') out = { ...v, cat: g('f-cat'), date: g('f-date'), min: +g('f-min') || 5, en: [g('f-en0'), g('f-en1')], so: [g('f-so0') || g('f-en0'), g('f-so1') || g('f-en1')], href: g('f-href') || undefined };
    else if (tab === 'events') out = { ...v, type: g('f-type'), feature: g('f-feat') ? true : undefined, icon: g('f-icon'), date: g('f-date'), place: g('f-place'), link: g('f-link') || undefined, images: [...currentImgs], article: { en: g('f-art-en'), so: g('f-art-so') }, tag: v.tag || [({ conference: 'Conference', talk: 'Talk', panel: 'Panel', attended: 'Attended', workshop: 'Workshop', media: 'Media', other: 'Event' })[g('f-type')], ''], en: [g('f-en0'), g('f-en1')], so: [g('f-so0') || g('f-en0'), g('f-so1') || g('f-en1')] };
    else if (tab === 'partners') { const o = { name: g('f-name') }; if (g('f-url')) o.url = g('f-url'); if (g('f-logo')) { o.logo = g('f-logo'); o.dark = g('f-dark'); if (g('f-dark') === 'custom' && g('f-logod')) o.logoDark = g('f-logod'); } out = o.logo || o.url ? o : o.name; }
    else if (tab === 'ads') out = { ...v, id: v.id, partner: g('f-partner'), en: [g('f-en0'), g('f-en1')], so: [g('f-so0') || g('f-en0'), g('f-so1') || g('f-en1')], cta: [g('f-cta-en'), g('f-cta-so') || g('f-cta-en')], url: g('f-url'), video: g('f-video'), poster: g('f-poster'), logo: g('f-logo'), theme: g('f-theme'), scene: g('f-scene'), caps: { en: [1, 2, 3].map(i => g('f-cap-en' + i)).filter(Boolean), so: [1, 2, 3].map(i => g('f-cap-so' + i) || g('f-cap-en' + i)).filter(Boolean) }, seconds: +g('f-secs') || 12, enabled: g('f-on') !== '0' };
    else if (tab === 'media') out = { ...v, en: g('f-en'), so: g('f-so') || g('f-en'), url: g('f-url'), kind: g('f-kind'), outlet: g('f-outlet'), date: g('f-date') };
    else if (tab === 'proof') out = { ...v, metric: g('f-metric'), en: [g('f-en0'), g('f-en1')], so: [g('f-so0') || g('f-en0'), g('f-so1') || g('f-en1')], href: g('f-href') || undefined };
    else if (tab === 'testimonials') out = { ...v, name: g('f-name'), role: g('f-role'), en: g('f-en'), so: g('f-so') || g('f-en') };
    else out = { ...v, name: g('f-name'), en: g('f-en'), so: g('f-so') || g('f-en'), icon: g('f-icon'), href: g('f-href') };
    $('#dlg').close(); done(out);
  };
}
async function audienceView(body) {
  const st = await api('/stats'), c = st.current;
  body.innerHTML = `<div class="row r21"><section class="card"><h3>Follower &amp; view counts <small>shown on the homepage</small></h3>
   <form class="form" id="stForm">${[['youtube', 'YouTube subscribers'], ['facebook', 'Facebook followers'], ['tiktok', 'TikTok followers'], ['instagram', 'Instagram followers'], ['views', 'Total views']].map(([k, l]) => field('s-' + k, l, c[k], { type: 'number' })).join('')}
   <p class="help">Source: <b>${st.source}</b> · last updated ${ago(st.updatedAt)}. Social platforms need private API keys for automatic counts, so update these when you like, the website shows them instantly (total followers is the sum).</p><div><button class="btn primary" type="submit">Save numbers</button></div></form></section>
   <section class="card"><h3>History</h3>${st.history.length ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>YT</th><th>FB</th><th>TT</th><th>IG</th></tr></thead><tbody>${st.history.slice(0, 8).map(h => `<tr><td>${fmtD(h.t)}</td><td>${compact(h.youtube)}</td><td>${compact(h.facebook)}</td><td>${compact(h.tiktok)}</td><td>${compact(h.instagram)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">Saved updates appear here.</p>'}</section></div>`;
  $('#stForm').onsubmit = guard(async e => { e.preventDefault(); const b = {}; for (const k of ['youtube', 'facebook', 'tiktok', 'instagram', 'views']) b[k] = $('#s-' + k).value; await api('/stats', { method: 'PUT', body: b }); toast('Saved, live on the website'); render(); });
}

/* subscribers */
views.subscribers = async main => {
  const [subs, sum] = await Promise.all([api('/subscribers'), api('/summary?range=30')]);
  const active = subs.filter(s => !s.unsubscribed); let q = '';
  main.innerHTML = `<div class="head"><div><h1>Newsletter</h1><p>${num(active.length)} active subscribers · ${num(sum.kpi.subscribers.new)} joined in the last 30 days.</p></div><div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn" href="/api/admin/subscribers.csv">Export CSV</a><button class="btn primary" id="compose">Write newsletter</button></div></div>
  <div class="toolbar"><input type="search" id="sq" placeholder="Search email…" aria-label="Search subscribers"><button class="btn" id="addSub">+ Add subscriber</button></div><div class="table-wrap" id="sub-table"></div>`;
  const paint = () => { const rows = subs.filter(s => !q || s.email.includes(q)).slice(0, 200); $('#sub-table').innerHTML = rows.length ? `<table class="t-sub"><thead><tr><th>Email</th><th>Language</th><th>Joined</th><th>Source</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(s => `<tr><td>${esc(s.email)}</td><td>${s.lang.toUpperCase()}</td><td>${fmtD(s.createdAt)}</td><td>${esc(s.source)}</td><td><span class="pill ${s.unsubscribed ? 'cancelled' : 'paid'}">${s.unsubscribed ? 'Unsubscribed' : 'Active'}</span></td><td><button class="btn sm danger" data-del="${s.id}">Remove</button></td></tr>`).join('')}</tbody></table>` : '<p class="empty">No subscribers found.</p>';
    $$('[data-del]').forEach(b => b.onclick = guard(async () => { if (!confirm('Remove this subscriber?')) return; await api('/subscribers/' + b.dataset.del, { method: 'DELETE' }); render(); })); };
  $('#sq').oninput = e => { q = e.target.value.toLowerCase(); paint(); }; paint();
  $('#addSub').onclick = () => { dialog(`<h2>Add subscriber</h2>${field('a-mail', 'Email', '', { type: 'email', req: 1 })}<div class="actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary" type="submit">Add</button></div>`); $('#dlgForm').onsubmit = guard(async e => { e.preventDefault(); await api('/subscribers', { method: 'POST', body: { email: $('#a-mail').value } }); $('#dlg').close(); render(); }); };
  $('#compose').onclick = () => {
    dialog(`<h2>Write newsletter</h2><p class="help" style="margin:0">Sent from your Gmail to ${num(Math.min(450, active.length))} active subscribers, each with an unsubscribe link. Gmail allows roughly 500 emails a day.</p>${field('n-sub', 'Subject', '', { req: 1, max: 150 })}${field('n-body', 'Message', '', { area: 1, rows: 9, max: 8000, help: 'Plain text. Leave a blank line between paragraphs.' })}<div class="actions"><button type="button" class="btn" data-close>Cancel</button><button type="button" class="btn" id="n-test">Send test to me</button><button type="submit" class="btn primary">Send to subscribers</button></div>`);
    const send = guard(async test => { const body = { subject: $('#n-sub').value, body: $('#n-body').value, test }; const r = await api('/broadcast', { method: 'POST', body }); toast(test ? 'Test email sent to your inbox' : `Sent to ${r.sent} subscribers${r.failed ? `, ${r.failed} failed` : ''}`); if (!test) $('#dlg').close(); });
    $('#n-test').onclick = () => send(true);
    $('#dlgForm').onsubmit = e => { e.preventDefault(); if (confirm(`Send this newsletter to ${Math.min(450, active.length)} subscribers now?`)) send(false); };
  };
};

/* messages */
views.messages = async main => {
  const list = await api('/messages'); let cur = list.find(m => !m.read) || list[0];
  const typeName = { work: 'Work with me', consulting: 'Consulting', events: 'Events & Media', partner: 'Brand partnership', other: 'Other' };
  const paint = () => {
    $('#m-list').innerHTML = list.map(m => `<button class="msg ${m.read ? '' : 'unread'}" data-m="${m.id}" aria-current="${cur && cur.id === m.id}"><b>${esc(m.name)}</b><small>${esc(typeName[m.type] || m.type)} · ${ago(m.createdAt)}</small><small>${esc(m.message)}</small></button>`).join('') || '<p class="empty">No messages yet.</p>';
    $('#m-view').innerHTML = cur ? `<h3>${esc(cur.name)} <small>${esc(typeName[cur.type] || cur.type)}</small></h3><p style="color:var(--muted);margin-top:-6px">${esc(cur.email)} · ${fmtD(cur.createdAt)}</p><p style="white-space:pre-wrap;font-size:1rem">${esc(cur.message)}</p><div class="actions" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:18px"><a class="btn primary" href="mailto:${esc(cur.email)}?subject=${encodeURIComponent('Re: your message to Eng Yuyu')}">Reply by email</a><button class="btn" id="m-toggle">Mark as ${cur.read ? 'unread' : 'read'}</button><button class="btn danger" id="m-del">Delete</button></div>` : '<p class="empty">Select a message.</p>';
    $$('[data-m]').forEach(b => b.onclick = guard(async () => { cur = list.find(m => m.id === b.dataset.m); if (!cur.read) { cur.read = true; await api('/messages/' + cur.id, { method: 'PATCH', body: { read: true } }); refreshBadges(); } paint(); }));
    if (cur) { $('#m-toggle').onclick = guard(async () => { cur.read = !cur.read; await api('/messages/' + cur.id, { method: 'PATCH', body: { read: cur.read } }); refreshBadges(); paint(); }); $('#m-del').onclick = guard(async () => { if (!confirm('Delete this message?')) return; await api('/messages/' + cur.id, { method: 'DELETE' }); render(); }); }
  };
  main.innerHTML = `<div class="head"><div><h1>Messages</h1><p>From the “Work With Me” form on your website. Senders get an automatic acknowledgement.</p></div></div><div class="split"><div class="msg-list" id="m-list"></div><section class="card" id="m-view"></section></div>`;
  if (cur && !cur.read) { cur.read = true; api('/messages/' + cur.id, { method: 'PATCH', body: { read: true } }).then(refreshBadges).catch(() => {}); }
  paint();
};

/* traffic */
views.traffic = async main => {
  const days = state.range === 7 ? 7 : state.range === 90 ? 90 : 30, t = await api('/traffic?days=' + days), c = t.cur, p = t.prev;
  const d = (a, b) => b ? Math.round((a - b) / b * 100) : null;
  const sumObj = o => Object.values(o).reduce((a, b) => a + b, 0);
  main.innerHTML = `<div class="head"><div><h1>Traffic</h1><p>Privacy-friendly analytics: no cookies, no IP addresses stored.</p></div><div class="seg" role="group" aria-label="Period">${[7, 30, 90].map(r => `<button data-range="${r}" aria-pressed="${r === days}">${r} days</button>`).join('')}</div></div>
  <div class="grid kpis"><div class="card kpi"><span class="lbl">Page views</span><span class="val">${num(c.pv)}</span><span class="sub">${deltaChip(d(c.pv, p.pv))} vs previous</span></div><div class="card kpi"><span class="lbl">Visitors</span><span class="val">${num(c.uv)}</span><span class="sub">${deltaChip(d(c.uv, p.uv))} vs previous</span></div><div class="card kpi"><span class="lbl">Pages / visitor</span><span class="val">${c.uv ? (c.pv / c.uv).toFixed(1) : '-'}</span><span class="sub">Average</span></div><div class="card kpi"><span class="lbl">“Book” clicks</span><span class="val">${num(c.ev.book_click || 0)}</span><span class="sub">${c.pv ? ((c.ev.book_click || 0) / c.pv * 100).toFixed(1) : 0}% of views</span></div></div>
  <section class="card" style="margin-bottom:16px"><h3>Daily trend</h3>${areaChart([c.daily.map(x => x.pv), c.daily.map(x => x.uv)], c.daily.map(x => x.day.slice(5)), { h: 230 })}<div class="legend"><span><i style="background:var(--blue)"></i>Page views</span><span><i style="background:#7fb4ff"></i>Visitors</span></div></section>
  <div class="row r3"><section class="card"><h3>Pages</h3>${hbars(Object.entries(c.pages).sort((a, b) => b[1] - a[1]))}</section><section class="card"><h3>Sources</h3>${hbars(Object.entries(c.refs).sort((a, b) => b[1] - a[1]).slice(0, 7))}</section><section class="card"><h3>Devices</h3>${donut(Object.entries(c.dev).map(([l, v]) => ({ l, v })))}<h3 style="margin-top:18px">Language</h3>${donut(Object.entries(c.langs).map(([l, v]) => ({ l: l === 'so' ? 'Somali' : 'English', v })))}</section></div>`;
  $$('[data-range]', main).forEach(b => b.onclick = () => { state.range = +b.dataset.range; render(); });
};

/* settings */
const PAY_MODES = [
  ['off', 'Off', 'No payment: bookings are approved straight away.'],
  ['test', 'Test (self-approved)', 'A built-in test checkout. No money moves; while you are signed in here it approves itself after 4 seconds. Bookings are marked TEST and never count as revenue.'],
  ['sandbox', 'Sifalo sandbox', 'Sifalo’s staging site with test wallets and test cards, needs sandbox API keys from pay.sifalo.net.'],
  ['live', 'Live', 'Real payments with EVC Plus, Zaad, eDahab, Premier Wallet and cards, needs live API keys from pay.sifalo.com.'],
];
async function paymentCard() {
  const box = $('#payBody'); if (!box) return;
  const st = await api('/payment');
  const keyRow = (env, label, portal) => { const h = st[env]; return `<fieldset class="pay-env"><legend>${label} keys <small>- <a href="${portal}" target="_blank" rel="noopener">${portal.replace('https://', '').replace('/business', '')}</a> → Merchant → API → Create API key</small></legend>
    ${h.fromEnv ? '<p class="help">Currently using the keys from <code>server/.env</code>. Saving keys here replaces them.</p>' : ''}
    <div class="two">${field('pk-' + env + '-user', 'API username', h.user)}<div><label for="pk-${env}-key">API key</label><input id="pk-${env}-key" type="password" autocomplete="new-password" placeholder="${h.keySet ? 'Saved (ends ' + esc(h.keyEnd) + '): leave empty to keep' : 'Paste the API key'}"></div></div>
    <div class="pay-actions">${h.keySet ? `<label class="chk"><input type="checkbox" id="pk-${env}-clear"> Remove the saved ${label.toLowerCase()} keys</label>` : ''}<button type="button" class="btn sm" data-check="${env}">Test ${label.toLowerCase()} connection</button><span class="help" id="pk-${env}-msg"></span></div></fieldset>`; };
  box.innerHTML = `<form class="form" id="payForm" autocomplete="off">
    <div class="pay-modes" role="radiogroup" aria-label="Payment mode">${PAY_MODES.map(([k, l, d]) => `<label class="pay-mode ${st.mode === k ? 'on' : ''}"><input type="radio" name="paymode" value="${k}" ${st.mode === k ? 'checked' : ''} ${st.mock && k === 'live' ? 'disabled' : ''}><b>${l}</b><small>${d}</small></label>`).join('')}</div>
    ${st.mock ? '<p class="help"><b>Demo server:</b> choose <b>Test</b> for the self-approved checkout, or <b>Sifalo sandbox</b> (after saving sandbox keys below) to pay on Sifalo’s real test checkout with test cards and wallets. Live needs the real server. ' + (st.mode === 'mock' ? 'Right now the demo uses its own instant fake payment.' : '') + '</p>' : ''}
    ${keyRow('sandbox', 'Sandbox', st.hosts.sandbox.portal)}
    ${keyRow('live', 'Live', st.hosts.live.portal)}
    <div><label>Webhook address (optional: Sifalo pushes payment results here)</label><div class="copy-row"><input readonly value="${esc(st.webhookUrl)}" id="pk-hook"><button type="button" class="btn sm" id="pk-copy">Copy</button></div><p class="help">Sent automatically with every checkout when your site runs on https. Payments are always double-checked with Sifalo before a booking is approved.</p></div>
    ${st.needsPassword ? field('pk-pw', 'Your dashboard password (required to save payment settings)', '', { type: 'password' }) : ''}
    <div class="pay-actions"><button class="btn primary" type="submit">Save payment settings</button><span class="help">Last changed: ${st.updatedAt ? ago(st.updatedAt) : 'never'}</span></div>
    <details class="pay-help"><summary>How to test the whole process</summary><ol>
      <li><b>Test (self-approved):</b> choose Test, save, then book any session on the Consulting page. On the test checkout page it approves itself (or choose Decline / Pending). You get the approval email, the calendar invite and the Meet link exactly like a real client, marked [TEST].</li>
      <li><b>Sifalo sandbox:</b> sign up at pay.sifalo.net, create an API key, paste it above and choose Sifalo sandbox. Pay with a test card. Visa 4508 7500 1574 1019 or Mastercard 5123 4500 0000 0008, expiry 01/39, CVV 100, or a test wallet: eDahab 252621111111 (success), 252622222222 (fails), 252651111111 (pending).</li>
      <li><b>Live:</b> create live keys at pay.sifalo.com, paste them, press “Test live connection”, then choose Live. Make one real small booking to confirm.</li></ol></details>
  </form>`;
  const f = $('#payForm');
  $$('input[name=paymode]', f).forEach(r => r.onchange = () => $$('.pay-mode', f).forEach(l => l.classList.toggle('on', l.querySelector('input').checked)));
  $('#pk-copy').onclick = () => { navigator.clipboard?.writeText($('#pk-hook').value).then(() => toast('Copied')); };
  $$('[data-check]', f).forEach(b => b.onclick = guard(async () => { const env = b.dataset.check, out = $('#pk-' + env + '-msg'); out.textContent = 'Checking…'; const r = await api('/payment/check', { method: 'POST', body: { env } }); out.textContent = r.message; out.style.color = r.ok ? 'var(--good, #1f9d57)' : 'var(--bad, #c0262b)'; }));
  f.onsubmit = guard(async e => {
    e.preventDefault();
    const env = k => { const o = {}, u = $('#pk-' + k + '-user').value.trim(), key = $('#pk-' + k + '-key').value.trim(), clr = $('#pk-' + k + '-clear'); if (clr && clr.checked) return { clear: true }; if (u !== st[k].user) o.user = u; if (key) o.key = key; return o; };
    const body = { sandbox: env('sandbox'), live: env('live'), password: $('#pk-pw') ? $('#pk-pw').value : undefined };
    const picked = (f.querySelector('input[name=paymode]:checked') || {}).value; if (picked) body.mode = picked;
    if (body.mode === 'live' && st.mode !== 'live' && !confirm('Switch to LIVE payments? Clients will be charged real money.')) return;
    await api('/payment', { method: 'PUT', body }); toast('Payment settings saved'); paymentCard();
  });
}
const EMAILS = [
  ['confirmed', 'Booking confirmed + receipt', 'Right after payment: Meet link, add-to-calendar, receipt, what to prepare'],
  ['reminder24', 'Reminder: 24 hours before', 'Automatic (Settings → Automations)'],
  ['reminder1', 'Reminder: 1 hour before', 'Automatic, with the Meet button'],
  ['followup', 'Thank you + book again', '2 hours after the session (can be switched off)'],
  ['failed', 'Payment didn’t go through', 'When a payment fails or is abandoned, with a “Try again” button'],
  ['cancelled', 'Booking cancelled', 'When you cancel a confirmed booking in Bookings'],
  ['conflict', 'Paid, new time needed', 'If two people pay for the same time at once'],
  ['welcome', 'Newsletter welcome', 'When someone subscribes'],
  ['contact', 'Message received', 'Auto-reply to the contact form'],
  ['newpost', 'New blog post', 'To subscribers when you publish with “email subscribers” on'],
  ['owner', 'New booking (to you)', 'Every new booking, with a link to the dashboard'],
  ['message', 'New message (to you)', 'Every contact-form message, with a one-click Reply button'],
];
// edit an email's texts side by side in English and Somali
async function editEmailCopy(type) {
  const all = await api('/email-copy'), x = all.find(e => e.type === type); if (!x) return;
  const val = (lang, k) => ((x.saved[lang] || {})[k]) || x.defaults[lang][k];
  const rowsFor = k => { const long = Math.max(String(x.defaults.en[k]).length, String(x.defaults.so[k]).length); const rows = String(x.defaults.en[k]).includes('\n') ? 4 : long > 110 ? 3 : 1;
    const box = (lang, label) => rows > 1 ? `<div><label for="ec-${lang}-${k}">${label}</label><textarea id="ec-${lang}-${k}" rows="${rows}" maxlength="2000">${esc(val(lang, k))}</textarea></div>` : `<div><label for="ec-${lang}-${k}">${label}</label><input id="ec-${lang}-${k}" value="${esc(val(lang, k))}" maxlength="2000"></div>`;
    const changed = ['en', 'so'].some(l => (x.saved[l] || {})[k]);
    return `<div class="ec-field"><p class="ec-name">${esc(x.fields[k])}${changed ? ' <span class="pill test">edited</span>' : ''}</p><div class="two">${box('en', 'English')}${box('so', 'Somali')}</div></div>`; };
  const previewable = type !== 'signature';
  dialog(`<h2>Edit: ${esc(x.label)}</h2>
    <p class="help" style="margin:0">Placeholders are filled in for each client: <code>{name}</code> first name · <code>{session}</code> · <code>{date}</code> date &amp; time · <code>{minutes}</code> · <code>{amount}</code> · <code>{reference}</code> · <code>{hours}</code> notice hours. Write <code>**text**</code> for bold. Leave a box empty to use the default.</p>
    ${Object.keys(x.fields).map(rowsFor).join('')}
    <div class="actions" style="flex-wrap:wrap"><button type="button" class="btn" data-close>Close</button><button type="button" class="btn danger" id="ec-reset">Reset to default</button>${previewable ? '<button type="button" class="btn" id="ec-prev-en">Preview English</button><button type="button" class="btn" id="ec-prev-so">Preview Somali</button>' : ''}<button type="submit" class="btn primary">Save texts</button></div>`);
  const collect = () => { const body = { type, en: {}, so: {} }; for (const lang of ['en', 'so']) for (const k of Object.keys(x.fields)) body[lang][k] = $('#ec-' + lang + '-' + k).value; return body; };
  const save = async () => { await api('/email-copy', { method: 'PUT', body: collect() }); };
  $('#dlgForm').onsubmit = guard(async e => { e.preventDefault(); await save(); toast('Email texts saved'); $('#dlg').close(); });
  $('#ec-reset').onclick = guard(async () => { if (!confirm('Reset this email to the original English and Somali texts?')) return; await api('/email-copy', { method: 'PUT', body: { type, reset: true } }); toast('Back to the default texts'); editEmailCopy(type); });
  const prev = lang => guard(async () => { await save(); window.open('/api/admin/email-preview?type=' + ({ reminder24: 'reminder24', reminder1: 'reminder1' }[type] || type) + '&lang=' + lang, '_blank', 'noopener'); toast('Saved, preview opened'); });
  if (previewable) { $('#ec-prev-en').onclick = prev('en'); $('#ec-prev-so').onclick = prev('so'); }
}
const SET_GROUPS = [['booking', 'Booking'], ['payments', 'Payments'], ['emails', 'Emails'], ['chat', 'WhatsApp & contact'], ['security', 'Security'], ['connections', 'Connections']];
const SET_INTRO = { booking: 'When people can book, your session types and prices, and the automatic reminders.', payments: 'Sifalo Pay mode and API keys, test, sandbox or live.', emails: 'Edit the wording of every branded email in English and Somali, and send yourself a test.', chat: 'Your WhatsApp number, the chat popup, ready-made messages and booking links, plus your intro video.', security: 'Two-step verification and your dashboard password.', connections: 'Google (Calendar, Meet, Gmail) and payment connection status.' };
views.settings = async (main, arg) => {
  const me = await api('/me').catch(() => ({}));
  const s = await api('/settings'), e = s.effective, a = e.availability, sy = s.system;
  const grp = SET_GROUPS.some(g => g[0] === arg) ? arg : 'booking';
  const todo = { chat: !e.whatsapp, payments: !(sy.sifalo), connections: !(sy.google) };
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const status = (ok, label, help) => `<div class="item"><i class="dot ${ok === 'mock' ? 'warn' : ok ? 'ok' : 'bad'}"></i><div class="grow"><b>${label}</b><small>${ok === 'mock' ? 'Demo mode (fake service)' : ok ? 'Connected' : help}</small></div></div>`;
  main.innerHTML = `<div class="head"><div><h1>Settings</h1><p id="setIntro"></p></div></div>
  <div class="tabs" role="tablist" aria-label="Settings sections" id="setTabs">${SET_GROUPS.map(([k, label]) => `<button role="tab" type="button" data-sg="${k}" aria-selected="${k === grp}">${label}${todo[k] ? ' <span class="set-dot" title="Needs setup" aria-label="needs setup"></span>' : ''}</button>`).join('')}</div>
  <div data-g="booking" class="row r12"><section class="card"><h3>Booking availability <small>Mogadishu time (UTC+3)</small></h3><form class="form" id="avForm">
    <div><label>Days</label><div class="checks">${dayNames.map((n, i) => `<label><input type="checkbox" name="day" value="${i}" ${a.days.includes(i) ? 'checked' : ''}>${n}</label>`).join('')}</div></div>
    <div class="three">${field('v-start', 'From hour', a.start, { type: 'number' })}${field('v-end', 'Until hour', a.end, { type: 'number' })}${field('v-step', 'Slot step', a.step, { opts: [[15, '15 min'], [30, '30 min'], [60, '60 min']] })}</div>
    <div class="two">${field('v-notice', 'Minimum notice (hours)', a.minNoticeHours, { type: 'number' })}${field('v-horizon', 'Bookable up to (days ahead)', a.horizonDays, { type: 'number' })}</div>
    ${field('v-owner', 'Your email (alerts and “From” address)', e.ownerEmail, { type: 'email', help: 'Approval emails are sent from your connected Gmail; this is where new-booking and message alerts go.' })}
    <div><button class="btn primary" type="submit">Save rules</button></div></form></section>
</div>
  <section data-g="booking" class="card"><h3>Sessions <small>names, wording and prices on the booking page</small></h3><form class="form" id="ssForm"><div id="ssList"></div><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" type="button" id="ssAdd">+ Add a session</button><button class="btn primary" type="submit">Save sessions</button></div><p class="help">Changes appear on the booking page straight away. Prices and length apply to new bookings. Switch a session off to hide it, or delete it, existing bookings keep their original name.</p></form></section>
  <section data-g="chat" class="card"><h3>Contact &amp; intro video</h3><form class="form" id="siteForm">${field('v-wa', 'WhatsApp number', e.whatsapp, { type: 'tel', help: 'Full international number, digits only, e.g. 252612345678. Shows a WhatsApp button on every page (and in the footer and contact form). Leave empty to hide it.' })}${field('v-intro', 'Intro video (YouTube link)', e.introVideo ? 'https://youtu.be/' + e.introVideo : '', { help: 'A 30–60 second “who I am and how a session works” clip. Shows on the home page and from the booking page. Leave empty to hide it.' })}<div><button class="btn primary" type="submit">Save</button></div></form></section>
  <section data-g="security" class="card" id="tfCard"><h3>Two-step verification <small>protects your sign-in</small></h3><div id="tfBody"><p class="help">Loading…</p></div></section>
  <section data-g="security" class="card"><h3>Username <small>used to sign in</small></h3><form class="form" id="unForm"><div class="two">${field('un-new', 'Username', me.username || 'admin', { max: 40, help: 'Letters, numbers, dots, dashes or underscores (3 to 40).' })}${field('un-pw', 'Current password', '', { type: 'password' })}</div><div><button class="btn primary" type="submit">Save username</button></div></form></section>
  <section data-g="security" class="card"><h3>Password</h3><form class="form" id="pwForm"><div class="two">${field('pw-cur', 'Current password', '', { type: 'password' })}${field('pw-new', 'New password (12+ characters)', '', { type: 'password' })}</div><div><button class="btn primary" type="submit">Change password</button></div><p class="help">Forgot it? Use “Forgot password?” on the sign-in page, a reset link goes to your owner email above.</p></form></section>
  <section data-g="chat" class="card" id="waCard"><h3>WhatsApp <small>chat popup · ready-made messages · booking links</small></h3>
    ${e.whatsapp ? '' : '<p class="help" style="color:var(--bad,#c0262b)"><b>Add your WhatsApp number</b> in “Contact &amp; intro video” above: the popup and WhatsApp buttons appear once it is saved.</p>'}
    <form class="form" id="waForm">
      <div class="two"><label class="chk"><input type="checkbox" id="wa-pop" ${e.wa.popup ? 'checked' : ''}> Open the chat popup by itself on the home and consulting pages (once every 3 days per visitor)</label>${field('wa-delay', 'Open after (seconds)', e.wa.delay, { type: 'number' })}</div>
      <p class="help" style="margin:0">Placeholders: <code>{session}</code> the session the visitor is looking at (or “a 1:1 session”), <code>{price}</code> its price, <code>{link}</code> its booking link. Leave a box empty to use the default.</p>
      ${[['greeting', 'Popup greeting'], ['reply', 'Reply-time line under your name'], ['book', 'Message when they tap “Book on WhatsApp”'], ['ask', 'Message when they tap “Ask a question”'], ['share', 'Message you send with a booking link']].map(([k, l]) => `<div class="ec-field"><p class="ec-name">${l}</p><div class="two"><div><label for="wa-${k}-en">English</label><textarea id="wa-${k}-en" rows="2" maxlength="600">${esc(e.wa[k].en)}</textarea></div><div><label for="wa-${k}-so">Somali</label><textarea id="wa-${k}-so" rows="2" maxlength="600">${esc(e.wa[k].so)}</textarea></div></div></div>`).join('')}
      <div class="pay-actions"><button class="btn primary" type="submit">Save WhatsApp settings</button></div>
    </form>
    <h4 style="margin:18px 0 8px">Booking links to share</h4>
    <p class="help" style="margin:0 0 8px">Short links that open the booking page, with the session already chosen. Put them in your bio, video descriptions or WhatsApp replies.</p>
    <div class="mail-list">${[['', 'Booking page (all sessions)'], ...Object.entries(e.sessions).filter(([, x]) => x.enabled).map(([id, x]) => [id, x.title + ': $' + x.price])].map(([id, l]) => { const link = location.origin + '/book' + (id ? '/' + id : ''); return `<div class="mail-row"><div><b>${esc(l)}</b><small class="mono">${esc(link)}</small></div><div class="mail-act"><button type="button" class="btn sm" data-copy="${esc(link)}">Copy</button><button type="button" class="btn sm" data-copy="${esc(link)}?lang=so">Copy Somali</button><button type="button" class="btn sm primary" data-wasend="${esc(id)}">Send on WhatsApp</button></div></div>`; }).join('')}</div>
  </section>
  <section data-g="emails" class="card" id="mailCard"><h3>Emails <small>branded, English &amp; Somali: sent automatically</small></h3>
    <div class="mail-list">${EMAILS.map(([k, l, wh]) => `<div class="mail-row"><div><b>${l}</b><small>${wh}</small></div><div class="mail-act">${k !== 'owner' && k !== 'message' ? `<button type="button" class="btn sm primary" data-mailedit="${k}">Edit texts</button>` : ''}<a class="btn sm" href="/api/admin/email-preview?type=${k}&lang=en" target="_blank" rel="noopener">Preview</a><a class="btn sm" href="/api/admin/email-preview?type=${k}&lang=so" target="_blank" rel="noopener">Somali</a><button type="button" class="btn sm" data-mailtest="${k}">Send me a test</button></div></div>`).join('')}</div>
    <div class="mail-row"><div><b>Signature</b><small>The closing line and the line under your name, in every email</small></div><div class="mail-act"><button type="button" class="btn sm primary" data-mailedit="signature">Edit texts</button></div></div>
    <p class="help">Emails are sent from your connected Gmail. Each one has a plain-text version, works on phones and uses your logo and colours. Clients always get them in the language they booked in.</p></section>
  <section data-g="booking" class="card"><h3>Automations</h3><form class="form" id="autoForm"><div class="checks" style="flex-direction:column;align-items:flex-start;gap:10px"><label><input type="checkbox" id="au-rem" ${e.automations.reminders ? 'checked' : ''}> Email clients a reminder 24 hours and 1 hour before their session</label><label><input type="checkbox" id="au-week" ${e.automations.weekly ? 'checked' : ''}> Email me a weekly summary every Saturday at 09:00 (Mogadishu)</label><label><input type="checkbox" id="au-fu" ${e.automations.followup ? 'checked' : ''}> Email clients a thank-you with a “Book again” button 2 hours after their session</label></div><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn primary" type="submit">Save</button><button class="btn" type="button" id="auNow">Send summary now</button></div></form></section>
  <section data-g="payments" class="card" id="payCard"><h3>Payments <small>Sifalo Pay · mobile money &amp; cards</small></h3><div id="payBody"><p class="help">Loading…</p></div></section>
  <section data-g="connections" class="card"><h3>Connections</h3>${status(sy.google, 'Google (Calendar, Meet, Gmail)', 'Not connected: see BOOKING-SETUP.md steps 1–4')}${status(sy.sifalo, 'Online payments (Sifalo Pay)', sy.payMode === 'off' ? 'Off, bookings are free. Turn on in Payments above.' : 'Keys missing, add them in Payments above.')}<p class="help">Google keys live in <code>server/.env</code>. Payment keys are set in <b>Payments</b> above and stored encrypted, they are never shown again after saving.</p></section>`;
  $('#avForm').onsubmit = guard(async ev => { ev.preventDefault(); await api('/settings', { method: 'PUT', body: { ownerEmail: $('#v-owner').value, availability: { days: $$('[name=day]:checked').map(x => +x.value), start: +$('#v-start').value, end: +$('#v-end').value, step: +$('#v-step').value, minNoticeHours: +$('#v-notice').value, horizonDays: +$('#v-horizon').value } } }); toast('Saved'); render(); });
  paymentCard();
  $('#siteForm').onsubmit = guard(async ev => { ev.preventDefault(); await api('/settings', { method: 'PUT', body: { whatsapp: $('#v-wa').value, introVideo: $('#v-intro').value } }); toast('Saved'); render(); });
  $('#pw-cur').autocomplete = 'current-password'; $('#pw-new').autocomplete = 'new-password';
  const showRecovery = (rec, done) => { if (!rec) { $('#dlg').close(); toast('Saved'); done(); return; } dialog(`<h2>Save your recovery codes</h2><p class="help">If you lose your phone, each of these codes works <b>once</b> instead of a normal code. Store them somewhere safe (a password manager or printed). They are shown only now.</p><pre class="mono" style="font-size:1.05rem;line-height:1.8;user-select:all">${rec.join('\n')}</pre><div class="actions"><button type="button" class="btn" id="tf-copy">Copy</button><button type="submit" class="btn primary">I saved them</button></div>`); $('#tf-copy').onclick = () => { navigator.clipboard && navigator.clipboard.writeText(rec.join('\n')); toast('Copied'); }; $('#dlgForm').onsubmit = e2 => { e2.preventDefault(); $('#dlg').close(); toast('Two-step verification updated'); done(); }; };
  const codeDlg = (title, intro, run, done) => { dialog(`<h2>${title}</h2><p class="help">${intro}</p>${field('tf-c', 'Code', '', { req: 1 })}<div class="actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary" type="submit">Turn on</button></div>`); $('#tf-c').setAttribute('inputmode', 'numeric'); $('#tf-c').setAttribute('autocomplete', 'one-time-code'); $('#dlgForm').onsubmit = guard(async e => { e.preventDefault(); showRecovery((await run($('#tf-c').value)).recovery, done); }); };
  const tf = async () => {
    const st = await api('/2fa'), box = $('#tfBody');
    { const tb = $('[data-sg=security]'); if (tb) { const d = tb.querySelector('.set-dot'); if (!st.enabled && !d) tb.insertAdjacentHTML('beforeend', ' <span class="set-dot" title="Two-step verification is off" aria-label="needs setup"></span>'); if (st.enabled && d) d.remove(); } }
    const row = (name, on, detail, btn) => `<div class="item"><div class="grow"><b>${name}</b> <span class="pill ${on ? 'paid' : ''}">${on ? 'On' : 'Off'}</span><br><small style="color:var(--muted)">${detail}</small></div>${btn}</div>`;
    box.innerHTML = `<p class="help" style="margin-top:0">Turn on one or more. At sign-in you enter your password <b>and</b> a code from any method you switched on. ${st.enabled ? 'Recovery codes left: <b>' + st.recoveryLeft + '</b>.' : ''}</p>
    ${row('Authenticator app', st.app, 'Google / Microsoft Authenticator, Authy, 1Password', st.app ? '' : '<button class="btn sm primary" id="tfApp" type="button">Set up</button>')}
    ${row('Email code', st.email, 'A code is emailed to ' + esc(st.ownerHint) + ' (your owner email)', st.email ? '' : '<button class="btn sm primary" id="tfMail" type="button">Turn on</button>')}
    ${st.enabled ? `<details style="margin-top:12px"><summary><b>Turn off</b></summary><form class="form" id="tfOff" style="margin-top:10px"><div class="two">${field('tf-pw', 'Password', '', { type: 'password' })}${field('tf-code', 'A current code or recovery code', '')}</div><div class="two"><div><label for="tf-m">Turn off</label><select id="tf-m"><option value="all">Everything</option>${st.app ? '<option value="app">Authenticator app</option>' : ''}${st.email ? '<option value="email">Email code</option>' : ''}</select></div><div style="align-self:end;display:flex;gap:8px;flex-wrap:wrap">${st.email ? '<button class="btn sm" id="tfSendMail" type="button">Email me a code</button>' : ''}<button class="btn danger" type="submit">Turn off</button></div></div></form></details>` : ''}`;
    const app = $('#tfApp'); if (app) app.onclick = guard(async () => { const r = await api('/2fa/setup', { method: 'POST', body: {} });
      dialog(`<h2>Set up the authenticator app</h2><ol class="help" style="padding-left:18px;display:grid;gap:6px"><li>In your app choose <b>Add account → Enter a setup key</b> (on a phone you can also tap <a href="${esc(r.uri)}">this link</a>).</li><li>Account: <b>Eng Yuyu</b>. Key (time-based):</li></ol><p class="mono" style="font-size:1.15rem;letter-spacing:.08em;word-break:break-all;user-select:all">${r.secret.match(/.{1,4}/g).join(' ')}</p><ol start="3" class="help" style="padding-left:18px"><li>Type the 6-digit code the app shows.</li></ol>${field('tf-c', 'Code from the app', '', { req: 1 })}<div class="actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary" type="submit">Turn on</button></div>`);
      $('#tf-c').setAttribute('inputmode', 'numeric'); $('#dlgForm').onsubmit = guard(async e => { e.preventDefault(); showRecovery((await api('/2fa/enable', { method: 'POST', body: { code: $('#tf-c').value } })).recovery, tf); }); });
    const mail = $('#tfMail'); if (mail) mail.onclick = guard(async () => { const r = await api('/2fa/email/start', { method: 'POST', body: {} }); codeDlg('Turn on email codes', 'We sent a 6-digit code to <b>' + esc(r.to) + '</b>. Enter it to confirm your inbox works.', code => api('/2fa/email/enable', { method: 'POST', body: { code } }), tf); });
    const sm = $('#tfSendMail'); if (sm) sm.onclick = guard(async () => { await api('/2fa/challenge', { method: 'POST', body: { via: 'email' } }); toast('Code emailed'); });
    const off = $('#tfOff'); if (off) off.onsubmit = guard(async e => { e.preventDefault(); if (!confirm('Turn this off?')) return; await api('/2fa/disable', { method: 'POST', body: { password: $('#tf-pw').value, code: $('#tf-code').value, method: $('#tf-m').value } }); toast('Turned off'); tf(); });
  }; tf().catch(() => {});
  $('#unForm').onsubmit = guard(async ev => { ev.preventDefault(); const r = await api('/username', { method: 'POST', body: { username: $('#un-new').value, password: $('#un-pw').value } }); $('#un-pw').value = ''; $('#un-new').value = r.username; toast('Username saved. Use it next time you sign in.'); });
  if (me.authMode === 'supabase') { $('#unForm').closest('section').innerHTML = '<h3>Sign-in</h3><p class="help">You sign in with your Supabase user (<b>' + esc(me.username || '') + '</b>). Change the e-mail or password in Supabase under Authentication, Users. Two-step verification below adds a second step on top.</p>'; }
  $('#pwForm').onsubmit = guard(async ev => { ev.preventDefault(); await api('/password', { method: 'POST', body: { current: $('#pw-cur').value, password: $('#pw-new').value } }); $('#pw-cur').value = $('#pw-new').value = ''; toast('Password changed'); });
  if (me.authMode === 'supabase') $('#pwForm').closest('section').remove();   // the password lives in Supabase
  $$('[data-copy]').forEach(b => b.onclick = () => navigator.clipboard.writeText(b.dataset.copy).then(() => toast('Link copied')));
  $$('[data-wasend]').forEach(b => b.onclick = () => { const id = b.dataset.wasend, x = e.sessions[id], link = location.origin + '/book' + (id ? '/' + id : ''); const msg = e.wa.share.en.replace(/\{session\}/g, x ? x.title : 'a 1:1 session').replace(/\{price\}/g, x ? '($' + x.price + ')' : '').replace(/\{link\}/g, link).replace(/\s{2,}/g, ' '); window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank', 'noopener'); });
  $('#waForm').onsubmit = guard(async ev => { ev.preventDefault(); const wa = { popup: $('#wa-pop').checked, delay: +$('#wa-delay').value }; for (const k of ['greeting', 'reply', 'book', 'ask', 'share']) wa[k] = { en: $('#wa-' + k + '-en').value, so: $('#wa-' + k + '-so').value }; await api('/settings', { method: 'PUT', body: { wa } }); toast('WhatsApp settings saved'); render(); });
  $$('[data-mailedit]').forEach(b => b.onclick = guard(() => editEmailCopy(b.dataset.mailedit)));
  $$('[data-mailtest]').forEach(b => b.onclick = guard(async () => { const r = await api('/email-test?type=' + b.dataset.mailtest + '&lang=en', { method: 'POST', body: {} }); toast('Test sent to ' + r.to); }));
  $('#autoForm').onsubmit = guard(async ev => { ev.preventDefault(); await api('/settings', { method: 'PUT', body: { automations: { reminders: $('#au-rem').checked, weekly: $('#au-week').checked, followup: $('#au-fu').checked } } }); toast('Saved'); });
  $('#auNow').onclick = guard(async () => { const r = await api('/automations/digest', { method: 'POST', body: {} }); toast('Summary sent to ' + r.to); });
  let sess = JSON.parse(JSON.stringify(e.sessionList));
  const ssRow = (x, i) => `<details class="item sess-ed" data-i="${i}" ${sess.length === 1 || x._new ? 'open' : ''} style="display:block"><summary style="cursor:pointer;display:flex;gap:12px;align-items:center;min-height:44px"><b class="grow">${esc(x.en[0] || 'New session')}</b><small>$${x.price} · ${x.min} min${x.enabled === false ? ' · hidden' : ''}</small></summary>
    <div class="form" style="margin-top:12px">
    <div class="two">${field('s-en0-' + i, 'Name (English)', x.en[0], { max: 80 })}${field('s-so0-' + i, 'Name (Somali)', x.so[0], { max: 80 })}</div>
    <div class="two">${field('s-en1-' + i, 'Short description (English)', x.en[1], { area: 1, rows: 3, max: 260 })}${field('s-so1-' + i, 'Short description (Somali)', x.so[1], { area: 1, rows: 3, max: 260 })}</div>
    <div class="two">${field('s-wen-' + i, 'Who it is for (English)', ((x.who || {}).en || ''), { max: 140 })}${field('s-wso-' + i, 'Who it is for (Somali)', ((x.who || {}).so || ''), { max: 140 })}</div>
    <div class="two">${field('s-ien-' + i, 'What is included (English, one per line, up to 6)', ((x.inc || {}).en || []).join('\n'), { area: 1, rows: 4 })}${field('s-iso-' + i, 'What is included (Somali, one per line)', ((x.inc || {}).so || []).join('\n'), { area: 1, rows: 4 })}</div>
    <div class="three">${field('s-p-' + i, 'Price $', x.price, { type: 'number' })}${field('s-m-' + i, 'Minutes', x.min, { type: 'number' })}<label style="display:flex;gap:8px;align-items:center;min-height:44px"><input type="checkbox" id="s-e-${i}" style="width:auto;min-height:0" ${x.enabled !== false ? 'checked' : ''}> Shown on the website</label></div>
    <div><button class="btn danger" type="button" data-del="${i}">Delete this session</button></div></div></details>`;
  const ssRead = () => sess.map((x, i) => ({ ...x, en: [$('#s-en0-' + i).value, $('#s-en1-' + i).value], so: [$('#s-so0-' + i).value, $('#s-so1-' + i).value], who: { en: $('#s-wen-' + i).value, so: $('#s-wso-' + i).value }, inc: { en: $('#s-ien-' + i).value.split('\n'), so: $('#s-iso-' + i).value.split('\n') }, price: +$('#s-p-' + i).value, min: +$('#s-m-' + i).value, enabled: $('#s-e-' + i).checked }));
  const ssPaint = () => { $('#ssList').innerHTML = sess.map(ssRow).join(''); $$('[data-del]').forEach(b => b.onclick = () => { if (sess.length < 2) return toast('Keep at least one session'); if (!confirm('Delete this session? It disappears from the booking page.')) return; sess = ssRead(); sess.splice(+b.dataset.del, 1); ssPaint(); }); };
  ssPaint();
  $('#ssAdd').onclick = () => { if (sess.length >= 8) return toast('Up to 8 sessions'); sess = ssRead(); sess.push({ id: 's' + Math.random().toString(36).slice(2, 8), en: ['', ''], so: ['', ''], who: { en: '', so: '' }, inc: { en: [], so: [] }, min: 30, price: 30, enabled: true, _new: true }); ssPaint(); };
  $('#ssForm').onsubmit = guard(async ev => { ev.preventDefault(); sess = ssRead(); const bad = sess.findIndex(x => !x.en[0].trim()); if (bad >= 0) return toast('Give every session an English name'); await api('/settings', { method: 'PUT', body: { sessionList: sess } }); toast('Sessions saved'); render(); });
  const showGroup = g => { $$('[data-g]', main).forEach(el => { el.hidden = el.dataset.g !== g; }); $$('[data-sg]', main).forEach(b => { b.setAttribute('aria-selected', b.dataset.sg === g); if (b.dataset.sg === g && b.scrollIntoView) b.scrollIntoView({ inline: 'center', block: 'nearest' }); }); $('#setIntro').textContent = SET_INTRO[g]; document.title = SET_GROUPS.find(x => x[0] === g)[1] + ' · Settings: Dashboard'; };
  $$('[data-sg]', main).forEach(b => b.onclick = () => { history.replaceState(null, '', '#/settings/' + b.dataset.sg); showGroup(b.dataset.sg); main.scrollIntoView({ block: 'start' }); });
  showGroup(grp);
};


/* ---------- blog ---------- */
const BSTATUS = { published: ['Published', 'paid'], scheduled: ['Scheduled', 'pending'], draft: ['Draft', ''] };
const ytIdOf = u => { const m = String(u || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/|v\/))([A-Za-z0-9_-]{11})/); return m ? m[1] : (/^[A-Za-z0-9_-]{11}$/.test(String(u || '').trim()) ? String(u).trim() : ''); };
views.blog = async (main, arg) => {
  if (arg === 'new' || (arg && arg.startsWith('edit'))) return blogEditor(main, arg === 'new' ? null : arg.split('/')[1] || location.hash.split('/')[3]);
  const tab = arg === 'comments' ? 'comments' : 'posts';
  const data = await api('/blog');
  const pend = await api('/comments?status=pending');
  main.innerHTML = `<div class="head"><div><h1>Blog</h1><p>Write, publish and promote articles. Every article is a search-friendly page with sharing, reactions and comments.</p></div><a class="btn primary" href="#/blog/new">+ New article</a></div>
  <div class="tabs" role="tablist"><button role="tab" data-t="posts" aria-selected="${tab === 'posts'}">Articles (${data.posts.length})</button><button role="tab" data-t="comments" aria-selected="${tab === 'comments'}">Comments${pend.length ? ` <span class="badge" style="background:var(--blue);color:#fff;border-radius:99px;padding:1px 8px;font-size:.72rem">${pend.length}</span>` : ''}</button></div><div id="bl-body"></div>`;
  $$('[data-t]', main).forEach(b => b.onclick = () => { location.hash = '#/blog' + (b.dataset.t === 'comments' ? '/comments' : ''); });
  const body = $('#bl-body');
  if (tab === 'comments') return commentsView(body, data);
  const waiting = data.posts.filter(p => p.review && p.review.state === 'in_review'), only = arg === 'review';
  const shown = only ? waiting : data.posts;
  const banner = waiting.length ? `<div class="wnote-owner"><b>${waiting.length} article${waiting.length > 1 ? 's' : ''} waiting for your review</b> from writers. <a href="#/blog/${only ? '' : 'review'}">${only ? 'Show all articles' : 'Show only these'}</a></div>` : '';
  body.innerHTML = banner + (shown.length ? `<div class="table-wrap"><table class="t-blog"><thead><tr><th></th><th>Article</th><th>Status</th><th>Views</th><th>Reactions</th><th>Comments</th><th></th></tr></thead><tbody>${shown.map(p => { const s = BSTATUS[p.status]; return `<tr>
    <td style="width:84px"><div style="width:72px;aspect-ratio:16/9;border-radius:8px;background:var(--surface2) center/cover no-repeat ${p.thumb ? `url('${esc(p.thumb)}')` : ''}"></div></td>
    <td class="wrap"><b>${esc(p.en.title)}</b>${p.sample ? ' <span class="pill">Sample</span>' : ''}${p.video ? ' <span class="pill" title="Has a YouTube video">▶ Video</span>' : ''}${p.authorId ? ` <span class="pill" title="Written by a contributor">✎ ${esc(p.authorName || 'Writer')}</span>` : ''}${p.review && p.review.state === 'in_review' ? ' <span class="pill pending">In review</span>' : p.review && p.review.state === 'changes' ? ' <span class="pill">Sent back</span>' : ''}<br><small style="color:var(--muted)">/blog/${esc(p.slug)} · ${p.cat} · ${p.readMin} min</small></td>
    <td><span class="pill ${s[1]}">${s[0]}</span><br><small style="color:var(--muted)">${p.publishedAt ? fmtD(p.publishedAt) : '-'}${p.emailedAt && !p.sample ? ' · emailed ' + p.sentCount : ''}</small></td>
    <td class="mono">${num(p.views)}</td><td class="mono">${num(p.reactionsTotal)}</td><td class="mono">${p.comments}${p.pending ? ` <span class="pill pending">${p.pending} new</span>` : ''}</td>
    <td style="white-space:nowrap"><a class="btn sm" href="#/blog/edit/${p.id}">Edit</a> <a class="btn sm" href="/blog/${esc(p.slug)}" target="_blank" rel="noopener">View ↗</a></td></tr>`; }).join('')}</tbody></table></div>${data.posts.some(p => p.sample) ? '<p class="help" style="margin-top:12px">Articles marked “Sample” are examples (they are never emailed). Edit or delete them any time.</p>' : ''}` : '<p class="empty">No articles yet: write your first one.</p>');
};
async function commentsView(body, data) {
  let st = 'pending';
  const paint = async () => {
    const list = await api('/comments?status=' + st);
    body.innerHTML = `<div class="toolbar"><div class="chips" role="group">${[['pending', 'Awaiting approval'], ['approved', 'Approved'], ['spam', 'Spam']].map(([k, l]) => `<button class="chip" data-s="${k}" aria-pressed="${k === st}">${l}</button>`).join('')}</div><label style="display:flex;gap:8px;align-items:center;margin-left:auto"><input type="checkbox" id="auto" style="width:auto;min-height:0" ${data.autoApprove ? 'checked' : ''}> Auto-approve comments without links</label></div>
    ${list.length ? list.map(c => `<div class="item" style="align-items:flex-start"><div class="grow"><b>${esc(c.name)} <small>${c.email ? esc(c.email) + ' · ' : ''}${ago(c.createdAt)}</small></b><p style="margin:6px 0">${esc(c.text)}</p><small>on <a href="/blog/${esc(c.slug)}" target="_blank" rel="noopener" style="color:var(--accent)">${esc(c.post)}</a>${c.reply ? ' · replied' : ''}</small></div><div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">${c.status !== 'approved' ? `<button class="btn sm primary" data-c="approved" data-id="${c.id}">Approve</button>` : ''}<button class="btn sm" data-reply="${c.id}">Reply</button>${c.status !== 'spam' ? `<button class="btn sm" data-c="spam" data-id="${c.id}">Spam</button>` : ''}<button class="btn sm danger" data-del="${c.id}">Delete</button></div></div>`).join('') : '<p class="empty">Nothing here.</p>'}`;
    $$('[data-s]', body).forEach(b => b.onclick = () => { st = b.dataset.s; paint(); });
    $('#auto').onchange = guard(async e => { await api('/blog-settings', { method: 'PUT', body: { autoApprove: e.target.checked } }); data.autoApprove = e.target.checked; toast('Saved'); });
    $$('[data-c]', body).forEach(b => b.onclick = guard(async () => { await api('/comments/' + b.dataset.id, { method: 'PATCH', body: { status: b.dataset.c } }); toast(b.dataset.c === 'approved' ? 'Approved: now visible' : 'Updated'); paint(); }));
    $$('[data-del]', body).forEach(b => b.onclick = guard(async () => { if (!confirm('Delete this comment?')) return; await api('/comments/' + b.dataset.del, { method: 'DELETE' }); paint(); }));
    $$('[data-reply]', body).forEach(b => b.onclick = () => { const c = list.find(x => x.id === b.dataset.reply); dialog(`<h2>Reply to ${esc(c.name)}</h2><p style="background:var(--surface2);padding:12px;border-radius:10px;margin:0">${esc(c.text)}</p>${field('r-text', 'Your public reply', c.reply || '', { area: 1, rows: 4, max: 1000 })}<div class="actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary" type="submit">Save reply &amp; approve</button></div>`); $('#dlgForm').onsubmit = guard(async e => { e.preventDefault(); await api('/comments/' + c.id, { method: 'PATCH', body: { reply: $('#r-text').value, status: 'approved' } }); $('#dlg').close(); toast('Reply published'); paint(); }); });
  };
  await paint();
}
async function blogEditor(main, id) {
  const meta = await api('/blog'); let p = id ? await api('/blog/' + id) : { en: { title: '', excerpt: '', body: '' }, so: { title: '', excerpt: '', body: '' }, cat: 'ai', tags: [], status: 'draft', seo: {}, notify: true, featured: false, videoUrl: '', cover: '', slug: '' };
  const v = (o, k) => esc((o && o[k]) || '');
  const toLocal = ms => { const d = new Date(ms || Date.now() + 86400000); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  main.innerHTML = `<div class="head"><div><a href="#/blog" style="color:var(--muted)">← All articles</a><h1 style="margin-top:6px">${id ? 'Edit article' : 'New article'}</h1></div><div style="display:flex;gap:8px;flex-wrap:wrap">${id ? `<a class="btn" id="b-preview" href="/blog/${esc(p.slug)}" target="_blank" rel="noopener">Preview ↗</a><button class="btn danger" id="b-del">Delete</button>` : ''}</div></div>
  ${p.authorId ? `<div class="wnote-owner"><b>Written by ${esc(p.authorName || 'a writer')}</b>: ${p.review && p.review.state === 'in_review' ? 'waiting for your review. Read it, then set <b>Status → Published</b> and save to approve, or send it back with a note.' : p.review && p.review.state === 'changes' ? 'sent back to the writer.' + (p.review.note ? ' Your note: “' + esc(p.review.note) + '”' : '') : 'article status: ' + esc(p.status) + '.'} ${p.review && p.review.state === 'in_review' ? '<button type="button" class="btn sm" id="b-back">Send back with a note</button>' : ''}</div>` : ''}
  <form class="editor" id="bForm" novalidate>
   <div class="ed-main">
    <section class="card form">
      <div class="seg" role="tablist" aria-label="Language" style="justify-self:start"><button type="button" data-lang="en" aria-pressed="true">English</button><button type="button" data-lang="so" aria-pressed="false">Somali (optional)</button></div>
      <div data-pane="en">${field('b-title', 'Title', p.en.title, { max: 160, req: 1 })}<div><label for="b-slug">Web address</label><div class="slug-row"><span>/blog/</span><input id="b-slug" value="${esc(p.slug || '')}" placeholder="auto-from-title" maxlength="80"></div></div>
        ${field('b-excerpt', 'Short summary (shown on cards, emails and Google)', p.en.excerpt, { area: 1, rows: 2, max: 320 })}
        <div><label for="b-body">Article</label><div class="tb" role="toolbar" aria-label="Formatting">${[['H2', '## ', ''], ['Bold', '**', '**'], ['Link', '[', '](https://)'], ['List', '- ', ''], ['Quote', '> ', '']].map(([l, a2, b2]) => `<button type="button" class="btn sm" data-ins="${esc(a2)}|${esc(b2)}">${l}</button>`).join('')}<button type="button" class="btn sm" data-ins-video>▶ Insert video</button></div><textarea id="b-body" rows="18" maxlength="60000" aria-describedby="b-help">${esc(p.en.body)}</textarea><p class="help" id="b-help">Write normally. Use “H2” for headings, a blank line between paragraphs. <span id="b-words">0 words</span></p></div></div>
      <div data-pane="so" hidden>${field('b-so-title', 'Somali title', p.so.title, { max: 160 })}${field('b-so-excerpt', 'Somali summary', p.so.excerpt, { area: 1, rows: 2, max: 320 })}<div><label for="b-so-body">Somali article</label><textarea id="b-so-body" rows="16" maxlength="60000">${esc(p.so.body)}</textarea><p class="help">Leave empty to publish in English only. With Somali text, readers get a separate Somali page, and Somali subscribers get the Somali email.</p></div></div>
    </section>
    <section class="card form"><h3>Video <small>optional: leads readers to your YouTube video</small></h3>
      ${field('b-video', 'YouTube link', p.videoUrl, { type: 'url', help: 'Paste any YouTube link (watch, youtu.be, shorts). The thumbnail appears automatically at the top and in shares.' })}
      <div id="b-thumb" class="thumb-prev" hidden><img alt="Video thumbnail preview"><span>Thumbnail used on the article, cards, emails and social shares</span></div>
      ${field('b-cover', 'Cover image link (optional)', p.cover, { type: 'url', help: 'Used when there is no video. Square or 16:9 images work best.' })}
    </section>
   </div>
   <aside class="ed-side">
    <section class="card form"><h3>Publish</h3>
      ${field('b-status', 'Status', p.status, { opts: [['draft', 'Draft'], ['published', 'Published'], ['scheduled', 'Schedule for later']] })}
      <div id="b-when" ${p.status === 'scheduled' ? '' : 'hidden'}>${field('b-at', 'Publish on', toLocal(p.publishedAt), { type: 'datetime-local' })}</div>
      <label class="check"><input type="checkbox" id="b-notify" ${p.notify ? 'checked' : ''}> Email subscribers when published <small>${meta.subscribers} active subscribers${p.emailedAt && !p.sample ? ` · already sent to ${p.sentCount}` : ''}</small></label>
      <label class="check"><input type="checkbox" id="b-feat" ${p.featured ? 'checked' : ''}> Feature on top of the blog</label>
      <div class="actions" style="justify-content:flex-start"><button class="btn primary" type="submit" id="b-save">${p.status === 'published' ? 'Update' : 'Save'}</button>${id && p.status === 'published' ? '<button class="btn" type="button" id="b-resend">Email subscribers again</button><button class="btn" type="button" id="b-test">Send test to me</button>' : ''}</div>
    </section>
    <section class="card form"><h3>Category &amp; tags</h3>${field('b-service', 'Related service (shown as a guide on the consulting page)', p.service || '', { opts: [['', 'None'], ['tech', 'Tech Help & Smart Buying'], ['creator', 'Creator Growth Coaching'], ['business', 'Business Online Growth'], ['safety', 'Account Audit & Online Safety']] })}${field('b-cat', 'Category', p.cat, { opts: Object.entries(meta.cats).map(([k, l]) => [k, l[0]]) })}${field('b-tags', 'Tags (comma separated)', (p.tags || []).join(', '))}</section>
    <section class="card form"><h3>Google preview &amp; SEO</h3>
      <div class="serp" aria-label="Google result preview"><div class="serp-u" id="s-url"></div><div class="serp-t" id="s-title"></div><div class="serp-d" id="s-desc"></div></div>
      ${field('b-seo-title', 'SEO title (optional)', (p.seo || {}).title || '', { max: 90, help: '<span id="c-title"></span>' })}
      ${field('b-seo-desc', 'Meta description (optional)', (p.seo || {}).description || '', { area: 1, rows: 3, max: 200, help: '<span id="c-desc"></span>' })}
      <ul class="seo-check" id="b-checks"></ul>
    </section>
   </aside>
  </form><div class="sticky-save"><button class="btn primary" type="submit" form="bForm">${p.status === 'published' ? 'Update article' : 'Save article'}</button></div>`;
  const g = x => $('#' + x);
  const paneBtns = $$('[data-lang]', main); paneBtns.forEach(b => b.onclick = () => { paneBtns.forEach(x => x.setAttribute('aria-pressed', x === b)); $$('[data-pane]', main).forEach(pn => pn.hidden = pn.dataset.pane !== b.dataset.lang); });
  const refresh = () => {
    const t = g('b-seo-title').value || g('b-title').value, d = g('b-seo-desc').value || g('b-excerpt').value, slug = g('b-slug').value || (g('b-title').value || 'your-article').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    $('#s-url').textContent = meta.site.replace(/^https?:\/\//, '') + ' › blog › ' + slug.slice(0, 40); $('#s-title').textContent = (t || 'Your title').slice(0, 65) + (t.length > 65 ? '…' : ''); $('#s-desc').textContent = (d || 'Your summary appears here…').slice(0, 160) + (d.length > 160 ? '…' : '');
    $('#c-title').textContent = t.length + ' / 65 characters ' + (t.length >= 30 && t.length <= 65 ? '✓' : '(aim for 30–65)'); $('#c-desc').textContent = d.length + ' / 160 characters ' + (d.length >= 70 && d.length <= 160 ? '✓' : '(aim for 70–160)');
    const words = (g('b-body').value.match(/\S+/g) || []).length; $('#b-words').textContent = words + ' words · ~' + Math.max(1, Math.round(words / 200)) + ' min read';
    const vid = ytIdOf(g('b-video').value), th = $('#b-thumb'); th.hidden = !vid; if (vid) th.querySelector('img').src = 'https://img.youtube.com/vi/' + vid + '/hqdefault.jpg';
    const checks = [['Title is 30–65 characters', t.length >= 30 && t.length <= 65], ['Description is 70–160 characters', d.length >= 70 && d.length <= 160], ['Article has 300+ words', words >= 300], ['Has a video or cover image', !!vid || !!g('b-cover').value], ['Short web address', slug.length <= 60]];
    $('#b-checks').innerHTML = checks.map(([l, ok]) => `<li class="${ok ? 'ok' : ''}"><i></i>${l}</li>`).join('');
    g('b-when').hidden = g('b-status').value !== 'scheduled';
  };
  $('#bForm').addEventListener('input', refresh); refresh();
  $$('[data-ins]', main).forEach(b => b.onclick = () => { const [pre, post] = b.dataset.ins.split('|'), ta = g('b-body'), s = ta.selectionStart, e = ta.selectionEnd, sel = ta.value.slice(s, e) || 'text'; ta.setRangeText(pre + sel + post, s, e, 'end'); ta.focus(); refresh(); });
  $('[data-ins-video]', main).onclick = () => { const vid = g('b-video').value.trim(); const ta = g('b-body'); ta.setRangeText('\n\n{{youtube ' + (vid || 'https://www.youtube.com/watch?v=VIDEO_ID') + '}}\n\n', ta.selectionStart, ta.selectionEnd, 'end'); ta.focus(); refresh(); };
  const collect = () => ({ en: { title: g('b-title').value, excerpt: g('b-excerpt').value, body: g('b-body').value }, so: { title: g('b-so-title').value, excerpt: g('b-so-excerpt').value, body: g('b-so-body').value }, slug: g('b-slug').value, cat: g('b-cat').value, service: g('b-service').value, tags: g('b-tags').value, videoUrl: g('b-video').value, cover: g('b-cover').value, status: g('b-status').value, publishAt: g('b-status').value === 'scheduled' ? g('b-at').value : '', notify: g('b-notify').checked, featured: g('b-feat').checked, seo: { title: g('b-seo-title').value, description: g('b-seo-desc').value } });
  $('#bForm').onsubmit = guard(async e => {
    e.preventDefault(); const body = collect();
    if (!body.en.title.trim()) { toast('Please add a title', true); g('b-title').focus(); return; }
    if (body.status === 'published' && body.notify && !(p.emailedAt) && !confirm('Publish now and email ' + meta.subscribers + ' subscribers?')) return;
    const btn = g('b-save'); btn.disabled = true;
    const r = await api(id ? '/blog/' + id : '/blog', { method: id ? 'PUT' : 'POST', body });
    toast(r.status === 'published' ? (body.notify && !p.emailedAt ? 'Published: emailing subscribers in the background' : 'Published') : r.status === 'scheduled' ? 'Scheduled' : 'Saved as draft');
    location.hash = '#/blog/edit/' + r.id; if (id) render();
  });
  if (id) {
    const bk = $('#b-back'); if (bk) bk.onclick = () => { dialog(`<h2>Send back to ${esc(p.authorName || 'the writer')}</h2><p class="help">They get an email with your note and can edit and re-submit.</p>${field('rv-note', 'What should they change?', '', { area: 1, max: 2000, req: 1 })}<div class="actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary" type="submit">Send back</button></div>`); $('#dlgForm').onsubmit = guard(async e => { e.preventDefault(); await api('/authors/review/' + id, { method: 'POST', body: { note: $('#rv-note').value } }); $('#dlg').close(); toast('Sent back to the writer'); render(); }); };
    $('#b-del').onclick = guard(async () => { if (!confirm('Delete this article and its comments? This cannot be undone.')) return; await api('/blog/' + id, { method: 'DELETE' }); toast('Deleted'); location.hash = '#/blog'; });
    const rs = $('#b-resend'); if (rs) { rs.onclick = guard(async () => { if (!confirm('Email this article to all ' + meta.subscribers + ' subscribers again?')) return; rs.disabled = true; const r = await api('/blog/' + id + '/email', { method: 'POST', body: {} }); toast('Sent to ' + r.sent + ' subscribers'); rs.disabled = false; }); $('#b-test').onclick = guard(async () => { await api('/blog/' + id + '/email', { method: 'POST', body: { test: true } }); toast('Test email sent to your inbox'); }); }
  }
}

/* ---------- writers ---------- */
views.writers = async main => {
  const d = await api('/authors'), L = { invited: ['Invited', 'pending'], active: ['Active', 'paid'], paused: ['Paused', ''] };
  main.innerHTML = `<div class="head"><div><h1>Writers</h1><p>Invite contributors to write for the blog, only the blog. They sign in on their own page with their own login; they never see your dashboard.</p></div><button class="btn primary" id="wInv">+ Invite writer</button></div>
  <section class="card"><h3>Writers' sign-in page</h3><p class="help" style="margin:0 0 8px">Share this address with your writers (it is not linked anywhere on the public site):</p><div class="item"><div class="grow mono">${esc(d.loginUrl)}</div><button class="btn sm" id="wCopy">Copy</button></div>
  <p class="help" style="margin:10px 0 0"><b>How review works:</b> every article from a writer lands in <a href="#/blog/review">Blog → waiting for review</a>. You publish it or send it back with a note. Switch on <b>Trusted writer</b> for someone you rely on and they can publish directly.</p></section>
  <section class="card"><h3>Top contributors <small>${esc(d.month)}</small></h3>${d.top.length ? d.top.map(x => `<div class="item"><span class="pill ${x.rank === 1 ? 'paid' : ''}">#${x.rank}</span><div class="grow"><b>${esc(x.name)}</b></div><span class="mono">${x.month} article${x.month === 1 ? '' : 's'}</span>${x.streak ? `<span class="pill pending">${x.streak}-${x.unit} streak</span>` : ''}</div>`).join('') : '<p class="empty">No writer has published this month yet.</p>'}</section>
  <section class="card"><h3>Your writers (${d.authors.length})</h3>${d.authors.length ? d.authors.map(a => `<div class="item" style="align-items:flex-start;flex-wrap:wrap"><div class="grow"><b>${esc(a.name)}</b> <span class="pill ${L[a.status][1]}">${L[a.status][0]}</span>${a.trusted ? ' <span class="pill paid">Trusted</span>' : ''}<br><small style="color:var(--muted)">${esc(a.email)} · ${a.posts} article${a.posts === 1 ? '' : 's'} · ${a.live} live${a.inReview ? ' · <b>' + a.inReview + ' in review</b>' : ''}${a.lastLogin ? ' · last sign-in ' + ago(a.lastLogin) : ''}${a.status === 'active' ? `<br>Commitment: ${a.stats.target}/${a.stats.unit} · this ${a.stats.unit} ${a.stats.done}/${a.stats.target}${a.stats.streak ? ' · ' + a.stats.streak + '-' + a.stats.unit + ' streak' : ''} · best ${a.stats.best}${a.planned ? ' · ' + a.planned + ' planned' : ''}${a.stats.goal.remind === false ? ' · reminders off' : ''}` : ''}</small></div>
    <label class="check" style="margin:0"><input type="checkbox" data-trust="${a.id}" ${a.trusted ? 'checked' : ''}> Trusted writer: can publish directly</label>
    <div style="display:flex;gap:6px;flex-wrap:wrap">${a.status === 'invited' ? `<button class="btn sm" data-re="${a.id}">Resend invite</button>` : ''}${a.status === 'active' ? `<button class="btn sm" data-st="paused" data-id="${a.id}">Pause</button>` : ''}${a.status === 'paused' ? `<button class="btn sm" data-st="active" data-id="${a.id}">Resume</button>` : ''}<button class="btn sm danger" data-rm="${a.id}">Remove</button></div></div>`).join('') : '<p class="empty">No writers yet. Invite your first contributor.</p>'}</section>`;
  $('#wCopy').onclick = () => { navigator.clipboard && navigator.clipboard.writeText(d.loginUrl); toast('Copied'); };
  $('#wInv').onclick = () => { dialog(`<h2>Invite a writer</h2><p class="help">They receive an email with a link to choose their password.</p>${field('w-name', 'Name', '', { req: 1, max: 60 })}${field('w-mail', 'Email', '', { type: 'email', req: 1 })}<label class="check"><input type="checkbox" id="w-trust"> Trusted writer: can publish directly without review</label><div class="actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary" type="submit">Send invitation</button></div>`); $('#dlgForm').onsubmit = guard(async e => { e.preventDefault(); await api('/authors', { method: 'POST', body: { name: $('#w-name').value, email: $('#w-mail').value, trusted: $('#w-trust').checked } }); $('#dlg').close(); toast('Invitation sent'); render(); }); };
  $$('[data-trust]', main).forEach(c => c.onchange = guard(async () => { if (c.checked && !confirm('Trusted writers publish articles live without your review. Continue?')) { c.checked = false; return; } await api('/authors/' + c.dataset.trust, { method: 'PATCH', body: { trusted: c.checked } }); toast(c.checked ? 'Now trusted' : 'Review required again'); render(); }));
  $$('[data-st]', main).forEach(b => b.onclick = guard(async () => { await api('/authors/' + b.dataset.id, { method: 'PATCH', body: { status: b.dataset.st } }); toast(b.dataset.st === 'paused' ? 'Paused and signed out' : 'Resumed'); render(); }));
  $$('[data-re]', main).forEach(b => b.onclick = guard(async () => { await api('/authors/' + b.dataset.re + '/invite', { method: 'POST', body: {} }); toast('Invitation resent'); }));
  $$('[data-rm]', main).forEach(b => b.onclick = guard(async () => { if (!confirm('Remove this writer? Their drafts are deleted; published articles stay on the blog.')) return; await api('/authors/' + b.dataset.rm, { method: 'DELETE' }); toast('Removed'); render(); }));
};

/* ---------- dialog ---------- */
function dialog(html) { const f = $('#dlgForm'); f.innerHTML = html; f.onsubmit = null; $$('[data-close]', f).forEach(b => b.onclick = () => $('#dlg').close()); const d = $('#dlg'); if (!d.open) d.showModal(); const first = $('input,textarea,select', f); if (first) first.focus(); }
$('#dlg').addEventListener('click', e => { if (e.target === $('#dlg')) $('#dlg').close(); });

/* ---------- boot ---------- */
fetch('/api/admin/auth-mode').then(r => r.json()).then(j => { if (j.mode === 'supabase') { $('label[for=un]').textContent = 'Email'; $('#un').type = 'email'; $('#un').placeholder = 'you@example.com'; } }).catch(() => {});   // sign-in with a Supabase user asks for an e-mail
async function doLogin(send) {
  $('#loginErr').textContent = '';
  try {
    const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'yy-admin' }, body: JSON.stringify({ username: $('#un').value, password: $('#pw').value, code: send ? '' : $('#tc').value, send }) }); const j = await r.json();
    if (j.need2fa) { $('#codeWrap').hidden = false; $('#pw').readOnly = true; $('#un').readOnly = true; $('#sendEmail').hidden = !j.methods.includes('email'); $('#codeMsg').textContent = j.sent ? j.error : (j.methods.includes('app') ? 'Enter the 6-digit code from your authenticator app, or a recovery code.' : 'Choose how to get your code, then enter it below.'); if (!j.sent && $('#tc').value) $('#loginErr').textContent = j.error; $('#tc').focus(); return; }
    if (!r.ok) throw new Error(j.error);
    $('#pw').value = ''; $('#tc').value = ''; $('#codeWrap').hidden = true; $('#pw').readOnly = false; $('#un').readOnly = false; showApp(); render();
  } catch (err) { $('#loginErr').textContent = err.message || 'Could not sign in'; }
}
$('#loginForm').onsubmit = e => { e.preventDefault(); doLogin(''); };
$('#sendEmail').onclick = () => doLogin('email');
let resetToken = '';
$('#forgotLink').onclick = e => { e.preventDefault(); $('#forgotOk').textContent = ''; $('#forgotErr').textContent = ''; $('#forgotBtn').disabled = false; showLogin('forgotForm'); };
$$('[data-back]').forEach(a => a.onclick = e => { e.preventDefault(); showLogin(); });
$('#forgotForm').onsubmit = async e => {
  e.preventDefault(); $('#forgotErr').textContent = ''; $('#forgotBtn').disabled = true;
  try { const r = await fetch('/api/admin/forgot', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'yy-admin' }, body: '{}' }); const j = await r.json(); if (!r.ok) throw new Error(j.error); $('#forgotOk').textContent = 'If an owner email is set up, a reset link is on its way. Check your inbox (and spam).'; }
  catch (err) { $('#forgotErr').textContent = err.message || 'Could not send. Try again.'; $('#forgotBtn').disabled = false; }
};
$('#resetForm').onsubmit = async e => {
  e.preventDefault(); $('#resetErr').textContent = '';
  if ($('#np1').value !== $('#np2').value) { $('#resetErr').textContent = 'The two passwords do not match.'; return; }
  try { const r = await fetch('/api/admin/reset', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'yy-admin' }, body: JSON.stringify({ token: resetToken, password: $('#np1').value }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error); resetToken = ''; $('#np1').value = $('#np2').value = ''; showLogin(); $('#loginErr').textContent = ''; toast('Password changed. Please sign in.'); }
  catch (err) { $('#resetErr').textContent = err.message || 'Could not reset'; }
};
const logout = async () => { toggleSheet(false); await fetch('/api/admin/logout', { method: 'POST', headers: { 'X-Requested-With': 'yy-admin' } }); showLogin(); };
const toggleTheme = () => { const n = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = n; try { localStorage.setItem('yy-admin-theme', n); } catch { /* ignore */ } };
$('#logoutBtn').onclick = logout; $('#themeBtn').onclick = toggleTheme;
$$('[data-act]').forEach(b => b.onclick = () => (b.dataset.act === 'logout' ? logout() : toggleTheme()));
$('#menuBtn').onclick = () => toggleSheet();
$('#sheetBg').onclick = () => toggleSheet(false);
addEventListener('keydown', e => { if (e.key === 'Escape') toggleSheet(false); });
$('#more').addEventListener('click', e => { if (e.target.closest('a')) toggleSheet(false); });
window.addEventListener('hashchange', () => { if (!$('#app').hidden) render(); });
(async () => {
  const m = location.hash.match(/^#\/reset\/([a-f0-9]{64})$/);
  if (m) { resetToken = m[1]; history.replaceState(null, '', location.pathname); showLogin('resetForm'); return; }   // token leaves the address bar straight away
  try { await api('/me'); showApp(); render(); } catch { showLogin(); }
})();
