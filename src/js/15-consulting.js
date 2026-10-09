/* ---------- Consulting: session picker + Cal.com inline booking ---------- */
const price = s => s.price > 0 ? CONFIG.currency + s.price : t('cs.free');
let activeSession = (new URLSearchParams(location.search).get('session')) || SESSIONS[0].id;
function renderSessions() {
  const box = $('#sessions'); if (box === NULL) return;
  box.querySelectorAll('.session').forEach(n => n.remove());
  SESSIONS.filter(s => s.enabled !== false).forEach(s => {
    const id = 'sess-' + s.id;
    const el = document.createElement('div'); el.className = 'session';
    el.innerHTML = `<input type="radio" name="session" id="${id}" value="${s.id}" ${s.id === activeSession ? 'checked' : ''}>
      <label for="${id}"><span class="s-main"><b>${esc(pick(s)[0])}</b>${pick(s)[1] ? `<small>${esc(pick(s)[1])}</small>` : ''}${s.who ? `<em class="s-who">${esc(pick(s.who))}</em>` : ''}${s.inc ? `<ul class="s-inc" aria-label="${t('cs.included')}">${pick(s.inc).map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</span>
      <span class="s-meta"><span class="s-price">${esc(price(s))}</span><span class="s-min">${s.min} ${t('cs.min')}</span></span><span class="s-book">${esc(t('cs.bookBtn').replace('{p}', price(s)))}</span></label>`;
    box.appendChild(el);
  });
  try {   // structured data for search engines: the sessions (prices come from the dashboard) and the FAQ
    const ld = [{ '@context': 'https://schema.org', '@type': 'ProfessionalService', name: 'Eng Yuyu | 1:1 Digital Consulting', url: location.origin + '/consulting.html', provider: { '@type': 'Person', name: 'Eng Yuyu' }, areaServed: 'Worldwide', hasOfferCatalog: { '@type': 'OfferCatalog', name: '1:1 sessions', itemListElement: SESSIONS.filter(x => x.enabled !== false).map(x => ({ '@type': 'Offer', price: x.price, priceCurrency: 'USD', itemOffered: { '@type': 'Service', name: x.en[0], description: (x.inc ? x.inc.en : []).join('. ') + ' (' + x.min + ' minutes, online)' } })) } },
      { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: $$('.faq details').map(d => ({ '@type': 'Question', name: d.querySelector('summary').textContent.trim(), acceptedAnswer: { '@type': 'Answer', text: d.querySelector('p').textContent.trim() } })) }];
    let el = document.getElementById('ld-consulting'); if (!el) { el = document.createElement('script'); el.type = 'application/ld+json'; el.id = 'ld-consulting'; document.head.appendChild(el); }
    el.textContent = JSON.stringify(ld);
  } catch { /* optional */ }
  const hs = $('#heroSessions');
  if (hs !== NULL) hs.innerHTML = SESSIONS.filter(s => s.enabled !== false).map(s => `<li><span>${esc(pick(s)[0])}</span><em>${esc(price(s))} · ${s.min} ${t('cs.min')}</em></li>`).join('');
}
function loadCalScript() {
  if (window.Cal) return;
  (function (C, A, L) { const p = (a, ar) => a.q.push(ar), d = C.document; C.Cal = C.Cal || function () { const cal = C.Cal, ar = arguments; if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement('script')).src = A; cal.loaded = true; } if (ar[0] === L) { const api = function () { p(api, arguments); }, ns = ar[1]; api.q = api.q || []; if (typeof ns === 'string') { cal.ns[ns] = cal.ns[ns] || api; p(cal.ns[ns], ar); p(cal, ['initNamespace', ns]); } else p(cal, ar); return; } p(cal, ar); }; })(window, CONFIG.cal.origin + '/embed/embed.js', 'init');
  window.Cal('init', { origin: CONFIG.cal.origin });
}
/* Built-in scheduler: honours the availability rules (days, hours, 24h notice, Mogadishu time) */
const AV = CONFIG.availability;
const curSession = () => SESSIONS.find(x => x.id === activeSession) || SESSIONS[0];
const fmtTz = (ms, o, tz) => new Intl.DateTimeFormat(lang === 'so' ? 'so' : 'en', { timeZone: tz, ...o }).format(ms);
function buildDays(s) {
  const out = [], min = Date.now() + AV.minNoticeHours * 3600e3;
  for (let i = 0; i < AV.horizonDays; i++) {
    const e = new Date(Date.now() + i * 864e5 + AV.tz * 3600e3);          // shifted into Mogadishu time
    if (!AV.days.includes(e.getUTCDay())) continue;
    const y = e.getUTCFullYear(), m = e.getUTCMonth(), d = e.getUTCDate(), slots = [];
    for (let mins = AV.start * 60; mins + s.min <= AV.end * 60; mins += AV.step) {
      const start = Date.UTC(y, m, d, 0, mins - AV.tz * 60);
      if (start >= min) slots.push(start);
    }
    if (slots.length) out.push({ key: y + '-' + m + '-' + d, slots });
  }
  return out;
}
const API = (() => { let v = new URLSearchParams(location.search).get('api'); try { if (v) sessionStorage.setItem('yy-api', v); else v = sessionStorage.getItem('yy-api'); } catch {} const own = document.body.hasAttribute('data-api') ? (document.body.dataset.api || location.origin) : ''; return (v || own || CONFIG.api || '').replace(/\/$/, ''); })();
let apiCfg = { paymentRequired: false }, apiCfgLoaded = false;
let selDay = null, selSlot = null, remoteDays = null;
async function loadRemote() {
  remoteDays = null; renderNative();
  if (!apiCfgLoaded) { try { apiCfg = await (await fetch(API + '/api/config')).json(); apiCfgLoaded = true; updatePay(); } catch { /* keep defaults */ } }
  try {
    const r = await fetch(API + '/api/slots?session=' + encodeURIComponent(activeSession), { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status);
    remoteDays = (await r.json()).days;
  } catch { remoteDays = []; }
  renderNative();
}
function renderNative() {
  const box = $('#nativeBook'); if (box === NULL || box.hidden) return;
  const s = curSession(), days = API ? (remoteDays || []) : buildDays(s);
  if (!days.some(d => d.key === selDay)) { selDay = null; selSlot = null; }
  $('#availNote').textContent = t('cs.avail');
  $('#dateRow').innerHTML = days.length ? days.map(d => `<button type="button" class="chip" data-day="${d.key}" aria-pressed="${d.key === selDay}">${esc(fmtTz(d.slots[0], { weekday: 'short', day: 'numeric', month: 'short' }, AV.tzId))}</button>`).join('') : `<p class="empty">${API && remoteDays === null ? t('cs.n.loading') : t('cs.n.none')}</p>`;
  const day = days.find(d => d.key === selDay);
  $('#slotWrap').hidden = !day;
  $('#slotGrid').innerHTML = day ? day.slots.map(ms => `<button type="button" class="chip slot" data-slot="${ms}" aria-pressed="${ms === selSlot}">${fmtTz(ms, { hour: '2-digit', minute: '2-digit', hour12: false }, AV.tzId)}</button>`).join('') : '';
  const sum = $('#slotLocal');
  if (selSlot) {
    const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    sum.textContent = t('cs.n.yours') + ': ' + fmtTz(selSlot, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }, localTz) + ' (' + localTz.replace('_', ' ') + ')';
  } else sum.textContent = '';
  $('#reqForm').hidden = !selSlot;
  const bs = $('#bookSummary');   // what you're booking: so a different session or time is never picked by accident
  if (selSlot && bs !== NULL) bs.innerHTML = `<div><b>${esc(pick(s)[0])}</b> · ${s.min} ${t('cs.min')} · <b>${esc(price(s))}</b><br><span>${esc(fmtTz(selSlot, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false }, AV.tzId))} · ${esc(AV.tzName || 'Mogadishu time')}</span></div><a href="#book" class="bs-change">${esc(t('cs.change'))}</a>`;
  const pays = API && apiCfg.paymentRequired && s.price > 0;
  $('#reqForm').querySelector('button[type="submit"]').textContent = pays ? t('cs.n.pay').replace('{price}', price(s)) : t('cs.n.submit');
}
function calLinks(s, start, name) {
  const end = start + s.min * 60e3, z = ms => new Date(ms).toISOString().replace(/[-:]|\.\d{3}/g, '');
  const title = 'Consultation with Eng Yuyu | ' + pick(s)[0], det = 'Requested via engyuyu.com (Google Meet link will be sent once confirmed).';
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Eng Yuyu//Booking//EN', 'BEGIN:VEVENT', 'UID:' + start + '@engyuyu.com', 'DTSTAMP:' + z(Date.now()), 'DTSTART:' + z(start), 'DTEND:' + z(end), 'SUMMARY:' + title, 'DESCRIPTION:' + det, 'STATUS:TENTATIVE', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  return {
    google: 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(title) + '&dates=' + z(start) + '/' + z(end) + '&details=' + encodeURIComponent(det),
    outlook: 'https://outlook.live.com/calendar/0/deeplink/compose?path=%2Fcalendar%2Faction%2Fcompose&rru=addevent&subject=' + encodeURIComponent(title) + '&startdt=' + new Date(start).toISOString() + '&enddt=' + new Date(end).toISOString() + '&body=' + encodeURIComponent(det),
    ics: 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics),
  };
}
function updatePay() {
  const s = curSession(), box = $('#payBox'); if (box === NULL) return;
  box.hidden = !(s.price > 0);
  const auto = API && apiCfg.paymentRequired;
  $('#payText').textContent = auto ? t('cs.pay.auto') : t('cs.pay.p');
  $('#payBtn').hidden = !!auto;
  if (auto) return;
  const btn = $('#payBtn');
  btn.textContent = s.payUrl ? t('cs.pay.btn').replace('{price}', price(s)) : t('cs.pay.soon');
  if (s.payUrl) { btn.href = s.payUrl; btn.removeAttribute('aria-disabled'); btn.target = '_blank'; btn.rel = 'noopener'; }
  else { btn.removeAttribute('href'); btn.setAttribute('aria-disabled', 'true'); }
}
function showBooking() {
  if (!has('#calEmbed')) return;
  const host = $('#calEmbed'), nat = $('#nativeBook'), s = curSession();
  updatePay();
  const useCal = CONFIG.cal.enabled && CONFIG.cal.username;
  host.hidden = !useCal; nat.hidden = !!useCal;
  if (!useCal) { $('#reqDone').hidden = true; API ? loadRemote() : renderNative(); return; }
  host.innerHTML = '';
  loadCalScript();
  const theme = root.dataset.theme === 'dark' ? 'dark' : 'light';
  window.Cal('inline', { elementOrSelector: '#calEmbed', calLink: CONFIG.cal.username + '/' + s.slug, layout: 'month_view', config: { theme } });
  window.Cal('ui', { theme, hideEventTypeDetails: false, cssVarsPerTheme: { light: { 'cal-brand': '#006AFF' }, dark: { 'cal-brand': '#3D8BFF' } } });
}
/* Back from the payment page: verify the payment, then show the approval (the Meet link is also emailed automatically) */
async function handleReturn() {
  const q = new URLSearchParams(location.search), oid = q.get('order_id'), sid = q.get('sid');
  if (!oid || !API) return;
  history.replaceState(null, '', location.pathname + '#book');
  const box = $('#payStatus'), sleep = ms => new Promise(r => setTimeout(r, ms));
  $('#nativeBook').hidden = true; $('#calEmbed').hidden = true; box.hidden = false;
  const show = (kind, j = {}) => {
    const K = { verifying: ['spin', 'cs.ps.verifying', ''], pending: ['spin', 'cs.ps.verifying', 'cs.ps.pending'], waiting: ['wait', 'cs.ps.wait.t', 'cs.ps.wait.p'], left: ['bad', 'cs.ps.left.t', 'cs.ps.left.p'], ok: ['ok', 'cs.ps.ok.t', 'cs.ps.ok.p'], failed: ['bad', 'cs.ps.failed.t', 'cs.ps.failed.p'], conflict: ['bad', 'cs.ps.conflict.t', 'cs.ps.conflict.p'], error: ['bad', 'cs.ps.err.t', 'cs.ps.err.p'] }[kind];
    box.dataset.kind = K[0];
    $('#psTitle').textContent = t(K[1]); $('#psMsg').textContent = K[2] ? t(K[2]) : '';
    const ss = j.session && SESSIONS.find(x => x.id === j.session);
    $('#psRef').textContent = [j.ref ? t('cs.ps.ref') + ': ' + j.ref : '', ss ? pick(ss)[0] : '', j.start ? fmtTz(j.start, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false }, AV.tzId) + ' · ' + (AV.tzName || '') : ''].filter(Boolean).join(' · ');
    const meet = $('#psMeet'); meet.hidden = !(kind === 'ok' && j.meet); if (j.meet) meet.href = j.meet;
    $('#psRetry').hidden = !['failed', 'left', 'error', 'waiting'].includes(kind);
    requestAnimationFrame(() => box.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'center' }));   // the client lands right on the result
  };
  $('#psRetry').onclick = async () => {   // give up on this payment: free the held time, then back to choosing a time
    const btn = $('#psRetry'); btn.disabled = true;
    try { const r = await (await fetch(API + '/api/release', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: oid }) })).json(); if (r.status === 'paid' || r.status === 'confirmed') { btn.disabled = false; return show('ok', { ref: oid.slice(0, 8).toUpperCase() }); } } catch { /* the hold expires on its own */ }
    btn.disabled = false; box.hidden = true; selSlot = null; showBooking();
    $('#sessions').scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
  };
  show('verifying');
  for (let i = 0; i < 30; i++) {
    let j;
    try { j = await (await fetch(API + '/api/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: oid, sid }) })).json(); } catch { return show('error'); }
    if (j.status === 'paid' || j.status === 'confirmed') return show('ok', j);
    if (j.status === 'paid_conflict') return show('conflict', j);
    if (j.status === 'failed' || j.error) return show(j.error ? 'error' : 'failed', j);
    if (!sid) return show('left', j);            // came back from the checkout without paying
    show('pending', j); await sleep(4000);
  }
  show('waiting');   // still pending after ~2 minutes: not an error: it is approved by email as soon as the payment confirms
}

if (has('#sessions')) {
  renderSessions(); showBooking();
  handleReturn();
  $('#sessions').addEventListener('change', e => {
    if (e.target.name === 'session') { activeSession = e.target.value; selSlot = null; showBooking(); $('.book-embed').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
  $('#themeBtn').addEventListener('click', () => setTimeout(() => CONFIG.cal.enabled && showBooking(), 50));
  $('#dateRow').addEventListener('click', e => { const b = e.target.closest('[data-day]'); if (!b) return; selDay = b.dataset.day; selSlot = null; renderNative(); });
  $('#slotGrid').addEventListener('click', e => { const b = e.target.closest('[data-slot]'); if (!b) return; selSlot = +b.dataset.slot; renderNative(); $('#reqForm').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); });
  $('#reqAgain').addEventListener('click', () => { $('#reqDone').hidden = true; $('#reqForm').reset(); selSlot = null; selDay = null; renderNative(); });
  $$('#reqForm input, #reqForm textarea').forEach(el => el.addEventListener('input', () => { el.setAttribute('aria-invalid', 'false'); const er = $('#' + el.id + '-e'); if (er !== NULL) er.textContent = ''; }));
  $('#reqAgree').addEventListener('change', e => { if (e.target.checked) { $('#reqAgree-e').textContent = ''; e.target.setAttribute('aria-invalid', 'false'); } });
  $('#reqForm').addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('#reqName').value.trim(), mail = $('#reqEmail').value.trim(), note = $('#reqNote').value.trim(), s = curSession();
    const ok = [fieldErr('reqName', name ? '' : t('cs.n.eName')), fieldErr('reqEmail', validEmail(mail) ? '' : t('cs.n.eEmail'))];
    const agreed = $('#reqAgree').checked; $('#reqAgree-e').textContent = agreed ? '' : t('disc.agreeErr'); $('#reqAgree').setAttribute('aria-invalid', !agreed); if (!agreed) ok.push(false);
    if (!selSlot) { say($('#reqMsg'), t('cs.n.eSlot'), false); return; }
    if (ok.includes(false)) { $('#reqForm').querySelector('[aria-invalid="true"]').focus(); return; }
    const when = fmtTz(selSlot, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }, AV.tzId) + ' ' + AV.tzName;
    const body = [`Session: ${pick(s)[0]} (${s.min} min, ${price(s)})`, 'Time: ' + when, 'I understand these sessions are advice only: yes', 'Name: ' + name, 'Email: ' + mail, note && 'Notes: ' + note].filter(Boolean).join('\n');
    const btn = $('#reqForm').querySelector('button[type="submit"]'), label = btn.textContent; btn.disabled = true;
    if (API) { btn.textContent = t('cs.n.wait.b'); say($('#reqMsg'), apiCfg.paymentRequired ? t('cs.n.wait') : t('cs.n.wait2'), true); }   // visible feedback, reaching the payment page can take a while
    try {
      if (API) {
        const r = await fetch(API + '/api/book', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session: s.id, start: selSlot, name, email: mail, note, lang, agree: true }) });
        const j = await r.json().catch(() => ({}));
        if (r.status === 409) { say($('#reqMsg'), t('cs.n.taken'), false); selSlot = null; btn.disabled = false; btn.textContent = label; loadRemote(); return; }
        if (!r.ok) { const e = new Error(r.status); e.msg = r.status === 429 ? t('cs.n.e429') : r.status === 502 ? t('cs.n.e502') : (j.error || ''); throw e; }
        if (j.checkoutUrl) { say($('#reqMsg'), t('cs.n.redirect'), true); location.href = j.checkoutUrl; return; }   // payment first; the approval email follows automatically
        $('#reqDoneMsg').textContent = t('cs.n.booked');
        $('#meetLink').hidden = !j.meet; if (j.meet) { $('#meetLink').href = j.meet; }
        $('#addLbl').textContent = t('cs.n.add2');
        loadRemote();
      } else if (CONFIG.requestEndpoint) {
        const r = await fetch(CONFIG.requestEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ session: s.id, start: new Date(selSlot).toISOString(), name, email: mail, note }) });
        if (!r.ok) throw new Error(r.status);
        $('#reqDoneMsg').textContent = t('cs.n.sent');
      } else {
        $('#reqDoneMsg').textContent = t('cs.n.mail');
        location.href = `mailto:${CONFIG.email}?subject=${encodeURIComponent('Booking request: ' + pick(s)[0])}&body=${encodeURIComponent(body)}`;
      }
      if (!API) $('#meetLink').hidden = true;
      const L = calLinks(s, selSlot);
      $('#addG').href = L.google; $('#addO').href = L.outlook; $('#addA').href = L.ics;
      $('#reqForm').hidden = true; $('#reqDone').hidden = false; $('#reqMsg').textContent = '';
    } catch (err) { say($('#reqMsg'), (err && err.msg) || t('cs.n.eNet'), false); }
    btn.disabled = false; btn.textContent = label;
  });
}

