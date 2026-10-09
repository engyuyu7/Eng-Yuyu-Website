/* Writers' app: vanilla JS, no dependencies. Talks only to /api/writer/* (never the owner's dashboard API). */
'use strict';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toast = (m, bad) => { const t = $('#toast'); t.textContent = m; t.classList.toggle('bad', !!bad); t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 3200); };
let ME = null;

async function api(path, o = {}) {
  const r = await fetch('/api/writer' + path, { credentials: 'same-origin', ...o, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'yy-writer', ...(o.headers || {}) }, body: o.body !== undefined ? JSON.stringify(o.body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && !path.startsWith('/login') && !path.startsWith('/join') && !path.startsWith('/reset')) { showAuth('login'); throw new Error('Please sign in'); }
  if (!r.ok) { const e = new Error(j.error || 'Something went wrong'); e.data = j; throw e; }
  return j;
}
const guard = fn => async (...a) => { try { return await fn(...a); } catch (e) { if (e.message !== 'Please sign in') toast(e.message, true); } };

/* ---------- sign in / join / forgot / reset ---------- */
function showAuth(view, token) {
  $('#app').hidden = true; const box = $('#auth'); box.hidden = false;
  const card = body => `<form class="login-card" id="authForm" novalidate><span class="logo-mark" aria-hidden="true"></span>${body}</form>`;
  const V = {
    login: () => card(`<h1>Writers</h1><p>Sign in to write for the Eng Yuyu Tech Blog.</p><label for="em">Email</label><input id="em" type="email" autocomplete="username" required><label for="pw">Password</label><input id="pw" type="password" autocomplete="current-password" required><p class="err" id="er" role="alert"></p><button class="btn primary" type="submit">Sign in</button><p class="login-alt"><a href="#/forgot">Forgot password?</a></p>`),
    forgot: () => card(`<h1>Forgot your password?</h1><p>Enter your email and we’ll send you a reset link (valid for 1 hour).</p><label for="em">Email</label><input id="em" type="email" autocomplete="username" required><p class="err" id="er" role="alert"></p><p class="ok" id="ok" role="status"></p><button class="btn primary" type="submit">Email me a reset link</button><p class="login-alt"><a href="#/login">Back to sign in</a></p>`),
    join: () => card(`<h1>Welcome, writer!</h1><p>Choose a password to finish setting up your account. At least 12 characters, a few random words work well.</p><label for="p1">New password</label><input id="p1" type="password" autocomplete="new-password" minlength="12" required><label for="p2">Repeat password</label><input id="p2" type="password" autocomplete="new-password" minlength="12" required><p class="err" id="er" role="alert"></p><button class="btn primary" type="submit">Create my account</button>`),
    reset: () => card(`<h1>Choose a new password</h1><p>At least 12 characters.</p><label for="p1">New password</label><input id="p1" type="password" autocomplete="new-password" minlength="12" required><label for="p2">Repeat password</label><input id="p2" type="password" autocomplete="new-password" minlength="12" required><p class="err" id="er" role="alert"></p><button class="btn primary" type="submit">Save new password</button>`),
  };
  box.innerHTML = V[view](); const f = $('#authForm'), err = m => { $('#er').textContent = m || ''; };
  const first = $('input', f); if (first) first.focus();
  f.onsubmit = async e => {
    e.preventDefault(); err('');
    try {
      if (view === 'login') { await api('/login', { method: 'POST', body: { email: $('#em').value, password: $('#pw').value } }); await boot(); }
      else if (view === 'forgot') { await api('/forgot', { method: 'POST', body: { email: $('#em').value } }); $('#ok').textContent = 'If that email belongs to a writer, a reset link is on its way.'; }
      else { if ($('#p1').value !== $('#p2').value) return err('The two passwords do not match.'); await api(view === 'join' ? '/join' : '/reset', { method: 'POST', body: { token, password: $('#p1').value } }); history.replaceState(null, '', '/writers'); if (view === 'join') await boot(); else { toast('Password changed. Please sign in.'); location.hash = '#/login'; route(); } }
    } catch (x) { err(x.message); }
  };
}

/* ---------- shell + routing ---------- */
async function boot() {
  try { ME = await api('/me'); } catch { return; }
  $('#auth').hidden = true; $('#app').hidden = false; $('#whoami').textContent = ME.name + (ME.trusted ? ' · trusted' : '');
  if (!location.hash || /^#\/(login|forgot|join|reset)/.test(location.hash)) location.hash = '#/articles';
  route();
}
async function route() {
  const h = location.hash || '#/articles', m = h.match(/^#\/(join|reset)\/([a-f0-9]{64})$/);
  if (m) { history.replaceState(null, '', '/writers'); return showAuth(m[1], m[2]); }
  if (h === '#/login' || h === '#/forgot') return showAuth(h.slice(2));
  if (!ME) { try { ME = await api('/me'); } catch { return showAuth('login'); } $('#auth').hidden = true; $('#app').hidden = false; $('#whoami').textContent = ME.name + (ME.trusted ? ' · trusted' : ''); }
  const [, name, arg] = h.match(/^#\/([a-z]+)(?:\/(.+))?$/) || [, 'articles'];
  $$('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === name));
  const main = $('#wmain'); main.innerHTML = '<p class="help">Loading…</p>'; window.scrollTo(0, 0);
  try { await ({ articles, edit: editor, calendar, profile, guidelines }[name] || articles)(main, arg); } catch (e) { if (e.message !== 'Please sign in') main.innerHTML = `<div class="wempty">${esc(e.message)}</div>`; }
}
addEventListener('hashchange', route);
$('#wout').onclick = guard(async () => { await api('/logout', { method: 'POST', body: {} }); ME = null; location.hash = '#/login'; showAuth('login'); });

/* ---------- my articles ---------- */
const STATE = p => p.status === 'published' ? ['Published', 'paid'] : p.review.state === 'in_review' ? ['In review', 'review'] : p.review.state === 'changes' ? ['Changes requested', 'changes'] : ['Draft', ''];
async function articles(main) {
  const [me, list, com] = await Promise.all([api('/me'), api('/posts'), api('/community')]); ME = me;
  main.innerHTML = `<div class="whead-row"><div><h1>My articles</h1><p class="lead" style="margin:0">${me.trusted ? 'You’re a <b>trusted writer</b>: you can publish your articles directly.' : 'Every article is reviewed by Eng Yuyu before it goes live.'}</p></div><a class="btn primary" href="#/edit/new">+ Write an article</a></div>
  <div class="wstats"><div class="wstat"><b>${me.counts.total}</b><span>Articles</span></div><div class="wstat"><b>${me.counts.inReview}</b><span>In review</span></div><div class="wstat"><b>${me.counts.live}</b><span>Published</span></div></div>
  ${streakCard(me.stats)}${topCard(com)}
  ${list.length ? `<div class="wlist">${list.map(p => { const [l, c] = STATE(p); return `<div class="wpost"><div class="wthumb" style="${p.thumb ? `background-image:url('${esc(p.thumb)}')` : ''}"></div><div><h3>${esc(p.title || '(untitled)')}</h3><span class="pill ${c}">${l}</span> <small>${p.words} words · updated ${new Date(p.updatedAt).toLocaleDateString()}${p.status === 'published' ? ` · ${p.views.toLocaleString()} views` : ''}</small>${p.review.state === 'changes' && p.review.note ? `<p class="wnote"><b>Note from Eng Yuyu:</b> ${esc(p.review.note)}</p>` : ''}</div><div class="wact"><a class="btn sm" href="#/edit/${p.id}">${p.editable ? 'Edit' : 'Open'}</a>${p.url ? `<a class="btn sm" href="${esc(p.url)}" target="_blank" rel="noopener">View ↗</a>` : ''}${p.status !== 'published' ? `<button class="btn sm danger" data-del="${p.id}" type="button">Delete</button>` : ''}</div></div>`; }).join('')}</div>` : '<div class="wempty"><b>No articles yet.</b><br>Write your first one, it only takes a title, a summary and your text.<br><br><a class="btn primary" href="#/edit/new">Write an article</a></div>'}`;
  $$('[data-del]', main).forEach(b => b.onclick = guard(async () => { if (!confirm('Delete this draft? This cannot be undone.')) return; await api('/posts/' + b.dataset.del, { method: 'DELETE' }); toast('Deleted'); route(); }));
}

/* ---------- commitment: streak, top contributors, calendar ---------- */
function streakCard(st) {
  const u = st.unit, flame = '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M12 2s5 4.5 5 9.5a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-8Z"/></svg>';
  const pct = Math.min(100, Math.round(st.done / st.target * 100));
  return `<section class="wcard wstreak"><div class="wflame ${st.streak ? 'on' : ''}">${flame}<b>${st.streak}</b><span>${u}${st.streak === 1 ? '' : 's'} in a row</span></div>
  <div class="wgoal"><b>This ${u}: ${st.done} of ${st.target} article${st.target > 1 ? 's' : ''}</b><div class="wbarp" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div><small>${st.metNow ? (st.streak > 1 ? 'Goal reached, your streak grows. Keep going!' : 'Goal reached, great start!') : st.streak ? 'Publish ' + (st.target - st.done) + ' more to keep your streak alive.' : 'Publish ' + (st.target - st.done) + ' more to start a streak.'} Best streak: ${st.best}. <a href="#/calendar">Change goal / plan ahead</a></small></div></section>`;
}
function topCard(c) {
  if (!c.top.length) return `<section class="wcard"><h2>Top contributors: ${esc(c.month)}</h2><p class="help" style="margin:0">No articles published yet this month. Be the first on the board!</p></section>`;
  return `<section class="wcard"><h2>Top contributors: ${esc(c.month)}</h2><ol class="wtop">${c.top.map(x => `<li class="${x.id === c.you ? 'me' : ''}"><span class="rk r${x.rank}">${x.rank}</span><img alt="" src="${esc(x.photo || '/assets/icon-192.png')}" width="36" height="36"><b>${esc(x.name)}${x.id === c.you ? ' (you)' : ''}</b><span class="wcnt">${x.month} article${x.month === 1 ? '' : 's'}</span>${x.streak ? `<span class="wchip">${x.streak}-${x.unit} streak</span>` : ''}</li>`).join('')}</ol></section>`;
}
let calMonth = null;
async function calendar(main) {
  const [me, plans, posts] = await Promise.all([api('/me'), api('/plans'), api('/posts')]); ME = me; const st = me.stats, g = st.goal;
  const now = new Date(); if (!calMonth) calMonth = { y: now.getFullYear(), m: now.getMonth() };
  const iso = (y, m, d) => y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0'), today = iso(now.getFullYear(), now.getMonth(), now.getDate());
  const draw = () => {
    const { y, m } = calMonth, first = new Date(y, m, 1), lead = (first.getDay() + 1) % 7, days = new Date(y, m + 1, 0).getDate(), cells = [];
    for (let i = 0; i < lead; i++) cells.push('<div class="wday off"></div>');
    for (let d = 1; d <= days; d++) { const k = iso(y, m, d), ps = plans.filter(p => p.date === k); cells.push(`<button type="button" class="wday ${k === today ? 'today' : ''}" data-day="${k}" aria-label="${k}${ps.length ? ', ' + ps.length + ' planned' : ''}"><span>${d}</span>${ps.map(p => `<i class="wchipc ${p.done ? 'done' : k < today ? 'late' : ''}">${p.done ? '✓ ' : ''}${esc(p.title)}</i>`).join('')}</button>`); }
    $('#calgrid').innerHTML = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(x => `<div class="wdow">${x}</div>`).join('') + cells.join('');
    $('#calttl').textContent = first.toLocaleString('en', { month: 'long', year: 'numeric' });
    $$('[data-day]', main).forEach(b => b.onclick = () => { $('#pdate').value = b.dataset.day; $('#ptitle').focus(); });
  };
  const drafts = posts.filter(p => p.status !== 'published');
  main.innerHTML = `<h1>Editorial calendar</h1><p class="lead">Plan what you will publish and set a commitment. We’ll email you a friendly reminder before each date and when your streak is at risk.</p>
  <section class="wcard wform"><h2>My commitment</h2><form id="gf" class="wbar" style="align-items:flex-end"><div><label for="gc">I will publish</label><select id="gc">${[1, 2, 3, 4, 5].map(n => `<option ${g.count === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div><div><label for="gk">article(s) every</label><select id="gk"><option value="weekly" ${g.cadence === 'weekly' ? 'selected' : ''}>week</option><option value="monthly" ${g.cadence === 'monthly' ? 'selected' : ''}>month</option></select></div><label class="check" style="min-height:44px;display:flex;align-items:center;gap:8px"><input type="checkbox" id="gr" ${g.remind ? 'checked' : ''}> Email me reminders</label><button class="btn primary" type="submit">Save commitment</button></form><p class="help" style="margin:0">Hit your goal in a row to build a streak. Current streak: <b>${st.streak} ${st.unit}${st.streak === 1 ? '' : 's'}</b> · best: <b>${st.best}</b>. Changing the goal changes how streaks are counted.</p></section>
  <section class="wcard"><div class="wbar" style="justify-content:space-between;margin-bottom:10px"><div class="wbar"><button class="btn sm" id="cprev" type="button" aria-label="Previous month">‹</button><h2 id="calttl" style="margin:0;min-width:150px;text-align:center"></h2><button class="btn sm" id="cnext" type="button" aria-label="Next month">›</button></div><button class="btn sm" id="ctoday" type="button">Today</button></div><div class="wcal" id="calgrid"></div><p class="help" style="margin:8px 0 0">Tap a day to plan an article for it.</p></section>
  <section class="wcard wform"><h2>Plan an article</h2><form id="pf2" class="two"><div><label for="ptitle">Working title</label><input id="ptitle" maxlength="120" required></div><div><label for="pdate">Publish date</label><input id="pdate" type="date" value="${today}" required></div><div><label for="plink">Linked draft (optional)</label><select id="plink"><option value="">- none yet -</option>${drafts.map(p => `<option value="${p.id}">${esc(p.title || '(untitled)')}</option>`).join('')}</select></div><div style="align-self:end"><button class="btn primary" type="submit">Add to calendar</button></div></form></section>
  <section class="wcard"><h2>Planned articles</h2>${plans.length ? `<div class="wlist">${plans.map(p => `<div class="wplan ${p.done ? 'done' : p.date < today ? 'late' : ''}"><div><b>${esc(p.title)}</b><br><small>${p.date}${p.done ? ' · published ✓' : p.date < today ? ' · overdue' : p.postId ? ' · draft linked' : ''}</small></div><div class="wact"><input type="date" value="${p.date}" data-mv="${p.id}" aria-label="Move to another date">${p.postId ? `<a class="btn sm" href="#/edit/${p.postId}">Open draft</a>` : `<a class="btn sm" href="#/edit/new">Start writing</a>`}<button class="btn sm danger" data-rm="${p.id}" type="button">Remove</button></div></div>`).join('')}</div>` : '<p class="help" style="margin:0">Nothing planned yet: add your first article above.</p>'}</section>`;
  draw();
  $('#cprev').onclick = () => { calMonth.m--; if (calMonth.m < 0) { calMonth.m = 11; calMonth.y--; } draw(); };
  $('#cnext').onclick = () => { calMonth.m++; if (calMonth.m > 11) { calMonth.m = 0; calMonth.y++; } draw(); };
  $('#ctoday').onclick = () => { calMonth = { y: now.getFullYear(), m: now.getMonth() }; draw(); };
  $('#gf').onsubmit = guard(async e => { e.preventDefault(); await api('/goal', { method: 'PUT', body: { count: +$('#gc').value, cadence: $('#gk').value, remind: $('#gr').checked } }); toast('Commitment saved'); route(); });
  $('#pf2').onsubmit = guard(async e => { e.preventDefault(); await api('/plans', { method: 'POST', body: { title: $('#ptitle').value, date: $('#pdate').value, postId: $('#plink').value } }); toast('Added to your calendar'); route(); });
  $$('[data-mv]', main).forEach(i => i.onchange = guard(async () => { await api('/plans/' + i.dataset.mv, { method: 'PUT', body: { date: i.value } }); toast('Moved'); route(); }));
  $$('[data-rm]', main).forEach(b => b.onclick = guard(async () => { if (!confirm('Remove this from your calendar?')) return; await api('/plans/' + b.dataset.rm, { method: 'DELETE' }); route(); }));
}

/* ---------- editor ---------- */
async function upload(file) {
  if (file.size > 1048576) throw new Error('Image is too large (max 1 MB).');
  const data = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(file); });
  return (await api('/upload', { method: 'POST', body: { data } })).url;
}
async function editor(main, id) {
  const meta = ME; let p = id && id !== 'new' ? await api('/posts/' + id) : { id: '', status: 'draft', review: { state: 'draft' }, en: { title: '', excerpt: '', body: '' }, so: { title: '', excerpt: '', body: '' }, cat: 'ai', tags: [], videoUrl: '', cover: '', editable: true, problems: ['Add an English title (at least 12 characters).'] };
  const locked = p.id && (p.review.state === 'in_review' || (p.status === 'published' && !ME.trusted));
  let lang = 'en';
  const cats = Object.entries(meta.cats || {}).map(([k, v]) => `<option value="${k}" ${p.cat === k ? 'selected' : ''}>${esc(v[0])}</option>`).join('');
  main.innerHTML = `<div class="whead-row"><div><a href="#/articles" style="color:var(--muted)">← My articles</a><h1 style="margin-top:6px">${p.id ? 'Edit article' : 'Write an article'}</h1></div><div class="wbar">${p.id ? `<span class="pill ${STATE(p)[1]}">${STATE(p)[0]}</span>` : ''}</div></div>
  ${p.review && p.review.state === 'changes' && p.note ? `<div class="wnote" style="margin:0 0 14px"><b>Note from Eng Yuyu:</b> ${esc(p.note)}</div>` : ''}
  ${locked ? `<div class="wnote" style="margin:0 0 14px">${p.review.state === 'in_review' ? 'This article is in review. Withdraw it if you want to keep editing.' : 'This article is published. To change it, ask Eng Yuyu below.'}</div>` : ''}
  <form class="wedit" id="wf" novalidate><div>
    <section class="wcard wform"><div class="wlangs" role="group" aria-label="Language"><button type="button" data-lang="en" aria-pressed="true">English</button><button type="button" data-lang="so" aria-pressed="false">Somali (optional)</button></div>
      <div id="pane-en" data-pane="en">${field('en-title', 'Title', p.en.title, 160)}${field('en-excerpt', 'Short summary (shown on cards and in Google)', p.en.excerpt, 320, 2)}${bodyField('en-body', p.en.body)}</div>
      <div id="pane-so" data-pane="so" hidden>${field('so-title', 'Cinwaan (Somali)', p.so.title, 160)}${field('so-excerpt', 'Soo koobid gaaban (Somali)', p.so.excerpt, 320, 2)}${bodyField('so-body', p.so.body)}<p class="help">A Somali version is optional but welcome, readers get it automatically when they switch language.</p></div>
    </section>
    <section class="wcard wform"><h2>Details</h2><div class="two"><div><label for="cat">Category</label><select id="cat">${cats}</select></div><div><label for="tags">Tags (comma separated)</label><input id="tags" value="${esc((p.tags || []).join(', '))}" maxlength="200"></div></div>
      <div><label for="video">YouTube link (optional)</label><input id="video" type="url" value="${esc(p.videoUrl || '')}" placeholder="https://www.youtube.com/watch?v=…"><p class="help">Readers will see the video thumbnail with a “Watch” button. To place the video inside the article write <code>{{youtube LINK}}</code> on its own line.</p></div></section>
  </div>
  <aside class="wside"><section class="wcard"><h2>Cover image</h2><div class="wcover" id="cov" style="${p.cover ? `background-image:url('${esc(p.cover)}')` : ''}"></div><input type="hidden" id="cover" value="${esc(p.cover || '')}"><div class="wbar" style="margin-top:10px"><label class="btn sm" style="cursor:pointer">Upload image<input type="file" id="covfile" accept="image/png,image/jpeg,image/webp" hidden></label><button type="button" class="btn sm" id="covx">Remove</button></div><p class="help">16:9 works best · PNG, JPG or WebP · up to 1 MB. Not needed if you add a YouTube link.</p></section>
    <section class="wcard"><h2>Before you send it</h2><ul class="wcheck" id="chk"></ul></section>
    <section class="wcard"><div class="wbar" style="flex-direction:column;align-items:stretch">
      ${!locked ? `<button class="btn" type="submit" id="save">Save draft</button>` : ''}
      ${!locked && p.status !== 'published' ? `<button class="btn primary" type="button" id="submit">Send for review</button>` : ''}
      ${!locked && ME.trusted && p.status !== 'published' ? `<button class="btn primary" type="button" id="publish" style="background:#12894f;border-color:#12894f">Publish now (trusted)</button>` : ''}
      ${p.review.state === 'in_review' ? '<button class="btn" type="button" id="withdraw">Withdraw from review</button>' : ''}
      ${p.status === 'published' && !ME.trusted ? '<button class="btn" type="button" id="askedit">Ask Eng Yuyu for an edit</button>' : ''}
      ${p.status === 'published' && ME.trusted && !locked ? '<button class="btn primary" type="submit">Save changes (live)</button>' : ''}
    </div><p class="wfoot">${ME.trusted ? 'Trusted writers can publish directly. Eng Yuyu is told whenever you do.' : 'Eng Yuyu reads every article before it is published, and emails you the result.'}</p></section></aside></form>`;
  const g = i => $('#' + i), val = i => g(i).value;
  if (locked) $$('input,textarea,select', $('#wf')).forEach(x => { if (x.id !== 'covfile') x.disabled = true; });
  $$('[data-lang]', main).forEach(b => b.onclick = () => { lang = b.dataset.lang; $$('[data-lang]', main).forEach(x => x.setAttribute('aria-pressed', x === b)); $$('[data-pane]', main).forEach(x => { x.hidden = x.dataset.pane !== lang; }); });
  const collect = () => ({ en: { title: val('en-title'), excerpt: val('en-excerpt'), body: val('en-body') }, so: { title: val('so-title'), excerpt: val('so-excerpt'), body: val('so-body') }, cat: val('cat'), tags: val('tags'), videoUrl: val('video'), cover: val('cover') });
  const words = t => (t.match(/\S+/g) || []).length;
  const refresh = () => { const c = collect(), items = [[c.en.title.trim().length >= 12, 'English title (12+ characters)'], [c.en.excerpt.trim().length >= 40, 'Short summary (40+ characters)'], [words(c.en.body) >= 200, `Article text: ${words(c.en.body)} / 200 words`], [!!(c.cover || c.videoUrl), 'Cover image or YouTube link'], [!!(c.so.title && c.so.body), 'Somali version (optional)']]; g('chk').innerHTML = items.map(([ok, l], i) => `<li><span class="${ok ? 'ok' : (i === 4 ? '' : 'no')}">${ok ? '✓' : (i === 4 ? '○' : '✗')}</span>${l}</li>`).join(''); };
  $('#wf').addEventListener('input', refresh); refresh();
  $$('[data-ins]', main).forEach(b => b.onclick = () => { const ta = g(b.dataset.for), [pre, post] = b.dataset.ins.split('|'), s = ta.selectionStart, e = ta.selectionEnd, sel = ta.value.slice(s, e) || 'text'; ta.setRangeText(pre + sel + post, s, e, 'end'); ta.focus(); refresh(); });
  $$('[data-preview]', main).forEach(b => b.onclick = guard(async () => { const box = g(b.dataset.preview + '-pv'); if (!box.hidden) { box.hidden = true; return; } const r = await api('/preview', { method: 'POST', body: { body: val(b.dataset.preview + '-body'), lang: b.dataset.preview } }); box.innerHTML = r.html || '<p class="help">Nothing to preview yet.</p>'; box.hidden = false; }));
  g('covfile').onchange = guard(async e => { const f = e.target.files[0]; if (!f) return; const url = await upload(f); g('cover').value = url; g('cov').style.backgroundImage = `url('${url}')`; toast('Cover uploaded'); refresh(); });
  g('covx').onclick = () => { g('cover').value = ''; g('cov').style.backgroundImage = ''; refresh(); };
  const save = async () => { const body = collect(); if (!body.en.title.trim()) throw new Error('Please add an English title first.'); const r = await api(p.id ? '/posts/' + p.id : '/posts', { method: p.id ? 'PUT' : 'POST', body }); p.id = r.id; p.status = r.status; return r; };
  $('#wf').onsubmit = guard(async e => { e.preventDefault(); const r = await save(); toast('Saved'); if (location.hash.endsWith('/new')) location.hash = '#/edit/' + r.id; else route(); });
  if (g('submit')) g('submit').onclick = guard(async () => { await save(); try { await api('/posts/' + p.id + '/submit', { method: 'POST', body: {} }); } catch (e) { alert((e.data && e.data.problems ? e.data.problems : [e.message]).join('\n')); throw new Error('Not sent yet, see what is missing'); } toast('Sent to Eng Yuyu for review, you’ll get an email'); location.hash = '#/articles'; });
  if (g('publish')) g('publish').onclick = guard(async () => { if (!confirm('Publish this article now? It goes live immediately under your name.')) return; await save(); try { const r = await api('/posts/' + p.id + '/publish', { method: 'POST', body: {} }); toast('Published!'); window.open(r.url, '_blank', 'noopener'); location.hash = '#/articles'; } catch (e) { alert((e.data && e.data.problems ? e.data.problems : [e.message]).join('\n')); throw new Error('Not published yet: see what is missing'); } });
  if (g('withdraw')) g('withdraw').onclick = guard(async () => { await api('/posts/' + p.id + '/withdraw', { method: 'POST', body: {} }); toast('Back to draft'); route(); });
  if (g('askedit')) g('askedit').onclick = guard(async () => { const note = prompt('What would you like Eng Yuyu to change in this article?'); if (!note) return; await api('/posts/' + p.id + '/editrequest', { method: 'POST', body: { note } }); toast('Request sent'); });
}
function field(id, label, v, max, rows) { return `<div><label for="${id}">${label}</label>${rows ? `<textarea id="${id}" rows="${rows}" maxlength="${max}">${esc(v)}</textarea>` : `<input id="${id}" value="${esc(v)}" maxlength="${max}">`}</div>`; }
function bodyField(id, v) { const l = id.slice(0, 2); return `<div><label for="${id}">Article</label><div class="wtool"><button type="button" data-ins="## |" data-for="${id}" title="Heading">H2</button><button type="button" data-ins="**|**" data-for="${id}" title="Bold"><b>B</b></button><button type="button" data-ins="- |" data-for="${id}" title="List">• List</button><button type="button" data-ins="[|](https://)" data-for="${id}" title="Link">Link</button><button type="button" data-preview="${l}" title="Preview">Preview</button></div><textarea id="${id}" rows="16" maxlength="60000" placeholder="Write your article here. Use ## for headings, **bold**, - for lists. Leave a blank line between paragraphs.">${esc(v)}</textarea><div class="wpreview" id="${l}-pv" hidden></div></div>`; }

/* ---------- profile ---------- */
async function profile(main) {
  const me = await api('/me'); ME = me; const s = me.social || {};
  main.innerHTML = `<h1>My profile</h1><p class="lead">This appears on your articles and your author page: <a href="/blog/author/${esc(me.slug)}" target="_blank" rel="noopener">/blog/author/${esc(me.slug)}</a></p>
  <form class="wcard wform" id="pf"><div class="two">${field('pn', 'Your name', me.name, 60)}<div><label>Photo</label><div class="wbar"><img id="pph" alt="" width="64" height="64" style="border-radius:50%;object-fit:cover;background:var(--surface2)" src="${esc(me.photo || '/assets/icon-192.png')}"><label class="btn sm" style="cursor:pointer">Upload<input type="file" id="pfile" accept="image/png,image/jpeg,image/webp" hidden></label><button type="button" class="btn sm" id="pfx">Remove</button></div><input type="hidden" id="pphoto" value="${esc(me.photo || '')}"></div></div>
  <div class="two">${field('pbe', 'Short bio (English)', (me.bio || {}).en || '', 400, 3)}${field('pbs', 'Bio gaaban (Somali)', (me.bio || {}).so || '', 400, 3)}</div>
  <h2 style="margin:6px 0 0;font-size:1rem">Links (optional, https only)</h2><div class="two">${['website', 'youtube', 'facebook', 'tiktok', 'instagram', 'x', 'linkedin'].map(k => field('s-' + k, k[0].toUpperCase() + k.slice(1), s[k] || '', 200)).join('')}</div>
  <div><button class="btn primary" type="submit">Save profile</button></div></form>
  <form class="wcard wform" id="pw"><h2>Change password</h2><div class="two"><div><label for="cp">Current password</label><input id="cp" type="password" autocomplete="current-password"></div><div><label for="np">New password (12+ characters)</label><input id="np" type="password" autocomplete="new-password"></div></div><div><button class="btn" type="submit">Change password</button></div></form>`;
  $('#pfile').onchange = guard(async e => { const f = e.target.files[0]; if (!f) return; const u = await upload(f); $('#pphoto').value = u; $('#pph').src = u; });
  $('#pfx').onclick = () => { $('#pphoto').value = ''; $('#pph').src = '/assets/icon-192.png'; };
  $('#pf').onsubmit = guard(async e => { e.preventDefault(); const social = {}; ['website', 'youtube', 'facebook', 'tiktok', 'instagram', 'x', 'linkedin'].forEach(k => { social[k] = $('#s-' + k).value; }); ME = await api('/me', { method: 'PUT', body: { name: $('#pn').value, photo: $('#pphoto').value, bio: { en: $('#pbe').value, so: $('#pbs').value }, social } }); $('#whoami').textContent = ME.name + (ME.trusted ? ' · trusted' : ''); toast('Profile saved'); });
  $('#pw').onsubmit = guard(async e => { e.preventDefault(); await api('/password', { method: 'POST', body: { current: $('#cp').value, password: $('#np').value } }); $('#cp').value = $('#np').value = ''; toast('Password changed'); });
}

/* ---------- guidelines ---------- */
function guidelines(main) {
  main.innerHTML = `<h1>Writing for the Eng Yuyu Tech Blog</h1><p class="lead">A short guide so your article is accepted quickly.</p>
  <section class="wcard"><h2>What we publish</h2><ul class="wguide"><li><b>Practical, useful articles</b> for Somali-speaking readers: phones and gadgets, AI tools, online safety, creating content, growing online, and small-business tech.</li><li><b>Plain language.</b> Explain things the way you would to a friend. Short sentences, real examples, clear steps.</li><li><b>200+ words</b> (300–1,200 is ideal) with headings (<code>## Heading</code>) so it is easy to scan.</li><li><b>A cover image</b> (16:9) or a YouTube video. A Somali version is a big plus.</li></ul></section>
  <section class="wcard"><h2>Rules</h2><ul class="wguide"><li>Write it yourself and only use images you own or have permission to use. <b>No copied text.</b></li><li>No scams, hacking tutorials, adult content, hate, or political attacks. No promises of guaranteed income.</li><li>Be honest about affiliate links, sponsorships or products you sell, say so in the article.</li><li>Never ask readers for passwords or codes. Don’t share private information about other people.</li></ul></section>
  <section class="wcard"><h2>How review works</h2><ol class="wguide"><li>Write and <b>Save draft</b> as often as you like, nobody sees drafts.</li><li>Press <b>Send for review</b> when the checklist is green.</li><li>Eng Yuyu reads it and either <b>publishes it</b> or <b>sends it back with a note</b>. You get an email each time.</li><li>Published articles appear with your name, photo and bio, and on your author page.</li></ol><p class="help">Trusted writers can publish directly | Eng Yuyu decides who is trusted.</p></section>`;
}

/* ---------- start ---------- */
(async () => { const h = location.hash; if (/^#\/(join|reset)\//.test(h)) return route(); await boot().catch(() => {}); if (!ME && $('#auth').hidden) showAuth('login'); })();
