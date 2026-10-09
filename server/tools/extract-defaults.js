// Run after editing the built-in content in src/js/01-config.js / 03-content.js (npm run defaults): copies the site's built-in content (posts, events, partners, community links) from app.js into
// server/content-defaults.json so the dashboard starts with exactly what the website shows today.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'app.js'), 'utf8');
const grab = name => { const m = src.match(new RegExp('const ' + name + ' = (\\[[^\\n]*\\](?=;)|\\[[\\s\\S]*?\\n\\]);')); return m ? vm.runInNewContext('(' + m[1] + ')') : []; };
const out = { posts: grab('POSTS'), events: grab('EVENTS'), partners: grab('PARTNERS'), community: grab('COMMUNITY'), proof: grab('PROOF'), testimonials: grab('TESTIMONIALS'), media: grab('MEDIA'), sessions: grab('SESSIONS') };
fs.writeFileSync(path.join(__dirname, '..', 'content-defaults.json'), JSON.stringify(out, null, 1));
console.log(Object.entries(out).map(([k, v]) => k + ':' + v.length).join(' '));
