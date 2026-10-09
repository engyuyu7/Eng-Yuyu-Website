// Entry point. Loads the saved data first (from Supabase when SUPABASE_URL is set, otherwise from the local data folder),
// then starts the website. All the real work is in app.js.
'use strict';
require('./lib/store').init()
  .then(() => require('./app.js'))
  .catch(e => { console.error('Could not start:', e.message); process.exit(1); });
