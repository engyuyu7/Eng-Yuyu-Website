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

/* =====================================================================
   i18n
   ===================================================================== */
const I18N = {
  en: {
    skip: 'Skip to content', menu: 'Menu', home: 'Eng Yuyu | Home',
    'nav.consulting': 'Consulting', 'nav.events': 'Events & Media', 'nav.blog': 'Tech Blog', 'nav.community': 'Community', 'nav.about': 'About',
    'cta.work': 'Work With Me', 'cta.book': 'Book a consultation',
    'search.open': 'Search', 'search.ph': 'Search posts, services, events…', 'search.none': 'No results for', 'search.hint': 'Start typing to search',
    'lang.switch': 'Switch language', 'theme.toggle': 'Toggle light and dark mode',
    'hero.eyebrow': 'Somali tech creator · Consultant · Educator',
    'hero.t1': 'Technology.', 'hero.t2': 'Content.', 'hero.t3': 'Digital Growth.',
    'hero.lead': 'I help brands, creators and institutions across the Somali-speaking world turn technology into stories people trust, and stories into measurable growth.',
    'hero.read': 'Read the Tech Blog', 'hero.f1': '1M+ community', 'hero.f2': 'Tech education', 'hero.f3': 'Digital growth',
    'stats.followers': 'Total followers', 'stats.views': 'Total views',
    'aud.kicker': 'Audience', 'aud.title': 'One community, four platforms.', 'aud.live': 'Live follower counts',
    'aud.updating': 'updating…', 'aud.subs': 'subscribers', 'aud.fol': 'followers', 'aud.sample': 'sample data', 'aud.updated': 'updated',
    'par.title': 'Trusted Brand Partners',
    'pil.kicker': 'What I do', 'pil.title': 'Three ways we can build together.', 'more': 'Explore',
    'pil.c': 'One-to-one sessions: tech help, buying advice, creator and business growth, and account safety.',
    'pil.e': 'Conferences, workshops, interviews and productions that put technology on the main stage.',
    'pil.b': 'Clear, practical writing on AI, gadgets, software and the digital economy, in English and Somali.',
    'con.title': '1:1 Digital Consulting',
    'con.lead': 'Personal guidance for your technology, digital and online challenges.',
    'con.p1': 'Discover', 'con.p1d': 'Audience, goals, current channels',
    'con.p2': 'Design', 'con.p2d': 'Strategy, content pillars, roadmap',
    'con.p3': 'Deliver', 'con.p3d': 'Production, publishing, training',
    'con.p4': 'Grow', 'con.p4d': 'Measure, iterate, scale',
    'ev.title': 'On stage, on camera, on air.', 'ev.invite': 'Invite me to speak',
    'blog.title': 'Technology, explained properly.', 'blog.all': 'All', 'blog.min': 'min read', 'blog.none': 'No posts in this category yet.',
    'com.title': 'Learn in public. Grow together.',
    'com.lead': 'Join a growing community of Somali developers, creators and curious minds. Weekly tech drops, free learning resources and honest conversations.',
    'com.p1': 'Weekly tech and creator tips', 'com.p2': 'Free tutorials and live Q&A sessions', 'com.p3': 'Opportunities, collaborations and meetups',
    'ab.title': 'An engineer who learned to tell stories.',
    'ab.v1': 'Clarity', 'ab.v1d': 'Complex ideas, plainly told.', 'ab.v2': 'Trust', 'ab.v2d': 'Honest reviews and partnerships.', 'ab.v3': 'Impact', 'ab.v3d': 'Content that drives real growth.',
    'nl.kicker': 'Tech Newsletter', 'nl.title': 'The week in tech, in your inbox.',
    'nl.lead': 'Technology updates, new videos and fresh blog releases, one concise email, no spam.',
    'nl.label': 'Email address', 'nl.btn': 'Subscribe', 'nl.bad': 'Please enter a valid email address.', 'nl.ok': 'Thanks! Check your inbox to confirm.', 'nl.mail': 'Opening your email app to confirm your subscription…', 'nl.err': 'Something went wrong. Please try again.',
    'ct.title': "Let's build something people remember.",
    'ct.lead': 'Tell me about your project, consulting, a speaking invite, a media collaboration or a partnership. I read every message.',
    'ct.name': 'Name', 'ct.email': 'Email', 'ct.type': "I'm interested in", 'ct.partner': 'Brand partnership', 'ct.work': 'Collaboration / Work with me', 'ct.other': 'Something else', 'ct.msg': 'Message', 'ct.send': 'Send message',
    'ct.eName': 'Please tell me your name.', 'ct.eEmail': 'Enter a valid email so I can reply.', 'ct.eMsg': 'Please add a short message.', 'ct.ok': 'Opening your email app with your message ready to send…',
    'foot.tag': 'Technology. Content. Digital Growth.', 'foot.privacy': 'Privacy Policy', 'foot.terms': 'Terms of Use', 'legal.privacy.t': 'Privacy Policy', 'legal.terms.t': 'Terms of Use', 'legal.updated': 'Last updated', 'legal.note': 'The English text is the official version. A Somali translation is being prepared; if you need help understanding anything here, email contact@engyuyu.com.', 'wa.chat': 'Chat on WhatsApp', 'wa.hi': 'Hello Eng Yuyu, I would like to ask about a session.', 'wa.prefer': 'Prefer WhatsApp? Message me directly.', 'intro.k': 'Start here', 'intro.t': 'Who I am and how a session works', 'intro.p': 'A one-minute introduction, so you know who you are booking with.', 'intro.b1': 'Who I am: Eng Yuyu, a Somali tech educator with a community of 1M+ followers.', 'intro.b2': 'How it works: choose a session, pick a time, pay online, and get your Google Meet link by email.', 'intro.b3': 'What you get: clear advice and next steps you can follow yourself.', 'intro.watch': 'Watch the intro', 'intro.play': 'Play the intro video', 'intro.btn': 'Watch: how a session works', 'intro.close': 'Close video', 'sl.pause': 'Pause automatic scrolling', 'sl.play': 'Play automatic scrolling', 'ad.sponsored': 'Sponsored', 'ad.partners': 'Our partners', 'ad.cta': 'Learn more', 'ad.prev': 'Previous ad', 'ad.next': 'Next ad', 'ad.pause': 'Pause ads', 'ad.play': 'Play ads', 'ad.mute': 'Mute sound', 'ad.unmute': 'Turn sound on', 'ad.sent': 'Sent', 'ad.yours': 'Your ad here', 'ad.reach': 'Somali-speaking audience', 'ad.yoursText': 'Reach a Somali-speaking audience of 1M+ with a 15-second vertical ad on the blog and events pages.', 'ad.yoursCta': 'Advertise with me', 'ad.advertise': 'Advertise here', 'pay.testNote': 'Test mode: payments here are simulated and no real money is taken.', 'pay.sandboxNote': 'Sandbox mode: use Sifalo test cards and wallets only; no real money is taken.', 'cs.change': 'Change', 'cs.n.wait.b': 'Please wait…', 'cs.n.wait': 'Preparing your secure payment page, this can take up to a minute. Please keep this page open.', 'cs.n.wait2': 'Booking your session…', 'cs.n.e429': 'Too many booking attempts from this device. Please wait a few minutes and try again.', 'cs.n.e502': 'The payment service didn’t respond. Your time is not booked, please press the button again in a moment.', 'cs.n.eNet': 'Couldn’t connect. Check your internet connection and try again.', 'wa.pop.label': 'Chat with Eng Yuyu', 'wa.pop.close': 'Close chat', 'wa.pop.book': 'Book a session online', 'wa.pop.bookWa': 'Book on WhatsApp', 'wa.pop.ask': 'Ask a question', 'wa.anySession': 'a 1:1 session', 'wa.def.greeting': 'Hi, I’m Eng Yuyu. Need help with tech, social media or growing online? Book a 1:1 session, or message me here and I’ll help you choose.', 'wa.def.reply': 'Usually replies within a few hours', 'wa.def.book': 'Hello Eng Yuyu, I’d like to book {session} {price}. Can you help me choose a time?', 'wa.def.ask': 'Hello Eng Yuyu, I have a question:', 'foot.rights': 'All rights reserved.', 'foot.sub': 'Dunida Tiknolojiyadda',
    'ab.dummy': '',
    "cs.t1": "Live availability",
    "cs.t2": "Google Meet link included",
    "cs.t3": "Calendar invite instantly",
    "cs.card.k": "Session formats",
    "cs.card.cta": "Choose a time",
    "cs.sv.k": "Services",
    "cs.sv.t": "Four services, five sessions.",
    "cs.book.k": "Book a session",
    "cs.book.t": "Choose the session that works best for you.",
    "cs.book.lead": "Live availability from my calendar. You'll get an email with a calendar invite and a Google Meet link.",
    "cs.step1": "Choose a session",
    "cs.topics.t": "Topics you can bring", "cs.topics.p": "Bring your problem, question or idea. Let’s figure it out together.",
    "cs.tp1": "Technical Issues", "cs.tp2": "Platform Issues", "cs.tp3": "Social Media", "cs.tp4": "Content Creation", "cs.tp5": "AI & Digital Tools", "cs.tp6": "Personal Branding", "cs.tp7": "Digital Business", "cs.tp8": "Monetization", "cs.tp9": "Online Presence",
    "cs.bookBtn": "Book {p} Session",
    "cs.step2": "Pick a time",
    "cs.step3": "Your details & payment",
    "cs.meet": "Google Meet",
    "cs.meet.d": "the link is emailed to you right after payment.",
    "cs.free": "Free",
    "cs.min": "min",
    "cs.empty.t": "Booking calendar is almost ready",
    "cs.empty.p": "Live scheduling isn't connected yet. For now, send me your preferred session and times and I'll confirm by email.",
    "cs.empty.btn": "Request a time by email",
    "cs.how.k": "How it works",
    "cs.how.t": "From booking to a clear plan.",
    "cs.h1": "Choose a session",
    "cs.h1d": "Pick the format that fits your goal.",
    "cs.h2": "Pick a time",
    "cs.h2d": "Slots appear in your own time zone.",
    "cs.h3": "Get your invite",
    "cs.h3d": "Google Meet link and calendar file by email.",
    "cs.h4": "Meet and plan",
    "cs.h4d": "Leave with a clear next step.",
    "cs.cal.k": "Works with your calendar",
    "cs.cal.t": "An invite that fits any calendar.",
    "cs.cal.p": "Your confirmation email includes a calendar file and “Add to calendar” links, so the session lands in your calendar in one click.",
    "cs.cal.g": "Added automatically with a Google Meet link.",
    "cs.cal.m": "Open the .ics file or use “Add to calendar”.",
    "cs.cal.a": "Tap the .ics file on iPhone, iPad or Mac.",
    "cs.faq.k": "FAQ",
    "cs.faq.t": "Before you book.",
    "cs.q1": "What happens after I book?",
    "cs.a1": "You'll get an email confirmation with the Google Meet link and a calendar invite, plus a reminder before the session.",
    "cs.q2": "What if I am late or need to cancel?",
    "cs.a2": "Reply to your confirmation email at least 24 hours before the session to move or cancel it. If you are late, the session still ends at the scheduled time so the next client is not affected.",
    "cs.q3": "Which time zone are the slots in?",
    "cs.a3": "Times are shown in your own time zone automatically.",
    "cs.q4": "What should I prepare?",
    "cs.a4": "A short description of what you want help with, and any links, screenshots, drafts or numbers that relate to it. Never send passwords or codes.",
    "cs.q5": "Are sessions paid?",
    "cs.a5": "Yes. You pay securely online when you book. As soon as the payment is confirmed, your approval email with the Google Meet link arrives automatically.",
    "k.session": "Session",
    "cs.avail": "Available Sunday, Tuesday and Wednesday · 14:00–20:00 Mogadishu time (UTC+3) · booking must be made at least 24 hours ahead.",
    "cs.n.date": "Choose a date",
    "cs.n.time": "Choose a time (Mogadishu time)",
    "cs.n.yours": "Your time",
    "cs.n.none": "No free slots in the coming weeks. Please email me.",
    "cs.n.name": "Your name",
    "cs.n.email": "Email",
    "cs.n.note": "What would you like to cover? (optional)",
    "cs.n.submit": "Request this time",
    "cs.n.eName": "Please tell me your name.",
    "cs.n.eEmail": "Enter a valid email so I can confirm.",
    "cs.n.eSlot": "Please choose a date and time first.",
    "cs.n.sent": "Request sent. I'll confirm by email with your Google Meet link.",
    "cs.n.mail": "Your email app opened with the request. Send it to confirm, then add the time to your calendar:",
    "cs.n.add": "Add to calendar (tentative until confirmed)",
    "cs.n.again": "Choose another time",
    "cs.pay.t": "Secure payment",
    "cs.pay.p": "Your session is confirmed once payment is received.",
    "cs.pay.btn": "Pay {price} now",
    "cs.pay.soon": "Payment link coming soon",
    "cs.n.loading": "Loading free times…",
    "cs.n.taken": "That time was just taken. Please choose another.",
    "cs.n.booked": "You’re booked! A calendar invite with your Google Meet link is on its way to your email.",
    "cs.n.add2": "Add to your calendar",
    "cs.n.meet": "Open Google Meet link",
    "hc.t": "1:1 Digital Consulting",
    "hc.p": "Personal guidance for your technology, digital and online challenges.",
    "hc.more": "See sessions & prices",
    "sl.prev": "Previous",
    "sl.next": "Next",
    "blog.read": "Read article",
    "blog.watch": "Watch the video",
    "ev.sl.k": "Events",
    "ev.sl.t": "Highlights from the stage and the room",
    "ev.sl.lead": "Photos and highlights from events, upcoming and past.",
    "ev.read": "Read highlights",
    "ev.photo": "Photo",
    "ev.prev": "Previous event",
    "ev.next": "Next event",
    "ev.close": "Close",
    "ev.p.k": "Events & Media",
    "ev.p.t": "Conferences, talks and panels, and the rooms I attend.",
    "ev.p.lead": "A look at the conferences I speak at, the panels I join and the events I attend. Swipe through the highlights, read the stories, or invite me to your event.",
    "ev.p.cta": "Invite me to speak",
    "ev.p.cta2": "See upcoming events",
    "ev.up.t": "Upcoming events",
    "ev.up.none": "No upcoming events announced yet, invite me to yours below.",
    "ev.past.t": "Past events",
    "ev.media.k": "Media",
    "ev.media.t": "Media & appearances",
    "ev.media.lead": "Watch, listen and read: videos, interviews and features.",
    "ev.channel.t": "Watch on YouTube",
    "ev.channel.p": "Hundreds of educational videos on phones, AI, digital safety and online skills.",
    "ev.reg": "Register / details",
    "ev.details": "Details",
    "ev.cal": "Calendar",
    "ev.tba": "Venue to be announced",
    "ev.in": "in {n} days",
    "ev.today": "Today",
    "ev.topics.k": "Speaking",
    "ev.topics.t": "What I speak about",
    "ev.topics.lead": "Plain-language talks and hands-on workshops for communities, schools, teams and conferences.",
    "ev.tp1": "Smartphone tips",
    "ev.tp1d": "Practical iPhone and Android tips anyone can use.",
    "ev.tp2": "Digital security & privacy",
    "ev.tp2d": "Awareness and habits to protect accounts, data and online life.",
    "ev.tp3": "AI, explained",
    "ev.tp3d": "Artificial intelligence in accessible terms, without the jargon.",
    "ev.tp4": "Content creation & digital skills",
    "ev.tp4d": "The skills to create, publish and grow online.",
    "ev.tp5": "Ideas into opportunities",
    "ev.tp5d": "Turning curiosity and ideas into real digital opportunities.",
    "ev.fm.t": "Formats",
    "ev.fm1": "Keynote or tech talk",
    "ev.fm2": "Workshop",
    "ev.fm3": "Interview or panel",
    "ev.fm4": "Podcast or show",
    "ev.fm5": "Community event",
    "ev.inv.k": "Invite me",
    "ev.inv.t": "Invite me to speak",
    "ev.inv.lead": "Tell me about your event. I usually reply within 24–48 hours.",
    "ev.inv.org": "Organisation (optional)",
    "ev.inv.type": "What are you planning?",
    "ev.inv.date": "Date (optional)",
    "ev.inv.place": "Place or “Online” (optional)",
    "ev.inv.size": "Expected audience (optional)",
    "ev.inv.note": "About your event",
    "ev.inv.btn": "Send invitation",
    "ev.inv.eMsg": "Please tell me a little about your event.",
    "ev.inv.sent": "Invitation sent. Thank you! I will reply within 24–48 hours.",
    "ev.t1": "Keynote / tech talk",
    "ev.t2": "Workshop",
    "ev.t3": "Interview or panel",
    "ev.t4": "Podcast or show",
    "ev.t5": "Community event",
    "ev.t6": "Other",
    "ev.all": "See all events",
    "con.title": "1:1 Digital Consulting",
    "con.lead": "Personal guidance for your technology, digital and online challenges.",
    "pil.c": "One-to-one sessions: tech help, buying advice, creator and business growth, and account safety.",
    "disc.h": "What my sessions are, and are not",
    "disc.lead": "My sessions are advice and guidance only. I explain, review and show you what to do. You, as the owner and user of your devices and accounts, make the changes.",
    "disc.t1": "No physical repairs.",
    "disc.d1": "I can’t fix hardware problems like broken screens, batteries, charging ports or water damage. For those, please visit a repair shop.",
    "disc.t2": "No account recovery.",
    "disc.d2": "I can’t get back banned, suspended, hacked, locked or deleted accounts. I am not the account owner and I am not the platform, so decisions about accounts belong to the platform. I can explain the platform’s official steps for appeals and recovery, and help you prevent it happening again.",
    "disc.t3": "No access to your accounts.",
    "disc.d3": "I will never ask for your passwords or verification codes. Please never share them with anyone.",
    "disc.t4": "No guaranteed results.",
    "disc.d4": "Income, followers, sales and growth depend on many things outside my control.",
    "disc.t5": "Buying advice is independent.",
    "disc.d5": "I don’t sell devices. Prices and availability change, and the final purchase decision is yours.",
    "disc.short": "Advice and guidance only. I can’t repair physical devices or recover banned, locked or lost accounts. I’m not the account owner or the platform.",
    "disc.agree": "I understand these sessions are advice only.",
    "disc.agreeErr": "Please tick the box to continue.",
    "cs.fq12": "Can you recover my banned account?",
    "cs.fa12": "No, I’m not the account owner or the platform, so I can’t get back banned, suspended, hacked, locked or deleted accounts. I can explain the platform’s official steps for appeals and recovery. And I can help you secure your other accounts so it doesn’t happen again.",
    "cs.fq13": "Can you repair my phone or laptop?",
    "cs.fa13": "No. My sessions are advice and guidance only. For broken screens, batteries, charging ports or water damage, please visit a repair shop. If it’s a software, app or settings problem, a session can help.",
    "cs.fq14": "Will I definitely earn more or get more customers?",
    "cs.fa14": "I can’t promise results. Income, followers and sales depend on many things outside my control. What I can give you is clear, honest advice and a practical plan to follow.",
    "cs.guides": "Guides:",
    "cs.included": "What is included",
    "cs.about.k": "About me",
    "cs.about.t": "Meet Eng Yuyu",
    "cs.about.p1": "I’m Yusuf Mohamed, known as Eng Yuyu, a Somali tech educator and digital media creator. I’ve built a community of more than a million followers by explaining technology clearly and honestly.",
    "cs.about.p2": "I’ve published hundreds of educational videos, taken part in live events and programs that reached millions, and worked with brands on education-led campaigns. When you book, you work directly with me.",
    "cs.about.btn": "Read my full story",
    "cs.proof.k": "My work",
    "cs.proof.t": "Proof, not promises.",
    "cs.proof.lead": "These are my own projects and results. Client results and reviews will be added here as they come in.",
    "cs.testi.t": "What clients say",
    "cs.pay.methods": "Pay online with mobile money (EVC Plus/ZAAD, eDahab, Premier Wallet) or card.",
    "cs.fq6": "How do sessions happen?",
    "cs.fa6": "Online on Google Meet. You get the link by email as soon as your booking is approved, and it works on a phone or a computer, no account needed.",
    "cs.fq7": "How do I pay?",
    "cs.fa7": "Online, during booking: mobile money (EVC Plus/ZAAD, eDahab, Premier Wallet) or card. Your booking is approved the moment payment is confirmed.",
    "cs.fq15": "Which session should I choose?", "cs.fa15": "Quick (30 min) is for one main question. Focus (45 min) suits a few related questions or some troubleshooting. Full (60 min) is best for a complex issue, or when you want a personal action plan.",
    "cs.fq16": "What if I need more time?", "cs.fa16": "Each session ends at its scheduled time. If there is more to cover, you can book another session, choose the Full Session if you already know your issue is complex.",
    "cs.fq11": "Can brands and organisations book?",
    "cs.fa11": "Yes. Book any session and tell me about your project in the notes. For partnerships or sponsored content, use the “Work With Me” form on the home page.",
    "cs.nl.t": "New guides and videos, straight to your inbox",
    "cs.nl.p": "Practical tech tips, AI updates and digital-safety guides, one concise email, no spam. It is also the best way to follow my work without depending on social media.",
    "blog.all.btn": "View all articles",
    "nl.done": "You’re subscribed! Check your inbox for a welcome email.",
    "ct.sent": "Message sent. Thank you! I usually reply within 24–48 hours.",
    "cs.n.pay": "Continue to payment · {price}",
    "cs.n.redirect": "Redirecting to secure payment…",
    "cs.pay.auto": "Pay securely online (EVC Plus/ZAAD, eDahab, Premier Wallet or card). Your time is held for 20 minutes. As soon as the payment is confirmed, your Google Meet link and booking approval are emailed to you automatically.",
    "cs.ps.verifying": "Verifying your payment…",
    "cs.ps.pending": "Waiting for the payment to be confirmed, this can take up to a minute.",
    "cs.ps.ok.t": "Payment received: booking approved",
    "cs.ps.ok.p": "We emailed your approval, the Google Meet link and a calendar file. Check your inbox (and spam folder).",
    "cs.ps.failed.t": "Payment not completed",
    "cs.ps.failed.p": "The payment did not go through, so the booking was not approved and no money was taken. You can choose a time and try again.", "cs.ps.left.t": "Payment not finished", "cs.ps.left.p": "You left the checkout before paying, so the booking was not approved. Choose a time again whenever you are ready.", "cs.ps.wait.t": "Waiting for your payment to be confirmed", "cs.ps.wait.p": "This is taking longer than usual. You can close this page, as soon as the payment is confirmed your booking is approved and the Meet link is emailed to you. Didn’t pay? Choose a time again.",
    "cs.ps.conflict.t": "Payment received: we need to reschedule",
    "cs.ps.conflict.p": "Your chosen time was taken at the same moment. I will email you to reschedule or refund.",
    "cs.ps.err.t": "We could not verify your payment",
    "cs.ps.err.p": "If you were charged, please email us with your reference number.",
    "cs.ps.retry": "Choose a time again",
    "cs.ps.ref": "Reference",
    "crumb.home": "Home",
    "ab.more": "Read my full story",
    "ab.p1": "I'm Yusuf Mohamed, also known as Eng Yuyu. I'm a Somali tech educator, content creator and digital awareness advocate. I explain technology clearly so people can use it with confidence.",
    "ab.p2": "My work sits where technology, media and education meet: smartphone tips, digital security, AI made simple and practical digital skills, for a community of more than a million followers.",
    "ap.aka": "Known as Eng Yuyu",
    "ap.h1": "Yusuf Mohamed",
    "ap.lead": "Tech educator turned digital media consultant. I build trust with a 1M+ audience and put it to work for the brands and people I partner with.",
    "ap.r1": "Tech Educator",
    "ap.r2": "Content Creator",
    "ap.r3": "Digital Awareness Advocate",
    "ap.f1": "followers across 5 platforms",
    "ap.f2n": "Hundreds",
    "ap.f2": "of educational videos, built to last",
    "ap.f3n": "Millions",
    "ap.f3": "reached through live events and programs",
    "ap.f4": "brand partners",
    "ap.mi.k": "Mission & mindset",
    "ap.mi.q": "To help people use technology with confidence, protect their digital lives, and benefit from innovation instead of being overwhelmed by it.",
    "ap.why.k": "Spotting the gap",
    "ap.why.t": "I saw an audience the tech world wasn’t serving.",
    "ap.why.p1": "Millions of people use phones and the internet every day, yet many don’t understand how the technology works, or how to protect themselves online. That is a real need, and nobody was meeting it well.",
    "ap.why.p2": "The gap was widest in the Somali community and among broader digital audiences. So I started explaining technology clearly and practically, in a way anyone can act on.",
    "ap.why.p3": "Trust was the result: more than a million followers, hundreds of educational videos, and live events and programs reaching millions. That trust is what brands partner with me for.",
    "ap.cov.k": "Where I create value",
    "ap.cov.t": "Five areas where education drives results.",
    "ap.c1": "Smartphone tips",
    "ap.c1d": "Practical iPhone and Android tips anyone can use.",
    "ap.c2": "Digital security & privacy",
    "ap.c2d": "Awareness and habits to protect your accounts, data and online life.",
    "ap.c3": "AI, explained",
    "ap.c3d": "Artificial intelligence in accessible terms, without the jargon.",
    "ap.c4": "Content creation & digital skills",
    "ap.c4d": "The skills to create, publish and grow online.",
    "ap.c5": "Ideas into opportunities",
    "ap.c5d": "Turning curiosity and ideas into real digital opportunities.",
    "ap.how.k": "How I teach",
    "ap.how.t": "Many formats. One goal: understanding.",
    "ap.fm1": "Short videos",
    "ap.fm2": "Tutorials",
    "ap.fm3": "Tech talks",
    "ap.fm4": "Workshops",
    "ap.fm5": "Community events",
    "ap.bey.k": "Beyond content",
    "ap.bey.t": "Partnerships built on education and impact.",
    "ap.bey.p": "I work with brands whose products and values align with education and positive digital impact, through collaborations, talks, workshops, programs and community events.",
    "ap.par.k": "Brand partners",
    "ap.find.k": "Find me online",
    "ap.find.t": "Follow along where you like to learn.",
    "ap.nl": "Practical tech insights, AI updates and digital safety guides, one concise email, no spam.",
    "ap.cta.t": "Want to work together?",
    "ap.cta.p": "Brand collaborations, product reviews, media and interviews, event invitations or tech questions. I usually reply within 24–48 hours.",
    'k.page': 'Section', 'k.post': 'Post', 'k.service': 'Service', 'k.event': 'Event',
  },
  so: {
    skip: 'U gudub nuxurka', menu: 'Menu', home: 'Eng Yuyu | Bogga hore',
    'nav.consulting': 'La-talin', 'nav.events': 'Dhacdooyin & Warbaahin', 'nav.blog': 'Blog-ka Tiknolojiyada', 'nav.community': 'Bulshada', 'nav.about': 'Ku saabsan',
    'cta.work': 'Ila Shaqee', 'cta.book': 'Ballan la-talin ah qabso',
    'search.open': 'Raadi', 'search.ph': 'Raadi maqaallo, adeegyo, dhacdooyin…', 'search.none': 'Wax natiijo ah lagama helin', 'search.hint': 'Bilow qorista si aad u raadiso',
    'lang.switch': 'Beddel luuqadda', 'theme.toggle': 'Beddel mugdi iyo iftiin',
    'hero.eyebrow': 'Abuure tiknolojiyo Soomaaliyeed · La-taliye · Macallin',
    'hero.t1': 'Tiknolojiyo.', 'hero.t2': 'Nuxur.', 'hero.t3': 'Koboc Dijitaal.',
    'hero.lead': 'Waxaan ka caawiyaa shirkadaha, abuureyaasha iyo hay’adaha adduunka Soomaaliga inay tiknolojiyada u beddelaan sheekooyin la aamino, sheekooyinkuna koboc la cabbiri karo.',
    'hero.read': 'Akhri Blog-ka', 'hero.f1': 'Bulsho 1M+', 'hero.f2': 'Waxbarasho tiknolojiyo', 'hero.f3': 'Koboc dijitaal',
    'stats.followers': 'Wadarta raacayaasha', 'stats.views': 'Wadarta daawashada',
    'aud.kicker': 'Daawadayaasha', 'aud.title': 'Hal bulsho, afar madal.', 'aud.live': 'Tirada raacayaasha tooska ah',
    'aud.updating': 'waa la cusboonaysiinayaa…', 'aud.subs': 'rukumeyaal', 'aud.fol': 'raacayaal', 'aud.sample': 'xog tusaale ah', 'aud.updated': 'la cusboonaysiiyay',
    'par.title': 'Lammaanayaasha Aaminka ah',
    'pil.kicker': 'Waxa aan qabto', 'pil.title': 'Saddex siyood oo aan wax ku wada dhisi karno.', 'more': 'Sahami',
    'pil.c': 'Kulamo kal-ka-kal ah: caawinta tiknolojiyada, talada iibsashada, kobcinta abuureyaasha iyo ganacsiga, iyo badbaadada akoonka.',
    'pil.e': 'Shirar, aqoon-isweydaarsiyo, wareysiyo iyo soosaaro tiknolojiyada madasha ugu horreysa keena.',
    'pil.b': 'Qoraallo cad oo wax ku ool ah oo ku saabsan AI, aaladaha, software-ka iyo dhaqaalaha dijitaalka. Ingiriisi iyo Soomaali.',
    'con.title': 'La-talin Dijitaal 1:1',
    'con.lead': 'Hage shakhsi ah oo kuu gaar ah oo ku saabsan dhibaatooyinkaaga tiknolojiyada, dijitaalka iyo online-ka.',
    'con.p1': 'Ogaansho', 'con.p1d': 'Daawadayaasha, yoolalka, kanaallada hadda jira',
    'con.p2': 'Naqshadayn', 'con.p2d': 'Istaraatiijiyad, tiir nuxureed, khariidad',
    'con.p3': 'Gudbin', 'con.p3d': 'Soosaar, daabacaad, tababar',
    'con.p4': 'Koboc', 'con.p4d': 'Cabbir, hagaajin, balaadhin',
    'ev.title': 'Madasha, kamarada, hawada.', 'ev.invite': 'I casuun inaan hadlo',
    'blog.title': 'Tiknolojiyada, si sax ah loo sharaxay.', 'blog.all': 'Dhammaan', 'blog.min': 'daqiiqo akhris', 'blog.none': 'Wali maqaal ma jiro qaybtan.',
    'com.title': 'Ku baro Si Furan. Wada Koba.',
    'com.lead': 'Ku biir bulsho koraysa oo ka kooban horumariyeyaal, abuureyaal iyo maskaxo xiiseysa oo Soomaali ah. Tilmaamo toddobaadle ah, ilo waxbarasho oo bilaash ah iyo wadahadallo daacad ah.',
    'com.p1': 'Talooyin toddobaadle ah oo tiknolojiyo iyo abuurid', 'com.p2': 'Casharro bilaash ah iyo su’aal-jawaab toos ah', 'com.p3': 'Fursado, wada-shaqayn iyo kulamo',
    'ab.title': 'Injineer bartay inuu sheekeeyo.',
    'ab.v1': 'Cadnaan', 'ab.v1d': 'Fikrado adag, si fudud loo sheego.', 'ab.v2': 'Aamin', 'ab.v2d': 'Dib-u-eegisyo iyo wada-shaqayn daacad ah.', 'ab.v3': 'Saamayn', 'ab.v3d': 'Nuxur keena koboc dhab ah.',
    'nl.kicker': 'Wargeyska Tiknolojiyada', 'nl.title': 'Toddobaadka tiknolojiyada, sanduuqaaga ku jira.',
    'nl.lead': 'Wararka tiknolojiyada, muuqaallo cusub iyo maqaallo cusub, hal email oo kooban, spam la’aan.',
    'nl.label': 'Cinwaanka email-ka', 'nl.btn': 'Isdiiwaangeli', 'nl.bad': 'Fadlan geli email sax ah.', 'nl.ok': 'Mahadsanid! Sanduuqaaga fiiri si aad u xaqiijiso.', 'nl.mail': 'Waxaan furayaa app-kaaga email-ka si aad u xaqiijiso…', 'nl.err': 'Wax khalad ah ayaa dhacay. Fadlan mar kale isku day.',
    'ct.title': 'Aan wada dhisno wax dadku xasuusto.',
    'ct.lead': 'Ii sheeg mashruucaaga: la-talin, casuumaad hadal, wada-shaqayn warbaahin ama lammaanaysi. Fariin kasta waan akhriyaa.',
    'ct.name': 'Magac', 'ct.email': 'Email', 'ct.type': 'Waxaan xiiseynayaa', 'ct.partner': 'Lammaanaysi shirkad', 'ct.work': 'Wada-shaqayn / Ila shaqee', 'ct.other': 'Wax kale', 'ct.msg': 'Fariin', 'ct.send': 'Dir fariinta',
    'ct.eName': 'Fadlan i sheeg magacaaga.', 'ct.eEmail': 'Geli email sax ah si aan kuugu jawaabo.', 'ct.eMsg': 'Fadlan ku dar fariin kooban.', 'ct.ok': 'Waxaan furayaa app-kaaga email-ka fariintaadana way diyaar tahay…',
    'foot.tag': 'Tiknolojiyo. Nuxur. Koboc Dijitaal.', 'foot.privacy': 'Qaanuunka Asturnaanta', 'foot.terms': 'Shuruudaha Isticmaalka', 'legal.privacy.t': 'Qaanuunka Asturnaanta', 'legal.terms.t': 'Shuruudaha Isticmaalka', 'legal.updated': 'Markii ugu dambeysay ee la cusboonaysiiyay', 'legal.note': 'Qoraalka Ingiriisiga ayaa ah nuqulka rasmiga ah. Tarjumaad Soomaali ah ayaa la diyaarinayaa; haddii aad u baahan tahay caawimaad si aad u fahanto wax kasta oo halkan ku qoran, iigu soo dir email contact@engyuyu.com.', 'wa.chat': 'Nagala sheekayso WhatsApp', 'wa.hi': 'Salaan Eng Yuyu, waxaan jeclaan lahaa inaan wax ka weydiiyo kulan.', 'wa.prefer': 'WhatsApp ma door bidaysaa? Si toos ah ii soo qor.', 'intro.k': 'Halkan ka bilow', 'intro.t': 'Cidda aan ahay iyo sida kulanku u shaqeeyo', 'intro.p': 'Is-barasho hal daqiiqo ah, si aad u ogaato qofka aad la kulmayso.', 'intro.b1': 'Cidda aan ahay: Eng Yuyu, macallin tiknoolajiyad Soomaali ah oo leh bulsho ka badan 1M oo raacayaal ah.', 'intro.b2': 'Sida ay u shaqayso: dooro kulan, dooro waqti, onlayn bixi, oo email ku hel linkiga Google Meet.', 'intro.b3': 'Waxa aad heli: talo cad iyo tallaabooyin aad adigu raaci karto.', 'intro.watch': 'Daawo is-barashada', 'intro.play': 'Daar muuqaalka is-barashada', 'intro.btn': 'Daawo: sida kulanku u shaqeeyo', 'intro.close': 'Xir muuqaalka', 'sl.pause': 'Jooji dhaqdhaqaaqa toos ah', 'sl.play': 'Bilow dhaqdhaqaaqa toos ah', 'ad.sponsored': 'Xayeysiis', 'ad.partners': 'Lammaanayaasheenna', 'ad.cta': 'Wax dheeraad ah ka ogow', 'ad.prev': 'Xayeysiiskii hore', 'ad.next': 'Xayeysiiska xiga', 'ad.pause': 'Hakii xayeysiisyada', 'ad.play': 'Daar xayeysiisyada', 'ad.mute': 'Aamusii codka', 'ad.unmute': 'Daar codka', 'ad.sent': 'La diray', 'ad.yours': 'Xayeysiiskaaga halkan', 'ad.reach': 'Dhegeystayaal ku hadla Soomaali', 'ad.yoursText': 'Gaar dhegeystayaal ku hadla Soomaali oo ka badan 1M adigoo isticmaalaya xayeysiis toosan oo 15 ilbiriqsi ah oo ku yaal bogagga blog-ka iyo dhacdooyinka.', 'ad.yoursCta': 'Iila xayeeyso', 'ad.advertise': 'Xayeysii halkan', 'pay.testNote': 'Habka tijaabada: lacag bixinta halkan waa tijaabo, lacag dhab ah lagama qaado.', 'pay.sandboxNote': 'Habka sandbox: isticmaal kaararka iyo jeebabka tijaabada ee Sifalo oo keliya; lacag dhab ah lagama qaado.', 'cs.change': 'Beddel', 'cs.n.wait.b': 'Fadlan sug…', 'cs.n.wait': 'Waxaa la diyaarinayaa bogga lacag-bixinta ee ammaan ah, tani waxay qaadan kartaa ilaa hal daqiiqo. Fadlan bogga ha xirin.', 'cs.n.wait2': 'Kulankaaga waa la qabanayaa…', 'cs.n.e429': 'Isku dayo badan ayaa ka yimid qalabkan. Fadlan sug dhowr daqiiqo kadibna isku day.', 'cs.n.e502': 'Adeegga lacag-bixintu ma jawaabin. Waqtigaaga lama qaban: fadlan riix badhanka mar kale daqiiqad kadib.', 'cs.n.eNet': 'Lama xiriiri karo. Hubi internetkaaga oo isku day mar kale.', 'wa.pop.label': 'La sheekayso Eng Yuyu', 'wa.pop.close': 'Xir sheekada', 'wa.pop.book': 'Ballan qabso kulan online ah', 'wa.pop.bookWa': 'Ku ballan qabso WhatsApp', 'wa.pop.ask': 'Weydii su’aal', 'wa.anySession': 'kulan 1:1 ah', 'wa.def.greeting': 'Salaan, waxaan ahay Eng Yuyu. Ma u baahan tahay caawimaad tiknoolajiyad, baraha bulshada ama koboc online? Ballan qabso kulan 1:1, ama halkan iigu soo qor si aan kuu caawiyo inaad doorato.', 'wa.def.reply': 'Badanaa wuu ka jawaabaa dhowr saacadood gudahood', 'wa.def.book': 'Salaan Eng Yuyu, waxaan rabaa inaan ballan qabsado {session} {price}. Ma iga caawin kartaa inaan doorto waqti?', 'wa.def.ask': 'Salaan Eng Yuyu, su’aal ayaan qabaa:', 'foot.rights': 'Dhammaan xuquuqdu way dhowran tahay.', 'foot.sub': 'Dunida Tiknolojiyadda',
    'ab.dummy': '',
    "cs.t1": "Waqtiyada firaaqada tooska ah",
    "cs.t2": "Linkiga Google Meet ayaa ku jira",
    "cs.t3": "Casuumaad kalandar isla markiiba",
    "cs.card.k": "Qaababka kulanka",
    "cs.card.cta": "Dooro waqti",
    "cs.sv.k": "Adeegyada",
    "cs.sv.t": "Afar adeeg, shan kulan.",
    "cs.book.k": "Ballan qabso",
    "cs.book.t": "Dooro kulanka kuu habboon.",
    "cs.book.lead": "Waqtiyada firaaqada ee kalandarkayga tooska ah. Waxaad heli doontaa email casuumaad kalandar iyo link Google Meet ah.",
    "cs.step1": "Dooro kulan",
    "cs.topics.t": "Mawduucyada aad keeni karto", "cs.topics.p": "Keen dhibaatadaada, su’aashaada ama fikradaada. Isla aan xalino.",
    "cs.tp1": "Dhibaatooyin Farsamo", "cs.tp2": "Dhibaatooyin Madal", "cs.tp3": "Baraha Bulshada", "cs.tp4": "Abuurista Nuxurka", "cs.tp5": "AI & Qalabka Dijitaalka", "cs.tp6": "Summadda Shakhsiga", "cs.tp7": "Ganacsi Dijitaal", "cs.tp8": "Lacag Samaynta", "cs.tp9": "Joogitaanka Online",
    "cs.bookBtn": "Ballan qabso Kulanka {p}",
    "cs.step2": "Dooro waqti",
    "cs.step3": "Faahfaahin & lacag bixin",
    "cs.meet": "Google Meet",
    "cs.meet.d": "linkiga waxaa laguu soo diraa email isla marka lacagta la bixiyo.",
    "cs.free": "Bilaash",
    "cs.min": "daq",
    "cs.empty.t": "Kalandarka ballanta wuu dhawaan diyaar yahay",
    "cs.empty.p": "Jadwalka tooska ah wali lama xirin. Hadda, ii soo dir kulanka iyo waqtiyada aad doorbidayso anigana email ayaan kugu xaqiijin doonaa.",
    "cs.empty.btn": "Ku codso waqti email",
    "cs.how.k": "Sida ay u shaqayso",
    "cs.how.t": "Ballanta ilaa qorshe cad.",
    "cs.h1": "Dooro kulan",
    "cs.h1d": "Dooro qaabka u dhigma hadafkaaga.",
    "cs.h2": "Dooro waqti",
    "cs.h2d": "Waqtiyada waxay ka muuqdaan saacadaada degaanka.",
    "cs.h3": "Hel casuumaaddaada",
    "cs.h3d": "Linkiga Google Meet iyo faylka kalandarka email ahaan.",
    "cs.h4": "Kulan oo qorshayn",
    "cs.h4d": "Ka bax adigoo haysta tallaabo xigta oo cad.",
    "cs.cal.k": "Wuxuu la shaqeeyaa kalandarkaaga",
    "cs.cal.t": "Casuumaad ku haboon kalandar kasta.",
    "cs.cal.p": "Email-ka xaqiijinta wuxuu leeyahay fayl kalandar iyo xiriirro “Ku dar kalandarka”, si kulanku hal gujin ugu galo kalandarkaaga.",
    "cs.cal.g": "Si toos ah ayaa loogu daraa oo link Google Meet leh.",
    "cs.cal.m": "Fur faylka .ics ama isticmaal “Ku dar kalandarka”.",
    "cs.cal.a": "Taabo faylka .ics iPhone, iPad ama Mac.",
    "cs.faq.k": "Su’aalaha",
    "cs.faq.t": "Ka hor intaadan ballan qabsan.",
    "cs.q1": "Maxaa dhacaya kadib marka aan ballan qabsado?",
    "cs.a1": "Waxaad heli doontaa email xaqiijin ah oo leh linkiga Google Meet iyo casuumaad kalandar, iyo xasuusin ka hor kulanka.",
    "cs.q2": "Ka ahaw haddii aan daahay ama aan joojinayo?",
    "cs.a2": "Ka jawaab email-ka xaqiijinta ugu yaraan 24 saac ka hor kulanka si aad u dhaqaajiso ama u joojiso. Haddii aad daahdo, kulanku wuxuu weli dhammaanayaa waqtigii loo qabtay si macmiilka xiga aan loo saameynin.",
    "cs.q3": "Waqtiga degaan kee ayaa la muujiyaa?",
    "cs.a3": "Waqtiyada si toos ah ayaa loogu muujiyaa saacadaada degaanka.",
    "cs.q4": "Maxaan diyaarsadaa?",
    "cs.a4": "Sharaxaad kooban oo ku saabsan waxa aad caawimaad ugu baahan tahay, iyo xiriiro kasta, sawirro shaashadeed, qoraallo ama tirooyin la xiriira. Weligaa ha soo dirin erayada sirta ah ama koodhadhka.",
    "cs.q5": "Kulamadu ma lacag bay yihiin?",
    "cs.a5": "Haa. Waxaad ku bixisaa si ammaan ah online marka aad ballan qabsato. Isla marka lacagta la xaqiijiyo, email-ka ansixinta oo leh linkiga Google Meet ayaa si toos ah kuu soo gaadhaya.",
    "k.session": "Kulan",
    "cs.avail": "Waa furan yahay Axad, Talaado iyo Arbaco · 14:00–20:00 saacadda Muqdisho (UTC+3) · ballanta waa in la qabsadaa ugu yaraan 24 saac ka hor.",
    "cs.n.date": "Dooro taariikh",
    "cs.n.time": "Dooro waqti (saacadda Muqdisho)",
    "cs.n.yours": "Waqtigaaga",
    "cs.n.none": "Waqti firaaqo ah toddobaadyada soo socda ma jiro. Fadlan iigu soo dir email.",
    "cs.n.name": "Magacaaga",
    "cs.n.email": "Email",
    "cs.n.note": "Maxaad rabtaa inaan ka wada hadalno? (ikhtiyaari)",
    "cs.n.submit": "Codso waqtigan",
    "cs.n.eName": "Fadlan i sheeg magacaaga.",
    "cs.n.eEmail": "Geli email sax ah si aan kuugu xaqiijiyo.",
    "cs.n.eSlot": "Fadlan marka hore dooro taariikh iyo waqti.",
    "cs.n.sent": "Codsiga waa la diray. Email ayaan kugu xaqiijin doonaa oo link Google Meet ah ayaan kuu soo dirayaa.",
    "cs.n.mail": "App-kaaga email-ka ayaa furmay codsigana wuu ku jiraa. Dir si aad u xaqiijiso, kaddibna waqtiga ku dar kalandarkaaga:",
    "cs.n.add": "Ku dar kalandarka (ku meel gaar ilaa la xaqiijiyo)",
    "cs.n.again": "Dooro waqti kale",
    "cs.pay.t": "Lacag-bixin ammaan ah",
    "cs.pay.p": "Kulankaaga waa la xaqiijinayaa marka lacagta la helo.",
    "cs.pay.btn": "Bixi {price} hadda",
    "cs.pay.soon": "Linkiga lacag-bixinta dhawaan",
    "cs.n.loading": "Waqtiyada firaaqada ah ayaa la soo rarayaa…",
    "cs.n.taken": "Waqtigaas hadda ayaa la qaatay. Fadlan dooro mid kale.",
    "cs.n.booked": "Waa la ballansaday! Casuumaad kalandar oo leh linkiga Google Meet ayaa email-kaaga ku socota.",
    "cs.n.add2": "Ku dar kalandarkaaga",
    "cs.n.meet": "Fur linkiga Google Meet",
    "hc.t": "La-talin Dijitaal 1:1",
    "hc.p": "Hage shakhsi ah oo kuu gaar ah oo ku saabsan dhibaatooyinkaaga tiknolojiyada, dijitaalka iyo online-ka.",
    "hc.more": "Arag kulamada & qiimaha",
    "sl.prev": "Hore",
    "sl.next": "Xiga",
    "blog.read": "Akhri maqaalka",
    "blog.watch": "Daawo muuqaalka",
    "ev.sl.k": "Dhacdooyin",
    "ev.sl.t": "Xusuus ka timid madasha iyo qolka",
    "ev.sl.lead": "Sawirro iyo xusuus dhacdooyin, kuwa soo socda iyo kuwii hore.",
    "ev.read": "Akhri xusuusta",
    "ev.photo": "Sawir",
    "ev.prev": "Dhacdadii hore",
    "ev.next": "Dhacdada xigta",
    "ev.close": "Xir",
    "ev.p.k": "Dhacdooyin & Warbaahin",
    "ev.p.t": "Shirar, hadallo iyo guddiyo, iyo meelaha aan ka qaybgalo.",
    "ev.p.lead": "Fiiro gaar ah shirarka aan ka hadlo, guddiyada aan ka mid ahay iyo dhacdooyinka aan ka qaybgalo. Fiiri xusuusta, akhri sheekooyinka, ama ii casuun dhacdadaada.",
    "ev.p.cta": "I casuun inaan hadlo",
    "ev.p.cta2": "Arag dhacdooyinka soo socda",
    "ev.up.t": "Dhacdooyinka soo socda",
    "ev.up.none": "Wali dhacdo soo socota lama sheegin, hoos ii casuun mid adiga kuu gaar ah.",
    "ev.past.t": "Dhacdooyinkii hore",
    "ev.media.k": "Warbaahin",
    "ev.media.t": "Warbaahin & muuqaallo",
    "ev.media.lead": "Daawo, dhegayso oo akhri: muuqaallo, wareysiyo iyo maqaallo.",
    "ev.channel.t": "Ku daawo YouTube",
    "ev.channel.p": "Boqolaal muuqaal waxbarasho oo ku saabsan taleefannada, AI, badbaadada dijitaalka iyo xirfadaha online-ka.",
    "ev.reg": "Isdiiwaangeli / faahfaahin",
    "ev.details": "Faahfaahin",
    "ev.cal": "Kalandar",
    "ev.tba": "Goobta waa la sheegi doonaa",
    "ev.in": "{n} maalmood kadib",
    "ev.today": "Maanta",
    "ev.topics.k": "Hadallo",
    "ev.topics.t": "Waxa aan ka hadlo",
    "ev.topics.lead": "Hadallo af fudud ah iyo aqoon-isweydaarsiyo wax ku ool ah oo loogu talagalay bulshooyinka, dugsiyada, kooxaha iyo shirarka.",
    "ev.tp1": "Talooyin taleefan",
    "ev.tp1d": "Talooyin iPhone iyo Android oo wax ku ool ah oo qof kasta isticmaali karo.",
    "ev.tp2": "Amniga & asturnaanta dijitaalka",
    "ev.tp2d": "Ogaansho iyo caadooyin lagu ilaaliyo akoonnada, xogta iyo noloshaada online-ka.",
    "ev.tp3": "AI, la sharaxay",
    "ev.tp3d": "Sirdoonka macmalka ah oo si fudud loo sharaxay, hadal adag la’aan.",
    "ev.tp4": "Abuurista nuxurka & xirfadaha dijitaalka",
    "ev.tp4d": "Xirfadaha lagu abuuro, lagu daabaco lagana koro online-ka.",
    "ev.tp5": "Fikrado u beddel fursado",
    "ev.tp5d": "Xiisaha iyo fikradaha oo loo beddelo fursado dijitaal ah oo dhab ah.",
    "ev.fm.t": "Qaababka",
    "ev.fm1": "Hadal weyn ama hadal tiknolojiyo",
    "ev.fm2": "Aqoon-isweydaarsi",
    "ev.fm3": "Wareysi ama guddi",
    "ev.fm4": "Podcast ama bandhig",
    "ev.fm5": "Dhacdo bulsho",
    "ev.inv.k": "I casuun",
    "ev.inv.t": "I casuun inaan hadlo",
    "ev.inv.lead": "Ii sheeg dhacdadaada. Caadi ahaan waan ka jawaabaa 24–48 saac gudahood.",
    "ev.inv.org": "Hay’ad (ikhtiyaari)",
    "ev.inv.type": "Maxaad qorsheyneysaa?",
    "ev.inv.date": "Taariikh (ikhtiyaari)",
    "ev.inv.place": "Goob ama “Online” (ikhtiyaari)",
    "ev.inv.size": "Tirada dhagaystayaasha la filayo (ikhtiyaari)",
    "ev.inv.note": "Ku saabsan dhacdadaada",
    "ev.inv.btn": "Dir casuumaadda",
    "ev.inv.eMsg": "Fadlan wax yar ii sheeg dhacdadaada.",
    "ev.inv.sent": "Casuumaadda waa la diray. Mahadsanid! Waan ka jawaabi doonaa 24–48 saac gudahood.",
    "ev.t1": "Hadal weyn / hadal tiknolojiyo",
    "ev.t2": "Aqoon-isweydaarsi",
    "ev.t3": "Wareysi ama guddi",
    "ev.t4": "Podcast ama bandhig",
    "ev.t5": "Dhacdo bulsho",
    "ev.t6": "Wax kale",
    "ev.all": "Arag dhammaan dhacdooyinka",
    "con.title": "La-talin Dijitaal 1:1",
    "con.lead": "Hage shakhsi ah oo kuu gaar ah oo ku saabsan dhibaatooyinkaaga tiknolojiyada, dijitaalka iyo online-ka.",
    "pil.c": "Kulamo kal-ka-kal ah: caawinta tiknolojiyada, talada iibsashada, kobcinta abuureyaasha iyo ganacsiga, iyo badbaadada akoonka.",
    "disc.h": "Waxa kulamadaydu yihiin, iyo waxa aysan ahayn",
    "disc.lead": "Kulamadaydu waa talo iyo hagid kaliya. Waan sharaxaa, dib u eegaa oo kuu tusaa waxa la sameeyo. Adigu, sida mulkiilaha iyo isticmaalaha aaladahaaga iyo akoonnadaada, ayaa isbeddelada sameeya.",
    "disc.t1": "Dayactir jireed ma jiro.",
    "disc.d1": "Ma saxi karo dhibaatooyinka qalabka sida shaashadaha jajaban, batariyada, godadka dallacaadda ama biyo galka. Kuwaas fadlan tag dukaanka dayactirka.",
    "disc.t2": "Soo celinta akoonka ma jirto.",
    "disc.d2": "Ma soo celin karo akoonno la mamnuucay, la hakiyay, la jabsaday, la xiray ama la tirtiray. Anigu ma ihi mulkiilaha akoonka ama madasha, sidaas darteed go’aamada akoonka waxay u taal madasha. Waxaan sharaxi karaa tallaabooyinka rasmiga ah ee racfaanka iyo soo celinta, waxaanan kaa caawin karaa inaadan mar kale la kulmin.",
    "disc.t3": "Marin akoonnadaada ma helo.",
    "disc.d3": "Weligay kuma waydiin doono erayga sirta ah ama koodhadhka xaqiijinta. Fadlan weligaa ha la wadaagin qofna.",
    "disc.t4": "Natiijo la damaanad qaaday ma jirto.",
    "disc.d4": "Dakhliga, raacayaasha, iibka iyo kobacu waxay ku xiran yihiin arrimo badan oo anigu gacanta ku hayn.",
    "disc.t5": "Talada iibsashadu waa madax-bannaan.",
    "disc.d5": "Ma iibiyo aalado. Qiimaha iyo helitaanku way isbeddelaan, go’aanka ugu dambeeya ee iibsashaduna adigaa leh.",
    "disc.short": "Talo iyo hagid kaliya. Ma dayactiri karo aalado jireed ama ma soo celin karo akoonno la mamnuucay, la xiray ama lumay. Anigu ma ihi mulkiilaha akoonka ama madasha.",
    "disc.agree": "Waan fahmay in kulamadani yihiin talo kaliya.",
    "disc.agreeErr": "Fadlan calaamadee sanduuqa si aad u sii wadato.",
    "cs.fq12": "Ma soo celin kartaa akoonkayga la mamnuucay?",
    "cs.fa12": "Maya, anigu ma ihi mulkiilaha akoonka ama madasha, sidaas darteed ma soo celin karo akoonno la mamnuucay, la hakiyay, la jabsaday, la xiray ama la tirtiray. Waxaan sharaxi karaa tallaabooyinka rasmiga ah ee racfaanka iyo soo celinta. Waxaanan kaa caawin karaa inaad ammaansato akoonnadaada kale si aysan mar kale u dhicin.",
    "cs.fq13": "Ma dayactiri kartaa taleefankayga ama laptop-kayga?",
    "cs.fa13": "Maya. Kulamadaydu waa talo iyo hagid kaliya. Shaashadaha jajaban, batariyada, godadka dallacaadda ama biyo galka fadlan tag dukaanka dayactirka. Haddii ay tahay dhibaato software, app ama dejin, kulan ayaa kaa caawin kara.",
    "cs.fq14": "Ma hubaa inaan wax badan helayo ama macaamiil badan helayo?",
    "cs.fa14": "Ma ballanqaadi karo natiijooyin. Dakhliga, raacayaasha iyo iibku waxay ku xiran yihiin arrimo badan oo anigu gacanta ku hayn. Waxa aan ku siin karo waa talo cad oo daacad ah iyo qorshe wax ku ool ah oo aad raacdo.",
    "cs.guides": "Hage:",
    "cs.included": "Waxa ku jira",
    "cs.about.k": "Ku saabsan",
    "cs.about.t": "La kulan Eng Yuyu",
    "cs.about.p1": "Waxaan ahay Yusuf Mohamed, loo yaqaan Eng Yuyu, macallin tiknolojiyo iyo abuure warbaahin dijitaal ah oo Soomaali ah. Waxaan dhisay bulsho ka badan hal milyan oo raacayaal ah anigoo tiknolojiyada si cad oo daacad ah u sharaxaya.",
    "cs.about.p2": "Waxaan daabacay boqolaal muuqaal waxbarasho, ka qaybqaatay dhacdooyin toos ah iyo barnaamijyo gaaray malaayiin, waxaanan la shaqeeyay shirkado ololeyaal waxbarasho ku dhisan. Marka aad ballan qabsato, si toos ah ayaad ila shaqaysaa.",
    "cs.about.btn": "Akhri sheekadayda oo dhan",
    "cs.proof.k": "Shaqadayda",
    "cs.proof.t": "Caddayn, ma ahan ballanqaad.",
    "cs.proof.lead": "Kuwani waa mashaariicdayda iyo natiijooyinkayga. Natiijooyinka macaamiisha iyo dib-u-eegisyada halkan ayaa lagu dari doonaa marka ay yimaadaan.",
    "cs.testi.t": "Waxa macaamiisha yidhaahdaan",
    "cs.pay.methods": "Ku bixi online lacagta mobilka (EVC Plus/ZAAD, eDahab, Premier Wallet) ama kaarka.",
    "cs.fq6": "Sidee kulamadu u dhacaan?",
    "cs.fa6": "Online Google Meet ayey ku dhacaan. Linkiga waxaad ku heli doontaa email isla marka ballantaada la ansixiyo, wuxuuna ka shaqeeyaa taleefan ama kombuyuutar, akoon looma baahna.",
    "cs.fq7": "Sidee ku bixiyaa?",
    "cs.fa7": "Online, inta lagu jiro ballan-qabsiga: lacagta mobilka (EVC Plus/ZAAD, eDahab, Premier Wallet) ama kaarka. Ballantaada waa la ansixiyaa isla marka lacagta la xaqiijiyo.",
    "cs.fq15": "Kulankee ayaan dooranayaa?", "cs.fa15": "Kulanka Degdegga ah (30 daqiiqo) waa hal su’aal oo muhiim ah. Kulanka Diiradaysan (45 daqiiqo) wuxuu ku habboon yahay dhowr su’aalood oo isku xiga ama xallin dhibaato. Kulanka Buuxa (60 daqiiqo) wuxuu ugu fiican yahay dhibaato adag, ama marka aad rabto qorshe shaqo oo adiga kuu gaar ah.",
    "cs.fq16": "Maxaa dhacaya haddii aan waqti dheeraad ah u baahdo?", "cs.fa16": "Kulan kastaa wuxuu ku dhammaadaa waqtigiisii loo qabtay. Haddii wax dheeraad ah la dabooli karo, waxaad qabsan kartaa kulan kale, dooro Kulanka Buuxa haddii hore aad u ogtahay in dhibaatadaadu adag tahay.",
    "cs.fq11": "Shirkadaha iyo hay’aduhu ma ballan qabsan karaan?",
    "cs.fa11": "Haa. Dooro kulan kasta oo ii sheeg mashruucaaga qaybta fiiritaanka. Lammaanaysiga iyo nuxurka la maalgeliyay, isticmaal foomka “Work With Me” ee bogga hore.",
    "cs.nl.t": "Hage iyo muuqaallo cusub, sanduuqaaga ku jira",
    "cs.nl.p": "Talooyin tiknolojiyo oo wax ku ool ah, wararka AI iyo hagayaasha badbaadada dijitaalka, hal email oo kooban, spam la’aan. Waa sidoo kale habka ugu wanaagsan ee shaqadayda loo raacayo adigoon ku tiirsanayn baraha bulshada.",
    "blog.all.btn": "Eg dhammaan maqaallada",
    "nl.done": "Waad isdiiwaangelisay! Fiiri sanduuqaaga si aad u hesho email soo dhaweyn.",
    "ct.sent": "Fariinta waa la diray. Mahadsanid! Caadi ahaan waan ka jawaabaa 24–48 saac gudahood.",
    "cs.n.pay": "Sii wad lacag-bixinta · {price}",
    "cs.n.redirect": "Waxaa lagu gudbinayaa lacag-bixin ammaan ah…",
    "cs.pay.auto": "Ku bixi si ammaan ah online (EVC Plus/ZAAD, eDahab, Premier Wallet ama kaarka). Waqtigaaga waa lagu qabanayaa 20 daqiiqo. Isla marka lacag-bixinta la xaqiijiyo, linkiga Google Meet iyo ansixinta ballanta ayaa email ahaan kuu soo socda si toos ah.",
    "cs.ps.verifying": "Lacag-bixintaada ayaa la hubinayaa…",
    "cs.ps.pending": "Waxaa la sugayaa xaqiijinta lacag-bixinta, tani waxay qaadan kartaa ilaa hal daqiiqo.",
    "cs.ps.ok.t": "Lacagta waa la helay, ballanta waa la ansixiyay",
    "cs.ps.ok.p": "Waxaan kuu soo dirnay email ansixin ah, linkiga Google Meet iyo fayl kalandar. Fiiri sanduuqaaga (iyo spam).",
    "cs.ps.failed.t": "Lacag-bixinta lama dhammaystirin",
    "cs.ps.failed.p": "Lacag-bixintu ma dhicin, sidaas darteed ballanta lama ansixin lacagna lagaama qaadin. Waxaad dooran kartaa waqti oo mar kale isku dayi kartaa.", "cs.ps.left.t": "Lacag-bixinta lama dhammaystirin", "cs.ps.left.p": "Waxaad ka baxday bogga lacag-bixinta adigoon bixin, sidaas darteed ballanta lama ansixin. Dooro waqti mar kale markaad diyaar tahay.", "cs.ps.wait.t": "Waxaa la sugayaa xaqiijinta lacag-bixintaada", "cs.ps.wait.p": "Tani waxay qaadanaysaa waqti ka badan sidii caadiga ahayd. Waad xiri kartaa boggan, isla marka lacagta la xaqiijiyo ballantaada waa la ansixinayaa linkiga Meet-kana email ayaa laguugu soo diri doonaa. Ma aadan bixin? Dooro waqti mar kale.",
    "cs.ps.conflict.t": "Lacagta waa la helay, waa inaan dib u jadwalno",
    "cs.ps.conflict.p": "Waqtigii aad dooratay isla marka ayaa la qaatay. Email ayaan kuu soo diri doonaa si aan dib u jadwalno ama lacagta kuu celino.",
    "cs.ps.err.t": "Ma awoodnay inaan hubino lacag-bixintaada",
    "cs.ps.err.p": "Haddii lacag laga jaray, fadlan noo soo dir email adigoo isticmaalaya lambarka tixraaca.",
    "cs.ps.retry": "Dooro waqti mar kale",
    "cs.ps.ref": "Tixraac",
    "crumb.home": "Hoyga",
    "ab.more": "Akhri sheekadayda oo dhan",
    "ab.p1": "Waxaan ahay Yusuf Mohamed, loo yaqaan Eng Yuyu. Waxaan ahay macallin tiknolojiyo Soomaaliyeed, abuure nuxur iyo u-doodaha ogaanshaha dijitaalka. Tiknolojiyada si cad ayaan u sharaxaa si dadku ugu isticmaalaan kalsooni.",
    "ab.p2": "Shaqadaydu waxay ku taalaa meesha tiknolojiyada, warbaahinta iyo waxbarashadu isku Imaanayaan: talooyin taleefan, amniga dijitaalka, AI oo la fududeeyay iyo xirfado dijitaal ah oo wax ku ool ah, bulsho ka badan hal milyan oo raacayaal ah.",
    "ap.aka": "Loo yaqaan Eng Yuyu",
    "ap.h1": "Yusuf Mohamed",
    "ap.lead": "Macallin tiknolojiyo oo noqday la-taliye warbaahin dijitaal ah. Waxaan dhisaa aamin dhagaystayaal ka badan 1M, waxaanan u shaqaysiiyaa shirkadaha iyo dadka aan la shaqeeyo.",
    "ap.r1": "Macallin Tiknolojiyo",
    "ap.r2": "Abuure Nuxur",
    "ap.r3": "U-dooda Ogaanshaha Dijitaalka",
    "ap.f1": "raacayaal 5 madal ah",
    "ap.f2n": "Boqolaal",
    "ap.f2": "muuqaal waxbarasho oo loogu talagalay inay sii jiraan",
    "ap.f3n": "Malaayiin",
    "ap.f3": "oo lagu gaaray dhacdooyin toos ah iyo barnaamijyo",
    "ap.f4": "lammaanayaal shirkado ah",
    "ap.mi.k": "Hadaf & fikir",
    "ap.mi.q": "Inaan dadka ka caawiyo inay tiknolojiyada kalsooni ula isticmaalaan, ilaaliyaan noloshooda dijitaalka ah, kana faa’iidaystaan hal-abuurka halkii ay ku dhex lumi lahaayeen.",
    "ap.why.k": "Ogaanshaha farqiga",
    "ap.why.t": "Waxaan arkay dhagaystayaal aan adduunka tiknolojiyada u adeegin.",
    "ap.why.p1": "Malaayiin qof ayaa maalin kasta isticmaala taleefanka iyo internet-ka, haddana badidoodu ma fahmaan sida tiknolojiyadu u shaqayso, ama sida ay naftooda uga ilaalin karaan online-ka. Tani waa baahi dhab ah, qofna si fiican uma buuxinayn.",
    "ap.why.p2": "Farqigu wuxuu ugu weynaa bulshada Soomaaliyeed iyo dhagaystayaasha dijitaalka ee ballaaran. Sidaas darteed waxaan bilaabay inaan tiknolojiyada sharaxo si cad oo wax ku ool ah oo qof kasta uga shaqayn karo.",
    "ap.why.p3": "Natiijadu waxay ahayd aamin: ka badan hal milyan oo raacayaal ah, boqolaal muuqaal waxbarasho, iyo dhacdooyin toos ah iyo barnaamijyo gaaray malaayiin. Aamintaas ayaa shirkaduhu iigu shaqaystaan.",
    "ap.cov.k": "Meesha aan qiimo ka abuuro",
    "ap.cov.t": "Shan meelood oo waxbarashadu natiijo ka keento.",
    "ap.c1": "Talooyin taleefan",
    "ap.c1d": "Talooyin iPhone iyo Android oo wax ku ool ah oo qof kasta isticmaali karo.",
    "ap.c2": "Amniga & asturnaanta dijitaalka",
    "ap.c2d": "Ogaansho iyo caadooyin lagu ilaaliyo akoonnadaada, xogtaada iyo noloshaada online-ka.",
    "ap.c3": "AI, la sharaxay",
    "ap.c3d": "Sirdoonka macmalka ah oo si fudud loo sharaxay, hadal adag la’aan.",
    "ap.c4": "Abuurista nuxurka & xirfadaha dijitaalka",
    "ap.c4d": "Xirfadaha lagu abuuro, lagu daabaco lagana koro online-ka.",
    "ap.c5": "Fikrado u beddel fursado",
    "ap.c5d": "Xiisaha iyo fikradaha oo loo beddelo fursado dijitaal ah oo dhab ah.",
    "ap.how.k": "Sida aan u baro",
    "ap.how.t": "Qaabab badan. Hal hadaf: fahmid.",
    "ap.fm1": "Muuqaallo gaagaaban",
    "ap.fm2": "Casharro",
    "ap.fm3": "Hadallo tiknolojiyo",
    "ap.fm4": "Aqoon-isweydaarsiyo",
    "ap.fm5": "Dhacdooyin bulsho",
    "ap.bey.k": "Wax ka baxsan nuxurka",
    "ap.bey.t": "Wada-shaqayn ku dhisan waxbarasho iyo saamayn.",
    "ap.bey.p": "Waxaan la shaqeeyaa shirkado alaabtooda iyo qiyamkoodu la jaanqaadayaan waxbarashada iyo saamayn dijitaal ah oo wanaagsan, anigoo adeegsanaya wada-shaqayn, hadallo, aqoon-isweydaarsiyo, barnaamijyo iyo dhacdooyin bulsho.",
    "ap.par.k": "Lammaanayaasha shirkadaha",
    "ap.find.k": "Iga hel online",
    "ap.find.t": "Iga daba noqo meesha aad ku jeceshahay inaad wax ku barato.",
    "ap.nl": "Aragtiyo tiknolojiyo oo wax ku ool ah, wararka AI iyo hagayaasha badbaadada dijitaalka, hal email oo kooban, spam la’aan.",
    "ap.cta.t": "Ma rabtaa inaan wada shaqaynno?",
    "ap.cta.p": "Wada-shaqayn shirkado, dib-u-eegis alaab, warbaahin iyo wareysiyo, casuumaado dhacdooyin ama su’aalo tiknolojiyo. Caadi ahaan waan ka jawaabaa 24–48 saac gudahood.",
    'k.page': 'Qayb', 'k.post': 'Maqaal', 'k.service': 'Adeeg', 'k.event': 'Dhacdo',
  },
};

