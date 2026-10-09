// Branded emails (English + Somali). One layout for everything the site sends, so every email looks like Eng Yuyu:
// logo header, white card, brand-blue buttons, clear details table, footer with contact + social links.
// Each template returns { subject, text, html }, the plain-text part is built from the same content.
// Email-safe HTML only: tables, inline styles, PNG images, no scripts, no web fonts required.
'use strict';

module.exports = function mail({ SITE_URL, OWNER, fmtWhen, RULES, copyOverrides }) {
  const SITE = () => String(SITE_URL || 'https://engyuyu.com').replace(/\/$/, '');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const BLUE = '#006AFF', NAVY = '#0B1F3A', INK = '#0B1F3A', MUTED = '#5B6F8A', LINE = '#E3EAF4', BG = '#F2F6FB';
  const SOCIAL = [['YouTube', 'https://www.youtube.com/@engyuyu'], ['Facebook', 'https://www.facebook.com/engyuyu'], ['TikTok', 'https://www.tiktok.com/@engyuyu'], ['Instagram', 'https://www.instagram.com/engyuyu']];
  const L = o => (o && o.lang === 'so' ? 'so' : 'en');
  const first = name => String(name || '').trim().split(/\s+/)[0] || name || '';
  const money = n => '$' + Number(n || 0).toFixed(Number(n) % 1 ? 2 : 0);

  // ---- building blocks: each returns [html, text] ----
  const p = (t, style = '') => [`<p style="margin:0 0 14px;${style}">${t}</p>`, t.replace(/<[^>]+>/g, '')];
  const h = t => [`<h2 style="margin:26px 0 10px;font-size:17px;color:${INK}">${esc(t)}</h2>`, '\n' + t.toUpperCase()];
  const button = (label, href, color = BLUE) => [`<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0"><tr><td style="border-radius:999px;background:${color}"><a href="${esc(href)}" style="display:inline-block;padding:13px 28px;color:#fff;text-decoration:none;font-weight:700;font-size:15px;border-radius:999px">${esc(label)}</a></td></tr></table>`, `${label}: ${href}`];
  const rows = (list, title) => [`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 16px;border:1px solid ${LINE};border-radius:14px;border-collapse:separate;overflow:hidden">${title ? `<tr><td colspan="2" style="padding:12px 16px;background:${BG};font-weight:700;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:${MUTED}">${esc(title)}</td></tr>` : ''}${list.filter(Boolean).map(([k, v, strong], i) => `<tr><td style="padding:11px 16px;${i ? `border-top:1px solid ${LINE};` : ''}color:${MUTED};font-size:14px;width:42%">${esc(k)}</td><td style="padding:11px 16px;${i ? `border-top:1px solid ${LINE};` : ''}font-size:14px;${strong ? 'font-weight:700;' : ''}color:${INK}">${v}</td></tr>`).join('')}</table>`, (title ? title + '\n' : '') + list.filter(Boolean).map(([k, v]) => `* ${k}: ${String(v).replace(/<[^>]+>/g, '')}`).join('\n')];
  const bullets = items => [`<ul style="margin:0 0 14px;padding-left:20px">${items.map(x => `<li style="margin:0 0 6px">${x}</li>`).join('')}</ul>`, items.map(x => '* ' + x.replace(/<[^>]+>/g, '')).join('\n')];
  const note = (t, tone = 'info') => { const c = { info: ['#EEF5FF', '#BFD7FF'], warn: ['#FFF6E5', '#FFD58A'], bad: ['#FFF0F0', '#FFC2C2'], ok: ['#EAFBF2', '#A8E9C6'] }[tone]; return [`<div style="margin:16px 0;padding:14px 16px;border-radius:12px;background:${c[0]};border:1px solid ${c[1]};font-size:14px">${t}</div>`, t.replace(/<[^>]+>/g, '')]; };
  const small = t => [`<p style="margin:14px 0 0;color:${MUTED};font-size:13px">${t}</p>`, t.replace(/<[^>]+>/g, '')];
  const calLinks = (title, start, end, details, loc) => {
    const z = ms => new Date(ms).toISOString().replace(/[-:]|\.\d{3}/g, '');
    const g = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${z(start)}/${z(end)}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(loc || '')}`;
    const o = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(title)}&startdt=${new Date(start).toISOString()}&enddt=${new Date(end).toISOString()}&body=${encodeURIComponent(details)}&location=${encodeURIComponent(loc || '')}`;
    return { g, o };
  };

  // ---- the layout ----
  function layout(lang, { pre, title, blocks, foot, unsubscribe, sign }) {
    const sg = sign || (typeof C === 'function' ? C('signature', lang) : { thanks: lang === 'so' ? 'Mahadsanid,' : 'Thank you,', role: '' });
    const so = lang === 'so';
    const html = `<!doctype html><html lang="${so ? 'so' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${BG};font-family:Roboto,Segoe UI,Arial,sans-serif;color:${INK};line-height:1.55;-webkit-text-size-adjust:100%">
<span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${esc(pre || '')}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG}"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
<tr><td style="padding:0 4px 16px"><a href="${SITE()}" style="text-decoration:none;color:${NAVY}"><img src="${SITE()}/assets/icon-192.png" width="40" height="40" alt="Eng Yuyu" style="vertical-align:middle;border-radius:10px;border:0"> <b style="vertical-align:middle;font-size:17px;margin-left:8px;color:${NAVY}">Eng Yuyu</b></a></td></tr>
<tr><td style="background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 1px 3px rgba(11,31,58,.08)">
<div style="height:6px;background:linear-gradient(90deg,${BLUE},#5AA0FF);background-color:${BLUE}"></div>
<div style="padding:30px 30px 26px">
<h1 style="margin:0 0 16px;font-size:23px;line-height:1.3;color:${NAVY}">${esc(title)}</h1>
${blocks.map(b => b[0]).join('\n')}
<p style="margin:24px 0 0">${esc(sg.thanks)}<br><b>Eng Yuyu</b><br><span style="color:${MUTED};font-size:13px">${esc(sg.role)}</span></p>
</div></td></tr>
<tr><td style="padding:22px 10px;text-align:center;color:${MUTED};font-size:12px;line-height:1.7">
<b style="color:${NAVY}">Technology. Content. Digital Growth.</b><br>
${SOCIAL.map(([n, u]) => `<a href="${u}" style="color:${BLUE};text-decoration:none">${n}</a>`).join(' &nbsp;·&nbsp; ')}<br>
<a href="${SITE()}" style="color:${MUTED}">engyuyu.com</a> &nbsp;·&nbsp; <a href="mailto:${esc(OWNER())}" style="color:${MUTED}">${esc(OWNER())}</a><br>
${foot ? esc(foot) + '<br>' : ''}${unsubscribe ? `<a href="${esc(unsubscribe)}" style="color:${MUTED}">${so ? 'Ka bax liiska' : 'Unsubscribe'}</a>` : ''}
</td></tr></table></td></tr></table></body></html>`;
    const text = [title, '', ...blocks.map(b => b[1]), '', sg.thanks, 'Eng Yuyu', sg.role, `${SITE()} · ${OWNER()}`, foot || '', unsubscribe ? (so ? 'Ka bax: ' : 'Unsubscribe: ') + unsubscribe : ''].filter(x => x !== null).join('\n').replace(/\n{3,}/g, '\n\n').trim();
    return { html, text };
  }

  // ---- editable texts (Dashboard → Settings → Emails → Edit). Placeholders: {name} {session} {date} {minutes} {amount} {reference} {hours}
  //      **bold** works. Lists: one item per line. Anything left empty uses the default below.
  const COPY = {
    signature: { label: 'Signature (all emails)', fields: { thanks: 'Closing line', role: 'Line under your name' },
      en: { thanks: 'Thank you,', role: 'Tech educator & digital media consultant' },
      so: { thanks: 'Mahadsanid,', role: 'Macallin tiknoolajiyad & la-taliye warbaahin dijitaal ah' } },
    confirmed: { label: 'Booking confirmed + receipt', fields: { subject: 'Subject', title: 'Headline', intro: 'Opening paragraph', prepTitle: '“Before we meet” heading', prep: 'What to prepare (one per line)', disclaimer: 'Disclaimer box', change: 'Changes / cancellation line' },
      en: { subject: 'Confirmed: {session}, {date}', title: 'You’re booked, {name}!', intro: 'Thank you, your payment was received and your **{session}** ({minutes} min) is confirmed.', prepTitle: 'Before we meet', prep: 'A short description of what you want help with.\nAny links, screenshots or numbers that relate to it.\nA quiet place and a stable connection, phone or computer both work.', disclaimer: '**Please note: sessions are advice and guidance only.** I can’t repair physical devices or recover banned, hacked or locked accounts, and I will **never** ask for your passwords or verification codes.', change: 'Need to change it? Reply to this email at least {hours} hours before the session.' },
      so: { subject: 'La xaqiijiyay: {session}: {date}', title: 'Ballantaada waa la xaqiijiyay, {name}', intro: 'Mahadsanid! Lacag-bixintaada waa la helay, kulankaaga **{session}** ({minutes} daqiiqo) waa la xaqiijiyay.', prepTitle: 'Ka hor intaynaan kulmin', prep: 'Sharaxaad kooban oo ku saabsan waxa aad caawimaad ugu baahan tahay.\nXiriiro, sawir-shaashadeed ama tirooyin la xiriira.\nMeel deggan iyo internet xasiloon, taleefan ama kombuyuutar labaduba way shaqeeyaan.', disclaimer: '**Fadlan ogow: kulamadu waa talo iyo hagid kaliya.** Ma dayactiri karo qalab jir ahaaneed mana soo celin karo akoonno la mamnuucay, la jabsaday ama la xiray, **weligay** kuma weydiin doono erayga sirta ah ama koodhadhka xaqiijinta.', change: 'Ma u baahan tahay inaad beddesho? Ka jawaab email-kan ugu yaraan {hours} saac kahor.' } },
    reminder24: { label: 'Reminder: 24 hours before', fields: { subject: 'Subject', title: 'Headline', intro: 'Opening paragraph', tips: 'Tips (one per line)', change: 'Can’t make it line' },
      en: { subject: 'Reminder: your {session} is tomorrow', title: 'A quick reminder about your session', intro: 'Hi {name}, this is a friendly reminder about your **{session}**.', tips: 'Have your questions and screenshots ready.\nCheck your connection and sound 5 minutes before.\nNever share passwords or verification codes.', change: 'Can’t make it? Reply to this email as soon as you can.' },
      so: { subject: 'Xusuusin: {session} berri', title: 'Xusuusin: kulankaaga waa berri', intro: 'Salaan {name}, tani waa xusuusin saaxiibtinimo oo ku saabsan kulankaaga **{session}**.', tips: 'Diyaari su’aalahaaga iyo sawir-shaashadeedka.\nHubi internetka iyo codka 5 daqiiqo ka hor.\nWeligaa ha la wadaagin erayga sirta ah ama koodhadhka.', change: 'Ma imaan kartid? Ka jawaab email-kan sida ugu dhaqsaha badan.' } },
    reminder1: { label: 'Reminder: 1 hour before', fields: { subject: 'Subject', title: 'Headline', intro: 'Opening paragraph', tips: 'Tips (one per line)', change: 'Can’t make it line' },
      en: { subject: 'Starting in 1 hour: {session}', title: 'Your session starts in about an hour', intro: 'Hi {name}, your **{session}** starts in about an hour.', tips: 'Have your questions and screenshots ready.\nCheck your connection and sound 5 minutes before.\nNever share passwords or verification codes.', change: 'Can’t make it? Reply to this email as soon as you can.' },
      so: { subject: 'Saacad kadib: {session}', title: 'Kulankaagu wuxuu bilaabmayaa saacad gudaheed', intro: 'Salaan {name}, **{session}** wuxuu bilaabmayaa saacad gudaheed.', tips: 'Diyaari su’aalahaaga iyo sawir-shaashadeedka.\nHubi internetka iyo codka 5 daqiiqo ka hor.\nWeligaa ha la wadaagin erayga sirta ah ama koodhadhka.', change: 'Ma imaan kartid? Ka jawaab email-kan sida ugu dhaqsaha badan.' } },
    followup: { label: 'Thank you + book again', fields: { subject: 'Subject', title: 'Headline', intro: 'Opening paragraph', feedback: 'Feedback box', button: 'Button' },
      en: { subject: 'Thanks for the session, {name}', title: 'Thank you for the session!', intro: 'Hi {name}, thank you for your time in our **{session}**. I hope you left with clear next steps.', feedback: 'One quick question: did the session help? Just reply to this email. I read every answer and it helps me improve.', button: 'Book another session' },
      so: { subject: 'Mahadsanid kulanka, {name}', title: 'Mahadsanid kulanka!', intro: 'Salaan {name}, waad ku mahadsantahay waqtigaaga **{session}**. Waxaan rajaynayaa inaad ka heshay tallaabooyin cad.', feedback: 'Hal su’aal oo gaaban: kulanku ma ku caawiyay? Ka jawaab email-kan: jawaab kasta waan akhriyaa, waxayna iga caawisaa inaan horumariyo.', button: 'Ballan qabso kulan kale' } },
    failed: { label: 'Payment didn’t go through', fields: { subject: 'Subject', title: 'Headline', intro: 'Opening paragraph', reasons: 'Common reasons', button: 'Button', help: 'Help line (reference is added after it)' },
      en: { subject: 'Your payment didn’t go through, not booked yet', title: 'Your payment didn’t go through', intro: 'Hi {name}, the payment for your **{session}** ({date}) wasn’t completed, so the booking is **not confirmed** and **no money was taken**.', reasons: 'Common reasons: low balance, the approval wasn’t confirmed on your phone, or the payment page timed out.', button: 'Try again', help: 'If you were charged, reply to this email with your reference:' },
      so: { subject: 'Lacag-bixintaadu ma dhicin: ballanta lama xaqiijin', title: 'Lacag-bixintu ma dhicin', intro: 'Salaan {name}, lacag-bixinta **{session}** ({date}) ma dhammaystirmin, sidaas darteed ballanta lama xaqiijin **lacagna lagaama qaadin**.', reasons: 'Sababaha caadiga ah: haraaga oo yar, codsiga oo aan la ansixin ama waqtiga oo dhammaaday.', button: 'Isku day mar kale', help: 'Haddii lacag lagaa jaray, ka jawaab email-kan oo raaci tixraaca:' } },
    cancelled: { label: 'Booking cancelled', fields: { subject: 'Subject', title: 'Headline', intro: 'Opening paragraph', refund: 'Refund / new time note (paid bookings)', button: 'Button' },
      en: { subject: 'Booking cancelled: {session}', title: 'Your booking was cancelled', intro: 'Hi {name}, your **{session}** on {date} has been cancelled.', refund: 'I’ll be in touch to find you a new time or refund your payment, just reply if you have a preference.', button: 'Choose a new time' },
      so: { subject: 'Ballanta waa la joojiyay: {session}', title: 'Ballantaada waa la joojiyay', intro: 'Salaan {name}, kulankaaga **{session}** ee {date} waa la joojiyay.', refund: 'Waan kula soo xiriiri doonaa si aan kuugu qabsado waqti cusub ama aan lacagta kuugu celiyo.', button: 'Dooro waqti cusub' } },
    conflict: { label: 'Paid, new time needed', fields: { subject: 'Subject', title: 'Headline', intro: 'Opening paragraph', next: 'What happens next' },
      en: { subject: 'Payment received: we need to pick a new time', title: 'Your payment was received', intro: 'Hi {name}, your payment for **{session}** was received, but the time you chose ({date}) was taken at the same moment.', next: 'I’ll contact you shortly to book another time that suits you, or refund you, whichever you prefer.' },
      so: { subject: 'Lacag-bixintaada waa la helay, waxaan u baahanahay inaan dib u qabanno', title: 'Lacagtaada waa la helay', intro: 'Salaan {name}, lacag-bixintaada **{session}** waa la helay, laakiin waqtigii aad dooratay ({date}) isla daqiiqadaas ayaa la qaatay.', next: 'Waan kula soo xiriiri doonaa dhowaan si aan kuugu qabsado waqti kale ama aan lacagta kuugu celiyo.' } },
    welcome: { label: 'Newsletter welcome', fields: { subject: 'Subject (also the headline)', intro: 'Message', button: 'Button' },
      en: { subject: 'Welcome to the Eng Yuyu Tech Newsletter', intro: 'Thanks for subscribing! You’ll get practical tech guides, AI updates and digital-safety tips, one concise email, no spam.', button: 'Read the latest articles' },
      so: { subject: 'Ku soo dhawow Wargeyska Tiknolojiyada', intro: 'Mahadsanid inaad isku diiwaangelisay! Waxaad heli doontaa hagayaal tiknoolajiyad oo wax ku ool ah, wararka AI iyo talooyin badbaadada dijitaalka, hal email oo kooban, spam ma jiro.', button: 'Akhri maqaalladii ugu dambeeyay' } },
    contact: { label: 'Message received (auto-reply)', fields: { subject: 'Subject (also the headline)', intro: 'Message', more: 'Second line', button: 'Button' },
      en: { subject: 'Thanks, I got your message', intro: 'Hi {name}, thanks for your message. I usually reply within 24–48 hours.', more: 'Need hands-on help sooner? You can book a 1:1 session.', button: 'See sessions' },
      so: { subject: 'Fariintaada waan helnay', intro: 'Salaan {name}, fariintaada waan helnay. Caadi ahaan waan ka jawaabaa 24–48 saac gudahood.', more: 'Ma u baahan tahay caawimaad degdeg ah oo la xiriirta tiknoolajiyada? Ballan qabso kulan 1:1 ah.', button: 'Arag kulamada' } },
    newpost: { label: 'New blog post', fields: { subjectPrefix: 'Subject starts with', button: 'Button' },
      en: { subjectPrefix: 'New:', button: 'Read the article' },
      so: { subjectPrefix: 'Maqaal cusub:', button: 'Akhri maqaalka' } },
  };
  const overrides = () => { try { return (typeof copyOverrides === 'function' ? copyOverrides() : null) || {}; } catch { return {}; } };
  const C = (type, lang) => ({ ...COPY[type][lang], ...Object.fromEntries(Object.entries((overrides()[type] || {})[lang] || {}).filter(([k, v]) => v && String(v).trim() && k in COPY[type].fields)) });
  // fill placeholders; html: escape first, then **bold**; text: plain
  const fill = (str, vars, html = true) => {
    let s = String(str || ''); if (html) s = esc(s);
    s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? (html ? esc(vars[k]) : String(vars[k])) : m));
    return html ? s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>') : s.replace(/\*\*([^*]+)\*\*/g, '$1');
  };
  const lines = (str, vars) => String(str || '').split('\n').map(x => x.trim()).filter(Boolean).map(x => fill(x, vars));
  const vars = (o, s, lang) => ({ name: first(o.name), session: (s.title && (s.title[lang] || s.title.en)) || '', date: fmtWhen(o.start, lang), minutes: s.min, amount: money(o.amount), reference: ref(o), hours: RULES.minNoticeHours });
  const sign = lang => C('signature', lang);

  const when = (o, lang) => fmtWhen(o.start, lang);
  const ref = o => String(o.id || '').slice(0, 8).toUpperCase();
  const payLabel = o => o.payType === 'TEST' ? 'Test payment' : o.payType === 'MANUAL' ? 'Recorded by Eng Yuyu' : o.payType ? `Online · ${o.payType}` : 'Online';
  const LBL = { en: { box: 'Your session', dt: 'Date & time', dur: 'Length', ml: 'Meeting link', join: 'Join on Google Meet', add: 'Add to your calendar:', apple: 'Apple: open the attached file', rc: 'Receipt', item: 'Service', paid: 'Amount paid', meth: 'Payment method', pid: 'Payment ID', date: 'Paid on', refL: 'Reference', mins: 'minutes', noMeet: 'Your Google Meet link will follow in a separate email.', ics: 'A calendar file (.ics) is attached: it works with Google, Outlook/Teams and Apple Calendar.', amount: 'Amount', more: 'Keep going:', l1: 'Free tech guides on the Tech Blog', l2: 'New videos on YouTube' },
    so: { box: 'Kulankaaga', dt: 'Taariikh & waqti', dur: 'Mudada', ml: 'Linkiga kulanka', join: 'Ku soo biir Google Meet', add: 'Ku dar kalandarka:', apple: 'Apple: furo faylka ku lifaaqan', rc: 'Rasiidka', item: 'Adeeg', paid: 'La bixiyay', meth: 'Habka', pid: 'Aqoonsiga lacagta', date: 'Taariikhda', refL: 'Tixraac', mins: 'daqiiqo', noMeet: 'Linkiga Google Meet waxaa laguu soo diri doonaa email gooni ah.', ics: 'Fayl kalandar (.ics) ayaa ku lifaaqan.', amount: 'Lacagta', more: 'Wax badan oo ka mid ah:', l1: 'Hagayaal tiknoolajiyad oo bilaash ah oo ku yaal Blog-ka', l2: 'Muuqaallo cusub oo YouTube ah' } };
  const out = (lang, T, v, opts) => ({ subject: fill(T.subject, v, false), ...layout(lang, { ...opts, title: fill(T.title || T.subject, v, false), sign: sign(lang) }) });

  // 1) Booking confirmed + receipt
  function confirmed(o, s, meet) {
    const lang = L(o), T = C('confirmed', lang), v = vars(o, s, lang), B = LBL[lang], end = o.start + s.min * 60e3;
    const cal = calLinks(`${s.title.en} with Eng Yuyu`, o.start, end, `Join: ${meet || 'link in your confirmation email'}\nReference: ${ref(o)}`, meet);
    const blocks = [p(fill(T.intro, v)),
      rows([[B.dt, `<b>${esc(when(o, lang))}</b>`], [B.dur, `${s.min} ${B.mins}`], meet ? [B.ml, `<a href="${esc(meet)}" style="color:${BLUE}">${esc(meet)}</a>`] : null, [B.refL, ref(o)]], B.box),
      meet ? button(B.join, meet) : note(B.noMeet),
      p(`${B.add} <a href="${cal.g}" style="color:${BLUE}">Google</a> · <a href="${cal.o}" style="color:${BLUE}">Outlook / Teams</a> · ${B.apple}`, 'font-size:14px')];
    if (o.sid) blocks.push(rows([[B.item, esc(`${s.title.en} (${s.min} min)`)], [B.paid, `<b>${money(o.amount)} USD</b>`, true], [B.meth, esc(payLabel(o))], [B.pid, esc(o.sid)], [B.date, esc(fmtWhen(o.paidAt || Date.now(), lang))], [B.refL, ref(o)]], B.rc));
    blocks.push(h(fill(T.prepTitle, v, false)), bullets(lines(T.prep, v)), note(fill(T.disclaimer, v), 'warn'), p(fill(T.change, v)), small(B.ics));
    return out(lang, T, v, { pre: `${v.session} · ${v.date}`, blocks });
  }
  // 2) Reminders (24 h / 1 h)
  function reminder(o, s, kind) {
    const lang = L(o), T = C(kind === '1h' ? 'reminder1' : 'reminder24', lang), v = vars(o, s, lang), B = LBL[lang];
    const blocks = [p(fill(T.intro, v)), rows([[B.dt, `<b>${esc(when(o, lang))}</b>`], [B.dur, `${s.min} ${B.mins}`], [B.refL, ref(o)]]), o.meet ? button(B.join, o.meet) : null, bullets(lines(T.tips, v)), p(fill(T.change, v))].filter(Boolean);
    return out(lang, T, v, { pre: v.date, blocks });
  }
  // 3) Payment did not go through
  function paymentFailed(o, s) {
    const lang = L(o), T = C('failed', lang), v = vars(o, s, lang);
    return out(lang, T, v, { pre: fill(T.title, v, false), blocks: [p(fill(T.intro, v)), p(fill(T.reasons, v), `color:${MUTED}`), button(fill(T.button, v, false), `${SITE()}/consulting.html?session=${encodeURIComponent(o.session)}#book`), small(fill(T.help, v) + ' ' + ref(o))] });
  }
  // 4) Booking cancelled (by Eng Yuyu)
  function cancelled(o, s) {
    const lang = L(o), T = C('cancelled', lang), v = vars(o, s, lang), paid = !!o.sid && o.payType !== 'TEST';
    return out(lang, T, v, { pre: fill(T.title, v, false), blocks: [p(fill(T.intro, v)), paid ? note(fill(T.refund, v)) : null, button(fill(T.button, v, false), `${SITE()}/consulting.html#book`), small(LBL[lang].refL + ': ' + ref(o))].filter(Boolean) });
  }
  // 5) Paid, but the time was taken meanwhile
  function conflict(o, s) {
    const lang = L(o), T = C('conflict', lang), v = vars(o, s, lang), B = LBL[lang];
    return out(lang, T, v, { pre: fill(T.title, v, false), blocks: [p(fill(T.intro, v)), note(fill(T.next, v), 'warn'), rows([[B.amount, money(o.amount) + ' USD'], [B.pid, esc(o.sid || '')], [B.refL, ref(o)]])] });
  }
  // 6) After the session: thank you + feedback + book again
  function followUp(o, s) {
    const lang = L(o), T = C('followup', lang), v = vars(o, s, lang), B = LBL[lang];
    return out(lang, T, v, { pre: fill(T.title, v, false), blocks: [p(fill(T.intro, v)), note(fill(T.feedback, v), 'ok'), p(`<b>${B.more}</b>`), bullets([`<a href="${SITE()}/blog" style="color:${BLUE}">${B.l1}</a>`, `<a href="https://www.youtube.com/@engyuyu" style="color:${BLUE}">${B.l2}</a>`]), button(fill(T.button, v, false), `${SITE()}/consulting.html#book`)] });
  }
  // 7) Newsletter welcome / contact auto-reply / new blog post
  function welcome(lang, unsub) {
    const T = C('welcome', lang), v = {};
    return out(lang, T, v, { pre: fill(T.intro, v, false).slice(0, 90), unsubscribe: unsub, blocks: [p(fill(T.intro, v)), button(fill(T.button, v, false), `${SITE()}/blog`)] });
  }
  function contactReply(lang, name) {
    const T = C('contact', lang), v = { name: first(name) };
    return out(lang, T, v, { pre: fill(T.subject, v, false), blocks: [p(fill(T.intro, v)), p(fill(T.more, v)), button(fill(T.button, v, false), `${SITE()}/consulting.html`)] });
  }
  function newPost(lang, { title, excerpt, link, image }, unsub) {
    const T = C('newpost', lang);
    return { subject: `${fill(T.subjectPrefix, {}, false)} ${title}`, ...layout(lang, { pre: excerpt, title, unsubscribe: unsub, sign: sign(lang), blocks: [image ? [`<a href="${esc(link)}"><img src="${esc(image)}" width="540" alt="" style="width:100%;max-width:540px;height:auto;border-radius:14px;margin:0 0 16px;border:0"></a>`, ''] : null, p(esc(excerpt)), button(fill(T.button, {}, false), link)].filter(Boolean) }) };
  }
  // owner: new booking
  function ownerBooking(o, s) {
    const t = `${o.test ? '[TEST] ' : ''}New ${o.sid ? 'paid ' : ''}booking, ${s.title.en}, ${o.name}`;
    return { subject: t, ...layout('en', { pre: `${o.name} · ${fmtWhen(o.start, 'en')}`, title: 'New booking', blocks: [rows([['Client', `<b>${esc(o.name)}</b>`], ['Email', `<a href="mailto:${esc(o.email)}" style="color:${BLUE}">${esc(o.email)}</a>`], ['Session', esc(`${s.title.en} (${s.min} min)`)], ['When', esc(fmtWhen(o.start, 'en'))], ['Paid', o.sid ? `${money(o.amount)} · ${esc(payLabel(o))} · ${esc(o.sid)}` : 'No payment'], ['Meet', o.meet ? `<a href="${esc(o.meet)}" style="color:${BLUE}">${esc(o.meet)}</a>` : '-'], ['Notes', esc(o.note || '-')], ['Reference', ref(o)]]), button('Open in dashboard', `${SITE()}/admin#/bookings`)] }) };
  }

  // owner: new contact-form message
  const TYPES = { work: 'Collaboration / Work with me', consulting: 'Consulting', events: 'Events & Media / speaking', partner: 'Brand partnership', other: 'Something else' };
  function ownerMessage(mm) {
    const reply = `mailto:${mm.email}?subject=${encodeURIComponent('Re: your message to Eng Yuyu')}`;
    return { subject: `New message: ${mm.name} (${TYPES[mm.type] || mm.type})`, ...layout('en', { pre: String(mm.message).slice(0, 90), title: 'New message', blocks: [
      rows([['From', `<b>${esc(mm.name)}</b>`], ['Email', `<a href="mailto:${esc(mm.email)}" style="color:${BLUE}">${esc(mm.email)}</a>`], ['Interested in', esc(TYPES[mm.type] || mm.type)], ['Language', mm.lang === 'so' ? 'Somali' : 'English']]),
      [`<div style="margin:6px 0 16px;padding:16px 18px;border-left:4px solid ${BLUE};background:${BG};border-radius:0 12px 12px 0;white-space:pre-wrap">${esc(mm.message)}</div>`, mm.message],
      button('Reply to ' + first(mm.name), reply), small(`They already got an automatic “message received” reply. You can also read it in the dashboard: <a href="${SITE()}/admin#/messages" style="color:${BLUE}">Messages</a>.`)] }) };
  }

  return { COPY, ownerMessage, layout, blocks: { p, h, button, rows, bullets, note, small }, confirmed, reminder, paymentFailed, cancelled, conflict, followUp, welcome, contactReply, newPost, ownerBooking, esc };
};
