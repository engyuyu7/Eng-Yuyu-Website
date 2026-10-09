// One-off importer: copies the owner's own articles and events from the live engyuyu.com site into this website
// (through the dashboard API, so every rule and limit still applies).
//
//   node server/tools/import-engyuyu.js <dashboard-password> [site-url] [raw-folder]
//
//   site-url    where THIS website runs (default http://localhost:8787, e.g. https://your-new-domain.com)
//   raw-folder  a cache for the downloaded pages (default: a temp folder). Re-running re-uses it.
//
// What it does: downloads each article and event page (English + Somali), uploads the pictures, then
//   - creates the blog articles (published, with their original dates; future dates are published today)
//   - replaces the sample blog posts, events and media list with the real ones
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const [PASSWORD, SITE = 'http://localhost:8787', RAW = path.join(os.tmpdir(), 'engyuyu-import')] = process.argv.slice(2);
if (!PASSWORD) { console.error('Usage: node server/tools/import-engyuyu.js <dashboard-password> [site-url] [raw-folder]'); process.exit(1); }
const SRC = 'https://engyuyu.com', API = 'https://api.engyuyu.com/api/uploads';
fs.mkdirSync(RAW, { recursive: true });

const curl = (u, bin) => { for (let i = 0; i < 3; i++) { try { return execFileSync('curl', ['-4', '-sfL', '-m', '40', '-A', 'Mozilla/5.0', u], { maxBuffer: 80e6 }); } catch { /* retry */ } } return null; };
const page = (key, u) => { const f = path.join(RAW, key.replace(/[^\w.-]+/g, '_') + '.html'); if (fs.existsSync(f) && fs.statSync(f).size > 2000) return fs.readFileSync(f, 'utf8'); const b = curl(u); if (!b) return ''; fs.writeFileSync(f, b); return b.toString(); };

// ---------- parsing ----------
const dec = s => s.replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
const strip = s => dec(String(s).replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '')).replace(/[ \t]+/g, ' ').trim();
const clean = h => h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<svg[\s\S]*?<\/svg>/g, '');
const upId = u => (String(u).match(/uploads\/([a-f0-9]{24})/) || [])[1];
function body(main) {   // paragraphs and images, in reading order
  const seq = [];
  for (const m of main.matchAll(/<img[^>]*src="(https:\/\/api\.engyuyu\.com\/api\/uploads\/[a-f0-9]{24})"|<(h2|h3|p|li)\b[^>]*>([\s\S]*?)<\/\2>/g)) {
    if (m[1]) seq.push({ img: upId(m[1]) }); else { const t = strip(m[3]); if (t) seq.push({ [m[2]]: t }); }
  }
  return seq;
}
function article(h) {
  h = clean(h);
  const title = strip((h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '');
  const date = strip((h.match(/(?:Date|Taariikh)<\/span><p[^>]*>([^<]*)/) || [])[1] || '');
  const read = parseInt((h.match(/(?:Read|Akhri)<\/span><p[^>]*>(\d+)/) || [])[1] || '5', 10) || 5;
  const a = h.indexOf('<article'), z = h.indexOf('</article>', a);
  const seq = a < 0 ? [] : body(h.slice(a, z));
  const hero = upId((h.match(/https:\/\/api\.engyuyu\.com\/api\/uploads\/[a-f0-9]{24}/) || [])[0] || '');
  return { title, date, read, hero, paras: seq.filter(x => x.p || x.h2 || x.h3 || x.li) };
}
function eventPage(h) {
  h = clean(h);
  const i = h.indexOf('<h1'), aside = h.indexOf('<aside', i), main = h.slice(i, aside > 0 ? aside : undefined);
  const title = strip((main.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '');
  const seq = body(main.replace(/^<h1[\s\S]*?<\/h1>/, ''));
  const date = strip((main.match(/(?:Date|Taariikh)<\/span><\/div><p[^>]*>([^<]*)/) || [])[1] || '');
  return { title, date, seq };
}
const md = paras => paras.map(x => (x.h2 ? '## ' + x.h2 : x.h3 ? '### ' + x.h3 : x.li ? '- ' + x.li : x.p)).join('\n\n').replace(/\n\n(- [^\n]+)(?=\n\n- )/g, '\n$1');
const MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const isoDate = t => {   // "May 20, 2026" or "02/07/2026" (day first) or "31/3/2026 ..."
  let m = String(t).match(/([A-Za-z]{3})[a-z]* (\d{1,2}), (\d{4})/); if (m) return new Date(Date.UTC(+m[3], MON[m[1].toLowerCase()], +m[2], 9)).toISOString();
  m = String(t).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  return '';
};

// ---------- talking to this website ----------
let cookie = '';
const api = async (p, method = 'GET', b) => {
  const r = await fetch(SITE + '/api/admin' + p, { method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'yy-admin', ...(cookie ? { cookie } : {}) }, body: b ? JSON.stringify(b) : undefined });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = {}; }
  if (!r.ok) throw new Error(`${method} ${p}: ${j.error || r.status}`);
  return { j, r };
};
const imageCache = {};
async function upload(id) {   // copy a picture onto this website (webp, under 1 MB)
  if (!id) return '';
  if (imageCache[id] !== undefined) return imageCache[id];
  for (const size of ['1200.webp', '768.webp', '480.webp']) {
    const f = path.join(RAW, `${id}_${size}`); let buf = fs.existsSync(f) ? fs.readFileSync(f) : curl(`${API}/${id}/${size}`);
    if (!buf || buf.length < 500 || buf.length > 1040000) continue; fs.writeFileSync(f, buf);
    try { const { j } = await api('/upload', 'POST', { data: 'data:image/webp;base64,' + buf.toString('base64') }); imageCache[id] = j.url; return j.url; } catch (e) { console.log('  upload failed', id, e.message); }
  }
  imageCache[id] = ''; return '';
}

