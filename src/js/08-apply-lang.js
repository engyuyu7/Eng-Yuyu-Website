/* ---- i18n apply ---- */
function applyLang() {
  document.documentElement.lang = lang;
  renderExtras();
  $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-aria]').forEach(el => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
  $$('[data-i18n-ph]').forEach(el => el.setAttribute('placeholder', t(el.dataset.i18nPh)));
  document.title = isHome
    ? (lang === 'so' ? 'Eng Yuyu | Tiknolojiyo. Nuxur. Koboc Dijitaal.' : 'Eng Yuyu | Technology. Content. Digital Growth.')
    : document.body.dataset.page === 'events'
      ? (lang === 'so' ? 'Dhacdooyin & Warbaahin | Eng Yuyu' : 'Events & Media | Eng Yuyu')
    : document.body.dataset.page === 'consulting'
      ? (lang === 'so' ? 'La-talin Dijitaal 1:1, Ballan qabso Eng Yuyu' : '1:1 Digital Consulting, Book a session with Eng Yuyu')
      : (lang === 'so' ? 'Ku saabsan Eng Yuyu | Macallin Tiknolojiyo & Abuure Nuxur' : 'About Eng Yuyu | Tech Educator & Content Creator');
  if (document.body.dataset.page === 'blog') document.title = initialTitle;
  if (document.body.dataset.page === 'legal') document.title = t(location.pathname.includes('terms') ? 'legal.terms.t' : 'legal.privacy.t') + ' | Eng Yuyu';
  renderServices(); renderServiceChips(); renderEvents(); renderBlog(); renderCommunity(); renderProof(); renderEventsPage();
  if (typeof renderSessions === 'function' && has('#sessions')) { renderSessions(); updatePay(); renderNative(); }
  paintStats(); buildSearchIndex();
  if (searchDlg.open) runSearch();
}