/* =====================================================================
   Content (SAMPLE: replace with your real posts, services and events)
   ===================================================================== */
const SERVICES = [
  { id: 'tech', icon: 'chart', en: ['Tech Help & Smart Buying', 'Get unstuck with phones, apps and computers, and choose the right device for your money.'], so: ['Caawinta Tiknolojiyada & Iibsashada Caqliga leh', 'Ka baxsan dhibaatooyinka taleefannada, abka iyo kombuyuutarrada, oo dooro aaladda ku haboon lacagtaada.'], who: { en: 'For anyone with a tech problem or a purchase to make', so: 'Loogu talagalay qof kasta oo leh dhibaato tiknolojiyo ama iibsasho' }, note: { en: 'No physical repairs, hardware problems need a repair shop.', so: 'Dayactir jireed ma jiro, dhibaatooyinka qalabka waxay u baahan yihiin dukaanka dayactirka.' } },
  { id: 'creator', icon: 'video', en: ['Creator Growth Coaching', 'Plan your content, grow your channel and build income from what you create.'], so: ['Tababarka Kobcinta Abuureyaasha', 'Qorshee nuxurkaaga, kobci kanaalkaaga oo dhis dakhli ka yimaada waxa aad abuurto.'], who: { en: 'For people making videos', so: 'Loogu talagalay dadka sameeya muuqaallada' }, note: { en: 'No guaranteed results, growth depends on many things.', so: 'Natiijo la damaanad qaaday ma jirto, kobacu wuxuu ku xiran yahay arrimo badan.' } },
  { id: 'business', icon: 'spark', en: ['Business Online Growth', 'Get found online and turn attention into customers with a simple, practical plan.'], so: ['Kobcinta Ganacsiga Online-ka', 'Ka muuqo online-ka oo u beddel dareenka macaamiil adigoo adeegsanaya qorshe fudud oo wax ku ool ah.'], who: { en: 'For small businesses', so: 'Loogu talagalay ganacsiyada yaryar' }, note: { en: 'No guaranteed results, sales depend on many things.', so: 'Natiijo la damaanad qaaday ma jirto, iibku wuxuu ku xiran yahay arrimo badan.' } },
  { id: 'safety', icon: 'cap', en: ['Account Audit & Online Safety', 'Check how safe your accounts are, close the gaps and learn to avoid scams.'], so: ['Hubinta Akoonnada & Badbaadada Online-ka', 'Hubi sida ay u ammaan yihiin akoonnadaada, xir godadka oo baro sida looga fogaado khayaanada.'], who: { en: 'For anyone who uses social media, email or mobile money', so: 'Loogu talagalay qof kasta oo isticmaala baraha bulshada, email ama lacagta mobilka' }, note: { en: 'No account recovery, I can explain the official recovery steps.', so: 'Soo celinta akoonka ma jirto, waxaan sharaxi karaa tallaabooyinka rasmiga ah.' } },
];
const ADS = [];   // partner ads for the blog pages, managed in Dashboard → Content → Partner ads
const MEDIA = [];   // Your videos, interviews, podcasts and articles, add them in Dashboard → Content → Media (YouTube thumbnails are automatic).
const GUIDES = {};   // guides (blog posts) linked to each service, filled from the dashboard
const PROOF = [      // Your own work. Facts taken from engyuyu.com: add real client results in Dashboard → Content → Proof.
  { id: 'p1', metric: '1M+', en: ['A community built on trust', 'Grew an audience of over a million people across YouTube, Facebook, TikTok and Instagram by teaching technology in plain language.'], so: ['Bulsho ku dhisan aamin', 'Waxaan kobciyay dhagaystayaal ka badan hal milyan oo ku kala jira YouTube, Facebook, TikTok iyo Instagram anigoo tiknolojiyada ku sharaxaya af fudud.'] },
  { id: 'p2', metric: 'Hundreds', en: ['Educational videos', 'Practical videos on smartphones, AI, digital safety and online skills, in Somali and English.'], so: ['Muuqaallo waxbarasho', 'Muuqaallo wax ku ool ah oo ku saabsan taleefannada, AI, badbaadada dijitaalka iyo xirfadaha online-ka, Soomaali iyo Ingiriisi.'] },
  { id: 'p3', metric: 'Millions', en: ['Live events & programs', 'Tech talks, workshops and community programs that have reached millions of people.'], so: ['Dhacdooyin toos ah & barnaamijyo', 'Hadallo tiknolojiyo, aqoon-isweydaarsiyo iyo barnaamijyo bulsho oo gaaray malaayiin qof.'] },
  { id: 'p4', metric: '4+', en: ['Brand collaborations', 'Education-led partnerships with Taran, Keshflip, Amka and Sanguuni.'], so: ['Wada-shaqayn shirkado', 'Lammaanayaal waxbarasho ku dhisan oo lala yeeshay Taran, Keshflip, Amka iyo Sanguuni.'] },
];
const TESTIMONIALS = [];   // Add client testimonials in Dashboard → Content → Testimonials; the section appears automatically.