const catOf = t => /apple|iphone|ios|dji|lenovo|laptop|camera|android|samsung|pixel/i.test(t) ? 'gadgets' : /somalia|digital progress|creator|growth|youtube|monetiz/i.test(t) ? 'growth' : 'ai';
const typeOf = (t, media) => media ? 'media' : /attend|participat|discussion/i.test(t) ? 'attended' : /summit|forum|conference/i.test(t) ? 'conference' : /empower|workshop|training/i.test(t) ? 'workshop' : 'talk';
const TYPE = { conference: ['Conference', 'Shir'], talk: ['Talk', 'Hadal'], attended: ['Attended', 'La soo xaadiray'], workshop: ['Workshop', 'Aqoon-isweydaarsi'], media: ['Media', 'Warbaahin'] };
const ICON = { conference: 'mic', talk: 'mic', attended: 'spark', workshop: 'cap', media: 'video' };
const cut = (t, n) => { t = String(t); if (t.length <= n) return t; const k = t.lastIndexOf('. ', n - 1); return t.slice(0, k > n * 0.6 ? k + 1 : n - 1).trim(); };

(async () => {
  const slugs = { blog: [], events: [] };
  for (const [lang, sec] of [['en', 'tech-blog'], ['so', 'tech-blog'], ['en', 'events'], ['so', 'events']]) {
    const h = page(`${lang}-${sec}-list`, `${SRC}/${lang}/${sec}`); const k = sec === 'events' ? 'events' : 'blog';
    for (const m of h.matchAll(new RegExp(`href="/${lang}/${sec}/([^"?]+)"`, 'g'))) if (!slugs[k].includes(m[1])) slugs[k].push(m[1]);
  }
  console.log(`found ${slugs.blog.length} articles and ${slugs.events.length} events`);
  const l = await fetch(SITE + '/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'yy-admin' }, body: JSON.stringify({ password: PASSWORD }) });
  if (!l.ok) throw new Error('Could not sign in to ' + SITE + ' (wrong password, or two-step verification is on: turn it off for the import).');
  cookie = l.headers.get('set-cookie').split(';')[0];

  // ----- articles -----
  const old = (await api('/blog')).j.posts;
  let made = 0;
  for (const s of slugs.blog) {
    const en = article(page(`en-blog-${s}`, `${SRC}/en/tech-blog/${s}`)), so = article(page(`so-blog-${s}`, `${SRC}/so/tech-blog/${s}`));
    const e = en.title ? en : so, o = so.title ? so : en;
    if (!e.title || !e.paras.length) { console.log('skip (no content):', s); continue; }
    const when = isoDate(en.date || so.date); const t = Date.parse(when);
    const cover = await upload(en.hero || so.hero);
    const excerpt = cut(e.paras.find(x => x.p).p, 300), excerptSo = cut((o.paras.find(x => x.p) || { p: '' }).p, 300);
    const payload = { en: { title: e.title, excerpt, body: md(e.paras) }, so: { title: o.title, excerpt: excerptSo, body: md(o.paras) }, cat: catOf(e.title + ' ' + o.title), tags: [], cover, status: 'published', publishAt: t && t <= Date.now() ? when : undefined, notify: false, featured: made === 0, slug: s.replace(/^ios-27.*/, 'ios-27-is-here-siri-ai-apple-intelligence-and-more-than-120-security-fixes').slice(0, 80) };
    await api('/blog', 'POST', payload); made++; console.log('article:', e.title.slice(0, 70));
  }
  for (const p of old.filter(x => x.sample)) await api('/blog/' + p.id, 'DELETE');   // the demo articles
  console.log(`articles created: ${made}; demo articles removed: ${old.filter(x => x.sample).length}`);

  // ----- events + media stories -----
  const events = [];
  for (const s of slugs.events) {
    const media = s.startsWith('media/'), en = eventPage(page(`en-ev-${s}`, `${SRC}/en/events/${s}`)), so = eventPage(page(`so-ev-${s}`, `${SRC}/so/events/${s}`));
    const e = en.title ? en : so, o = so.title ? so : en; if (!e.title) { console.log('skip event:', s); continue; }
    const txt = x => x.seq.filter(y => y.p || y.h2 || y.li).map(y => y.p || y.h2 || y.li).filter(t => !/^(Media|Welcome & Introduction|Soo Dhaweyn)/i.test(t) || t.length > 40);
    const clean2 = x => { const t = txt(x).map(v => v.replace(/^(Welcome & Introduction|Soo Dhaweyn & Hordhac)/i, '').trim()).filter(Boolean); return t; };
    const pe = clean2(e), po = clean2(o);
    const ids = [...new Set(e.seq.filter(y => y.img).map(y => y.img))].slice(0, 4), images = [];
    for (const id of ids) { const u = await upload(id); if (u) images.push(u); }
    const type = typeOf(e.title, media), d = isoDate(en.date || so.date) || new Date().toISOString().slice(0, 10);
    events.push({ feature: false, icon: ICON[type], tag: TYPE[type], type, images, article: { en: cut(pe.slice(1).join('\n\n'), 6000), so: cut(po.slice(1).join('\n\n'), 6000) }, place: '', date: d.slice(0, 10), en: [e.title, cut(pe[0] || '', 600)], so: [o.title, cut(po[0] || pe[0] || '', 600)] });
    console.log('event:', e.title.slice(0, 70), `(${images.length} photos)`);
  }
  events.sort((a, b) => b.date.localeCompare(a.date)); if (events[0]) events[0].feature = true;
  if (events.length) { await api('/content/events', 'PUT', events); await api('/content/media', 'PUT', []); await api('/content/posts', 'PUT', []); }
  console.log(`events saved: ${events.length}; demo events, media and sample cards cleared`);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
