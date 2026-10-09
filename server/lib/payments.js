// Sifalo Pay settings + calls. Modes:
//   off    : no payment: bookings are approved straight away
//   test   : built-in test checkout on this server: no real money; the owner (signed in to the dashboard) approves it
//   sandbox: Sifalo staging (pay.sifalo.net / spay-api.sifalo.net) with sandbox keys, test wallets and test cards
//   live   : Sifalo live (pay.sifalo.com / api.sifalopay.com): real wallets and cards
// API username + key are edited in the dashboard and stored encrypted in the data folder (AES-256-GCM).
// SIFALO_API_USER / SIFALO_API_KEY in server/.env still work as live keys if none are saved in the dashboard.
// Docs: https://developer.sifalopay.com  (hosted checkout, verify.php, codes 601/603/600/604, sandbox, webhooks)
'use strict';
const crypto = require('crypto');

module.exports = function payments({ ENV, MOCK, store }) {
  const HOSTS = {
    sandbox: { gateway: 'https://spay-api.sifalo.net/gateway/', checkout: 'https://pay.sifalo.net/checkout/', portal: 'https://pay.sifalo.net/business' },
    live: { gateway: ENV.SIFALO_GATEWAY_URL || 'https://api.sifalopay.com/gateway/', checkout: ENV.SIFALO_CHECKOUT_URL || 'https://pay.sifalo.com/checkout/', portal: 'https://pay.sifalo.com/business' },
  };
  const MODES = ['off', 'test', 'sandbox', 'live'];

  // encryption key: PAYMENT_SECRET from the environment if set (recommended), otherwise derived from the server's own secret
  const secret = store.load('secret', { value: crypto.randomBytes(32).toString('hex') }); store.save('secret');
  const KEY = crypto.createHash('sha256').update(ENV.PAYMENT_SECRET || 'yy-payments:' + secret.value).digest();
  const enc = text => { const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', KEY, iv), ct = Buffer.concat([c.update(String(text), 'utf8'), c.final()]); return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), ct.toString('base64')].join(':'); };
  const dec = blob => { try { const [v, iv, tag, ct] = String(blob || '').split(':'); if (v !== 'v1') return ''; const d = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(iv, 'base64')); d.setAuthTag(Buffer.from(tag, 'base64')); return Buffer.concat([d.update(Buffer.from(ct, 'base64')), d.final()]).toString('utf8'); } catch { return ''; } };

  const state = store.load('payment', { mode: '', sandbox: {}, live: {}, updatedAt: 0 });
  const creds = env => {
    const s = state[env] || {}, user = s.user || '', key = s.key ? dec(s.key) : '';
    if (env === 'live' && !(user && key) && ENV.SIFALO_API_USER && ENV.SIFALO_API_KEY) return { user: ENV.SIFALO_API_USER, key: ENV.SIFALO_API_KEY, fromEnv: true };
    return { user, key };
  };
  const hasCreds = env => { const c = creds(env); return !!(c.user && c.key); };
  const mode = () => {
    if (MOCK) return ['test', 'off'].includes(state.mode) || (state.mode === 'sandbox' && hasCreds('sandbox')) ? state.mode : ENV.MOCK_PAYMENT === '0' ? 'off' : 'mock';   // the demo can use Off, Test or the Sifalo sandbox, never live
    if (state.mode && MODES.includes(state.mode)) return state.mode;
    return hasCreds('live') ? 'live' : 'off';   // older setups: keys in .env switch payments on
  };
  const required = () => mode() !== 'off';
  const ready = () => { const m = mode(); return m === 'mock' || m === 'test' || m === 'off' || hasCreds(m); };
  const hint = env => { const c = creds(env); return { user: c.user || '', keySet: !!c.key, keyEnd: c.key ? c.key.slice(-4) : '', fromEnv: !!c.fromEnv }; };
  const status = () => ({ mode: mode(), savedMode: state.mode || '', mock: MOCK, ready: ready(), sandbox: hint('sandbox'), live: hint('live'), hosts: HOSTS, updatedAt: state.updatedAt || 0 });

  function update(b) {   // validate everything on a copy first, then apply, a refused change leaves the settings untouched
    const next = JSON.parse(JSON.stringify(state));
    if (b.mode !== undefined) { if (!MODES.includes(b.mode)) throw new Error('Unknown payment mode'); next.mode = b.mode; }
    if (MOCK && next.mode === 'live') throw new Error('The demo server can’t take live payments (its Google calendar and emails are fake). Use the real server for Live.');
    for (const env of ['sandbox', 'live']) {
      const x = b[env]; if (!x) continue;
      next[env] = next[env] || {};
      if (x.clear) { next[env] = {}; continue; }
      if (x.user !== undefined) { const u = String(x.user).trim(); if (u && !/^[\w.@+-]{2,80}$/.test(u)) throw new Error('The API username looks wrong (letters, numbers and . _ - @ + only).'); next[env].user = u; }
      if (x.key) { const k = String(x.key).trim(); if (!/^[\x21-\x7e]{8,200}$/.test(k)) throw new Error('The API key looks wrong (it should be one long string with no spaces).'); next[env].key = enc(k); }
    }
    const has = env => { const s2 = next[env] || {}; return !!(s2.user && s2.key) || (env === 'live' && !!(ENV.SIFALO_API_USER && ENV.SIFALO_API_KEY)); };
    if ((next.mode === 'sandbox' || next.mode === 'live') && !has(next.mode)) throw new Error(`Add the ${next.mode} API username and key before switching to ${next.mode}.`);
    for (const k of Object.keys(state)) delete state[k];
    Object.assign(state, next, { updatedAt: Date.now() }); store.save('payment');
    return status();
  }

  // JSON POST over https with a generous connect timeout (Sifalo sits behind Cloudflare and can be slow to connect on some
  // networks: fetch() gives up after 10 s), IPv4, a 120 s total limit (Sifalo's guidance) and retries on connection errors.
  const https = require('https');
  function postJson(url, body, headers = {}, tries = 2) {
    const once = () => new Promise((ok, no) => {
      const u = new URL(url), data = JSON.stringify(body);
      const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'POST', family: 4, timeout: 120e3, agent: false, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), 'User-Agent': 'EngYuyu-Booking/1.0', ...headers } }, res => {
        let raw = ''; res.setEncoding('utf8'); res.on('data', c => { raw += c; }); res.on('end', () => { try { ok(JSON.parse(raw || '{}')); } catch { ok({ httpStatus: res.statusCode, raw: raw.slice(0, 200) }); } });
      });
      const connectTimer = setTimeout(() => req.destroy(new Error('connect timeout (25 s)')), 25e3);
      req.on('socket', sock => sock.once('secureConnect', () => clearTimeout(connectTimer)));   // fresh connection each time (agent: false), so no listener build-up
      req.on('response', () => clearTimeout(connectTimer));
      req.on('timeout', () => req.destroy(new Error('Sifalo took longer than 120 s')));
      req.on('error', e => { clearTimeout(connectTimer); no(e); });
      req.end(data);
    });
    return (async () => { let last; for (let i = 0; i < tries; i++) { try { return await once(); } catch (e) { last = e; await new Promise(r => setTimeout(r, 1500 * (i + 1))); } } throw new Error('could not reach Sifalo (' + (last && (last.code || last.message)) + ')'); })();
  }
  async function gateway(env, body) {   // POST /gateway/ with HTTP Basic (username:api_key)
    const c = creds(env); if (!c.user || !c.key) throw new Error(`No ${env} API keys saved`);
    return postJson(HOSTS[env].gateway, body, { Authorization: 'Basic ' + Buffer.from(`${c.user}:${c.key}`).toString('base64') });
  }
  const explain = j => String(j.code) === '0' ? 'Sifalo rejected the API username or key (code 0). Check them in Dashboard → Settings → Payments.' : String(j.code) === '404' ? 'Sifalo says a field is missing (code 404).' : 'Sifalo did not return a checkout session: ' + JSON.stringify(j).slice(0, 160);

  // hosted checkout: get key + token, the customer pays on Sifalo's page and comes back to return_url with ?sid=
  async function startCheckout(env, amount, returnUrl, webhookUrl) {
    const body = { amount: String(amount), gateway: 'checkout', currency: 'USD', return_url: returnUrl };
    if (webhookUrl && /^https:\/\//.test(webhookUrl)) body.webhook_url = webhookUrl;   // Sifalo needs a public HTTPS address
    const j = await gateway(env, body);
    if (!j.key || !j.token) throw new Error(explain(j));
    const once = v => { let x = String(v); try { x = decodeURIComponent(x); } catch { /* not encoded */ } return encodeURIComponent(x); };   // Sifalo may return the key already URL-encoded, encode exactly once
    return { checkoutUrl: `${HOSTS[env].checkout}?key=${once(j.key)}&token=${once(j.token)}` };
  }
  // verify.php does NOT use Basic auth; prefer sid (order_id only returns the most recent payment for that id)
  async function verify(env, body) {
    return postJson(new URL('verify.php', HOSTS[env].gateway).toString(), body);
  }
  // dashboard "Test connection": asks for a $1 checkout session (nothing is charged unless someone pays on that page)
  async function check(env, siteUrl) {
    if (!['sandbox', 'live'].includes(env)) return { ok: false, message: 'Choose sandbox or live.' };
    if (!hasCreds(env)) return { ok: false, message: `No ${env} API username/key saved yet.` };
    try { const j = await gateway(env, { amount: '1', gateway: 'checkout', currency: 'USD', return_url: siteUrl + '/consulting.html' }); return j.key && j.token ? { ok: true, message: `Connected to Sifalo ${env}, the keys work.` } : { ok: false, message: explain(j) }; }
    catch (e) { return { ok: false, message: 'Could not reach Sifalo: ' + e.message }; }
  }

  return { mode, required, ready, status, update, startCheckout, verify, check, hosts: HOSTS };
};
