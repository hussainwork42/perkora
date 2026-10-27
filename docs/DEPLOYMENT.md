# Deployment

Perkora runs as **one Node.js process plus one PostgreSQL database**. The production bundles (`dist/server.cjs` and `dist/cli.cjs`) have no runtime npm dependencies, so any Node 22 host or a Docker image works.

> This build has **not been deployed** anywhere yet. The steps below have been followed locally, against a production build and a local PostgreSQL 16. They have not been run on any of the hosting providers named.

## Before going live: checklist

- [ ] **Database.** A PostgreSQL 14+ database exists, and `DATABASE_URL` uses `sslmode=require` or `verify-full` if it is hosted.
- [ ] **Secret.** `APP_SECRET` is 32+ random characters (`openssl rand -base64 48`), kept in the host's secret store, never in git.
- [ ] **Public URL.** `APP_URL` is the public `https://` URL with no trailing slash. QR codes, posters and invitation links use it, so set it before printing posters.
- [ ] **Proxy.** If the app runs behind a proxy or load balancer (Render, Railway, Fly, nginx), `TRUST_PROXY=true`.
- [ ] **Environment.** `NODE_ENV=production`.
- [ ] **Demo mode.** `DEMO_MODE` is decided. Use `true` for a sales/demo instance; `false` hides the demo café and its sign-in shortcuts on a live instance. If `true`, set a non-default `DEMO_PASSWORD`.
- [ ] **Migrations and seed.** Migrations have run: `node dist/cli.cjs migrate`. Plans are seeded: `node dist/cli.cjs seed` (also seeds the demo cafés when `DEMO_MODE=true`).
- [ ] **Platform admin.** Created from the server shell, never committed: `ADMIN_PASSWORD='…' node dist/cli.cjs create-admin --email you@yourdomain --name "Your Name"`.
- [ ] **Legal and company details.** Privacy policy and terms reviewed by a lawyer; company details added (see KNOWN_LIMITATIONS.md).
- [ ] **Health check.** The host's health check points at `GET /healthz`. It returns 200 when the database is reachable.
- [ ] **Backups.** Database backups are enabled on the provider.
- [ ] **Smoke test.** Sign in as admin, create a test café through sign-up and onboarding, join it from a phone, award and redeem at the terminal, then delete the test café's data.

## Option A: Docker (any VPS, Fly.io, Render, Railway)

```bash
docker build -t perkora .
docker run -d --name perkora -p 3000:3000 \
  -e DATABASE_URL='postgres://…?sslmode=require' \
  -e APP_SECRET='…' \
  -e APP_URL='https://perkora.example' \
  -e TRUST_PROXY=true \
  -e DEMO_MODE=false \
  perkora
```

The image runs pending migrations on start (they are checksummed and safe to repeat), then starts the server. Run the seed and the admin creation once:

```bash
docker exec -it perkora node dist/cli.cjs seed
docker exec -it -e ADMIN_PASSWORD='…' perkora node dist/cli.cjs create-admin --email you@yourdomain --name "Your Name"
```

## Option B: Render Blueprint (included)

`render.yaml` creates a free web service and a free PostgreSQL database in Frankfurt.

- **Nothing is installed on Render.** The service runs the prebuilt bundle.
- **Start command:** `node dist/cli.cjs bootstrap && node dist/server.cjs`. This applies migrations, seeds the plans, and creates the admin from `ADMIN_EMAIL` and `ADMIN_PASSWORD`, which Render asks for. The server then builds the demo café in the background on first boot.
- **Generated values:** `APP_SECRET` and `DEMO_PASSWORD`.
- **Automatic settings:** `APP_URL` is taken from `RENDER_EXTERNAL_URL`, and the proxy is trusted.
- **Free-plan limits:** the web service sleeps after 15 minutes idle, and the database expires after 30 days. Move to paid plans or an external permanent database before real use.

See [GETTING_STARTED.md](GETTING_STARTED.md), Stage 2.

## Option C: Render or Railway without the blueprint

| Setting | Value |
|---|---|
| Build command | `npm install && npm run build` |
| Start command | `node dist/cli.cjs migrate && node dist/server.cjs` |
| Health check path | `/healthz` |
| Node version | 22 (set `NODE_VERSION=22` or use the `engines` field) |
| Environment | as in the checklist above |

Add a PostgreSQL instance from the same provider, or use Supabase or Neon, and paste its connection string into `DATABASE_URL`. Use the pooled or "transaction" connection string only if it supports prepared statements over the extended protocol. Otherwise use the direct connection string, which is the safer default.

## Option D: a plain VPS with systemd and nginx

1. Install Node 22 and PostgreSQL. Create a database and a user.
2. Copy the repository, then run `npm install && npm run build`. Only `dist/`, `public/`, `migrations/` and `package.json` are needed at runtime.
3. Put the environment in `/etc/perkora.env` (mode 600).
4. Create a systemd unit:

```ini
[Service]
EnvironmentFile=/etc/perkora.env
WorkingDirectory=/srv/perkora
ExecStartPre=/usr/bin/node dist/cli.cjs migrate
ExecStart=/usr/bin/node dist/server.cjs
Restart=always
User=perkora
```

5. Configure nginx. It terminates TLS (for example with Let's Encrypt), proxies to `127.0.0.1:3000`, and sets `X-Forwarded-For`; set `TRUST_PROXY=true`. The app compresses its own responses and serves hashed static assets with year-long cache headers.

## Using Supabase or Neon

Both are plain PostgreSQL to Perkora. Use the direct connection string with `?sslmode=require`. Perkora uses neither Supabase Auth nor storage; its own auth tables live in the same database. For `verify-full` with a private CA, put the CA certificate (PEM) in `DATABASE_CA_CERT`.

## Operations

| Task | How |
|---|---|
| Activate a paid café after arranging payment | Admin → Cafés → the café's subscription actions: **Activate**, then **Mark paid** (recorded as a manual payment) |
| Reset the demo café | Admin → Demo → **Reset demo data**, or `node dist/cli.cjs demo-reset`. Only demo records are touched |
| See server errors | Admin → Error logs. Also stdout/stderr from the process |
| Change plan prices and limits | Admin → Plans |
| Rotate `APP_SECRET` | Change the variable and restart. Member QR codes on screen refresh within minutes; nothing else depends on it |
| Upgrade | Deploy the new build. Pending migrations apply on start |

## Scaling notes

- **Single instance.** One instance on a small machine (512 MB RAM) is plenty for the launch phase.
- **Several instances.** Several instances behind a load balancer work: sessions, rate limits and idempotency all live in PostgreSQL, and in-process housekeeping is idempotent.
- **Database pool.** Keep `DATABASE_POOL_MAX` × the number of instances below the database's connection limit.
