// Background automations: session reminder emails + weekly owner summary.
'use strict';
module.exports = ctx => {
  const { MOCK, store, settings, orders, saveOrders, SESSIONS, OWNER, sendMail, locked, fmtWhen, esc, SITE_URL } = ctx;
  const HOUR = 3600e3, EAT = 3 * HOUR;
  const on = k => !settings.automations || settings.automations[k] !== false;
  const meetOf = o => o.meet || '';

  // ---- reminders: 24 h and 1 h before every paid/confirmed session ----
  const reminderMail = (o, s, kind) => { const m = ctx.mails.reminder(o, s, kind); if (o.test) m.subject = '[TEST] ' + m.subject; return m; };

  async function runReminders() {
    if (!on('reminders')) return;
    const now = Date.now();
    for (const o of Object.values(orders)) {
      if (o.status !== 'paid' && o.status !== 'confirmed') continue;
      const s = SESSIONS[o.session], diff = o.start - now;
      if (!s || !o.email || diff <= 0 || diff > 24 * HOUR) continue;
      const kind = diff <= 2 * HOUR ? '1h' : '24h', flag = kind === '1h' ? 'remind1h' : 'remind24h';
      if (o[flag] || (kind === '24h' && o.remind1h)) continue;
      o[flag] = now; saveOrders();   // mark first so a slow/failed send never double-sends
      try { await sendMail({ to: o.email, ...reminderMail(o, s, kind) }); console.log('reminder', kind, o.id); } catch (e) { console.error('reminder failed', o.id, e.message); o[flag] = 0; saveOrders(); }
    }
  }

  // ---- after the session: thank you + feedback + "book again" (2 hours after it ends, within 3 days) ----
  async function runFollowUps() {
    if (!on('followup')) return;
    const now = Date.now();
    for (const o of Object.values(orders)) {
      const s = SESSIONS[o.session];
      if (!s || !o.email || o.followUp || !['paid', 'confirmed'].includes(o.status)) continue;
      const end = o.start + s.min * 60e3;
      if (now < end + 2 * HOUR || now > end + 72 * HOUR) continue;
      o.followUp = now; saveOrders();
      const m = ctx.mails.followUp(o, s); if (o.test) m.subject = '[TEST] ' + m.subject;
      try { await sendMail({ to: o.email, ...m }); } catch (e) { console.error('follow-up failed', o.id, e.message); o.followUp = 0; saveOrders(); }
    }
  }

  // ---- weekly summary: Saturdays 09:00 Mogadishu time, covers the last 7 days ----
  function digestMail(sum) {
    const k = sum.kpi, money = n => '$' + Number(n || 0).toLocaleString(), dl = d => d === null || d === undefined ? '' : ` (${d >= 0 ? '+' : ''}${d}% vs previous week)`;
    const upc = Object.values(orders).filter(o => (o.status === 'paid' || o.status === 'confirmed') && o.start > Date.now() && o.start < Date.now() + 7 * 24 * HOUR).sort((a, b) => a.start - b.start);
    const pages = Object.entries(sum.traffic.pages).sort((a, b) => b[1] - a[1]).slice(0, 5), refs = Object.entries(sum.traffic.refs).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const rows = [
      ['Revenue', money(k.revenue.value) + dl(k.revenue.delta)], ['Bookings', k.bookings.value + dl(k.bookings.delta)], ['Booking conversion', k.conversion.value === null ? '-' : k.conversion.value + '%'],
      ['Website visitors', `${k.views.visitors.toLocaleString()} (${k.views.value.toLocaleString()} page views)${dl(k.views.delta)}`], ['New subscribers', `${k.subscribers.new} (total ${k.subscribers.value})`], ['Unread messages', k.messages.unread],
    ];
    const upLines = upc.map(o => `${fmtWhen(o.start, 'en')}, ${SESSIONS[o.session] ? SESSIONS[o.session].title.en : o.session}, ${o.name}`);
    const tips = (sum.insights || []).map(i => i.text);
    const text = ['Your week on engyuyu.com', '', ...rows.map(r => `${r[0]}: ${r[1]}`), '', 'Coming up in the next 7 days:', ...(upLines.length ? upLines.map(x => '* ' + x) : ['* nothing booked yet']), '', pages.length ? 'Top pages:' : '', ...pages.map(([p, n]) => `* ${p}, ${n}`), refs.length ? '\nTop sources:' : '', ...refs.map(([p, n]) => `* ${p}, ${n}`), tips.length ? '\nHighlights:' : '', ...tips.map(x => '* ' + x), '', `Dashboard: ${SITE_URL}/admin`].join('\n');
    const li = x => `<li style="margin:0 0 5px">${x}</li>`;
    const html = `<div style="font-family:Roboto,Arial,sans-serif;max-width:580px;margin:auto;color:#0B1F3A;line-height:1.5"><div style="background:#006AFF;color:#fff;padding:20px 24px;border-radius:16px 16px 0 0"><div style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;opacity:.85">Eng Yuyu · Weekly summary</div><div style="font-size:21px;font-weight:700;margin-top:4px">Your week on engyuyu.com</div></div><div style="border:1px solid #dbe5f3;border-top:0;border-radius:0 0 16px 16px;padding:22px 24px">
<table style="width:100%;border-collapse:collapse">${rows.map(r => `<tr><td style="padding:8px 0;border-bottom:1px solid #eef2f8;color:#5b6f8a">${esc(r[0])}</td><td style="padding:8px 0;border-bottom:1px solid #eef2f8;text-align:right"><b>${esc(String(r[1]))}</b></td></tr>`).join('')}</table>
<h3 style="margin:22px 0 8px">Coming up in the next 7 days</h3><ul style="padding-left:18px;margin:0">${upLines.length ? upLines.map(x => li(esc(x))).join('') : li('Nothing booked yet')}</ul>
${pages.length ? `<h3 style="margin:22px 0 8px">Top pages</h3><ul style="padding-left:18px;margin:0">${pages.map(([p, n]) => li(`${esc(p)}: <b>${n}</b>`)).join('')}</ul>` : ''}
${refs.length ? `<h3 style="margin:22px 0 8px">Top sources</h3><ul style="padding-left:18px;margin:0">${refs.map(([p, n]) => li(`${esc(p)}: <b>${n}</b>`)).join('')}</ul>` : ''}
${tips.length ? `<h3 style="margin:22px 0 8px">Highlights</h3><ul style="padding-left:18px;margin:0">${tips.map(x => li(esc(x))).join('')}</ul>` : ''}
<p style="margin:22px 0 0"><a href="${esc(SITE_URL)}/admin" style="background:#006AFF;color:#fff;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:700;display:inline-block">Open dashboard</a></p></div></div>`;
    return { subject: `Weekly summary: ${money(k.revenue.value)} · ${k.bookings.value} booking${k.bookings.value === 1 ? '' : 's'} · ${k.views.visitors.toLocaleString()} visitors`, text, html };
  }
  async function digest() { await sendMail({ to: OWNER(), ...digestMail(ctx.admin.summary(7)) }); }
  async function runDigest() {
    if (!on('weekly')) return;
    const eat = new Date(Date.now() + EAT), key = eat.toISOString().slice(0, 10);
    if (eat.getUTCDay() !== 6 || eat.getUTCHours() < 9 || settings.lastDigest === key) return;
    settings.lastDigest = key; store.save('settings');
    try { await digest(); console.log('weekly summary sent'); } catch (e) { console.error('weekly summary failed', e.message); settings.lastDigest = ''; store.save('settings'); }
  }

  const tick = () => locked(async () => { await runReminders(); await runFollowUps(); await runDigest(); }).catch(console.error);
  setInterval(tick, 5 * 60e3).unref();
  setTimeout(tick, 15e3).unref();
  return { runReminders, runFollowUps, runDigest, digest, reminderMail, on };
};
