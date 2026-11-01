# Test report

**Run date:** 1 November 2026, on the build delivered with this report (second release: camera scanning, two plans, referrals, messages, sign-up paths, café look).

**Environment:**

- Node.js 22 on Linux
- PostgreSQL 16 on localhost
- Chromium through Playwright (end-to-end tests)
- Python OpenCV, used as an independent QR reader

| Suite | Command | Tests | Passed | Failed |
|---|---|---:|---:|---:|
| Unit | `npm run test:unit` | 23 | 23 | 0 |
| Loyalty engine (integration, real PostgreSQL) | `npm run test:integration` | 43 | 43 | 0 |
| New features: referrals, plans (integration) | `npm run test:integration` | 6 | 6 | 0 |
| HTTP: auth, roles, tenancy, CSRF, new pages (integration) | `npm run test:integration` | 32 | 32 | 0 |
| **Unit and integration total** | `npm test` | **104** | **104** | **0** |
| Browser: 15-step sales demo | `npm run test:e2e` | 11 steps | 11 | 0 |
| Browser: onboarding, café look and a referral | `npm run test:e2e` | 1 | 1 | 0 |
| Browser: camera scanning (staff terminal and customer) | `npm run test:e2e` | 2 | 2 | 0 |
| TypeScript | `npm run typecheck` | — | clean | — |

## How each suite runs

- **Integration tests** run against a real PostgreSQL database (`perkora_test`) that each test file resets. Nothing is mocked: the same SQL, transactions and locks run as in production.
- **Concurrency tests** fire real parallel requests at the database. They cover double-clicks with one idempotency key, two counters serving the same member, and two redemptions of one reward.
- **End-to-end tests** drive three separate browser sessions (customer, staff and owner) against the running server and the freshly reset demo café.

## What is covered

### Authentication and roles

- Registering signs the user in, and sign-out works.
- Invalid credentials are rejected.
- Passwords are stored as scrypt hashes, never as plain text.
- Protected pages require sign-in.
- Sign-in attempts are rate limited per account.
- Staff cannot reach owner-only pages or platform administration.
- Staff cannot correct balances without the matching permission.
- Customers cannot award themselves credit or use staff tools.
- A customer can only fetch QR state for their own membership.

### Tenant isolation

**Over HTTP:**

- Café A cannot open café B's customers, rewards or programmes.
- Café A's analytics and transactions contain only café A data.
- The terminal cannot find, award or redeem for another café's member.
- A signed QR token from another café is refused.
- Tampered and expired tokens are refused.
- A café-selection cookie cannot switch into a café the user does not belong to.

**In the engine:**

- A café cannot award, redeem or adjust for another café's member.
- A suspended café cannot award credit.
- A customer keeps separate balances at two cafés.

### Request forgery and headers

- State-changing requests without the CSRF token are refused.
- Cross-site posts are refused even when they carry a token.
- Security headers are present.

### Stamp cards

- The configured number of stamps is awarded, and one verified visit is recorded.
- A quantity above the per-purchase maximum is rejected with no side effects.
- The reward unlocks exactly at the threshold, and extra stamps carry over.
- When a purchase was already discounted by another promotion and the programme does not combine with promotions, the award is refused.

### Duplicate protection

- The same idempotency key never awards twice.
- Concurrent double-clicks produce exactly one award.
- Two counters awarding the same member at once both succeed without deadlock.
- A purchase reference earns credit only once.
- A second award moments later needs explicit confirmation.

### Redemption

- A held reward redeems once, and a repeat is rejected.
- With concurrent attempts on one reward, exactly one succeeds.
- Expired rewards cannot be redeemed.
- Voucher expiry falls at the end of the local day in the café's timezone.

### Points

- Arithmetic uses integers on minor units, rounding down.
- An amount in another currency is refused, not converted.
- Insufficient points block redemption, and nothing is deducted.
- A redemption deducts exactly the cost, atomically.
- A redemption that fails a limit check leaves the balance untouched.
- An inactive reward cannot be redeemed.

### Corrections

- A reversal adds a record instead of deleting, and cannot be repeated.
- Reversing the stamp that completed a card cancels the unused reward first.
- Credits already spent on a redeemed reward cannot be reversed automatically.
- A mistaken redemption can be reversed, which returns the reward.
- Manual adjustments are audited and cannot take a balance below zero.
- The transaction history reconciles with every balance after a mixed workload.

### Challenges, campaigns, referrals and birthdays

**Challenges:**

- Visits on three local days in a week complete the challenge once.
- Repeated awards within one visit do not advance a streak.
- Days follow the café's timezone.
- Draft and ended challenges award nothing.

**Campaigns:**

- Drafts are not applied, and expired campaigns issue nothing.
- Weekday and time windows are evaluated in local time.
- Per-customer limits are enforced.
- The welcome offer is issued once.
- Win-back distribution targets only inactive members and never duplicates.
- Draft campaigns cannot distribute.

**Referrals:**

- A referral qualifies only after the new member's first verified visit, and only once.
- Self-referral is blocked.
- Per-referrer limits are enforced.

**Birthdays:**

- A birthday reward is issued once per year, inside the configured window.

### Team and account flows (HTTP)

- An owner invites staff, only the invited email can accept, and the new staff member can then use the terminal.
- A customer added at the counter claims their membership with a one-time link.
- A customer can export and delete their account.
- A draft campaign is hidden from customers, and a published one is shown.