const EVENTS = [   // DEMO events (sample photos in /assets/samples). Replace them in Dashboard → Content → Events.
  { feature: true, type: 'conference', icon: 'mic', tag: ['Keynote', 'Hadal Muhiim ah'], date: '2026-11-20', place: 'Venue to be announced', images: ['/assets/samples/event-1.svg', '/assets/samples/event-2.svg', '/assets/samples/event-3.svg', '/assets/samples/event-4.svg'],
    article: { en: 'DEMO STORY. A full-day gathering for builders, creators and brands shaping the Somali digital future.\n\nThis is where the highlights of your event go: the topic of your keynote, the questions from the audience, the people you met. Add 1–4 photos in the dashboard, the first one is the cover.', so: 'TIJAABO. Maalin buuxda oo loogu talagalay dhisayaasha, abuureyaasha iyo shirkadaha qaabeynaya mustaqbalka dijitaalka Soomaaliyeed.\n\nHalkan ayaa lagu qoraa xusuusta dhacdadaada.' },
    en: ['Somali Tech & Creators Summit', 'A full-day gathering for builders, creators and brands shaping the Somali digital future.'], so: ['Shirka Tiknolojiyada & Abuureyaasha Soomaaliyeed', 'Maalin buuxda oo loogu talagalay dhisayaasha, abuureyaasha iyo shirkadaha qaabeynaya mustaqbalka dijitaalka Soomaaliyeed.'] },
  { type: 'workshop', icon: 'cap', tag: ['Workshop', 'Aqoon-isweydaarsi'], date: '2026-12-05', place: 'Online', images: ['/assets/samples/event-3.svg', '/assets/samples/event-1.svg'],
    article: { en: 'DEMO STORY. A hands-on workshop on using AI tools to plan, write and edit faster.\n\nDescribe what participants will learn and what to bring.', so: 'TIJAABO. Aqoon-isweydaarsi wax ku ool ah oo ku saabsan isticmaalka qalabka AI si loo qorsheeyo, loo qoro loona tafatiro degdeg.' },
    en: ['AI for Content Creators', 'A hands-on workshop on using AI tools to plan, write and edit faster.'], so: ['AI loogu talagalay Abuureyaasha', 'Aqoon-isweydaarsi wax ku ool ah oo ku saabsan isticmaalka qalabka AI si loo qorsheeyo, loo qoro loona tafatiro degdeg.'] },
  { type: 'media', icon: 'video', tag: ['Media', 'Warbaahin'], date: '2027-01-15', place: 'YouTube', images: ['/assets/samples/event-2.svg'],
    article: { en: '', so: '' },
    en: ['The Yuyu Tech Show: Season launch', 'New season of interviews and deep dives with founders and engineers.'], so: ['Bandhigga Yuyu Tech: Bilowga xilli cusub', 'Xilli cusub oo wareysiyo iyo falanqayn qoto dheer ah oo lala yeeshay aasaasayaasha iyo injineerrada.'] },
  { type: 'conference', icon: 'mic', tag: ['Conference', 'Shir'], date: '2026-09-12', place: 'Demo City', images: ['/assets/samples/event-1.svg', '/assets/samples/event-2.svg', '/assets/samples/event-3.svg', '/assets/samples/event-4.svg'],
    article: { en: 'DEMO STORY. How a past conference looks on your site: four photos, the key moments of your talk and what the audience asked.\n\nWrite two or three short paragraphs about what happened.', so: 'TIJAABO. Sida shir hore ugu muuqdo goobtaada.' },
    en: ['Demo conference keynote', 'A demo past conference with four photos. Replace it with your own event.'], so: ['Hadal shir tijaabo ah', 'Shir hore oo tijaabo ah oo leh afar sawir.'] },
  { type: 'panel', icon: 'mic', tag: ['Panel', 'Guddi'], date: '2026-07-03', place: 'Online', images: ['/assets/samples/event-3.svg', '/assets/samples/event-1.svg'],
    article: { en: 'DEMO STORY. A panel discussion about digital safety for communities.', so: 'TIJAABO. Wada-hadal guddi ah oo ku saabsan badbaadada dijitaalka.' },
    en: ['Demo panel on digital safety', 'A demo panel with two photos.'], so: ['Guddi tijaabo ah oo ku saabsan badbaadada dijitaalka', 'Guddi tijaabo ah oo laba sawir leh.'] },
  { type: 'attended', icon: 'cap', tag: ['Attended', 'Ka qaybgalay'], date: '2026-05-18', place: 'Demo Expo', images: ['/assets/samples/event-4.svg'],
    article: { en: '', so: '' },
    en: ['Attended a tech expo', 'A demo event with a single cover photo.'], so: ['Ka qaybgal bandhig tiknolojiyo', 'Dhacdo tijaabo ah oo hal sawir leh.'] },
];

