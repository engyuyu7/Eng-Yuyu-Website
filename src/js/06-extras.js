/* ---- WhatsApp button + intro video (both appear only once set in Dashboard → Settings) ---- */
const EXTRAS = { whatsapp: String(CONFIG.whatsapp || '').replace(/\D/g, ''), intro: (String(CONFIG.introVideo || '').match(/[A-Za-z0-9_-]{11}$/) || [''])[0] };
const WA_ICON = '<svg class="wa-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>';
const PLAY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
const trNode = root => { root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); }); root.querySelectorAll('[data-i18n-aria]').forEach(el => el.setAttribute('aria-label', t(el.dataset.i18nAria))); };
const ytFrame = id => '<iframe src="https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0&modestbranding=1&playsinline=1" title="Eng Yuyu" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>';
const playerHtml = id => '<div class="intro-player"><button class="intro-play" type="button" data-id="' + id + '" data-i18n-aria="intro.play" aria-label="Play"><img src="https://i.ytimg.com/vi/' + id + '/maxresdefault.jpg" alt="" loading="lazy" width="1280" height="720" data-fb="https://i.ytimg.com/vi/' + id + '/hqdefault.jpg"><span class="play-ico">' + PLAY_ICON + '</span><span class="intro-len" data-i18n="intro.watch">Watch the intro</span></button></div>';
// WhatsApp: a chat popup (home + consulting open it once by themselves), a floating button everywhere, and links in the
// footer / contact section. Messages come from Dashboard → Settings → WhatsApp and include the session being viewed.
const waText = kind => {
  const w = EXTRAS.wa || {}, tpl = ((w[kind] || {})[lang]) || t('wa.def.' + kind);
  const s = document.body.dataset.page === 'consulting' && typeof curSession === 'function' ? curSession() : null;
  const out = tpl.replace(/\{session\}/g, s ? pick(s)[0] : t('wa.anySession')).replace(/\{price\}/g, s ? '(' + price(s) + ')' : '').replace(/\{link\}/g, location.origin + '/book' + (s ? '/' + s.id : ''));
  return out.replace(/\s+([.,?!:])/g, '$1').replace(/\s{2,}/g, ' ').trim();
};
const waLink = kind => 'https://wa.me/' + EXTRAS.whatsapp + '?text=' + encodeURIComponent(waText(kind));
function waPopup(open, auto) {
  const pop = document.getElementById('waPop'), fab = document.querySelector('.wa-fab'); if (!pop || !fab) return;
  if (open) {
    pop.querySelector('[data-wa="book"]').href = waLink('book'); pop.querySelector('[data-wa="ask"]').href = waLink('ask');
    pop.hidden = false; requestAnimationFrame(() => pop.classList.add('on')); fab.setAttribute('aria-expanded', 'true');
    if (!auto) pop.querySelector('.wa-act').focus({ preventScroll: true });
    track(auto ? 'wa_popup_auto' : 'wa_popup_open');
  } else { pop.classList.remove('on'); fab.setAttribute('aria-expanded', 'false'); setTimeout(() => { pop.hidden = true; }, reduceMotion.matches ? 0 : 200); }
}
function renderExtras() {
  const num = EXTRAS.whatsapp, w = EXTRAS.wa || {}, page = document.body.dataset.page;
  if (!num) { document.querySelectorAll('.js-wa, .wa-fab, #waPop').forEach(n => n.remove()); }
  else {
    if (!document.querySelector('.wa-fab')) {
      const fab = document.createElement('button'); fab.type = 'button'; fab.className = 'wa-fab'; fab.setAttribute('aria-controls', 'waPop'); fab.setAttribute('aria-expanded', 'false'); fab.setAttribute('data-i18n-aria', 'wa.pop.label'); fab.innerHTML = WA_ICON;
      const pop = document.createElement('div'); pop.className = 'wa-pop'; pop.id = 'waPop'; pop.hidden = true; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-labelledby', 'waPopName');
      pop.innerHTML = '<div class="wa-head"><img class="wa-av" src="/assets/yuyu-blue-600.png" alt="" width="44" height="44"><div class="wa-who"><b id="waPopName">Eng Yuyu</b><small><i class="wa-dot" aria-hidden="true"></i><span class="wa-reply"></span></small></div><button type="button" class="wa-x" data-i18n-aria="wa.pop.close" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>'
        + '<div class="wa-body"><p class="wa-bubble"></p></div>'
        + '<div class="wa-acts"><a class="wa-act wa-primary" data-wa="site" href="/consulting.html#book"><span data-i18n="wa.pop.book">Book a session online</span></a><a class="wa-act wa-green" data-wa="book" target="_blank" rel="noopener">' + WA_ICON + '<span data-i18n="wa.pop.bookWa">Book on WhatsApp</span></a><a class="wa-act" data-wa="ask" target="_blank" rel="noopener"><span data-i18n="wa.pop.ask">Ask a question</span></a></div>';
      document.body.append(pop, fab);
      fab.addEventListener('click', () => waPopup(pop.hidden));
      pop.querySelector('.wa-x').addEventListener('click', () => { waPopup(false); store.set('yy-wa-pop', String(Date.now())); fab.focus(); });
      pop.addEventListener('keydown', e => { if (e.key === 'Escape') { waPopup(false); fab.focus(); } });
      pop.addEventListener('click', e => {
        const act = e.target.closest('[data-wa]'); if (!act) return;
        track('wa_' + act.dataset.wa); store.set('yy-wa-pop', String(Date.now()));
        if (act.dataset.wa === 'site' && page === 'consulting') { e.preventDefault(); waPopup(false); const bk = document.getElementById('sessions') || document.getElementById('book'); if (bk) bk.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' }); }
      });
      const a = (cls, inner) => { const el = document.createElement('a'); el.className = 'js-wa ' + cls; el.target = '_blank'; el.rel = 'noopener'; el.innerHTML = inner; return el; };
      const fn = document.querySelector('.foot-nav'); if (fn) fn.appendChild(a('', '<span data-i18n="wa.chat">Chat on WhatsApp</span>'));
      const mail = document.querySelector('#contact .mail'); if (mail) { const p = document.createElement('p'); p.className = 'wa-line'; p.append(a('wa-inline', WA_ICON + '<span data-i18n="wa.prefer">Prefer WhatsApp? Message me directly.</span>')); mail.after(p); }
      trNode(document.body);
      // the popup opens by itself once on the home and consulting pages (not again for 3 days after it is closed or used)
      const last = +store.get('yy-wa-pop') || 0, back = new URLSearchParams(location.search).has('order_id');
      if (w.popup !== false && (page === 'home' || page === 'consulting') && !back && Date.now() - last > 3 * 864e5)
        setTimeout(() => { if (pop.hidden && !document.querySelector('dialog[open]') && document.getElementById('payStatus')?.hidden !== false) { waPopup(true, true); store.set('yy-wa-pop', String(Date.now())); } }, Math.max(0, +w.delay || 8) * 1000);
    }
    const pop = document.getElementById('waPop');
    if (pop) { pop.querySelector('.wa-bubble').textContent = ((w.greeting || {})[lang]) || t('wa.def.greeting'); pop.querySelector('.wa-reply').textContent = ((w.reply || {})[lang]) || t('wa.def.reply'); }
    document.querySelectorAll('.js-wa').forEach(n => { n.href = waLink('ask'); });
  }
  const id = EXTRAS.intro;
  if (!id) { document.querySelectorAll('.js-intro').forEach(n => n.remove()); return; }
  if (document.querySelector('.js-intro')) return;
  if (page === 'home') {
    const s = document.createElement('section'); s.className = 'section intro js-intro'; s.id = 'intro'; s.setAttribute('aria-labelledby', 'intro-title');
    s.innerHTML = '<div class="wrap intro-grid"><div class="intro-copy"><p class="kicker" data-i18n="intro.k">Start here</p><h2 id="intro-title" data-i18n="intro.t">Who I am and how a session works</h2><p class="muted" data-i18n="intro.p"></p><ul class="intro-points"><li data-i18n="intro.b1"></li><li data-i18n="intro.b2"></li><li data-i18n="intro.b3"></li></ul><a class="btn btn-primary" href="consulting.html#book"><span data-i18n="cta.book">Book a consultation</span></a></div>' + playerHtml(id) + '</div>';
    const anchor = document.querySelector('.audience'); if (anchor) anchor.before(s); else return; trNode(s);
  } else if (page === 'consulting') {
    const head = document.querySelector('#book .sec-head'); if (!head) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-ghost intro-btn js-intro'; b.innerHTML = PLAY_ICON + '<span data-i18n="intro.btn">Watch: how a session works</span>'; head.appendChild(b);
    const d = document.createElement('dialog'); d.className = 'ev-dlg intro-dlg js-intro'; d.setAttribute('aria-label', 'Intro video');
    d.innerHTML = '<button class="icon-btn ev-x" type="button" data-i18n-aria="intro.close" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button><div class="intro-player intro-frame"></div>';
    document.body.appendChild(d);
    const frame = d.querySelector('.intro-frame'), shut = () => { frame.innerHTML = ''; d.close(); };
    b.onclick = () => { frame.innerHTML = ytFrame(id); d.showModal(); track('intro_play'); };
    d.querySelector('.ev-x').onclick = shut; d.addEventListener('click', e => { if (e.target === d) shut(); }); d.addEventListener('cancel', () => { frame.innerHTML = ''; });
    trNode(b); trNode(d);
  }
}
// image fallbacks and the search form use listeners (no inline handlers) so the Content-Security-Policy can forbid them
document.addEventListener('error', e => { const i = e.target; if (i && i.tagName === 'IMG' && i.dataset.fb && !i.dataset.fbd) { i.dataset.fbd = '1'; i.src = i.dataset.fb; } }, true);
document.querySelectorAll('form.s-box').forEach(f => f.addEventListener('submit', e => e.preventDefault()));
document.addEventListener('click', e => {
  if (e.target.closest('.js-wa')) track('whatsapp_click');
  const p = e.target.closest('.intro-play'); if (p) { p.parentElement.innerHTML = ytFrame(p.dataset.id); track('intro_play'); }
});

