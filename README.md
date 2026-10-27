# Perkora

Digital loyalty and customer retention for independent cafés. Launching first in Girne, North Cyprus.

Customers join a café's programme from a QR code, collect stamps or points on their phone, and redeem rewards at the counter. Owners see who comes back, run offers, and track the effect. Staff work from a fast counter terminal.

This repository holds the whole product:

- **Marketing site:** home, features, how it works, pricing, demo request, privacy, terms.
- **Owner sign-up and onboarding:** 5 steps, resumable, ending with a printable QR poster.
- **Customer wallet:** mobile-first. Card, rewards, offers, activity, invite a friend, and account (export and deletion).
- **Staff counter terminal:** scan or look up a member, add stamps or points, redeem rewards. Every action needs confirmation.
- **Owner dashboard:** overview, customers, programmes, rewards, campaigns, challenges, transactions, analytics, team, settings, branding, subscription, help.
- **Platform admin:** cafés, plans, demo requests, error log, demo reset.
- **Loyalty engine:** stamps and points; idempotent awards and atomic redemptions; reversals and corrections; visit challenges; campaigns; referrals; birthday rewards; segments.
- **Languages and money:** English (default) and Turkish. EUR and TRY, never converted. Per-café timezones.
- **Demo environment:** a fictional demo café that can be reset without touching real data.

Docs:

- [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md): **start here.** Run it on your computer, put it online, and sign up a café, step by step with no developer knowledge needed.
- [docs/DEMO_GUIDE.md](docs/DEMO_GUIDE.md): the 15-step sales demo.
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): going live.
- [docs/TEST_REPORT.md](docs/TEST_REPORT.md): what is tested and the latest results.
- [docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md): read before selling.
- [docs/METRICS.md](docs/METRICS.md): how every number on the dashboard is calculated.
- [docs/screenshots/](docs/screenshots/): the main screens, taken from this build with the demo data.

---

## Stack, and why it looks unusual

The build environment for this version had **no access to the npm registry**, so Perkora uses only packages that were already installed there:

| Concern | Choice |
|---|---|
| Runtime | Node.js ≥ 22.12, TypeScript |
| UI | React 19, server-rendered, with small hydrated "islands" for interactive parts |
| Styling | Tailwind CSS 4 (compiled by the build script) |
| Validation | Zod |
| Charts | d3-scale / d3-shape rendered to SVG |
| Bundling | esbuild |
| Database | PostgreSQL 14+ |
| Tests | `node:test` (via tsx) and Playwright |

Three pieces that would normally come from npm are written in-repo and covered by tests:

- **PostgreSQL driver** (`src/server/db/pg/driver.ts`). Wire protocol v3 with TLS (`sslmode` disable, prefer, require, verify-full) and SCRAM-SHA-256 or MD5 authentication. It exposes a `pg`-compatible `Pool` API, so it can later be swapped for `pg` by changing one import.
- **HTTP routing, cookies and body parsing** (`src/server/http`). Built on `node:http`.
- **QR encoder** (`src/shared/qr/qrcode.ts`). Checked against OpenCV's decoder in the unit tests.

There is no Next.js or Vercel dependency. The production server is one self-contained file (`dist/server.cjs`) that runs on any Node host or in Docker.

## Prerequisites

- Node.js 22.12 or newer.
- PostgreSQL 14 or newer: local, Docker, or hosted (Supabase, Neon, Render, Railway, RDS).
- For the end-to-end tests only: Playwright with Chromium.

## Install and run locally

The repository includes the prebuilt app (`dist/`, `public/assets/`), so you can run it with only Node and a database: see [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md). To work on the code:

```bash
npm install                      # no lockfile is committed; see Known limitations
cp .env.example .env             # then edit DATABASE_URL, APP_SECRET, DEMO_PASSWORD
createdb perkora                 # or create the database any other way
npm run setup                    # build + migrate + seed plans and the demo café
npm start                        # http://localhost:3000
```

For development, `npm run dev` builds in development mode, starts the server, and rebuilds and restarts when anything in `src/` or `migrations/` changes.

### Environment

Every variable is documented in [.env.example](.env.example). The ones you must set:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string, with `?sslmode=require` for hosted databases |
| `APP_SECRET` | 32+ random characters. Signs the rotating member QR tokens |
| `APP_URL` | Public base URL. Used in QR codes and links, and for the same-origin check |
| `DEMO_MODE` / `DEMO_PASSWORD` | Whether the fictional demo café and its sign-in shortcuts are shown, and their password |

`APP_URL` must start with `https://` in production. Cookies are then marked `Secure` and HSTS is sent.

