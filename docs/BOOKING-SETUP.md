# Booking setup

## How a booking works (payment-gated, fully automatic)
1. Client picks a session, date and time (only your free slots: Sun/Tue/Wed 14:00–20:00 Mogadishu, 24 h notice, minus anything
   busy in your Google Calendar) and enters name + email.
2. The server **holds the slot for 20 minutes** and sends the client to **Sifalo Pay's hosted checkout** (EVC Plus/ZAAD, eDahab,
   Premier Wallet or card). Nobody else can take the slot while it is held.
3. Sifalo returns the client to `consulting.html?order_id=…&sid=…`. The server **verifies the payment with Sifalo**
   (status `success` + code `601`, amount covers the price, payment ID never used before).
4. Only then it creates the Google Calendar event with a **Google Meet link** and emails the client the **"Booking approved"**
   message (Meet link, receipt, calendar file that works with Google, Outlook/Teams and Apple Calendar). You get a
   "New paid booking" email too. English or Somali, matching the page language.
5. Sifalo also pushes the result to `/api/pay/webhook` (sent automatically when your site is on https), and the server re-checks
   unpaid orders every 30 s for 3 h, clients who pay and then close the tab still get approved. A webhook is never trusted on
   its own: every payment is re-checked with Sifalo's verify before a booking is approved. If someone pays after their hold expired and the slot was taken meanwhile, you and the client get an
   email to reschedule/refund.
**Payments are controlled in Dashboard → Settings → Payments**: Off · Test (self-approved) · Sifalo sandbox · Live.

### One-time setup (~20 min)
1. Google Cloud Console → create a project → **APIs & Services → Library → enable "Google Calendar API" and "Gmail API"**.
2. **OAuth consent screen:** External, add yourself as a test user (or publish). **Credentials → Create OAuth client ID →
   Web application**; add redirect URI `http://localhost:8788/callback`. Copy the client ID and secret.
3. Get your refresh token (this also grants permission to send the approval emails from your Gmail): `node server/tools/get-refresh-token.js <CLIENT_ID> <CLIENT_SECRET>`, open the printed link, approve
   (sign in with the Google account whose calendar should receive bookings). Copy `GOOGLE_REFRESH_TOKEN=…`.
4. `cp server/.env.example server/.env` and fill in the three values. Set `ALLOWED_ORIGIN` to your site's URL.
5. Test locally: `node server/server.js` (add `MOCK=1` first to try it without Google).
6. Deploy `server/` anywhere that runs Node 18+ (Render, Railway, Fly.io, a VPS). Set the same variables there. No npm install needed. Orders are stored in `server/data/orders.json`, so give the host a **persistent disk** (otherwise a restart forgets pending orders).
7. In `app.js` set `api: 'https://your-api-url'` in CONFIG. Done, the page switches from "request by email" to live booking.
Dev shortcut: open `consulting.html?api=http://localhost:8787`.

Busy times from **Outlook / iCloud**: subscribe to them in Google Calendar (Settings → Add calendar → From URL, using the
calendar's ICS link) and put that calendar's ID in `GOOGLE_EXTRA_CALENDARS`. (Subscribed feeds can lag by hours.)

## Sifalo Pay setup, all from the dashboard (Settings → Payments)
Changing payment settings always asks for your dashboard password, is written to the activity log and emails you a notice.
API keys are stored **encrypted** in the data folder and are never shown again (only their last 4 characters).

**1. Test the whole process first, mode "Test (self-approved)".** No Sifalo account needed and no money moves.
   Book any session on the Consulting page → you land on the built-in test checkout → while you are signed in to the
   dashboard it approves itself after 4 seconds (or choose Decline / Pending). You then see exactly what a client sees:
   approval page, email, calendar invite and Meet link (once Google is connected). Test bookings are marked **TEST**,
   their emails and calendar events start with **[TEST]**, and they never count as revenue. Visitors who are not signed in
   can't approve a test payment, so nobody can book for free while test mode is on.

**2. Sifalo sandbox, mode "Sifalo sandbox".** Sign up at https://pay.sifalo.net/auth/signup, turn on 2FA,
   Merchant → API → **Create API key**, paste the **username** and **API key** into "Sandbox keys", press
   *Test sandbox connection*, choose Sifalo sandbox and save. Pay with the sandbox test cards
   (Visa 4508 7500 1574 1019 or Mastercard 5123 4500 0000 0008 · expiry 01/39 · CVV 100) or test wallets
   (eDahab 252621111111 = success, 252622222222 = failed, 252651111111 = pending, 252652222222 = insufficient).

**3. Live, mode "Live".** Sign up at https://pay.sifalo.com, turn on 2FA, create a live API key, paste it into "Live keys",
   press *Test live connection*, choose Live and save. Make one real small booking to confirm, then announce it.
   (Sandbox and live keys are not interchangeable, staging only works on `.net`, live only on `.com`.)

Older setups: `SIFALO_API_USER` / `SIFALO_API_KEY` in `server/.env` still work as live keys until you save keys in the dashboard.
Set `PAYMENT_SECRET` (a long random string) in the host's secret settings so saved keys are encrypted with a key that is not
stored next to them. Sifalo docs: https://developer.sifalopay.com

## Without the API (what you see today)
The page still enforces your rules but can't see your calendar or take payment; the request opens as an email and you confirm by hand.

## Alternative: Cal.com
Account exists at https://cal.com/engyuyu (only default 15/30-min events). It can't take Sifalo payments, so it's not recommended now.

## Local testing
`SITE_URL=http://localhost:5173 MOCK=1 node server/server.js` fakes Google, Gmail and Sifalo (a fake checkout page redirects back
immediately). Open `consulting.html?api=http://localhost:8787`. Sent emails show at `/api/mock-outbox`.

## Prices
Quick Session $10 (30 min) · Focus Session $12 (45 min) · Full Session $15 (60 min). Change names, wording and prices any time in Dashboard → Settings → Sessions.
