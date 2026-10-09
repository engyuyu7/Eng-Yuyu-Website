/* =====================================================================
   Scroll reveal + boot
   ===================================================================== */
function setupReveal() {
  const targets = $$('.sec-head, .plat, .pillar, .service, .process, .ev, .post, .com-link, .about-photo, .about-copy, .nl-card, .form, .split-intro, .com-copy');
  if (reduceMotion.matches || !('IntersectionObserver' in window)) return;
  targets.forEach(el => el.classList.add('reveal'));
  const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px' });
  targets.forEach((el, i) => { el.style.transitionDelay = (i % 4) * 60 + 'ms'; io.observe(el); });
  // content rendered later (blog filter) shouldn't stay hidden
  new MutationObserver(() => $$('.post:not(.reveal), .ev:not(.reveal)').forEach(el => el.classList.add('reveal', 'in'))).observe(document.body, { childList: true, subtree: true });
}

// "Book a consultation" / "Work With Me" preselect the contact form's interest (also via ?type= from other pages)
const setType = v => { const s = $('#ctType'); if (s !== NULL && v && [...s.options].some(o => o.value === v)) s.value = v; };
$$('a[data-type]').forEach(l => l.addEventListener('click', () => setType(l.dataset.type)));
document.addEventListener('click', e => { if (e.target.closest('a[href*="consulting.html#book"], a[href="#book"]')) track('book_click'); });
setType(new URLSearchParams(location.search).get('type'));
