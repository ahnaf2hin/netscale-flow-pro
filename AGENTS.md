# AGENTS.md

## Project context

NetScale Flow Pro is a full-stack ISP CRM / network-ops system: subscriber billing, MikroTik
RouterOS + SNMP integration, OLT/ONU tracking, a customer self-service portal, HR/payroll,
support desk, and payment gateway checkout (SSLCommerz / bKash / Nagad / Stripe).

It was originally scaffolded on Base44 (managed auth + DB + serverless functions). It has
since been migrated off Base44 entirely: the frontend (`src/`, Vite + React + React Router)
is unchanged in almost every page/component, but everything that used to call the Base44 SDK
now talks to a self-hosted Express + Prisma + MySQL backend in `server/`.

Start with `README.md` for local setup (MySQL, the Express API, and the Vite frontend).

## Key files

- `src/api/base44Client.js` — the only frontend file most Base44-era code still imports.
  It exposes the exact same `base44.entities.X.*` / `base44.auth.*` / `base44.functions.invoke`
  / `base44.integrations.Core.*` call shapes the original Base44 SDK had, but implemented as
  plain `fetch()` calls against `server/`. This is why ~45 page files needed zero changes.
- `server/prisma/schema.prisma` — the full data model (31 entities + User + PaymentIntent),
  ported from `base44/entities/*.jsonc`.
- `server/src/routes/functions.js` — the 17 Base44 serverless functions
  (`base44/functions/*/entry.ts`), ported near-verbatim to Express routes. The RouterOS
  binary-protocol client (hand-rolled TCP, no `node-routeros` dependency) lives in
  `server/src/lib/routeros.js` and is shared across them.
- `server/src/routes/collector.js` — receiving end for the on-prem SNMP collector
  (`collector/collector.js`), authenticated via a shared `COLLECTOR_API_KEY` instead of a
  Base44 app token.
- `base44/` — kept as historical reference (the original entity schemas and function source).
  Nothing in the running app executes this directory anymore.

## Working notes

- Don't reintroduce `@base44/sdk` or `@base44/vite-plugin` — they were removed on purpose.
- When adding a new entity field, update **both** `server/prisma/schema.prisma` and, if the
  frontend needs to send/receive it, the relevant page/component — the generic entity CRUD
  router in `server/src/routes/entities.js` passes fields through as-is, so most changes only
  need the Prisma model updated.
- Run `npm run lint` (frontend) before finishing frontend changes.
