/* =====================================================================
   Search (dialog + keyboard)
   ===================================================================== */
const searchDlg = $('#searchDlg'), sInput = $('#searchInput'), sList = $('#searchList');
let sIndex = [], sResults = [], sActive = 0;
function buildSearchIndex() {
  const pages = [['consulting', 'nav.consulting', 'con.lead'], ['events', 'nav.events', 'ev.title'], ['blog', 'nav.blog', 'blog.title'], ['about', 'nav.about', 'ab.title'], ['about', 'ap.h1', 'ap.lead'], ['contact', 'cta.work', 'ct.lead']];
  sIndex = [
    ...pages.map(([id, a, b]) => ({ kind: 'k.page', title: t(a), sub: t(b), href: (id === 'about' ? 'about.html' : id === 'consulting' ? 'consulting.html' : id === 'events' ? 'events.html' : id === 'blog' ? '/blog' : 'index.html#' + id) })),
    ...SERVICES.map(s => ({ kind: 'k.service', title: pick(s)[0], sub: pick(s)[1], href: 'consulting.html#book' })),
    ...EVENTS.map(e => ({ kind: 'k.event', title: pick(e)[0], sub: pick(e)[1], href: 'events.html' })),
    ...POSTS.map(p => ({ kind: 'k.post', title: pick(p)[0], sub: pick(p)[1], href: p.href || '/blog' })),
  ].map(i => ({ ...i, hay: (i.title + ' ' + i.sub).toLowerCase() }));
}
function runSearch() {
  const q = sInput.value.trim().toLowerCase();
  if (!q) { sResults = sIndex.filter(i => i.kind === 'k.page'); }
  else {
    const words = q.split(/\s+/);
    sResults = sIndex.filter(i => words.every(w => i.hay.includes(w)))
      .sort((a, b) => (b.title.toLowerCase().includes(q) - a.title.toLowerCase().includes(q)));
  }
  sActive = 0; paintResults(q);
}
function paintResults(q) {
  if (!sResults.length) { sList.innerHTML = `<li class="s-empty">${t('search.none')} “${esc(q)}”</li>`; sInput.removeAttribute('aria-activedescendant'); return; }
  sList.innerHTML = sResults.map((r, i) => `<li class="s-item" role="option" id="sr-${i}" data-i="${i}" aria-selected="${i === sActive}">
    <span class="t">${esc(r.title)}<small>${esc(r.sub.length > 78 ? r.sub.slice(0, 76) + '…' : r.sub)}</small></span><span class="k">${t(r.kind)}</span></li>`).join('');
  sInput.setAttribute('aria-activedescendant', 'sr-' + sActive);
}
function go(i) {
  const r = sResults[i]; if (!r) return;
  searchDlg.close();
  if (isHome && r.href.startsWith('index.html#')) location.hash = r.href.split('#')[1]; else location.href = r.href;
}
function openSearch() { if (!searchDlg.open) searchDlg.showModal(); sInput.value = ''; runSearch(); sInput.focus(); }
$('#searchBtn').addEventListener('click', openSearch);
$('#searchClose').addEventListener('click', () => searchDlg.close());
searchDlg.addEventListener('click', e => { if (e.target === searchDlg) searchDlg.close(); });
sInput.addEventListener('input', runSearch);
sInput.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault(); if (!sResults.length) return;
    sActive = (sActive + (e.key === 'ArrowDown' ? 1 : -1) + sResults.length) % sResults.length;
    paintResults(sInput.value); $('#sr-' + sActive)?.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') { e.preventDefault(); go(sActive); }
});
sList.addEventListener('click', e => { const li = e.target.closest('.s-item'); if (li) go(+li.dataset.i); });
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); }
  else if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); openSearch(); }
});

