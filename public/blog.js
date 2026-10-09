/* Blog post enhancements: reactions, comments, sharing, reading progress, view count. No dependencies. */
(() => {
  'use strict';
  const art = document.querySelector('.post-page'); if (!art) return;
  const slug = art.dataset.slug, API = '/api/blog/' + slug;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const track = e => { try { navigator.sendBeacon('/api/track', new Blob([JSON.stringify({ e })], { type: 'text/plain' })); } catch { /* ignore */ } };

  // table of contents from the article's section headings (shown when there are 3 or more)
  const toc = $('#toc'), hs = $$('.article h2');
  if (toc && hs.length >= 3) {
    toc.innerHTML = '<p class="toc-t">' + toc.dataset.title + '</p><ol>' + hs.map((h, i) => { h.id = h.id || 's-' + (i + 1); return '<li><a href="#' + h.id + '"></a></li>'; }).join('') + '</ol>';
    $$('a', toc).forEach((x, i) => { x.textContent = hs[i].textContent; });
    toc.hidden = false;
  }

  // reading progress bar
  const bar = $('.read-progress i');
  const onScroll = () => { const r = art.getBoundingClientRect(), h = r.height - innerHeight; bar.style.transform = `scaleX(${Math.min(1, Math.max(0, -r.top / (h || 1)))})`; };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // one view per visitor per day (counted on the server)
  fetch(API + '/view', { method: 'POST' }).then(r => r.json()).then(j => { const v = $('#viewCount'); if (v && j.views) v.textContent = v.textContent.replace(/^[\d,]+/, j.views.toLocaleString('en')); }).catch(() => {});

  // reactions (toggle; one reaction per visitor)
  const paint = d => { $$('.react').forEach(b => { b.querySelector('b').textContent = d.totals[b.dataset.r] || 0; b.setAttribute('aria-pressed', d.mine === b.dataset.r); }); };
  fetch(API + '/react').then(r => r.json()).then(paint).catch(() => {});
  $$('.react').forEach(b => b.addEventListener('click', async () => {
    b.disabled = true;
    try { const r = await fetch(API + '/react', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ r: b.dataset.r }) }); if (r.ok) { paint(await r.json()); track('react'); } } catch { /* offline */ }
    b.disabled = false;
  }));

  // sharing
  const url = location.origin + location.pathname, title = document.querySelector('h1').textContent;
  const native = $('[data-share="native"]'); if (navigator.share && native) native.hidden = false;
  $$('[data-share]').forEach(el => el.addEventListener('click', async e => {
    track('share_' + el.dataset.share);
    if (el.dataset.share === 'copy') { e.preventDefault(); try { await navigator.clipboard.writeText(url); } catch { const i = document.createElement('input'); i.value = url; document.body.appendChild(i); i.select(); document.execCommand('copy'); i.remove(); } const s = el.querySelector('span'), old = s.textContent; s.textContent = el.dataset.copied; setTimeout(() => s.textContent = old, 1800); }
    if (el.dataset.share === 'native') { e.preventDefault(); try { await navigator.share({ title, url }); } catch { /* cancelled */ } }
  }));
  $$('[data-track]').forEach(el => el.addEventListener('click', () => track(el.dataset.track)));
  $$('.video-card').forEach(el => el.addEventListener('click', () => track('video_click')));

  // comments
  const form = $('#cmForm'), msg = $('#cmMsg'), list = $('#cmList');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const name = form.name.value.trim(), text = form.text.value.trim();
    [form.name, form.text].forEach(i => i.setAttribute('aria-invalid', !i.value.trim()));
    if (!name || text.length < 2) { msg.textContent = form.name.value.trim() ? '' : ''; msg.className = 'form-msg bad'; msg.textContent = document.documentElement.lang === 'so' ? 'Fadlan geli magacaaga iyo faallada.' : 'Please add your name and a comment.'; return; }
    const btn = form.querySelector('button[type=submit]'); btn.disabled = true;
    try {
      const r = await fetch(API + '/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, text, email: form.email.value, website: form.website.value }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'error');
      msg.className = 'form-msg ok'; msg.textContent = j.status === 'approved' ? msg.dataset.posted : msg.dataset.pending;
      if (j.comment) { $('#cmNone')?.remove(); list.insertAdjacentHTML('beforeend', `<li class="cm"><div class="cm-av" aria-hidden="true">${esc(name[0].toUpperCase())}</div><div><p class="cm-h"><b>${esc(name)}</b></p><p>${esc(text)}</p></div></li>`); }
      if (j.comment) { const cc = $('#cmCount'); if (cc) cc.textContent = '(' + $$('#cmList .cm').length + ')'; }
      form.reset(); track('comment');
    } catch (err) { msg.className = 'form-msg bad'; msg.textContent = err.message; }
    btn.disabled = false;
  });
})();
