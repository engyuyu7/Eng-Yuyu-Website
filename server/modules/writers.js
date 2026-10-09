// Contributors (guest writers) for the blog, completely separate from the owner's dashboard login.
//   • their own page /writers, their own cookie (yy_writer, signed with a different key), their own API /api/writer/*
//   • they can only write & manage THEIR OWN articles and profile; bookings, payments, subscribers, messages and settings do not exist for them
//   • articles go through the owner's review (draft → in review → published / sent back) unless the writer is marked "trusted"
//   • the owner manages writers under /api/admin/authors* (invite, trust on/off, pause, remove, review)
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

module.exports = function writers(ctx) {
  const { ENV, MOCK, store, settings, sendMail, mails, readJson, limited, SITE_URL, OWNER, esc } = ctx;
  const A = () => ctx.admin, B = () => ctx.blogApi;
  const authors = store.load('authors', []);
  const secret = store.load('secret', { value: crypto.randomBytes(32).toString('hex') });
  const KEY = crypto.createHash('sha256').update('yy-writer-session:' + secret.value).digest();   // not the owner's signing key
  const SITE = () => String(ENV.SITE_URL || SITE_URL || '').replace(/\/$/, '');
  const DIR = path.join(__dirname, '..', 'writers');
  const save = () => store.save('authors');
  const uid = () => crypto.randomBytes(6).toString('hex');
  const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
  const cleanS = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);
  const emailOk = e => ctx.isEmail(e);
  const slugify = s => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'writer';
  const uniqueSlug = (name, id) => { let s = slugify(name), n = 2; while (authors.some(a => a.slug === s && a.id !== id)) s = slugify(name) + '-' + n++; return s; };
  const secureFlag = req => (ENV.SECURE_COOKIES === '1' || req.headers['x-forwarded-proto'] === 'https') ? '; Secure' : '';
  const json = (res, code, body, extra = {}) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', ...extra }); res.end(JSON.stringify(body)); };
  const log = (t, x) => { try { A().log(t, x); } catch { /* ignore */ } };

  // ---- passwords (scrypt) + session cookie ----
  const hashPw = pw => { const salt = crypto.randomBytes(16); return 'scrypt$' + salt.toString('hex') + '$' + crypto.scryptSync(pw, salt, 64).toString('hex'); };
  const DUMMY = hashPw('dummy-password-for-timing');
  const checkPw = (pw, hash) => { try { const [, s, h] = String(hash || DUMMY).split('$'); const got = crypto.scryptSync(String(pw || ''), Buffer.from(s, 'hex'), 64); return crypto.timingSafeEqual(got, Buffer.from(h, 'hex')) && !!hash; } catch { return false; } };
  const strong = pw => typeof pw === 'string' && pw.length >= 12 && pw.length <= 200;
  const sign = o => { const b = Buffer.from(JSON.stringify(o)).toString('base64url'); return b + '.' + crypto.createHmac('sha256', KEY).update(b).digest('base64url'); };
  const verify = tok => {
    if (!tok || !tok.includes('.')) return null; const [b, sig] = tok.split('.'), good = crypto.createHmac('sha256', KEY).update(b).digest('base64url');
    if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
    try { const p = JSON.parse(Buffer.from(b, 'base64url').toString()); if (!(p.exp > Date.now())) return null; const a = authors.find(x => x.id === p.aid); return a && a.status === 'active' && (a.epoch || 0) === (p.e || 0) ? a : null; } catch { return null; }
  };
  const cookieOf = req => { const m = (req.headers.cookie || '').match(/(?:^|;\s*)yy_writer=([^;]+)/); return m ? m[1] : ''; };
  const who = req => verify(cookieOf(req));
  const setCookie = (req, a) => `yy_writer=${sign({ aid: a.id, exp: Date.now() + 12 * 3600e3, e: a.epoch || 0 })}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secureFlag(req)}`;
  const clearCookie = 'yy_writer=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0';

  const pub = a => ({ id: a.id, name: a.name, email: a.email, slug: a.slug, status: a.status, trusted: !!a.trusted, bio: a.bio || {}, photo: a.photo || '', social: a.social || {}, createdAt: a.createdAt, lastLogin: a.lastLogin || 0, invitedAt: a.invitedAt || 0 });
  const postsOf = a => B().db.posts.filter(p => p.authorId === a.id);

  // ---- emails (branded layout from lib/mail.js) ----
  const M = () => mails.blocks;
  const mailTo = (a, subject, title, blocks, pre) => sendMail({ to: a.email, subject, ...mails.layout('en', { pre: pre || title, title, blocks }) }).catch(e => console.error('writer email failed', e.message));
  const inviteMail = (a, token) => { const link = `${SITE()}/writers#/join/${token}`, b = M(); return mailTo(a, 'You’re invited to write for the Eng Yuyu Tech Blog', `Welcome, ${a.name.split(' ')[0]}!`, [b.p(`I’d love you to contribute articles to the <b>Eng Yuyu Tech Blog</b>. You’ll have your own writer account, separate from mine, where you can write articles in English and Somali, add a cover image or a YouTube video, and send them to me for review.`), b.button('Set your password & start', link), b.note('This link works for 7 days and only once. You’ll choose your own password (12+ characters). Never share it with anyone.'), b.small(`Your sign-in page afterwards: <a href="${SITE()}/writers">${SITE()}/writers</a> · Sign in with <b>${esc(a.email)}</b>.`)]); };
  const resetMail = (a, token) => { const link = `${SITE()}/writers#/reset/${token}`, b = M(); return mailTo(a, 'Reset your writer password', 'Reset your writer password', [b.p(`Hi ${esc(a.name.split(' ')[0])}, open the button below within <b>1 hour</b> to choose a new password.`), b.button('Choose a new password', link), b.small('If you didn’t ask for this, ignore this email, your password stays the same.')]); };
  const ownerMail = (subject, title, rows, link, label) => { const b = M(); return sendMail({ to: OWNER(), subject, ...mails.layout('en', { pre: title, title, blocks: [b.rows(rows), b.button(label, link)] }) }).catch(() => {}); };

  // ---- the writer's article rules ----
  const MAXPOSTS = 100;
  const wView = (p, a) => ({ id: p.id, title: p.en.title, titleSo: p.so.title, status: p.status, review: p.review || { state: 'draft' }, slug: p.slug, publishedAt: p.publishedAt || 0, updatedAt: p.updatedAt || 0, views: p.views || 0, thumb: B().imageOf(p), url: B().isLive(p) ? B().url(p, 'en') : '', cat: p.cat, words: B().wordCount(p.en.body), editable: p.status !== 'published' || !!a.trusted });
  const wFull = (p, a) => ({ ...wView(p, a), en: p.en, so: p.so, cat: p.cat, tags: p.tags || [], videoUrl: p.video ? p.video.url : '', cover: p.cover || '' });
  function problems(p) {   // what an article needs before it can be sent for review
    const out = [], en = p.en, w = B().wordCount(en.body);
    if (en.title.length < 12) out.push('Add an English title (at least 12 characters).');
    if (en.excerpt.length < 40) out.push('Add a short English summary of 40–320 characters.');
    if (w < 200) out.push(`The English article is ${w} words, aim for at least 200 (300+ is ideal).`);
    if (!B().imageOf(p)) out.push('Add a cover image or a YouTube link.');
    return out;
  }
  const writerFields = (b, existing) => {   // only what a writer may set, everything else stays as the owner left it
    const body = { en: b.en || {}, so: b.so || {}, cat: b.cat, tags: b.tags, videoUrl: b.videoUrl, cover: b.cover };
    if (existing) { Object.assign(body, { featured: existing.featured, notify: existing.notify, service: existing.service, seo: existing.seo, status: existing.status, slug: existing.status === 'published' ? existing.slug : '', publishAt: existing.status === 'published' && existing.publishedAt ? new Date(existing.publishedAt).toISOString() : undefined }); }
    else Object.assign(body, { status: 'draft', notify: false, featured: false });
    return body;
  };

  function congrats(a) {   // a friendly note the moment a writer reaches their goal for the week/month
    try {
      const st = statsOf(a); if (!st.metNow || st.done !== st.target || goalOf(a).remind === false) return;
      a.sent = a.sent || {}; const k = 'won:' + st.goal.cadence + ':' + periodOf(Date.now(), st.goal.cadence); if (a.sent[k]) return; a.sent[k] = Date.now(); save();
      const b = M(), first = esc(a.name.split(' ')[0]);
      mailTo(a, st.streak > 1 ? `${st.streak}-${st.unit} streak` : `Goal reached: well done, ${a.name.split(' ')[0]}!`, st.streak > 1 ? `${st.streak} ${st.unit}s in a row!` : 'You hit your publishing goal!', [b.p(`Hi ${first}, you published ${st.done} article${st.done > 1 ? 's' : ''} this ${st.unit}: your goal is met.${st.streak > 1 ? ` That makes a <b>${st.streak}-${st.unit} streak</b> (your best is ${st.best}).` : ' Your streak has started, keep it going next ' + st.unit + '.'}`), b.button('See my progress', SITE() + '/writers#/articles'), b.small('Thank you for writing for the Eng Yuyu Tech Blog.')]);
    } catch (e) { console.error('congrats', e.message); }
  }
  function onPublished(post, was) {   // called by the blog module when the owner publishes
    if (!post.authorId || was === 'published') return;
    const a = authors.find(x => x.id === post.authorId); if (!a) return;
    post.review = { ...(post.review || {}), state: 'published', reviewedAt: Date.now() }; B().save(); congrats(a);
    const b = M(); mailTo(a, `Your article is live: ${post.en.title}`, 'Your article is live', [b.p(`Hi ${esc(a.name.split(' ')[0])}, <b>${esc(post.en.title)}</b> has been published on the Eng Yuyu Tech Blog under your name.`), b.button('See your article', B().url(post, 'en')), b.small('Share it with your followers, and thank you for writing for us.')]);
  }

  // ---- commitment: goals, streaks, top contributors, editorial calendar, reminders ----
  const DAY = 864e5, EAT = 3 * 36e5, WEEK0 = Date.UTC(2024, 0, 6);   // weeks run Saturday → Friday, months & days in East Africa Time (UTC+3); WEEK0 = a Saturday
  const DEFAULT_GOAL = { cadence: 'weekly', count: 1, remind: true };
  const goalOf = a => ({ ...DEFAULT_GOAL, ...(a.goal || {}) });
  const periodOf = (ts, cad) => { const d = new Date(ts + EAT); return cad === 'monthly' ? d.getUTCFullYear() * 12 + d.getUTCMonth() : Math.floor((ts + EAT - WEEK0) / (7 * DAY)); };
  const periodEnd = (ts, cad) => { const d = new Date(ts + EAT); return cad === 'monthly' ? Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - EAT : WEEK0 + (periodOf(ts, 'weekly') + 1) * 7 * DAY - EAT; };
  const monthLabel = ts => new Date(ts + EAT).toLocaleString('en', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const liveTimes = a => postsOf(a).filter(x => B().isLive(x)).map(x => x.publishedAt);
  function statsOf(a, now = Date.now()) {
    const g = goalOf(a), times = liveTimes(a), per = {};
    for (const t of times) { const k = periodOf(t, g.cadence); per[k] = (per[k] || 0) + 1; }
    const cur = periodOf(now, g.cadence), met = k => (per[k] || 0) >= g.count;
    let streak = 0, k = met(cur) ? cur : cur - 1; while (met(k)) { streak++; k--; }
    let best = 0, run = 0; const keys = Object.keys(per).map(Number).sort((x, y) => x - y);
    for (let i = 0, prev = null; i < keys.length; i++) { if (!met(keys[i])) { run = 0; prev = keys[i]; continue; } run = prev !== null && keys[i] === prev + 1 && run ? run + 1 : 1; prev = keys[i]; best = Math.max(best, run); }
    const mk = periodOf(now, 'monthly');
    return { goal: g, streak: Math.max(streak, 0), best: Math.max(best, streak), done: per[cur] || 0, target: g.count, metNow: met(cur), month: times.filter(t => periodOf(t, 'monthly') === mk).length, total: times.length, unit: g.cadence === 'monthly' ? 'month' : 'week' };
  }
  function topContributors(now = Date.now()) {
    return authors.filter(a => a.status === 'active').map(a => ({ id: a.id, name: a.name, photo: a.photo || '', slug: a.slug, ...(({ month, streak, unit }) => ({ month, streak, unit }))(statsOf(a, now)) })).filter(x => x.month > 0).sort((x, y) => y.month - x.month || y.streak - x.streak || x.name.localeCompare(y.name)).slice(0, 5).map((x, i) => ({ ...x, rank: i + 1 }));
  }
  const publicTop = (n = 3, now = Date.now()) => topContributors(now).slice(0, n).map(x => ({ name: x.name, photo: x.photo, slug: x.slug, month: x.month, streak: x.streak, unit: x.unit, rank: x.rank }));
  const planDone = (a, pl) => { const p = pl.postId && postsOf(a).find(x => x.id === pl.postId); return !!(p && B().isLive(p)); };
  const planView = (a, pl) => ({ id: pl.id, date: pl.date, title: pl.title, note: pl.note || '', postId: pl.postId || '', done: planDone(a, pl) });
  const cleanDate = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d)) && !isNaN(Date.parse(d + 'T00:00:00Z')) ? String(d) : '';
  const ymd = ts => new Date(ts + EAT).toISOString().slice(0, 10);

  async function runReminders(now = Date.now()) {
    let sent = 0; const today = ymd(now), tomorrow = ymd(now + DAY), b = M();
    for (const a of authors) {
      if (a.status !== 'active' || goalOf(a).remind === false) continue; a.sent = a.sent || {};
      const first = esc(a.name.split(' ')[0]), link = SITE() + '/writers#/calendar', once = (k) => { if (a.sent[k]) return false; a.sent[k] = now; return true; };
      for (const pl of (a.plans || [])) {
        if (planDone(a, pl)) continue;
        if ((pl.date === today || pl.date === tomorrow) && once('due:' + pl.id)) { sent++; await mailTo(a, `Reminder: "${pl.title}" is planned for ${pl.date === today ? 'today' : 'tomorrow'}`, pl.date === today ? 'Today is publish day' : 'Your article is due tomorrow', [b.p(`Hi ${first}, you planned to publish <b>${esc(pl.title)}</b> on <b>${pl.date}</b>.`), b.p('Open your calendar, finish the draft and send it for review, remember that review takes a little time.'), b.button('Open my calendar', link)]); }
        else if (pl.date < today && pl.date >= ymd(now - 2 * DAY) && once('late:' + pl.id)) { sent++; await mailTo(a, `"${pl.title}" is a little late`, 'Still planning to publish?', [b.p(`Hi ${first}, <b>${esc(pl.title)}</b> was planned for ${pl.date}. Finish it, or move it to a new date, no pressure, just keep the rhythm going.`), b.button('Open my calendar', link)]); }
      }
      const st = statsOf(a, now), g = st.goal, d = new Date(now), left = periodEnd(now, g.cadence) - now;
      if (!st.metNow && left <= 3 * DAY && once('goal:' + g.cadence + ':' + periodOf(now, g.cadence))) {
        sent++; const need = st.target - st.done;
        await mailTo(a, st.streak ? `Keep your ${st.streak}-${st.unit} streak alive` : `Your ${st.unit}ly publishing goal`, st.streak ? `Your ${st.streak}-${st.unit} streak is at risk` : 'Your publishing goal', [b.p(`Hi ${first}, your goal is <b>${g.count} article${g.count > 1 ? 's' : ''} per ${st.unit}</b>. You have <b>${st.done}</b> so far: ${need} more to go before the ${st.unit} ends.`), st.streak ? b.p(`Publish it and your streak grows to <b>${st.streak + 1}</b>.`) : '', b.button('Write now', SITE() + '/writers#/edit/new')]);
      }
      const keep = Object.keys(a.sent).sort((x, y) => a.sent[y] - a.sent[x]).slice(0, 200); a.sent = Object.fromEntries(keep.map(k => [k, a.sent[k]]));
    }
    if (sent) save(); return sent;
  }
  setInterval(() => runReminders().catch(e => console.error('writer reminders', e.message)), 3600e3).unref();

  async function writerApi(req, res, u) {
    const p = u.pathname, m = req.method, ip = req.clientIp || req.socket.remoteAddress;
    if (!p.startsWith('/api/writer/')) return false;
    const guard = () => (req.headers['x-requested-with'] === 'yy-writer' ? true : (json(res, 403, { error: 'Bad request' }), false));
    if (m !== 'GET' && !guard()) return true;
    // --- public: sign in / join / forgot / reset ---
    if (p === '/api/writer/login' && m === 'POST') {
      const b = await readJson(req), email = cleanS(b.email, 120).toLowerCase();
      if (limited(ip + 'wl', 12) || limited('wl:' + email, 8)) return json(res, 429, { error: 'Too many attempts. Please try again later.' }), true;
      const a = authors.find(x => x.email === email && x.status === 'active'), okPw = checkPw(b.password, a && a.hash);
      if (!a || !okPw) { await new Promise(r => setTimeout(r, 700)); return json(res, 401, { error: 'Wrong email or password' }), true; }
      a.lastLogin = Date.now(); save(); return json(res, 200, { ok: true }, { 'Set-Cookie': setCookie(req, a) }), true;
    }
    if (p === '/api/writer/logout' && m === 'POST') return json(res, 200, { ok: true }, { 'Set-Cookie': clearCookie }), true;
    if (p === '/api/writer/join' && m === 'POST') {
      if (limited(ip + 'wj', 15)) return json(res, 429, { error: 'Too many attempts. Please try again later.' }), true;
      const b = await readJson(req), h = sha(b.token || ''), a = authors.find(x => x.invite && x.invite.h === h && x.invite.exp > Date.now() && x.status === 'invited');
      if (!a) return json(res, 400, { error: 'This invitation link is invalid or has expired. Ask Eng Yuyu to send a new one.' }), true;
      if (!strong(b.password)) return json(res, 400, { error: 'Use at least 12 characters (a few random words work well).' }), true;
      a.hash = hashPw(b.password); a.status = 'active'; a.invite = null; a.epoch = (a.epoch || 0) + 1; a.lastLogin = Date.now(); save(); log('writer', `${a.name} joined as a writer`);
      ownerMail(`${a.name} joined as a writer`, 'A writer accepted your invitation', [['Writer', `<b>${esc(a.name)}</b>`], ['Email', esc(a.email)], ['Review needed', a.trusted ? 'No, trusted (publishes directly)' : 'Yes, you review every article']], `${SITE()}/admin#/writers`, 'Open Writers');
      return json(res, 200, { ok: true }, { 'Set-Cookie': setCookie(req, a) }), true;
    }
    if (p === '/api/writer/forgot' && m === 'POST') {
      const b = await readJson(req), email = cleanS(b.email, 120).toLowerCase();
      if (limited(ip + 'wf', 4) || limited('wf:' + email, 3)) return json(res, 429, { error: 'Too many requests. Please try again in an hour.' }), true;
      const a = authors.find(x => x.email === email && x.status === 'active');
      if (a) { const token = crypto.randomBytes(32).toString('hex'); a.reset = { h: sha(token), exp: Date.now() + 3600e3 }; save(); resetMail(a, token); }
      return json(res, 200, { ok: true }), true;   // same answer whether or not the address exists
    }
    if (p === '/api/writer/reset' && m === 'POST') {
      if (limited(ip + 'wr', 10)) return json(res, 429, { error: 'Too many attempts. Please try again later.' }), true;
      const b = await readJson(req), h = sha(b.token || ''), a = authors.find(x => x.reset && x.reset.h === h && x.reset.exp > Date.now() && x.status === 'active');
      if (!a) return json(res, 400, { error: 'This reset link is invalid or has expired. Request a new one.' }), true;
      if (!strong(b.password)) return json(res, 400, { error: 'Use at least 12 characters.' }), true;
      a.hash = hashPw(b.password); a.reset = null; a.epoch = (a.epoch || 0) + 1; save(); log('writer', `${a.name} reset their password`);
      return json(res, 200, { ok: true }), true;
    }
    // --- everything below needs a signed-in writer ---
    const me = who(req); if (!me) return json(res, 401, { error: 'Not signed in' }), true;
    if (p === '/api/writer/me' && m === 'GET') return json(res, 200, { ...pub(me), counts: { total: postsOf(me).length, live: postsOf(me).filter(x => B().isLive(x)).length, inReview: postsOf(me).filter(x => (x.review || {}).state === 'in_review').length }, stats: statsOf(me), cats: B().CATS }), true;
    if (p === '/api/writer/community' && m === 'GET') return json(res, 200, { month: monthLabel(Date.now()), top: topContributors(), you: me.id }), true;
    if (p === '/api/writer/goal' && m === 'PUT') { const b = await readJson(req); me.goal = { cadence: b.cadence === 'monthly' ? 'monthly' : 'weekly', count: Math.min(Math.max(parseInt(b.count, 10) || 1, 1), b.cadence === 'monthly' ? 30 : 7), remind: b.remind !== false }; save(); return json(res, 200, statsOf(me)), true; }
    if (p === '/api/writer/plans' && m === 'GET') return json(res, 200, (me.plans || []).map(x => planView(me, x)).sort((x, y) => x.date.localeCompare(y.date))), true;
    if (p === '/api/writer/plans' && m === 'POST') {
      const b = await readJson(req), title = cleanS(b.title, 120), date = cleanDate(b.date); me.plans = me.plans || [];
      if (title.length < 3) return json(res, 400, { error: 'Give the planned article a title.' }), true; if (!date) return json(res, 400, { error: 'Pick a date.' }), true; if (me.plans.length >= 100) return json(res, 400, { error: 'Too many planned items, remove some old ones.' }), true;
      const pl = { id: uid(), date, title, note: cleanS(b.note, 300), postId: postsOf(me).some(x => x.id === b.postId) ? b.postId : '' }; me.plans.push(pl); save(); return json(res, 200, planView(me, pl)), true;
    }
    const pm = p.match(/^\/api\/writer\/plans\/([a-f0-9]+)$/);
    if (pm) {
      const pl = (me.plans || []).find(x => x.id === pm[1]); if (!pl) return json(res, 404, { error: 'Not found' }), true;
      if (m === 'DELETE') { me.plans.splice(me.plans.indexOf(pl), 1); save(); return json(res, 200, { ok: true }), true; }
      if (m === 'PUT') { const b = await readJson(req); if (b.title !== undefined && cleanS(b.title, 120).length >= 3) pl.title = cleanS(b.title, 120); if (b.date !== undefined && cleanDate(b.date)) { if (cleanDate(b.date) !== pl.date && me.sent) { delete me.sent['due:' + pl.id]; delete me.sent['late:' + pl.id]; } pl.date = cleanDate(b.date); } if (b.note !== undefined) pl.note = cleanS(b.note, 300); if (b.postId !== undefined) pl.postId = postsOf(me).some(x => x.id === b.postId) ? b.postId : ''; save(); return json(res, 200, planView(me, pl)), true; }
    }
    if (p === '/api/writer/me' && m === 'PUT') {
      const b = await readJson(req); const name = cleanS(b.name, 60); if (name.length < 2) return json(res, 400, { error: 'Please enter your name.' }), true;
      me.name = name; me.slug = uniqueSlug(name, me.id); me.bio = { en: cleanS((b.bio || {}).en, 400), so: cleanS((b.bio || {}).so, 400) };
      if (b.photo !== undefined) me.photo = /^(\/uploads\/[a-f0-9]{16}\.(png|jpg|webp)|https:\/\/[^\s"'<>]{4,300})$/.test(b.photo || '') ? b.photo : '';
      me.social = {}; for (const k of ['website', 'youtube', 'facebook', 'tiktok', 'instagram', 'x', 'linkedin']) { const v = cleanS((b.social || {})[k], 200); if (/^https:\/\/[^\s"'<>]+$/.test(v)) me.social[k] = v; }
      for (const x of postsOf(me)) x.authorName = me.name; B().save(); save(); return json(res, 200, pub(me)), true;
    }
    if (p === '/api/writer/password' && m === 'POST') {
      const b = await readJson(req); if (limited(ip + 'wpw', 8)) return json(res, 429, { error: 'Too many attempts.' }), true;
      if (!checkPw(b.current, me.hash)) { await new Promise(r => setTimeout(r, 700)); return json(res, 400, { error: 'Your current password is not correct.' }), true; }
      if (!strong(b.password)) return json(res, 400, { error: 'Use at least 12 characters.' }), true;
      me.hash = hashPw(b.password); me.epoch = (me.epoch || 0) + 1; save(); return json(res, 200, { ok: true }, { 'Set-Cookie': setCookie(req, me) }), true;
    }
    if (p === '/api/writer/upload' && m === 'POST') {   // cover images / profile photo: png, jpg or webp, ≤ 1 MB, checked by file signature
      const raw = await new Promise((ok, no) => { let s = '', n = 0; req.on('data', c => { n += c.length; if (n > 1.6e6) { req.destroy(); no(new Error('too large')); } else s += c; }); req.on('end', () => ok(s)); req.on('error', no); }).catch(() => null);
      if (raw === null) return json(res, 413, { error: 'Image is too large (max 1 MB).' }), true;
      let b; try { b = JSON.parse(raw); } catch { return json(res, 400, { error: 'Bad upload' }), true; }
      const mm = String(b.data || '').match(/^data:[\w/+.-]+;base64,([A-Za-z0-9+/=]+)$/); if (!mm) return json(res, 400, { error: 'Bad image data' }), true;
      const buf = Buffer.from(mm[1], 'base64'); if (buf.length > 1048576) return json(res, 413, { error: 'Image is too large (max 1 MB).' }), true;
      let ext = null; if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ext = 'png'; else if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) ext = 'jpg'; else if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') ext = 'webp';
      if (!ext) return json(res, 400, { error: 'Please upload a PNG, JPG or WebP image.' }), true;
      if (limited(ip + 'wup', 40)) return json(res, 429, { error: 'Too many uploads. Try again later.' }), true;
      const name = crypto.randomBytes(8).toString('hex') + '.' + ext; try { await store.putFile(name, buf); } catch (e) { console.error('upload failed:', e.message); return json(res, 502, { error: 'Could not save the image. Please try again.' }), true; }
      return json(res, 200, { url: '/uploads/' + name }), true;
    }
    if (p === '/api/writer/preview' && m === 'POST') { const b = await readJson(req); return json(res, 200, { html: B().md(cleanS(b.body, 60000), b.lang === 'so' ? 'so' : 'en') }), true; }
    if (p === '/api/writer/posts' && m === 'GET') return json(res, 200, postsOf(me).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).map(x => wView(x, me))), true;
    if (p === '/api/writer/posts' && m === 'POST') {
      if (postsOf(me).length >= MAXPOSTS) return json(res, 400, { error: 'You have reached the limit of articles. Ask Eng Yuyu.' }), true;
      const b = await readJson(req), post = B().normalise(writerFields(b, null), null);
      if (!post.en.title) return json(res, 400, { error: 'An English title is required.' }), true;
      post.authorId = me.id; post.authorName = me.name; post.review = { state: 'draft' }; B().db.posts.push(post); B().save();
      return json(res, 200, wFull(post, me)), true;
    }
    const mm = p.match(/^\/api\/writer\/posts\/([a-f0-9]+)(?:\/(\w+))?$/);
    if (mm) {
      const post = B().db.posts.find(x => x.id === mm[1] && x.authorId === me.id); if (!post) return json(res, 404, { error: 'Not found' }), true;   // other people's articles do not exist for a writer
      const state = (post.review || {}).state || 'draft';
      if (!mm[2] && m === 'GET') return json(res, 200, { ...wFull(post, me), note: (post.review || {}).note || '', problems: problems(post) }), true;
      if (!mm[2] && m === 'PUT') {
        if (state === 'in_review') return json(res, 400, { error: 'This article is in review. Withdraw it first if you want to change it.' }), true;
        if (post.status === 'published' && !me.trusted) return json(res, 400, { error: 'This article is already published. To change it, use “Ask for an edit”.' }), true;
        const b = await readJson(req); B().normalise(writerFields(b, post), post); if (!post.en.title) return json(res, 400, { error: 'An English title is required.' }), true;
        post.authorName = me.name; if (post.status !== 'published') post.review = { ...(post.review || {}), state: state === 'changes' ? 'changes' : 'draft' }; B().save();
        return json(res, 200, { ...wFull(post, me), problems: problems(post) }), true;
      }
      if (!mm[2] && m === 'DELETE') {
        if (post.status === 'published') return json(res, 400, { error: 'Published articles can only be removed by Eng Yuyu.' }), true;
        B().db.posts.splice(B().db.posts.indexOf(post), 1); B().db.comments = B().db.comments.filter(c => c.postId !== post.id); B().save(); return json(res, 200, { ok: true }), true;
      }
      if (mm[2] === 'submit' && m === 'POST') {
        if (post.status === 'published') return json(res, 400, { error: 'Already published.' }), true;
        const pr = problems(post); if (pr.length) return json(res, 400, { error: pr[0], problems: pr }), true;
        post.review = { state: 'in_review', submittedAt: Date.now(), note: '' }; B().save(); log('writer', `${me.name} submitted “${post.en.title}” for review`);
        ownerMail(`Review needed: “${post.en.title}” by ${me.name}`, 'An article is waiting for your review', [['Writer', `<b>${esc(me.name)}</b>`], ['Article', esc(post.en.title)], ['Length', `${B().wordCount(post.en.body)} words`], ['Somali version', post.so.title && post.so.body ? 'Yes' : 'No']], `${SITE()}/admin#/blog/edit/${post.id}`, 'Review the article');
        return json(res, 200, { ok: true, review: post.review }), true;
      }
      if (mm[2] === 'withdraw' && m === 'POST') { if (state !== 'in_review') return json(res, 400, { error: 'This article is not in review.' }), true; post.review = { state: 'draft' }; B().save(); return json(res, 200, { ok: true }), true; }
      if (mm[2] === 'publish' && m === 'POST') {   // trusted writers only
        if (!me.trusted) return json(res, 403, { error: 'Only trusted writers can publish directly. Send it for review instead.' }), true;
        const pr = problems(post); if (pr.length) return json(res, 400, { error: pr[0], problems: pr }), true;
        if (post.status !== 'published') { post.status = 'published'; post.publishedAt = Date.now(); post.notify = false; post.review = { state: 'published', reviewedAt: Date.now(), direct: true }; B().save(); log('writer', `${me.name} published “${post.en.title}” directly (trusted)`); congrats(me); ownerMail(`${me.name} published an article`, 'A trusted writer published an article', [['Writer', `<b>${esc(me.name)}</b>`], ['Article', esc(post.en.title)]], B().url(post, 'en'), 'See it live'); }
        return json(res, 200, { ok: true, url: B().url(post, 'en') }), true;
      }
      if (mm[2] === 'editrequest' && m === 'POST') {
        const b = await readJson(req), note = cleanS(b.note, 1000); if (note.length < 5) return json(res, 400, { error: 'Please say what you would like changed.' }), true;
        ownerMail(`Edit request: “${post.en.title}” by ${me.name}`, 'A writer asked for an edit', [['Writer', `<b>${esc(me.name)}</b>`], ['Article', esc(post.en.title)], ['Request', esc(note)]], `${SITE()}/admin#/blog/edit/${post.id}`, 'Open the article'); return json(res, 200, { ok: true }), true;
      }
    }
    return json(res, 404, { error: 'Not found' }), true;
  }

  // ---- owner side: /api/admin/authors* (owner cookie required: a writer cookie never works here) ----
  async function adminApi(req, res, u) {
    const p = u.pathname, m = req.method;
    if (!p.startsWith('/api/admin/authors')) return false;
    if (!A().authed(req)) return json(res, 401, { error: 'Not signed in' }), true;
    if (m !== 'GET' && req.headers['x-requested-with'] !== 'yy-admin') return json(res, 403, { error: 'Bad request' }), true;
    if (p === '/api/admin/authors' && m === 'GET') return json(res, 200, { authors: authors.map(a => ({ ...pub(a), posts: postsOf(a).length, live: postsOf(a).filter(x => B().isLive(x)).length, inReview: postsOf(a).filter(x => (x.review || {}).state === 'in_review').length, stats: statsOf(a), planned: (a.plans || []).filter(x => !planDone(a, x) && x.date >= ymd(Date.now())).length })), top: topContributors(), month: monthLabel(Date.now()), loginUrl: SITE() + '/writers' }), true;
    if (p === '/api/admin/authors/reminders' && m === 'POST') { const b = await readJson(req); return json(res, 200, { sent: await runReminders(MOCK && b.now ? Number(b.now) : Date.now()) }), true; }
    if (p === '/api/admin/authors' && m === 'POST') {
      const b = await readJson(req), name = cleanS(b.name, 60), email = cleanS(b.email, 120).toLowerCase();
      if (name.length < 2) return json(res, 400, { error: 'Please enter the writer’s name.' }), true;
      if (!emailOk(email)) return json(res, 400, { error: 'Please enter a valid email address.' }), true;
      if (authors.some(a => a.email === email)) return json(res, 400, { error: 'A writer with this email already exists.' }), true;
      const token = crypto.randomBytes(32).toString('hex'), a = { id: uid(), name, email, slug: uniqueSlug(name), status: 'invited', trusted: !!b.trusted, bio: {}, photo: '', social: {}, createdAt: Date.now(), invitedAt: Date.now(), epoch: 0, invite: { h: sha(token), exp: Date.now() + 7 * 864e5 } };
      authors.push(a); save(); await inviteMail(a, token); log('writer', `Invited ${name} <${email}> as a writer${a.trusted ? ' (trusted)' : ''}`);
      return json(res, 200, pub(a)), true;
    }
    let mm = p.match(/^\/api\/admin\/authors\/([a-f0-9]+)(?:\/(\w+))?$/);
    if (mm) {
      const a = authors.find(x => x.id === mm[1]); if (!a) return json(res, 404, { error: 'Not found' }), true;
      if (!mm[2] && m === 'PATCH') {
        const b = await readJson(req);
        if (b.trusted !== undefined) { a.trusted = !!b.trusted; log('writer', `${a.name} is ${a.trusted ? 'now trusted (can publish directly)' : 'no longer trusted (articles need your review)'}`); }
        if (b.name !== undefined && cleanS(b.name, 60).length >= 2) { a.name = cleanS(b.name, 60); a.slug = uniqueSlug(a.name, a.id); for (const x of postsOf(a)) x.authorName = a.name; B().save(); }
        if (b.status === 'paused' && a.status === 'active') { a.status = 'paused'; a.epoch = (a.epoch || 0) + 1; log('writer', `Paused ${a.name} (signed out)`); }
        if (b.status === 'active' && a.status === 'paused') { a.status = 'active'; log('writer', `Resumed ${a.name}`); }
        save(); return json(res, 200, pub(a)), true;
      }
      if (mm[2] === 'invite' && m === 'POST') { if (a.status !== 'invited') return json(res, 400, { error: 'This writer already joined.' }), true; const token = crypto.randomBytes(32).toString('hex'); a.invite = { h: sha(token), exp: Date.now() + 7 * 864e5 }; a.invitedAt = Date.now(); save(); await inviteMail(a, token); return json(res, 200, { ok: true }), true; }
      if (!mm[2] && m === 'DELETE') {
        const mine = postsOf(a);
        for (const x of mine) { x.authorName = a.name; if (x.status !== 'published') { B().db.posts.splice(B().db.posts.indexOf(x), 1); } else { x.authorId = ''; x.authorName = ''; } }   // unpublished drafts go; live articles stay (credited to the site)
        authors.splice(authors.indexOf(a), 1); B().save(); save(); log('writer', `Removed writer ${a.name}`); return json(res, 200, { ok: true }), true;
      }
    }
    mm = p.match(/^\/api\/admin\/authors\/review\/([a-f0-9]+)$/);
    if (mm && m === 'POST') {   // send an article back to its writer with a note
      const post = B().db.posts.find(x => x.id === mm[1] && x.authorId); if (!post) return json(res, 404, { error: 'Not found' }), true;
      const a = authors.find(x => x.id === post.authorId), b = await readJson(req), note = cleanS(b.note, 2000);
      if (note.length < 5) return json(res, 400, { error: 'Please write a short note so the writer knows what to change.' }), true;
      post.review = { state: 'changes', note, reviewedAt: Date.now() }; if (post.status !== 'published') post.status = 'draft'; B().save(); log('writer', `Sent “${post.en.title}” back to ${post.authorName} with a note`);
      if (a) { const bl = M(); mailTo(a, `Changes requested: ${post.en.title}`, 'A few changes before we publish', [bl.p(`Hi ${esc(a.name.split(' ')[0])}, thank you for <b>${esc(post.en.title)}</b>. Before it goes live I’d like you to change a few things:`), bl.note(esc(note).replace(/\n/g, '<br>'), 'warn'), bl.button('Open your article', `${SITE()}/writers#/edit/${post.id}`), bl.small('Make the changes, then send it for review again.')]); }
      return json(res, 200, { ok: true }), true;
    }
    return json(res, 404, { error: 'Not found' }), true;
  }

  // ---- the writers' pages (/writers) ----
  const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
  function pages(req, res, u) {
    const p = u.pathname; if (p !== '/writers' && p !== '/writers/' && !p.startsWith('/writers/')) return false;
    const rel = (p === '/writers' || p === '/writers/') ? 'index.html' : p.slice('/writers/'.length), f = path.normalize(path.join(DIR, rel));
    if (!f.startsWith(DIR + path.sep) || !MIME[path.extname(f)]) { res.writeHead(404); res.end(); return true; }
    try { const b = fs.readFileSync(f); res.writeHead(200, { 'Content-Type': MIME[path.extname(f)], 'Cache-Control': 'no-cache', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'Content-Security-Policy': "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'" }); res.end(b); } catch { res.writeHead(404); res.end(); }
    return true;
  }

  return { handle: async (req, res, u) => pages(req, res, u) || (await writerApi(req, res, u)) || (await adminApi(req, res, u)), onPublished, authors, runReminders, statsOf, topContributors, publicTop };
};
