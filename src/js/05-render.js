/* =====================================================================
   Rendering
   ===================================================================== */
function patternArt(seed) {
  // Deterministic little network graphic used as blog card art
  let s = seed * 9301 + 49297; const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const pts = Array.from({ length: 9 }, () => [r() * 320, r() * 180]);
  let lines = '';
  pts.forEach((p, i) => pts.slice(i + 1).forEach(q => { if (Math.hypot(p[0] - q[0], p[1] - q[1]) < 110) lines += `<path d="M${p[0]} ${p[1]}L${q[0]} ${q[1]}"/>`; }));
  const dots = pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="rgba(255,255,255,.7)" stroke="none"/>`).join('');
  return `<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${lines}${dots}</svg>`;
}

let blogFilter = 'all';
function renderServiceChips() {   // home: the sessions (name, length + price, what's included, a Book button) and the topics you can bring
  const ul = $('#serviceChips'); if (ul === NULL) return;
  ul.innerHTML = SESSIONS.filter(s => s.enabled !== false).map(s => `<li class="sess-chip"><div class="sc-top"><h3>${esc(pick(s)[0])}</h3><p class="sc-meta"><b>${esc(price(s))}</b> · ${s.min} ${t('cs.min')}</p></div>${s.inc ? `<ul>${pick(s.inc).map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}<a class="btn btn-primary" href="consulting.html?session=${encodeURIComponent(s.id)}#book">${esc(t('cs.bookBtn').replace('{p}', price(s)))}</a></li>`).join('');
  const tp = $('#homeTopics'); if (tp !== NULL) tp.innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<li>${esc(t('cs.tp' + n))}</li>`).join('');
}
function renderServices() {
  $('#serviceList').innerHTML = SERVICES.map(s => {
    const g = (GUIDES[s.id] || []).map(x => `<a href="${esc(x.href)}">${esc(lang === 'so' ? x.title.so : x.title.en)}</a>`).join('');
    return `<li class="service"><span class="ico">${svg(s.icon)}</span><div><h3>${esc(pick(s)[0])}</h3><p>${esc(pick(s)[1])}</p>${s.who ? `<p class="who">${esc(pick(s.who))}</p>` : ''}${s.note ? `<p class="svc-note">${esc(pick(s.note))}</p>` : ''}${g ? `<p class="guides"><b>${t('cs.guides')}</b>${g}</p>` : ''}</div></li>`;
  }).join('');
}
function renderProof() {
  const g = $('#proofGrid'); if (g === NULL) return;
  g.innerHTML = PROOF.map(p => `<li class="proof"><b class="metric">${esc(p.metric)}</b><h3>${esc(pick(p)[0])}</h3><p>${esc(pick(p)[1])}</p>${p.href ? `<a class="more" href="${esc(p.href)}" target="_blank" rel="noopener">${t('more')} →</a>` : ''}</li>`).join('');
  const w = $('#testiWrap'); w.hidden = !TESTIMONIALS.length;
  $('#testiList').innerHTML = TESTIMONIALS.map(x => `<li class="testi"><blockquote><p>${esc(lang === 'so' ? (x.so || x.en) : x.en)}</p></blockquote><p class="who-t"><b>${esc(x.name)}</b>${x.role ? ` · ${esc(x.role)}` : ''}</p></li>`).join('');
}
function renderEvents() {   // home: latest 3 events as a slider
  const track = $('#homeEvSlides'); if (track === NULL) return;
  evList = evSorted();
  const n = Math.min(3, evList.length);
  fillSlider('#homeEvSlides', evList.slice(0, n).map((e, i) => evSlide(e, i, n)).join('') || `<p class="empty">${t('ev.up.none')}</p>`, n);
}
/* ---------- Events & Media page ---------- */
const ytIdOf = u => { const m = String(u || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/|v\/))([A-Za-z0-9_-]{11})/); return m ? m[1] : ''; };
const evEnd = e => new Date(e.date + 'T23:59:59');
const nl2 = n => String(n).padStart(2, '0');
const slugOf = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const EV_TYPES = { conference: ['Conference', 'Shir'], talk: ['Talk', 'Hadal'], panel: ['Panel', 'Guddi'], attended: ['Attended', 'Ka qaybgalay'], workshop: ['Workshop', 'Aqoon-isweydaarsi'], media: ['Media', 'Warbaahin'], other: ['Event', 'Dhacdo'] };
const evLabel = e => (e.type && EV_TYPES[e.type]) ? EV_TYPES[e.type][lang === 'so' ? 1 : 0] : (e.tag ? e.tag[lang === 'so' ? 1 : 0] : EV_TYPES.other[lang === 'so' ? 1 : 0]);
const evImgs = e => (Array.isArray(e.images) ? e.images : []).filter(Boolean).slice(0, 4);
const evArticle = e => { const x = e.article && (lang === 'so' ? (e.article.so || e.article.en) : e.article.en); return x || ''; };
const paras = s => String(s).split(/\n{2,}/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
function evCalLinks(e) {
  const d = e.date.replace(/-/g, ''), nx = new Date(e.date + 'T12:00:00'); nx.setDate(nx.getDate() + 1);
  const d2 = nx.getFullYear() + nl2(nx.getMonth() + 1) + nl2(nx.getDate()), title = pick(e)[0], det = pick(e)[1] + (e.place ? ' | ' + e.place : '');
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Eng Yuyu//Events//EN', 'BEGIN:VEVENT', 'UID:' + d + '-' + slugOf(title) + '@engyuyu.com', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]|\.\d{3}/g, ''), 'DTSTART;VALUE=DATE:' + d, 'DTEND;VALUE=DATE:' + d2, 'SUMMARY:' + title, 'DESCRIPTION:' + det.replace(/\n/g, ' '), e.place ? 'LOCATION:' + e.place : '', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
  return { google: 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(title) + '&dates=' + d + '/' + d2 + '&details=' + encodeURIComponent(det) + (e.place ? '&location=' + encodeURIComponent(e.place) : ''), ics: 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics) };
}
const PIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-5.600 7-11a7 7 0 1 0-14 0c0 5.400 7 11 7 11Z"/><circle cx="12" cy="10" r="2.500"/></svg>';
const evSorted = () => { const now = new Date(); return [...EVENTS.filter(e => evEnd(e) >= now).sort((x, y) => x.date.localeCompare(y.date)), ...EVENTS.filter(e => evEnd(e) < now).sort((x, y) => y.date.localeCompare(x.date))]; };
function evGallery(e, cls) {   // 16:9 gallery: first image is the cover; the others are thumbnails that swap the main picture
  const imgs = evImgs(e), alt = esc(pick(e)[0]);
  if (!imgs.length) return `<div class="${cls}"><div class="g-main g-empty">${svg(e.icon || 'mic')}</div></div>`;
  return `<div class="${cls}"><div class="g-main"><img src="${esc(imgs[0])}" alt="${alt}" width="1280" height="720" loading="lazy"></div>${imgs.length > 1 ? `<div class="g-thumbs">${imgs.map((u, i) => `<button type="button" class="g-th" aria-label="${t('ev.photo')} ${i + 1}" aria-pressed="${i === 0}" data-src="${esc(u)}"><img src="${esc(u)}" alt="" width="320" height="180" loading="lazy"></button>`).join('')}</div>` : ''}</div>`;
}
function evMeta(e) { return `<p class="evc-meta">${PIN}<span>${esc(e.place || t('ev.tba'))}</span><span aria-hidden="true">·</span><time datetime="${e.date}">${fmtDate(e.date)}</time></p>`; }
function evSlide(e, i, n) {
  const up = evEnd(e) >= new Date(), cal = up ? evCalLinks(e) : null, days = Math.ceil((new Date(e.date + 'T12:00:00') - new Date()) / 864e5);
  return `<article class="slide" role="group" aria-roledescription="slide" aria-label="${i + 1} / ${n}" data-i="${i}">
    ${evGallery(e, 'sl-gallery')}
    <div class="sl-body"><div class="evc-top"><span class="tag">${esc(evLabel(e))}</span>${up ? `<span class="evc-when">${esc(days <= 0 ? t('ev.today') : t('ev.in').replace('{n}', days))}</span>` : ''}</div>
      <h3>${esc(pick(e)[0])}</h3>${evMeta(e)}<p class="sl-text">${esc(pick(e)[1])}</p>
      <div class="evc-actions"><button class="btn btn-primary btn-sm" type="button" data-ev="${i}">${t('ev.read')}</button>${e.link ? `<a class="btn btn-ghost btn-sm" href="${esc(e.link)}" target="_blank" rel="noopener">${t(up ? 'ev.reg' : 'ev.details')}</a>` : ''}${cal ? `<a class="btn btn-ghost btn-sm" href="${esc(cal.google)}" target="_blank" rel="noopener">Google ${t('ev.cal')}</a>` : ''}</div></div></article>`;
}
let evList = [];
function openEvent(i) {
  const e = evList[i], dlg = $('#evDlg'); if (!e) return;
  const up = evEnd(e) >= new Date(), cal = up ? evCalLinks(e) : null, art = evArticle(e);
  $('#evDlgBody').innerHTML = `${evGallery(e, 'dg-gallery')}<div class="dg-text"><span class="tag">${esc(evLabel(e))}</span><h2 id="evDlgTitle">${esc(pick(e)[0])}</h2>${evMeta(e)}<div class="dg-article">${art ? paras(art) : paras(pick(e)[1])}</div><div class="evc-actions">${e.link ? `<a class="btn btn-primary btn-sm" href="${esc(e.link)}" target="_blank" rel="noopener">${t(up ? 'ev.reg' : 'ev.details')}</a>` : ''}${cal ? `<a class="btn btn-ghost btn-sm" href="${esc(cal.google)}" target="_blank" rel="noopener">Google ${t('ev.cal')}</a><a class="btn btn-ghost btn-sm" href="${esc(cal.ics)}" download="event.ics">Apple / Outlook (.ics)</a>` : ''}</div></div>`;
  dlg.showModal();
}
function renderEventsPage() {
  const track = $('#evSlides'); if (track === NULL) return;
  evList = evSorted();
  fillSlider('#evSlides', evList.length ? evList.map((e, i) => evSlide(e, i, evList.length)).join('') : `<p class="empty">${t('ev.up.none')}</p>`, evList.length);
  const kinds = { video: 'Video', interview: 'Interview', podcast: 'Podcast', show: 'Show', article: 'Article' };
  const items = [...MEDIA].sort((x, y) => y.date.localeCompare(x.date)).map(m => { const id = ytIdOf(m.url);
    return `<a class="mc" href="${esc(m.url)}" target="_blank" rel="noopener"><div class="mc-art">${id ? `<img src="https://img.youtube.com/vi/${id}/hqdefault.jpg" alt="" loading="lazy" width="480" height="360">` : `<span class="mc-ph">${svg('video')}</span>`}${id ? '<span class="play-badge" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.500v13l11-6.500z" fill="currentColor" stroke="none"/></svg></span>' : ''}</div><div class="mc-body"><span class="tag">${esc(kinds[m.kind] || m.kind)}</span><h3>${esc(lang === 'so' ? (m.so || m.en) : m.en)}</h3><p>${esc([m.outlet, fmtDate(m.date)].filter(Boolean).join(' · '))}</p></div></a>`; });
  const channel = `<a class="mc mc-channel" href="https://www.youtube.com/@engyuyu" target="_blank" rel="noopener"><div class="mc-body"><span class="tag">YouTube</span><h3>${t('ev.channel.t')}</h3><p>${t('ev.channel.p')}</p><span class="more">@engyuyu →</span></div></a>`;
  $('#mediaGrid').innerHTML = channel + items.join('');
}
/* ---------- generic slider: scroll-snap track + prev/next + dots + keyboard ---------- */
function fillSlider(sel, html, n) {
  const track = $(sel); if (track === NULL) return;
  const block = track.closest('.slider-block'), section = block.parentElement;
  track.innerHTML = html; track.scrollLeft = 0;
  $('.dots', block).innerHTML = n > 1 ? Array.from({ length: n }, (_, i) => `<button type="button" role="tab" aria-label="${i + 1} / ${n}" aria-selected="${i === 0}" data-dot="${i}"></button>`).join('') : '';
  $$('[data-prev], [data-next]', section.parentElement.querySelector('.slider-nav') || section).forEach(b => b.hidden = n < 2);
  track.dispatchEvent(new Event('scroll'));
}
/* Home page sliders (latest articles, latest events) advance on their own. They pause on hover/focus/touch, while off-screen,
   while the tab is hidden or a dialog is open, and the visitor can stop them with the pause button. Off when "reduce motion" is set. */
const AUTO_SLIDERS = ['blogSlides', 'homeEvSlides'], AUTO_MS = 5500;
function autoplay(block, go, idx, count, dots) {
  let last = Date.now(), hover = false, focus = false, inView = false, stopped = false;
  const bar = document.createElement('div'); bar.className = 'sl-bar'; dots.replaceWith(bar);
  const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'sl-pause'; btn.setAttribute('aria-pressed', 'false'); btn.setAttribute('data-i18n-aria', 'sl.pause');
  btn.innerHTML = '<svg class="i-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg><svg class="i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
  bar.append(dots, btn); btn.setAttribute('aria-label', t('sl.pause'));
  btn.addEventListener('click', () => { stopped = !stopped; btn.setAttribute('aria-pressed', stopped); btn.setAttribute('data-i18n-aria', stopped ? 'sl.play' : 'sl.pause'); btn.setAttribute('aria-label', t(stopped ? 'sl.play' : 'sl.pause')); last = Date.now(); });
  const bump = () => { last = Date.now(); };
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => block.addEventListener(ev, bump, { passive: true }));
  block.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') hover = true; }); block.addEventListener('pointerleave', () => { hover = false; bump(); });
  block.addEventListener('focusin', () => { focus = true; }); block.addEventListener('focusout', () => { focus = false; bump(); });
  setInterval(() => {
    const r = block.getBoundingClientRect(), now = r.top < innerHeight * 0.8 && r.bottom > innerHeight * 0.2;   // roughly on screen
    if (now !== inView) { inView = now; if (now) bump(); }
    if (stopped || hover || focus || !inView || document.hidden || count() < 2 || document.querySelector('dialog[open]') || Date.now() - last < AUTO_MS - 150) return;
    const i = idx(); go(i + 1 >= count() ? 0 : i + 1); last = Date.now();
  }, 500);
}
function initSliders() {
  $$('.slider-block').forEach(block => {
    const track = $('.slides', block), section = block.parentElement, prev = $('[data-prev]', section), next = $('[data-next]', section), dots = $('.dots', block);
    const count = () => $$('.slide', track).length, idx = () => Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    const go = i => track.scrollTo({ left: Math.max(0, Math.min(count() - 1, i)) * track.clientWidth, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    const paint = () => { const i = idx(); $$('button', dots).forEach((d, k) => d.setAttribute('aria-selected', k === i)); if (prev) prev.disabled = i <= 0; if (next) next.disabled = i >= count() - 1; };
    let raf = 0; track.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(paint); }, { passive: true });
    if (prev) prev.addEventListener('click', () => go(idx() - 1)); if (next) next.addEventListener('click', () => go(idx() + 1));
    dots.addEventListener('click', e => { const b = e.target.closest('[data-dot]'); if (b) go(+b.dataset.dot); });
    $('.slider', block).addEventListener('keydown', e => { if (e.key === 'ArrowRight') { e.preventDefault(); go(idx() + 1); } if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx() - 1); } });
    addEventListener('resize', () => go(idx()), { passive: true });
    if (AUTO_SLIDERS.includes(track.id) && !reduceMotion.matches) autoplay(block, go, idx, count, dots);
  });
  // thumbnails swap the main photo; "Read highlights" opens the full story
  document.addEventListener('click', e => {
    const th = e.target.closest('.g-th'); if (th) { const g = th.closest('.sl-gallery, .dg-gallery'); g.querySelector('.g-main img').src = th.dataset.src; $$('.g-th', g).forEach(x => x.setAttribute('aria-pressed', x === th)); return; }
    const rd = e.target.closest('[data-ev]'); if (rd) openEvent(+rd.dataset.ev);
  });
  if (has('#evDlg')) { $('#evDlgClose').addEventListener('click', () => $('#evDlg').close()); $('#evDlg').addEventListener('click', e => { if (e.target === $('#evDlg')) $('#evDlg').close(); }); }
}
function renderBlog() {   // home: latest 3 articles as a slider
  const track = $('#blogSlides'); if (track === NULL) return;
  const list = [...POSTS].sort((x, y) => String(y.date).localeCompare(String(x.date))).slice(0, 3), n = list.length;
  fillSlider('#blogSlides', list.length ? list.map((p, i) => {
    const link = p.href ? ' href="' + esc(p.href) + '"' : '', tag = p.href ? 'a' : 'div';
    return `<article class="slide" role="group" aria-roledescription="slide" aria-label="${i + 1} / ${n}">
      <${tag} class="sl-gallery blog-img"${link}${p.href ? ` aria-label="${esc(pick(p)[0])}"` : ''}><div class="g-main">${p.thumb ? `<img src="${esc(p.thumb)}" alt="" loading="lazy" width="1280" height="720">` : patternArt(i + 3)}${p.video ? '<span class="play-badge big" aria-label="Video"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/></svg></span>' : ''}</div></${tag}>
      <div class="sl-body"><div class="evc-top"><span class="tag">${esc(CATS[p.cat] ? CATS[p.cat][lang === 'so' ? 1 : 0] : p.cat)}</span></div>
        <h3>${esc(pick(p)[0])}</h3><p class="evc-meta"><time datetime="${p.date}">${fmtDate(p.date)}</time><span aria-hidden="true">·</span><span>${p.min} ${t('blog.min')}</span></p><p class="sl-text">${esc(pick(p)[1])}</p>
        <div class="evc-actions">${p.href ? `<a class="btn btn-primary btn-sm" href="${esc(p.href)}">${t('blog.read')}</a>` : ''}${p.video && p.href ? `<a class="btn btn-ghost btn-sm" href="${esc(p.href)}">${t('blog.watch')}</a>` : ''}</div></div></article>`;
  }).join('') : `<p class="empty">${t('blog.none')}</p>`, n);
}
function renderCommunity() {
  $('#communityLinks').innerHTML = COMMUNITY.map(c => `
    <a class="com-link" href="${c.href}" rel="noopener"><span class="ico">${svg(c.icon)}</span>
      <span><b>${esc(c.name)}</b><small>${esc(lang === 'so' ? c.so : c.en)}</small></span>${svg('arrow')}</a>`).join('');
}
function renderPartners() {
  // Logos only (light / dark versions). A partner without a logo falls back to its name as text.
  const item = p => {
    const o = typeof p === 'string' ? { name: p } : p, dark = o.dark === 'custom' && o.logoDark, inv = o.dark === 'invert';
    const inner = o.logo
      ? `<span class="p-logo${dark ? ' has-dark' : ''}${inv ? ' inv' : ''}"><img class="pl-light" src="${esc(o.logo)}" alt="${esc(o.name)}">${dark ? `<img class="pl-dark" src="${esc(o.logoDark)}" alt="${esc(o.name)}">` : ''}</span>`
      : `<span class="p-text">${esc(o.name)}</span>`;
    return o.url ? `<a class="partner" href="${esc(o.url)}" target="_blank" rel="noopener" aria-label="${esc(o.name)}">${inner}</a>` : `<div class="partner" role="img" aria-label="${esc(o.name)}">${inner}</div>`;
  };
  const row = [...PARTNERS, ...PARTNERS, ...PARTNERS].map(item).join('');
  // Duplicate row for a seamless loop; the copy is hidden from assistive tech
  $('#marquee').innerHTML = `<div class="marquee-track">${row}<div style="display:contents" aria-hidden="true">${row}</div></div>`;
}

