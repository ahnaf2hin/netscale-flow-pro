# NetScale Flow Pro

ISP CRM / network operations system: subscriber billing, MikroTik RouterOS + SNMP monitoring,
OLT/ONU tracking, a customer self-service portal, HR/payroll, support desk, and online payment
checkout (SSLCommerz / bKash / Nagad / Stripe).

Fully self-hosted on **Express + Prisma + MySQL**. See `AGENTS.md` for the project layout.

## Stack

- **Frontend**: Vite + React + React Router (`src/`)
- **Backend**: Express + Prisma ORM 7 (MySQL, via `@prisma/adapter-mariadb`) (`server/`)
- **Auth**: JWT (email/password + OTP-verified registration, plus Google Sign-In)
- **Network integrations**: hand-rolled RouterOS binary-API client (`server/src/lib/routeros.js`),
  SNMP via an on-prem collector agent (`collector/`)

## 1. Prerequisites

- Node.js 20+
- A MySQL-compatible server (MariaDB works — the Prisma adapter targets the MySQL wire protocol)

## 2. Backend setup

```bash
cd server
npm install
cp .env.example .env    # edit DB_*, JWT_SECRET, COLLECTOR_API_KEY at minimum
npx prisma migrate dev  # creates all tables
npm run db:seed         # creates an admin user, demo customer, packages, a router
npm run dev              # starts the API on http://localhost:8787
```

Demo logins created by the seed script:

| Portal | Email | Password |
|---|---|---|
| Admin (`/login`) | `admin@netscale.local` | `Admin@12345` |
| Customer (`/portal/login`) | `customer@netscale.local` | `Customer@123` |

Change these in production — edit `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `server/.env`
before seeding, or update the password afterwards via the Staff page.

## 3. Frontend setup

```bash
npm install       # from the repo root
npm run dev        # starts Vite; proxies /api to http://localhost:8787 in dev
```

Visit the URL Vite prints (typically `http://localhost:5173`). The public marketing page is
at `/portal`, staff/admin login is at `/login`, customer login is at `/portal/login`.

You can also run both from the repo root once the backend's `.env` is set up:

```bash
npm run server    # backend, in one terminal
npm run dev        # frontend, in another
```

## 4. What's real vs. what needs your credentials

| Feature | Status |
|---|---|
| Customer/billing/staff/support/accounting CRUD, network map, hotspot, zones, offices, etc. | **Real** — full CRUD against MySQL |
| MikroTik PPPoE secrets, active sessions, suspend/reconnect, interface/VLAN traffic | **Real** RouterOS binary-API calls, same as the original app — needs a reachable router (edit the seeded router's host/credentials) |
| SNMP collector (`collector/`) | **Real** — an on-prem agent you run on your LAN; see `collector/collector.js` header comments and update `APP_BASE`/`COLLECTOR_API_KEY` to match `server/.env` |
| OLT/ONU optical readings | UI + storage only — no SNMP polling exists for OLTs in the original app either; `server/src/routes/collector.js`'s `/sync-olt` endpoint is ready to receive data once you write that poller |
| Payment checkout — **Stripe, SSLCommerz** | **Real**, once you fill in Settings → Payment Gateways with real credentials. Simulates instant success when no gateway is active, so checkout is demoable end-to-end without credentials. |
| Payment checkout — **bKash, Nagad** | **Real**, but the original `PaymentGateway` table only has two generic credential fields (App Key/Secret). bKash also needs a merchant **username/password** and Nagad needs an RSA **keypair** — set `BKASH_USERNAME`, `BKASH_PASSWORD`, `NAGAD_MERCHANT_PRIVATE_KEY`, `NAGAD_PUBLIC_KEY` in `server/.env` in addition to the Settings UI fields. Nagad's integration is the least publicly documented of the three — verify endpoint paths against your own Nagad Merchant Integration Guide before going live. |
| SMS sending | **Real** generic HTTP call once a default `SmsProvider` is configured (Settings page) — logs instead of sending otherwise |
| Email (OTP, invoices, overdue reminders) | **Real** via SMTP once `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` are set in `server/.env` — otherwise OTP codes come back in the API response (`dev_otp`) so registration still works locally, and other emails just log |
| Google sign-in | **Real**, once you set `GOOGLE_CLIENT_ID` (server) and `VITE_GOOGLE_CLIENT_ID` (frontend) from a Google Cloud OAuth Client ID. Falls back to email/password + OTP if unset. |
| Real-time live-traffic charts | Polling-based refresh every few seconds rather than a WebSocket push |

## 5. Project structure

```
server/prisma/schema.prisma   Full data model — 31 entities, plus User/PaymentIntent
server/src/routes/entities.js Generic CRUD router — covers ~25 of the 31 entities uniformly
server/src/routes/functions.js  17 server-side operations, exposed as Express routes
server/src/routes/auth.js      Email/password + OTP registration, password reset, Google Sign-In
server/src/routes/collector.js SNMP collector ingestion (separate auth: shared API key, not JWT)
server/src/routes/publicPay.js Payment gateway callback handlers (SSLCommerz/bKash/Nagad)
server/src/lib/routeros.js     RouterOS binary-protocol client (login, /ppp/secret, /interface, ...)
server/src/lib/payments/       SSLCommerz / bKash / Nagad / Stripe gateway clients
src/api/apiClient.js           Frontend API client — consistent call shapes, talks to server/
src/lib/AuthContext.jsx        Auth context (current user, login/logout state)
collector/collector.js         On-prem SNMP + RouterOS agent — update APP_BASE/COLLECTOR_API_KEY before running
```

## 6. Known gaps

- **No role/permission enforcement beyond "is logged in."** Any authenticated user can reach
  any page. Admin-only *backend actions* (invoice generation, router status checks, bandwidth
  logging) do check `role === 'admin'`. Fixing this properly means adding real role/permission
  checks per route — worth doing before a public-facing production deploy.
- **Reseller has no login and no `customer.reseller_id` FK** — it's a standalone CRM list, not
  wired into billing.
- **OLT optical monitoring has no live data source** — SNMP polling for ONUs isn't implemented,
  only the ingestion endpoint.
- **HotspotVoucher has no redemption flow** — vouchers never transition from `unused` to `used`
  (no Hotspot API integration exists).
