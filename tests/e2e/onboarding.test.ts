/** A new owner signs up, sets up a café across five resumable steps (including its look), goes live, and a referral works end to end. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium, type Browser } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:3000';
const SHOTS = process.env.SHOTS_DIR ?? '';
let browser: Browser;
const errors: string[] = [];

before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  await browser.close();
});

test('a café owner can onboard, resume, activate and serve a first customer', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(String(e)));
  const shot = async (n: string) => {
    if (!SHOTS) return;
    fs.mkdirSync(SHOTS, { recursive: true });
    await p.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true });
  };
  const stamp = Date.now().toString(36);
  const email = `owner-${stamp}@example.com`;

  await p.goto(`${BASE}/pricing`);
  await p.getByRole('link', { name: 'Start with Premium' }).click();
  await p.fill('input[name=name]', 'Selin Test');
  await p.fill('input[name=email]', email);
  await p.fill('input[name=password]', 'a-good-long-password');
  await p.getByRole('button', { name: 'Continue' }).click();
  await p.waitForURL(/\/onboarding/);

  // step 1 — validation, then save
  await p.getByRole('button', { name: 'Save and continue' }).click();
  await p.getByText('Enter your café’s name.').waitFor();
  await p.fill('input[name=name]', `Kahve Köşesi ${stamp}`);
  await p.fill('input[name=business_email]', email);
  await p.fill('input[name=phone]', '+90 533 000 00 00');
  await shot('onb-1');
  await p.getByRole('button', { name: 'Save and continue' }).click();
  await p.getByRole('heading', { name: 'How should customers earn?' }).waitFor();

  // resume: leaving and returning continues where the owner stopped
  await p.goto(`${BASE}/`);
  await p.goto(`${BASE}/onboarding`);
  await p.getByRole('heading', { name: 'How should customers earn?' }).waitFor();
  await p.getByLabel(/Both, side by side/).check();
  await shot('onb-2');
  await p.getByRole('button', { name: 'Continue' }).click();

  // step 3 — rewards (bring-a-friend rewards are on by default)
  await p.getByRole('heading', { name: 'Set your first reward' }).waitFor();
  await p.fill('input[name=stampsRequired]', '8');
  await p.fill('input[name=rewardName]', 'Free Türk Kahvesi');
  assert.equal(await p.getByLabel('Reward customers who bring a friend').isChecked(), true);
  await shot('onb-3');
  await p.getByRole('button', { name: 'Save and continue' }).click();

  // step 4 — look and QR code
  await p.getByRole('heading', { name: 'Make it yours' }).waitFor();
  await p.getByText('Photo banner', { exact: true }).click();
  await p.locator('label[title="Star"]').click();
  await p.fill('input[name=tagline]', 'Fresh coffee by the harbour');
  await p.setInputFiles('input[name=banner]', new URL('./fixtures/banner.jpg', import.meta.url).pathname);
  // the browser scales the 2400px photo down before upload, and the live preview updates
  await p.waitForFunction(() => {
    const i = document.querySelector<HTMLInputElement>('input[name=banner]');
    return Boolean(i?.files?.[0] && i.files[0].name.endsWith('.jpg') && i.files[0].size > 0);
  });
  await p.getByText('Fresh coffee by the harbour').first().waitFor();
  const qrHref = await p.getByRole('link', { name: /Download QR code/ }).getAttribute('href');
  const slug = /\/c\/([^/]+)\/qr\.svg/.exec(qrHref ?? '')?.[1];
  assert.ok(slug, 'QR link points to the café’s own enrolment page');
  const qr = await p.request.get(`${BASE}${qrHref}`);
  assert.equal(qr.status(), 200);
  assert.match(qr.headers()['content-type'], /image\/svg\+xml/);
  await shot('onb-4');
  // the public page is not live yet
  const pre = await (await browser.newContext()).newPage();
  await pre.goto(`${BASE}/c/${slug}`);
  await pre.getByText(/isn’t available right now/).waitFor();
  await p.getByRole('button', { name: 'Continue to review' }).click();

  // step 5 — review and activate
  await p.getByRole('heading', { name: 'Review and activate' }).waitFor();
  await p.getByText(/Collect 8 stamps and receive Free Türk Kahvesi/).waitFor();
  await shot('onb-5');
  await p.getByRole('button', { name: 'Activate loyalty programme' }).click();
  await p.getByRole('heading', { name: /is live on Perkora/ }).waitFor();
  await shot('onb-done');

  // the empty dashboard explains what to do next
  await p.getByRole('link', { name: 'Open the dashboard' }).click();
  await p.getByText('Your loyalty programme is ready.').waitFor();
  await shot('onb-dashboard-empty');

  // the public page now accepts members and shows the café's look
  await pre.goto(`${BASE}/c/${slug}`);
  await pre.getByText('Fresh coffee by the harbour').waitFor();
  const bannerStyle = await pre.locator('header div[style*="background-image"]').first().getAttribute('style');
  assert.match(bannerStyle ?? '', /\/media\//, 'the uploaded banner is shown');
  await pre.getByRole('button', { name: 'Create account and join' }).waitFor();
  await pre.fill('input[name=name]', 'First Customer');
  await pre.fill('input[name=email]', `first-${stamp}@example.com`);
  await pre.fill('input[name=password]', 'another-long-password');
  await pre.getByRole('button', { name: 'Create account and join' }).click();
  await pre.waitForURL(new RegExp(`/wallet/${slug}`));
  await pre.getByText('0 of 8 stamps collected').waitFor();
  await shot('onb-customer-card');

  // owner sees the member
  await p.goto(`${BASE}/dashboard/customers`);
  await p.getByRole('link', { name: 'First Customer' }).waitFor();

  // bring a friend: the first customer invites someone, who joins with the link
  await pre.getByRole('link', { name: /Invite friends/ }).click();
  await pre.getByRole('link', { name: 'Share on WhatsApp' }).waitFor();
  const link = await pre.locator('input[readonly]').inputValue();
  assert.match(link, new RegExp(`/c/${slug}\\?ref=[A-Z2-9]+$`));
  const friend = await (await browser.newContext()).newPage();
  await friend.goto(link.replace(/^https?:\/\/[^/]+/, BASE));
  await friend.getByText(/You were invited by a friend/).waitFor();
  await friend.fill('input[name=name]', 'Friend Customer');
  await friend.fill('input[name=email]', `friend-${stamp}@example.com`);
  await friend.fill('input[name=password]', 'friend-long-password');
  await friend.getByRole('button', { name: 'Create account and join' }).click();
  await friend.waitForURL(new RegExp(`/wallet/${slug}`));
  await friend.goto(`${BASE}/wallet/${slug}/code`);
  const friendCode = ((await friend.locator('p.tracking-\\[0\\.12em\\]').textContent()) ?? '').replace(/\s/g, '');

  // the friend's first purchase at the counter qualifies the referral
  await p.goto(`${BASE}/terminal`);
  await p.fill('#member-code', friendCode);
  await p.getByRole('button', { name: 'Find', exact: true }).click();
  await p.getByText('Friend C.').waitFor();
  await p.getByRole('button', { name: /Add stamp/ }).first().click();
  await p.getByRole('button', { name: /Confirm and add/ }).click();
  await p.getByText(/Added/).first().waitFor();

  // inviter and friend both received their bring-a-friend stamp
  await pre.goto(`${BASE}/wallet/${slug}`);
  await pre.getByText('1 of 8 stamps collected').waitFor();
  await friend.goto(`${BASE}/wallet/${slug}`);
  await friend.getByText('2 of 8 stamps collected').waitFor();
  await p.goto(`${BASE}/dashboard/referrals`);
  await p.getByText('Rewards earned').waitFor();
  await shot('onb-referrals');
  assert.deepEqual(errors, []);
});