const POSTS = [
  { cat: 'ai', min: 6, date: '2026-09-28', thumb: '/assets/samples/post-1.svg', href: '/blog/how-ai-is-changing-the-way-somali-creators-work', video: true, en: ['How AI is changing the way Somali creators work', 'Practical AI workflows for scripting, translation and editing you can start using today.'], so: ['Sida AI u beddelayso shaqada abuureyaasha Soomaaliyeed', 'Habab AI oo wax ku ool ah oo qorista qoraalka, tarjumaadda iyo tafatirka ah oo maanta bilaabi karto.'] },
  { cat: 'gadgets', min: 5, date: '2026-09-14', thumb: '/assets/samples/post-2.svg', href: '/blog/best-budget-phones-for-creators', en: ['Best budget phones for creators in 2026', 'Camera, battery and value compared, what to buy and what to skip.'], so: ['Taleefannada ugu fiican ee qiimaha jaban ee abuureyaasha 2026', 'Kamarada, batariga iyo qiimaha oo la is barbar dhigay, waxa la iibsado iyo waxa laga tago.'] },
  { cat: 'growth', min: 8, date: '2026-08-30', thumb: '/assets/samples/post-3.svg', href: '/blog/from-zero-to-100k-channel-growth-playbook', video: true, en: ['From 0 to 100K: a channel growth playbook', 'The content pillars, posting rhythm and analytics habits behind steady growth.'], so: ['0 ilaa 100K: buug-gacmeed koboca kanaalka', 'Tiirarka nuxurka, xawaaraha daabacaadda iyo caadooyinka falanqaynta ee ka danbeeya kobocka joogtada ah.'] },
  { cat: 'dev', min: 7, date: '2026-08-12', en: ['Start coding in Somali: a beginner roadmap', 'A free, step-by-step path from first line of code to your first project.'], so: ['Ku bilow barnaamijka Soomaali: khariidad bilow ah', 'Waddo bilaash ah oo tallaabo-tallaabo ah laga bilaabo xariiqda koowaad ee koodka ilaa mashruucaaga koowaad.'] },
  { cat: 'ai', min: 4, date: '2026-07-25', en: ['5 free AI tools every student should know', 'Study smarter with tools that cost nothing and save hours every week.'], so: ['5 qalab AI ah oo bilaash ah oo arday kasta ogaado', 'Ku baro si caqli badan qalab aan waxba kaa qaadin oo saacado ku badbaadiya toddobaad kasta.'] },
  { cat: 'growth', min: 6, date: '2026-07-04', en: ['How brands should work with creators', 'Briefs, budgets and trust: a short guide to partnerships that actually perform.'], so: ['Sida shirkaduhu ula shaqeeyaan abuureyaasha', 'Tilmaamo, miisaaniyad iyo aamin: hage kooban oo ku saabsan lammaanaysi dhabta u shaqeeya.'] },
];
const CATS = { all: ['All', 'Dhammaan'], ai: ['AI', 'AI'], gadgets: ['Gadgets', 'Aalado'], dev: ['Development', 'Horumarin'], growth: ['Digital Growth', 'Koboc Dijitaal'] };

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

