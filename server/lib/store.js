// Tiny JSON "database": named collections kept in memory.
//  - Local mode (default): flushed atomically to server/data/<name>.json (files are owner-only: 0600 / folder 0700).
//  - Supabase mode (SUPABASE_URL + SUPABASE_SERVICE_KEY set): every collection is also saved to the `kv` table, and uploaded
//    pictures/videos go to a Storage bucket. On start-up the data is read from Supabase; any local file that Supabase does not
//    have yet is uploaded once (that is the migration). Local files stay as a backup copy.
// Run ONE server instance at a time (the data is held in memory).
'use strict';
const fs = require('fs');
const path = require('path');
const DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const SB_URL = String(process.env.SUPABASE_URL || '').replace(/\/+$/, ''), SB_KEY = process.env.SUPABASE_SERVICE_KEY || '', BUCKET = process.env.SUPABASE_BUCKET || 'uploads';
const remote = !!(SB_URL && SB_KEY);
const cache = {}, timers = {}, dirty = new Set();
const file = n => path.join(DIR, n + '.json');
// older "service_role" keys are JWTs (start with eyJ) and also go in Authorization; the newer "sb_secret_..." keys go in apikey only
const hdr = extra => ({ apikey: SB_KEY, ...(SB_KEY.startsWith('eyJ') ? { Authorization: 'Bearer ' + SB_KEY } : {}), ...extra });
const web = (url, opt, ms = 20000) => fetch(url, { ...opt, signal: AbortSignal.timeout(ms) });
const TYPES = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml', mp4: 'video/mp4', webm: 'video/webm' };

function load(name, def) {
  if (cache[name]) return cache[name];
  try { cache[name] = JSON.parse(fs.readFileSync(file(name), 'utf8')); } catch { cache[name] = JSON.parse(JSON.stringify(def)); }
  return cache[name];
}
function flush(name) {
  clearTimeout(timers[name]); delete timers[name];
  try { fs.mkdirSync(DIR, { recursive: true, mode: 0o700 }); fs.writeFileSync(file(name) + '.tmp', JSON.stringify(cache[name]), { mode: 0o600 }); fs.renameSync(file(name) + '.tmp', file(name)); }
  catch (e) { if (!remote) console.error('store: save failed for', name, e.message); }
}
const save = name => { clearTimeout(timers[name]); timers[name] = setTimeout(() => flush(name), 80); if (remote) { dirty.add(name); pushSoon(); } };
const flushAll = () => Object.keys(timers).forEach(flush);

// ---- Supabase: collections ----
let pushing = false, pushTimer = null;
function pushSoon(ms = 300) { clearTimeout(pushTimer); pushTimer = setTimeout(() => { pushDirty().catch(() => {}); }, ms); }
async function pushDirty() {
  if (!remote || pushing) return; pushing = true;
  try {
    while (dirty.size) {
      const names = [...dirty]; dirty.clear();
      try {
        const r = await web(`${SB_URL}/rest/v1/kv?on_conflict=name`, { method: 'POST', headers: hdr({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify(names.map(n => ({ name: n, data: cache[n], updated_at: new Date().toISOString() }))) });
        if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 200));
      } catch (e) { names.forEach(n => dirty.add(n)); console.error('store: could not save to Supabase, will retry:', e.message); pushSoon(15000); break; }
    }
  } finally { pushing = false; }
}
async function init() {
  if (!remote) return;
  const r = await web(`${SB_URL}/rest/v1/kv?select=name,data`, { headers: hdr() }).catch(e => { throw new Error('Supabase is not reachable: ' + e.message); });
  if (!r.ok) throw new Error('Supabase refused the request (' + r.status + '). Check SUPABASE_URL, SUPABASE_SERVICE_KEY and that the kv table exists. ' + (await r.text()).slice(0, 160));
  const rows = await r.json(), have = new Set();
  for (const row of rows) { cache[row.name] = row.data; have.add(row.name); }
  let moved = 0;   // one-time migration: local files Supabase does not have yet
  try { for (const f of fs.readdirSync(DIR)) { const m = f.match(/^([\w-]+)\.json$/); if (m && !have.has(m[1])) { try { cache[m[1]] = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); dirty.add(m[1]); moved++; } catch { /* skip unreadable file */ } } } } catch { /* no local folder */ }
  console.log(`store: connected to Supabase (${rows.length} collections loaded${moved ? ', ' + moved + ' local ones queued for upload' : ''})`);
  if (dirty.size) await pushDirty();
}

// ---- files (pictures, ad videos) ----
const okName = n => /^[a-f0-9]{16}\.(png|jpg|webp|svg|mp4|webm)$/.test(n);
async function putFile(name, buf) {
  if (!okName(name)) throw new Error('bad file name');
  const dir = path.join(DIR, 'uploads');
  try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, name), buf); } catch (e) { if (!remote) throw e; }
  if (remote) {
    const r = await web(`${SB_URL}/storage/v1/object/${BUCKET}/${name}`, { method: 'POST', headers: hdr({ 'Content-Type': TYPES[name.split('.').pop()] || 'application/octet-stream', 'x-upsert': 'true' }), body: buf }, 60000);
    if (!r.ok) throw new Error('Supabase storage refused the file (' + r.status + ') ' + (await r.text()).slice(0, 160));
  }
}
async function getFile(name) {
  if (!okName(name)) return null;
  const f = path.join(DIR, 'uploads', name);
  try { return fs.readFileSync(f); } catch { /* not on this disk */ }
  if (!remote) return null;
  try {
    const r = await web(`${SB_URL}/storage/v1/object/${BUCKET}/${name}`, { headers: hdr() }, 60000); if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    try { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, buf); } catch { /* disk is optional */ }
    return buf;
  } catch { return null; }
}

process.on('exit', flushAll);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { flushAll(); const done = () => process.exit(0); if (remote && dirty.size) { setTimeout(done, 5000).unref(); pushDirty().then(done, done); } else done(); });
module.exports = { load, save, flush, flushAll, init, putFile, getFile, DIR, remote };
