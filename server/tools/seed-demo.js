// Fills the dashboard with DEMO data so you can see it working.  node server/tools/seed-demo.js
// Uses DATA_DIR (default server/data). Run with DATA_DIR=server/data-demo to keep real data untouched.
const crypto = require('crypto');
const store = require('../lib/store');
const DAY = 864e5, now = Date.now(), EAT = 3 * 3600e3;
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)], hex = n => crypto.randomBytes(n).toString('hex');
const names = ['Amina Hassan', 'Abdi Warsame', 'Hodan Ali', 'Mohamed Nur', 'Fadumo Yusuf', 'Ahmed Jama', 'Ilhan Omar', 'Yasir Abdi', 'Sagal Farah', 'Liban Ismail', 'Khadra Osman', 'Hassan Dahir', 'Sahra Guled', 'Bashir Mire', 'Nasra Abdullahi'];
const dayKey = ms => new Date(ms + EAT).toISOString().slice(0, 10);
const SES = { techfix: [30, 30], buying: [30, 30], income: [60, 50], business: [60, 50], safety: [45, 40] };

const orders = store.load('orders', {}); Object.keys(orders).forEach(k => delete orders[k]);
const mockMeet = 'https://meet.google.com/abc-defg-hij';
const slotAfter = (t) => { let d = t; for (let i = 0; i < 20; i++) { const e = new Date(d + EAT); if ([0, 2, 3].includes(e.getUTCDay())) return Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate(), 0, (14 + Math.floor(rnd() * 5)) * 60 + (rnd() < .5 ? 0 : 30) - 180); d += DAY; } return t; };
for (let i = 0; i < 52; i++) {
  const age = Math.pow(rnd(), 0.8) * 84, created = now - age * DAY;               // more recent bookings = growth
  const sid = pick(['techfix', 'buying', 'income', 'business', 'safety', 'techfix', 'income']), r = rnd();
  const status = age < 0.1 ? 'pending' : r < .72 ? 'paid' : r < .8 ? 'pending' : r < .92 ? 'expired' : r < .97 ? 'cancelled' : 'paid_conflict';
  const id = hex(16), nm = pick(names), start = slotAfter(created + (1 + rnd() * 6) * DAY);
  orders[id] = { id, session: sid, start, name: nm, email: nm.toLowerCase().replace(/[^a-z]/g, '.') + '@example.com', note: rnd() < .4 ? 'Want help growing my YouTube channel.' : '', lang: rnd() < .35 ? 'so' : 'en', amount: SES[sid][1], status, createdAt: created, holdUntil: created + 20 * 60e3 };
  if (status === 'paid') Object.assign(orders[id], { sid: 'SF' + hex(4).toUpperCase(), payType: pick(['EDAHAB', 'ZAAD', 'ZAAD', 'PREMIER WALLET', 'CARD']), paidAt: created + 6 * 60e3, meet: mockMeet });
  if (status === 'paid_conflict') orders[id].sid = 'SF' + hex(4).toUpperCase();
}
// make sure there are a few upcoming paid sessions
for (let i = 0; i < 4; i++) { const id = hex(16), sid = pick(Object.keys(SES)), nm = pick(names); const start = slotAfter(now + (1.2 + i * 2.1) * DAY); orders[id] = { id, session: sid, start, name: nm, email: nm.toLowerCase().replace(/[^a-z]/g, '.') + '@example.com', lang: 'en', amount: SES[sid][1], status: 'paid', createdAt: now - (i + 1) * 3 * 3600e3, paidAt: now - (i + 1) * 3 * 3600e3 + 5 * 60e3, sid: 'SF' + hex(4).toUpperCase(), payType: 'EDAHAB', meet: mockMeet }; }
store.save('orders');

const subs = store.load('subscribers', []); subs.length = 0;
for (let i = 0; i < 148; i++) { const age = Math.pow(rnd(), 0.75) * 120; subs.push({ id: hex(6), email: 'reader' + (100 + i) + '@example.com', lang: rnd() < .4 ? 'so' : 'en', createdAt: now - age * DAY, source: pick(['website', 'website', 'website', 'about']), token: hex(12), unsubscribed: rnd() < .04 }); }
store.save('subscribers');

const msgs = store.load('messages', []); msgs.length = 0;
const texts = [['partner', 'Hi Yuyu, we would love to collaborate on a product review for our new smartphone line. Can we set up a call?'], ['events', 'We are organising a tech summit in Hargeisa in March and would like you to give a keynote.'], ['work', 'Can you help our small business set up a content plan for TikTok and Facebook?'], ['partner', 'Interested in sponsoring your next video series. What are your rates?'], ['other', 'Great video on phone security! One question about two-factor authentication…'], ['work', 'We need training for our team of 12 on digital safety.'], ['events', 'Invitation to speak at a university digital skills day.'], ['partner', 'Sending our media kit — hope we can work together.'], ['other', 'Thank you for the AI tutorials, very helpful.']];
texts.forEach(([type, message], i) => { const nm = pick(names); msgs.push({ id: hex(6), name: nm, email: nm.toLowerCase().replace(/[^a-z]/g, '.') + '@example.com', type, message, lang: 'en', createdAt: now - (i * 1.7 + rnd()) * DAY, read: i > 2 }); });
store.save('messages');

const an = store.load('analytics', { days: {} }); an.days = {};
for (let i = 89; i >= 0; i--) {
  const t = now - i * DAY, dow = new Date(t + EAT).getUTCDay(), growth = 1 + (90 - i) / 90 * .8, base = (dow === 5 || dow === 6 ? 150 : 230) * growth * (0.8 + rnd() * .5) * (rnd() < .06 ? 2.4 : 1);
  const pv = Math.round(base), uv = Math.round(pv * (.55 + rnd() * .12));
  const split = (obj, total) => { const o = {}; let left = total; const ks = Object.keys(obj); ks.forEach((k, j) => { const v = j === ks.length - 1 ? left : Math.round(total * obj[k] * (.85 + rnd() * .3)); o[k] = Math.max(0, Math.min(left, v)); left -= o[k]; }); return o; };
  an.days[dayKey(t)] = { pv, vis: Array.from({ length: uv }, () => hex(6)), pages: split({ Home: .55, Consulting: .2, About: .17, Other: .08 }, pv), refs: split({ Direct: .38, 'youtube.com': .26, 'facebook.com': .14, 'instagram.com': .1, 'tiktok.com': .07, 'google.com': .05 }, pv), langs: split({ en: .62, so: .38 }, pv), dev: split({ mobile: .66, desktop: .28, tablet: .06 }, pv), ev: { book_click: Math.round(pv * .04), newsletter: Math.round(pv * .015) } };
}
store.save('analytics');

const act = store.load('activity', []); act.length = 0;
const paid = Object.values(orders).filter(o => o.status === 'paid').sort((a, b) => b.paidAt - a.paidAt).slice(0, 6);
paid.forEach(o => act.push({ t: o.paidAt, type: 'booking', text: `Paid booking: ${o.session} — ${o.name} ($${o.amount})` }));
act.push({ t: now - 3600e3 * 5, type: 'subscriber', text: 'New subscriber: reader101@example.com' }, { t: now - 3600e3 * 9, type: 'message', text: 'Message from Hodan Ali' });
act.sort((a, b) => b.t - a.t); store.save('activity');
store.flushAll(); console.log('Demo data written to', store.DIR);