/* =====================================================================
   Rendering
   ===================================================================== */
function patternArt(seed) {
  // Deterministic little network graphic used as blog card art
  let s = seed * 9301 + 49297; const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const pts = Array.from({ length: 9 }, () => [r() * 320, r() * 180]);
  let lines = '';
  pts.forEach((p, i) => pts.slice(i + 1).forEach(q => { if (Math.hypot(p[0] - q[0], p[1] - q[1]) < 110) lines += `<path d="M${p[0]} ${p[1]}L${q[0]} ${q[1]}"/>`; }));
  const dots = pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="rgba(255,255,255,.7)" stroke="none"/>`).join('');
  return `<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${lines}${dots}</svg>`;
}

let blogFilter = 'all';
function renderServiceChips() {   // home: the sessions (name, length + price, what's included, a Book button) and the topics you can bring
  const ul = $('#serviceChips'); if (ul === NULL) return;
  ul.innerHTML = SESSIONS.filter(s => s.enabled !== false).map(s => `<li class="sess-chip"><div class="sc-top"><h3>${esc(pick(s)[0])}</h3><p class="sc-meta"><b>${esc(price(s))}</b> · ${s.min} ${t('cs.min')}</p></div>${s.inc ? `<ul>${pick(s.inc).map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}<a class="btn btn-primary" href="consulting.html?session=${encodeURIComponent(s.id)}#book">${esc(t('cs.bookBtn').replace('{p}', price(s)))}</a></li>`).join('');
  const tp = $('#homeTopics'); if (tp !== NULL) tp.innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<li>${esc(t('cs.tp' + n))}</li>`).join('');
}
function renderServices() {
  $('#serviceList').innerHTML = SERVICES.map(s => {
    const g = (GUIDES[s.id] || []).map(x => `<a href="${esc(x.href)}">${esc(lang === 'so' ? x.title.so : x.title.en)}</a>`).join('');
    return `<li class="service"><span class="ico">${svg(s.icon)}</span><div><h3>${esc(pick(s)[0])}</h3><p>${esc(pick(s)[1])}</p>${s.who ? `<p class="who">${esc(pick(s.who))}</p>` : ''}${s.note ? `<p class="svc-note">${esc(pick(s.note))}</p>` : ''}${g ? `<p class="guides"><b>${t('cs.guides')}</b>${g}</p>` : ''}</div></li>`;
  }).join('');
}
function renderProof() {
  const g = $('#proofGrid'); if (g === NULL) return;
  g.innerHTML = PROOF.map(p => `<li class="proof"><b class="metric">${esc(p.metric)}</b><h3>${esc(pick(p)[0])}</h3><p>${esc(pick(p)[1])}</p>${p.href ? `<a class="more" href="${esc(p.href)}" target="_blank" rel="noopener">${t('more')} →</a>` : ''}</li>`).join('');
  const w = $('#testiWrap'); w.hidden = !TESTIMONIALS.length;
  $('#testiList').innerHTML = TESTIMONIALS.map(x => `<li class="testi"><blockquote><p>${esc(lang === 'so' ? (x.so || x.en) : x.en)}</p></blockquote><p class="who-t"><b>${esc(x.name)}</b>${x.role ? ` · ${esc(x.role)}` : ''}</p></li>`).join('');
}
function renderEvents() {   // home: latest 3 events as a slider
  const track = $('#homeEvSlides'); if (track === NULL) return;
  evList = evSorted();
  const n = Math.min(3, evList.length);
  fillSlider('#homeEvSlides', evList.slice(0, n).map((e, i) => evSlide(e, i, n)).join('') || `<p class="empty">${t('ev.up.none')}</p>`, n);
}
/* ---------- Events & Media page ---------- */
const ytIdOf = u => { const m = String(u || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/|v\/))([A-Za-z0-9_-]{11})/); return m ? m[1] : ''; };
const evEnd = e => new Date(e.date + 'T23:59:59');
const nl2 = n => String(n).padStart(2, '0');
const slugOf = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const EV_TYPES = { conference: ['Conference', 'Shir'], talk: ['Talk', 'Hadal'], panel: ['Panel', 'Guddi'], attended: ['Attended', 'Ka qaybgalay'], workshop: ['Workshop', 'Aqoon-isweydaarsi'], media: ['Media', 'Warbaahin'], other: ['Event', 'Dhacdo'] };
const evLabel = e => (e.type && EV_TYPES[e.type]) ? EV_TYPES[e.type][lang === 'so' ? 1 : 0] : (e.tag ? e.tag[lang === 'so' ? 1 : 0] : EV_TYPES.other[lang === 'so' ? 1 : 0]);
const evImgs = e => (Array.isArray(e.images) ? e.images : []).filter(Boolean).slice(0, 4);
const evArticle = e => { const x = e.article && (lang === 'so' ? (e.article.so || e.article.en) : e.article.en); return x || ''; };
const paras = s => String(s).split(/\n{2,}/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
function evCalLinks(e) {
  const d = e.date.replace(/-/g, ''), nx = new Date(e.date + 'T12:00:00'); nx.setDate(nx.getDate() + 1);
  const d2 = nx.getFullYear() + nl2(nx.getMonth() + 1) + nl2(nx.getDate()), title = pick(e)[0], det = pick(e)[1] + (e.place ? ' | ' + e.place : '');
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Eng Yuyu//Events//EN', 'BEGIN:VEVENT', 'UID:' + d + '-' + slugOf(title) + '@engyuyu.com', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]|\.\d{3}/g, ''), 'DTSTART;VALUE=DATE:' + d, 'DTEND;VALUE=DATE:' + d2, 'SUMMARY:' + title, 'DESCRIPTION:' + det.replace(/\n/g, ' '), e.place ? 'LOCATION:' + e.place : '', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
  return { google: 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(title) + '&dates=' + d + '/' + d2 + '&details=' + encodeURIComponent(det) + (e.place ? '&location=' + encodeURIComponent(e.place) : ''), ics: 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics) };
}
const PIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-5.600 7-11a7 7 0 1 0-14 0c0 5.400 7 11 7 11Z"/><circle cx="12" cy="10" r="2.500"/></svg>';
const evSorted = () => { const now = new Date(); return [...EVENTS.filter(e => evEnd(e) >= now).sort((x, y) => x.date.localeCompare(y.date)), ...EVENTS.filter(e => evEnd(e) < now).sort((x, y) => y.date.localeCompare(x.date))]; };
function evGallery(e, cls) {   // 16:9 gallery: first image is the cover; the others are thumbnails that swap the main picture
  const imgs = evImgs(e), alt = esc(pick(e)[0]);
  if (!imgs.length) return `<div class="${cls}"><div class="g-main g-empty">${svg(e.icon || 'mic')}</div></div>`;
  return `<div class="${cls}"><div class="g-main"><img src="${esc(imgs[0])}" alt="${alt}" width="1280" height="720" loading="lazy"></div>${imgs.length > 1 ? `<div class="g-thumbs">${imgs.map((u, i) => `<button type="button" class="g-th" aria-label="${t('ev.photo')} ${i + 1}" aria-pressed="${i === 0}" data-src="${esc(u)}"><img src="${esc(u)}" alt="" width="320" height="180" loading="lazy"></button>`).join('')}</div>` : ''}</div>`;
}
function evMeta(e) { return `<p class="evc-meta">${PIN}<span>${esc(e.place || t('ev.tba'))}</span><span aria-hidden="true">·</span><time datetime="${e.date}">${fmtDate(e.date)}</time></p>`; }
function evSlide(e, i, n) {
  const up = evEnd(e) >= new Date(), cal = up ? evCalLinks(e) : null, days = Math.ceil((new Date(e.date + 'T12:00:00') - new Date()) / 864e5);
  return `<article class="slide" role="group" aria-roledescription="slide" aria-label="${i + 1} / ${n}" data-i="${i}">
    ${evGallery(e, 'sl-gallery')}
    <div class="sl-body"><div class="evc-top"><span class="tag">${esc(evLabel(e))}</span>${up ? `<span class="evc-when">${esc(days <= 0 ? t('ev.today') : t('ev.in').replace('{n}', days))}</span>` : ''}</div>
      <h3>${esc(pick(e)[0])}</h3>${evMeta(e)}<p class="sl-text">${esc(pick(e)[1])}</p>
      <div class="evc-actions"><button class="btn btn-primary btn-sm" type="button" data-ev="${i}">${t('ev.read')}</button>${e.link ? `<a class="btn btn-ghost btn-sm" href="${esc(e.link)}" target="_blank" rel="noopener">${t(up ? 'ev.reg' : 'ev.details')}</a>` : ''}${cal ? `<a class="btn btn-ghost btn-sm" href="${esc(cal.google)}" target="_blank" rel="noopener">Google ${t('ev.cal')}</a>` : ''}</div></div></article>`;
}
let evList = [];
function openEvent(i) {
  const e = evList[i], dlg = $('#evDlg'); if (!e) return;
  const up = evEnd(e) >= new Date(), cal = up ? evCalLinks(e) : null, art = evArticle(e);
  $('#evDlgBody').innerHTML = `${evGallery(e, 'dg-gallery')}<div class="dg-text"><span class="tag">${esc(evLabel(e))}</span><h2 id="evDlgTitle">${esc(pick(e)[0])}</h2>${evMeta(e)}<div class="dg-article">${art ? paras(art) : paras(pick(e)[1])}</div><div class="evc-actions">${e.link ? `<a class="btn btn-primary btn-sm" href="${esc(e.link)}" target="_blank" rel="noopener">${t(up ? 'ev.reg' : 'ev.details')}</a>` : ''}${cal ? `<a class="btn btn-ghost btn-sm" href="${esc(cal.google)}" target="_blank" rel="noopener">Google ${t('ev.cal')}</a><a class="btn btn-ghost btn-sm" href="${esc(cal.ics)}" download="event.ics">Apple / Outlook (.ics)</a>` : ''}</div></div>`;
  dlg.showModal();
}
function renderEventsPage() {
  const track = $('#evSlides'); if (track === NULL) return;
  evList = evSorted();
  fillSlider('#evSlides', evList.length ? evList.map((e, i) => evSlide(e, i, evList.length)).join('') : `<p class="empty">${t('ev.up.none')}</p>`, evList.length);
  const kinds = { video: 'Video', interview: 'Interview', podcast: 'Podcast', show: 'Show', article: 'Article' };
  const items = [...MEDIA].sort((x, y) => y.date.localeCompare(x.date)).map(m => { const id = ytIdOf(m.url);
    return `<a class="mc" href="${esc(m.url)}" target="_blank" rel="noopener"><div class="mc-art">${id ? `<img src="https://img.youtube.com/vi/${id}/hqdefault.jpg" alt="" loading="lazy" width="480" height="360">` : `<span class="mc-ph">${svg('video')}</span>`}${id ? '<span class="play-badge" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.500v13l11-6.500z" fill="currentColor" stroke="none"/></svg></span>' : ''}</div><div class="mc-body"><span class="tag">${esc(kinds[m.kind] || m.kind)}</span><h3>${esc(lang === 'so' ? (m.so || m.en) : m.en)}</h3><p>${esc([m.outlet, fmtDate(m.date)].filter(Boolean).join(' · '))}</p></div></a>`; });
  const channel = `<a class="mc mc-channel" href="https://www.youtube.com/@engyuyu" target="_blank" rel="noopener"><div class="mc-body"><span class="tag">YouTube</span><h3>${t('ev.channel.t')}</h3><p>${t('ev.channel.p')}</p><span class="more">@engyuyu →</span></div></a>`;
  $('#mediaGrid').innerHTML = channel + items.join('');
}
/* ---------- generic slider: scroll-snap track + prev/next + dots + keyboard ---------- */
function fillSlider(sel, html, n) {
  const track = $(sel); if (track === NULL) return;
  const block = track.closest('.slider-block'), section = block.parentElement;
  track.innerHTML = html; track.scrollLeft = 0;
  $('.dots', block).innerHTML = n > 1 ? Array.from({ length: n }, (_, i) => `<button type="button" role="tab" aria-label="${i + 1} / ${n}" aria-selected="${i === 0}" data-dot="${i}"></button>`).join('') : '';
  $$('[data-prev], [data-next]', section.parentElement.querySelector('.slider-nav') || section).forEach(b => b.hidden = n < 2);
  track.dispatchEvent(new Event('scroll'));
}
/* Home page sliders (latest articles, latest events) advance on their own. They pause on hover/focus/touch, while off-screen,
   while the tab is hidden or a dialog is open, and the visitor can stop them with the pause button. Off when "reduce motion" is set. */
const AUTO_SLIDERS = ['blogSlides', 'homeEvSlides'], AUTO_MS = 5500;
function autoplay(block, go, idx, count, dots) {
  let last = Date.now(), hover = false, focus = false, inView = false, stopped = false;
  const bar = document.createElement('div'); bar.className = 'sl-bar'; dots.replaceWith(bar);
  const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'sl-pause'; btn.setAttribute('aria-pressed', 'false'); btn.setAttribute('data-i18n-aria', 'sl.pause');
  btn.innerHTML = '<svg class="i-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg><svg class="i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
  bar.append(dots, btn); btn.setAttribute('aria-label', t('sl.pause'));
  btn.addEventListener('click', () => { stopped = !stopped; btn.setAttribute('aria-pressed', stopped); btn.setAttribute('data-i18n-aria', stopped ? 'sl.play' : 'sl.pause'); btn.setAttribute('aria-label', t(stopped ? 'sl.play' : 'sl.pause')); last = Date.now(); });
  const bump = () => { last = Date.now(); };
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => block.addEventListener(ev, bump, { passive: true }));
  block.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') hover = true; }); block.addEventListener('pointerleave', () => { hover = false; bump(); });
  block.addEventListener('focusin', () => { focus = true; }); block.addEventListener('focusout', () => { focus = false; bump(); });
  setInterval(() => {
    const r = block.getBoundingClientRect(), now = r.top < innerHeight * 0.8 && r.bottom > innerHeight * 0.2;   // roughly on screen
    if (now !== inView) { inView = now; if (now) bump(); }
    if (stopped || hover || focus || !inView || document.hidden || count() < 2 || document.querySelector('dialog[open]') || Date.now() - last < AUTO_MS - 150) return;
    const i = idx(); go(i + 1 >= count() ? 0 : i + 1); last = Date.now();
  }, 500);
}
function initSliders() {
  $$('.slider-block').forEach(block => {
    const track = $('.slides', block), section = block.parentElement, prev = $('[data-prev]', section), next = $('[data-next]', section), dots = $('.dots', block);
    const count = () => $$('.slide', track).length, idx = () => Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    const go = i => track.scrollTo({ left: Math.max(0, Math.min(count() - 1, i)) * track.clientWidth, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    const paint = () => { const i = idx(); $$('button', dots).forEach((d, k) => d.setAttribute('aria-selected', k === i)); if (prev) prev.disabled = i <= 0; if (next) next.disabled = i >= count() - 1; };
    let raf = 0; track.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(paint); }, { passive: true });
    if (prev) prev.addEventListener('click', () => go(idx() - 1)); if (next) next.addEventListener('click', () => go(idx() + 1));
    dots.addEventListener('click', e => { const b = e.target.closest('[data-dot]'); if (b) go(+b.dataset.dot); });
    $('.slider', block).addEventListener('keydown', e => { if (e.key === 'ArrowRight') { e.preventDefault(); go(idx() + 1); } if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx() - 1); } });
    addEventListener('resize', () => go(idx()), { passive: true });
    if (AUTO_SLIDERS.includes(track.id) && !reduceMotion.matches) autoplay(block, go, idx, count, dots);
  });
  // thumbnails swap the main photo; "Read highlights" opens the full story
  document.addEventListener('click', e => {
    const th = e.target.closest('.g-th'); if (th) { const g = th.closest('.sl-gallery, .dg-gallery'); g.querySelector('.g-main img').src = th.dataset.src; $$('.g-th', g).forEach(x => x.setAttribute('aria-pressed', x === th)); return; }
    const rd = e.target.closest('[data-ev]'); if (rd) openEvent(+rd.dataset.ev);
  });
  if (has('#evDlg')) { $('#evDlgClose').addEventListener('click', () => $('#evDlg').close()); $('#evDlg').addEventListener('click', e => { if (e.target === $('#evDlg')) $('#evDlg').close(); }); }
}
function renderBlog() {   // home: latest 3 articles as a slider
  const track = $('#blogSlides'); if (track === NULL) return;
  const list = [...POSTS].sort((x, y) => String(y.date).localeCompare(String(x.date))).slice(0, 3), n = list.length;
  fillSlider('#blogSlides', list.length ? list.map((p, i) => {
    const link = p.href ? ' href="' + esc(p.href) + '"' : '', tag = p.href ? 'a' : 'div';
    return `<article class="slide" role="group" aria-roledescription="slide" aria-label="${i + 1} / ${n}">
      <${tag} class="sl-gallery blog-img"${link}${p.href ? ` aria-label="${esc(pick(p)[0])}"` : ''}><div class="g-main">${p.thumb ? `<img src="${esc(p.thumb)}" alt="" loading="lazy" width="1280" height="720">` : patternArt(i + 3)}${p.video ? '<span class="play-badge big" aria-label="Video"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/></svg></span>' : ''}</div></${tag}>
      <div class="sl-body"><div class="evc-top"><span class="tag">${esc(CATS[p.cat] ? CATS[p.cat][lang === 'so' ? 1 : 0] : p.cat)}</span></div>
        <h3>${esc(pick(p)[0])}</h3><p class="evc-meta"><time datetime="${p.date}">${fmtDate(p.date)}</time><span aria-hidden="true">·</span><span>${p.min} ${t('blog.min')}</span></p><p class="sl-text">${esc(pick(p)[1])}</p>
        <div class="evc-actions">${p.href ? `<a class="btn btn-primary btn-sm" href="${esc(p.href)}">${t('blog.read')}</a>` : ''}${p.video && p.href ? `<a class="btn btn-ghost btn-sm" href="${esc(p.href)}">${t('blog.watch')}</a>` : ''}</div></div></article>`;
  }).join('') : `<p class="empty">${t('blog.none')}</p>`, n);
}
function renderCommunity() {
  $('#communityLinks').innerHTML = COMMUNITY.map(c => `
    <a class="com-link" href="${c.href}" rel="noopener"><span class="ico">${svg(c.icon)}</span>
      <span><b>${esc(c.name)}</b><small>${esc(lang === 'so' ? c.so : c.en)}</small></span>${svg('arrow')}</a>`).join('');
}
function renderPartners() {
  // Logos only (light / dark versions). A partner without a logo falls back to its name as text.
  const item = p => {
    const o = typeof p === 'string' ? { name: p } : p, dark = o.dark === 'custom' && o.logoDark, inv = o.dark === 'invert';
    const inner = o.logo
      ? `<span class="p-logo${dark ? ' has-dark' : ''}${inv ? ' inv' : ''}"><img class="pl-light" src="${esc(o.logo)}" alt="${esc(o.name)}">${dark ? `<img class="pl-dark" src="${esc(o.logoDark)}" alt="${esc(o.name)}">` : ''}</span>`
      : `<span class="p-text">${esc(o.name)}</span>`;
    return o.url ? `<a class="partner" href="${esc(o.url)}" target="_blank" rel="noopener" aria-label="${esc(o.name)}">${inner}</a>` : `<div class="partner" role="img" aria-label="${esc(o.name)}">${inner}</div>`;
  };
  const row = [...PARTNERS, ...PARTNERS, ...PARTNERS].map(item).join('');
  // Duplicate row for a seamless loop; the copy is hidden from assistive tech
  $('#marquee').innerHTML = `<div class="marquee-track">${row}<div style="display:contents" aria-hidden="true">${row}</div></div>`;
}

/* ---- WhatsApp button + intro video (both appear only once set in Dashboard → Settings) ---- */
const EXTRAS = { whatsapp: String(CONFIG.whatsapp || '').replace(/\D/g, ''), intro: (String(CONFIG.introVideo || '').match(/[A-Za-z0-9_-]{11}$/) || [''])[0] };
const WA_ICON = '<svg class="wa-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>';
const PLAY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
const trNode = root => { root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); }); root.querySelectorAll('[data-i18n-aria]').forEach(el => el.setAttribute('aria-label', t(el.dataset.i18nAria))); };
const ytFrame = id => '<iframe src="https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0&modestbranding=1&playsinline=1" title="Eng Yuyu" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>';
const playerHtml = id => '<div class="intro-player"><button class="intro-play" type="button" data-id="' + id + '" data-i18n-aria="intro.play" aria-label="Play"><img src="https://i.ytimg.com/vi/' + id + '/maxresdefault.jpg" alt="" loading="lazy" width="1280" height="720" data-fb="https://i.ytimg.com/vi/' + id + '/hqdefault.jpg"><span class="play-ico">' + PLAY_ICON + '</span><span class="intro-len" data-i18n="intro.watch">Watch the intro</span></button></div>';
// WhatsApp: a chat popup (home + consulting open it once by themselves), a floating button everywhere, and links in the
// footer / contact section. Messages come from Dashboard → Settings → WhatsApp and include the session being viewed.
const waText = kind => {
  const w = EXTRAS.wa || {}, tpl = ((w[kind] || {})[lang]) || t('wa.def.' + kind);
  const s = document.body.dataset.page === 'consulting' && typeof curSession === 'function' ? curSession() : null;
  const out = tpl.replace(/\{session\}/g, s ? pick(s)[0] : t('wa.anySession')).replace(/\{price\}/g, s ? '(' + price(s) + ')' : '').replace(/\{link\}/g, location.origin + '/book' + (s ? '/' + s.id : ''));
  return out.replace(/\s+([.,?!:])/g, '$1').replace(/\s{2,}/g, ' ').trim();
};
const waLink = kind => 'https://wa.me/' + EXTRAS.whatsapp + '?text=' + encodeURIComponent(waText(kind));
function waPopup(open, auto) {
  const pop = document.getElementById('waPop'), fab = document.querySelector('.wa-fab'); if (!pop || !fab) return;
  if (open) {
    pop.querySelector('[data-wa="book"]').href = waLink('book'); pop.querySelector('[data-wa="ask"]').href = waLink('ask');
    pop.hidden = false; requestAnimationFrame(() => pop.classList.add('on')); fab.setAttribute('aria-expanded', 'true');
    if (!auto) pop.querySelector('.wa-act').focus({ preventScroll: true });
    track(auto ? 'wa_popup_auto' : 'wa_popup_open');
  } else { pop.classList.remove('on'); fab.setAttribute('aria-expanded', 'false'); setTimeout(() => { pop.hidden = true; }, reduceMotion.matches ? 0 : 200); }
}
function renderExtras() {
  const num = EXTRAS.whatsapp, w = EXTRAS.wa || {}, page = document.body.dataset.page;
  if (!num) { document.querySelectorAll('.js-wa, .wa-fab, #waPop').forEach(n => n.remove()); }
  else {
    if (!document.querySelector('.wa-fab')) {
      const fab = document.createElement('button'); fab.type = 'button'; fab.className = 'wa-fab'; fab.setAttribute('aria-controls', 'waPop'); fab.setAttribute('aria-expanded', 'false'); fab.setAttribute('data-i18n-aria', 'wa.pop.label'); fab.innerHTML = WA_ICON;
      const pop = document.createElement('div'); pop.className = 'wa-pop'; pop.id = 'waPop'; pop.hidden = true; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-labelledby', 'waPopName');
      pop.innerHTML = '<div class="wa-head"><img class="wa-av" src="/assets/yuyu-blue-600.png" alt="" width="44" height="44"><div class="wa-who"><b id="waPopName">Eng Yuyu</b><small><i class="wa-dot" aria-hidden="true"></i><span class="wa-reply"></span></small></div><button type="button" class="wa-x" data-i18n-aria="wa.pop.close" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>'
        + '<div class="wa-body"><p class="wa-bubble"></p></div>'
        + '<div class="wa-acts"><a class="wa-act wa-primary" data-wa="site" href="/consulting.html#book"><span data-i18n="wa.pop.book">Book a session online</span></a><a class="wa-act wa-green" data-wa="book" target="_blank" rel="noopener">' + WA_ICON + '<span data-i18n="wa.pop.bookWa">Book on WhatsApp</span></a><a class="wa-act" data-wa="ask" target="_blank" rel="noopener"><span data-i18n="wa.pop.ask">Ask a question</span></a></div>';
      document.body.append(pop, fab);
      fab.addEventListener('click', () => waPopup(pop.hidden));
      pop.querySelector('.wa-x').addEventListener('click', () => { waPopup(false); store.set('yy-wa-pop', String(Date.now())); fab.focus(); });
      pop.addEventListener('keydown', e => { if (e.key === 'Escape') { waPopup(false); fab.focus(); } });
      pop.addEventListener('click', e => {
        const act = e.target.closest('[data-wa]'); if (!act) return;
        track('wa_' + act.dataset.wa); store.set('yy-wa-pop', String(Date.now()));
        if (act.dataset.wa === 'site' && page === 'consulting') { e.preventDefault(); waPopup(false); const bk = document.getElementById('sessions') || document.getElementById('book'); if (bk) bk.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' }); }
      });
      const a = (cls, inner) => { const el = document.createElement('a'); el.className = 'js-wa ' + cls; el.target = '_blank'; el.rel = 'noopener'; el.innerHTML = inner; return el; };
      const fn = document.querySelector('.foot-nav'); if (fn) fn.appendChild(a('', '<span data-i18n="wa.chat">Chat on WhatsApp</span>'));
      const mail = document.querySelector('#contact .mail'); if (mail) { const p = document.createElement('p'); p.className = 'wa-line'; p.append(a('wa-inline', WA_ICON + '<span data-i18n="wa.prefer">Prefer WhatsApp? Message me directly.</span>')); mail.after(p); }
      trNode(document.body);
      // the popup opens by itself once on the home and consulting pages (not again for 3 days after it is closed or used)
      const last = +store.get('yy-wa-pop') || 0, back = new URLSearchParams(location.search).has('order_id');
      if (w.popup !== false && (page === 'home' || page === 'consulting') && !back && Date.now() - last > 3 * 864e5)
        setTimeout(() => { if (pop.hidden && !document.querySelector('dialog[open]') && document.getElementById('payStatus')?.hidden !== false) { waPopup(true, true); store.set('yy-wa-pop', String(Date.now())); } }, Math.max(0, +w.delay || 8) * 1000);
    }
    const pop = document.getElementById('waPop');
    if (pop) { pop.querySelector('.wa-bubble').textContent = ((w.greeting || {})[lang]) || t('wa.def.greeting'); pop.querySelector('.wa-reply').textContent = ((w.reply || {})[lang]) || t('wa.def.reply'); }
    document.querySelectorAll('.js-wa').forEach(n => { n.href = waLink('ask'); });
  }
  const id = EXTRAS.intro;
  if (!id) { document.querySelectorAll('.js-intro').forEach(n => n.remove()); return; }
  if (document.querySelector('.js-intro')) return;
  if (page === 'home') {
    const s = document.createElement('section'); s.className = 'section intro js-intro'; s.id = 'intro'; s.setAttribute('aria-labelledby', 'intro-title');
    s.innerHTML = '<div class="wrap intro-grid"><div class="intro-copy"><p class="kicker" data-i18n="intro.k">Start here</p><h2 id="intro-title" data-i18n="intro.t">Who I am and how a session works</h2><p class="muted" data-i18n="intro.p"></p><ul class="intro-points"><li data-i18n="intro.b1"></li><li data-i18n="intro.b2"></li><li data-i18n="intro.b3"></li></ul><a class="btn btn-primary" href="consulting.html#book"><span data-i18n="cta.book">Book a consultation</span></a></div>' + playerHtml(id) + '</div>';
    const anchor = document.querySelector('.audience'); if (anchor) anchor.before(s); else return; trNode(s);
  } else if (page === 'consulting') {
    const head = document.querySelector('#book .sec-head'); if (!head) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-ghost intro-btn js-intro'; b.innerHTML = PLAY_ICON + '<span data-i18n="intro.btn">Watch: how a session works</span>'; head.appendChild(b);
    const d = document.createElement('dialog'); d.className = 'ev-dlg intro-dlg js-intro'; d.setAttribute('aria-label', 'Intro video');
    d.innerHTML = '<button class="icon-btn ev-x" type="button" data-i18n-aria="intro.close" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button><div class="intro-player intro-frame"></div>';
    document.body.appendChild(d);
    const frame = d.querySelector('.intro-frame'), shut = () => { frame.innerHTML = ''; d.close(); };
    b.onclick = () => { frame.innerHTML = ytFrame(id); d.showModal(); track('intro_play'); };
    d.querySelector('.ev-x').onclick = shut; d.addEventListener('click', e => { if (e.target === d) shut(); }); d.addEventListener('cancel', () => { frame.innerHTML = ''; });
    trNode(b); trNode(d);
  }
}
// image fallbacks and the search form use listeners (no inline handlers) so the Content-Security-Policy can forbid them
document.addEventListener('error', e => { const i = e.target; if (i && i.tagName === 'IMG' && i.dataset.fb && !i.dataset.fbd) { i.dataset.fbd = '1'; i.src = i.dataset.fb; } }, true);
document.querySelectorAll('form.s-box').forEach(f => f.addEventListener('submit', e => e.preventDefault()));
document.addEventListener('click', e => {
  if (e.target.closest('.js-wa')) track('whatsapp_click');
  const p = e.target.closest('.intro-play'); if (p) { p.parentElement.innerHTML = ytFrame(p.dataset.id); track('intro_play'); }
});

/* =================================================================
   PARTNER ADS (blog pages): a sliding showcase of 10–15 second partner clips / animated cards.
   Managed in Dashboard → Content → Partner ads. Every ad is labelled "Sponsored" and links with rel="sponsored".
   Auto-advances by each ad's own length; pauses on hover/focus, off-screen, hidden tab or when the visitor presses pause.
   Reduce-motion: no auto-advance or autoplay (clips show a poster with normal controls).
   ================================================================= */
// abstract, logo-free animated scenes for ads that have no video (each runs a 15 s loop while its slide is showing)
const AD_SCENES = {
  phone: '<div class="sc"><i class="floor"></i><div class="dev"><div class="body"><i class="rim"></i><div class="cam"><i class="lens l1"></i><i class="lens l2"></i><i class="lens l3"></i><i class="fl"></i><i class="ldr"></i></div><i class="shine"></i></div></div><i class="bk b1"></i><i class="bk b2"></i><i class="bk b3"></i><i class="bk b4"></i></div>',
  shield: '<div class="sc"><svg class="shd" viewBox="0 0 160 190" aria-hidden="true"><defs><linearGradient id="adgA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eafff4"/><stop offset=".4" stop-color="#52e8a0"/><stop offset="1" stop-color="#0a5c3b"/></linearGradient><linearGradient id="adgB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1fbf7b"/><stop offset="1" stop-color="#06402a"/></linearGradient><linearGradient id="adgC" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><path class="sh-out" fill="url(#adgA)" d="M80 8 20 30v58c0 50 26 80 60 94 34-14 60-44 60-94V30z"/><path class="sh-in" fill="url(#adgB)" d="M80 22 34 39v49c0 40 20 64 46 76 26-12 46-36 46-76V39z"/><path class="sh-gloss" fill="url(#adgC)" d="M80 22 34 39v49c0 12 2 22 6 31 20-29 50-59 86-67V39z"/><path class="sh-tick" d="M52 94 72 114 110 68"/></svg><i class="beam"></i><i class="ring r1"></i><i class="ring r2"></i><i class="thr t1"></i><i class="thr t2"></i><i class="thr t3"></i><i class="thr t4"></i><i class="thr t5"></i></div>',
  wallet: '<div class="sc"><i class="floor"></i><div class="wal"><i class="card ca"></i><i class="card cb"></i><div class="body"><i class="stitch"></i><i class="flap"></i><i class="clasp"></i></div></div><i class="coin c1"><b></b></i><i class="coin c2"><b></b></i><i class="coin c3"><b></b></i><i class="coin c4"><b></b></i><i class="spark s1"></i><i class="spark s2"></i><i class="spark s3"></i></div>',
};
const scene = k => AD_SCENES[k] || '';
// the 15 s story laid over a scene: 3 feature captions with a moving highlight, then a chat-style "message sent" end card
const story = (a, title, text, cta) => {
  const caps = ((a.caps && a.caps[lang === 'so' ? 'so' : 'en']) || []).filter(Boolean).slice(0, 3);
  return (caps.length ? '<i class="callout"></i><ol class="caps">' + caps.map((c, i) => '<li class="cap' + (i + 1) + '">' + esc(c) + '</li>').join('') + '</ol>' : '')
    + '<div class="endcard"><div class="chat"><span class="typing"><i></i><i></i><i></i></span><p class="msg">' + esc(text || title) + '</p><span class="sent">✓✓ ' + esc(t('ad.sent')) + '</span></div><span class="end-cta">' + esc(cta) + '</span></div>';
};
function renderAds() {
  const slot = document.getElementById('adSlot'); if (!slot) return;
  const real = ADS.filter(a => a.enabled !== false && a.partner && pick(a)[0]);
  const ads = real.concat([{ house: true, id: 'house', seconds: 10 }]);   // the last slide always invites advertisers
  slot.innerHTML = ''; if (slot._stop) { slot._stop(); slot._stop = null; }
  const still = reduceMotion.matches, hasVideo = real.some(a => a.video), n = ads.length;
  const logo = a => a.logo ? `<img class="ad-logo" src="${esc(a.logo)}" alt="" loading="lazy">` : `<span class="ad-logo-txt">${esc(a.partner)}</span>`;
  const houseSlide = i => `<article class="ad-slide ad-house" role="group" aria-roledescription="slide" aria-label="${i + 1} / ${n}" data-id="house"><div class="ad-media"><div class="ad-anim th-blue house" aria-hidden="true"><i class="a1"></i><i class="a2"></i><i class="a3"></i><div class="hs"><div class="frame"><span class="plus">+</span><b>${esc(t('ad.yours'))}</b><small>9:16 · 15 s</small></div><div class="stat"><b>1M+</b><span>${esc(t('ad.reach'))}</span></div></div></div></div><div class="ad-copy"><h3>${esc(t('ad.yours'))}</h3><p>${esc(t('ad.yoursText'))}</p><a class="btn btn-primary btn-sm" href="/?type=partner#contact" data-ad="house">${esc(t('ad.yoursCta'))}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a></div><span class="ad-bar" aria-hidden="true"><b></b></span></article>`;
  const slide = (a, i) => {
    if (a.house) return houseSlide(i);
    const [title, text] = pick(a), cta = (lang === 'so' ? a.cta[1] : a.cta[0]) || t('ad.cta');
    const media = a.video
      ? `<video class="ad-video" muted playsinline ${still ? 'controls' : 'loop'} preload="${i === 0 ? 'auto' : 'metadata'}" ${a.poster ? `poster="${esc(a.poster)}"` : ''} aria-label="${esc(title)}"><source src="${esc(a.video)}" type="video/${a.video.endsWith('.webm') ? 'webm' : 'mp4'}"></video>`
      : `<div class="ad-anim th-${esc(a.theme || 'blue')} ${a.scene ? 'has-scene sc-' + esc(a.scene) : ''}" aria-hidden="true"><i class="a1"></i><i class="a2"></i><i class="a3"></i><div class="ad-mark">${logo(a)}</div>${scene(a.scene)}${a.scene ? story(a, title, text, cta) : ''}</div>`;
    return `<article class="ad-slide" role="group" aria-roledescription="slide" aria-label="${i + 1} / ${n}" data-id="${esc(a.id || '')}">
      <div class="ad-media">${media}</div>
      <div class="ad-copy"><h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}${a.url ? `<a class="btn btn-primary btn-sm" href="${esc(a.url)}" target="_blank" rel="sponsored noopener noreferrer" data-ad="${esc(a.id || '')}">${esc(cta)}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>` : ''}</div>
      <span class="ad-bar" aria-hidden="true"><b></b></span></article>`;
  };
  slot.innerHTML = `<section class="ad-slider" aria-roledescription="carousel" aria-label="${esc(t('ad.sponsored'))}">
    <div class="ad-head"><span class="ad-badge">${esc(t('ad.sponsored'))}</span></div>
    <div class="ad-track" tabindex="0" aria-live="off">${ads.map(slide).join('')}</div>
    <div class="ad-dots" role="tablist">${ads.map((_, i) => `<button type="button" role="tab" data-i="${i}" aria-label="${i + 1} / ${n}" aria-selected="${i === 0}"></button>`).join('')}</div>
    <div class="ad-ctrl">${hasVideo ? `<button type="button" class="icon-btn" data-ad-mute aria-pressed="true" aria-label="${esc(t('ad.unmute'))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path class="snd" d="M16 9a4 4 0 0 1 0 6M18.500 6.500a8 8 0 0 1 0 11"/><path class="mute" d="m17 9 4 6M21 9l-4 6"/></svg></button>` : ''}
      ${still ? '' : `<button type="button" class="icon-btn" data-ad-pause aria-pressed="false" aria-label="${esc(t('ad.pause'))}"><svg class="i-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg><svg class="i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></button>`}
      <button type="button" class="icon-btn" data-ad-prev aria-label="${esc(t('ad.prev'))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg></button>
      <button type="button" class="icon-btn" data-ad-next aria-label="${esc(t('ad.next'))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button></div></section>`;
  const root = slot.firstElementChild; if (n < 2) root.classList.add('single');
  const badge = root.querySelector('.ad-badge'), track = root.querySelector('.ad-track'), slides = [...track.children], dots = [...root.querySelectorAll('.ad-dots button')];
  slides.forEach(sl => { const v = sl.querySelector('video'); if (v) v.addEventListener('loadedmetadata', () => { if (v.videoWidth && v.videoWidth / v.videoHeight > 0.7) v.classList.add('is-wide'); }); });   // a landscape clip is shown whole (not cropped) on a dark card
  const viewed = new Set(); let cur = 0, elapsed = 0, paused = false, hover = false, focus = false, muted = true;
  const dur = i => Math.min(15, Math.max(10, +ads[i].seconds || 12)) * 1000;
  const vid = i => slides[i].querySelector('video');
  const activate = (i, scroll) => {
    cur = (i + n) % n; elapsed = 0;
    slides.forEach((s, k) => { s.classList.toggle('is-active', k === cur); const v = vid(k); if (v && k !== cur) { v.pause(); v.currentTime = 0; } });
    dots.forEach((d, k) => d.setAttribute('aria-selected', k === cur)); badge.textContent = ads[cur].house ? t('ad.advertise') : t('ad.sponsored');
    if (scroll) track.scrollTo({ left: cur * track.clientWidth, behavior: still ? 'auto' : 'smooth' });
    const v = vid(cur); if (v && !still) { v.muted = muted; v.play().catch(() => {}); }
  };
  const onScreen = () => { const r = root.getBoundingClientRect(); return r.top < innerHeight * 0.85 && r.bottom > innerHeight * 0.15; };
  const timer = setInterval(() => {
    const live = onScreen() && !document.hidden;
    const v = vid(cur); if (v && !still) { if (live && !paused && !hover && !focus) { if (v.paused) v.play().catch(() => {}); } else if (!v.paused) v.pause(); }
    if (live && !viewed.has(cur) && ads[cur].id) { viewed.add(cur); track('adv_' + ads[cur].id); }
    if (still || paused || hover || focus || !live || n < 2) return;
    elapsed += 250; slides[cur].style.setProperty('--p', Math.min(1, elapsed / dur(cur)));
    if (elapsed >= dur(cur)) activate(cur + 1, true);
  }, 250);
  slot._stop = () => clearInterval(timer);
  root.querySelector('[data-ad-next]').onclick = () => activate(cur + 1, true);
  root.querySelector('[data-ad-prev]').onclick = () => activate(cur - 1, true);
  dots.forEach(d => d.onclick = () => activate(+d.dataset.i, true));
  const pb = root.querySelector('[data-ad-pause]');
  if (pb) pb.onclick = () => { paused = !paused; pb.setAttribute('aria-pressed', paused); pb.setAttribute('aria-label', t(paused ? 'ad.play' : 'ad.pause')); };
  const mb = root.querySelector('[data-ad-mute]');
  if (mb) mb.onclick = () => { muted = !muted; mb.setAttribute('aria-pressed', muted); mb.setAttribute('aria-label', t(muted ? 'ad.unmute' : 'ad.mute')); const v = vid(cur); if (v) v.muted = muted; };
  root.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') hover = true; }); root.addEventListener('pointerleave', () => { hover = false; });
  root.addEventListener('focusin', () => { focus = true; }); root.addEventListener('focusout', () => { focus = false; });
  let raf = 0; track.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth)); if (i !== cur && i >= 0 && i < n) activate(i, false); }); }, { passive: true });
  track.addEventListener('keydown', e => { if (e.key === 'ArrowRight') { e.preventDefault(); activate(cur + 1, true); } if (e.key === 'ArrowLeft') { e.preventDefault(); activate(cur - 1, true); } });
  root.addEventListener('click', e => { const a = e.target.closest('[data-ad]'); if (a && a.dataset.ad) track('adc_' + a.dataset.ad); });
  addEventListener('resize', () => track.scrollTo({ left: cur * track.clientWidth }), { passive: true });
  activate(0, false);
}
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

