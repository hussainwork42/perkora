# Known limitations

Read this before selling Perkora or putting a real café on it. Everything below is a deliberate scope decision or an honest gap, not a hidden failure.

## Not integrated, and not claimed

| Area | Current state | What it would take |
|---|---|---|
| **Payments and billing** | No payment provider. Paid plans show "pending activation"; a platform admin activates them manually after arranging payment outside the app. No card details are collected anywhere. | Integrate a provider (Stripe, iyzico or similar) and map its webhooks to `subscriptions.status` / `payment_status`. The schema already separates the two. |
| **Email** | No email is sent: no verification, password reset, invitations, receipts or campaign emails. Invitations and claim links are copy-and-share links shown to the owner. | Add a transactional email provider and send the existing invitation and claim links through it. |
| **Forgotten passwords** | No self-service reset, because there is no email. A signed-in user can change their password. A platform admin can reset an admin password with `admin:create`. | Comes with email. |
| **SMS, WhatsApp, push** | None. Campaigns appear inside the customer wallet only. Owners can export marketing-consented contacts as CSV to message them through their own tools. | Add providers, with consent tracking. The consent flag is already stored per café membership. |
| **Apple Wallet / Google Wallet passes** | Not available. The wallet is a mobile web page. | Pass signing certificates and an update service. |
| **POS integration** | None. Staff award stamps and points at the Perkora terminal. | A per-POS integration. |

## Built but not verified on real hardware

- **Camera scanning at the counter.**
  - The terminal uses the browser's `BarcodeDetector` API when the device offers it (Chrome on Android, recent Safari).
  - It falls back to typing the 8-character member code, or to email or phone lookup.
  - The member QR also encodes a scan URL (`/t/m/<token>`). Pointing any phone's own camera app at it opens the terminal for that member when a staff member is signed in on that phone.
  - The manual and URL paths are covered by automated tests. Live camera decoding has **not** been tested on physical phones or tablets, so check it on the café's device before relying on it.
- **Printed QR posters.** Generated codes decode with an independent reader (OpenCV) in the tests, but a printed poster has not been scanned in a café.

## Product scope

- **Turkish coverage.** Turkish covers everything customers and staff see: the marketing site, sign-in and sign-up, the café join page, the customer wallet and account pages, the counter terminal and error pages. The **owner onboarding, owner dashboard and platform admin are English-only** for now. Turkish copy was written for this build and should be reviewed by a native speaker before launch.
- **Single location per café.** Each café is one business. There is no multi-branch view, though an owner can own several cafés and switch between them.
- **No automatic expiry of stamps or points.** Rewards (vouchers) can have an expiry period. Stamp and point balances do not expire.
- **Photography and images.** The marketing site uses illustrations and interface mock-ups, not photographs. Café logos are stored in PostgreSQL (`uploads` table, 1 MB limit, PNG, JPEG or WebP checked by content), which is fine at this scale. Move them to object storage if many cafés upload images.
- **Analytics are descriptive.** They count what happened, using the definitions in [METRICS.md](METRICS.md). They do not claim revenue uplift, because Perkora cannot see sales that did not go through the terminal.
- **Pricing is a proposal.** Starter €9, Growth €19 and Premium €35 per month are shown as introductory proposals. Plan prices, limits and features are editable in the platform admin. There are no discount codes or countdowns.

## Legal and company details

- The privacy policy and terms of service are carefully written drafts, not legal advice. They must be reviewed by a lawyer familiar with TRNC law and GDPR-style obligations, with real company details added, before taking real customer data.
- No company registration number, address or phone number appears anywhere, because none was provided. Add them before launch.
- There are no testimonials, customer logos, partner claims or customer counts. Add them only when they are real.

## Engineering trade-offs (see the README "Stack" section)

- **Dependencies built in-repo.** The build environment had no access to the npm registry. Perkora therefore uses its own PostgreSQL driver, HTTP layer and QR encoder instead of `pg`, a web framework and a QR library. All three are covered by tests. The driver exposes a `pg`-compatible API, so replacing it with `pg` is a one-line change once npm is available.
- **No lockfile.** No `package-lock.json` is committed, because one could not be generated without registry access. Run `npm install` once with registry access and commit the lockfile it creates.
- **Not Next.js.** The brief suggested Next.js and Vercel. This build is a server-rendered React app on plain Node, deployable to any Node host or as a Docker image. See [DEPLOYMENT.md](DEPLOYMENT.md).
- **Rate limits live in PostgreSQL.** This suits one or a few app instances. For heavy traffic, move them to Redis.
- **Background jobs run inside the web process.** Voucher expiry and session clean-up run on an in-process timer. With several instances this is safe (the work is idempotent), just redundant.
- **Accessibility.** Semantic HTML, labelled inputs, visible focus, sufficient colour contrast and reduced-motion support were built in and checked by hand. No screen-reader audit has been done yet.
- **Not deployed.** This build has not been deployed anywhere. Nothing in the repository claims it is live.
