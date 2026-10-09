// Tiny JSON "database" (files are owner-only: 0600 / folder 0700): named collections kept in memory and flushed atomically to server/data/<name>.json
'use strict';
const fs = require('fs');
const path = require('path');
const DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const cache = {}, timers = {};
const file = n => path.join(DIR, n + '.json');
function load(name, def) {
  if (cache[name]) return cache[name];
  try { cache[name] = JSON.parse(fs.readFileSync(file(name), 'utf8')); } catch { cache[name] = JSON.parse(JSON.stringify(def)); }
  return cache[name];
}
function flush(name) {
  clearTimeout(timers[name]); delete timers[name];
  try { fs.mkdirSync(DIR, { recursive: true, mode: 0o700 }); fs.writeFileSync(file(name) + '.tmp', JSON.stringify(cache[name]), { mode: 0o600 }); fs.renameSync(file(name) + '.tmp', file(name)); }
  catch (e) { console.error('store: save failed for', name, e.message); }
}
const save = name => { clearTimeout(timers[name]); timers[name] = setTimeout(() => flush(name), 80); };
const flushAll = () => Object.keys(timers).forEach(flush);
process.on('exit', flushAll);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { flushAll(); process.exit(0); });
module.exports = { load, save, flush, flushAll, DIR };