/* =====================================================================
   Theme / language / menu
   ===================================================================== */
const root = document.documentElement;
// Smooth state changes: cross-fade the whole page (View Transitions), with a CSS-transition fallback
const smooth = fn => {
  if (document.startViewTransition && !reduceMotion.matches && !document.hidden) {
    try { const vt = document.startViewTransition(fn); [vt.ready, vt.finished, vt.updateCallbackDone].forEach(p => p && p.catch(() => {})); return; } catch { /* fall through */ }
  }
  root.classList.add('theme-anim'); fn(); setTimeout(() => root.classList.remove('theme-anim'), 450);
};
$('#themeBtn').addEventListener('click', () => smooth(() => {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next; store.set('yy-theme', next);
  document.querySelector('meta[name="theme-color"]').content = next === 'dark' ? '#06111F' : '#FFFFFF';
  nets.forEach(n => n.recolor());
}));
$('#langBtn').addEventListener('click', () => { if (document.body.dataset.page === 'blog' && document.body.dataset.alt) { location.href = document.body.dataset.alt; return; } smooth(() => { lang = lang === 'en' ? 'so' : 'en'; store.set('yy-lang', lang); applyLang(); }); });
// mobile: floating "Book a consultation" button (the header CTA is hidden on small screens)
if (document.body.dataset.page !== 'consulting') {
  const m = document.createElement('a'); m.className = 'm-cta'; m.href = '/consulting.html#book';
  m.innerHTML = '<span data-i18n="cta.book">Book a consultation</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  document.body.appendChild(m);
  const upd = () => m.classList.toggle('show', scrollY > 520 && innerHeight + scrollY < document.documentElement.scrollHeight - 460);
  addEventListener('scroll', upd, { passive: true }); upd();
}
// header gains depth once the page scrolls
const headEl = $('.site-header'); let scrolled = false;
addEventListener('scroll', () => { const s = scrollY > 8; if (s !== scrolled) { scrolled = s; headEl.classList.toggle('scrolled', s); } }, { passive: true });

