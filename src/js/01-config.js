/* Eng Yuyu | site behaviour. No dependencies. */
(() => {
'use strict';

/* =====================================================================
   CONFIG: edit this block. Everything marked SAMPLE is placeholder data.
   ===================================================================== */
const CONFIG = {
  whatsapp: '',                                // e.g. '252612345678' (or set it in Dashboard → Settings)
  introVideo: '',                              // YouTube link/ID of the intro clip (or set it in Dashboard → Settings)
  email: 'contact@engyuyu.com',               // from engyuyu.com/en/contact
  // Live counts: point this to a JSON endpoint you control that returns
  // { youtube, facebook, tiktok, instagram, views } (numbers). Social APIs
  // need private keys, so call them from a small server/worker, not the browser.
  statsEndpoint: '',                           // e.g. 'https://stats.engyuyu.com/counts.json'
  pollMs: 60000,
  // Booking (Cal.com). Create a free account at cal.com, connect Google Calendar (and Outlook / iCloud if you like),
  // set "Google Meet" as the location, create three event types with the slugs below, then put your username here.
  // See BOOKING-SETUP.md for the 10-minute checklist.
  // Cal.com account exists (cal.com/engyuyu) but only has the default 15/30-min events. Flip `enabled` to true once its
  // availability matches the rules below and the three event types exist (see BOOKING-SETUP.md).
  cal: { enabled: false, username: 'engyuyu', origin: 'https://app.cal.com' },
  // Booking rules shown to visitors and enforced by the built-in scheduler.
  availability: { days: [0, 2, 3], start: 14, end: 20, step: 30, tz: 3, tzName: 'Mogadishu (UTC+3)', tzId: 'Africa/Mogadishu', minNoticeHours: 24, horizonDays: 42 },   // Sun, Tue, Wed · 14:00–20:00
  // Booking API (server/server.js): reads your Google Calendar busy times, blocks taken slots, creates the event with a
  // Google Meet link and emails the client the invite. Put its public URL here once deployed (see BOOKING-SETUP.md).
  api: '',                                     // e.g. 'https://book.engyuyu.com'  (dev: add ?api=http://localhost:8787 to the page URL)
  requestEndpoint: '',                         // optional: a form endpoint (Formspree etc.) that receives booking requests; otherwise opens email
  currency: '$',
  newsletterEndpoint: '',                      // e.g. a Mailchimp/ConvertKit/Formspree POST URL
  sample: { youtube: 420000, facebook: 380000, tiktok: 150000, instagram: 110000, views: 120000000 }, // SAMPLE
};

const SESSIONS = [  // Edit names, wording and prices in Dashboard → Settings → Sessions (these are the starting values).
  { id: 'quick', slug: 'quick', min: 30, price: 10, payUrl: '',
    en: ['Quick Session', ''], so: ['Kulan Degdeg ah', ''],
    inc: { en: ['One main question or issue', 'Quick diagnosis and guidance', 'Clear next steps'], so: ['Hal su’aal ama dhibaato oo ugu muhiimsan', 'Baaris degdeg ah iyo hage', 'Tallaabooyin xiga oo cad'] } },
  { id: 'focus', slug: 'focus', min: 45, price: 12, payUrl: '',
    en: ['Focus Session', ''], so: ['Kulan Diiradaysan', ''],
    inc: { en: ['One or more related questions', 'Deeper discussion and troubleshooting', 'Practical recommendations'], so: ['Hal su’aal ama dhowr su’aalood oo isku xiga', 'Wada hadal qoto dheer iyo xallinta dhibaatada', 'Talooyin la dhaqmi karo'] } },
  { id: 'full', slug: 'full', min: 60, price: 15, payUrl: '',
    en: ['Full Session', ''], so: ['Kulan Buuxa', ''],
    inc: { en: ['Multiple questions or a complex issue', 'Detailed discussion and guidance', 'Personalized action plan'], so: ['Su’aalo badan ama dhibaato adag', 'Wada hadal faahfaahsan iyo hage', 'Qorshe shaqo oo adiga kuu gaar ah'] } },
];
const PARTNERS = [{ name: 'Taran', logo: '/assets/partners/taran.svg', logoDark: '/assets/partners/taran-dark.svg', dark: 'custom' }, { name: 'Keshflip', logo: '/assets/partners/keshflip.svg', logoDark: '/assets/partners/keshflip-dark.svg', dark: 'custom' }, { name: 'Amka', logo: '/assets/partners/amka.svg', logoDark: '/assets/partners/amka-dark.svg', dark: 'custom' }, { name: 'Sanguuni', logo: '/assets/partners/sanguuni.svg', logoDark: '/assets/partners/sanguuni-dark.svg', dark: 'custom' }]; // DEMO logos (made-up marks). Replace in Dashboard → Content → Partners, or here with your partners' real logo files.

const COMMUNITY = [
  { icon: 'play',   name: 'YouTube',   en: 'New videos every week',      so: 'Muuqaallo cusub toddobaad kasta', href: 'https://www.youtube.com/@engyuyu' },
  { icon: 'chat',   name: 'Telegram',  en: 'Daily tech drops & chat',    so: 'Wararka tiknolojiyada & sheeko', href: '#' },
  { icon: 'users',  name: 'Facebook',  en: 'Join the discussion group',  so: 'Ku biir kooxda wada-hadalka',     href: 'https://www.facebook.com/share/1LymomoL4L/' },
];

