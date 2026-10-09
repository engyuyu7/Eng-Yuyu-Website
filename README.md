# Eng Yuyu: website, booking, blog and dashboard

The personal brand website for Eng Yuyu (Yusuf Mohamed), in English and Somali. One small Node server runs everything: the public site, paid 1:1 booking (Sifalo Pay), the blog, events and media, the owner dashboard and a separate login for guest writers.

There are no npm packages to install. You only need **Node 18 or newer**.

## Quick start

```bash
npm run demo:seed     # optional: fills a demo data folder
npm run demo          # http://localhost:8787, dashboard at /admin, password "demo" (fake Google and payments)
npm start             # real mode: needs server/.env (copy server/.env.example)
npm run dev           # restarts when files change
```

## What is in the project

```
public/                  what visitors get
  *.html                 index, about, consulting, events, privacy, terms
  app.js, styles.css     BUILT from src/, do not edit by hand
  blog.js                blog page behaviour (reactions, comments, share)
  assets/                logos, fonts, partner logos, sample images
src/
  js/                    site behaviour, in load order
  css/                   styles, in cascade order
  build.js               joins the parts into public/app.js and public/styles.css
server/
  server.js              start-up: loads the saved data (Supabase or local), then runs app.js
  app.js                 booking, payments, Google, emails, security headers, static files
  modules/               admin.js (dashboard API), blog.js (blog pages and SEO),
                         writers.js (guest writers), automations.js (reminders, summaries)
  lib/                   store.js (JSON data), payments.js (Sifalo Pay), mail.js (branded emails)
  dashboard/             the dashboard app, served at /admin
  writers/               the writers' app, served at /writers (separate login)
  tools/                 seed-demo, extract-defaults, get-refresh-token, reset-password, import-engyuyu
  content-defaults.json  built-in content the dashboard starts from
  .env.example           settings template, copy to server/.env
docs/                    BOOKING-SETUP.md, SERVER.md, SECURITY.md
source/                  original branding and media files (kept out of Git)
```

## Everyday edits

- **Wording and translations:** `src/js/02-i18n.js` (English and Somali side by side).
- **Built-in content** (sessions, events, posts, partners): `src/js/01-config.js` and `03-content.js`. Run `npm run defaults` afterwards.
- **Styles:** the matching file in `src/css/`. Later files win.
- After editing `src/`, run `npm run build` (the server also rebuilds on start). Commit the rebuilt `public/app.js` and `public/styles.css`.
- Most day-to-day content (events, sessions, prices, WhatsApp, emails, writers) is edited in the dashboard, not in code.

## Settings and secrets

Copy `server/.env.example` to `server/.env` and fill it in. **Never commit `server/.env`**, the `server/data/` folder, or any API keys. `.gitignore` already blocks them.

## Data: local files or Supabase

By default everything is saved in `server/data/` (JSON files). To use Supabase instead, run `docs/supabase-setup.sql` in your Supabase project, then set `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in `server/.env` (or the host's environment variables). On the first start the server uploads any existing local data to Supabase, then reads and saves everything there. Pictures and ad videos go to the `uploads` bucket. Run only one server instance at a time.

## Put it on GitHub

1. Create a new **private** repository on GitHub (no README, no .gitignore).
2. In this folder:
   ```bash
   git init
   git add .
   git status            # check that no .env, data folder or source/ files are listed
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR-NAME/YOUR-REPO.git
   git push -u origin main
   ```
3. On your host (Render, Railway, Fly.io or a VPS) connect the repository, set the start command to `npm start`, and add the settings from `.env.example` as environment variables.

## Go live

Follow `docs/BOOKING-SETUP.md`, then the checklist in `docs/SECURITY.md`. Use HTTPS, a long dashboard password and two-step verification, and back up your data folder.
