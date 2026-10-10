// Eng Yuyu booking API, zero dependencies, Node 18+.
//
//  Flow (when payments are on: Dashboard → Settings → Payments: off / test / sandbox / live):
//   1. POST /api/book     -> checks your rules + Google Calendar, HOLDS the slot for 20 min, asks Sifalo Pay for a
//                            hosted-checkout session and returns { checkoutUrl }.  The browser goes to Sifalo.
//   2. Sifalo sends the client back to  <SITE_URL>/consulting.html?order_id=…&sid=…
//   3. POST /api/confirm  -> verifies the payment with Sifalo (status "success" + code 601 + amount), then creates the
//                            Google Calendar event with a Google Meet link and emails the client the approval
//                            (Meet link, receipt, calendar file). You get a "new paid booking" email too.
//   Sifalo can also push a webhook (POST /api/pay/webhook) and a background job polls unpaid orders (covers clients who close the tab).
//  Test mode uses a built-in checkout (/pay/test) that the signed-in owner approves, no money moves.
//
//   GET /api/config · GET /api/slots?session=… · GET /api/order?id=…   (helpers)
// Run:  node server/server.js     (see server/.env.example; MOCK=1 fakes Google, Gmail and Sifalo for local testing)
'use strict';
const http = require('http');
require('dns').setDefaultResultOrder('ipv4first');   // some networks can't reach IPv6 addresses (e.g. Sifalo/Google behind Cloudflare): connect over IPv4 first
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

try {   // minimal .env loader
  for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
} catch { /* no .env */ }