// Logo = home: smooth-scroll to top and clear any #section from the URL
if (isHome) $$('.brand').forEach(b => b.addEventListener('click', e => {
  e.preventDefault(); setMenu(false);
  scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  history.replaceState(null, '', location.pathname + location.search);
}));

const menuBtn = $('#menuBtn'), nav = $('#nav');
const setMenu = open => { nav.classList.toggle('open', open); menuBtn.setAttribute('aria-expanded', open); };
menuBtn.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
nav.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

// Active nav link on scroll
const navLinks = $$('.nav a');
const navIds = [];   // nav links are page links now
const spy = new IntersectionObserver(es => es.forEach(en => {
  if (en.isIntersecting) navLinks.forEach(a => a.classList.toggle('active', navIds.includes(en.target.id) && a.getAttribute('href') === '#' + en.target.id));
}), { rootMargin: '-45% 0px -50% 0px' });
if (isHome) $$('main > section').forEach(s => spy.observe(s));

/* =====================================================================
   Live stats
   ===================================================================== */
const stats = { ...CONFIG.sample };
let statsSource = 'sample', lastUpdate = null;
const shown = {}; // currently displayed (animated) values
const sum = s => s.youtube + s.facebook + s.tiktok + s.instagram;

function targetFor(key) { return key === 'followers' ? sum(stats) : stats[key]; }
function label(key, v) { return key === 'followers' ? fmtNum(v) + '+' : key === 'views' ? fmtNum(v) + '+' : fmtNum(v); }
function paintStats() {
  $$('[data-count]').forEach(el => { const k = el.dataset.count; el.textContent = label(k, shown[k] ?? targetFor(k)); });
  const u = $('#updated');
  u.removeAttribute('data-i18n');
  u.textContent = statsSource === 'live' && lastUpdate
    ? `${t('aud.updated')} ${lastUpdate.toLocaleTimeString(lang === 'so' ? 'so' : 'en', { hour: '2-digit', minute: '2-digit' })}`
    : t('aud.sample');
}
function animateTo(key, to, dur = 1400) {
  const els = $$(`[data-count="${key}"]`); if (!els.length) return;
  const from = shown[key] ?? 0;
  if (reduceMotion.matches || from === to) { shown[key] = to; els.forEach(e => e.textContent = label(key, to)); return; }
  const t0 = performance.now();
  const step = now => {
    const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 4);
    shown[key] = from + (to - from) * e;
    els.forEach(el => el.textContent = label(key, shown[key]));
    if (p < 1) requestAnimationFrame(step); else shown[key] = to;
  };
  requestAnimationFrame(step);
}
function refreshAll(animate) {
  ['followers', 'views', 'youtube', 'facebook', 'tiktok', 'instagram'].forEach(k => animate ? animateTo(k, targetFor(k)) : (shown[k] = targetFor(k)));
  paintStats();
}
async function pollStats() {
  if (!CONFIG.statsEndpoint) return;
  try {
    const r = await fetch(CONFIG.statsEndpoint, { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    ['youtube', 'facebook', 'tiktok', 'instagram', 'views'].forEach(k => { if (Number.isFinite(d[k])) stats[k] = d[k]; });
    statsSource = 'live'; lastUpdate = new Date();
    refreshAll(true);
  } catch { /* keep last known values */ }
}
// count up the first time the audience strip / hero is on screen
let statsStarted = false;
function startStats() { if (statsStarted) return; statsStarted = true; refreshAll(true); pollStats(); setInterval(pollStats, CONFIG.pollMs); }

/* =====================================================================
   Particle network
   ===================================================================== */
const nets = [];
function createNet(canvas, opts) {
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1, pts = [], raf = 0, visible = true, rgb = opts.rgb();
  const mouse = { x: -9999, y: -9999 };
  const parent = canvas.parentElement;

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2); w = r.width; h = r.height;
    canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.max(24, Math.min(opts.max, Math.round(w * h / opts.density)));
    pts = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35, r: Math.random() * 1.4 + .8 }));
    draw();
  }
  function draw() {
    ctx.clearRect(0, 0, w, h);
    const link = opts.link;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      for (let j = i + 1; j < pts.length; j++) {
        const b = pts[j], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < link) { ctx.strokeStyle = `rgba(${rgb},${(1 - d / link) * opts.lineAlpha})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      }
      const md = Math.hypot(a.x - mouse.x, a.y - mouse.y);
      if (md < 150) { ctx.strokeStyle = `rgba(${rgb},${(1 - md / 150) * .55})`; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke(); }
      ctx.fillStyle = `rgba(${rgb},${opts.dotAlpha})`; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 6.283); ctx.fill();
    }
  }
  function tick() {
    for (const p of pts) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
      const dx = p.x - mouse.x, dy = p.y - mouse.y, d = Math.hypot(dx, dy);
      if (d < 110 && d > 0) { p.x += dx / d * .6; p.y += dy / d * .6; } // gentle repel
    }
    draw();
    raf = visible && !reduceMotion.matches && !document.hidden ? requestAnimationFrame(tick) : 0;
  }
  const start = () => { if (!raf && visible && !reduceMotion.matches && !document.hidden) raf = requestAnimationFrame(tick); };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); }).observe(parent);
  document.addEventListener('visibilitychange', start);
  parent.addEventListener('pointermove', e => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
  parent.addEventListener('pointerleave', () => { mouse.x = mouse.y = -9999; });
  let rt; new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(resize, 120); }).observe(canvas);
  reduceMotion.addEventListener?.('change', () => { reduceMotion.matches ? draw() : start(); });
  resize(); start();
  const api = { recolor() { rgb = opts.rgb(); draw(); } };
  nets.push(api); return api;
}
const cssRGB = () => getComputedStyle(root).getPropertyValue('--particle').trim() || '76,154,255';
if (has('#net')) createNet($('#net'), { rgb: cssRGB, density: 9000, max: innerWidth < 700 ? 42 : 110, link: 130, lineAlpha: .32, dotAlpha: .75 });
if (has('#nlNet')) createNet($('#nlNet'), { rgb: () => '255,255,255', density: 11000, max: 60, link: 110, lineAlpha: .28, dotAlpha: .6 });

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

/* =====================================================================
   Blog filter, forms
   ===================================================================== */
if (has('#blogFilters')) $('#blogFilters').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  blogFilter = b.dataset.cat; renderBlog(); $(`.chip[data-cat="${blogFilter}"]`).focus();
});

const validEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const nlForm = $('#nlForm'), nlMsg = $('#nlMsg'), nlEmail = $('#nlEmail');
function say(el, text, ok) { el.textContent = text; el.classList.toggle('ok', ok); el.classList.toggle('bad', !ok); }
if (has('#nlForm')) nlForm.addEventListener('submit', async e => {
  e.preventDefault();
  const email = nlEmail.value.trim();
  if (!validEmail(email)) { nlEmail.setAttribute('aria-invalid', 'true'); say(nlMsg, t('nl.bad'), false); nlEmail.focus(); return; }
  nlEmail.removeAttribute('aria-invalid');
  const btn = nlForm.querySelector('button'); btn.disabled = true;
  try {
    if (API || CONFIG.newsletterEndpoint) {
      const r = await fetch(API ? API + '/api/subscribe' : CONFIG.newsletterEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ email, lang, source: document.body.dataset.page }) });
      if (!r.ok) throw new Error(r.status);
      say(nlMsg, API ? t('nl.done') : t('nl.ok'), true); nlForm.reset(); track('newsletter');
    } else { // no provider connected yet: hand off to the user's mail app rather than pretend it saved
      say(nlMsg, t('nl.mail'), true);
      location.href = `mailto:${CONFIG.email}?subject=${encodeURIComponent('Newsletter subscription')}&body=${encodeURIComponent('Please subscribe: ' + email)}`;
    }
  } catch { say(nlMsg, t('nl.err'), false); }
  btn.disabled = false;
});

/* ---------- "Invite me to speak" form (events page) ---------- */
if (has('#inviteForm')) {
  const f = $('#inviteForm'), msg = $('#invMsg');
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const v = id => $('#' + id).value.trim(), name = v('invName'), mail = v('invEmail'), org = v('invOrg'), type = $('#invType').selectedOptions[0].textContent, when = v('invDate'), where = v('invPlace'), size = v('invSize'), note = v('invNote');
    const bad = [fieldErr('invName', name ? '' : t('ct.eName')), fieldErr('invEmail', validEmail(mail) ? '' : t('ct.eEmail')), fieldErr('invNote', note ? '' : t('ev.inv.eMsg'))];
    if (bad.includes(false)) { f.querySelector('[aria-invalid="true"]').focus(); return; }
    const message = [`Event type: ${type}`, org && `Organisation: ${org}`, when && `Date: ${when}`, where && `Place: ${where}`, size && `Audience size: ${size}`, '', note].filter(x => x !== '' ? Boolean(x) : true).join('\n');
    const btn = f.querySelector('button[type="submit"]'); btn.disabled = true;
    try {
      if (API) {
        const r = await fetch(API + '/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email: mail, type: 'events', message, lang }) });
        if (!r.ok) throw new Error(r.status);
        say(msg, t('ev.inv.sent'), true); f.reset(); track('invite');
      } else { say(msg, t('ct.ok'), true); location.href = `mailto:${CONFIG.email}?subject=${encodeURIComponent('Event invitation: ' + type + (org ? ', ' + org : ''))}&body=${encodeURIComponent(message + '\n\n- ' + name + ' (' + mail + ')')}`; }
    } catch { say(msg, t('nl.err'), false); }
    btn.disabled = false;
  });
  f.querySelectorAll('input, textarea').forEach(el => el.addEventListener('input', () => { if (el.getAttribute('aria-invalid') === 'true') { el.setAttribute('aria-invalid', 'false'); const er = $('#' + el.id + '-e'); if (er !== NULL) er.textContent = ''; } }));
}
const ctForm = $('#ctForm');
function fieldErr(id, msg) { const f = $('#' + id), e = $('#' + id + '-e'); f.setAttribute('aria-invalid', msg ? 'true' : 'false'); e.textContent = msg || ''; return !msg; }
if (has('#ctForm')) ctForm.addEventListener('submit', async e => {
  e.preventDefault();
  const name = $('#ctName').value.trim(), mail = $('#ctEmail').value.trim(), msg = $('#ctMsg').value.trim();
  const ok = [fieldErr('ctName', name ? '' : t('ct.eName')), fieldErr('ctEmail', validEmail(mail) ? '' : t('ct.eEmail')), fieldErr('ctMsg', msg ? '' : t('ct.eMsg'))];
  if (ok.includes(false)) { ctForm.querySelector('[aria-invalid="true"]').focus(); return; }
  const type = $('#ctType').selectedOptions[0].textContent;
  if (API) {   // backend: stored in the dashboard inbox, you get an email, the sender gets an automatic reply
    const btn = ctForm.querySelector('button[type="submit"]'); btn.disabled = true;
    try {
      const r = await fetch(API + '/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email: mail, type: $('#ctType').value, message: msg, lang }) });
      if (!r.ok) throw new Error(r.status);
      say($('#ctOk'), t('ct.sent'), true); ctForm.reset(); track('contact');
    } catch { say($('#ctOk'), t('nl.err'), false); }
    btn.disabled = false; return;
  }
  say($('#ctOk'), t('ct.ok'), true);
  location.href = `mailto:${CONFIG.email}?subject=${encodeURIComponent(`[${type}] ${name}`)}&body=${encodeURIComponent(msg + `\n\n- ${name} (${mail})`)}`;
});
$$('#ctForm input, #ctForm textarea').forEach(el => el.addEventListener('input', () => { if (el.getAttribute('aria-invalid') === 'true') { el.setAttribute('aria-invalid', 'false'); $('#' + el.id + '-e').textContent = ''; } }));


/* =====================================================================
   Scroll reveal + boot
   ===================================================================== */
function setupReveal() {
  const targets = $$('.sec-head, .plat, .pillar, .service, .process, .ev, .post, .com-link, .about-photo, .about-copy, .nl-card, .form, .split-intro, .com-copy');
  if (reduceMotion.matches || !('IntersectionObserver' in window)) return;
  targets.forEach(el => el.classList.add('reveal'));
  const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px' });
  targets.forEach((el, i) => { el.style.transitionDelay = (i % 4) * 60 + 'ms'; io.observe(el); });
  // content rendered later (blog filter) shouldn't stay hidden
  new MutationObserver(() => $$('.post:not(.reveal), .ev:not(.reveal)').forEach(el => el.classList.add('reveal', 'in'))).observe(document.body, { childList: true, subtree: true });
}

// "Book a consultation" / "Work With Me" preselect the contact form's interest (also via ?type= from other pages)
const setType = v => { const s = $('#ctType'); if (s !== NULL && v && [...s.options].some(o => o.value === v)) s.value = v; };
$$('a[data-type]').forEach(l => l.addEventListener('click', () => setType(l.dataset.type)));
document.addEventListener('click', e => { if (e.target.closest('a[href*="consulting.html#book"], a[href="#book"]')) track('book_click'); });
setType(new URLSearchParams(location.search).get('type'));
/* ---------- Consulting: session picker + Cal.com inline booking ---------- */
const price = s => s.price > 0 ? CONFIG.currency + s.price : t('cs.free');
let activeSession = (new URLSearchParams(location.search).get('session')) || SESSIONS[0].id;
function renderSessions() {
  const box = $('#sessions'); if (box === NULL) return;
  box.querySelectorAll('.session').forEach(n => n.remove());
  SESSIONS.filter(s => s.enabled !== false).forEach(s => {
    const id = 'sess-' + s.id;
    const el = document.createElement('div'); el.className = 'session';
    el.innerHTML = `<input type="radio" name="session" id="${id}" value="${s.id}" ${s.id === activeSession ? 'checked' : ''}>
      <label for="${id}"><span class="s-main"><b>${esc(pick(s)[0])}</b>${pick(s)[1] ? `<small>${esc(pick(s)[1])}</small>` : ''}${s.who ? `<em class="s-who">${esc(pick(s.who))}</em>` : ''}${s.inc ? `<ul class="s-inc" aria-label="${t('cs.included')}">${pick(s.inc).map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</span>
      <span class="s-meta"><span class="s-price">${esc(price(s))}</span><span class="s-min">${s.min} ${t('cs.min')}</span></span><span class="s-book">${esc(t('cs.bookBtn').replace('{p}', price(s)))}</span></label>`;
    box.appendChild(el);
  });
  try {   // structured data for search engines: the sessions (prices come from the dashboard) and the FAQ
    const ld = [{ '@context': 'https://schema.org', '@type': 'ProfessionalService', name: 'Eng Yuyu | 1:1 Digital Consulting', url: location.origin + '/consulting.html', provider: { '@type': 'Person', name: 'Eng Yuyu' }, areaServed: 'Worldwide', hasOfferCatalog: { '@type': 'OfferCatalog', name: '1:1 sessions', itemListElement: SESSIONS.filter(x => x.enabled !== false).map(x => ({ '@type': 'Offer', price: x.price, priceCurrency: 'USD', itemOffered: { '@type': 'Service', name: x.en[0], description: (x.inc ? x.inc.en : []).join('. ') + ' (' + x.min + ' minutes, online)' } })) } },
      { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: $$('.faq details').map(d => ({ '@type': 'Question', name: d.querySelector('summary').textContent.trim(), acceptedAnswer: { '@type': 'Answer', text: d.querySelector('p').textContent.trim() } })) }];
    let el = document.getElementById('ld-consulting'); if (!el) { el = document.createElement('script'); el.type = 'application/ld+json'; el.id = 'ld-consulting'; document.head.appendChild(el); }
    el.textContent = JSON.stringify(ld);
  } catch { /* optional */ }
  const hs = $('#heroSessions');
  if (hs !== NULL) hs.innerHTML = SESSIONS.filter(s => s.enabled !== false).map(s => `<li><span>${esc(pick(s)[0])}</span><em>${esc(price(s))} · ${s.min} ${t('cs.min')}</em></li>`).join('');
}
function loadCalScript() {
  if (window.Cal) return;
  (function (C, A, L) { const p = (a, ar) => a.q.push(ar), d = C.document; C.Cal = C.Cal || function () { const cal = C.Cal, ar = arguments; if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement('script')).src = A; cal.loaded = true; } if (ar[0] === L) { const api = function () { p(api, arguments); }, ns = ar[1]; api.q = api.q || []; if (typeof ns === 'string') { cal.ns[ns] = cal.ns[ns] || api; p(cal.ns[ns], ar); p(cal, ['initNamespace', ns]); } else p(cal, ar); return; } p(cal, ar); }; })(window, CONFIG.cal.origin + '/embed/embed.js', 'init');
  window.Cal('init', { origin: CONFIG.cal.origin });
}
/* Built-in scheduler: honours the availability rules (days, hours, 24h notice, Mogadishu time) */
const AV = CONFIG.availability;
const curSession = () => SESSIONS.find(x => x.id === activeSession) || SESSIONS[0];
const fmtTz = (ms, o, tz) => new Intl.DateTimeFormat(lang === 'so' ? 'so' : 'en', { timeZone: tz, ...o }).format(ms);
function buildDays(s) {
  const out = [], min = Date.now() + AV.minNoticeHours * 3600e3;
  for (let i = 0; i < AV.horizonDays; i++) {
    const e = new Date(Date.now() + i * 864e5 + AV.tz * 3600e3);          // shifted into Mogadishu time
    if (!AV.days.includes(e.getUTCDay())) continue;
    const y = e.getUTCFullYear(), m = e.getUTCMonth(), d = e.getUTCDate(), slots = [];
    for (let mins = AV.start * 60; mins + s.min <= AV.end * 60; mins += AV.step) {
      const start = Date.UTC(y, m, d, 0, mins - AV.tz * 60);
      if (start >= min) slots.push(start);
    }
    if (slots.length) out.push({ key: y + '-' + m + '-' + d, slots });
  }
  return out;
}
const API = (() => { let v = new URLSearchParams(location.search).get('api'); try { if (v) sessionStorage.setItem('yy-api', v); else v = sessionStorage.getItem('yy-api'); } catch {} const own = document.body.hasAttribute('data-api') ? (document.body.dataset.api || location.origin) : ''; return (v || own || CONFIG.api || '').replace(/\/$/, ''); })();
let apiCfg = { paymentRequired: false }, apiCfgLoaded = false;
let selDay = null, selSlot = null, remoteDays = null;
async function loadRemote() {
  remoteDays = null; renderNative();
  if (!apiCfgLoaded) { try { apiCfg = await (await fetch(API + '/api/config')).json(); apiCfgLoaded = true; updatePay(); } catch { /* keep defaults */ } }
  try {
    const r = await fetch(API + '/api/slots?session=' + encodeURIComponent(activeSession), { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status);
    remoteDays = (await r.json()).days;
  } catch { remoteDays = []; }
  renderNative();
}
function renderNative() {
  const box = $('#nativeBook'); if (box === NULL || box.hidden) return;
  const s = curSession(), days = API ? (remoteDays || []) : buildDays(s);
  if (!days.some(d => d.key === selDay)) { selDay = null; selSlot = null; }
  $('#availNote').textContent = t('cs.avail');
  $('#dateRow').innerHTML = days.length ? days.map(d => `<button type="button" class="chip" data-day="${d.key}" aria-pressed="${d.key === selDay}">${esc(fmtTz(d.slots[0], { weekday: 'short', day: 'numeric', month: 'short' }, AV.tzId))}</button>`).join('') : `<p class="empty">${API && remoteDays === null ? t('cs.n.loading') : t('cs.n.none')}</p>`;
  const day = days.find(d => d.key === selDay);
  $('#slotWrap').hidden = !day;
  $('#slotGrid').innerHTML = day ? day.slots.map(ms => `<button type="button" class="chip slot" data-slot="${ms}" aria-pressed="${ms === selSlot}">${fmtTz(ms, { hour: '2-digit', minute: '2-digit', hour12: false }, AV.tzId)}</button>`).join('') : '';
  const sum = $('#slotLocal');
  if (selSlot) {
    const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    sum.textContent = t('cs.n.yours') + ': ' + fmtTz(selSlot, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }, localTz) + ' (' + localTz.replace('_', ' ') + ')';
  } else sum.textContent = '';
  $('#reqForm').hidden = !selSlot;
  const bs = $('#bookSummary');   // what you're booking: so a different session or time is never picked by accident
  if (selSlot && bs !== NULL) bs.innerHTML = `<div><b>${esc(pick(s)[0])}</b> · ${s.min} ${t('cs.min')} · <b>${esc(price(s))}</b><br><span>${esc(fmtTz(selSlot, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false }, AV.tzId))} · ${esc(AV.tzName || 'Mogadishu time')}</span></div><a href="#book" class="bs-change">${esc(t('cs.change'))}</a>`;
  const pays = API && apiCfg.paymentRequired && s.price > 0;
  $('#reqForm').querySelector('button[type="submit"]').textContent = pays ? t('cs.n.pay').replace('{price}', price(s)) : t('cs.n.submit');
}
function calLinks(s, start, name) {
  const end = start + s.min * 60e3, z = ms => new Date(ms).toISOString().replace(/[-:]|\.\d{3}/g, '');
  const title = 'Consultation with Eng Yuyu | ' + pick(s)[0], det = 'Requested via engyuyu.com (Google Meet link will be sent once confirmed).';
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Eng Yuyu//Booking//EN', 'BEGIN:VEVENT', 'UID:' + start + '@engyuyu.com', 'DTSTAMP:' + z(Date.now()), 'DTSTART:' + z(start), 'DTEND:' + z(end), 'SUMMARY:' + title, 'DESCRIPTION:' + det, 'STATUS:TENTATIVE', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  return {
    google: 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(title) + '&dates=' + z(start) + '/' + z(end) + '&details=' + encodeURIComponent(det),
    outlook: 'https://outlook.live.com/calendar/0/deeplink/compose?path=%2Fcalendar%2Faction%2Fcompose&rru=addevent&subject=' + encodeURIComponent(title) + '&startdt=' + new Date(start).toISOString() + '&enddt=' + new Date(end).toISOString() + '&body=' + encodeURIComponent(det),
    ics: 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics),
  };
}
function updatePay() {
  const s = curSession(), box = $('#payBox'); if (box === NULL) return;
  box.hidden = !(s.price > 0);
  const auto = API && apiCfg.paymentRequired;
  $('#payText').textContent = auto ? t('cs.pay.auto') : t('cs.pay.p');
  $('#payBtn').hidden = !!auto;
  if (auto) return;
  const btn = $('#payBtn');
  btn.textContent = s.payUrl ? t('cs.pay.btn').replace('{price}', price(s)) : t('cs.pay.soon');
  if (s.payUrl) { btn.href = s.payUrl; btn.removeAttribute('aria-disabled'); btn.target = '_blank'; btn.rel = 'noopener'; }
  else { btn.removeAttribute('href'); btn.setAttribute('aria-disabled', 'true'); }
}
function showBooking() {
  if (!has('#calEmbed')) return;
  const host = $('#calEmbed'), nat = $('#nativeBook'), s = curSession();
  updatePay();
  const useCal = CONFIG.cal.enabled && CONFIG.cal.username;
  host.hidden = !useCal; nat.hidden = !!useCal;
  if (!useCal) { $('#reqDone').hidden = true; API ? loadRemote() : renderNative(); return; }
  host.innerHTML = '';
  loadCalScript();
  const theme = root.dataset.theme === 'dark' ? 'dark' : 'light';
  window.Cal('inline', { elementOrSelector: '#calEmbed', calLink: CONFIG.cal.username + '/' + s.slug, layout: 'month_view', config: { theme } });
  window.Cal('ui', { theme, hideEventTypeDetails: false, cssVarsPerTheme: { light: { 'cal-brand': '#006AFF' }, dark: { 'cal-brand': '#3D8BFF' } } });
}
/* Back from the payment page: verify the payment, then show the approval (the Meet link is also emailed automatically) */
async function handleReturn() {
  const q = new URLSearchParams(location.search), oid = q.get('order_id'), sid = q.get('sid');
  if (!oid || !API) return;
  history.replaceState(null, '', location.pathname + '#book');
  const box = $('#payStatus'), sleep = ms => new Promise(r => setTimeout(r, ms));
  $('#nativeBook').hidden = true; $('#calEmbed').hidden = true; box.hidden = false;
  const show = (kind, j = {}) => {
    const K = { verifying: ['spin', 'cs.ps.verifying', ''], pending: ['spin', 'cs.ps.verifying', 'cs.ps.pending'], waiting: ['wait', 'cs.ps.wait.t', 'cs.ps.wait.p'], left: ['bad', 'cs.ps.left.t', 'cs.ps.left.p'], ok: ['ok', 'cs.ps.ok.t', 'cs.ps.ok.p'], failed: ['bad', 'cs.ps.failed.t', 'cs.ps.failed.p'], conflict: ['bad', 'cs.ps.conflict.t', 'cs.ps.conflict.p'], error: ['bad', 'cs.ps.err.t', 'cs.ps.err.p'] }[kind];
    box.dataset.kind = K[0];
    $('#psTitle').textContent = t(K[1]); $('#psMsg').textContent = K[2] ? t(K[2]) : '';
    const ss = j.session && SESSIONS.find(x => x.id === j.session);
    $('#psRef').textContent = [j.ref ? t('cs.ps.ref') + ': ' + j.ref : '', ss ? pick(ss)[0] : '', j.start ? fmtTz(j.start, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false }, AV.tzId) + ' · ' + (AV.tzName || '') : ''].filter(Boolean).join(' · ');
    const meet = $('#psMeet'); meet.hidden = !(kind === 'ok' && j.meet); if (j.meet) meet.href = j.meet;
    $('#psRetry').hidden = !['failed', 'left', 'error', 'waiting'].includes(kind);
    requestAnimationFrame(() => box.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'center' }));   // the client lands right on the result
  };
  $('#psRetry').onclick = async () => {   // give up on this payment: free the held time, then back to choosing a time
    const btn = $('#psRetry'); btn.disabled = true;
    try { const r = await (await fetch(API + '/api/release', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: oid }) })).json(); if (r.status === 'paid' || r.status === 'confirmed') { btn.disabled = false; return show('ok', { ref: oid.slice(0, 8).toUpperCase() }); } } catch { /* the hold expires on its own */ }
    btn.disabled = false; box.hidden = true; selSlot = null; showBooking();
    $('#sessions').scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
  };
  show('verifying');
  for (let i = 0; i < 30; i++) {
    let j;
    try { j = await (await fetch(API + '/api/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: oid, sid }) })).json(); } catch { return show('error'); }
    if (j.status === 'paid' || j.status === 'confirmed') return show('ok', j);
    if (j.status === 'paid_conflict') return show('conflict', j);
    if (j.status === 'failed' || j.error) return show(j.error ? 'error' : 'failed', j);
    if (!sid) return show('left', j);            // came back from the checkout without paying
    show('pending', j); await sleep(4000);
  }
  show('waiting');   // still pending after ~2 minutes: not an error: it is approved by email as soon as the payment confirms
}

if (has('#sessions')) {
  renderSessions(); showBooking();
  handleReturn();
  $('#sessions').addEventListener('change', e => {
    if (e.target.name === 'session') { activeSession = e.target.value; selSlot = null; showBooking(); $('.book-embed').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
  $('#themeBtn').addEventListener('click', () => setTimeout(() => CONFIG.cal.enabled && showBooking(), 50));
  $('#dateRow').addEventListener('click', e => { const b = e.target.closest('[data-day]'); if (!b) return; selDay = b.dataset.day; selSlot = null; renderNative(); });
  $('#slotGrid').addEventListener('click', e => { const b = e.target.closest('[data-slot]'); if (!b) return; selSlot = +b.dataset.slot; renderNative(); $('#reqForm').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); });
  $('#reqAgain').addEventListener('click', () => { $('#reqDone').hidden = true; $('#reqForm').reset(); selSlot = null; selDay = null; renderNative(); });
  $$('#reqForm input, #reqForm textarea').forEach(el => el.addEventListener('input', () => { el.setAttribute('aria-invalid', 'false'); const er = $('#' + el.id + '-e'); if (er !== NULL) er.textContent = ''; }));
  $('#reqAgree').addEventListener('change', e => { if (e.target.checked) { $('#reqAgree-e').textContent = ''; e.target.setAttribute('aria-invalid', 'false'); } });
  $('#reqForm').addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('#reqName').value.trim(), mail = $('#reqEmail').value.trim(), note = $('#reqNote').value.trim(), s = curSession();
    const ok = [fieldErr('reqName', name ? '' : t('cs.n.eName')), fieldErr('reqEmail', validEmail(mail) ? '' : t('cs.n.eEmail'))];
    const agreed = $('#reqAgree').checked; $('#reqAgree-e').textContent = agreed ? '' : t('disc.agreeErr'); $('#reqAgree').setAttribute('aria-invalid', !agreed); if (!agreed) ok.push(false);
    if (!selSlot) { say($('#reqMsg'), t('cs.n.eSlot'), false); return; }
    if (ok.includes(false)) { $('#reqForm').querySelector('[aria-invalid="true"]').focus(); return; }
    const when = fmtTz(selSlot, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }, AV.tzId) + ' ' + AV.tzName;
    const body = [`Session: ${pick(s)[0]} (${s.min} min, ${price(s)})`, 'Time: ' + when, 'I understand these sessions are advice only: yes', 'Name: ' + name, 'Email: ' + mail, note && 'Notes: ' + note].filter(Boolean).join('\n');
    const btn = $('#reqForm').querySelector('button[type="submit"]'), label = btn.textContent; btn.disabled = true;
    if (API) { btn.textContent = t('cs.n.wait.b'); say($('#reqMsg'), apiCfg.paymentRequired ? t('cs.n.wait') : t('cs.n.wait2'), true); }   // visible feedback, reaching the payment page can take a while
    try {
      if (API) {
        const r = await fetch(API + '/api/book', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session: s.id, start: selSlot, name, email: mail, note, lang, agree: true }) });
        const j = await r.json().catch(() => ({}));
        if (r.status === 409) { say($('#reqMsg'), t('cs.n.taken'), false); selSlot = null; btn.disabled = false; btn.textContent = label; loadRemote(); return; }
        if (!r.ok) { const e = new Error(r.status); e.msg = r.status === 429 ? t('cs.n.e429') : r.status === 502 ? t('cs.n.e502') : (j.error || ''); throw e; }
        if (j.checkoutUrl) { say($('#reqMsg'), t('cs.n.redirect'), true); location.href = j.checkoutUrl; return; }   // payment first; the approval email follows automatically
        $('#reqDoneMsg').textContent = t('cs.n.booked');
        $('#meetLink').hidden = !j.meet; if (j.meet) { $('#meetLink').href = j.meet; }
        $('#addLbl').textContent = t('cs.n.add2');
        loadRemote();
      } else if (CONFIG.requestEndpoint) {
        const r = await fetch(CONFIG.requestEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ session: s.id, start: new Date(selSlot).toISOString(), name, email: mail, note }) });
        if (!r.ok) throw new Error(r.status);
        $('#reqDoneMsg').textContent = t('cs.n.sent');
      } else {
        $('#reqDoneMsg').textContent = t('cs.n.mail');
        location.href = `mailto:${CONFIG.email}?subject=${encodeURIComponent('Booking request: ' + pick(s)[0])}&body=${encodeURIComponent(body)}`;
      }
      if (!API) $('#meetLink').hidden = true;
      const L = calLinks(s, selSlot);
      $('#addG').href = L.google; $('#addO').href = L.outlook; $('#addA').href = L.ics;
      $('#reqForm').hidden = true; $('#reqDone').hidden = false; $('#reqMsg').textContent = '';
    } catch (err) { say($('#reqMsg'), (err && err.msg) || t('cs.n.eNet'), false); }
    btn.disabled = false; btn.textContent = label;
  });
}

