# Eng Yuyu backend

One small Node 18+ server (no npm install) that runs:
- **Booking + payments:** Google Calendar/Meet, Sifalo Pay, automatic approval emails (see BOOKING-SETUP.md)
- **Dashboard:** `/admin`, overview with KPIs and smart summaries, bookings, content, newsletter, messages, traffic, settings
- **Public site APIs:** `/api/content`, `/api/stats`, `/api/subscribe`, `/api/contact`, `/api/track`

## Run
```
cp server/.env.example server/.env     # fill it in (ADMIN_PASSWORD at least)
node server/server.js                  # then open http://localhost:8787/admin
```
Try it without any accounts: `DATA_DIR=server/data-demo node server/tools/seed-demo.js`, then
`DATA_DIR=server/data-demo MOCK=1 node server/server.js` (admin password: `demo`). Delete `server/data-demo` afterwards.

## Tech Blog (dashboard → Blog)
- **Publish in 3 steps:** New article → write (English, Somali optional) → paste a YouTube link (thumbnail appears automatically) → Publish.
- Every article becomes a real, search-friendly page at `/blog/your-article` (Somali at `/so/blog/…`) with title/description tags,
  Open Graph + Twitter share cards, Article + Video structured data, breadcrumbs and hreflang. `/sitemap.xml`, `/robots.txt` and
  `/blog/feed.xml` are generated automatically. The article page leads to the YouTube video with a thumbnail card at the top and a
  "Watch the full video" block at the end.
- **Engagement:** reactions (Like / Love / Fire / Insightful), comments (held for your approval by default: Dashboard → Blog → Comments),
  share buttons (copy link, WhatsApp, Facebook, X, Telegram, LinkedIn, phone share sheet).
- **Auto email:** tick "Email subscribers when published", they get the thumbnail, summary, Read and Watch buttons (Somali subscribers get the
  Somali version when you wrote one). Scheduled posts publish and send themselves. "Send test to me" previews the email.
- The editor shows a live Google preview and an SEO checklist (title/description length, 300+ words, video or image, short address).

## Deploy on ONE address (important for SEO)
`node server/server.js` also serves the website itself (index, about, consulting, assets) plus `/blog`, so everything lives on
`https://engyuyu.com`. Set `SITE_URL=https://engyuyu.com` in `server/.env`, point your domain at this server, and the forms, booking,
analytics and blog all work with no extra setup. After launch: add the site in Google Search Console and submit `https://engyuyu.com/sitemap.xml`.
(If you keep the static pages on separate hosting, the blog still needs this server, so route `/blog`, `/so/blog`, `/api`, `/admin`,
`/sitemap.xml` and `/robots.txt` to it.)

## Connect the website
In `app.js` set `api: 'https://your-api-url'` in CONFIG. The site then loads its blog posts, events, partners, community
links, follower numbers, session prices and booking rules from the dashboard, sends newsletter signups and contact messages
to it, and records anonymous page views (no cookies, no IP addresses stored).

## Files
- `server.js` booking, payment, calendar, email · `admin.js` dashboard + site APIs · `store.js` JSON storage in `data/`
- `admin/` the dashboard (HTML/CSS/JS) · `content-defaults.json` the site's current content, used to seed the dashboard
- Back up `server/data/` regularly, it holds bookings, subscribers, messages and content.

## Automations (`server/modules/automations.js`)
- **Session reminders**, paid/confirmed bookings get an email 24 h and 1 h before the session (EN/SO, with the Meet link). Checked every 5 min; each reminder is sent once.
- **Weekly summary**, every Saturday 09:00 Mogadishu time the owner email gets revenue, bookings, conversion, visitors, new subscribers, next-7-day sessions, top pages/sources and highlights.
- Both can be switched off, and the summary sent on demand, in the dashboard under **Settings → Automations**. The server must run 24/7 for them to fire.

## Dashboard password
- **Forgot it?** On the sign-in page choose *Forgot password?*, a reset link is emailed to the owner email (Settings). It needs Google (Gmail) connected.
- **Change it** any time in Settings → Password.
- **Locked out and email isn't working?** On the server run `node server/tools/reset-password.js "a new long passphrase"` (12+ characters), then restart.
- A password set this way is saved (hashed) in the data folder and overrides `ADMIN_PASSWORD`.

## Emails (`server/lib/mail.js`)
One branded layout (logo, brand blue, footer with social links) in English and Somali, every email has an HTML and a plain-text part.
Client: booking confirmed + receipt (with calendar file and add-to-calendar links) · reminders 24 h and 1 h before · thank-you + "book again" 2 h after the session · payment didn't go through · booking cancelled · paid-but-time-taken · newsletter welcome · contact auto-reply · new blog post.
You: new booking, weekly summary, security notices.
Preview any email (both languages) or send yourself a test in **Dashboard → Settings → Emails**. Turn reminders / thank-you / weekly summary on or off in **Settings → Automations**.
Emails go out from the Gmail account connected with Google (see BOOKING-SETUP.md); until it is connected they are listed in the activity feed instead.

## Writers (blog contributors): `server/modules/writers.js`
- Owner invites writers in **Dashboard → Writers** (name, email, optional *Trusted writer*). They get an email link (valid 7 days) to choose a password, then sign in at **`/writers`** (not linked from the public site).
- The writers' login is **completely separate** from the dashboard: own cookie (`yy_writer`), own signing key, own header (`X-Requested-With: yy-writer`), own API (`/api/writer/*`). A writer cookie never works on `/api/admin/*`, and the owner cookie never works on `/api/writer/*`.
- Writers can only manage **their own** blog articles and profile. They cannot set slug, featured, e-mail-subscribers, or status, the server forces those.
- **Review workflow:** draft → *Send for review* → owner publishes (normal blog editor) or *Send back with a note* → writer edits and re-submits. The owner is e-mailed on each submission; the writer on each decision.
- **Trusted writer, can publish directly** (toggle per writer in Dashboard → Writers): trusted writers get a *Publish now* button and can edit live articles; the owner is e-mailed. Untrusted writers must ask for edits to live articles.
- Pausing a writer signs them out immediately; removing deletes their drafts but keeps published articles on the blog.
- Public: byline + author box on articles, author pages `/blog/author/<slug>` (and `/so/…`), included in the sitemap.

### Commitment, streaks & editorial calendar (writers)
- Each writer sets a **commitment** (1–5 articles per week or per month) and can plan articles on a **calendar** (`/writers#/calendar`; stored on the author record: `goal`, `plans`).
- **Streak** = consecutive weeks (Saturday–Friday) or months (both in East Africa Time, UTC+3) in which the writer published at least their goal; the current period doesn't break a streak until it ends. Counted from live articles' `publishedAt`.
- **Top contributors** (this calendar month, by articles published, ties by streak) show in the writers' app and in Dashboard → Writers.
- **Reminders** (hourly check, each sent once, `author.sent`): planned article due today/tomorrow, 1–2 days overdue, and "goal at risk" in the last 3 days of the week/month. Writers can switch reminders off. `POST /api/admin/authors/reminders` runs a check now (`now` override only in demo mode).
- **Public top 3**: the blog index shows the three top contributors of the month (name, photo, article count, streak, link to the author page) above the ad slot; hidden until someone has published.
- A **congratulations email** is sent once per week/month when a writer reaches their goal (streak shown when ≥ 2).
