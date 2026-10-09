/* ---------- Backend integration (active when CONFIG.api or ?api= is set) ---------- */
function track(e) {   // privacy-friendly analytics: no cookies, no IPs stored
  if (!API) return;
  const body = JSON.stringify(e ? { e } : { p: location.pathname, r: document.referrer, l: lang, w: innerWidth });
  try { navigator.sendBeacon ? navigator.sendBeacon(API + '/api/track', new Blob([body], { type: 'text/plain' })) : fetch(API + '/api/track', { method: 'POST', body, keepalive: true }); } catch { /* ignore */ }
}
async function initRemote() {
  if (!API) return;
  try {   // content managed in the dashboard (arrays are replaced only if the dashboard has them)
    const c = await (await fetch(API + '/api/content', { cache: 'no-store' })).json();
    if (Array.isArray(c.posts)) POSTS.splice(0, POSTS.length, ...c.posts);
    if (Array.isArray(c.events)) EVENTS.splice(0, EVENTS.length, ...c.events);
    if (Array.isArray(c.partners) && c.partners.length) PARTNERS.splice(0, PARTNERS.length, ...c.partners);
    if (Array.isArray(c.community)) COMMUNITY.splice(0, COMMUNITY.length, ...c.community);
    if (Array.isArray(c.proof) && c.proof.length) PROOF.splice(0, PROOF.length, ...c.proof);
    if (Array.isArray(c.testimonials)) TESTIMONIALS.splice(0, TESTIMONIALS.length, ...c.testimonials);
    if (Array.isArray(c.media)) MEDIA.splice(0, MEDIA.length, ...c.media);
    if (Array.isArray(c.ads)) ADS.splice(0, ADS.length, ...c.ads);
    Object.keys(GUIDES).forEach(k => delete GUIDES[k]); Object.assign(GUIDES, c.guides || {});
    renderServices(); renderProof(); renderEventsPage(); renderAds();
    renderEvents(); renderBlog(); renderCommunity(); renderPartners(); buildSearchIndex();
  } catch { /* keep built-in content */ }
  try {   // prices, durations and booking rules set in the dashboard
    const c = await (await fetch(API + '/api/config', { cache: 'no-store' })).json();
    if (Array.isArray(c.sessionList) && c.sessionList.length) SESSIONS.splice(0, SESSIONS.length, ...c.sessionList);
    for (const s of SESSIONS) if (c.sessions && c.sessions[s.id]) { s.price = c.sessions[s.id].price; s.min = c.sessions[s.id].min; s.enabled = c.sessions[s.id].enabled; }
    if (c.availability) Object.assign(AV, c.availability);
    EXTRAS.whatsapp = String(c.whatsapp || EXTRAS.whatsapp || '').replace(/\D/g, ''); EXTRAS.wa = c.wa || {}; EXTRAS.intro = c.introVideo || EXTRAS.intro; renderExtras();
    apiCfg = { ...apiCfg, ...c }; apiCfgLoaded = true;
    const be = document.querySelector('.book-embed'); if (be && (c.payMode === 'test' || c.payMode === 'sandbox') && !document.getElementById('payModeNote')) { const n = document.createElement('p'); n.id = 'payModeNote'; n.className = 'pay-mode-note'; n.setAttribute('data-i18n', c.payMode === 'test' ? 'pay.testNote' : 'pay.sandboxNote'); n.textContent = t(n.dataset.i18n); be.prepend(n); }
    if (!SESSIONS.some(s => s.id === activeSession && s.enabled !== false)) activeSession = (SESSIONS.find(s => s.enabled !== false) || SESSIONS[0]).id;
    renderServiceChips();
    if (has('#sessions')) { renderSessions(); updatePay(); showBooking(); }
  } catch { /* keep defaults */ }
}
if (API) { CONFIG.statsEndpoint = CONFIG.statsEndpoint || API + '/api/stats'; track(); }
$('#yr').textContent = new Date().getFullYear();
renderPartners();
if (!reduceMotion.matches) ['followers', 'views', 'youtube', 'facebook', 'tiktok', 'instagram'].forEach(k => shown[k] = 0);
applyLang();
initSliders();
initRemote();
setupReveal();
if (reduceMotion.matches) { startStats(); } else {
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { startStats(); io.disconnect(); } }, { threshold: .1 });
  if (isHome) io.observe($('.hero')); else { io.disconnect(); startStats(); }
}
})();

