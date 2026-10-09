/* =====================================================================
   Helpers
   ===================================================================== */
// Shared by every page: elements that only exist on some pages resolve to a harmless no-op object
const NULL = new Proxy(function () {}, { get: (_, k) => (k === Symbol.toPrimitive ? () => '' : NULL), set: () => true, apply: () => NULL });
const $ = (s, r = document) => r.querySelector(s) || NULL;
const has = s => !!document.querySelector(s);
const isHome = document.body.dataset.page === 'home';
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
let lang = store.get('yy-lang') || ((navigator.language || '').toLowerCase().startsWith('so') ? 'so' : 'en');
{ const ql = new URLSearchParams(location.search).get('lang'); if (ql === 'so' || ql === 'en') { lang = ql; store.set('yy-lang', ql); } }   // links like /book?lang=so open in that language
if (document.body.dataset.page === 'blog') lang = document.documentElement.lang === 'so' ? 'so' : 'en';   // blog pages are server-rendered per language
const initialTitle = document.title;
const t = k => (I18N[lang] && I18N[lang][k]) ?? I18N.en[k] ?? k;
const pick = o => (lang === 'so' ? o.so : o.en);

const ICONS = {
  chart: '<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="3"/><path d="m16 10 5-3v10l-5-3"/>',
  spark: '<path d="M12 3l1.9 5.1L19 10l-5.100 1.900L12 17l-1.900-5.100L5 10l5.100-1.900z"/><path d="M19 17v4M17 19h4"/>',
  cap: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.500V16c0 1.500 2.700 3 6 3s6-1.500 6-3v-4.500"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  play: '<rect x="3" y="5" width="18" height="14" rx="4"/><path d="m10 9 5 3-5 3z"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.600 7.100L4 20l1.200-4.400A8 8 0 1 1 21 12Z"/>',
  users: '<circle cx="9" cy="8" r="3.500"/><path d="M2.500 20a6.500 6.500 0 0 1 13 0M16 4.500a3.500 3.500 0 0 1 0 7M18 14.500a6.500 6.500 0 0 1 3.500 5.500"/>',
  arrow: '<path d="M7 17 17 7M8 7h9v9"/>',
};
const svg = n => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;
const fmtDate = d => new Intl.DateTimeFormat(lang === 'so' ? 'so' : 'en', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(d));
const fmtNum = n => {
  const loc = lang === 'so' ? 'so' : 'en';
  if (n >= 1e6) return (+(n / 1e6).toFixed(n >= 1e8 ? 0 : 2)).toLocaleString(loc) + 'M';
  if (n >= 1e3) return (+(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)).toLocaleString(loc) + 'K';
  return n.toLocaleString(loc);
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

