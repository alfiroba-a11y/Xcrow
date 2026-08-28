# Xcrow — Escrow Platform

A two-sided escrow platform: a buyer opens a trade, gets a private link **and**
a separate lock code to give the seller, payments run through Paystack and sit
in escrow until both sides confirm, and every dispute reaches a hidden admin
portal in real time.

## How the trust model works

- **Link + lock code, not just a link.** Creating an escrow generates a URL
  token (embedded in the shareable link) and an 8-character lock code shown
  once. The seller needs *both* to join — send them by different channels
  (e.g. the link by email, the code by text) so a forwarded/leaked link alone
  can never be used to hijack the trade.
- **Chat is sealed to the two participants.** The Socket.io layer checks, on
  every connection and every message, that the caller is either the escrow's
  buyer or its joined seller — nobody else can even join the room.
- **Money never moves on the client's word.** The amount charged is read from
  the escrow record on the server, and every Paystack payment is re-verified
  server-side against Paystack's own API before the escrow is marked funded —
  the frontend's "success" callback is never trusted by itself.
- **Payouts are reviewed twice.** The buyer must confirm delivery before a
  payout is even queued, and an admin must approve it in the hidden portal
  before the Paystack transfer actually fires. Admins can also refund the
  buyer instead, for disputes.
- **The admin portal doesn't advertise itself.** It lives at an unguessable
  path (set via `ADMIN_PANEL_SECRET` / `VITE_ADMIN_PATH`), has its own login
  endpoint that gives identical errors for "no such user" and "not an admin,"
  and every request re-checks the `role: admin` field server-side — the
  obscure path is a nice-to-have, not the actual security boundary.

## Project structure

```
xcrow/
  backend/    Node + Express + MongoDB + Socket.io API
  frontend/   React (Vite) + Tailwind CSS
```

## 1. Paystack setup

1. Create an account at https://dashboard.paystack.com and grab your **test**
   keys first from Settings → API Keys & Webhooks.
2. You'll need both the **public key** (`pk_...`, goes in the frontend) and
   the **secret key** (`sk_...`, goes in the backend only — never expose it
   in frontend code).
3. To actually pay sellers out automatically you'll eventually need Transfers
   enabled on your Paystack account, which may require additional business
   verification. Until then, admins can still resolve disputes with refunds,
   and can mark payouts as handled manually outside the app if needed.

## 2. Database

Use MongoDB Atlas (free tier is fine to start): create a cluster, create a
database user, and grab the connection string for `MONGO_URI`.

## 3. Backend setup

```bash
cd backend
cp .env.example .env   # fill in every value
npm install
npm run create-admin   # creates your admin account from ADMIN_EMAIL/ADMIN_PASSWORD
npm run dev            # local dev, or `npm start` in production
```

Env vars (see `.env.example` for the full list): `MONGO_URI`, `JWT_SECRET`,
`CLIENT_URL`, `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`,
`ADMIN_PANEL_SECRET`, plus the one-time `ADMIN_EMAIL` / `ADMIN_PASSWORD` /
`ADMIN_NAME` used only by `npm run create-admin`.

## 4. Frontend setup

```bash
cd frontend
cp .env.example .env   # fill in every value — VITE_ADMIN_PATH must match ADMIN_PANEL_SECRET
npm install
npm run dev            # local dev
npm run build           # production build → dist/
```

## 5. Deploying on Render — the one-shot way

This project includes a `render.yaml` **Blueprint** at the repo root. It
already knows both services live in the `backend/` and `frontend/`
subfolders, so you don't configure anything per-folder by hand.

1. **Push this whole `xcrow` folder to a new GitHub repo** (Render deploys
   from git, not from a raw zip upload):
   ```bash
   cd xcrow
   git init
   git add .
   git commit -m "Xcrow escrow platform"
   git branch -M main
   git remote add origin https://github.com/<you>/xcrow.git
   git push -u origin main
   ```
   (No GitHub account yet? Create one free at github.com, then "New
   repository" → follow the same steps it shows you.)
2. In Render: **New +** → **Blueprint** → connect that repo. Render reads
   `render.yaml` and shows you both services (`xcrow-backend`,
   `xcrow-frontend`) ready to create together.
3. Render will prompt you for every env var marked secret in the blueprint
   (`MONGO_URI`, `JWT_SECRET`, `PAYSTACK_SECRET_KEY`, etc. for the backend;
   `VITE_API_URL`, `VITE_PAYSTACK_PUBLIC_KEY`, etc. for the frontend) — fill
   those in on that one screen, using the values from step 3/4 above.
4. Click **Apply** — Render builds and deploys both services.
5. Once both are live, copy their real URLs and fix the cross-references:
   on `xcrow-backend`, set `CLIENT_URL` to the frontend's URL; on
   `xcrow-frontend`, set `VITE_API_URL` to `https://<backend-url>/api` and
   `VITE_SOCKET_URL` to `https://<backend-url>`. Save — Render redeploys
   automatically.
6. Open the `xcrow-backend` service → **Shell** tab → run
   `npm run create-admin` once, to create your admin login.

**Prefer clicking through it manually instead of using the Blueprint?** You
still can — same repo, just create each service yourself in the Render
dashboard: a **Web Service** with root directory `backend` (build
`npm install`, start `npm start`), and a **Static Site** with root directory
`frontend` (build `npm install && npm run build`, publish directory `dist`).
If you do it this way, also add a rewrite rule yourself under the static
site's **Redirects/Rewrites** settings: source `/*` → destination
`/index.html` — otherwise refreshing any page but the homepage will 404.

## 6. Using it

- Register a normal account at `/register`, then "New escrow" to create one
  as a buyer. The link + lock code are shown once — save them.
- Share the link and code with the seller through two different channels.
  They register/log in, open `/join`, paste the link, and enter the code.
- The buyer funds the escrow via the Paystack popup. The seller marks it
  delivered; the buyer confirms to queue the payout.
- The hidden admin portal is at `/<VITE_ADMIN_PATH>/login` (whatever you set
  `ADMIN_PANEL_SECRET` / `VITE_ADMIN_PATH` to) — it is not linked anywhere in
  the public site.

## Security notes before going live

- Rotate `JWT_SECRET` and `ADMIN_PANEL_SECRET` to long random values — don't
  ship the placeholders.
- Switch Paystack keys from `pk_test_`/`sk_test_` to live keys only once
  you've tested the full flow end to end.
- Consider adding Paystack webhook verification as a second confirmation
  path alongside the manual `/verify` call, for resilience if a user closes
  the tab mid-payment.
- This app doesn't send emails yet (password reset, receipts) — plan for an
  email provider (e.g. Resend, Postmark) before real users rely on it.