const ENV = process.env;
const PORT = +ENV.PORT || 8787;
const MOCK = ENV.MOCK === '1';
const CAL_ID = ENV.GOOGLE_CALENDAR_ID || 'primary';
const store = require('./lib/store');
const settings = store.load('settings', {});             // editable from the dashboard
const OWNER = () => settings.ownerEmail || ENV.OWNER_EMAIL || 'contact@engyuyu.com';   // gets alerts; also the From address
const SITE_URL = (ENV.SITE_URL || 'https://engyuyu.com').replace(/\/$/, '');
const PUBLIC_API = (ENV.PUBLIC_API_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
if (MOCK && /^https?:\/\/(?!localhost|127\.0\.0\.1)/.test(ENV.SITE_URL || '')) { console.error('Refusing to start: MOCK=1 fakes payments and Google and must never run on a public address. Remove MOCK from server/.env.'); process.exit(1); }
const ORIGINS = (ENV.ALLOWED_ORIGIN || ENV.SITE_URL || '*').split(',').map(s => s.trim());
const payments = require('./lib/payments')({ ENV, MOCK, store });
const HOLD_MIN = 20;                         // how long a slot is reserved while the client pays
const LATE_PAY_MS = 3 * 3600e3;              // keep checking unpaid orders this long for late payments

// ---- booking rules (keep in sync with CONFIG in app.js) ----
const RULES = { days: [0, 2, 3], start: 14, end: 20, step: 30, tz: 3, tzId: 'Africa/Mogadishu', tzName: 'Mogadishu time (UTC+3)', minNoticeHours: 24, horizonDays: 42 };
const SESSIONS = {   // price/min/enabled can be overridden in the dashboard (Settings). Prices are SAMPLES until you confirm them.
  techfix:  { min: 30, price: 30, title: { en: 'Tech Fix Session', so: 'Kulanka Xalinta Tiknolojiyada' } },
  buying:   { min: 30, price: 30, title: { en: 'Buying Advice Session', so: 'Kulanka Talada Iibsashada' } },
  income:   { min: 60, price: 50, title: { en: 'Content & Income Plan', so: 'Qorshaha Nuxurka & Dakhliga' } },
  business: { min: 60, price: 50, title: { en: 'Business Growth Plan', so: 'Qorshaha Kobcinta Ganacsiga' } },
  safety:   { min: 45, price: 40, title: { en: 'Account Safety Check-up', so: 'Hubinta Badbaadada Akoonnada' } },
  // earlier sessions: kept only so old bookings still display; hidden everywhere else
  discovery:   { legacy: true, enabled: false, min: 15, price: 15, title: { en: 'Discovery call', so: 'Wicitaan is-barasho' } },
  partnership: { legacy: true, enabled: false, min: 30, price: 30, title: { en: 'Brand partnership call', so: 'Wicitaan lammaanaysi shirkad' } },
  strategy:    { legacy: true, enabled: false, min: 60, price: 50, title: { en: 'Strategy session', so: 'Kulan istaraatiijiyadeed' } },
};

// ---- orders ----
const orders = store.load('orders', {});
const save = () => store.save('orders');
let SESSION_DEFAULTS = []; try { SESSION_DEFAULTS = JSON.parse(fs.readFileSync(path.join(__dirname, 'content-defaults.json'), 'utf8')).sessions || []; } catch { /* run extract-defaults.js */ }
// The bookable sessions (names, wording, prices) are edited in the dashboard; until then the 3 built-in ones are used.
const sessionList = () => Array.isArray(settings.sessionList) && settings.sessionList.length ? settings.sessionList : SESSION_DEFAULTS.map(x => { const o = (settings.sessions || {})[x.id] || {}; return { ...x, price: Number.isFinite(+o.price) ? +o.price : x.price, min: Number.isFinite(+o.min) && +o.min > 0 ? +o.min : x.min, enabled: o.enabled !== false }; });
function rebuildSessions() {
  const listed = new Set();
  for (const it of sessionList()) { listed.add(it.id); SESSIONS[it.id] = Object.assign(SESSIONS[it.id] || {}, it, { title: { en: it.en[0], so: it.so[0] }, legacy: false }); }
  for (const [id, x] of Object.entries(SESSIONS)) if (!listed.has(id)) { x.legacy = true; x.enabled = false; }   // removed sessions stay only so old bookings still display
}
function applySettings() {
  if (settings.availability) { const a = settings.availability; if (Array.isArray(a.days)) RULES.days = a.days.map(Number).filter(d => d >= 0 && d <= 6); for (const k of ['start', 'end', 'step', 'minNoticeHours', 'horizonDays']) if (Number.isFinite(+a[k])) RULES[k] = +a[k]; }
  rebuildSessions();
  for (const [id, o] of Object.entries(settings.sessions || {})) if (false && SESSIONS[id]) { if (Number.isFinite(+o.price)) SESSIONS[id].price = +o.price; if (Number.isFinite(+o.min) && +o.min > 0) SESSIONS[id].min = +o.min; if (typeof o.enabled === 'boolean') SESSIONS[id].enabled = o.enabled; }
}
applySettings();

// ---- Google (Calendar + Gmail) ----
let tokenCache = { value: '', exp: 0 };
async function accessToken() {
  if (tokenCache.value && Date.now() < tokenCache.exp - 60e3) return tokenCache.value;
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: ENV.GOOGLE_CLIENT_ID, client_secret: ENV.GOOGLE_CLIENT_SECRET, refresh_token: ENV.GOOGLE_REFRESH_TOKEN, grant_type: 'refresh_token' }) });
  const j = await r.json();
  if (!r.ok) throw new Error('Google auth failed: ' + (j.error_description || j.error));
  tokenCache = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return tokenCache.value;
}
async function gfetch(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { Authorization: 'Bearer ' + await accessToken(), 'Content-Type': 'application/json' } });
  const j = await r.json();
  if (!r.ok) throw new Error('Google: ' + (j.error && j.error.message));
  return j;
}
const mockBusy = [], mockOutbox = [];
const GOOGLE_ON = () => MOCK || !!ENV.GOOGLE_REFRESH_TOKEN;   // until Google is connected the site still works: no calendar check, no Meet link, emails are logged
async function busyBetween(fromMs, toMs) {
  const holds = Object.values(orders).filter(o => o.status === 'pending' && o.holdUntil > Date.now()).map(o => [o.start, o.start + SESSIONS[o.session].min * 60e3, o.id]);
  let cal;
  if (MOCK) cal = mockBusy.filter(b => b[0] < toMs && b[1] > fromMs);
  else if (!GOOGLE_ON()) cal = Object.values(orders).filter(o => ['paid', 'confirmed'].includes(o.status) && SESSIONS[o.session]).map(o => [o.start, o.start + SESSIONS[o.session].min * 60e3]);   // without Google, approved bookings block their own slots
  else {
    const ids = [CAL_ID, ...(ENV.GOOGLE_EXTRA_CALENDARS || '').split(',').map(x => x.trim()).filter(Boolean)];   // extra calendars (e.g. a subscribed Outlook/iCloud feed) also block slots
    const j = await gfetch('https://www.googleapis.com/calendar/v3/freeBusy', { method: 'POST', body: JSON.stringify({ timeMin: new Date(fromMs).toISOString(), timeMax: new Date(toMs).toISOString(), items: ids.map(id => ({ id })) }) });
    cal = ids.flatMap(id => ((j.calendars[id] || {}).busy || []).map(b => [Date.parse(b.start), Date.parse(b.end)]));
  }
  return [...cal, ...holds];
}
async function createEvent(s, o, meetUrl) {
  const endMs = o.start + s.min * 60e3;
  if (MOCK) { mockBusy.push([o.start, endMs]); return { meet: 'https://meet.google.com/mock-demo-link' }; }
  if (!GOOGLE_ON()) return { meet: '', eventId: '' };
  const ev = await gfetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CAL_ID)}/events?conferenceDataVersion=1&sendUpdates=none`, {
    method: 'POST',
    body: JSON.stringify({
      summary: `${o.test ? '[TEST] ' : ''}${s.title.en}: ${o.name}`,
      description: [`Booked via engyuyu.com`, `Session: ${s.title.en} (${s.min} min)`, `Client: ${o.name} <${o.email}>`, o.note && `Notes: ${o.note}`, o.sid ? `Paid: $${o.amount} online (${o.payType || 'n/a'}) · payment ID ${o.sid}` : 'No payment required'].filter(Boolean).join('\n'),
      start: { dateTime: new Date(o.start).toISOString() }, end: { dateTime: new Date(endMs).toISOString() },
      attendees: [{ email: o.email, displayName: o.name }],
      conferenceData: { createRequest: { requestId: 'yy-' + o.id, conferenceSolutionKey: { type: 'hangoutsMeet' } } },
      reminders: { useDefault: false, overrides: [{ method: 'email', minutes: 60 }, { method: 'popup', minutes: 15 }] },
    }),
  });
  return { meet: ev.hangoutLink || '', eventId: ev.id };
}
async function cancelEvent(o) {   // delete the calendar event (frees the slot): best effort
  if (MOCK) { const i = mockBusy.findIndex(b => b[0] === o.start); if (i >= 0) mockBusy.splice(i, 1); return; }
  if (!o.eventId) return;
  try { await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CAL_ID)}/events/${o.eventId}?sendUpdates=none`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + await accessToken() } }); } catch (e) { console.error('cancelEvent', e.message); }
}

