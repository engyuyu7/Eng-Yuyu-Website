// Builds the two browser bundles from the ordered source parts, no dependencies.
//   src/js/*.js  → public/app.js        src/css/*.css → public/styles.css
// Parts are joined in file-name order, so the numeric prefix IS the load order (CSS order matters for the cascade).
// The server runs this at start-up, so you only need to edit a part and restart (or run `npm run build`).
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const BUNDLES = [['js', 'app.js'], ['css', 'styles.css']];

function build() {
  const out = [];
  for (const [dir, file] of BUNDLES) {
    const srcDir = path.join(__dirname, dir);
    const parts = fs.readdirSync(srcDir).filter(f => f.endsWith('.' + dir)).sort();
    const code = parts.map(p => fs.readFileSync(path.join(srcDir, p), 'utf8')).join('');
    const target = path.join(ROOT, 'public', file);
    let current = ''; try { current = fs.readFileSync(target, 'utf8'); } catch { /* first build */ }
    if (current !== code) { fs.writeFileSync(target, code); out.push(`${file} (${parts.length} parts, ${code.length} bytes)`); }
  }
  return out;
}
module.exports = { build };
if (require.main === module) { const r = build(); console.log(r.length ? 'Built: ' + r.join(', ') : 'Up to date.'); }
