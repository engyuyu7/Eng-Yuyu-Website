// Vercel entry: runs the same server as "npm start", one request at a time through a function.
// Data lives in Supabase (SUPABASE_URL + SUPABASE_SERVICE_KEY), so any instance can serve any request.
'use strict';
const store = require('../server/lib/store');
let ready = null, active = 0;
module.exports = async (req, res) => {
  ready = ready || store.init().then(() => require('../server/app.js'));
  let srv; try { srv = await ready; } catch (e) { ready = null; res.statusCode = 503; res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ error: 'Starting up failed: ' + e.message })); }
  if (!active) await store.refresh();   // see changes saved by other instances (skipped while another request is running here)
  active++;
  const finished = new Promise(r => res.on('close', r));
  try { srv.emit('request', req, res); await finished; } finally { active--; await store.drain(); }
};
