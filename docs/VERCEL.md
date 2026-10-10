# Running on Vercel (test site)

`api/index.js` runs the same server as `npm start`, one request at a time, as a Vercel function. `vercel.json` sends every path that is not a static file to it. All data lives in Supabase, so any instance can answer any request.

## Settings (Vercel > Project > Settings > Environment Variables)

| Name | Value |
|---|---|
| `SUPABASE_URL` | your project URL |
| `SUPABASE_SERVICE_KEY` | the **secret** key (`sb_secret_...`, never the publishable one) |
| `ADMIN_PASSWORD` | 12+ characters |
| `PAYMENT_SECRET` | long random value; never change it after saving payment keys |
| `SITE_URL`, `PUBLIC_API_URL`, `ALLOWED_ORIGIN` | the site address, e.g. `https://test.engyuyu.com` |
| `SECURE_COOKIES`, `TRUST_PROXY` | `1` |
| `DATA_DIR` | `/tmp/data` (Vercel's disk is read-only except /tmp) |
| `CRON_SECRET` | long random value; Vercel sends it to `/api/cron` |

Never use `MOCK`. Settings only apply to a **new deployment**, so redeploy after changing them.

## What works differently from a normal server

- **Timers do not run** (they pause between requests). `vercel.json` has a daily cron (`/api/cron`) that runs reminders, follow-ups, the weekly summary and writer reminders. The free Hobby plan allows one cron run per day, so reminders arrive late. A Pro plan allows more frequent runs (edit the `schedule` in `vercel.json`).
- **Requests over about 4.5 MB fail.** Pictures (max 1 MB) are fine; the 12 MB ad-video upload is not.
- **Saves are written before the function sleeps** and other instances re-read changed data at the start of a request, but two people saving the same thing at the same instant can still overwrite each other. A normal server (one process) does not have this limit.
- The security headers for static HTML pages come from Vercel's CDN, not the app.