### Second release (November 2026)

**Camera scanning:**

- Perkora now reads QR codes with its own decoder, so scanning no longer depends on a browser feature that iPhones and most laptops lack.
- Unit tests decode perfect and damaged codes at all error-correction levels, and camera-like frames that are rotated, tilted, unevenly lit and noisy. A frame without a code never produces a result.
- Browser tests film a customer's live QR code with a simulated camera; the staff terminal finds the customer. A second test scans a café's counter code from the customer side and lands on the join page.
- During development the decoder read 95% of 320 randomly distorted test frames in a single frame each (the misses were codes cut off by the frame edge or about 2 pixels per module), with no wrong results. The scanner reads several frames a second, so a scan usually succeeds within a second or two.

**Referrals:**

- Rewarding on join pays the inviter at once, and only once; rewarding on first visit waits for a verified purchase.
- The friend's reward can be "nothing". The per-member limit applies. Turning the programme off stops new rewards.
- Referrals work on the Basic plan.
- Over HTTP: only the owner can change the settings, invalid amounts are refused, and the customer's invite page shows the right wording and the WhatsApp button.

**Plans:** exactly two active plans (Basic €9, Premium €19 recommended). The migration moves existing cafés from Starter to Basic and from Growth to Premium; this was also run against a copy of the previous database, including a non-demo café.

**Messages:** a contact message is saved, café owners can't read it, the platform admin sees it with a "new" count and can mark it as replied.

**Navigation and sign-up:** the start page links to every café and customer path, the logo leads home, the sign-up pages switch between customer and café accounts, and the café list shows only active cafés that opted in, with search.

**Café look:** layout, stamp design and welcome message are saved and shown on the join page; unknown values fall back to safe defaults. The onboarding browser test uploads a banner photo (resized in the browser before upload) and checks it on the public page.

**Campaign names:** any name is accepted ("Student exam week").

### Unit tests

- **Member QR tokens:** round-trip, expiry, tamper rejection, extraction from a scanned URL.
- **QR encoder:** version selection and SVG output, plus decoding by OpenCV at all four error-correction levels, including Turkish characters and € and ₺ symbols.
- **Money:** typed amounts are parsed into integer minor units, and EUR and TRY are formatted without conversion.
- **Privacy:** staff see a shortened name (first name and last initial).
- **Calendar:** ISO weeks, and Northern Cyprus time across the October daylight-saving change.
- **Security helpers:** scrypt salting, the unambiguous member-code alphabet, CSV formula neutralisation, Turkish-aware slugs.
- **Database driver:** parameter serialisation, and parsing of the connection string including `sslmode`.
- **Localisation:** the Turkish and English dictionaries have identical keys; interpolation and plurals work.

### Browser: the 15-step sales demo

`tests/e2e/demo-flow.test.ts` follows [DEMO_GUIDE.md](DEMO_GUIDE.md) end to end:

1. The website opens.
2. A new customer joins the demo café.
3. The customer sees their card and rotating QR code.
4. Staff find the customer by member code and award a stamp, with confirmation.
5. The customer's card shows the new balance.
6. Staff award Maya the stamp that unlocks her reward.
7. Staff redeem the reward.
8. The redemption appears in transaction history.
9. The analytics reflect the new activity.
10. The owner creates a reward and publishes a campaign.
11. The customer sees the new offer and reward.

### Browser: onboarding

`tests/e2e/onboarding.test.ts` covers a new owner who:

- signs up and stops partway through onboarding;
- signs back in and resumes at the right step;
- finishes onboarding, downloads the QR poster and activates the café;
- serves the café's first customer at the terminal.

## Issues found and fixed during testing

- **Deadlock between counters.** Two terminals awarding the same member could deadlock. Fixed by switching to `FOR NO KEY UPDATE` row locks; covered by a test.
- **Audit-log crash.** Some audit inserts failed with a PostgreSQL type-inference error (`42P08`) when activating a café or joining a team. Fixed.
- **Offers shown to the wrong members.** Segment-targeted offers were shown to every member in the wallet. They are now filtered per member.
- **Time-dependent demo test.** The demo café's weekday-afternoon double-stamp offer made one browser test fail between 14:00 and 17:00 local time. The test now accounts for the offer being live.
- **Arbitrary CSS classes with commas.** Layouts using `grid-cols-[minmax(0,1fr)_340px]` were missing from the stylesheet, so some two-column pages stacked. The build now picks these up.
- **Banner logo hidden.** In the photo-banner layout the café logo slid behind the photo. Fixed.
- **Test database safety.** The test helper could fall back to an exported `DATABASE_URL` and wipe it. Tests now use only `TEST_DATABASE_URL` and refuse any database whose name does not end in `_test`.
- **QR test flakiness.** OpenCV's detector is scale-sensitive (about 0.6% misreads at a single scale). The test now tries several scales; the encoder itself was correct.

## Not tested (see KNOWN_LIMITATIONS.md)

- Camera scanning on physical phones and tablets. It is tested with a simulated camera in Chromium; try it on the café's own device before relying on it.
- Email, SMS, push notifications and payments. None are integrated.
- Load beyond a single small server.
- Screen readers. Semantic markup, labels, focus states and contrast were checked by hand, but no assistive-technology audit has been done.