/* ---------- Backend integration (active when CONFIG.api or ?api= is set) ---------- */
function track(e) {   // privacy-friendly analytics: no cookies, no IPs stored
  if (!API) return;
  const body = JSON.stringify(e ? { e } : { p: location.pathname, r: document.referrer, l: lang, w: innerWidth });
  try { navigator.sendBeacon ? navigator.sendBeacon(API + '/api/track', new Blob([body], { type: 'text/plain' })) : fetch(API + '/api/track', { method: 'POST', body, keepalive: true }); } catch { /* ignore */ }
}
async function initRemote() {
  if (!API) return;
  try {   // content managed in the dashboard (arrays are replaced only if the dashboard has them)
    const c = await (await fetch(API + '/api/content', { cache: 'no-store' })).json();
    if (Array.isArray(c.posts)) POSTS.splice(0, POSTS.length, ...c.posts);
    if (Array.isArray(c.events)) EVENTS.splice(0, EVENTS.length, ...c.events);
    if (Array.isArray(c.partners) && c.partners.length) PARTNERS.splice(0, PARTNERS.length, ...c.partners);
    if (Array.isArray(c.community)) COMMUNITY.splice(0, COMMUNITY.length, ...c.community);
    if (Array.isArray(c.proof) && c.proof.length) PROOF.splice(0, PROOF.length, ...c.proof);
    if (Array.isArray(c.testimonials)) TESTIMONIALS.splice(0, TESTIMONIALS.length, ...c.testimonials);
    if (Array.isArray(c.media)) MEDIA.splice(0, MEDIA.length, ...c.media);
    if (Array.isArray(c.ads)) ADS.splice(0, ADS.length, ...c.ads);
    Object.keys(GUIDES).forEach(k => delete GUIDES[k]); Object.assign(GUIDES, c.guides || {});
    renderServices(); renderProof(); renderEventsPage(); renderAds();
    renderEvents(); renderBlog(); renderCommunity(); renderPartners(); buildSearchIndex();
  } catch { /* keep built-in content */ }
  try {   // prices, durations and booking rules set in the dashboard
    const c = await (await fetch(API + '/api/config', { cache: 'no-store' })).json();
    if (Array.isArray(c.sessionList) && c.sessionList.length) SESSIONS.splice(0, SESSIONS.length, ...c.sessionList);
    for (const s of SESSIONS) if (c.sessions && c.sessions[s.id]) { s.price = c.sessions[s.id].price; s.min = c.sessions[s.id].min; s.enabled = c.sessions[s.id].enabled; }
    if (c.availability) Object.assign(AV, c.availability);
    EXTRAS.whatsapp = String(c.whatsapp || EXTRAS.whatsapp || '').replace(/\D/g, ''); EXTRAS.wa = c.wa || {}; EXTRAS.intro = c.introVideo || EXTRAS.intro; renderExtras();
    apiCfg = { ...apiCfg, ...c }; apiCfgLoaded = true;
    const be = document.querySelector('.book-embed'); if (be && (c.payMode === 'test' || c.payMode === 'sandbox') && !document.getElementById('payModeNote')) { const n = document.createElement('p'); n.id = 'payModeNote'; n.className = 'pay-mode-note'; n.setAttribute('data-i18n', c.payMode === 'test' ? 'pay.testNote' : 'pay.sandboxNote'); n.textContent = t(n.dataset.i18n); be.prepend(n); }
    if (!SESSIONS.some(s => s.id === activeSession && s.enabled !== false)) activeSession = (SESSIONS.find(s => s.enabled !== false) || SESSIONS[0]).id;
    renderServiceChips();
    if (has('#sessions')) { renderSessions(); updatePay(); showBooking(); }
  } catch { /* keep defaults */ }
}
if (API) { CONFIG.statsEndpoint = CONFIG.statsEndpoint || API + '/api/stats'; track(); }
$('#yr').textContent = new Date().getFullYear();
renderPartners();
if (!reduceMotion.matches) ['followers', 'views', 'youtube', 'facebook', 'tiktok', 'instagram'].forEach(k => shown[k] = 0);
applyLang();
initSliders();
initRemote();
setupReveal();
if (reduceMotion.matches) { startStats(); } else {
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { startStats(); io.disconnect(); } }, { threshold: .1 });
  if (isHome) io.observe($('.hero')); else { io.disconnect(); startStats(); }
}
})();

