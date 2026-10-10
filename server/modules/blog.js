// Tech Blog: server-rendered pages (SEO), reactions, comments, sharing data, sitemap/RSS, email-to-subscribers, dashboard API.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

module.exports = function (ctx) {
  const { ENV, MOCK, store, settings, sendMail, esc, readJson, limited, SITE_URL } = ctx;
  const admin = () => ctx.admin;
  const ROOT = path.join(__dirname, '..', '..', 'public');
  const SITE = () => (ENV.SITE_URL || SITE_URL || '').replace(/\/$/, '');
  const db = store.load('blog', { posts: [], comments: [] });
  const subscribers = store.load('subscribers', []);
  const secret = store.load('secret', { value: crypto.randomBytes(32).toString('hex') });
  const uid = () => crypto.randomBytes(6).toString('hex');
  const save = () => store.save('blog');
  const CATS = { ai: ['AI', 'AI'], gadgets: ['Gadgets', 'Aalado'], dev: ['Development', 'Horumarin'], growth: ['Digital Growth', 'Koboc Dijitaal'], security: ['Security', 'Amni'] };
  const REACTIONS = ['like', 'love', 'fire', 'idea'];
  const AUTHOR = 'Eng Yuyu';
  const authors = store.load('authors', []);   // contributors (managed in modules/writers.js)
  const byline = p => { const a = p.authorId && authors.find(x => x.id === p.authorId); return a ? { name: a.name, slug: a.slug, photo: a.photo || '', bio: a.bio || {}, social: a.social || {}, guest: true } : p.authorId ? { name: p.authorName || 'Guest writer', slug: '', photo: '', bio: {}, social: {}, guest: true } : { name: AUTHOR, slug: '', photo: '', bio: {}, social: {}, guest: false }; };
  const authorUrl = (a, lang) => a.slug ? `${lang === 'so' ? '/so' : ''}/blog/author/${a.slug}` : '';

  // ---------- helpers ----------
  const clean = (s, n) => String(s == null ? '' : s).trim().slice(0, n);
  const slugify = s => String(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'post';
  function uniqueSlug(base, selfId) { let s = slugify(base), n = 2; while (db.posts.some(p => p.slug === s && p.id !== selfId)) s = slugify(base) + '-' + n++; return s; }
  function ytId(u) {
    const m = String(u || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/|v\/))([A-Za-z0-9_-]{11})/);
    return m ? m[1] : (/^[A-Za-z0-9_-]{11}$/.test(String(u || '').trim()) ? String(u).trim() : '');
  }
  const ytThumb = (id, q = 'maxresdefault') => `https://img.youtube.com/vi/${id}/${q}.jpg`;
  const wordCount = t => (String(t || '').match(/\S+/g) || []).length;
  const readMin = p => Math.max(1, Math.round(wordCount((p.en && p.en.body) || '') / 200));
  const isLive = p => p.status === 'published' && p.publishedAt <= Date.now();
  const voter = req => crypto.createHash('sha256').update(secret.value + (req.clientIp || req.socket.remoteAddress || '') + String(req.headers['user-agent'] || '')).digest('hex').slice(0, 14);
  const fmtDate = (ms, lang) => new Intl.DateTimeFormat(lang === 'so' ? 'so' : 'en', { day: 'numeric', month: 'long', year: 'numeric' }).format(ms);
  const hasSo = p => !!(p.so && p.so.title && p.so.body);
  const pick = (p, lang) => (lang === 'so' && hasSo(p) ? p.so : p.en);
  const imageOf = p => p.cover || (p.video && p.video.id ? ytThumb(p.video.id) : '');
  const url = (p, lang) => `${SITE()}${lang === 'so' ? '/so' : ''}/blog/${p.slug}`;

  // ---------- markdown-lite → HTML (input is escaped first) ----------
  const okUrl = u => /^(https?:\/\/|\/|mailto:|#)/i.test(u);
  function inline(s) {
    return s
      .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, u) => (/^https?:\/\//i.test(u) ? `<img src="${u}" alt="${alt}" loading="lazy">` : m))
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => (okUrl(u) ? `<a href="${u}"${/^https?:/i.test(u) ? ' rel="noopener" target="_blank"' : ''}>${t}</a>` : t))
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  }
  function videoCard(u, label) {
    const id = ytId(u); if (!id) return '';
    return `<a class="video-card" href="https://www.youtube.com/watch?v=${id}" target="_blank" rel="noopener" data-video="${id}"><img src="${ytThumb(id)}" data-fb="${ytThumb(id, 'hqdefault')}" alt="Video thumbnail" loading="lazy" width="1280" height="720"><span class="play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/></svg></span><span class="vc-label">${esc(label)}</span></a>`;
  }
  function md(src, lang) {
    const lines = esc(src || '').replace(/&amp;/g, '&amp;').split(/\r?\n/);
    const out = []; let para = [], list = null, quote = [];
    const flushP = () => { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } };
    const flushL = () => { if (list) { out.push(`<${list.t}>${list.items.map(i => `<li>${inline(i)}</li>`).join('')}</${list.t}>`); list = null; } };
    const flushQ = () => { if (quote.length) { out.push('<blockquote><p>' + inline(quote.join(' ')) + '</p></blockquote>'); quote = []; } };
    const flush = () => { flushP(); flushL(); flushQ(); };
    for (const raw of lines) {
      const l = raw.trimEnd(); let m;
      if (!l.trim()) { flush(); continue; }
      if ((m = l.match(/^\{\{\s*youtube\s+([^}\s]+)\s*\}\}$/i))) { flush(); out.push(videoCard(m[1].replace(/&amp;/g, '&'), lang === 'so' ? 'Daawo muuqaalka YouTube' : 'Watch the video on YouTube')); continue; }
      if ((m = l.match(/^(#{1,3})\s+(.*)$/))) { flush(); const lv = Math.min(4, m[1].length + 1); out.push(`<h${lv} id="${slugify(m[2])}">${inline(m[2])}</h${lv}>`); continue; }
      if (/^---+$/.test(l.trim())) { flush(); out.push('<hr>'); continue; }
      if ((m = l.match(/^&gt;\s?(.*)$/))) { flushP(); flushL(); quote.push(m[1]); continue; }
      if ((m = l.match(/^[-*]\s+(.*)$/))) { flushP(); flushQ(); if (!list || list.t !== 'ul') { flushL(); list = { t: 'ul', items: [] }; } list.items.push(m[1]); continue; }
      if ((m = l.match(/^\d+[.)]\s+(.*)$/))) { flushP(); flushQ(); if (!list || list.t !== 'ol') { flushL(); list = { t: 'ol', items: [] }; } list.items.push(m[1]); continue; }
      flushL(); flushQ(); para.push(l.trim());
    }
    flush(); return out.join('\n');
  }
  const plain = s => String(s || '').replace(/\{\{[^}]*\}\}/g, '').replace(/[#>*`_\[\]()!-]/g, ' ').replace(/\s+/g, ' ').trim();

  // ---------- page chrome (header/footer reused from the website so the blog looks identical) ----------
  let chrome = null;
  function getChrome() {
    if (chrome && !MOCK) return chrome;
    const src = fs.readFileSync(path.join(ROOT, 'consulting.html'), 'utf8');
    const a = src.indexOf('<main id="main">'), b = src.indexOf('</main>');
    const abs = h => h.replace(/(href|src)="(?!https?:|\/|#|mailto:|data:)([^"]+)"/g, '$1="/$2"').replace('href="/./"', 'href="/"').replace(/href="#contact-cta"/g, 'href="/index.html#contact"').replace(/href="\/index\.html#blog"/g, 'href="/blog"').replace(/\/consulting\.html"( aria-current="page")/, '/consulting.html"');
    let head = abs(src.slice(0, a)), foot = abs(src.slice(b + 7));
    head = head.replace(/<title>[^<]*<\/title>\s*/, '').replace(/<meta name="description"[^>]*>\s*/, '').replace(/<meta name="theme-color"[^>]*>\s*/, '').replace(/<link rel="icon"[^>]*>\s*/, '')
      .replace(/<a href="\/consulting\.html" aria-current="page"/, '<a href="/consulting.html"').replace(/<a href="\/blog"([^>]*)>/, '<a href="/blog" aria-current="page"$1>');
    chrome = { head, foot };
    return chrome;
  }
  const T = {
    en: { aboutWriter: 'About the writer', moreBy: 'More from', byWriter: 'Articles by', writerIntro: 'Guest writer on the Eng Yuyu Tech Blog', sort: 'Sort', newest: 'Newest', oldest: 'Oldest', popular: 'Most read', gridView: 'Grid view', listView: 'List view', toc: 'In this article', aboutAuthor: 'About the author', authorBio: 'Somali tech educator and digital media consultant, helping more than a million people understand technology and grow online.', bookCta: 'Book a session', subCta: 'Get new guides by email', prevPost: 'Newer article', nextPost: 'Older article', blog: 'Tech Blog', title: 'Technology, explained properly.', lead: 'Practical guides on AI, phones, security and growing online, each one with a video you can watch.', all: 'All', search: 'Search articles…', read: 'Read article', watch: 'Watch the video', min: 'min read', views: 'views', home: 'Home', related: 'Keep reading', share: 'Share this article', copy: 'Copy link', copied: 'Link copied', comments: 'Comments', leave: 'Leave a comment', name: 'Your name', email: 'Email (never shown)', msg: 'Your comment', post: 'Post comment', pending: 'Thanks! Your comment is awaiting approval.', posted: 'Thanks! Your comment is live.', none: 'No comments yet: be the first.', reactTitle: 'Did you enjoy this?', by: 'By', videoCta: 'Watch the full video on YouTube', videoCtaP: 'See every step on screen, the video goes deeper than this article.', noPosts: 'No articles found.', page: 'Page', prev: 'Previous', next: 'Next', featured: 'Featured', nlTitle: 'Get new articles and videos by email', toc: 'Updated', like: 'Like', love: 'Love', fire: 'Fire', idea: 'Insightful', sub: 'Subscribe on YouTube' },
    so: { aboutWriter: 'Ku saabsan qoraaga', moreBy: 'Wax kale oo ka mid ah', byWriter: 'Maqaallada', writerIntro: 'Qoraa martida ah ee Blog-ka Tiknolojiyada ee Eng Yuyu', sort: 'Kala saar', newest: 'Kuwa ugu cusub', oldest: 'Kuwa ugu da’weyn', popular: 'Kuwa ugu akhriska badan', gridView: 'Muuqaal shabakad', listView: 'Muuqaal liis', toc: 'Maqaalkan ku jira', aboutAuthor: 'Ku saabsan qoraaga', authorBio: 'Macallin tiknoolajiyad Soomaali ah iyo la-taliye warbaahin dijitaal ah, oo caawiya in ka badan hal milyan qof inay fahmaan tiknoolajiyada oo koraan online.', bookCta: 'Ballan qabso kulan', subCta: 'Ku hel hagayaasha cusub email', prevPost: 'Maqaal cusub', nextPost: 'Maqaal hore', blog: 'Blog-ka Tiknolojiyada', title: 'Tiknolojiyada, si sax ah loo sharaxay.', lead: 'Hage wax ku ool ah oo ku saabsan AI, taleefannada, amniga iyo kobcinta online-ka, mid walba muuqaal ayaa la socda.', all: 'Dhammaan', search: 'Raadi maqaallo…', read: 'Akhri maqaalka', watch: 'Daawo muuqaalka', min: 'daqiiqo akhris', views: 'daawasho', home: 'Hoyga', related: 'Sii akhri', share: 'La wadaag maqaalkan', copy: 'Koobiyee linkiga', copied: 'Linkiga waa la koobiyeeyay', comments: 'Faallooyin', leave: 'Faallo reeb', name: 'Magacaaga', email: 'Email (lama muujiyo)', msg: 'Faalladaada', post: 'Dir faallada', pending: 'Mahadsanid! Faalladaada waa la sugayaa ansixin.', posted: 'Mahadsanid! Faalladaada waa soo baxday.', none: 'Wali faallo ma jirto, noqo kii ugu horreeya.', reactTitle: 'Ma ku riyaaqday?', by: 'Qoraa:', videoCta: 'Daawo muuqaalka oo dhan YouTube', videoCtaP: 'Arag tallaabo kasta shaashadda, muuqaalku wuu ka qoto dheeraadaa maqaalkan.', noPosts: 'Maqaal lama helin.', page: 'Boggga', prev: 'Hore', next: 'Xiga', featured: 'La soo xusay', nlTitle: 'Hel maqaallo iyo muuqaallo cusub email ahaan', toc: 'La cusboonaysiiyay', like: 'Jeclaaday', love: 'Jacayl', fire: 'Dab', idea: 'Aqoon leh', sub: 'YouTube ku rukumo' },
  };
  const ICON = {
    like: '<path d="M7 11v9H4v-9zM7 11l4-7c1.4 0 2.2 1.2 1.8 2.5L12 10h6.2a2 2 0 0 1 2 2.4l-1.3 6A2 2 0 0 1 17 20H7"/>',
    love: '<path d="M12 20.5s-8-4.6-8-10.2A4.3 4.3 0 0 1 12 8a4.3 4.3 0 0 1 8 2.3c0 5.600-8 10.200-8 10.200Z"/>',
    fire: '<path d="M12 3c1 3.500 5 5.500 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 .2 1.500 1 2 2 2 0-2-1-4 1-8Z"/>',
    idea: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.500 10.900c.6.500 1 1.200 1 2v.100h5v-.100c0-.8.400-1.500 1-2A6 6 0 0 0 12 3Z"/>',
  };
  const svgI = n => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;

  function layout({ lang, title, description, canonical, image, type = 'website', alt, ldjson = [], bodyClass = '', main, extraHead = '', scripts = '', noindex = false, hreflang = [], published, modified }) {
    const c = getChrome(), t = T[lang];
    const robots = noindex ? '<meta name="robots" content="noindex,nofollow">' : '<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">';
    const seo = `<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${robots}
<link rel="canonical" href="${esc(canonical)}">
${hreflang.map(h => `<link rel="alternate" hreflang="${h[0]}" href="${esc(h[1])}">`).join('\n')}
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/assets/favicon-32.png" sizes="32x32" type="image/png">
<link rel="icon" href="/assets/favicon-48.png" sizes="48x48" type="image/png">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="manifest" href="/assets/site.webmanifest">
<meta name="theme-color" content="#006AFF">
<meta property="og:site_name" content="Eng Yuyu">
<meta property="og:type" content="${type}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:locale" content="${lang === 'so' ? 'so_SO' : 'en_US'}">
${image ? `<meta property="og:image" content="${esc(image)}"><meta property="og:image:width" content="1280"><meta property="og:image:height" content="720">` : ''}
${published ? `<meta property="article:published_time" content="${new Date(published).toISOString()}">` : ''}${modified ? `<meta property="article:modified_time" content="${new Date(modified).toISOString()}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
${image ? `<meta name="twitter:image" content="${esc(image)}">` : ''}
<link rel="alternate" type="application/rss+xml" title="Eng Yuyu | Tech Blog" href="/blog/feed.xml">
${ldjson.map(j => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n')}
${extraHead}`;
    let head = c.head.replace('<html lang="en"', `<html lang="${lang}"`).replace('<body data-page="consulting">', `<body data-page="blog" data-api="" data-alt="${esc(alt || '')}" class="${bodyClass}">`).replace('</head>', seo + '\n</head>');
    const foot = c.foot.replace('<script src="/app.js"></script>', `<script src="/app.js"></script>${scripts}`);
    return head + `<main id="main">${main}</main>` + foot;
  }

  // ---------- cards / lists ----------
  function card(p, lang, i = 0) {
    const d = pick(p, lang), t = T[lang], img = imageOf(p), href = `${lang === 'so' ? '/so' : ''}/blog/${p.slug}`, by = byline(p);
    return `<a class="post" href="${href}" style="--i:${i}"><div class="post-art">${img ? `<img src="${esc(img)}" alt="" loading="lazy" width="640" height="360" data-fb="${p.video && p.video.id ? ytThumb(p.video.id, 'hqdefault') : ''}">` : ''}<span class="tag">${esc(CATS[p.cat] ? CATS[p.cat][lang === 'so' ? 1 : 0] : p.cat)}</span>${p.video ? '<span class="play-badge" aria-label="Video"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.500v13l11-6.500z" fill="currentColor" stroke="none"/></svg></span>' : ''}</div><div class="post-body"><h3>${esc(d.title)}</h3><p>${esc(d.excerpt)}</p><div class="meta"><time datetime="${new Date(p.publishedAt).toISOString()}">${fmtDate(p.publishedAt, lang)}</time><span aria-hidden="true">·</span><span>${readMin(p)} ${t.min}</span>${by.guest ? `<span aria-hidden="true">·</span><span>${t.by} ${esc(by.name)}</span>` : ''}</div></div></a>`;
  }
  const livePosts = () => db.posts.filter(isLive).sort((a, b) => b.publishedAt - a.publishedAt);
  const reactTotals = p => Object.fromEntries(REACTIONS.map(r => [r, (p.reactions && p.reactions[r]) || 0]));
  const approved = p => db.comments.filter(c => c.postId === p.id && c.status === 'approved').sort((a, b) => a.createdAt - b.createdAt);

  function indexPage(lang, q) {
    const t = T[lang], cat = clean(q.get('cat'), 20), term = clean(q.get('q'), 60).toLowerCase(), page = Math.max(1, +q.get('page') || 1), PER = 9, sort = ['oldest', 'popular'].includes(q.get('sort')) ? q.get('sort') : 'newest';
    let list = livePosts().filter(p => lang === 'en' || hasSo(p) || true);
    if (cat && CATS[cat]) list = list.filter(p => p.cat === cat);
    if (term) list = list.filter(p => [p.en.title, p.en.excerpt, p.so && p.so.title, (p.tags || []).join(' ')].join(' ').toLowerCase().includes(term));
    if (sort === 'oldest') list = [...list].sort((a, b) => a.publishedAt - b.publishedAt); else if (sort === 'popular') list = [...list].sort((a, b) => (b.views || 0) - (a.views || 0));
    const featured = !cat && !term && page === 1 && sort === 'newest' ? list.find(p => p.featured) || null : null;
    const rest = featured ? list.filter(p => p !== featured) : list, pages = Math.max(1, Math.ceil(rest.length / PER)), slice = rest.slice((page - 1) * PER, page * PER);
    const base = `${lang === 'so' ? '/so' : ''}/blog`, qs = (o0) => { const o = { sort: sort !== 'newest' ? sort : '', ...o0 }; return qsRaw(o); }, qsRaw = (o) => { const u = new URLSearchParams(); for (const [k, v] of Object.entries(o)) if (v) u.set(k, v); const s = u.toString(); return base + (s ? '?' + s : ''); };
    const canonical = SITE() + base + (cat ? `?cat=${cat}` : '') + (page > 1 ? `${cat ? '&' : '?'}page=${page}` : '');
    const fd = featured ? pick(featured, lang) : null;
    const main = `
<section class="blog-hero"><div class="wrap">
  <div class="bh-top">
    <div class="bh-copy"><h1>${t.title}</h1><p class="lead">${t.lead}</p></div>
    <form class="blog-search" role="search" action="${base}" method="get"><label class="sr-only" for="bq">${t.search}</label><input id="bq" type="search" name="q" value="${esc(term)}" placeholder="${t.search}">${cat ? `<input type="hidden" name="cat" value="${esc(cat)}">` : ''}<button class="btn btn-primary" type="submit">${lang === 'so' ? 'Raadi' : 'Search'}</button></form>
  </div>
  <div class="blog-bar"><nav class="cat-tabs" aria-label="Categories"><a href="${qs({ sort: sort !== 'newest' ? sort : '' })}" aria-current="${!cat ? 'true' : 'false'}">${t.all} <small>${livePosts().length}</small></a>${Object.entries(CATS).filter(([k]) => db.posts.some(p => p.cat === k && isLive(p))).map(([k, v]) => `<a href="${qs({ cat: k })}" aria-current="${cat === k ? 'true' : 'false'}">${v[lang === 'so' ? 1 : 0]} <small>${livePosts().filter(p => p.cat === k).length}</small></a>`).join('')}</nav>
  <div class="blog-tools"><details class="sort"><summary>${t.sort}: ${t[sort]}</summary><div class="sort-menu">${['newest', 'oldest', 'popular'].map(k => `<a href="${qsRaw({ cat, q: term, sort: k !== 'newest' ? k : '' })}" aria-current="${sort === k}">${t[k]}</a>`).join('')}</div></details>
</div></div>
</div></section>
<section class="section"><div class="wrap blog-layout"><div class="blog-main">
${featured ? `<a class="feature-post" href="${base}/${featured.slug}"><div class="fp-art"><img src="${esc(imageOf(featured))}" alt="" width="1280" height="720" loading="eager">${featured.video ? '<span class="play-badge big"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.500v13l11-6.500z" fill="currentColor" stroke="none"/></svg></span>' : ''}</div><div class="fp-body"><span class="tag">${t.featured}</span><h2>${esc(fd.title)}</h2><p>${esc(fd.excerpt)}</p><span class="meta">${fmtDate(featured.publishedAt, lang)} · ${readMin(featured)} ${t.min}</span><span class="more">${t.read} →</span></div></a>` : ''}

${slice.length ? `<div class="post-grid">${slice.map((p, i) => card(p, lang, i)).join('')}</div>` : `<p class="empty">${t.noPosts}</p>`}
${pages > 1 ? `<nav class="pager" aria-label="Pagination">${page > 1 ? `<a class="btn" href="${qs({ cat, q: term, page: page - 1 > 1 ? page - 1 : '' })}">← ${t.prev}</a>` : ''}<span>${t.page} ${page} / ${pages}</span>${page < pages ? `<a class="btn" href="${qs({ cat, q: term, page: page + 1 })}">${t.next} →</a>` : ''}</nav>` : ''}
</div><aside class="ad-rail" aria-label="Sponsored">${topBlock(lang)}<div class="ad-slot" id="adSlot"></div></aside></div></section>
${nlBlock(lang)}`;
    const ld = [{ '@context': 'https://schema.org', '@type': 'Blog', name: 'Eng Yuyu | Tech Blog', url: SITE() + '/blog', inLanguage: lang, publisher: { '@type': 'Person', name: AUTHOR } },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: SITE() + '/' }, { '@type': 'ListItem', position: 2, name: 'Tech Blog', item: SITE() + '/blog' }] }];
    return layout({ lang, title: (cat && CATS[cat] ? CATS[cat][0] + ' | ' : '') + 'Tech Blog | Eng Yuyu', description: lang === 'so' ? 'Maqaallo tiknolojiyo oo cad: AI, taleefannada, amniga iyo kobcinta online-ka, muuqaal YouTube ah la socda.' : 'Practical technology articles on AI, phones, security and growing online by Eng Yuyu | each with a video on YouTube.', canonical, alt: lang === 'so' ? '/blog' : '/so/blog', hreflang: [['en', SITE() + '/blog'], ['so', SITE() + '/so/blog'], ['x-default', SITE() + '/blog']], ldjson: ld, main, image: featured ? imageOf(featured) : '', noindex: !!term });
  }
  const initials = n => String(n).split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toUpperCase();
  function topBlock(lang) {   // public "Top contributors this month" (top 3 writers; hidden when nobody has published yet)
    let top = []; try { top = ctx.writers ? ctx.writers.publicTop(3) : []; } catch { /* ignore */ }
    if (!top.length) return '';
    const so = lang === 'so', month = new Date(Date.now() + 3 * 36e5).toLocaleString(so ? 'so' : 'en', { month: 'long', timeZone: 'UTC' });
    return `<section class="top-writers" aria-label="${so ? 'Qorayaasha ugu firfircoon' : 'Top contributors'}"><h2>${so ? 'Qorayaasha ugu firfircoon' : 'Top contributors'} <small>${esc(month)}</small></h2><ol>${top.map(x => `<li><span class="tw-rank r${x.rank}" aria-hidden="true">${x.rank}</span><a class="tw-who" href="${esc(authorUrl(x, lang))}">${x.photo ? `<img src="${esc(x.photo)}" alt="" width="40" height="40" loading="lazy">` : `<span class="tw-ph" aria-hidden="true">${esc(initials(x.name))}</span>`}<b>${esc(x.name)}</b></a><small>${x.month} ${so ? (x.month === 1 ? 'maqaal' : 'maqaallo') : (x.month === 1 ? 'article' : 'articles')}${x.streak > 1 ? ` · ${x.streak}-week streak` : ''}</small></li>`).join('')}</ol></section>`;
  }
  function nlBlock(lang) {
    const t = T[lang];
    return `<section class="newsletter" id="newsletter"><div class="wrap"><div class="nl-card"><div class="nl-copy"><p class="kicker light">${lang === 'so' ? 'Wargeyska Tiknolojiyada' : 'Tech Newsletter'}</p><h2>${t.nlTitle}</h2><p>${lang === 'so' ? 'Hal email oo kooban, spam la’aan.' : 'One concise email, no spam. Unsubscribe any time.'}</p></div><form class="nl-form" id="nlForm" novalidate><label for="nlEmail">${lang === 'so' ? 'Cinwaanka email-ka' : 'Email address'}</label><div class="nl-row"><input id="nlEmail" name="email" type="email" inputmode="email" autocomplete="email" required placeholder="you@example.com" aria-describedby="nlMsg"><button class="btn btn-light" type="submit">${lang === 'so' ? 'Isdiiwaangeli' : 'Subscribe'}</button></div><p class="form-msg" id="nlMsg" role="status" aria-live="polite"></p></form></div></div></section>`;
  }

  function postPage(p, lang, preview) {
    const d = pick(p, lang), t = T[lang], img = imageOf(p), canonical = url(p, lang), base = lang === 'so' ? '/so' : '', altLang = lang === 'so' ? 'en' : 'so';
    const bodyHtml = md(d.body, lang);
    const videoUrl = p.video ? `https://www.youtube.com/watch?v=${p.video.id}` : '';
    const comments = approved(p), tot = reactTotals(p);
    const related = livePosts().filter(x => x.id !== p.id).sort((a, b) => (b.cat === p.cat) - (a.cat === p.cat) || b.publishedAt - a.publishedAt).slice(0, 3);
    const desc = (p.seo && p.seo.description) || d.excerpt || plain(d.body).slice(0, 155);
    const title = (lang === 'en' && p.seo && p.seo.title) || d.title;
    const shareUrl = encodeURIComponent(canonical), shareTitle = encodeURIComponent(d.title);
    const main = `
<div class="read-progress" aria-hidden="true"><i></i></div>
<article class="post-page" data-slug="${p.slug}" data-id="${p.id}" data-lang="${lang}">
<header class="post-head"><div class="wrap narrow">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">${t.home}</a><span aria-hidden="true">/</span><a href="${base}/blog">${t.blog}</a><span aria-hidden="true">/</span><span aria-current="page">${esc(CATS[p.cat] ? CATS[p.cat][lang === 'so' ? 1 : 0] : p.cat)}</span></nav>
  <a class="chip" href="${base}/blog?cat=${p.cat}" aria-pressed="true">${esc(CATS[p.cat] ? CATS[p.cat][lang === 'so' ? 1 : 0] : p.cat)}</a>
  <h1>${esc(d.title)}</h1>
  <p class="post-lead">${esc(d.excerpt)}</p>
  <p class="post-meta"><span>${t.by} ${(() => { const a = byline(p); return a.slug ? `<a href="${authorUrl(a, lang)}"><b>${esc(a.name)}</b></a>` : `<b>${esc(a.name)}</b>`; })()}</span><span aria-hidden="true">·</span><time datetime="${new Date(p.publishedAt).toISOString()}">${fmtDate(p.publishedAt, lang)}</time><span aria-hidden="true">·</span><span>${readMin(p)} ${t.min}</span><span aria-hidden="true">·</span><span id="viewCount">${(p.views || 0).toLocaleString('en')} ${t.views}</span></p>
</div></header>
<div class="wrap post-layout"><div class="post-main">
  ${p.video ? videoCard(videoUrl, t.videoCta) : (img ? `<figure class="post-cover"><img src="${esc(img)}" alt="${esc(d.title)}" width="1280" height="720"></figure>` : '')}
  <nav class="toc" id="toc" aria-label="${t.toc}" data-title="${t.toc}" hidden></nav>
  <div class="article">${bodyHtml}</div>
  ${p.video ? `<aside class="video-cta"><div class="vc-thumb"><img src="${ytThumb(p.video.id, 'hqdefault')}" alt="" loading="lazy" width="480" height="360"></div><div><h2>${t.videoCta}</h2><p>${t.videoCtaP}</p><a class="btn btn-primary" href="${videoUrl}" target="_blank" rel="noopener" data-track="video_click"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.500v13l11-6.500z" fill="currentColor" stroke="none"/></svg>${t.watch}</a> <a class="btn btn-ghost" href="https://www.youtube.com/@engyuyu?sub_confirmation=1" target="_blank" rel="noopener" data-track="subscribe_click">${t.sub}</a></div></aside>` : ''}
  ${(p.tags || []).length ? `<ul class="tags" aria-label="Tags">${p.tags.map(x => `<li>#${esc(x)}</li>`).join('')}</ul>` : ''}
  <section class="engage" aria-label="Engage">
    <div class="reactions" role="group" aria-label="${t.reactTitle}"><p class="label">${t.reactTitle}</p><div>${REACTIONS.map(r => `<button class="react" type="button" data-r="${r}" aria-pressed="false" aria-label="${t[r]}">${svgI(r)}<span>${t[r]}</span><b>${tot[r]}</b></button>`).join('')}</div></div>
    <div class="share" role="group" aria-label="${t.share}"><p class="label">${t.share}</p><div>
      <button class="sh" type="button" data-share="copy" data-copied="${t.copied}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.600 0l3-3a4 4 0 0 0-5.600-5.600l-1 1M14 10a4 4 0 0 0-5.600 0l-3 3a4 4 0 0 0 5.600 5.600l1-1"/></svg><span>${t.copy}</span></button>
      <a class="sh" data-share="whatsapp" href="https://wa.me/?text=${shareTitle}%20${shareUrl}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21l1.6-4.800A8.500 8.500 0 1 1 8 19.500Z"/><path d="M9 9c0 3 3 6 6 6l1-1.500-2-1-1 .7c-1-.5-2-1.500-2.500-2.500l.7-1-1-2Z"/></svg><span>WhatsApp</span></a>
      <a class="sh" data-share="facebook" href="https://www.facebook.com/sharer/sharer.php?u=${shareUrl}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z"/></svg><span>Facebook</span></a>
      <a class="sh" data-share="x" href="https://twitter.com/intent/tweet?text=${shareTitle}&url=${shareUrl}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4l16 16M20 4 4 20"/></svg><span>X</span></a>
      <a class="sh" data-share="telegram" href="https://t.me/share/url?url=${shareUrl}&text=${shareTitle}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 4 3 11l5 2 2 6 3-4 5 4Z"/></svg><span>Telegram</span></a>
      <a class="sh" data-share="linkedin" href="https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4v11H4zM6 4a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM11 9h4v2c.8-1.400 2.200-2.200 4-2.200 3 0 4 2 4 5V20h-4v-6c0-1.500-.6-2.200-1.800-2.200S15 12.500 15 14v6h-4z" transform="scale(.9) translate(-1 0)"/></svg><span>LinkedIn</span></a>
      <button class="sh native" type="button" data-share="native" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6"/></svg><span>${lang === 'so' ? 'Wadaag' : 'Share'}</span></button>
    </div></div>
  </section>
  <section class="comments" id="comments" aria-labelledby="cm-title">
    <h2 id="cm-title">${t.comments} <small id="cmCount">(${comments.length})</small></h2>
    <ol class="cm-list" id="cmList">${comments.length ? comments.map(c => `<li class="cm"><div class="cm-av" aria-hidden="true">${esc(c.name.slice(0, 1).toUpperCase())}</div><div><p class="cm-h"><b>${esc(c.name)}</b> <time datetime="${new Date(c.createdAt).toISOString()}">${fmtDate(c.createdAt, lang)}</time></p><p>${esc(c.text)}</p>${c.reply ? `<div class="cm-reply"><b>${AUTHOR}</b><p>${esc(c.reply)}</p></div>` : ''}</div></li>`).join('') : `<li class="empty" id="cmNone">${t.none}</li>`}</ol>
    <form class="cm-form" id="cmForm" novalidate><h3>${t.leave}</h3>
      <div class="two"><div class="field"><label for="cmName">${t.name}</label><input id="cmName" name="name" autocomplete="name" maxlength="60" required></div><div class="field"><label for="cmEmail">${t.email}</label><input id="cmEmail" name="email" type="email" autocomplete="email" maxlength="120"></div></div>
      <div class="field"><label for="cmText">${t.msg}</label><textarea id="cmText" name="text" rows="4" maxlength="1000" required></textarea></div>
      <input type="text" name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
      <button class="btn btn-primary" type="submit">${t.post}</button><p class="form-msg" id="cmMsg" role="status" aria-live="polite" data-pending="${t.pending}" data-posted="${t.posted}"></p>
    </form>
  </section>
  ${(() => { const a = byline(p); if (!a.guest) return ''; const bio = esc(a.bio[lang] || a.bio.en || a.bio.so || ''), soc = Object.entries(a.social || {}).filter(([, v]) => /^https:\/\//.test(v)).map(([k, v]) => `<a href="${esc(v)}" rel="noopener nofollow" target="_blank">${esc(k[0].toUpperCase() + k.slice(1))}</a>`).join(' · '); return `<aside class="author-box guest" aria-label="${t.aboutWriter}"><img src="${esc(a.photo || '/assets/icon-192.png')}" alt="" width="84" height="84" loading="lazy"><div><p class="ab-k">${t.aboutWriter}</p><h2>${a.slug ? `<a href="${authorUrl(a, lang)}">${esc(a.name)}</a>` : esc(a.name)}</h2>${bio ? `<p>${bio}</p>` : ''}${soc ? `<p class="ab-soc">${soc}</p>` : ''}${a.slug ? `<p class="ab-cta"><a class="btn btn-ghost btn-sm" href="${authorUrl(a, lang)}">${t.moreBy} ${esc(a.name.split(' ')[0])}</a></p>` : ''}</div></aside>`; })()}
  <aside class="author-box" aria-label="${t.aboutAuthor}"><img src="/assets/yuyu-blue-600.png" alt="" width="84" height="84" loading="lazy"><div><p class="ab-k">${t.aboutAuthor}</p><h2>${AUTHOR}</h2><p>${t.authorBio}</p><p class="ab-cta"><a class="btn btn-primary btn-sm" href="/consulting.html#book">${t.bookCta}</a><a class="btn btn-ghost btn-sm" href="#newsletter">${t.subCta}</a></p></div></aside>
  ${(() => { const all = livePosts(), i = all.findIndex(x => x.id === p.id), nw = all[i - 1], od = all[i + 1]; const lnk = (x, k, cls) => x ? `<a class="pn ${cls}" href="${base}/blog/${x.slug}"><small>${t[k]}</small><b>${esc(pick(x, lang).title)}</b></a>` : '<span></span>'; return nw || od ? `<nav class="post-nav" aria-label="Articles">${lnk(nw, 'prevPost', 'newer')}${lnk(od, 'nextPost', 'older')}</nav>` : ''; })()}

</div><aside class="ad-rail" aria-label="Sponsored"><div class="ad-slot" id="adSlot"></div></aside></div>
${related.length ? `<section class="section alt"><div class="wrap"><div class="sec-head"><h2>${t.related}</h2></div><div class="post-grid">${related.map((x, i) => card(x, lang, i)).join('')}</div></div></section>` : ''}
</article>
${nlBlock(lang)}`;
    const ld = [{
      '@context': 'https://schema.org', '@type': 'BlogPosting', headline: d.title.slice(0, 110), description: desc, image: img ? [img] : undefined, datePublished: new Date(p.publishedAt).toISOString(), dateModified: new Date(p.updatedAt || p.publishedAt).toISOString(),
      author: (() => { const a = byline(p); return a.guest ? { '@type': 'Person', name: a.name, ...(a.slug ? { url: SITE() + authorUrl(a, 'en') } : {}) } : { '@type': 'Person', name: AUTHOR, url: SITE() + '/about.html' }; })(), publisher: { '@type': 'Organization', name: 'Eng Yuyu', logo: { '@type': 'ImageObject', url: SITE() + '/assets/logo-21.png' } }, mainEntityOfPage: canonical, inLanguage: lang, keywords: (p.tags || []).join(', ') || undefined, articleSection: CATS[p.cat] ? CATS[p.cat][0] : p.cat, wordCount: wordCount(d.body),
      interactionStatistic: [{ '@type': 'InteractionCounter', interactionType: 'https://schema.org/CommentAction', userInteractionCount: comments.length }],
    }, { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: SITE() + '/' }, { '@type': 'ListItem', position: 2, name: 'Tech Blog', item: SITE() + '/blog' }, { '@type': 'ListItem', position: 3, name: d.title, item: canonical }] }];
    if (p.video) ld.push({ '@context': 'https://schema.org', '@type': 'VideoObject', name: d.title, description: desc, thumbnailUrl: [ytThumb(p.video.id), ytThumb(p.video.id, 'hqdefault')], uploadDate: new Date(p.publishedAt).toISOString(), embedUrl: `https://www.youtube.com/embed/${p.video.id}`, contentUrl: videoUrl });
    return layout({
      lang, title: title.length > 60 ? title : title + ' | Eng Yuyu', description: desc, canonical, image: img, type: 'article', alt: hasSo(p) ? `${altLang === 'so' ? '/so' : ''}/blog/${p.slug}` : '', ldjson: ld, noindex: !!preview,
      hreflang: hasSo(p) ? [['en', url(p, 'en')], ['so', url(p, 'so')], ['x-default', url(p, 'en')]] : [], published: p.publishedAt, modified: p.updatedAt, scripts: '<script src="/blog.js" defer></script>', main,
    });
  }

  // ---------- email to subscribers ----------
  async function emailPost(p, only) {
    const list = only || subscribers.filter(s => !s.unsubscribed).slice(0, 450);
    let sent = 0;
    for (const s of list) {
      const lang = s.lang === 'so' && hasSo(p) ? 'so' : 'en', d = pick(p, lang), link = `${SITE()}${lang === 'so' ? '/so' : ''}/blog/${p.slug}`, img = imageOf(p), unsub = `${SITE()}/api/unsubscribe?t=${s.token}`;
      const watch = p.video ? `https://www.youtube.com/watch?v=${p.video.id}` : '';
      const em = ctx.mails.newPost(lang, { title: d.title, excerpt: d.excerpt + (watch ? (lang === 'so' ? ', waxaa la socda muuqaal YouTube ah.' : ', with a video on YouTube.') : ''), link, image: img && /^https?:/.test(img) ? img : img ? SITE() + img : '' }, unsub);
      try { await sendMail({ to: s.email, ...em }); sent++; } catch (e) { console.error('blog email failed', s.email, e.message); }
      if (!MOCK) await new Promise(r => setTimeout(r, 250));
    }
    if (only) return sent;                                   // test send: don't mark the post as emailed
    p.emailedAt = Date.now(); p.sentCount = sent; save();
    try { admin().log('blog', `Emailed "${p.en.title}" to ${sent} subscribers`); } catch { /* ignore */ }
    return sent;
  }
  const maybeEmail = p => { if (p.notify && isLive(p) && !p.emailedAt && !p.sample) { p.emailedAt = Date.now(); save(); emailPost(p).catch(console.error); } };
  setInterval(() => { for (const p of db.posts) if (p.status === 'scheduled' && p.publishedAt <= Date.now()) { p.status = 'published'; save(); maybeEmail(p); try { admin().log('blog', `Published "${p.en.title}" (scheduled)`); } catch { /* ignore */ } } }, 30e3).unref();

  // ---------- feeds ----------
  function authorPage(a, lang) {
    const t = T[lang], list = livePosts().filter(x => x.authorId === a.id), bio = a.bio[lang] || a.bio.en || a.bio.so || '', base = lang === 'so' ? '/so' : '';
    const soc = Object.entries(a.social || {}).filter(([, v]) => /^https:\/\//.test(v)).map(([k, v]) => `<a class="chip" href="${esc(v)}" rel="noopener nofollow" target="_blank">${esc(k[0].toUpperCase() + k.slice(1))}</a>`).join('');
    const main = `<section class="blog-hero"><div class="wrap"><nav class="crumbs" aria-label="Breadcrumb"><a href="/">${t.home}</a><span aria-hidden="true">/</span><a href="${base}/blog">${t.blog}</a><span aria-hidden="true">/</span><span aria-current="page">${esc(a.name)}</span></nav><div class="writer-head"><img src="${esc(a.photo || '/assets/icon-192.png')}" alt="" width="96" height="96"><div><p class="ab-k">${t.writerIntro}</p><h1>${esc(a.name)}</h1>${bio ? `<p class="lead">${esc(bio)}</p>` : ''}${soc ? `<div class="chips">${soc}</div>` : ''}</div></div></div></section><section class="section"><div class="wrap"><h2 class="sec-title">${t.byWriter} ${esc(a.name)}</h2>${list.length ? `<div class="post-grid">${list.map((x, i) => card(x, lang, i)).join('')}</div>` : `<p class="empty">${t.noPosts}</p>`}</div></section>${nlBlock(lang)}`;
    const ld = [{ '@context': 'https://schema.org', '@type': 'Person', name: a.name, url: SITE() + authorUrl(a, 'en'), description: bio || undefined, image: a.photo ? (a.photo.startsWith('/') ? SITE() + a.photo : a.photo) : undefined, sameAs: Object.values(a.social || {}).filter(v => /^https:\/\//.test(v)) }];
    return layout({ lang, title: `${a.name} | ${t.blog} | Eng Yuyu`, description: bio.slice(0, 155) || `${t.byWriter} ${a.name}`, canonical: SITE() + authorUrl(a, lang), alt: SITE() + authorUrl(a, lang === 'so' ? 'en' : 'so'), ldjson: ld, main });
  }
  function sitemap() {
    const pages = ['/', '/about.html', '/consulting.html', '/events.html', '/privacy.html', '/terms.html', '/blog', '/so/blog'].map(p => `<url><loc>${SITE()}${p}</loc></url>`);
    const posts = livePosts().map(p => `<url><loc>${url(p, 'en')}</loc><lastmod>${new Date(p.updatedAt || p.publishedAt).toISOString()}</lastmod>${hasSo(p) ? `<xhtml:link rel="alternate" hreflang="en" href="${url(p, 'en')}"/><xhtml:link rel="alternate" hreflang="so" href="${url(p, 'so')}"/>` : ''}</url>${hasSo(p) ? `<url><loc>${url(p, 'so')}</loc><lastmod>${new Date(p.updatedAt || p.publishedAt).toISOString()}</lastmod><xhtml:link rel="alternate" hreflang="en" href="${url(p, 'en')}"/><xhtml:link rel="alternate" hreflang="so" href="${url(p, 'so')}"/></url>` : ''}`);
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${[...pages, ...posts, ...authors.filter(a => a.status !== 'invited' && livePosts().some(x => x.authorId === a.id)).map(a => `<url><loc>${SITE()}${authorUrl(a, 'en')}</loc></url>`)].join('\n')}\n</urlset>`;
  }
  function rss() {
    const items = livePosts().slice(0, 30).map(p => `<item><title>${esc(p.en.title)}</title><link>${url(p, 'en')}</link><guid isPermaLink="true">${url(p, 'en')}</guid><pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate><description>${esc(p.en.excerpt)}</description>${imageOf(p) ? `<enclosure url="${esc(imageOf(p))}" type="image/jpeg" length="0"/>` : ''}</item>`).join('');
    return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Eng Yuyu | Tech Blog</title><link>${SITE()}/blog</link><description>Practical technology articles by Eng Yuyu</description><language>en</language>${items}</channel></rss>`;
  }
  const robots = () => `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /writers\nDisallow: /api/\n\nSitemap: ${SITE()}/sitemap.xml\n`;

  // ---------- http ----------
  const html = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' }); res.end(body); };
  const xml = (res, body, type) => { res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'public, max-age=300' }); res.end(body); };
  const notFound = (res, lang) => html(res, 404, layout({ lang, title: '404 | Eng Yuyu', description: '', canonical: SITE() + '/blog', noindex: true, main: `<section class="section"><div class="wrap narrow" style="text-align:center"><h1>404</h1><p class="lead">${lang === 'so' ? 'Bogga lama helin.' : 'We couldn’t find that page.'}</p><a class="btn btn-primary" href="/blog">${T[lang].blog}</a></div></section>` }));

  async function publicRoutes(req, res, u, origin) {
    const p = u.pathname, m = req.method;
    if (p === '/sitemap.xml') return xml(res, sitemap(), 'application/xml; charset=utf-8'), true;
    if (p === '/robots.txt') return xml(res, robots(), 'text/plain; charset=utf-8'), true;
    if (p === '/blog/feed.xml') return xml(res, rss(), 'application/rss+xml; charset=utf-8'), true;
    let mm = p.match(/^(\/so)?\/blog\/author\/([a-z0-9-]+)\/?$/);
    if (mm && m === 'GET') { const a = authors.find(x => x.slug === mm[2] && x.status !== 'invited'), lang = mm[1] ? 'so' : 'en'; if (!a) return notFound(res, lang), true; return html(res, 200, authorPage(a, lang)), true; }
    mm = p.match(/^(\/so)?\/blog\/?$/);
    if (mm && m === 'GET') return html(res, 200, indexPage(mm[1] ? 'so' : 'en', u.searchParams)), true;
    mm = p.match(/^(\/so)?\/blog\/([a-z0-9-]+)\/?$/);
    if (mm && m === 'GET') {
      const lang = mm[1] ? 'so' : 'en', post = db.posts.find(x => x.slug === mm[2]);
      const preview = post && !isLive(post) && admin().authed(req);
      if (!post || (!isLive(post) && !preview)) return notFound(res, lang), true;
      if (lang === 'so' && !hasSo(post)) { res.writeHead(302, { Location: `/blog/${post.slug}` }); res.end(); return true; }
      return html(res, 200, postPage(post, lang, preview)), true;
    }
    // ---- JSON API ----
    mm = p.match(/^\/api\/blog\/([a-z0-9-]+)\/(view|react|comments)$/);
    if (!mm) return false;
    const post = db.posts.find(x => x.slug === mm[1] && isLive(x)); if (!post) return ctx.send(res, 404, { error: 'not found' }, origin), true;
    const vid = voter(req), ip = req.clientIp || req.socket.remoteAddress;
    if (mm[2] === 'view' && m === 'POST') {
      post.viewers = post.viewers || {}; const day = new Date().toISOString().slice(0, 10), key = vid + day;
      if (!post.viewers[key]) { post.viewers[key] = 1; post.views = (post.views || 0) + 1; if (Object.keys(post.viewers).length > 4000) post.viewers = {}; save(); }
      return ctx.send(res, 200, { views: post.views || 0 }, origin), true;
    }
    if (mm[2] === 'react') {
      if (m === 'GET') return ctx.send(res, 200, { totals: reactTotals(post), mine: (post.voters || {})[vid] || null }, origin), true;
      if (limited(ip + 'r', 60)) return ctx.send(res, 429, { error: 'Too many requests' }, origin), true;
      const b = await readJson(req), r = REACTIONS.includes(b.r) ? b.r : null; if (!r) return ctx.send(res, 400, { error: 'bad reaction' }, origin), true;
      post.reactions = post.reactions || {}; post.voters = post.voters || {};
      const prev = post.voters[vid];
      if (prev) post.reactions[prev] = Math.max(0, (post.reactions[prev] || 0) - 1);
      if (prev === r) delete post.voters[vid]; else { post.voters[vid] = r; post.reactions[r] = (post.reactions[r] || 0) + 1; }
      if (Object.keys(post.voters).length > 20000) post.voters = {};
      save(); return ctx.send(res, 200, { totals: reactTotals(post), mine: post.voters[vid] || null }, origin), true;
    }
    if (mm[2] === 'comments') {
      if (m === 'GET') return ctx.send(res, 200, approved(post).map(c => ({ name: c.name, text: c.text, at: c.createdAt, reply: c.reply || '' })), origin), true;
      if (limited(ip + 'cm', 6)) return ctx.send(res, 429, { error: 'Too many comments, please try later.' }, origin), true;
      const b = await readJson(req);
      if (b.website) return ctx.send(res, 200, { ok: true, status: 'pending' }, origin), true;                // honeypot: pretend success
      const name = clean(b.name, 60), text = clean(b.text, 1000), email = clean(b.email, 120);
      if (!name || text.length < 2) return ctx.send(res, 400, { error: 'Name and comment are required.' }, origin), true;
      const links = (text.match(/https?:\/\//gi) || []).length;
      const auto = !(settings.blog && settings.blog.autoApprove === false) && links === 0;   // comments appear straight away (links wait for review); switch off in Dashboard → Blog → Comments
      const c = { id: uid(), postId: post.id, name, email, text, createdAt: Date.now(), status: auto ? 'approved' : 'pending' };
      db.comments.push(c); save();
      try { admin().log('comment', `New comment on "${post.en.title}" by ${name}`); } catch { /* ignore */ }
      sendMail({ to: ctx.OWNER(), subject: `New comment: ${post.en.title}`, text: `${name}: ${text}\n\nModerate in the dashboard → Blog → Comments.`, html: `<p><b>${esc(name)}</b> on <i>${esc(post.en.title)}</i></p><p>${esc(text)}</p><p>Status: ${c.status}. Moderate in the dashboard → Blog → Comments.</p>` }).catch(() => {});
      return ctx.send(res, 200, { ok: true, status: c.status, comment: auto ? { name, text, at: c.createdAt } : null }, origin), true;
    }
    return false;
  }

  // ---------- dashboard API ----------
  function view(p) {
    const cm = db.comments.filter(c => c.postId === p.id);
    const { voters, viewers, ...rest } = p;
    return { ...rest, readMin: readMin(p), url: url(p, 'en'), reactionsTotal: Object.values(reactTotals(p)).reduce((a, b) => a + b, 0), comments: cm.filter(c => c.status === 'approved').length, pending: cm.filter(c => c.status === 'pending').length, thumb: imageOf(p) };
  }
  function normalise(b, existing) {
    const lang = k => ({ title: clean(b[k] && b[k].title, 160), excerpt: clean(b[k] && b[k].excerpt, 320), body: clean(b[k] && b[k].body, 60000) });
    const p = existing || { id: uid(), createdAt: Date.now(), views: 0, reactions: {}, voters: {}, viewers: {} };
    p.en = lang('en'); p.so = lang('so');
    p.cat = CATS[b.cat] ? b.cat : 'ai';
    p.tags = (Array.isArray(b.tags) ? b.tags : String(b.tags || '').split(',')).map(t => clean(t, 30).toLowerCase().replace(/^#/, '')).filter(Boolean).slice(0, 8);
    const vid = ytId(b.videoUrl); p.video = vid ? { id: vid, url: `https://www.youtube.com/watch?v=${vid}` } : null;
    p.cover = /^(https?:\/\/|\/uploads\/[a-f0-9]{16}\.(png|jpg|webp))/i.test(b.cover || '') ? clean(b.cover, 400) : '';
    p.featured = !!b.featured; p.notify = !!b.notify;
    p.service = ['tech', 'creator', 'business', 'safety'].includes(b.service) ? b.service : '';
    p.seo = { title: clean(b.seo && b.seo.title, 90), description: clean(b.seo && b.seo.description, 200) };
    p.slug = uniqueSlug(clean(b.slug, 80) || p.en.title, p.id);
    p.updatedAt = Date.now();
    const st = ['draft', 'published', 'scheduled'].includes(b.status) ? b.status : 'draft';
    const when = b.publishAt ? Date.parse(b.publishAt) : NaN;
    if (st === 'scheduled' && Number.isFinite(when) && when > Date.now()) { p.status = 'scheduled'; p.publishedAt = when; }
    else if (st === 'published' || st === 'scheduled') { if (p.status !== 'published' || !p.publishedAt) p.publishedAt = Number.isFinite(when) && when <= Date.now() ? when : Date.now(); p.status = 'published'; }
    else { p.status = 'draft'; p.publishedAt = p.publishedAt || 0; }
    return p;
  }
  function checks(p) {
    const d = p.en, t = (p.seo && p.seo.title) || d.title, desc = (p.seo && p.seo.description) || d.excerpt;
    return [['Title is 30–65 characters', t.length >= 30 && t.length <= 65], ['Meta description is 70–160 characters', desc.length >= 70 && desc.length <= 160], ['Article has 300+ words', wordCount(d.body) >= 300], ['Has a video or cover image', !!imageOf(p)], ['Short URL slug (under 60 characters)', p.slug.length <= 60]];
  }
  async function adminRoutes(req, res, u) {
    const p = u.pathname, m = req.method, A = admin();
    if (!p.startsWith('/api/admin/blog') && !p.startsWith('/api/admin/comments')) return false;
    if (!A.authed(req)) return A.json(res, 401, { error: 'Not signed in' }), true;
    if (m !== 'GET' && req.headers['x-requested-with'] !== 'yy-admin') return A.json(res, 403, { error: 'Bad request' }), true;
    if (p === '/api/admin/blog' && m === 'GET') return A.json(res, 200, { posts: [...db.posts].sort((a, b) => (b.publishedAt || b.createdAt) - (a.publishedAt || a.createdAt)).map(view), cats: CATS, autoApprove: !(settings.blog && settings.blog.autoApprove === false), site: SITE(), subscribers: subscribers.filter(s => !s.unsubscribed).length }), true;
    if (p === '/api/admin/blog' && m === 'POST') {
      const b = await readJson(req), post = normalise(b, null), was2 = '';
      if (!post.en.title) return A.json(res, 400, { error: 'English title is required' }), true;
      db.posts.push(post); save(); if (post.status === 'published') { A.log('blog', `Published "${post.en.title}"`); maybeEmail(post); try { if (ctx.writers) ctx.writers.onPublished(post, was2); } catch (e) { console.error('writer notify', e.message); } }
      return A.json(res, 200, { ...view(post), checks: checks(post) }), true;
    }
    let mm = p.match(/^\/api\/admin\/blog\/([a-f0-9]+)(?:\/(\w+))?$/);
    if (mm) {
      const post = db.posts.find(x => x.id === mm[1]); if (!post) return A.json(res, 404, { error: 'Not found' }), true;
      if (!mm[2] && m === 'GET') return A.json(res, 200, { ...view(post), videoUrl: post.video ? post.video.url : '', checks: checks(post) }), true;
      if (!mm[2] && m === 'PUT') {
        const b = await readJson(req), was = post.status, was2 = was; normalise(b, post);
        if (!post.en.title) return A.json(res, 400, { error: 'English title is required' }), true;
        save(); if (post.status === 'published' && was !== 'published') { A.log('blog', `Published "${post.en.title}"`); maybeEmail(post); try { if (ctx.writers) ctx.writers.onPublished(post, was2); } catch (e) { console.error('writer notify', e.message); } }
        return A.json(res, 200, { ...view(post), checks: checks(post) }), true;
      }
      if (!mm[2] && m === 'DELETE') { db.posts.splice(db.posts.indexOf(post), 1); db.comments = db.comments.filter(c => c.postId !== post.id); save(); A.log('blog', `Deleted "${post.en.title}"`); return A.json(res, 200, { ok: true }), true; }
      if (mm[2] === 'email' && m === 'POST') {
        const b = await readJson(req);
        if (b.test) { await emailPost(post, [{ email: ctx.OWNER(), lang: 'en', token: 'test' }]); return A.json(res, 200, { ok: true, test: true }), true; }
        if (!isLive(post)) return A.json(res, 400, { error: 'Publish the post first' }), true;
        post.emailedAt = 0; const n = await emailPost(post); return A.json(res, 200, { ok: true, sent: n }), true;
      }
    }
    if (p === '/api/admin/comments' && m === 'GET') {
      const st = u.searchParams.get('status') || 'pending';
      return A.json(res, 200, db.comments.filter(c => st === 'all' || c.status === st).sort((a, b) => b.createdAt - a.createdAt).map(c => { const post = db.posts.find(x => x.id === c.postId); return { ...c, post: post ? post.en.title : '(deleted)', slug: post ? post.slug : '' }; })), true;
    }
    mm = p.match(/^\/api\/admin\/comments\/([a-f0-9]+)$/);
    if (mm) {
      const c = db.comments.find(x => x.id === mm[1]); if (!c) return A.json(res, 404, { error: 'Not found' }), true;
      if (m === 'PATCH') { const b = await readJson(req); if (['approved', 'pending', 'spam'].includes(b.status)) c.status = b.status; if (typeof b.reply === 'string') c.reply = clean(b.reply, 1000); save(); return A.json(res, 200, { ok: true }), true; }
      if (m === 'DELETE') { db.comments.splice(db.comments.indexOf(c), 1); save(); return A.json(res, 200, { ok: true }), true; }
    }
    if (p === '/api/admin/blog-settings' && m === 'PUT') { const b = await readJson(req); settings.blog = { ...(settings.blog || {}), autoApprove: !!b.autoApprove }; store.save('settings'); return A.json(res, 200, { ok: true }), true; }
    return false;
  }

  // ---------- sample posts (first run only; demo mode, or SEED_SAMPLES=1) ----------
  const SEED = MOCK || ENV.SEED_SAMPLES === '1';   // the real site never adds sample articles
  if (SEED && !db.posts.length) {
    const now = Date.now(), day = 864e5;
    const S = (slug, cat, daysAgo, vid, en, so, extra = {}) => db.posts.push({ id: uid(), slug, status: 'published', publishedAt: now - daysAgo * day, createdAt: now - daysAgo * day, updatedAt: now - daysAgo * day, cat, tags: extra.tags || [], video: vid ? { id: vid, url: `https://www.youtube.com/watch?v=${vid}` } : null, cover: '', featured: !!extra.featured, notify: false, emailedAt: now, sentCount: 0, sample: true, views: extra.views || 0, reactions: extra.reactions || {}, voters: {}, viewers: {}, en, so: so || { title: '', excerpt: '', body: '' }, seo: { title: '', description: '' } });
    S('how-ai-is-changing-the-way-somali-creators-work', 'ai', 3, 'aqz-KE-bpKQ', { title: 'How AI is changing the way Somali creators work', excerpt: 'Practical AI workflows for scripting, translation and editing that you can start using today, no technical background needed.', body: `Creators spend most of their time on tasks that are not creative: researching, drafting, translating, cutting clips. AI can take over much of that work, if you use it with a clear process.\n\n## 1. Plan your video in minutes\n\nStart with one sentence about who the video is for and what they will learn. Ask an AI assistant for **three title ideas** and a simple outline, then rewrite everything in your own voice.\n\n- Write the audience and the promise first\n- Ask for an outline, not a finished script\n- Keep your own examples and stories\n\n## 2. Translate without losing meaning\n\nAI translation is a great first draft between English and Somali. Always read it aloud once, if a sentence sounds unnatural, simplify it.\n\n{{youtube https://www.youtube.com/watch?v=aqz-KE-bpKQ}}\n\n## 3. Edit faster\n\nUse AI tools for captions, silence removal and highlights. Then spend your saved time on what viewers actually remember: your delivery and your ideas.\n\n> The best AI workflow is the one that gives you back time to be more human on camera.\n\n## Your next step\n\nPick **one** task from your last video that felt slow and try an AI tool on it this week. Watch the video above for a full walkthrough.` }, { title: 'Sida AI u beddelayso shaqada abuureyaasha Soomaaliyeed', excerpt: 'Habab AI oo wax ku ool ah oo qorista qoraalka, tarjumaadda iyo tafatirka ah oo maanta bilaabi karto.', body: 'Abuureyaashu waqtigooda badan waxay ku qaataan shaqo aan ahayn hal-abuur. AI waxay qaadan kartaa qayb badan oo ka mid ah shaqadaas.\n\n## Qorshee muuqaalkaaga daqiiqado gudahood\n\nBilow hal jumlad: yaa muuqaalku u socdaa, maxayse baran doonaan? Weydii AI **seddex cinwaan** iyo qaab-dhismeed fudud.\n\n{{youtube https://www.youtube.com/watch?v=aqz-KE-bpKQ}}\n\nDooro hal hawl oo hadda gaabis ah oo toddobaadkan tijaabi qalab AI ah.' }, { featured: true, tags: ['ai', 'creators', 'workflow'], views: 1840, reactions: { like: 96, love: 41, fire: 33, idea: 58 } });
    S('protect-your-phone-from-scams-in-10-minutes', 'security', 9, 'YE7VzlLtp-4', { title: 'Protect your phone from scams in 10 minutes', excerpt: 'Seven quick settings on iPhone and Android that block most scam attempts and protect your accounts.', body: `Most phone scams do not hack your phone, they trick **you**. These settings make that much harder.\n\n## Turn on two-step verification\n\nOpen the security settings of your email, Facebook, Instagram and mobile-money apps and switch on two-step verification. A stolen password alone is then useless.\n\n## Update, then automate\n\n1. Update your phone's system today\n2. Turn on automatic updates\n3. Update your apps once a week\n\n## Be careful with links and calls\n\nNever share a code you receive by SMS with anyone, not even someone claiming to be from your bank or mobile-money provider.\n\n{{youtube https://www.youtube.com/watch?v=YE7VzlLtp-4}}\n\n## Quick checklist\n\n- Screen lock with a 6-digit PIN or biometrics\n- Find-my-phone turned on\n- Backups enabled\n- Unknown apps blocked` }, { title: 'Ka ilaali taleefankaaga khayaano 10 daqiiqo gudahood', excerpt: 'Toddoba dejin oo degdeg ah oo iPhone iyo Android ah oo joojiya inta badan isku dayga khayaanada.', body: 'Inta badan khayaanooyinka taleefanka ma jabsadaan taleefanka, waxay khiyaaneeyaan **adiga**.\n\n## Daar xaqiijinta laba-tallaabo\n\nU gudub dejinta amniga ee email-kaaga, Facebook, Instagram iyo abka lacagta mobilka.\n\n{{youtube https://www.youtube.com/watch?v=YE7VzlLtp-4}}\n\nWaligaa ha la wadaagin koodka SMS-ka ee kuu yimaada.' }, { tags: ['security', 'phone', 'scams'], views: 2630, reactions: { like: 148, love: 52, fire: 21, idea: 87 } });
    S('best-budget-phones-for-creators', 'gadgets', 16, null, { title: 'Best budget phones for creators in 2026', excerpt: 'Camera, battery and value compared, what to buy and what to skip when you are starting your channel.', body: `You do not need a flagship phone to make great videos. You need **stable video, clean audio and good light**.\n\n## What matters most\n\n- **Video stabilisation**, shaky footage ruins good ideas\n- **Battery life**, shooting drains a phone fast\n- **Storage**, 128 GB is the practical minimum\n- **Front camera**, most creators film themselves\n\n## Skip these\n\nHigh megapixel counts, gaming features and extra lenses you will never use.\n\n## Our approach\n\nCompare three phones in your budget by filming the same 30-second clip with each one, in the same room, at the same time. Trust your eyes.` }, null, { tags: ['phones', 'creators', 'gadgets'], views: 980, reactions: { like: 44, fire: 12, idea: 19 } });
    S('from-zero-to-100k-channel-growth-playbook', 'growth', 24, 'aqz-KE-bpKQ', { title: 'From 0 to 100K: a channel growth playbook', excerpt: 'The content pillars, posting rhythm and analytics habits behind steady, healthy channel growth.', body: `Growth is rarely a viral moment. It is a **system** you repeat until it compounds.\n\n## Choose 3 content pillars\n\nPick three topics you can talk about for years. Every video belongs to one pillar, this makes your channel easy to understand and easy to recommend.\n\n## Set a rhythm you can keep\n\nOne good video a week beats seven rushed videos in one month and silence after.\n\n## Read your analytics once a week\n\n1. Which videos kept people watching?\n2. Where did viewers leave?\n3. What did viewers search before finding you?\n\n{{youtube https://www.youtube.com/watch?v=aqz-KE-bpKQ}}\n\n## Lead people to the next step\n\nEvery article, short and post should point to one next action, a video, a newsletter, a booking. Make it easy.` }, null, { tags: ['youtube', 'growth', 'analytics'], views: 1410, reactions: { like: 71, love: 25, idea: 40 } });
    save();
  }

  // service ids changed (new session list): map old values once
  { const MAP = { strategy: 'business', growth: 'creator', partnerships: 'business', training: 'tech' }, BY_SLUG = { 'how-to-check-if-your-accounts-are-safe': 'safety', 'what-to-look-for-when-buying-a-phone': 'tech', 'a-simple-90-day-content-plan-for-a-small-business': 'business', 'five-mistakes-that-slow-down-new-youtube-channels': 'creator', 'how-brands-should-work-with-creators': 'business' };
    for (const p of db.posts) { if (BY_SLUG[p.slug]) p.service = BY_SLUG[p.slug]; else if (MAP[p.service]) p.service = MAP[p.service]; } save(); }
  if (SEED && !db.samplesV2) {   // sample guides that go with each service, added once; edit or delete freely
    db.samplesV2 = true;
    const now2 = Date.now(), day2 = 864e5, mk = (slug, cat, service, daysAgo, vid, en, extra = {}) => { if (db.posts.some(p => p.slug === slug)) return; db.posts.push({ id: uid(), slug, status: 'published', publishedAt: now2 - daysAgo * day2, createdAt: now2 - daysAgo * day2, updatedAt: now2 - daysAgo * day2, cat, service, tags: extra.tags || [], video: vid ? { id: vid, url: 'https://www.youtube.com/watch?v=' + vid } : null, cover: '', featured: false, notify: false, emailedAt: now2, sentCount: 0, sample: true, views: extra.views || 0, reactions: {}, voters: {}, viewers: {}, en, so: { title: '', excerpt: '', body: '' }, seo: { title: '', description: '' } }); };
    mk('how-to-check-if-your-accounts-are-safe', 'security', 'safety', 2, 'YE7VzlLtp-4', { title: 'How to check if your accounts are safe', excerpt: 'A 10-minute checklist for your email, social media and mobile-money accounts, and what to do if something looks wrong.', body: 'Most account takeovers are preventable. Spend ten minutes on this checklist today.\n\n## 1. Check your email first\n\nYour email can reset every other password, so protect it first: a long unique password and two-step verification.\n\n## 2. Look at where you are logged in\n\nOpen the security settings of Facebook, Instagram and Google and look at the list of devices. Log out of any you do not recognise.\n\n## 3. Review connected apps\n\nRemove apps and websites you no longer use.\n\n{{youtube https://www.youtube.com/watch?v=YE7VzlLtp-4}}\n\n## If something looks wrong\n\n- Change the password right away\n- Sign out of all devices\n- Tell your contacts not to trust strange messages from you\n\nWant a second pair of eyes on your accounts? Book an Account Safety Check-up.' }, { tags: ['security', 'accounts', 'training'], views: 760 });
    mk('what-to-look-for-when-buying-a-phone', 'gadgets', 'tech', 6, null, { title: 'What to look for when buying a phone', excerpt: 'Six things that matter more than the price tag: updates, battery, storage, camera, repairability and where you buy it.', body: 'A phone is a daily tool, spend your money where it matters.\n\n## 1. Software updates\n\nChoose a phone that will keep getting security updates for years.\n\n## 2. Battery you can trust\n\nLook at real battery tests, not only the mAh number.\n\n## 3. Enough storage\n\n128 GB is the practical minimum if you take photos and videos.\n\n## 4. A camera that fits your use\n\nTest it yourself: record a short video indoors and outdoors.\n\n## 5. Where to buy\n\nBuy from a seller who gives a warranty and lets you check the phone before paying.' }, { tags: ['phones', 'buying guide'], views: 540 });
    mk('a-simple-90-day-content-plan-for-a-small-business', 'growth', 'business', 12, null, { title: 'A simple 90-day content plan for a small business', excerpt: 'Pick three topics, a rhythm you can keep and one clear action for every post, a plan any small business can follow.', body: 'You do not need a big team to be consistent. You need a plan small enough to finish.\n\n## Month 1: Foundations\n\nChoose your three content pillars and one platform to focus on.\n\n## Month 2: Rhythm\n\nPublish on the same days every week. Reuse one idea in three formats.\n\n## Month 3: Improve\n\nLook at what people watched and shared, and do more of it.\n\n> Consistency beats intensity.\n\nNeed help building your plan? Book a Business Growth Plan session.' }, { tags: ['strategy', 'small business', 'content plan'], views: 690 });
    mk('five-mistakes-that-slow-down-new-youtube-channels', 'growth', 'creator', 18, 'aqz-KE-bpKQ', { title: '5 mistakes that slow down new YouTube channels', excerpt: 'Unclear topics, weak first seconds, no next step and more, and how to fix each one this week.', body: 'Most new channels make the same five mistakes.\n\n## 1. No clear topic\n\nViewers should know in one sentence what your channel is about.\n\n## 2. A slow start\n\nThe first five seconds decide if people stay. Start with the result, not the introduction.\n\n## 3. No next step\n\nTell viewers what to watch or do next.\n\n{{youtube https://www.youtube.com/watch?v=aqz-KE-bpKQ}}\n\n## 4. Ignoring titles and thumbnails\n\nThey are your first impression, spend time on them.\n\n## 5. Quitting too early\n\nGive each format at least ten videos before you judge it.' }, { tags: ['youtube', 'channel growth'], views: 880 });
    mk('how-brands-should-work-with-creators', 'growth', 'business', 24, null, { title: 'How brands should work with creators', excerpt: 'Briefs, budgets and trust: a short guide to creator partnerships that actually perform.', body: 'The best creator partnerships feel natural to the audience.\n\n## Start with the audience\n\nA creator\'s audience must be the people you want to reach.\n\n## Write a short brief\n\nGoals, key message, must-haves, then let the creator make it in their own voice.\n\n## Agree what success looks like\n\nViews, sign-ups, sales or awareness, choose one main goal.\n\n## Keep it honest\n\nAudiences trust creators who are open about partnerships. Education-led content works best.\n\nWant to talk it through? Book a session.' }, { tags: ['brands', 'creators', 'partnerships'], views: 610 });
    save();
  }
  ctx.blogCards = () => livePosts().slice(0, 9).map(p => ({ id: p.id, cat: CATS[p.cat] && ['ai', 'gadgets', 'dev', 'growth'].includes(p.cat) ? p.cat : 'ai', min: readMin(p), date: new Date(p.publishedAt).toISOString().slice(0, 10), en: [p.en.title, p.en.excerpt], so: [hasSo(p) ? p.so.title : p.en.title, hasSo(p) ? p.so.excerpt : p.en.excerpt], href: `/blog/${p.slug}`, video: !!p.video, thumb: imageOf(p), label: CATS[p.cat] }));
  ctx.hasBlogPosts = () => livePosts().length > 0;
  ctx.blogGuides = () => { const out = {}; for (const p of livePosts()) if (p.service) (out[p.service] = out[p.service] || []).push({ title: { en: p.en.title, so: hasSo(p) ? p.so.title : p.en.title }, href: '/blog/' + p.slug, video: !!p.video }); for (const k of Object.keys(out)) out[k] = out[k].slice(0, 2); return out; };
  ctx.blogApi = { db, authors, normalise, checks, view, uniqueSlug, CATS, isLive, maybeEmail, md, uid, save, imageOf, ytId, clean, wordCount, readMin, url, SITE };
  return { handle: async (req, res, u, origin) => (await adminRoutes(req, res, u)) || (await publicRoutes(req, res, u, origin)), db, md };
};
