# AGENTS.md

## Project context

NetScale Flow Pro is a full-stack ISP CRM / network-ops system: subscriber billing, MikroTik
RouterOS + SNMP integration, OLT/ONU tracking, a customer self-service portal, HR/payroll,
support desk, and payment gateway checkout (SSLCommerz / bKash / Nagad / Stripe).

The frontend (`src/`, Vite + React + React Router) talks to a self-hosted Express + Prisma +
MySQL backend in `server/` via a small client SDK, so page/component code stays simple.

Start with `README.md` for local setup (MySQL, the Express API, and the Vite frontend).

## Key files

- `src/api/apiClient.js` — the frontend's API client. It exposes consistent
  `netscaleApi.entities.X.*` / `netscaleApi.auth.*` / `netscaleApi.functions.invoke`
  / `netscaleApi.integrations.Core.*` call shapes implemented as plain `fetch()` calls
  against `server/`, so page components don't touch `fetch`/URLs directly.
- `server/prisma/schema.prisma` — the full data model (31 entities + User + PaymentIntent).
- `server/src/routes/functions.js` — 17 server-side operations exposed to the frontend as
  Express routes. The RouterOS binary-protocol client (hand-rolled TCP, no `node-routeros`
  dependency) lives in `server/src/lib/routeros.js` and is shared across them.
- `server/src/routes/collector.js` — receiving end for the on-prem SNMP collector
  (`collector/collector.js`), authenticated via a shared `COLLECTOR_API_KEY`.

## Working notes

- When adding a new entity field, update **both** `server/prisma/schema.prisma` and, if the
  frontend needs to send/receive it, the relevant page/component — the generic entity CRUD
  router in `server/src/routes/entities.js` passes fields through as-is, so most changes only
  need the Prisma model updated.
- Run `npm run lint` (frontend) before finishing frontend changes.