// ---- email (Gmail API, zero deps) ----
const b64 = s => Buffer.from(s).toString('base64');
const b64url = s => b64(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
async function sendMail({ to, subject, text, html, ics }) {
  if (MOCK) { mockOutbox.push({ to, subject, text, html, hasIcs: !!ics, at: Date.now() }); if (mockOutbox.length > 60) mockOutbox.shift(); console.log('[mock email]', to, '-', subject); return; }
  if (!GOOGLE_ON()) { console.log('[email not sent: Google not connected]', to, '-', subject); try { admin.log('email', `Email not sent (Google not connected): “${subject}” to ${to}`); } catch { /* ignore */ } return; }
  const bnd = 'yy' + crypto.randomBytes(8).toString('hex');
  const parts = [
    `From: Eng Yuyu <${OWNER()}>`, `To: ${to}`, `Reply-To: ${OWNER()}`, `Subject: =?UTF-8?B?${b64(subject)}?=`, 'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${bnd}"`, '',
    `--${bnd}`, `Content-Type: multipart/alternative; boundary="${bnd}a"`, '',
    `--${bnd}a`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64(text), '',
    `--${bnd}a`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64(html), '',
    `--${bnd}a--`,
  ];
  if (ics) parts.push(`--${bnd}`, 'Content-Type: text/calendar; charset=UTF-8; method=REQUEST; name="invite.ics"', 'Content-Disposition: attachment; filename="invite.ics"', 'Content-Transfer-Encoding: base64', '', b64(ics), '');
  parts.push(`--${bnd}--`);
  await gfetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { method: 'POST', body: JSON.stringify({ raw: b64url(parts.join('\r\n')) }) });
}
const fmtWhen = (ms, lang) => new Intl.DateTimeFormat(lang === 'so' ? 'so' : 'en', { timeZone: RULES.tzId, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(ms) + ' · ' + RULES.tzName;
// ---- WhatsApp chat popup + ready-made messages (editable in Dashboard → Settings → WhatsApp) ----
const WA_DEFAULTS = {
  popup: true, delay: 8,
  greeting: { en: 'Hi, I’m Eng Yuyu. Need help with tech, social media or growing online? Book a 1:1 session, or message me here and I’ll help you choose.', so: 'Salaan, waxaan ahay Eng Yuyu. Ma u baahan tahay caawimaad tiknoolajiyad, baraha bulshada ama koboc online? Ballan qabso kulan 1:1, ama halkan iigu soo qor si aan kuu caawiyo inaad doorato.' },
  reply: { en: 'Usually replies within a few hours', so: 'Badanaa wuu ka jawaabaa dhowr saacadood gudahood' },
  book: { en: 'Hello Eng Yuyu, I’d like to book {session} {price}. Can you help me choose a time?', so: 'Salaan Eng Yuyu, waxaan rabaa inaan ballan qabsado {session} {price}. Ma iga caawin kartaa inaan doorto waqti?' },
  ask: { en: 'Hello Eng Yuyu, I have a question:', so: 'Salaan Eng Yuyu, su’aal ayaan qabaa:' },
  share: { en: 'Book your {session} with Eng Yuyu here: {link}', so: 'Halkan ka ballan qabso {session} la leh Eng Yuyu: {link}' },
};
const waCfg = () => { const w = settings.wa || {}, pick2 = k => ({ en: (w[k] && w[k].en) || WA_DEFAULTS[k].en, so: (w[k] && w[k].so) || WA_DEFAULTS[k].so }); return { number: settings.whatsapp || '', popup: w.popup !== undefined ? !!w.popup : WA_DEFAULTS.popup, delay: Number.isFinite(+w.delay) ? +w.delay : WA_DEFAULTS.delay, greeting: pick2('greeting'), reply: pick2('reply'), book: pick2('book'), ask: pick2('ask'), share: pick2('share') }; };
const mails = require('./lib/mail')({ SITE_URL, OWNER, fmtWhen, RULES, copyOverrides: () => settings.emailCopy });   // branded email templates (server/lib/mail.js)
function icsFor(o, s, meet) {
  const z = ms => new Date(ms).toISOString().replace(/[-:]|\.\d{3}/g, '');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Eng Yuyu//Booking//EN', 'METHOD:REQUEST', 'BEGIN:VEVENT', `UID:${o.id}@engyuyu.com`, `DTSTAMP:${z(Date.now())}`, `DTSTART:${z(o.start)}`, `DTEND:${z(o.start + s.min * 60e3)}`,
    `SUMMARY:${s.title.en} with Eng Yuyu`, `DESCRIPTION:Join: ${meet}`, `LOCATION:${meet}`, `URL:${meet}`, `ORGANIZER;CN=Eng Yuyu:mailto:${OWNER()}`, `ATTENDEE;CN=${o.name.replace(/[;:,"]/g, ' ')};RSVP=FALSE:mailto:${o.email}`, 'STATUS:CONFIRMED', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}
function approvalMail(o, s, meet) { const m = mails.confirmed(o, s, meet); if (o.test) m.subject = '[TEST] ' + m.subject; return m; }   // confirmation + receipt

// ---- slots ----
function candidateDays(s) {
  const out = [], min = Date.now() + RULES.minNoticeHours * 3600e3;
  for (let i = 0; i < RULES.horizonDays; i++) {
    const e = new Date(Date.now() + i * 864e5 + RULES.tz * 3600e3);       // Mogadishu wall-clock
    if (!RULES.days.includes(e.getUTCDay())) continue;
    const y = e.getUTCFullYear(), m = e.getUTCMonth(), d = e.getUTCDate(), slots = [];
    for (let mins = RULES.start * 60; mins + s.min <= RULES.end * 60; mins += RULES.step) {
      const start = Date.UTC(y, m, d, 0, mins - RULES.tz * 60);
      if (start >= min) slots.push(start);
    }
    if (slots.length) out.push({ key: `${y}-${m}-${d}`, slots });
  }
  return out;
}
async function freeDays(s, ignoreOrder, skipNotice) {
  let days = candidateDays(s);
  if (skipNotice) days = candidateDaysNoNotice(s);
  if (!days.length) return [];
  const first = days[0].slots[0], last = days[days.length - 1].slots.slice(-1)[0] + s.min * 60e3;
  const busy = (await busyBetween(first, last)).filter(b => !ignoreOrder || b[2] !== ignoreOrder);
  return days.map(d => ({ key: d.key, slots: d.slots.filter(st => !busy.some(b => st < b[1] && st + s.min * 60e3 > b[0])) })).filter(d => d.slots.length);
}
function candidateDaysNoNotice(s) { const keep = RULES.minNoticeHours; RULES.minNoticeHours = -1e6; try { return candidateDays(s); } finally { RULES.minNoticeHours = keep; } }   // for late payments: only the rules matter, not the notice window

// ---- Sifalo Pay (see server/lib/payments.js) ----
async function sifaloStart(order) {
  order.payMode = payments.mode(); order.test = order.payMode === 'test' || undefined; save();
  if (order.payMode === 'mock') return { checkoutUrl: `${PUBLIC_API}/mock-pay?order_id=${order.id}` };
  if (order.payMode === 'test') return { checkoutUrl: `${SITE_URL}/pay/test?order_id=${order.id}` };
  return payments.startCheckout(order.payMode, order.amount, `${SITE_URL}/consulting.html?order_id=${order.id}`, `${(ENV.PUBLIC_API_URL || SITE_URL).replace(/\/$/, '')}/api/pay/webhook`);
}
async function sifaloVerify(body, o) {   // body: { sid } or { order_id }
  const m = (o && o.payMode) || payments.mode();
  if (m === 'mock') return body.sid && String(body.sid).startsWith('MOCK-') ? { status: 'success', code: 601, sid: body.sid, amount: String(orders[Object.keys(orders).find(k => orders[k].sidMock === body.sid)]?.amount || ''), currency: 'USD', payment_type: 'EDAHAB' } : { status: 'pending', code: 603 };
  if (m === 'test') return o && o.testPay && (!body.sid || body.sid === o.testPay.sid) ? o.testPay : { status: 'pending', code: 603 };
  return payments.verify(m === 'sandbox' ? 'sandbox' : 'live', body);
}

// ---- fulfilment (always called inside the lock) ----
async function fulfil(o, pay) {
  const s = SESSIONS[o.session];
  if (o.status === 'paid' || o.status === 'confirmed') return o;
  const ok = (await freeDays(s, o.id, true)).some(d => d.slots.includes(o.start));     // is the slot still free of other bookings?
  if (!ok) {
    o.status = 'paid_conflict'; o.sid = pay.sid; save();
    await sendMail({ to: OWNER(), subject: `⚠ Paid but slot taken. ${o.name}`, text: `Order ${o.id}\n${o.name} <${o.email}> paid $${o.amount} (sid ${pay.sid}) for ${fmtWhen(o.start, 'en')} but the slot is no longer free. Please rebook or refund.`, html: `<p>Order ${esc(o.id)}<br>${esc(o.name)} &lt;${esc(o.email)}&gt; paid $${esc(o.amount)} (sid ${esc(pay.sid)}) for ${esc(fmtWhen(o.start, 'en'))} but the slot is no longer free. Please rebook or refund.</p>` }).catch(console.error);
    await sendMail({ to: o.email, ...mails.conflict(o, s) }).catch(console.error);
    return o;
  }
  o.sid = pay.sid || o.sid; o.payType = pay.payment_type || o.payType;
  let ev = { meet: '', eventId: '' };
  try { ev = await createEvent(s, o); } catch (e) { console.error('calendar event failed', e.message); try { admin.log('booking', `Calendar event / Meet link could not be created for ${o.name}: is Google connected?`); } catch { /* ignore */ } }
  o.meet = ev.meet; o.eventId = ev.eventId; o.status = pay.sid ? 'paid' : 'confirmed'; o.paidAt = Date.now(); save();
  try { admin.log('booking', `${pay.sid ? 'Paid' : 'New'} booking: ${s.title.en}: ${o.name} ($${o.amount})`); } catch { /* admin not ready */ }
  const m = approvalMail(o, s, o.meet);
  await sendMail({ to: o.email, ...m, ics: icsFor(o, s, o.meet) }).catch(e => console.error('client email failed', e.message));
  await sendMail({ to: OWNER(), ...mails.ownerBooking(o, s) }).catch(e => console.error('owner email failed', e.message));
  return o;
}
async function checkPay(o, sid) {   // verify with Sifalo and fulfil when paid. returns 'paid' | 'pending' | 'failed'
  const v = await sifaloVerify(sid ? { sid } : { order_id: o.id }, o);
  const fail = () => {
    if (o.status === 'pending') { o.status = 'failed'; o.holdUntil = 0; save(); }
    if (!o.failMailed && SESSIONS[o.session]) { o.failMailed = Date.now(); save(); const m = mails.paymentFailed(o, SESSIONS[o.session]); if (o.test) m.subject = '[TEST] ' + m.subject; sendMail({ to: o.email, ...m }).catch(() => {}); }   // tell the client, once
    return 'failed';
  };   // release the held time at once
  if (v.status === 'success' && Number(v.code) === 601) {
    if (String(v.currency || 'USD').toUpperCase() !== 'USD' || Number(v.amount) < Number(o.amount)) return fail();      // amount must cover the price
    const dup = Object.values(orders).find(x => x.id !== o.id && x.sid && x.sid === v.sid);                                // a payment can only be used once
    if (dup) return fail();
    await fulfil(o, { sid: v.sid || sid, payment_type: v.payment_type });
    return 'paid';
  }
  if (v.status === 'pending' || Number(v.code) === 603) return 'pending';
  return v.status === 'failed' || [600, 604].includes(Number(v.code)) ? fail() : 'pending';   // anything unclear stays pending and is re-checked
}

// ---- background reconcile (Sifalo has no webhooks) ----
let lock = Promise.resolve();
const locked = fn => (lock = lock.then(fn, fn));
setInterval(() => locked(async () => {
  for (const o of Object.values(orders)) {
    if (o.status !== 'pending' && !(o.status === 'failed' && o.payMode && o.payMode !== 'mock')) continue;
    if (Date.now() - o.createdAt > LATE_PAY_MS) { if (o.status === 'pending') { o.status = 'expired'; save(); } continue; }
    try { if ((!MOCK || o.payMode === 'sandbox' || o.payMode === 'test') && await checkPay(o) === 'paid') console.log('reconciled', o.id); } catch (e) { console.error('reconcile', o.id, e.message); }
  }
}).catch(console.error), 30e3).unref();

// ---- http ----
const EMAIL_RE = /^[A-Za-z0-9._%+'-]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
const isEmail = e => typeof e === 'string' && e.length <= 254 && EMAIL_RE.test(e);
const clientIp = req => ENV.TRUST_PROXY === '1' ? (String(req.headers['x-forwarded-for'] || '').split(',').pop().trim() || req.socket.remoteAddress) : req.socket.remoteAddress;   // behind a proxy (Render, Fly, Nginx…) use the address the proxy appended
const hits = new Map();
setInterval(() => { const now = Date.now(); for (const [k, a] of hits) if (!a.some(t => now - t < 3600e3)) hits.delete(k); }, 10 * 60e3).unref();
const limited = (ip, max = 12) => { const now = Date.now(), a = (hits.get(ip) || []).filter(t => now - t < 3600e3); a.push(now); hits.set(ip, a); return a.length > max; };
function send(res, code, body, origin) {
  const allow = ORIGINS.includes('*') ? '*' : (ORIGINS.includes(origin) ? origin : ORIGINS[0]);
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': allow, 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', Vary: 'Origin' });
  res.end(JSON.stringify(body));
}
const readJson = req => new Promise((ok, no) => { let b = ''; req.on('data', c => { b += c; if (b.length > 80e3) { req.destroy(); no(new Error('too large')); } }); req.on('end', () => { try { ok(JSON.parse(b || '{}')); } catch (e) { no(e); } }); });
const pub = o => ({ status: o.status, meet: o.status === 'paid' || o.status === 'confirmed' ? o.meet : undefined, session: o.session, start: o.start, ref: o.id.slice(0, 8).toUpperCase() });

const ctx = { waCfg, WA_DEFAULTS, mails, isEmail, clientIp, sessionList, rebuildSessions, cancelEvent, ENV, MOCK, store, settings, orders, saveOrders: save, SESSIONS, RULES, OWNER, sendMail, fulfil, locked, approvalMail, fmtWhen, esc, applySettings, freeDays, send, readJson, limited, payments, PAYMENT_REQUIRED: undefined, SITE_URL, HOLD_MIN, mockOutbox, checkPay };
const admin = require('./modules/admin')(ctx);
ctx.admin = admin;
const blog = require('./modules/blog')(ctx);
ctx.writers = require('./modules/writers')(ctx);   // guest writers: own login, review workflow
ctx.automations = require('./modules/automations')(ctx);

// ---- the website itself (so the blog, the pages and the API live on ONE address: good for SEO and sharing) ----
const ROOT = path.join(__dirname, '..', 'public');   // the website: pages, bundles and assets
try { const b = require('../src/build').build(); if (b.length) console.log('Built', b.join(', ')); } catch { /* deployed without /src: public/ is already built */ }
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.otf': 'font/otf', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
const PAGES = { '/': 'index.html', '/index.html': 'index.html', '/about.html': 'about.html', '/consulting.html': 'consulting.html', '/events.html': 'events.html', '/privacy.html': 'privacy.html', '/terms.html': 'terms.html' };
function serveSite(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  let rel = PAGES[url.pathname] || (url.pathname === '/favicon.ico' ? 'assets/favicon-48.png' : '');   // browsers ask for /favicon.ico by default
  if (!rel) { if (['/styles.css', '/app.js', '/blog.js'].includes(url.pathname) || /^\/assets\/[\w./ -]+$/.test(url.pathname) && !url.pathname.includes('..')) rel = url.pathname.slice(1); else return false; }
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep)) return false;
  try {
    let body = fs.readFileSync(file); const ext = path.extname(file);
    if (ext === '.html') body = Buffer.from(body.toString().replace('<body data-page=', '<body data-api="" data-page='));   // same-origin API: forms, booking, analytics just work
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': ['.html', '.js', '.css'].includes(ext) ? 'no-cache' : 'public, max-age=86400' });
    res.end(body); return true;
  } catch { return false; }
}
// ---- security headers (every response). The CSP allows only this site, YouTube's privacy player and the page's own inline theme script (by hash). ----
const inlineHashes = [...new Set(fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).flatMap(f => [...fs.readFileSync(path.join(ROOT, f), 'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => "'sha256-" + crypto.createHash('sha256').update(m[1]).digest('base64') + "'")))];
const SEC_HEADERS = {
  'Content-Security-Policy': ["default-src 'self'", "script-src 'self' " + inlineHashes.join(' '), "style-src 'self' 'unsafe-inline'", "img-src 'self' data: https:", "font-src 'self' data:", "connect-src 'self'", 'frame-src https://www.youtube-nocookie.com https://www.youtube.com', "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"].join('; '),
  'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()', 'Cross-Origin-Opener-Policy': 'same-origin',
};
const srv = http.createServer(async (req, res) => {
  req.clientIp = clientIp(req);
  for (const [k, v] of Object.entries(SEC_HEADERS)) res.setHeader(k, v);
  if (ENV.SECURE_COOKIES === '1' || req.headers['x-forwarded-proto'] === 'https') res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  const origin = req.headers.origin, url = new URL(req.url, 'http://x'), ip = req.clientIp;
  if (req.method === 'OPTIONS') return send(res, 204, {}, origin);
  try {
    if (url.pathname === '/api/cron' && ENV.CRON_SECRET) {   // Vercel Cron: the background jobs that normally run on timers
      if (req.headers.authorization !== 'Bearer ' + ENV.CRON_SECRET) return send(res, 401, { error: 'Not allowed' }, origin);
      const out = {}; for (const [k, f] of [['reminders', () => ctx.automations.runReminders()], ['followUps', () => ctx.automations.runFollowUps()], ['digest', () => ctx.automations.runDigest()], ['writers', () => ctx.writers.runReminders()]]) { try { out[k] = await f(); } catch (e) { out[k] = 'failed: ' + e.message; } }
      return send(res, 200, { ok: true, ran: Object.keys(out) }, origin);
    }
    if (url.pathname === '/api/health') return send(res, 200, { ok: true, mock: MOCK, paymentRequired: payments.required(), payMode: payments.mode(), database: store.remote ? 'supabase' : 'local files (not saved long-term)', admin: ctx.adminInfo ? ctx.adminInfo() : undefined }, origin);
    if (url.pathname === '/api/config') return send(res, 200, { paymentRequired: payments.required(), payMode: payments.mode(), currency: 'USD', holdMinutes: HOLD_MIN, tz: RULES.tzId, availability: { days: RULES.days, start: RULES.start, end: RULES.end, step: RULES.step, minNoticeHours: RULES.minNoticeHours, horizonDays: RULES.horizonDays }, sessions: Object.fromEntries(Object.entries(SESSIONS).filter(([, x]) => !x.legacy).map(([id, x]) => [id, { min: x.min, price: x.price, enabled: x.enabled !== false }])), sessionList: sessionList().filter(x => x.enabled !== false), whatsapp: settings.whatsapp || '', wa: (({ number, ...rest }) => rest)(waCfg()), introVideo: settings.introVideo || '' }, origin);
    if (MOCK && url.pathname === '/api/mock-outbox') return send(res, 200, mockOutbox, origin);
    if (MOCK && url.pathname === '/mock-pay') {   // stands in for Sifalo's hosted checkout while testing
      const o = orders[url.searchParams.get('order_id')];
      if (!o) { res.writeHead(404); return res.end('no order'); }
      o.sidMock = 'MOCK-' + crypto.randomBytes(4).toString('hex'); save();
      res.writeHead(302, { Location: `${SITE_URL}/consulting.html?order_id=${o.id}&sid=${o.sidMock}${ENV.MOCK_RETURN_QS || ''}` }); return res.end();
    }
    // ---- short booking links to share (WhatsApp, social bio, posters): /book and /book/<session> ----
    const bk = url.pathname.match(/^\/book(?:\/([a-z0-9-]{2,24}))?\/?$/);
    if (bk && (req.method === 'GET' || req.method === 'HEAD')) {
      const sid = bk[1] && SESSIONS[bk[1]] && !SESSIONS[bk[1]].legacy && SESSIONS[bk[1]].enabled !== false ? bk[1] : '';
      const q = new URLSearchParams(); if (sid) q.set('session', sid); if (url.searchParams.get('lang') === 'so') q.set('lang', 'so'); q.set('utm_source', url.searchParams.get('src') || 'link');
      res.writeHead(302, { Location: `/consulting.html?${q}#book`, 'Cache-Control': 'no-store' }); res.end(); return;
    }
    // ---- built-in TEST checkout (payment mode "test"): no money moves; only the signed-in owner can approve ----
    if (url.pathname === '/pay/test' || url.pathname === '/pay/test/done') {
      const o = orders[String(url.searchParams.get('order_id') || '')];
      const page = (title, body, refresh) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' }); res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">${refresh ? `<meta http-equiv="refresh" content="${refresh}">` : ''}<title>${esc(title)}: Test checkout</title><link rel="icon" href="/assets/favicon-32.png"><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#06111F;color:#EAF2FF;font:16px/1.5 system-ui,-apple-system,Roboto,sans-serif;padding:20px}.c{width:min(440px,100%);background:#0B1F3A;border:1px solid #23395c;border-radius:20px;padding:28px}.t{display:inline-block;padding:4px 10px;border-radius:99px;background:#ffb020;color:#1b1200;font-weight:800;font-size:12px;letter-spacing:.08em}h1{font-size:22px;margin:14px 0 6px}p{color:#a9bad6;margin:6px 0}.amt{font-size:34px;font-weight:900;color:#fff;margin:10px 0}.b{display:block;text-align:center;padding:14px;border-radius:99px;font-weight:700;text-decoration:none;margin-top:10px}.ok{background:#006AFF;color:#fff}.no{border:1px solid #39537c;color:#EAF2FF}small{color:#7f93b3}</style></head><body><main class="c"><span class="t">TEST MODE · NO REAL MONEY</span>${body}</main></body></html>`); return true; };
      if (!o || o.payMode !== 'test') return page('Not found', '<h1>This test payment is not available</h1><p>The booking was not made in test mode, or it no longer exists.</p>');
      if (o.status !== 'pending') return page('Already handled', `<h1>Already handled</h1><p>This test booking is <b>${esc(o.status)}</b>.</p><a class="b ok" href="${esc(SITE_URL)}/consulting.html?order_id=${o.id}${o.testPay ? '&sid=' + o.testPay.sid : ''}">Back to the booking page</a>`);
      if (!admin.authed(req)) return page('Sign in to approve', `<h1>Owner approval needed</h1><p>Test payments can only be approved by the site owner while signed in to the dashboard, so nobody can book for free while test mode is on.</p><a class="b ok" href="/admin" target="_blank" rel="noopener">Sign in to the dashboard</a><a class="b no" href="?order_id=${o.id}">I have signed in, refresh</a>`);
      const sig = k => crypto.createHmac('sha256', store.load('secret', {}).value || 'x').update(o.id + ':' + k).digest('hex').slice(0, 24);
      if (url.pathname === '/pay/test/done') {
        const k = url.searchParams.get('outcome');
        if (!['success', 'failed', 'pending', 'cancel'].includes(k) || url.searchParams.get('t') !== sig(k)) return page('Invalid', '<h1>That link is not valid</h1>');
        if (k === 'cancel') { res.writeHead(302, { Location: `${SITE_URL}/consulting.html?order_id=${o.id}` }); res.end(); return; }   // like closing the checkout without paying
        const sid = (o.testPay && o.testPay.sid) || 'TEST-' + crypto.randomBytes(5).toString('hex').toUpperCase();   // same payment reference when a pending payment is approved later (like Sifalo)
        o.testPay = k === 'success' ? { status: 'success', code: 601, sid, amount: String(o.amount), currency: 'USD', payment_type: 'TEST' } : k === 'pending' ? { status: 'pending', code: 603, sid } : { status: 'failed', code: 600, sid };
        save(); try { admin.log('booking', `Test payment ${k} for ${o.name} ($${o.amount})`); } catch { /* ignore */ }
        res.writeHead(302, { Location: `${SITE_URL}/consulting.html?order_id=${o.id}&sid=${sid}` }); res.end(); return;
      }
      const s0 = SESSIONS[o.session], go = k => `/pay/test/done?order_id=${o.id}&outcome=${k}&t=${sig(k)}`;
      return page('Choose an outcome', `<h1>${esc(s0 ? s0.title.en : o.session)}</h1><p>${esc(o.name)} · ${esc(fmtWhen(o.start, 'en'))}</p><p class="amt">$${esc(o.amount)}</p><p>This is a simulated payment for testing the whole booking process. <b>Choose what happens:</b></p><a class="b ok" href="${go('success')}">Approve payment</a><a class="b no" href="${go('failed')}">Decline (payment fails)</a><a class="b no" href="${go('pending')}">Leave pending (waiting for approval)</a><a class="b no" href="${go('cancel')}">Cancel and go back (client closes checkout)</a><p><small>A pending test payment can be approved later by opening this page again. Turn test mode off in Dashboard → Settings → Payments before you go live.</small></p>`);
    }
    // ---- Sifalo webhook: never trusted on its own, the payment is always re-checked with verify.php ----
    if (url.pathname === '/api/pay/webhook' && req.method === 'POST') {
      let b = {}; try { b = await readJson(req); } catch { /* ignore */ }
      send(res, 200, { ok: true }, origin);
      const o = b.order_id && orders[String(b.order_id)];
      if (o && o.status === 'pending') locked(() => checkPay(o, b.sid ? String(b.sid).slice(0, 120) : undefined)).catch(e => console.error('webhook', e.message));
      else if (b.sid) locked(async () => { for (const x of Object.values(orders)) if (x.status === 'pending' && ['sandbox', 'live'].includes(x.payMode) && Date.now() - x.createdAt < LATE_PAY_MS) await checkPay(x).catch(() => {}); }).catch(() => {});
      return;
    }
    if (url.pathname === '/api/slots' && req.method === 'GET') {
      const s = SESSIONS[url.searchParams.get('session')];
      if (!s || s.enabled === false) return send(res, 400, { error: 'unknown session' }, origin);
      return send(res, 200, { tz: RULES.tzId, days: await freeDays(s) }, origin);
    }
    if (url.pathname === '/api/order' && req.method === 'GET') {
      const o = orders[url.searchParams.get('id')];
      if (!o) return send(res, 404, { error: 'not found' }, origin);
      return send(res, 200, pub(o), origin);
    }
    if (url.pathname === '/api/book' && req.method === 'POST') {
      if (limited(ip + 'book', 30)) return send(res, 429, { error: 'Too many booking attempts. Please wait a few minutes.' }, origin);
      const b = await readJson(req), s = SESSIONS[b.session];
      if (s && s.enabled === false) return send(res, 400, { error: 'This session is not available.' }, origin);
      if (b.agree !== true) return send(res, 400, { error: 'Please confirm you understand these sessions are advice only.' }, origin);
      const name = String(b.name || '').trim().slice(0, 80), email = String(b.email || '').trim().slice(0, 120), note = String(b.note || '').trim().slice(0, 1000), start = Number(b.start);
      if (!s || !name || !isEmail(email) || !Number.isFinite(start)) return send(res, 400, { error: 'Invalid request.' }, origin);
      const out = await locked(async () => {
        if (!(await freeDays(s)).some(d => d.slots.includes(start))) return { taken: true };     // rules + live calendar + other people's holds
        const o = { id: crypto.randomBytes(16).toString('hex'), session: b.session, start, name, email, note, lang: b.lang === 'so' ? 'so' : 'en', amount: s.price, status: 'pending', createdAt: Date.now(), holdUntil: Date.now() + HOLD_MIN * 60e3 };
        orders[o.id] = o; save();
        if (!payments.required()) { await fulfil(o, {}); return { ok: true, meet: o.meet, status: o.status }; }   // only when payments are not linked yet (testing)
        try { const p = await sifaloStart(o); return { ok: true, checkoutUrl: p.checkoutUrl, orderId: o.id, holdMinutes: HOLD_MIN }; }
        catch (e) { console.error(e.message); try { admin.log('payment', 'Checkout could not start: ' + e.message); } catch { /* ignore */ } delete orders[o.id]; save(); return { payFail: true }; }
      });
      if (out.taken) return send(res, 409, { error: 'That time is no longer available. Please pick another.' }, origin);
      if (out.payFail) return send(res, 502, { error: 'Payment provider unavailable. Please try again.' }, origin);
      return send(res, 200, out, origin);
    }
    if (url.pathname === '/api/release' && req.method === 'POST') {   // the client gave up on this payment, free the held time (after one last check)
      if (limited(ip + 'rel', 30)) return send(res, 429, { error: 'Too many requests.' }, origin);
      const b = await readJson(req), o = orders[String(b.orderId || '')];
      if (!o) return send(res, 404, { error: 'Order not found.' }, origin);
      const out = await locked(async () => {
        if (o.status !== 'pending') return o.status;
        if (o.payMode === 'sandbox' || o.payMode === 'live') { const st = await checkPay(o).catch(() => 'pending'); if (st === 'paid') return 'paid'; }
        if (o.status === 'pending') { o.status = 'cancelled'; o.holdUntil = 0; save(); }
        return o.status;
      });
      return send(res, 200, { status: out }, origin);
    }
    if (url.pathname === '/api/confirm' && req.method === 'POST') {
      if (limited(ip, 60)) return send(res, 429, { error: 'Too many requests.' }, origin);
      const b = await readJson(req), o = orders[String(b.orderId || '')];
      if (!o) return send(res, 404, { error: 'Order not found.' }, origin);
      if (o.status === 'paid' || o.status === 'confirmed') return send(res, 200, pub(o), origin);       // idempotent
      if (o.status === 'paid_conflict') return send(res, 200, pub(o), origin);
      const state = await locked(async () => (o.status === 'paid' ? 'paid' : checkPay(o, b.sid ? String(b.sid).slice(0, 120) : undefined)));
      if (state === 'paid') return send(res, 200, pub(o), origin);
      return send(res, 200, { status: state, ref: o.id.slice(0, 8).toUpperCase(), session: o.session, start: o.start }, origin);
    }
    if (await ctx.writers.handle(req, res, url)) return;
    if (await blog.handle(req, res, url, origin)) return;
    if (await admin.handle(req, res, url, origin)) return;
    if (serveSite(req, res, url)) return;
    send(res, 404, { error: 'not found' }, origin);
  } catch (e) { console.error(e); send(res, 500, { error: 'Server error' }, origin); }
});
srv.requestTimeout = 30e3; srv.headersTimeout = 15e3; srv.keepAliveTimeout = 5e3; srv.maxHeadersCount = 60;
if (process.env.VERCEL) module.exports = srv;   // on Vercel api/index.js feeds requests to this server; nothing listens on a port
else srv.listen(PORT, () => console.log(`Booking API on :${PORT} · payment ${payments.required() ? 'REQUIRED' + (MOCK ? ' (MOCK)' : '') : 'not linked: bookings are free'}${MOCK ? ' · MOCK mode' : ''}`));
