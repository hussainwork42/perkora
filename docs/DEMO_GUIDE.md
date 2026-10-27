# Sales demo guide

A 10–15 minute walkthrough for a café owner, using the fictional **Perkora Demo Café** in Girne. Every person, visit and transaction in it is invented, and the app says so on every demo page.

This exact script is automated in `tests/e2e/demo-flow.test.ts`, so it is known to work on the current build.

## Before the meeting

1. Reset the demo so Maya is one visit away from her free coffee: `npm run demo:reset` (or **Admin → Demo → Reset demo data**). Real cafés are not touched.
2. Open three browser windows, or use three devices:

| Window | Who | How |
|---|---|---|
| A, a phone, or a narrow window | Customer | Not signed in |
| B, a tablet or laptop | Staff at the counter | `staff@demo.perkora.app` |
| C, a laptop | Owner | `owner@demo.perkora.app` |

The demo password is the `DEMO_PASSWORD` you configured. The sign-in page also shows one-click demo shortcuts when `DEMO_MODE=true`.

**Tip:** Between 14:00 and 17:00 on weekdays (Girne time), the demo's *Afternoon Coffee Offer* doubles stamps. That is a nice moment to point out, but expect 2 stamps instead of 1.

## The people in the demo

| Member | Story | Use them to show |
|---|---|---|
| **Maya Collins** (`maya.collins@example.com`) | Weekly regular, 7 of 9 stamps, 93 points. Also a member of Lemon Tree Bakery | Unlocking and redeeming a reward. One account, two cafés |
| **Andreas Georgiou** | Has an unused Free Regular Coffee | The "unused rewards" segment, redeeming a held reward |
| **Hannah Wright** | Hasn't visited for over a month | The "not visited recently" segment and the *We miss you* win-back |
| **Leyla Özkan** | Joined two days ago | The "new members" segment |
| **Deniz Arslan** | Long-standing regular | Frequent visitors, birthday offer |

## The 15 steps

### The customer joins (window A)

1. **Open the website.** Start on the home page. Mention that it is in English and Turkish (switch in the header) and that pricing is shown openly.
2. **Scan the café's QR code.** Open `/c/perkora-demo-cafe`. This is the page a customer reaches by scanning the poster on the counter. It shows the café, the programmes and what you get.
3. **Join.** Tap **Join as a demo customer**. In real life the customer gives a name and email or phone; the demo shortcut creates a fictional guest. They land on their card with a welcome stamp already collected (the café's *Welcome stamp* campaign).
4. **Show the card.** Show the stamp card and points balance. Tap **Show at the counter** to show the QR code. It rotates every few minutes, contains no personal data, and has an 8-character member code underneath.

### The counter (window B)

5. **Open the terminal.** As staff, the terminal is the home screen. It is designed for one-handed use on a tablet.
6. **Find the customer.** Scan the QR code, or type the member code and press **Find**. Staff only see the customer's first name and initial.
7. **Add a stamp.** Tap **Add stamp**. A confirmation shows exactly what will happen; confirm. The terminal shows **Done** and returns to ready after 10 seconds. Mention that double taps can never award twice.

### Back to the customer (window A)

8. **The card updates.** Within about 5 seconds the customer's card refreshes by itself with the new stamp.
9. **Show the history.** Open **Activity**. Every stamp is explained ("Welcome stamp", "+1 stamp for a qualifying purchase", any offer bonus).

### A reward (window B)

10. **Unlock a reward.** Tap **Next customer**, then **Find by email or phone**, and enter `maya.collins@example.com`. Maya has 7 of 9. Add 2 stamps (tap **+1** in the dialog). The dialog warns *This unlocks: Free Regular Coffee*. Confirm, and the terminal celebrates the unlocked reward.
11. **Redeem it.** Look Maya up again. Her **Free Regular Coffee** is listed under rewards. Tap **Redeem**, then **Confirm redemption**. A reward can only ever be redeemed once.

### The owner's view (window C)

12. **Transactions.** Open **Transactions**. The stamps and the redemption you just made are at the top, with who did them and at which counter. Mistakes are corrected with a reversal record, never by deleting history.
13. **Overview and Analytics.** Show visits, active members, rewards redeemed and the returning-member rate. Each number has a plain-language definition (the ⓘ next to it). Then open **Customers**: the segments for *close to a reward*, *unused rewards* and *not visited recently* (Hannah) are the owner's to-do list.
14. **Create a reward and a campaign.** Under **Rewards → New reward**, create, for example, *Free Cookie*. Under **Campaigns → New campaign**, create a bonus or reward campaign, preview what customers will see, and **Publish**. Draft campaigns are never shown to customers.

### The customer again (window A)

15. **The customer sees it.** Reload **Offers** and **Rewards**. The new campaign and reward are there.

## Good follow-up moments

- **Win-back.** Open *We miss you* under **Campaigns**. It was sent only to members who had stopped visiting, and nobody gets it twice.
- **Team.** Under **Team**, owners invite staff by link and choose what each person may do (for example, whether they can correct balances).
- **Customer privacy.** In the customer's **Account** page, customers can download their data or delete their account.
- **Turkish.** Switch the customer wallet and the terminal to TR.
- **Subscription.** Plans are introductory proposals. No card is taken in the app; activation is arranged directly.

## Things not to promise (see KNOWN_LIMITATIONS.md)

Do not promise any of the following, because none of them exist yet:

- email, SMS or WhatsApp campaigns;
- Apple or Google Wallet passes;
- POS integration;
- online payment.

Also test camera scanning on the café's own tablet before promising it. Typing the code always works.
