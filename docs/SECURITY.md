# Security notes, engyuyu.com

## What is built in
| Area | Protection |
|---|---|
| Transport | HSTS is sent when the site is served over https (`SECURE_COOKIES=1` or a proxy that sets `X-Forwarded-Proto`). Serve the site over https only. |
| Browser hardening | Content-Security-Policy (only this site, YouTube's privacy player and the pages' own theme script by hash, no inline event handlers, no `eval`), `X-Content-Type-Options`, `X-Frame-Options: DENY`/`frame-ancestors 'none'`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`. |
| Password reset | “Forgot password?” emails a one-time link (valid 30 min, stored only as a hash) to the **owner email in Settings**, never to an address typed on the page, and always shows the same message. A reset signs out every other session and emails you a “password changed” notice. The new password is stored with scrypt and overrides `ADMIN_PASSWORD`. If Google isn't connected yet, run `node server/tools/reset-password.js "a new long passphrase"` on the server and restart it. |
| Dashboard login | Password ≥ 12 characters (dashboard stays off otherwise), constant-time compare, 10 attempts/hour per address, 0.7 s delay and an activity-log entry on failures, signed `HttpOnly; SameSite=Strict` cookie (+`Secure` on https), 12 h expiry, `X-Requested-With` CSRF guard on every change, `noindex` on all dashboard pages. |
| Input | Every public form is length-limited, validated (strict email pattern, no header injection), rate-limited per visitor, and honeypot-protected (comments). Output is HTML-escaped; blog markdown is escaped before formatting. |
| Uploads | PNG/JPG/WebP/SVG only, checked by file signature, ≤ 1 MB, random file names; SVGs with scripts or external references are rejected and are served with a sandbox CSP. |
| Files | Only a fixed list of pages, `/assets/…` and the 3 scripts are served; `.env`, `server/` and the data folder are never reachable. |
| Payments | Card / mobile-money details never touch this server (Sifalo hosted checkout). A booking is approved only after Sifalo's verify confirms status `success` + code `601`, the amount covers the price and the payment ID was never used before, webhooks only trigger that check. API keys are edited in the dashboard (password required, logged, emailed to you), stored AES-256-GCM encrypted (`PAYMENT_SECRET`) and never shown again. Test-mode payments can only be approved by the signed-in owner. Data files are owner-only (0600). |
| Privacy | No cookies, no IP addresses stored; visitor counts use a code that changes daily. |
| Safe defaults | `MOCK` mode refuses to start on a public address; a request/header timeout is set; rate-limit memory is cleaned automatically. |

## Before you go live (checklist)
1. `server/.env`: set `ADMIN_PASSWORD` (12+ chars, unique), `SITE_URL=https://engyuyu.com`, `SECURE_COOKIES=1`, and `TRUST_PROXY=1` if the host puts a proxy in front of Node. **Do not set `MOCK`.**
2. Serve only over https (most hosts do this for you) and redirect http → https at the host.
3. Keep the Google refresh token and payment keys only in `server/.env` (never in the website files or chat).
4. Put `server/data` on a persistent disk and **back it up daily** (it holds bookings and subscribers).
5. Turn on 2-step verification for the Google account, the payment account, the domain registrar and the host.
6. Update Node.js (18 LTS or newer) when the host offers it. The project has no third-party packages to patch.
7. After deploying, test the site at securityheaders.com and ssllabs.com, you should see an A grade.
8. Have the Privacy Policy and Terms reviewed locally before launch.

## Standards this follows
OWASP Top 10 (injection, broken access control, auth failures, security misconfiguration, SSRF-free design), OWASP ASVS L1 basics, WCAG 2.1 AA colour contrast and keyboard/touch targets, privacy-by-default analytics.

## Writers' login
Separate cookie/key/CSRF header from the owner dashboard (cross-use is rejected), scrypt password hashes, single-use hashed invite/reset tokens, 12+ character passwords, rate limits on sign-in/forgot, pause = instant sign-out (epoch bump), bio/links sanitised and HTML-escaped, uploads magic-byte validated.

## Two-step verification (dashboard)
**Two methods, use either or both** (Settings → Two-step verification): authenticator app, and **email code** (sent to the owner email only). Email codes last 10 minutes, allow 5 tries, work once, and can be requested only after the password is right (5 requests/hour per IP). Turning on a method needs a code proving it works; both share one set of recovery codes.

Dashboard → Settings → **Two-step verification**. Standard TOTP (RFC 6238, 6 digits / 30 s), works with Google/Microsoft Authenticator, Authy, 1Password. Turning it on gives 8 one-time **recovery codes** (stored only as hashes). Sign-in then needs password **and** code; a code can't be reused, wrong codes are rate-limited and logged, and turning it off needs password + a code. The "Forgot password" email link resets only the password, not the second step.
**Locked out (lost phone and recovery codes)?** On the server, open `data/auth.json` and delete the `"totp"` entry (or set `"on": false`), then restart. Keep a copy of your recovery codes somewhere safe.
