/**
 * The owner's "My café" page, the café's colours in the dashboard, staying signed in,
 * and the customer's home (progress at each café and offers across Perkora cafés).
 */
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { award, closePool, db, makeCafe, one, resetDb, type TestCafe } from '../helpers';

const { createApp } = await import('../../src/server/app');
const { hashPassword } = await import('../../src/server/auth/crypto');

let server: http.Server;
let base = '';

class Client {
  cookies = new Map<string, string>();
  raw: string[] = [];
  async req(method: string, path: string, form?: Record<string, string>) {
    const headers: Record<string, string> = { cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '), origin: base };
    let body: string | undefined;
    if (form) {
      headers['content-type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams({ _csrf: this.cookies.get('pk_csrf') ?? '', ...form }).toString();
    }
    const res = await fetch(base + path, { method, headers, body, redirect: 'manual' });
    for (const c of res.headers.getSetCookie()) {
      this.raw.push(c);
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      if (/Max-Age=0/.test(c)) this.cookies.delete(pair.slice(0, i));
      else this.cookies.set(pair.slice(0, i), pair.slice(i + 1));
    }
    return { status: res.status, text: await res.text(), location: res.headers.get('location') };
  }
  get(path: string) {
    return this.req('GET', path);
  }
  post(path: string, form: Record<string, string> = {}) {
    return this.req('POST', path, form);
  }
  async signIn(email: string, password: string) {
    await this.get('/sign-in');
    return this.post('/sign-in', { email, password });
  }
}

const PASSWORD = 'owner-home-pass-123';
let cafe: TestCafe;
let ownerEmail = '';
const owner = new Client();

before(async () => {
  await resetDb();
  server = http.createServer(createApp());
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  cafe = await makeCafe({ name: 'Harbour Home Test' });
  await db.query(`update businesses set primary_colour = '#1F5C4A', secondary_colour = '#E7B448', city = 'Girne', list_in_directory = true where id = $1`, [cafe.businessId]);
  ownerEmail = (await one(db, 'select email from users where id = $1', [cafe.ownerId])).email;
  await db.query('insert into user_credentials (user_id, password_hash) values ($1, $2)', [cafe.ownerId, await hashPassword(PASSWORD)]);
  const r = await owner.signIn(ownerEmail, PASSWORD);
  assert.equal(r.status, 303);
});
after(async () => {
  server?.close();
  await closePool();
});

describe('staying signed in', () => {
  test('the session lasts until sign-out, and the site sends signed-in people back to their own place', async () => {
    const session = owner.raw.find((c) => c.startsWith('pk_session='));
    const maxAge = Number(/Max-Age=(\d+)/.exec(session ?? '')?.[1]);
    assert.ok(maxAge >= 365 * 86400, `session cookie lasts ${maxAge}s`);
    const home = await owner.get('/');
    assert.equal(home.status, 302);
    assert.equal(home.location, '/home');
    const next = await owner.get('/home');
    assert.match(next.location ?? '', /\/dashboard/);
    // the website is still reachable on purpose
    assert.equal((await owner.get('/?site')).status, 200);
    // signed out: the homepage as usual
    assert.equal((await new Client().get('/')).status, 200);
  });
});

describe('My café', () => {
  test('shows the café in its own colours with each part ready to change', async () => {
    const r = await owner.get('/dashboard/cafe');
    assert.equal(r.status, 200);
    assert.ok(r.text.includes('Harbour Home Test'));
    for (const part of ['Logo', 'Café photo', 'Colours', 'Welcome line', 'Where to find you', 'Loyalty card', 'Extra rewards', 'Offers', 'Your QR code']) assert.ok(r.text.includes(part), part);
    // the dashboard uses the café's colours (main colour darkened for readable text)
    assert.match(r.text, /--color-espresso:#[0-9a-f]{6}/i);
    assert.match(r.text, /--cafe-primary:#1F5C4A/i);
  });

  test('changes are saved from the page itself', async () => {
    await owner.post('/dashboard/cafe/welcome', { tagline: 'Fresh coffee by the harbour' });
    await owner.post('/dashboard/cafe/colours', { primary_colour: '#7a1f2b', secondary_colour: '#f0c060' });
    const loc = await owner.post('/dashboard/cafe/location', { address: 'Harbour Road 4', city: 'Girne', phone: '+90 533 000 00 00', instagram: '@harbourhometest' });
    assert.equal(loc.status, 303);
    const b = await one(db, 'select settings, primary_colour, secondary_colour, address, phone, website from businesses where id = $1', [cafe.businessId]);
    assert.equal(b.settings.tagline, 'Fresh coffee by the harbour');
    assert.deepEqual([b.primary_colour, b.secondary_colour], ['#7A1F2B', '#F0C060']);
    assert.deepEqual([b.address, b.phone, b.website], ['Harbour Road 4', '+90 533 000 00 00', 'https://instagram.com/harbourhometest']);
    const bad = await owner.post('/dashboard/cafe/colours', { primary_colour: 'red', secondary_colour: '#000000' });
    assert.match(bad.location ?? '', /edit=colours/);
    const noFile = await owner.post('/dashboard/cafe/image/logo', {});
    assert.match(noFile.location ?? '', /edit=logo/);
  });

  test('extra rewards can be removed, the main card reward cannot', async () => {
    const extra = await owner.post(`/dashboard/cafe/rewards/${cafe.pointsRewardId}/remove`);
    assert.equal(extra.status, 303);
    assert.equal((await one(db, 'select status from rewards where id = $1', [cafe.pointsRewardId])).status, 'archived');
    await owner.post(`/dashboard/cafe/rewards/${cafe.cardRewardId}/remove`);
    assert.equal((await one(db, 'select status from rewards where id = $1', [cafe.cardRewardId])).status, 'active');
  });

  test('a new café sees what to do next on the Overview', async () => {
    const r = await owner.get('/dashboard');
    assert.match(r.text, /Get started/);
    assert.match(r.text, /Give your first stamp/);
  });

  test('staff can’t open My café', async () => {
    const s = await one(db, `insert into users (name, email) values ('Staff Person', 'staff.home@example.com') returning id`);
    await db.query('insert into user_credentials (user_id, password_hash) values ($1, $2)', [s.id, await hashPassword(PASSWORD)]);
    await db.query(`insert into business_members (business_id, user_id, role) values ($1, $2, 'staff')`, [cafe.businessId, s.id]);
    const staff = new Client();
    await staff.signIn('staff.home@example.com', PASSWORD);
    const r = await staff.get('/dashboard/cafe');
    assert.notEqual(r.status, 200);
  });
});

describe('the customer’s home', () => {
  test('shows their progress at each café and offers from Perkora cafés', async () => {
    const guest = new Client();
    await guest.get(`/c/${(await one(db, 'select slug from businesses where id = $1', [cafe.businessId])).slug}`);
    const j = await guest.post(`/c/${(await one(db, 'select slug from businesses where id = $1', [cafe.businessId])).slug}/join`, { email: 'home.guest@example.com', password: 'home-guest-123' });
    assert.equal(j.status, 303);
    const m = await one(db, `select m.id from loyalty_memberships m join customers c on c.id = m.customer_id join users u on u.id = c.user_id where u.email = 'home.guest@example.com'`);
    for (let i = 0; i < 3; i++) await award(cafe, m.id, { now: new Date(Date.now() - (3 - i) * 86400000 * 2) });
    // a public offer at another listed café, and a private win-back one that must not show
    const other = await makeCafe({ name: 'Old Town Offers Test' });
    await db.query(`update businesses set list_in_directory = true where id = $1`, [other.businessId]);
    await db.query(
      `insert into campaigns (business_id, name, campaign_type, status, start_date, end_date, is_public, target_segment, published_at)
       values ($1, 'Double stamps Friday', 'limited_time', 'published', current_date, current_date + 3, true, 'all', now()),
              ($1, 'We miss you', 'win_back', 'published', current_date, null, true, 'inactive', now()),
              ($1, 'Next week special', 'limited_time', 'published', current_date + 5, null, true, 'all', now())`,
      [other.businessId],
    );
    const home = await guest.get('/wallet');
    assert.equal(home.status, 200);
    assert.match(home.text, /Where to go today/);
    assert.match(home.text, /3\/9/);
    assert.match(home.text, /6 more stamps/);
    assert.match(home.text, /Double stamps Friday/);
    assert.match(home.text, /Next week special/);
    assert.match(home.text, /Starts/);
    assert.ok(!home.text.includes('We miss you'));
    assert.match(home.text, /home\.guest@example\.com/);
    // signed-in customers go straight to their cards
    assert.equal((await guest.get('/home')).location, '/wallet');
  });
});
