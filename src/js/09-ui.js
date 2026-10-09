/* =====================================================================
   Theme / language / menu
   ===================================================================== */
const root = document.documentElement;
// Smooth state changes: cross-fade the whole page (View Transitions), with a CSS-transition fallback
const smooth = fn => {
  if (document.startViewTransition && !reduceMotion.matches && !document.hidden) {
    try { const vt = document.startViewTransition(fn); [vt.ready, vt.finished, vt.updateCallbackDone].forEach(p => p && p.catch(() => {})); return; } catch { /* fall through */ }
  }
  root.classList.add('theme-anim'); fn(); setTimeout(() => root.classList.remove('theme-anim'), 450);
};
$('#themeBtn').addEventListener('click', () => smooth(() => {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next; store.set('yy-theme', next);
  document.querySelector('meta[name="theme-color"]').content = next === 'dark' ? '#06111F' : '#FFFFFF';
  nets.forEach(n => n.recolor());
}));
$('#langBtn').addEventListener('click', () => { if (document.body.dataset.page === 'blog' && document.body.dataset.alt) { location.href = document.body.dataset.alt; return; } smooth(() => { lang = lang === 'en' ? 'so' : 'en'; store.set('yy-lang', lang); applyLang(); }); });
// mobile: floating "Book a consultation" button (the header CTA is hidden on small screens)
if (document.body.dataset.page !== 'consulting') {
  const m = document.createElement('a'); m.className = 'm-cta'; m.href = '/consulting.html#book';
  m.innerHTML = '<span data-i18n="cta.book">Book a consultation</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  document.body.appendChild(m);
  const upd = () => m.classList.toggle('show', scrollY > 520 && innerHeight + scrollY < document.documentElement.scrollHeight - 460);
  addEventListener('scroll', upd, { passive: true }); upd();
}
// header gains depth once the page scrolls
const headEl = $('.site-header'); let scrolled = false;
addEventListener('scroll', () => { const s = scrollY > 8; if (s !== scrolled) { scrolled = s; headEl.classList.toggle('scrolled', s); } }, { passive: true });

// Logo = home: smooth-scroll to top and clear any #section from the URL
if (isHome) $$('.brand').forEach(b => b.addEventListener('click', e => {
  e.preventDefault(); setMenu(false);
  scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  history.replaceState(null, '', location.pathname + location.search);
}));

const menuBtn = $('#menuBtn'), nav = $('#nav');
const setMenu = open => { nav.classList.toggle('open', open); menuBtn.setAttribute('aria-expanded', open); };
menuBtn.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
nav.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

// Active nav link on scroll
const navLinks = $$('.nav a');
const navIds = [];   // nav links are page links now
const spy = new IntersectionObserver(es => es.forEach(en => {
  if (en.isIntersecting) navLinks.forEach(a => a.classList.toggle('active', navIds.includes(en.target.id) && a.getAttribute('href') === '#' + en.target.id));
}), { rootMargin: '-45% 0px -50% 0px' });
if (isHome) $$('main > section').forEach(s => spy.observe(s));

