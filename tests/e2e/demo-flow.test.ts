/**
 * End-to-end test of the 15-step sales demonstration, driven in a real
 * Chromium browser against a running server (BASE, default localhost:3000)
 * with seeded demo data. Run: npm run test:e2e
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:3000';
const PW = process.env.DEMO_PASSWORD ?? 'perkora-demo-2026';
const SHOTS = process.env.SHOTS_DIR ?? '';
let browser: Browser;
const errors: string[] = [];

async function newPage(ctx: BrowserContext): Promise<Page> {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`[pageerror] ${p.url()} ${e}`));
  p.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[console] ${p.url()} ${m.text()}`);
  });
  return p;
}
/** The terminal resets itself 10 s after a success; click "Next customer" only if it is still showing. */
async function nextCustomer(p: Page) {
  const btn = p.getByRole('button', { name: 'Next customer' });
  if (await btn.isVisible()) await btn.click();
  await p.locator('#member-code').waitFor();
}

async function shot(p: Page, name: string) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}
async function signIn(p: Page, email: string) {
  await p.goto(`${BASE}/sign-in`);
  await p.fill('main input[name=email]', email);
  await p.fill('main input[name=password]', PW);
  await p.locator('main form[action="/sign-in"]').first().locator('button[type=submit]').click();
  await p.waitForLoadState('networkidle');
}

before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  await browser.close();
  if (errors.length) console.log(errors.join('\n'));
});

let memberCode = '';

