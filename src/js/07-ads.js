/* =================================================================
   PARTNER ADS (blog pages): a sliding showcase of 10–15 second partner clips / animated cards.
   Managed in Dashboard → Content → Partner ads. Every ad is labelled "Sponsored" and links with rel="sponsored".
   Auto-advances by each ad's own length; pauses on hover/focus, off-screen, hidden tab or when the visitor presses pause.
   Reduce-motion: no auto-advance or autoplay (clips show a poster with normal controls).
   ================================================================= */
// abstract, logo-free animated scenes for ads that have no video (each runs a 15 s loop while its slide is showing)
const AD_SCENES = {
  phone: '<div class="sc"><i class="floor"></i><div class="dev"><div class="body"><i class="rim"></i><div class="cam"><i class="lens l1"></i><i class="lens l2"></i><i class="lens l3"></i><i class="fl"></i><i class="ldr"></i></div><i class="shine"></i></div></div><i class="bk b1"></i><i class="bk b2"></i><i class="bk b3"></i><i class="bk b4"></i></div>',
  shield: '<div class="sc"><svg class="shd" viewBox="0 0 160 190" aria-hidden="true"><defs><linearGradient id="adgA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eafff4"/><stop offset=".4" stop-color="#52e8a0"/><stop offset="1" stop-color="#0a5c3b"/></linearGradient><linearGradient id="adgB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1fbf7b"/><stop offset="1" stop-color="#06402a"/></linearGradient><linearGradient id="adgC" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><path class="sh-out" fill="url(#adgA)" d="M80 8 20 30v58c0 50 26 80 60 94 34-14 60-44 60-94V30z"/><path class="sh-in" fill="url(#adgB)" d="M80 22 34 39v49c0 40 20 64 46 76 26-12 46-36 46-76V39z"/><path class="sh-gloss" fill="url(#adgC)" d="M80 22 34 39v49c0 12 2 22 6 31 20-29 50-59 86-67V39z"/><path class="sh-tick" d="M52 94 72 114 110 68"/></svg><i class="beam"></i><i class="ring r1"></i><i class="ring r2"></i><i class="thr t1"></i><i class="thr t2"></i><i class="thr t3"></i><i class="thr t4"></i><i class="thr t5"></i></div>',
  wallet: '<div class="sc"><i class="floor"></i><div class="wal"><i class="card ca"></i><i class="card cb"></i><div class="body"><i class="stitch"></i><i class="flap"></i><i class="clasp"></i></div></div><i class="coin c1"><b></b></i><i class="coin c2"><b></b></i><i class="coin c3"><b></b></i><i class="coin c4"><b></b></i><i class="spark s1"></i><i class="spark s2"></i><i class="spark s3"></i></div>',
};
const scene = k => AD_SCENES[k] || '';
// the 15 s story laid over a scene: 3 feature captions with a moving highlight, then a chat-style "message sent" end card
const story = (a, title, text, cta) => {
  const caps = ((a.caps && a.caps[lang === 'so' ? 'so' : 'en']) || []).filter(Boolean).slice(0, 3);
  return (caps.length ? '<i class="callout"></i><ol class="caps">' + caps.map((c, i) => '<li class="cap' + (i + 1) + '">' + esc(c) + '</li>').join('') + '</ol>' : '')
    + '<div class="endcard"><div class="chat"><span class="typing"><i></i><i></i><i></i></span><p class="msg">' + esc(text || title) + '</p><span class="sent">✓✓ ' + esc(t('ad.sent')) + '</span></div><span class="end-cta">' + esc(cta) + '</span></div>';
};
function renderAds() {
  const slot = document.getElementById('adSlot'); if (!slot) return;
  const real = ADS.filter(a => a.enabled !== false && a.partner && pick(a)[0]);
  const ads = real.concat([{ house: true, id: 'house', seconds: 10 }]);   // the last slide always invites advertisers
  slot.innerHTML = ''; if (slot._stop) { slot._stop(); slot._stop = null; }
  const still = reduceMotion.matches, hasVideo = real.some(a => a.video), n = ads.length;
  const logo = a => a.logo ? `<img class="ad-logo" src="${esc(a.logo)}" alt="" loading="lazy">` : `<span class="ad-logo-txt">${esc(a.partner)}</span>`;
  const houseSlide = i => `<article class="ad-slide ad-house" role="group" aria-roledescription="slide" aria-label="${i + 1} / ${n}" data-id="house"><div class="ad-media"><div class="ad-anim th-blue house" aria-hidden="true"><i class="a1"></i><i class="a2"></i><i class="a3"></i><div class="hs"><div class="frame"><span class="plus">+</span><b>${esc(t('ad.yours'))}</b><small>9:16 · 15 s</small></div><div class="stat"><b>1M+</b><span>${esc(t('ad.reach'))}</span></div></div></div></div><div class="ad-copy"><h3>${esc(t('ad.yours'))}</h3><p>${esc(t('ad.yoursText'))}</p><a class="btn btn-primary btn-sm" href="/?type=partner#contact" data-ad="house">${esc(t('ad.yoursCta'))}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a></div><span class="ad-bar" aria-hidden="true"><b></b></span></article>`;
  const slide = (a, i) => {
    if (a.house) return houseSlide(i);
    const [title, text] = pick(a), cta = (lang === 'so' ? a.cta[1] : a.cta[0]) || t('ad.cta');
    const media = a.video
      ? `<video class="ad-video" muted playsinline ${still ? 'controls' : 'loop'} preload="${i === 0 ? 'auto' : 'metadata'}" ${a.poster ? `poster="${esc(a.poster)}"` : ''} aria-label="${esc(title)}"><source src="${esc(a.video)}" type="video/${a.video.endsWith('.webm') ? 'webm' : 'mp4'}"></video>`
      : `<div class="ad-anim th-${esc(a.theme || 'blue')} ${a.scene ? 'has-scene sc-' + esc(a.scene) : ''}" aria-hidden="true"><i class="a1"></i><i class="a2"></i><i class="a3"></i><div class="ad-mark">${logo(a)}</div>${scene(a.scene)}${a.scene ? story(a, title, text, cta) : ''}</div>`;
    return `<article class="ad-slide" role="group" aria-roledescription="slide" aria-label="${i + 1} / ${n}" data-id="${esc(a.id || '')}">
      <div class="ad-media">${media}</div>
      <div class="ad-copy"><h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}${a.url ? `<a class="btn btn-primary btn-sm" href="${esc(a.url)}" target="_blank" rel="sponsored noopener noreferrer" data-ad="${esc(a.id || '')}">${esc(cta)}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>` : ''}</div>
      <span class="ad-bar" aria-hidden="true"><b></b></span></article>`;
  };
  slot.innerHTML = `<section class="ad-slider" aria-roledescription="carousel" aria-label="${esc(t('ad.sponsored'))}">
    <div class="ad-head"><span class="ad-badge">${esc(t('ad.sponsored'))}</span></div>
    <div class="ad-track" tabindex="0" aria-live="off">${ads.map(slide).join('')}</div>
    <div class="ad-dots" role="tablist">${ads.map((_, i) => `<button type="button" role="tab" data-i="${i}" aria-label="${i + 1} / ${n}" aria-selected="${i === 0}"></button>`).join('')}</div>
    <div class="ad-ctrl">${hasVideo ? `<button type="button" class="icon-btn" data-ad-mute aria-pressed="true" aria-label="${esc(t('ad.unmute'))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path class="snd" d="M16 9a4 4 0 0 1 0 6M18.500 6.500a8 8 0 0 1 0 11"/><path class="mute" d="m17 9 4 6M21 9l-4 6"/></svg></button>` : ''}
      ${still ? '' : `<button type="button" class="icon-btn" data-ad-pause aria-pressed="false" aria-label="${esc(t('ad.pause'))}"><svg class="i-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg><svg class="i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></button>`}
      <button type="button" class="icon-btn" data-ad-prev aria-label="${esc(t('ad.prev'))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg></button>
      <button type="button" class="icon-btn" data-ad-next aria-label="${esc(t('ad.next'))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button></div></section>`;
  const root = slot.firstElementChild; if (n < 2) root.classList.add('single');
  const badge = root.querySelector('.ad-badge'), track = root.querySelector('.ad-track'), slides = [...track.children], dots = [...root.querySelectorAll('.ad-dots button')];
  slides.forEach(sl => { const v = sl.querySelector('video'); if (v) v.addEventListener('loadedmetadata', () => { if (v.videoWidth && v.videoWidth / v.videoHeight > 0.7) v.classList.add('is-wide'); }); });   // a landscape clip is shown whole (not cropped) on a dark card
  const viewed = new Set(); let cur = 0, elapsed = 0, paused = false, hover = false, focus = false, muted = true;
  const dur = i => Math.min(15, Math.max(10, +ads[i].seconds || 12)) * 1000;
  const vid = i => slides[i].querySelector('video');
  const activate = (i, scroll) => {
    cur = (i + n) % n; elapsed = 0;
    slides.forEach((s, k) => { s.classList.toggle('is-active', k === cur); const v = vid(k); if (v && k !== cur) { v.pause(); v.currentTime = 0; } });
    dots.forEach((d, k) => d.setAttribute('aria-selected', k === cur)); badge.textContent = ads[cur].house ? t('ad.advertise') : t('ad.sponsored');
    if (scroll) track.scrollTo({ left: cur * track.clientWidth, behavior: still ? 'auto' : 'smooth' });
    const v = vid(cur); if (v && !still) { v.muted = muted; v.play().catch(() => {}); }
  };
  const onScreen = () => { const r = root.getBoundingClientRect(); return r.top < innerHeight * 0.85 && r.bottom > innerHeight * 0.15; };
  const timer = setInterval(() => {
    const live = onScreen() && !document.hidden;
    const v = vid(cur); if (v && !still) { if (live && !paused && !hover && !focus) { if (v.paused) v.play().catch(() => {}); } else if (!v.paused) v.pause(); }
    if (live && !viewed.has(cur) && ads[cur].id) { viewed.add(cur); track('adv_' + ads[cur].id); }
    if (still || paused || hover || focus || !live || n < 2) return;
    elapsed += 250; slides[cur].style.setProperty('--p', Math.min(1, elapsed / dur(cur)));
    if (elapsed >= dur(cur)) activate(cur + 1, true);
  }, 250);
  slot._stop = () => clearInterval(timer);
  root.querySelector('[data-ad-next]').onclick = () => activate(cur + 1, true);
  root.querySelector('[data-ad-prev]').onclick = () => activate(cur - 1, true);
  dots.forEach(d => d.onclick = () => activate(+d.dataset.i, true));
  const pb = root.querySelector('[data-ad-pause]');
  if (pb) pb.onclick = () => { paused = !paused; pb.setAttribute('aria-pressed', paused); pb.setAttribute('aria-label', t(paused ? 'ad.play' : 'ad.pause')); };
  const mb = root.querySelector('[data-ad-mute]');
  if (mb) mb.onclick = () => { muted = !muted; mb.setAttribute('aria-pressed', muted); mb.setAttribute('aria-label', t(muted ? 'ad.unmute' : 'ad.mute')); const v = vid(cur); if (v) v.muted = muted; };
  root.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') hover = true; }); root.addEventListener('pointerleave', () => { hover = false; });
  root.addEventListener('focusin', () => { focus = true; }); root.addEventListener('focusout', () => { focus = false; });
  let raf = 0; track.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth)); if (i !== cur && i >= 0 && i < n) activate(i, false); }); }, { passive: true });
  track.addEventListener('keydown', e => { if (e.key === 'ArrowRight') { e.preventDefault(); activate(cur + 1, true); } if (e.key === 'ArrowLeft') { e.preventDefault(); activate(cur - 1, true); } });
  root.addEventListener('click', e => { const a = e.target.closest('[data-ad]'); if (a && a.dataset.ad) track('adc_' + a.dataset.ad); });
  addEventListener('resize', () => track.scrollTo({ left: cur * track.clientWidth }), { passive: true });
  activate(0, false);
}
