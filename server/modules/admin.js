// Dashboard backend + public site APIs (content, stats, newsletter, contact, analytics).
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

module.exports = function (ctx) {
  const { sessionList, ENV, MOCK, store, settings, orders, SESSIONS, RULES, OWNER, sendMail, fulfil, locked, approvalMail, fmtWhen, esc, applySettings, readJson, limited } = ctx;
  const P = () => ctx.payments;   // Sifalo Pay settings (server/lib/payments.js)
  const payLinked = () => { const m = P().mode(); return MOCK ? 'mock' : m === 'test' ? 'test' : (m === 'sandbox' || m === 'live') && P().ready(); };
  const DAY = 864e5, EAT = 3 * 3600e3;
  const PUBLIC_API = (ENV.PUBLIC_API_URL || `http://localhost:${+ENV.PORT || 8787}`).replace(/\/$/, '');
  const ORIGINS = (ENV.ALLOWED_ORIGIN || '*').split(',').map(s => s.trim());

  // ---------- data ----------
  const secret = store.load('secret', { value: crypto.randomBytes(32).toString('hex') });
  store.save('secret');
  const subscribers = store.load('subscribers', []);
  const messages = store.load('messages', []);
  const analytics = store.load('analytics', { days: {} });
  const activity = store.load('activity', []);
  const stats = store.load('stats', { current: { youtube: 420000, facebook: 380000, tiktok: 150000, instagram: 110000, views: 120000000 }, source: 'sample', updatedAt: Date.now(), history: [] });
  let defaults = {}; try { defaults = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'content-defaults.json'), 'utf8')); } catch { /* run extract-defaults.js */ }
  if (!MOCK) { defaults.events = []; defaults.posts = []; }   // the real site starts without the demo events and demo post cards
  const content = store.load('content', defaults);
  for (const k of ['proof', 'testimonials', 'media', 'ads']) if (!Array.isArray(content[k])) { content[k] = defaults[k] || []; store.save('content'); }   // older stores get the new sections too
  const uid = () => crypto.randomBytes(6).toString('hex');
  for (const k of ['posts', 'events']) (content[k] || []).forEach(x => { if (!x.id) x.id = uid(); });
  const log = (type, text) => { activity.unshift({ t: Date.now(), type, text }); activity.length = Math.min(activity.length, 300); store.save('activity'); };
  const dayKey = ms => new Date(ms + EAT).toISOString().slice(0, 10);

  // ---------- http helpers ----------
  const json = (res, code, body, extra = {}) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra }); res.end(JSON.stringify(body)); };
  const text = (res, code, body, type, extra = {}) => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', ...extra }); res.end(body); };
  const pubJson = (res, code, body, origin) => ctx.send(res, code, body, origin);
  const validEmail = e => ctx.isEmail(e || '');
  const clean = (s, n) => String(s == null ? '' : s).trim().slice(0, n);
  const csv = rows => rows.map(r => r.map(c => { c = String(c ?? ''); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(',')).join('\n');

  // ---------- auth ----------
  const sha = s => crypto.createHash('sha256').update(String(s)).digest();
  let PASSWORD = ENV.ADMIN_PASSWORD || (MOCK ? 'demo' : '');
  if (!MOCK && PASSWORD && PASSWORD.length < 12) { console.error('ADMIN_PASSWORD is too short (needs at least 12 characters), dashboard disabled.'); PASSWORD = ''; }
  const auth = store.load('auth', { hash: '', epoch: 0, resets: [] });   // password set via "forgot password" / Settings overrides ADMIN_PASSWORD
  const sha256hex = s => crypto.createHash('sha256').update(String(s)).digest('hex');
  const hashPw = pw => { const salt = crypto.randomBytes(16); return 'scrypt$' + salt.toString('hex') + '$' + crypto.scryptSync(pw, salt, 64).toString('hex'); };
  const checkPw = pw => {
    pw = String(pw || '');
    if (auth.hash) { const [, s, h] = auth.hash.split('$'); return crypto.timingSafeEqual(crypto.scryptSync(pw, Buffer.from(s, 'hex'), 64), Buffer.from(h, 'hex')); }
    return !!PASSWORD && crypto.timingSafeEqual(sha(pw), sha(PASSWORD));
  };
  // sign-in username: set in Settings > Security (saved in the database), otherwise ADMIN_USERNAME, otherwise "admin"
  const normUser = s => String(s || '').trim().toLowerCase();
  const userName = () => normUser(auth.username) || normUser(ENV.ADMIN_USERNAME) || 'admin';
  const checkUser = u => crypto.timingSafeEqual(sha(normUser(u)), sha(userName()));
  const enabled = () => !!PASSWORD || !!auth.hash;
  // safe status for /api/health (no secrets): why the dashboard is on or off
  ctx.adminInfo = () => ({ enabled: enabled(), ...(enabled() ? {} : { reason: ENV.ADMIN_PASSWORD ? (ENV.ADMIN_PASSWORD.length < 12 ? 'ADMIN_PASSWORD is shorter than 12 characters' : 'unknown') : 'ADMIN_PASSWORD is not set' }) });

  // ---- two-step verification (TOTP, RFC 6238: works with Google Authenticator, Microsoft Authenticator, Authy, 1Password …) ----
  const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const b32enc = buf => { let bits = '', out = ''; for (const x of buf) bits += x.toString(2).padStart(8, '0'); for (let i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)]; return out; };
  const b32dec = str => { let bits = ''; for (const c of String(str).replace(/=+$/, '').toUpperCase()) bits += B32.indexOf(c).toString(2).padStart(5, '0'); const out = []; for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(out); };
  const hotp = (secret, counter) => { const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(counter)); const h = crypto.createHmac('sha1', b32dec(secret)).update(c).digest(), o = h[19] & 15; return String(((h[o] & 127) << 24 | h[o + 1] << 16 | h[o + 2] << 8 | h[o + 3]) % 1e6).padStart(6, '0'); };
  const totpStep = () => Math.floor(Date.now() / 30000);
  const totpCheck = (secret, code) => { code = String(code || '').replace(/\s/g, ''); if (!/^\d{6}$/.test(code)) return 0; for (let d = -1; d <= 1; d++) { const st = totpStep() + d; if (crypto.timingSafeEqual(Buffer.from(hotp(secret, st)), Buffer.from(code))) return st; } return 0; };
  const twoOn = () => !!(auth.totp && auth.totp.on);
  const anyOn = () => twoOn() || !!auth.mfaEmail;
  const methods = () => [twoOn() && 'app', auth.mfaEmail && 'email'].filter(Boolean);
  const recHash = c => sha256hex('yy-recovery:' + String(c).toLowerCase().replace(/[^a-z0-9]/g, ''));
  const maskEmail = e => String(e).replace(/^(.).*(@.*)$/, '$1•••$2');
  const maskPhone = p => String(p).replace(/.(?=.{3})/g, '•');
  const newRecovery = () => { const codes = Array.from({ length: 8 }, () => { const x = crypto.randomBytes(5).toString('hex'); return x.slice(0, 5) + '-' + x.slice(5); }); auth.rec = codes.map(recHash); return codes; };
  const otpHash = c => sha256hex('yy-otp:' + String(c));
  // a one-time code sent by email (10 minutes, 5 tries)
  async function sendOtp(via, phone) {
    const code = String(crypto.randomInt(0, 1e6)).padStart(6, '0');
    auth.otp = { h: otpHash(code), exp: Date.now() + 10 * 60e3, tries: 0, via, phone: phone || '' }; store.save('auth');
    { const bl = ctx.mails.blocks; await sendMail({ to: OWNER(), subject: 'Your dashboard sign-in code', ...ctx.mails.layout('en', { pre: 'Your sign-in code is ' + code, title: 'Your sign-in code', blocks: [bl.p('Use this code to finish signing in to your Eng Yuyu dashboard. It expires in <b>10 minutes</b>.'), bl.p('<b style="font-size:30px;letter-spacing:8px">' + code + '</b>'), bl.small('Did not try to sign in? Someone knows your password, change it right away and never share this code.')] }) }); }
  }
  const otpCheck = code => { const o = auth.otp; if (!o || o.exp < Date.now() || o.tries >= 5) return false; o.tries++; const ok = crypto.timingSafeEqual(Buffer.from(otpHash(String(code || '').replace(/\s/g, ''))), Buffer.from(o.h)); if (ok) { auth.otp = null; } store.save('auth'); return ok; };
  // true when the code is a valid current authenticator code (never reusable) or an unused recovery code
  function secondFactor(code) {
    if (!anyOn()) return true;
    const t = auth.totp; if (t && t.on) { const st = totpCheck(t.secret, code); if (st && st > (t.last || 0)) { t.last = st; store.save('auth'); return true; } }
    if (auth.otp && otpCheck(code)) return true;
    const h = recHash(code), i = (auth.rec || []).indexOf(h); if (String(code || '').replace(/[^a-z0-9]/gi, '').length === 10 && i >= 0) { auth.rec.splice(i, 1); store.save('auth'); log('security', 'A recovery code was used to sign in (' + auth.rec.length + ' left)'); return true; }
    return false;
  }
  const strongPw = pw => typeof pw === 'string' && pw.length >= 12 && pw.length <= 200;
  const sign = p => { const b = Buffer.from(JSON.stringify(p)).toString('base64url'); return b + '.' + crypto.createHmac('sha256', secret.value).update(b).digest('base64url'); };
  function verify(tok) {
    if (!tok || !tok.includes('.')) return null;
    const [b, sig] = tok.split('.'), good = crypto.createHmac('sha256', secret.value).update(b).digest('base64url');
    if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
    try { const p = JSON.parse(Buffer.from(b, 'base64url').toString()); return p.exp > Date.now() && (p.e || 0) === auth.epoch ? p : null; } catch { return null; }
  }
  const cookie = req => Object.fromEntries((req.headers.cookie || '').split(';').map(c => c.trim().split('=')).filter(x => x[0]).map(([k, ...v]) => [k, v.join('=')]));
  const authed = req => !!verify(cookie(req).yy_admin);
  const secureFlag = req => (ENV.SECURE_COOKIES === '1' || req.headers['x-forwarded-proto'] === 'https') ? '; Secure' : '';
  if (!enabled()) console.warn('Admin dashboard disabled: set ADMIN_PASSWORD in server/.env (12+ characters)');

  // ---------- analytics ----------
  const PAGES = { '/': 'Home', '/index.html': 'Home', '/about.html': 'About', '/consulting.html': 'Consulting', '/events.html': 'Events & Media', '/privacy.html': 'Legal', '/terms.html': 'Legal' };
  function track(req, b) {
    const ua = String(req.headers['user-agent'] || '');
    if (/bot|crawl|spider|slurp|preview|headless/i.test(ua)) return;
    const now = Date.now(), k = dayKey(now), d = analytics.days[k] || (analytics.days[k] = { pv: 0, vis: [], pages: {}, refs: {}, langs: {}, dev: {}, ev: {} });
    const salt = crypto.createHash('sha256').update(secret.value + k).digest('hex');                       // rotates daily; no IPs or cookies stored
    const vid = crypto.createHash('sha256').update(salt + (req.clientIp || req.socket.remoteAddress || '') + ua).digest('hex').slice(0, 12);
    if (b.e) { const e = clean(b.e, 30).replace(/[^a-z0-9_-]/gi, ''); if (e) d.ev[e] = (d.ev[e] || 0) + 1; }
    else {
      d.pv++;
      if (!d.vis.includes(vid) && d.vis.length < 20000) d.vis.push(vid);
      const p = PAGES[clean(b.p, 60)] || 'Other'; d.pages[p] = (d.pages[p] || 0) + 1;
      let ref = 'Direct'; try { const h = new URL(b.r).hostname.replace(/^www\./, ''); if (h && !/engyuyu/.test(h) && h !== 'localhost') ref = h.slice(0, 40); } catch { /* none */ }
      d.refs[ref] = (d.refs[ref] || 0) + 1;
      const l = b.l === 'so' ? 'so' : 'en'; d.langs[l] = (d.langs[l] || 0) + 1;
      const w = +b.w || 0, dev = w && w < 640 ? 'mobile' : w && w < 1024 ? 'tablet' : 'desktop'; d.dev[dev] = (d.dev[dev] || 0) + 1;
    }
    const keys = Object.keys(analytics.days).sort(); while (keys.length > 400) delete analytics.days[keys.shift()];
    store.save('analytics');
  }

  // ---------- summary ----------
  const sumRev = list => list.reduce((a, o) => a + (o.sid ? Number(o.amount) || 0 : 0), 0);
  const pct = (a, b) => b ? Math.round((a - b) / b * 100) : (a ? null : 0);
  function trafficRange(from, to) {
    const out = { pv: 0, uv: 0, pages: {}, refs: {}, langs: {}, dev: {}, ev: {}, daily: [] };
    for (let t = from; t < to; t += DAY) {
      const d = analytics.days[dayKey(t)] || { pv: 0, vis: [], pages: {}, refs: {}, langs: {}, dev: {}, ev: {} };
      out.pv += d.pv; out.uv += d.vis.length; out.daily.push({ day: dayKey(t), pv: d.pv, uv: d.vis.length });
      for (const f of ['pages', 'refs', 'langs', 'dev', 'ev']) for (const [k, v] of Object.entries(d[f] || {})) out[f][k] = (out[f][k] || 0) + v;
    }
    return out;
  }
  function summary(range) {
    const now = Date.now(), from = now - range * DAY, prevFrom = from - range * DAY;
    const all = Object.values(orders), tOf = o => o.paidAt || o.createdAt;
    const paid = all.filter(o => (o.status === 'paid' || o.status === 'confirmed') && !o.test);   // test bookings never count as revenue
    const cur = paid.filter(o => tOf(o) >= from), prev = paid.filter(o => tOf(o) >= prevFrom && tOf(o) < from);
    const rev = sumRev(cur), revPrev = sumRev(prev);
    const upcoming = paid.filter(o => o.start > now).sort((a, b) => a.start - b.start);
    const attempts = all.filter(o => o.createdAt >= from && o.status !== 'cancelled' && !o.test);
    const paidAttempts = attempts.filter(o => ['paid', 'paid_conflict', 'confirmed'].includes(o.status)).length;
    const subsActive = subscribers.filter(s => !s.unsubscribed);
    const subsNew = subsActive.filter(s => s.createdAt >= from).length, subsPrev = subsActive.filter(s => s.createdAt >= prevFrom && s.createdAt < from).length;
    const tr = trafficRange(dayStart(from), dayStart(now) + DAY), trPrev = trafficRange(dayStart(prevFrom), dayStart(from));
    // weekly series (12 weeks)
    const weeks = [];
    for (let i = 11; i >= 0; i--) { const e = now - i * 7 * DAY, s = e - 7 * DAY, list = paid.filter(o => tOf(o) > s && tOf(o) <= e); weeks.push({ label: dayKey(s + DAY).slice(5), revenue: sumRev(list), bookings: list.length }); }
    // session mix
    const mix = Object.entries(SESSIONS).map(([id, s]) => { const l = paid.filter(o => o.session === id && tOf(o) >= from); return { id, title: s.title.en, count: l.length, revenue: sumRev(l) }; });
    // weekday of booked sessions (Mogadishu)
    const wd = [0, 0, 0, 0, 0, 0, 0]; paid.forEach(o => wd[new Date(o.start + EAT).getUTCDay()]++);
    // utilisation of next 14 days
    let capacity = 0; for (let i = 0; i < 14; i++) { const e = new Date(now + i * DAY + EAT); if (RULES.days.includes(e.getUTCDay())) capacity += Math.floor((RULES.end - RULES.start) * 60 / 60); }   // hourly blocks
    const booked14 = upcoming.filter(o => o.start < now + 14 * DAY).reduce((a, o) => a + SESSIONS[o.session].min / 60, 0);
    // attention + insights
    const attention = [];
    const stale = all.filter(o => o.status === 'pending' && now - o.createdAt > 3600e3);
    if (stale.length) attention.push({ tone: 'warn', text: `${stale.length} unpaid checkout${stale.length > 1 ? 's' : ''} older than 1 hour`, go: 'bookings', filter: 'pending' });
    const conflicts = all.filter(o => o.status === 'paid_conflict');
    if (conflicts.length) attention.push({ tone: 'bad', text: `${conflicts.length} paid booking${conflicts.length > 1 ? 's' : ''} need rescheduling or a refund`, go: 'bookings', filter: 'paid_conflict' });
    const unread = messages.filter(m => !m.read).length;
    if (unread) attention.push({ tone: 'info', text: `${unread} unread message${unread > 1 ? 's' : ''}`, go: 'messages' });
    const soon = upcoming.filter(o => o.start < now + DAY);
    if (soon.length) attention.push({ tone: 'info', text: `${soon.length} session${soon.length > 1 ? 's' : ''} in the next 24 hours`, go: 'bookings', filter: 'upcoming' });
    const system = { payment: P().required(), payMode: P().mode(), google: MOCK ? 'mock' : !!ENV.GOOGLE_REFRESH_TOKEN, sifalo: payLinked(), mock: MOCK };
    if (!MOCK && system.payMode === 'off') attention.push({ tone: 'warn', text: 'Online payments are off, bookings are free. Turn them on in Settings → Payments', go: 'settings', filter: 'payments' });
    if (!MOCK && system.payMode === 'test') attention.push({ tone: 'warn', text: 'Payments are in TEST mode, no real money is taken. Switch to Live in Settings → Payments when you are ready', go: 'settings', filter: 'payments' });
    if (!MOCK && system.payMode === 'sandbox') attention.push({ tone: 'info', text: 'Payments use the Sifalo sandbox (test wallets and cards only)', go: 'settings', filter: 'payments' });
    if (!MOCK && !system.google) attention.push({ tone: 'warn', text: ENV.RESEND_API_KEY ? 'Google is not connected: no calendar or Meet links (emails work through Resend)' : 'Google is not connected: no calendar, Meet links or emails', go: 'settings', filter: 'connections' });
    if (!MOCK && !ENV.RESEND_API_KEY && !system.google) attention.push({ tone: 'warn', text: 'Emails are off. Add a Resend key (RESEND_API_KEY) or connect Google', go: 'settings', filter: 'connections' });
    const insights = [];
    const d = pct(rev, revPrev);
    if (rev || revPrev) insights.push(d === null ? { tone: 'good', text: `Revenue is $${rev} in the last ${range} days, with nothing in the period before.` } : { tone: d >= 0 ? 'good' : 'warn', text: `Revenue is ${d >= 0 ? 'up' : 'down'} ${Math.abs(d)}% versus the previous ${range} days ($${rev} vs $${revPrev}).` });
    const topMix = [...mix].sort((a, b) => b.revenue - a.revenue)[0];
    if (topMix && topMix.revenue) insights.push({ tone: 'info', text: `${topMix.title} brings ${Math.round(topMix.revenue / (rev || 1) * 100)}% of revenue (${topMix.count} booking${topMix.count !== 1 ? 's' : ''}).` });
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], wdMax = Math.max(...wd);
    if (wdMax) insights.push({ tone: 'info', text: `${dayNames[wd.indexOf(wdMax)]} is your busiest booking day (${wdMax} session${wdMax > 1 ? 's' : ''}).` });
    if (capacity) { const u = Math.round(booked14 / capacity * 100); insights.push({ tone: u > 75 ? 'good' : u < 15 ? 'warn' : 'info', text: `${u}% of your available hours in the next 14 days are booked${u < 15 ? ': consider promoting a session' : ''}.` }); }
    if (attempts.length >= 3) insights.push({ tone: 'info', text: `Checkout conversion is ${Math.round(paidAttempts / attempts.length * 100)}% (${paidAttempts} paid of ${attempts.length} started).` });
    const td = pct(tr.pv, trPrev.pv); if (tr.pv) insights.push({ tone: td >= 0 ? 'good' : 'warn', text: `Website traffic: ${tr.pv.toLocaleString()} page views from ${tr.uv.toLocaleString()} visitors${td === null ? '' : ` (${td >= 0 ? '+' : ''}${td}% vs previous period)`}.` });
    const topRef = Object.entries(tr.refs).filter(([k]) => k !== 'Direct').sort((a, b) => b[1] - a[1])[0]; if (topRef) insights.push({ tone: 'info', text: `Top referrer: ${topRef[0]} (${topRef[1]} visits).` });
    const sd = pct(subsNew, subsPrev); if (subsActive.length) insights.push({ tone: 'good', text: `${subsActive.length.toLocaleString()} newsletter subscribers; ${subsNew} new in this period${sd === null ? '' : ` (${sd >= 0 ? '+' : ''}${sd}%)`}.` });
    if (!paid.some(o => tOf(o) >= now - 7 * DAY) && all.length) insights.push({ tone: 'warn', text: 'No paid bookings in the last 7 days.' });
    return {
      range, system, attention, insights, activity: activity.slice(0, 12),
      kpi: {
        revenue: { value: rev, delta: pct(rev, revPrev) }, bookings: { value: cur.length, delta: pct(cur.length, prev.length) },
        aov: { value: Math.round(rev / (cur.filter(o => o.sid).length || 1)) },
        upcoming: { value: upcoming.length, next: upcoming[0] ? { start: upcoming[0].start, name: upcoming[0].name, session: SESSIONS[upcoming[0].session].title.en } : null },
        subscribers: { value: subsActive.length, new: subsNew, delta: pct(subsNew, subsPrev) },
        messages: { unread, total: messages.length }, views: { value: tr.pv, delta: pct(tr.pv, trPrev.pv), visitors: tr.uv },
        conversion: { value: attempts.length ? Math.round(paidAttempts / attempts.length * 100) : null },
        totalRevenue: sumRev(paid),
      },
      weeks, mix, weekdays: wd, traffic: { daily: tr.daily, pages: tr.pages, refs: tr.refs }, utilization: capacity ? Math.min(100, Math.round(booked14 / capacity * 100)) : 0,
    };
  }
  const dayStart = ms => Date.parse(dayKey(ms) + 'T00:00:00Z') - EAT;   // start of that Mogadishu day, as a real timestamp

  // ---------- static dashboard ----------
  const ADMIN_DIR = path.join(__dirname, '..', 'dashboard');
  const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.otf': 'font/otf', '.ttf': 'font/ttf', '.svg': 'image/svg+xml' };
  function serveStatic(res, rel) {
    const f = path.normalize(path.join(ADMIN_DIR, rel || 'index.html'));
    if (!f.startsWith(ADMIN_DIR + path.sep)) return false;
    try { const b = fs.readFileSync(f); res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow', 'Content-Security-Policy': "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'" }); res.end(b); return true; } catch { return false; }
  }

  // ---------- newsletter ----------
  const paras = t => String(t).split(/\n{2,}/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
  const unsubLink = s => `${PUBLIC_API}/api/unsubscribe?t=${s.token}`;
  async function broadcast(subject, body, only) {
    const list = only || subscribers.filter(s => !s.unsubscribed).slice(0, 450);        // Gmail allows roughly 500 messages/day
    let sent = 0, failed = 0;
    for (const s of list) {
      try { await sendMail({ to: s.email, subject, text: body + `\n\nUnsubscribe: ${unsubLink(s)}`, html: ctx.mails.layout(s.lang === 'so' ? 'so' : 'en', { pre: subject, title: subject, blocks: [[paras(body), body]], unsubscribe: unsubLink(s) }).html }); sent++; } catch { failed++; }
      if (!MOCK) await new Promise(r => setTimeout(r, 250));
    }
    return { sent, failed };
  }

  // ---------- routes ----------
  async function handle(req, res, url, origin) {
    const p = url.pathname, m = req.method, ip = req.clientIp || req.socket.remoteAddress;

    // ---- public site APIs ----
    if (p === '/api/content' && m === 'GET') return pubJson(res, 200, { posts: (ctx.hasBlogPosts && ctx.hasBlogPosts()) ? ctx.blogCards() : content.posts, events: content.events, partners: content.partners, community: content.community, proof: content.proof, testimonials: content.testimonials, media: content.media, ads: (content.ads || []).filter(a => a.enabled !== false), guides: ctx.blogGuides ? ctx.blogGuides() : {} }, origin), true;
    if (p === '/api/stats' && m === 'GET') return pubJson(res, 200, stats.current, origin), true;
    if (p === '/api/track' && (m === 'POST')) { if (!limited(ip + 't', 200)) { try { track(req, await readJson(req)); } catch { /* ignore */ } } return pubJson(res, 204, {}, origin), true; }
    if (p === '/api/subscribe' && m === 'POST') {
      if (limited(ip + 's', 10)) return pubJson(res, 429, { error: 'Too many requests' }, origin), true;
      const b = await readJson(req), email = clean(b.email, 120).toLowerCase();
      if (!validEmail(email)) return pubJson(res, 400, { error: 'Invalid email' }, origin), true;
      let s = subscribers.find(x => x.email === email), isNew = !s || s.unsubscribed;
      if (!s) { s = { id: uid(), email, lang: b.lang === 'so' ? 'so' : 'en', createdAt: Date.now(), source: clean(b.source, 20) || 'website', token: crypto.randomBytes(12).toString('hex'), unsubscribed: false }; subscribers.push(s); }
      else if (s.unsubscribed) { s.unsubscribed = false; s.createdAt = Date.now(); }
      store.save('subscribers');
      if (isNew) {
        log('subscriber', `New subscriber: ${email}`);
        const so = s.lang === 'so';
        sendMail({ to: email, ...ctx.mails.welcome(so ? 'so' : 'en', unsubLink(s)) }).catch(() => {});
      }
      return pubJson(res, 200, { ok: true }, origin), true;
    }
    if (p === '/api/unsubscribe' && m === 'GET') {
      const s = subscribers.find(x => x.token === url.searchParams.get('t'));
      if (s && !s.unsubscribed) { s.unsubscribed = true; store.save('subscribers'); log('subscriber', `Unsubscribed: ${s.email}`); }
      return text(res, 200, `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><body style="font-family:Roboto,Arial,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#F5F8FC;color:#0B1F3A"><div style="text-align:center;padding:24px"><h1>${s ? 'You are unsubscribed' : 'Link not valid'}</h1><p>${s ? 'You will not receive more newsletters.' : 'This unsubscribe link is invalid or expired.'}</p></div>`, 'text/html; charset=utf-8'), true;
    }
    if (p === '/api/contact' && m === 'POST') {
      if (limited(ip + 'c', 8)) return pubJson(res, 429, { error: 'Too many requests' }, origin), true;
      const b = await readJson(req), name = clean(b.name, 80), email = clean(b.email, 120), msg = clean(b.message, 3000);
      if (!name || !validEmail(email) || !msg) return pubJson(res, 400, { error: 'Invalid' }, origin), true;
      const mm = { id: uid(), name, email, type: clean(b.type, 30) || 'work', message: msg, lang: b.lang === 'so' ? 'so' : 'en', createdAt: Date.now(), read: false };
      messages.unshift(mm); store.save('messages'); log('message', `Message from ${name}`);
      sendMail({ to: OWNER(), ...ctx.mails.ownerMessage(mm) }).catch(() => {});
      const so = mm.lang === 'so';
      sendMail({ to: email, ...ctx.mails.contactReply(mm.lang, name) }).catch(() => {});
      return pubJson(res, 200, { ok: true }, origin), true;
    }

    // ---- uploaded images (logos) ----
    const vm = p.match(/^\/uploads\/([a-f0-9]{16}\.(mp4|webm))$/);
    if (vm && (m === 'GET' || m === 'HEAD')) {
      try {
        const vbuf = await store.getFile(vm[1]); if (!vbuf) { res.writeHead(404); res.end(); return true; } const size = vbuf.length, type = vm[2] === 'mp4' ? 'video/mp4' : 'video/webm', rg = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
        const base = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' };
        if (rg && (rg[1] || rg[2])) {
          let st = rg[1] === '' ? Math.max(0, size - +rg[2]) : +rg[1], en = rg[1] === '' || rg[2] === '' ? size - 1 : Math.min(+rg[2], size - 1);
          if (st > en || st >= size) { res.writeHead(416, { ...base, 'Content-Range': 'bytes */' + size }); res.end(); return true; }
          res.writeHead(206, { ...base, 'Content-Range': `bytes ${st}-${en}/${size}`, 'Content-Length': en - st + 1 }); if (m === 'HEAD') { res.end(); return true; } res.end(vbuf.subarray(st, en + 1)); return true;
        }
        res.writeHead(200, { ...base, 'Content-Length': size }); if (m === 'HEAD') { res.end(); return true; } res.end(vbuf);
      } catch { res.writeHead(404); res.end(); }
      return true;
    }
    let um = p.match(/^\/uploads\/([a-f0-9]{16}\.(png|jpg|webp|svg))$/);
    if (um && m === 'GET') {
      try {
        const b = await store.getFile(um[1]); if (!b) { res.writeHead(404); res.end(); return true; } const type = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml' }[um[2]];
        res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff', ...(um[2] === 'svg' ? { 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox" } : {}) }); res.end(b);
      } catch { res.writeHead(404); res.end(); }
      return true;
    }

    // ---- dashboard ----
    if (p === '/admin' || p === '/admin/') { if (!enabled()) return text(res, 503, 'Admin disabled: set ADMIN_PASSWORD in server/.env', 'text/plain'), true; return serveStatic(res, 'index.html') || (res.writeHead(404), res.end(), true); }
    if (p.startsWith('/admin/')) return serveStatic(res, p.slice(7)) || (res.writeHead(404), res.end(), true);
    if (!p.startsWith('/api/admin/')) return false;
    if (!enabled()) return json(res, 503, { error: 'Admin disabled' }), true;

    if (p === '/api/admin/login' && m === 'POST') {
      if (limited(ip + 'l', 10)) return json(res, 429, { error: 'Too many attempts. Try again later.' }), true;
      const b = await readJson(req);
      const okUser = checkUser(b.username), okPass = checkPw(b.password);   // both are always checked, so the answer never says which one was wrong
      if (!(okUser && okPass)) { await new Promise(r => setTimeout(r, 700)); log('security', 'Failed dashboard sign-in'); return json(res, 401, { error: 'Wrong username or password' }), true; }
      if (anyOn()) {   // password was right, now the second step
        const need = (error, extra = {}) => json(res, 401, { need2fa: true, methods: methods(), error, ...extra });
        if (b.send === 'email') {   // ask for a code by email (only to the owner's own address)
          if (!auth.mfaEmail) return need('That option is not turned on.'), true;
          if (limited(ip + 'otp', 5) || limited('otp-all', 12)) return json(res, 429, { error: 'Too many codes requested. Try again later.' }), true;
          try { await sendOtp(b.send); } catch (e) { return need('Could not send the code: ' + e.message), true; }
          return need('Code sent to ' + maskEmail(OWNER()) + '.', { sent: b.send }), true;
        }
        if (!b.code) return need('Enter your 6-digit code.'), true;
        if (limited(ip + 'l2', 8) || limited('l2-all', 30)) return json(res, 429, { error: 'Too many attempts. Try again later.' }), true;
        if (!secondFactor(b.code)) { await new Promise(r => setTimeout(r, 700)); log('security', 'Wrong two-step code at sign-in'); return need('That code is not right or has expired.'), true; }
      }
      return json(res, 200, { ok: true }, { 'Set-Cookie': `yy_admin=${sign({ exp: Date.now() + 12 * 3600e3, e: auth.epoch })}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secureFlag(req)}` }), true;
    }
    if (p === '/api/admin/forgot' && m === 'POST') {
      // emails a one-time link to the OWNER address only (never to an address typed in the form)
      if (req.headers['x-requested-with'] !== 'yy-admin') return json(res, 403, { error: 'Bad request' }), true;
      if (limited(ip + 'f', 3) || limited('forgot-all', 6)) return json(res, 429, { error: 'Too many requests. Please try again in an hour.' }), true;
      const to = OWNER();
      if (validEmail(to)) {
        const token = crypto.randomBytes(32).toString('hex');
        auth.resets = [...(auth.resets || []).filter(r => r.exp > Date.now()), { h: sha256hex(token), exp: Date.now() + 30 * 60e3 }].slice(-3); store.save('auth');
        const link = `${(ctx.SITE_URL || '').replace(/\/$/, '')}/admin#/reset/${token}`;
        log('security', 'Dashboard password reset link requested');
        sendMail({ to, subject: 'Reset your Eng Yuyu dashboard password', text: `Someone asked to reset the dashboard password.\n\nOpen this link within 30 minutes to choose a new password:\n${link}\n\nIf this wasn't you, ignore this email, your password stays the same.`, html: `<div style="font-family:Roboto,Arial,sans-serif;max-width:520px;margin:auto;color:#0B1F3A;line-height:1.55"><h2>Reset your dashboard password</h2><p>Someone asked to reset the Eng Yuyu dashboard password. Open the button below within <b>30 minutes</b> to choose a new one.</p><p style="margin:22px 0"><a href="${esc(link)}" style="background:#006AFF;color:#fff;text-decoration:none;padding:13px 26px;border-radius:999px;font-weight:700;display:inline-block">Choose a new password</a></p><p style="color:#5b6f8a;font-size:13px">If this wasn't you, ignore this email, your password stays the same. The link works once.</p></div>` }).catch(e => { console.error('reset email failed', e.message); log('security', 'Reset email could not be sent, is Google connected?'); });
      }
      return json(res, 200, { ok: true }), true;   // same answer whatever happens, so nothing can be probed
    }
    if (p === '/api/admin/reset' && m === 'POST') {
      if (req.headers['x-requested-with'] !== 'yy-admin') return json(res, 403, { error: 'Bad request' }), true;
      if (limited(ip + 'rs', 10)) return json(res, 429, { error: 'Too many attempts. Please try again later.' }), true;
      const b = await readJson(req), th = sha256hex(b.token || '');
      const rec = (auth.resets || []).find(r => r.exp > Date.now() && crypto.timingSafeEqual(Buffer.from(r.h), Buffer.from(th)));
      if (!rec) return json(res, 400, { error: 'This reset link is invalid or has expired. Please request a new one.' }), true;
      if (!strongPw(b.password)) return json(res, 400, { error: 'Use at least 12 characters (a few random words work well).' }), true;
      auth.hash = hashPw(b.password); auth.username = ''; auth.epoch = (auth.epoch || 0) + 1; auth.resets = []; store.save('auth');   // a reset also puts the username back to the default
      log('security', 'Dashboard password was reset by email link');
      sendMail({ to: OWNER(), subject: 'Your dashboard password was changed', text: 'The Eng Yuyu dashboard password was just changed. If this was not you, reset it again right away and check your email account security.', html: '<p>The Eng Yuyu dashboard password was just changed.</p><p>If this was not you, reset it again right away and check your email account security.</p>' }).catch(() => {});
      return json(res, 200, { ok: true }), true;
    }
    if (p === '/api/admin/logout') return json(res, 200, { ok: true }, { 'Set-Cookie': 'yy_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' }), true;
    if (!authed(req)) return json(res, 401, { error: 'Not signed in' }), true;
    if (m !== 'GET' && req.headers['x-requested-with'] !== 'yy-admin') return json(res, 403, { error: 'Bad request' }), true;   // CSRF guard

    // ---- payments (Sifalo Pay): mode + API keys. Keys are never sent back to the browser, only the last 4 characters. ----
    // ---- email texts: read / edit / reset (English + Somali) ----
    if (p === '/api/admin/email-copy' && m === 'GET') {
      const C = ctx.mails.COPY, ov = settings.emailCopy || {};
      return json(res, 200, Object.entries(C).map(([type, x]) => ({ type, label: x.label, fields: x.fields, defaults: { en: x.en, so: x.so }, saved: ov[type] || {} }))), true;
    }
    if (p === '/api/admin/email-copy' && m === 'PUT') {
      const b = await readJson(req), C = ctx.mails.COPY[b.type];
      if (!C) return json(res, 400, { error: 'Unknown email' }), true;
      settings.emailCopy = settings.emailCopy || {};
      if (b.reset) delete settings.emailCopy[b.type];
      else {
        const clean2 = v => String(v == null ? '' : v).replace(/\r/g, '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, 2000);
        const next = {};
        for (const lang of ['en', 'so']) { const o = {}; for (const k of Object.keys(C.fields)) { const v = clean2((b[lang] || {})[k]); if (v && v !== C[lang][k]) o[k] = v; } if (Object.keys(o).length) next[lang] = o; }
        if (Object.keys(next).length) settings.emailCopy[b.type] = next; else delete settings.emailCopy[b.type];
      }
      store.save('settings'); log('admin', `Email texts ${b.reset ? 'reset' : 'updated'}: ${C.label}`);
      return json(res, 200, { ok: true, saved: settings.emailCopy[b.type] || {} }), true;
    }
    // ---- email templates: preview + send a test to yourself ----
    if (p === '/api/admin/email-preview' || p === '/api/admin/email-test') {
      const lang = url.searchParams.get('lang') === 'so' ? 'so' : 'en', type = url.searchParams.get('type') || 'confirmed';
      const s0 = Object.values(SESSIONS).find(x => !x.legacy) || Object.values(SESSIONS)[0];
      const sid = Object.keys(SESSIONS).find(k => SESSIONS[k] === s0);
      const o = { id: 'a1b2c3d4e5f60718293a4b5c6d7e8f90', session: sid, name: 'Amina Hassan', email: OWNER(), lang, start: Date.now() + 3 * 864e5, amount: s0.price, sid: 'SIF-48213', payType: 'EDAHAB', paidAt: Date.now(), meet: 'https://meet.google.com/abc-defg-hij', note: 'Help with my Instagram reach' };
      const M = ctx.mails, T = { confirmed: () => M.confirmed(o, s0, o.meet), reminder24: () => M.reminder(o, s0, '24h'), reminder1: () => M.reminder(o, s0, '1h'), failed: () => M.paymentFailed(o, s0), cancelled: () => M.cancelled(o, s0), conflict: () => M.conflict(o, s0), followup: () => M.followUp(o, s0), welcome: () => M.welcome(lang, ctx.SITE_URL + '/api/unsubscribe?t=preview'), contact: () => M.contactReply(lang, 'Amina Hassan'), newpost: () => M.newPost(lang, { title: lang === 'so' ? 'Sida loo ilaaliyo taleefankaaga' : 'How to protect your phone from scams', excerpt: lang === 'so' ? 'Toddobo dejin oo degdeg ah oo ilaaliya akoonnadaada.' : 'Seven quick settings that keep your accounts safe.', link: ctx.SITE_URL + '/blog', image: '' }, ctx.SITE_URL + '/api/unsubscribe?t=preview'), owner: () => M.ownerBooking(o, s0), message: () => M.ownerMessage({ name: 'Amina Hassan', email: 'amina@example.com', type: 'partner', lang: 'en', message: 'Hello Eng Yuyu,\n\nWe are a mobile shop in Hargeisa and would love to sponsor a video about choosing a phone. Could we talk this week?' }) }[type];
      if (!T) return json(res, 400, { error: 'Unknown email' }), true;
      const em = T();
      if (p === '/api/admin/email-preview') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; img-src https: http: data:; style-src 'unsafe-inline'; frame-ancestors 'self'", 'X-Frame-Options': 'SAMEORIGIN' }); res.end(em.html); return true; }
      if (m !== 'POST') return json(res, 405, { error: 'POST' }), true;
      try { await sendMail({ to: OWNER(), ...em, subject: '[Preview] ' + em.subject }); } catch (e) { return json(res, 502, { error: 'The email could not be sent: ' + String(e.message).replace(/^Resend refused the email \(\d+\): /, '').slice(0, 220) }), true; }
      log('admin', `Test email sent: ${type} (${lang})`); return json(res, 200, { ok: true, to: OWNER() }), true;
    }
    if (p === '/api/admin/payment' && m === 'GET') return json(res, 200, { ...P().status(), webhookUrl: `${(ENV.PUBLIC_API_URL || ctx.SITE_URL).replace(/\/$/, '')}/api/pay/webhook`, needsPassword: !!(PASSWORD || auth.hash) }), true;
    if (p === '/api/admin/payment' && m === 'PUT') {
      const b = await readJson(req);
      if ((PASSWORD || auth.hash) && !checkPw(b.password)) {   // only wrong passwords count towards the limit; saving settings is never blocked
        if (limited(ip + 'paypw', 10)) return json(res, 429, { error: 'Too many wrong passwords. Please wait an hour or reset your dashboard password.' }), true;
        await new Promise(r => setTimeout(r, 700)); log('security', 'Payment settings change refused (wrong password)'); return json(res, 403, { error: 'Enter your current dashboard password to change payment settings.' }), true; }
      const before = P().mode();
      let st; try { st = P().update({ mode: b.mode, sandbox: b.sandbox, live: b.live }); } catch (e) { return json(res, 400, { error: e.message }), true; }
      const keysChanged = ['sandbox', 'live'].filter(k => b[k] && (b[k].key || b[k].clear || b[k].user !== undefined)).join(' & ');
      log('security', `Payment settings changed: mode: ${st.mode}${keysChanged ? ' · keys: ' + keysChanged : ''}`);
      if (before !== st.mode || keysChanged) sendMail({ to: OWNER(), subject: 'Payment settings were changed', text: `Your Eng Yuyu payment settings were just changed.\nMode: ${before} → ${st.mode}${keysChanged ? '\nAPI keys updated: ' + keysChanged : ''}\n\nIf this wasn't you, sign in and change your dashboard password now.`, html: `<p>Your Eng Yuyu payment settings were just changed.</p><p>Mode: <b>${esc(before)} → ${esc(st.mode)}</b>${keysChanged ? '<br>API keys updated: ' + esc(keysChanged) : ''}</p><p>If this wasn't you, sign in and change your dashboard password now.</p>` }).catch(() => {});
      return json(res, 200, st), true;
    }
    if (p === '/api/admin/payment/check' && m === 'POST') {
      if (limited(ip + 'paychk', 20)) return json(res, 429, { error: 'Too many checks. Try again later.' }), true;
      const b = await readJson(req); return json(res, 200, await P().check(b.env, ctx.SITE_URL)), true;
    }
    if (p === '/api/admin/2fa' && m === 'GET') return json(res, 200, { app: twoOn(), email: !!auth.mfaEmail, ownerHint: maskEmail(OWNER()), enabled: anyOn(), recoveryLeft: (auth.rec || []).length }), true;
    if (p.startsWith('/api/admin/2fa') && m === 'POST') {
      const b = await readJson(req); if (limited(ip + '2fa', 20)) return json(res, 429, { error: 'Too many attempts. Please try again later.' }), true;
      const finish = () => { const first = !(auth.rec || []).length; const rec = first ? newRecovery() : null; store.save('auth'); return json(res, 200, { ok: true, recovery: rec }); };
      if (p === '/api/admin/2fa/setup') {   // authenticator app
        if (twoOn()) return json(res, 400, { error: 'The authenticator app is already on.' }), true;
        auth.totp = { on: false, pending: b32enc(crypto.randomBytes(20)) }; store.save('auth');
        const issuer = 'Eng Yuyu Dashboard', label = encodeURIComponent(issuer) + ':' + encodeURIComponent(OWNER() || 'owner');
        return json(res, 200, { secret: auth.totp.pending, uri: `otpauth://totp/${label}?secret=${auth.totp.pending}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30` }), true;
      }
      if (p === '/api/admin/2fa/enable') {
        if (!auth.totp || !auth.totp.pending) return json(res, 400, { error: 'Start the setup first.' }), true;
        const st = totpCheck(auth.totp.pending, b.code); if (!st) return json(res, 400, { error: 'That code is not right. Check the time on your phone and try again.' }), true;
        auth.totp = { on: true, secret: auth.totp.pending, last: st }; log('security', 'Authenticator app two-step turned on'); return finish(), true;
      }
      if (p === '/api/admin/2fa/email/start') { try { await sendOtp('email'); } catch (e) { return json(res, 400, { error: 'Could not send the email: ' + e.message }), true; } return json(res, 200, { ok: true, to: maskEmail(OWNER()) }), true; }
      if (p === '/api/admin/2fa/email/enable') {
        if (!auth.otp || auth.otp.via !== 'email' || !otpCheck(b.code)) return json(res, 400, { error: 'That code is not right or has expired.' }), true;
        auth.mfaEmail = true; log('security', 'Email two-step turned on'); return finish(), true;
      }
      if (p === '/api/admin/2fa/challenge') {   // signed-in owner asks for a code (to confirm turning something off)
        if (!(b.via === 'email' && auth.mfaEmail)) return json(res, 400, { error: 'That option is not on.' }), true;
        try { await sendOtp(b.via); } catch (e) { return json(res, 400, { error: e.message }), true; } return json(res, 200, { ok: true }), true;
      }
      if (p === '/api/admin/2fa/disable') {   // method: app | email | all
        if (!anyOn()) return json(res, 200, { ok: true }), true;
        if (!checkPw(b.password) || !secondFactor(b.code)) { await new Promise(r => setTimeout(r, 700)); return json(res, 400, { error: 'Your password or code is not correct.' }), true; }
        const mth = b.method || 'all';
        if (mth === 'app' || mth === 'all') auth.totp = null; if (mth === 'email' || mth === 'all') auth.mfaEmail = false;
        if (!anyOn()) auth.rec = []; store.save('auth'); log('security', 'Two-step turned off: ' + mth); return json(res, 200, { ok: true }), true;
      }
      return json(res, 404, { error: 'Not found' }), true;
    }
    if (p === '/api/admin/password' && m === 'POST') {   // change password while signed in
      const b = await readJson(req);
      if (limited(ip + 'pw', 8)) return json(res, 429, { error: 'Too many attempts. Please try again later.' }), true;
      if (!checkPw(b.current)) { await new Promise(r => setTimeout(r, 700)); return json(res, 400, { error: 'Your current password is not correct.' }), true; }
      if (!strongPw(b.password)) return json(res, 400, { error: 'Use at least 12 characters (a few random words work well).' }), true;
      auth.hash = hashPw(b.password); auth.epoch = (auth.epoch || 0) + 1; auth.resets = []; store.save('auth');
      log('security', 'Dashboard password was changed');
      return json(res, 200, { ok: true }, { 'Set-Cookie': `yy_admin=${sign({ exp: Date.now() + 12 * 3600e3, e: auth.epoch })}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secureFlag(req)}` }), true;   // other sessions are signed out
    }
    if (p === '/api/admin/upload-video' && m === 'POST') {   // short ad clips: mp4 / webm, up to 12 MB, checked by file signature
      const buf = await new Promise((ok, no) => { const parts = []; let n = 0; req.on('data', c => { n += c.length; if (n > 12e6) { req.destroy(); no(new Error('too large')); } else parts.push(c); }); req.on('end', () => ok(Buffer.concat(parts))); req.on('error', no); }).catch(() => null);
      if (!buf) return json(res, 413, { error: 'Video is too large (max 12 MB). A 10–15 second clip should be 2–6 MB.' }), true;
      let ext = null; if (buf.length > 12 && buf.slice(4, 8).toString() === 'ftyp') ext = 'mp4'; else if (buf.length > 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) ext = 'webm';
      if (!ext) return json(res, 400, { error: 'Please upload an MP4 or WebM video.' }), true;
      const name = crypto.randomBytes(8).toString('hex') + '.' + ext; try { await store.putFile(name, buf); } catch (e) { console.error('upload failed:', e.message); return json(res, 502, { error: 'Could not save the video. Please try again.' }), true; }
      log('admin', 'Uploaded an ad video'); return json(res, 200, { url: '/uploads/' + name }), true;
    }
    if (p === '/api/admin/upload' && m === 'POST') {   // logo upload: png / jpg / webp / svg, max 1 MB
      const raw = await new Promise((ok, no) => { let s = '', n = 0; req.on('data', c => { n += c.length; if (n > 1.6e6) { req.destroy(); no(new Error('too large')); } else s += c; }); req.on('end', () => ok(s)); req.on('error', no); }).catch(() => null);
      if (raw === null) return json(res, 413, { error: 'Image is too large (max 1 MB).' }), true;
      let b; try { b = JSON.parse(raw); } catch { return json(res, 400, { error: 'Bad upload' }), true; }
      const mm2 = String(b.data || '').match(/^data:[\w/+.-]+;base64,([A-Za-z0-9+/=]+)$/); if (!mm2) return json(res, 400, { error: 'Bad image data' }), true;
      const buf = Buffer.from(mm2[1], 'base64'); if (buf.length > 1048576) return json(res, 413, { error: 'Image is too large (max 1 MB).' }), true;
      let ext = null;
      if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ext = 'png';
      else if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) ext = 'jpg';
      else if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') ext = 'webp';
      else { const t = buf.toString('utf8', 0, Math.min(buf.length, 400000)); if (/^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)?(<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i.test(t) && !/<script|<foreignObject|\son\w+\s*=|javascript:|<iframe|<object|<embed|xlink:href\s*=\s*["']\s*https?:/i.test(t)) ext = 'svg'; }
      if (!ext) return json(res, 400, { error: 'Please upload a PNG, JPG, WebP or SVG image.' }), true;
      const name = crypto.randomBytes(8).toString('hex') + '.' + ext;
      try { await store.putFile(name, buf); } catch (e) { console.error('upload failed:', e.message); return json(res, 502, { error: 'Could not save the image. Please try again.' }), true; }
      return json(res, 200, { url: '/uploads/' + name }), true;
    }
    if (p === '/api/admin/me') return json(res, 200, { ok: true, mock: MOCK, owner: OWNER(), username: userName() }), true;
    if (p === '/api/admin/username' && m === 'POST') {   // change the sign-in username (needs the current password)
      const b = await readJson(req); if (limited(ip + 'un', 8)) return json(res, 429, { error: 'Too many attempts. Please try again later.' }), true;
      if (!checkPw(b.password)) { await new Promise(r => setTimeout(r, 700)); return json(res, 400, { error: 'Your current password is not correct.' }), true; }
      const u = normUser(b.username); if (!/^[a-z0-9._-]{3,40}$/.test(u)) return json(res, 400, { error: 'Use 3 to 40 letters, numbers, dots, dashes or underscores (no spaces).' }), true;
      auth.username = u; store.save('auth'); log('security', 'Dashboard username was changed'); return json(res, 200, { ok: true, username: u }), true;
    }
    if (p === '/api/admin/summary') return json(res, 200, summary(Math.min(365, Math.max(7, +url.searchParams.get('range') || 30)))), true;

    // bookings
    if (p === '/api/admin/bookings' && m === 'GET') {
      const list = Object.values(orders).sort((a, b) => b.createdAt - a.createdAt).map(o => ({ id: o.id, ref: o.id.slice(0, 8).toUpperCase(), session: o.session, title: SESSIONS[o.session]?.title.en || o.session, min: SESSIONS[o.session]?.min, start: o.start, name: o.name, email: o.email, note: o.note, amount: o.amount, status: o.status, sid: o.sid, payType: o.payType, meet: o.meet, createdAt: o.createdAt, paidAt: o.paidAt, test: !!o.test, payMode: o.payMode || '' }));
      return json(res, 200, list), true;
    }
    if (p === '/api/admin/bookings.csv') return text(res, 200, csv([['Reference', 'Created', 'Session', 'Session time (Mogadishu)', 'Name', 'Email', 'Amount USD', 'Status', 'Payment', 'Payment ID', 'Meet'], ...Object.values(orders).sort((a, b) => b.createdAt - a.createdAt).map(o => [o.id.slice(0, 8).toUpperCase(), new Date(o.createdAt).toISOString(), SESSIONS[o.session]?.title.en, fmtWhen(o.start, 'en'), o.name, o.email, o.amount, o.status, o.payType || '', o.sid || '', o.meet || ''])]), 'text/csv; charset=utf-8', { 'Content-Disposition': 'attachment; filename="bookings.csv"' }), true;
    let mm = p.match(/^\/api\/admin\/bookings\/([a-f0-9]+)\/(\w+)$/);
    if (mm && m === 'POST') {
      const o = orders[mm[1]]; if (!o) return json(res, 404, { error: 'Not found' }), true;
      const act = mm[2];
      if (act === 'resend') { if (!['paid', 'confirmed'].includes(o.status)) return json(res, 400, { error: 'Only approved bookings' }), true; await sendMail({ to: o.email, ...approvalMail(o, SESSIONS[o.session], o.meet || ''), }); log('admin', `Approval email re-sent to ${o.email}`); return json(res, 200, { ok: true }), true; }
      if (act === 'markpaid') {
        if (['paid', 'confirmed'].includes(o.status)) return json(res, 400, { error: 'Already approved' }), true;
        o.status = 'pending'; await locked(() => fulfil(o, { sid: 'MANUAL-' + Date.now().toString(36), payment_type: 'MANUAL' }));
        log('admin', `Marked paid manually: ${o.name}`); return json(res, 200, { ok: true, status: o.status }), true;
      }
      if (act === 'cancel') {
        const was = o.status; await ctx.cancelEvent(o); o.status = 'cancelled'; o.holdUntil = 0; ctx.saveOrders();
        if (['paid', 'confirmed', 'paid_conflict'].includes(was) && SESSIONS[o.session]) { const em = ctx.mails.cancelled(o, SESSIONS[o.session]); if (o.test) em.subject = '[TEST] ' + em.subject; sendMail({ to: o.email, ...em }).catch(() => {}); }
        log('admin', `Cancelled booking of ${o.name}${['paid', 'confirmed'].includes(was) ? ' (client emailed)' : ''}`); return json(res, 200, { ok: true }), true;
      }
      if (act === 'delete') { if (['paid', 'confirmed'].includes(o.status)) return json(res, 400, { error: 'Cancel it first' }), true; delete orders[o.id]; ctx.saveOrders(); return json(res, 200, { ok: true }), true; }
      return json(res, 400, { error: 'Unknown action' }), true;
    }

    // content
    if (p === '/api/admin/content' && m === 'GET') return json(res, 200, { posts: content.posts || [], events: content.events || [], partners: content.partners || [], community: content.community || [], proof: content.proof || [], testimonials: content.testimonials || [], media: content.media || [], ads: content.ads || [] }), true;
    mm = p.match(/^\/api\/admin\/content\/(posts|events|partners|community|proof|testimonials|media|ads)$/);
    if (mm && m === 'PUT') {
      const b = await readJson(req); if (!Array.isArray(b)) return json(res, 400, { error: 'Array expected' }), true;
      const t = mm[1], s2 = (v, n) => clean(v, n);
      const pair = a => [s2(a && a[0], 200), s2(a && a[1], 600)];
      let out;
      if (t === 'posts') out = b.map(x => ({ id: x.id || uid(), cat: ['ai', 'gadgets', 'dev', 'growth'].includes(x.cat) ? x.cat : 'ai', min: Math.max(1, +x.min || 5), date: /^\d{4}-\d{2}-\d{2}$/.test(x.date) ? x.date : dayKey(Date.now()), en: pair(x.en), so: pair(x.so), ...(x.href ? { href: s2(x.href, 300) } : {}) })).filter(x => x.en[0]);
      else if (t === 'events') out = b.map(x => ({ id: x.id || uid(), ...(x.feature ? { feature: true } : {}), icon: ['mic', 'cap', 'video', 'chart', 'spark'].includes(x.icon) ? x.icon : 'mic', tag: [s2(x.tag && x.tag[0], 40), s2(x.tag && x.tag[1], 40)], type: ['conference', 'talk', 'panel', 'attended', 'workshop', 'media', 'other'].includes(x.type) ? x.type : undefined, images: (Array.isArray(x.images) ? x.images : []).filter(u => /^(https?:\/\/|\/uploads\/|\/assets\/)/i.test(u || '')).slice(0, 4).map(u => s2(u, 400)), article: { en: s2(x.article && x.article.en, 6000), so: s2(x.article && x.article.so, 6000) }, place: s2(x.place, 120), ...(/^https?:\/\//i.test(x.link || '') ? { link: s2(x.link, 400) } : {}), date: /^\d{4}-\d{2}-\d{2}$/.test(x.date) ? x.date : dayKey(Date.now()), en: pair(x.en), so: pair(x.so) })).filter(x => x.en[0]);
      else if (t === 'partners') { const img = u => (/^(https?:\/\/|\/uploads\/|\/assets\/)/i.test(u || '') ? s2(u, 400) : ''); out = b.map(x => { if (typeof x === 'string') return s2(x, 60); const o = { name: s2(x.name, 60) }; if (img(x.logo)) o.logo = img(x.logo); if (img(x.logoDark)) o.logoDark = img(x.logoDark); if (['same', 'custom', 'invert'].includes(x.dark)) o.dark = x.dark; if (/^https?:\/\//i.test(x.url || '')) o.url = s2(x.url, 300); return o; }).filter(x => (typeof x === 'string' ? x : x.name)); }
      else if (t === 'proof') out = b.map(x => ({ id: x.id || uid(), metric: s2(x.metric, 24), en: [s2(x.en && x.en[0], 120), s2(x.en && x.en[1], 320)], so: [s2(x.so && x.so[0], 120), s2(x.so && x.so[1], 320)], ...(/^https?:\/\//i.test(x.href || '') ? { href: s2(x.href, 300) } : {}) })).filter(x => x.en[0]);
      else if (t === 'media') out = b.map(x => ({ id: x.id || uid(), kind: ['video', 'interview', 'podcast', 'article', 'show'].includes(x.kind) ? x.kind : 'video', date: /^\d{4}-\d{2}-\d{2}$/.test(x.date) ? x.date : dayKey(Date.now()), outlet: s2(x.outlet, 80), url: /^https?:\/\//i.test(x.url || '') ? s2(x.url, 400) : '', en: s2(x.en, 160), so: s2(x.so, 160) })).filter(x => x.en && x.url);
      else if (t === 'ads') {   // partner ads: a 10–15 s video or an animated card, always labelled "Sponsored"
        const img = u => (/^(https?:\/\/|\/uploads\/|\/assets\/)/i.test(u || '') ? s2(u, 400) : '');
        out = b.slice(0, 12).map(x => ({ id: /^[a-z0-9]{6,12}$/.test(x.id || '') ? x.id : uid(), enabled: x.enabled !== false, partner: s2(x.partner, 60), en: [s2(x.en && x.en[0], 100), s2(x.en && x.en[1], 220)], so: [s2(x.so && x.so[0], 100) || s2(x.en && x.en[0], 100), s2(x.so && x.so[1], 220) || s2(x.en && x.en[1], 220)], cta: [s2(x.cta && x.cta[0], 30), s2(x.cta && x.cta[1], 30)], url: /^https:\/\//i.test(x.url || '') ? s2(x.url, 400) : '', video: /^\/uploads\/[a-f0-9]{16}\.(mp4|webm)$/.test(x.video || '') ? x.video : '', poster: img(x.poster), logo: img(x.logo), theme: ['blue', 'green', 'violet', 'sunset', 'gold'].includes(x.theme) ? x.theme : 'blue', scene: ['phone', 'shield', 'wallet'].includes(x.scene) ? x.scene : '', caps: { en: ((x.caps && x.caps.en) || []).slice(0, 3).map(v => s2(v, 40)).filter(Boolean), so: ((x.caps && x.caps.so) || []).slice(0, 3).map(v => s2(v, 40)).filter(Boolean) }, seconds: Math.min(15, Math.max(10, Math.round(+x.seconds) || 12)) })).filter(x => x.partner && x.en[0]);
      }
      else if (t === 'testimonials') out = b.map(x => ({ id: x.id || uid(), name: s2(x.name, 60), role: s2(x.role, 80), en: s2(x.en, 500), so: s2(x.so, 500) })).filter(x => x.name && x.en);
      else out = b.map(x => ({ icon: ['play', 'chat', 'users'].includes(x.icon) ? x.icon : 'chat', name: s2(x.name, 40), en: s2(x.en, 120), so: s2(x.so, 120), href: s2(x.href, 300) })).filter(x => x.name);
      content[t] = out; store.save('content'); log('admin', `Updated ${t} (${out.length})`); return json(res, 200, out), true;
    }
    // audience numbers
    if (p === '/api/admin/stats' && m === 'GET') return json(res, 200, stats), true;
    if (p === '/api/admin/stats' && m === 'PUT') {
      const b = await readJson(req), cur = { ...stats.current };
      for (const k of ['youtube', 'facebook', 'tiktok', 'instagram', 'views']) if (Number.isFinite(+b[k]) && +b[k] >= 0) cur[k] = Math.round(+b[k]);
      stats.history.unshift({ t: Date.now(), ...cur }); stats.history.length = Math.min(stats.history.length, 120);
      stats.current = cur; stats.source = 'manual'; stats.updatedAt = Date.now(); store.save('stats'); log('admin', 'Updated audience numbers'); return json(res, 200, stats), true;
    }
    // subscribers
    if (p === '/api/admin/subscribers' && m === 'GET') return json(res, 200, [...subscribers].sort((a, b) => b.createdAt - a.createdAt).map(({ token, ...s }) => s)), true;
    if (p === '/api/admin/subscribers.csv') return text(res, 200, csv([['Email', 'Language', 'Subscribed', 'Source', 'Unsubscribed'], ...subscribers.map(s => [s.email, s.lang, new Date(s.createdAt).toISOString(), s.source, s.unsubscribed ? 'yes' : ''])]), 'text/csv; charset=utf-8', { 'Content-Disposition': 'attachment; filename="subscribers.csv"' }), true;
    if (p === '/api/admin/subscribers' && m === 'POST') { const b = await readJson(req), email = clean(b.email, 120).toLowerCase(); if (!validEmail(email)) return json(res, 400, { error: 'Invalid email' }), true; if (!subscribers.some(s => s.email === email)) subscribers.push({ id: uid(), email, lang: 'en', createdAt: Date.now(), source: 'admin', token: crypto.randomBytes(12).toString('hex'), unsubscribed: false }); store.save('subscribers'); return json(res, 200, { ok: true }), true; }
    mm = p.match(/^\/api\/admin\/subscribers\/([a-f0-9]+)$/);
    if (mm && m === 'DELETE') { const i = subscribers.findIndex(s => s.id === mm[1]); if (i >= 0) subscribers.splice(i, 1); store.save('subscribers'); return json(res, 200, { ok: true }), true; }
    if (p === '/api/admin/broadcast' && m === 'POST') {
      const b = await readJson(req), subject = clean(b.subject, 150), body = clean(b.body, 8000);
      if (!subject || !body) return json(res, 400, { error: 'Subject and message are required' }), true;
      if (b.test) { const fake = { token: 'test', email: OWNER() }; const r = await broadcast(subject, body, [fake]); return json(res, 200, { ...r, test: true }), true; }
      const r = await broadcast(subject, body); log('admin', `Newsletter sent to ${r.sent} subscribers: ${subject}`); return json(res, 200, r), true;
    }
    // messages
    if (p === '/api/admin/messages' && m === 'GET') return json(res, 200, messages), true;
    mm = p.match(/^\/api\/admin\/messages\/([a-f0-9]+)$/);
    if (mm && m === 'PATCH') { const x = messages.find(y => y.id === mm[1]); const b = await readJson(req); if (x) x.read = !!b.read; store.save('messages'); return json(res, 200, { ok: true }), true; }
    if (mm && m === 'DELETE') { const i = messages.findIndex(y => y.id === mm[1]); if (i >= 0) messages.splice(i, 1); store.save('messages'); return json(res, 200, { ok: true }), true; }
    // traffic
    if (p === '/api/admin/traffic') { const n = Math.min(365, Math.max(7, +url.searchParams.get('days') || 30)), now = Date.now(); const cur = trafficRange(dayStart(now - (n - 1) * DAY), dayStart(now) + DAY), prev = trafficRange(dayStart(now - (2 * n - 1) * DAY), dayStart(now - (n - 1) * DAY)); return json(res, 200, { days: n, cur, prev }), true; }
    // settings
    if (p === '/api/admin/automations/digest' && m === 'POST') { try { await ctx.automations.digest(); log('admin', 'Sent weekly summary now'); return json(res, 200, { ok: true, to: OWNER() }), true; } catch (e) { return json(res, 500, { error: 'Could not send: ' + e.message }), true; } }
    if (p === '/api/admin/settings' && m === 'GET') return json(res, 200, { settings, effective: { availability: { days: RULES.days, start: RULES.start, end: RULES.end, step: RULES.step, minNoticeHours: RULES.minNoticeHours, horizonDays: RULES.horizonDays }, sessionList: sessionList(), sessions: Object.fromEntries(Object.entries(SESSIONS).filter(([, s]) => !s.legacy).map(([id, s]) => [id, { title: s.title.en, min: s.min, price: s.price, enabled: s.enabled !== false }])), ownerEmail: OWNER(), wa: ctx.waCfg(), waDefaults: ctx.WA_DEFAULTS, whatsapp: settings.whatsapp || '', introVideo: settings.introVideo || '', automations: { reminders: ctx.automations.on('reminders'), weekly: ctx.automations.on('weekly'), followup: ctx.automations.on('followup') } }, system: { payment: P().required(), payMode: P().mode(), mock: MOCK, google: MOCK ? 'mock' : !!ENV.GOOGLE_REFRESH_TOKEN, sifalo: payLinked(), siteUrl: ctx.SITE_URL } }), true;
    if (p === '/api/admin/settings' && m === 'PUT') {
      const b = await readJson(req);
      if (b.ownerEmail !== undefined) { if (b.ownerEmail && !validEmail(b.ownerEmail)) return json(res, 400, { error: 'Invalid owner email' }), true; settings.ownerEmail = clean(b.ownerEmail, 120); }
      if (b.availability) { const a = b.availability; if (Array.isArray(a.days) && a.days.length) settings.availability = { days: a.days.map(Number), start: Math.min(23, Math.max(0, +a.start)), end: Math.min(24, Math.max(1, +a.end)), step: [15, 30, 60].includes(+a.step) ? +a.step : 30, minNoticeHours: Math.max(0, +a.minNoticeHours || 0), horizonDays: Math.min(120, Math.max(7, +a.horizonDays || 42)) }; if (settings.availability && settings.availability.end <= settings.availability.start) return json(res, 400, { error: 'End time must be after start time' }), true; }
      if (Array.isArray(b.sessionList)) {
        const line = (v, n) => clean(v, n).replace(/[\r\n]+/g, ' '), arr = (v, n, m) => (Array.isArray(v) ? v : String(v || '').split('\n')).map(x => clean(x, m)).filter(Boolean).slice(0, n);
        const seen = new Set(), list = [];
        for (const x of b.sessionList.slice(0, 8)) {
          const id = clean(x.id, 24).toLowerCase().replace(/[^a-z0-9-]/g, '');
          if (!id || seen.has(id) || !x.en || !x.so) continue; seen.add(id);
          const en = [line(x.en[0], 80), line(x.en[1], 260)], so = [line(x.so[0], 80), line(x.so[1], 260)];
          if (!en[0]) return json(res, 400, { error: 'Every session needs an English name.' }), true;
          if (!so[0]) so[0] = en[0]; if (!so[1]) so[1] = en[1];
          list.push({ id, slug: id, min: Math.min(240, Math.max(5, Math.round(+x.min) || 30)), price: Math.min(5000, Math.max(0, +x.price || 0)), enabled: x.enabled !== false, service: clean(x.service, 20), payUrl: '', en, so, who: { en: line((x.who || {}).en, 140), so: line((x.who || {}).so, 140) || line((x.who || {}).en, 140) }, inc: { en: arr((x.inc || {}).en, 6, 140), so: arr((x.inc || {}).so, 6, 140) } });
        }
        if (!list.length) return json(res, 400, { error: 'Keep at least one session.' }), true;
        if (!list.some(x => x.enabled)) return json(res, 400, { error: 'Keep at least one session switched on.' }), true;
        settings.sessionList = list;
      }
      if (false && b.sessions) settings.sessions = Object.fromEntries(Object.entries(b.sessions).filter(([id]) => SESSIONS[id]).map(([id, o]) => [id, { price: Math.max(0, +o.price || 0), min: Math.max(5, +o.min || 15), enabled: o.enabled !== false }]));
      if (b.whatsapp !== undefined) { const d = String(b.whatsapp || '').replace(/\D/g, ''); if (d && (d.length < 8 || d.length > 15)) return json(res, 400, { error: 'WhatsApp number: use the full international number, e.g. 252612345678' }), true; settings.whatsapp = d; }
      if (b.wa) {   // WhatsApp popup + messages
        const t2 = v => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim().slice(0, 600), w = settings.wa || {};
        if (b.wa.popup !== undefined) w.popup = !!b.wa.popup;
        if (b.wa.delay !== undefined) w.delay = Math.min(120, Math.max(0, Math.round(+b.wa.delay) || 0));
        for (const k of ['greeting', 'reply', 'book', 'ask', 'share']) if (b.wa[k]) { w[k] = {}; for (const l of ['en', 'so']) { const v = t2(b.wa[k][l]); if (v && v !== ctx.WA_DEFAULTS[k][l]) w[k][l] = v; } if (!Object.keys(w[k]).length) delete w[k]; }
        settings.wa = w;
      }
      if (b.introVideo !== undefined) { const v = String(b.introVideo || '').trim(), m = v.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/|v\/))([A-Za-z0-9_-]{11})/) || (/^[A-Za-z0-9_-]{11}$/.test(v) ? [0, v] : null); if (v && !m) return json(res, 400, { error: 'That does not look like a YouTube link.' }), true; settings.introVideo = m ? m[1] : ''; }
      if (b.automations) settings.automations = { reminders: b.automations.reminders !== false, weekly: b.automations.weekly !== false, followup: b.automations.followup !== false };
      store.save('settings'); applySettings(); log('admin', 'Updated settings'); return json(res, 200, { ok: true }), true;
    }
    return json(res, 404, { error: 'Not found' }), true;
  }

  return { handle, log, summary, authed, json };
};
