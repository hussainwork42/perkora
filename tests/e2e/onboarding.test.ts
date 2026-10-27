/** A new owner signs up, sets up a café across five resumable steps and goes live. */
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
  await p.getByRole('link', { name: 'Start with Growth' }).click();
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

  // step 3 — first reward
  await p.getByRole('heading', { name: 'Set your first reward' }).waitFor();
  await p.fill('input[name=stampsRequired]', '8');
  await p.fill('input[name=rewardName]', 'Free Türk Kahvesi');
  await shot('onb-3');
  await p.getByRole('button', { name: 'Save and continue' }).click();

  // step 4 — QR
  await p.getByRole('heading', { name: 'Your QR code' }).waitFor();
  const qrHref = await p.getByRole('link', { name: /Download SVG/ }).getAttribute('href');
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

  // the public page now accepts members
  await pre.goto(`${BASE}/c/${slug}`);
  await pre.getByRole('button', { name: 'Create account and join' }).waitFor();
  await pre.fill('input[name=name]', 'First Customer');
  await pre.fill('input[name=email]', `first-${stamp}@example.com`);
  await pre.fill('input[name=password]', 'another-long-password');
  await pre.getByRole('button', { name: 'Create account and join' }).click();
  await pre.waitForURL(new RegExp(`/wallet/${slug}`));
  await pre.getByText('0 of 8 stamps collected').waitFor();

  // owner sees the member
  await p.goto(`${BASE}/dashboard/customers`);
  await p.getByRole('link', { name: 'First Customer' }).waitFor();
  assert.deepEqual(errors, []);
});