### Commands

| Command | What it does |
|---|---|
| `npm run build` | Builds client JS, CSS, `dist/server.cjs` and `dist/cli.cjs` |
| `npm start` | Runs the production server |
| `npm run dev` | Development loop with rebuild and restart |
| `npm run db:migrate` | Applies pending SQL migrations (checksummed, each in a transaction) |
| `node dist/cli.cjs bootstrap` | Migrations, plans, and the first admin from `ADMIN_EMAIL` + `ADMIN_PASSWORD` (created only if missing). Used as the start step on hosts without a shell; safe to repeat |
| `npm run db:seed` | Seeds subscription plans and, when `DEMO_MODE=true`, the demo cafés |
| `npm run demo:reset` | Deletes and rebuilds **only** demo records (`is_demo = true`); real cafés are untouched |
| `npm run admin:create -- --email you@example.com --name "Your Name"` | Creates a platform admin (see below) |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit and integration tests (needs a PostgreSQL database named `*_test`, via `TEST_DATABASE_URL`) |
| `npm run test:e2e` | Browser tests (needs the server running, Playwright, and a fresh `demo:reset`) |

### Creating the platform admin

No admin credentials exist in the source code. Create the first admin from the command line on the server:

```bash
ADMIN_PASSWORD='a-long-unique-password' npm run admin:create -- --email you@example.com --name "Your Name"
```

If `ADMIN_PASSWORD` is not set, a strong temporary password is generated and printed once. Running the command again for an existing email promotes that account to admin.

### Demo accounts

When `DEMO_MODE=true`, the seed creates the fictional **Perkora Demo Café** (Girne, EUR) and **Lemon Tree Bakery** (TRY), with about four months of simulated activity. The sign-in page shows shortcuts for:

| Role | Email |
|---|---|
| Owner | `owner@demo.perkora.app` |
| Staff | `staff@demo.perkora.app` |
| Customer | `maya.collins@example.com` |

All three use the password set in `DEMO_PASSWORD`. Every person, visit and transaction in the demo is invented. The demo café shows a "Demonstration café" banner everywhere.

## Testing

```bash
createdb perkora_test        # integration tests wipe and rebuild this database
export TEST_DATABASE_URL='postgres://user:pass@127.0.0.1:5432/perkora_test?sslmode=disable'
npm test                     # 87 unit + integration tests
npm run demo:reset && npm run test:e2e   # with the server running on :3000
```

See [docs/TEST_REPORT.md](docs/TEST_REPORT.md) for the full list and the latest run.

## Project layout

```
migrations/            SQL schema (001_init.sql)
src/server/
  auth/                sessions, password hashing, guards (roles, permissions, tenant scope), rate limits
  db/                  pool, transactions with retry, migration runner, PostgreSQL driver
  domain/              loyalty engine, segments, analytics, plans, QR tokens, views
  http/                request context, router, server-side rendering
  routes/              marketing, auth, customer, terminal, onboarding, dashboard, admin
  seed/                plans, demo data, admin creation
src/ui/                React pages, layouts, components, charts, islands
src/client/entry.tsx   hydrates islands in the browser
src/shared/            i18n (en, tr), formatting, time zones, schemas, QR encoder
tests/                 unit, integration, e2e
scripts/build.ts       the build
```

## Security model in brief

- **Tenant isolation.** Every tenant table carries `business_id`. Each dashboard, terminal and API request re-resolves the café from the signed-in user's membership; nothing trusts a café id sent by the browser. Isolation is tested at the engine and HTTP levels.
- **Roles.** Platform admin, café owner, staff (with optional permissions: view customers, view reports, manage rewards, adjust balances) and customer. All checks are server-side.
- **Sessions.** Random opaque tokens; only their SHA-256 hash is stored. Cookies are `HttpOnly` and `SameSite=Lax`. Passwords are hashed with scrypt.
- **CSRF.** A same-origin check plus a double-submit token on every state-changing request.
- **Loyalty integrity.**
  - Awards and redemptions run in database transactions with row locks and idempotency keys.
  - The ledger is append-only. Corrections are new reversal records, never edits.
  - Balances cannot go negative (a database constraint).
- **Member QR codes.** HMAC-signed tokens that expire after 5 minutes and contain no personal data.
- **Other protections.**
  - Content Security Policy and other security headers.
  - Rate limits on sign-in, sign-up, password changes, demo requests and counter lookups, awards and redemptions.
  - Uploads checked by their content, not their file name.
  - CSV exports protected against spreadsheet formula injection.