test('the full sales demo works end to end', async (t) => {
  const customerCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const staffCtx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const ownerCtx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const customer = await newPage(customerCtx);
  const staff = await newPage(staffCtx);
  const owner = await newPage(ownerCtx);

  await t.test('1. the public website opens', async () => {
    await customer.goto(BASE + '/');
    await customer.getByRole('heading', { level: 1 }).waitFor();
    assert.match(await customer.textContent('h1') ?? '', /Reason to Return/);
  });

  await t.test('2–3. a new customer joins the demo café', async () => {
    await customer.goto(`${BASE}/c/perkora-demo-cafe`);
    assert.match(await customer.textContent('h1') ?? '', /Perkora Demo Café/);
    await shot(customer, '02-cafe-page');
    await customer.getByRole('button', { name: /demo customer/i }).click();
    await customer.waitForURL(/\/wallet\/perkora-demo-cafe/);
    await customer.getByText(/Welcome to Perkora Demo Café/).waitFor();
  });

  await t.test('4. the customer sees their loyalty card', async () => {
    // welcome campaign gives 1 stamp on joining
    await customer.getByText('1 of 9 stamps collected').waitFor();
    await shot(customer, '04-wallet-card');
    await customer.getByRole('link', { name: /Show at the counter/ }).click();
    await customer.waitForURL(/\/code$/);
    await customer.locator('[data-island="MemberQr"] svg').waitFor({ timeout: 5000 });
    const code = await customer.locator('p.tracking-\\[0\\.12em\\]').textContent();
    memberCode = (code ?? '').replace(/\s/g, '');
    assert.match(memberCode, /^[A-Z2-9]{8}$/);
    await shot(customer, '04-wallet-code');
  });

  await t.test('5–7. staff find the customer and award a stamp', async () => {
    await signIn(staff, 'staff@demo.perkora.app');
    await staff.goto(`${BASE}/terminal`);
    await staff.fill('#member-code', memberCode);
    await staff.getByRole('button', { name: 'Find', exact: true }).click();
    await staff.getByText(/^Demo \d+\./).first().waitFor();
    await staff.getByRole('button', { name: /Add stamp/ }).first().click();
    await staff.getByRole('dialog').waitFor();
    await shot(staff, '07-terminal-confirm');
    await staff.getByRole('button', { name: /Confirm and add/ }).click();
    await staff.getByText(/Added 1 stamp to Coffee Club/).waitFor();
    await shot(staff, '07-terminal-success');
  });

  await t.test('8–9. the customer’s card shows the new balance', async () => {
    await customer.goto(`${BASE}/wallet/perkora-demo-cafe`);
    // 1 welcome stamp + 1 purchase stamp, plus 1 more if the demo café's weekday-afternoon
    // double-stamp offer is running at the moment the test runs
    const afternoon = await customer.getByText(/Afternoon Coffee Offer: \+1 stamp/).count();
    await customer.getByText(`${2 + afternoon} of 9 stamps collected`).waitFor({ timeout: 8000 });
    await customer.getByText('+1 stamp for a qualifying purchase').first().waitFor();
    await shot(customer, '09-wallet-after');
  });

  await t.test('10. a reward unlocks for a member close to it', async () => {
    await nextCustomer(staff);
    await staff.getByRole('button', { name: /Find by email or phone/ }).click();
    await staff.fill('#member-contact', 'maya.collins@example.com');
    await staff.locator('#member-contact').press('Enter');
    await staff.getByText('Maya C.').waitFor();
    await staff.getByRole('button', { name: /Add stamp/ }).first().click();
    await staff.getByRole('button', { name: '+1' }).click();
    await staff.getByText(/This unlocks: Free Regular Coffee/).waitFor();
    await staff.getByRole('button', { name: /Confirm and add/ }).click();
    await staff.getByText(/Reward unlocked: Free Regular Coffee/).waitFor();
    await shot(staff, '10-reward-unlocked');
  });

  await t.test('11. staff redeem the reward', async () => {
    await nextCustomer(staff);
    await staff.getByRole('button', { name: /Find by email or phone/ }).click();
    await staff.fill('#member-contact', 'maya.collins@example.com');
    await staff.locator('#member-contact').press('Enter');
    await staff.getByText('Maya C.').waitFor();
    await staff.locator('li', { hasText: 'Free Regular Coffee' }).getByRole('button', { name: 'Redeem' }).click();
    await staff.getByRole('button', { name: /Confirm redemption/ }).click();
    await staff.getByText('Reward redeemed').waitFor();
    await shot(staff, '11-redeemed');
  });

  await t.test('12. the redemption appears in transaction history', async () => {
    await signIn(owner, 'owner@demo.perkora.app');
    await owner.goto(`${BASE}/dashboard/transactions?type=redeem`);
    await owner.getByText('Redeemed: Free Regular Coffee').first().waitFor();
    assert.ok(await owner.getByRole('link', { name: 'Maya Collins' }).first().isVisible());
  });

  await t.test('13. analytics reflect the activity', async () => {
    await owner.goto(`${BASE}/dashboard/analytics?range=7`);
    await owner.getByRole('heading', { name: 'Analytics' }).waitFor();
    await shot(owner, '13-analytics');
    await owner.goto(`${BASE}/dashboard`);
    await owner.getByText(/Redeemed: Free Regular Coffee|Free Regular Coffee unlocked/).first().waitFor();
  });

  await t.test('14. the owner creates a reward and a campaign', async () => {
    await owner.goto(`${BASE}/dashboard/rewards/new`);
    await owner.selectOption('select[name=kind]', 'grant');
    await owner.fill('input[name=name]', 'Free Cookie');
    await owner.fill('input[name=description]', 'One cookie from the jar');
    await owner.selectOption('select[name=icon]', 'heart');
    await owner.getByRole('button', { name: 'Create reward' }).click();
    await owner.getByText('Free Cookie saved.').waitFor();

    await owner.goto(`${BASE}/dashboard/campaigns/new?type=limited_time`);
    await owner.fill('input[name=name]', 'Cookie Friday');
    await owner.fill('textarea[name=description]', 'A free cookie with any coffee this week.');
    await owner.selectOption('select[name=benefit_kind]', 'voucher');
    await owner.selectOption('select[name=benefit_reward]', { label: 'Free Cookie' });
    await owner.getByRole('button', { name: /Save and preview/ }).click();
    await owner.getByText('Draft saved').waitFor();
    await shot(owner, '14-campaign-preview');
    await owner.getByRole('button', { name: 'Publish' }).click();
    await owner.getByText(/Published/).first().waitFor();
    await owner.getByRole('button', { name: /Add reward to \d+ card/ }).click();
    await owner.getByText(/Reward added to \d+ card/).waitFor();
  });

  await t.test('15. the customer sees the new offer and reward', async () => {
    await customer.goto(`${BASE}/wallet/perkora-demo-cafe/offers`);
    await customer.getByText('Cookie Friday').waitFor();
    await customer.goto(`${BASE}/wallet/perkora-demo-cafe/rewards`);
    await customer.getByText('Free Cookie').first().waitFor();
    await shot(customer, '15-wallet-rewards');
  });

  assert.deepEqual(errors.filter((e) => !e.includes('favicon')), [], 'no browser errors');
});
