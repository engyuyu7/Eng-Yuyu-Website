// One-time helper: prints the GOOGLE_REFRESH_TOKEN for server/.env.
//   node server/tools/get-refresh-token.js <CLIENT_ID> <CLIENT_SECRET>
// Add http://localhost:8788/callback as an authorised redirect URI on the OAuth client first.
const http = require('http');
const [id, secret] = process.argv.slice(2);
if (!id || !secret) { console.log('Usage: node server/tools/get-refresh-token.js <CLIENT_ID> <CLIENT_SECRET>'); process.exit(1); }
const redirect = 'http://localhost:8788/callback';
const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: id, redirect_uri: redirect, response_type: 'code', access_type: 'offline', prompt: 'consent', scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.freebusy https://www.googleapis.com/auth/gmail.send' });
console.log('\nOpen this URL in your browser and approve access:\n\n' + url + '\n');
http.createServer(async (req, res) => {
  const code = new URL(req.url, redirect).searchParams.get('code');
  if (!code) { res.end('Waiting…'); return; }
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: id, client_secret: secret, redirect_uri: redirect, grant_type: 'authorization_code' }) });
  const j = await r.json();
  res.end(j.refresh_token ? 'Done — check your terminal. You can close this tab.' : 'No refresh token returned: ' + JSON.stringify(j));
  console.log(j.refresh_token ? '\nGOOGLE_REFRESH_TOKEN=' + j.refresh_token + '\n' : j);
  process.exit(0);
}).listen(8788);
