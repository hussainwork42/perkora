/**
 * HTTP-level tests: authentication, roles, tenant isolation, CSRF and rate
 * limits, exercised through the real router against the test database.
 */
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { closePool, db, key, makeCafe, makeMember, one, resetDb, tx, loyalty } from '../helpers';

const { createApp } = await import('../../src/server/app');
const { hashPassword } = await import('../../src/server/auth/crypto');

let server: http.Server;
let base = '';

class Client {
  cookies = new Map<string, string>();
  constructor(public name = 'client') {}
  get csrf() {
    return this.cookies.get('pk_csrf') ?? '';
  }
  async req(method: string, path: string, opts: { form?: Record<string, string>; json?: unknown; origin?: string; noCsrf?: boolean; headers?: Record<string, string> } = {}) {
    const headers: Record<string, string> = { cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '), ...(opts.headers ?? {}) };
    let body: string | undefined;
    if (opts.form) {
      headers['content-type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams({ ...(opts.noCsrf ? {} : { _csrf: this.csrf }), ...opts.form }).toString();
    } else if (opts.json !== undefined) {
      headers['content-type'] = 'application/json';
      headers.accept = 'application/json';
      if (!opts.noCsrf) headers['x-csrf-token'] = this.csrf;
      body = JSON.stringify(opts.json);
    }
    headers.origin = opts.origin ?? base;
    const res = await fetch(base + path, { method, headers, body, redirect: 'manual' });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      const k = pair.slice(0, i);
      const v = pair.slice(i + 1);
      if (/Max-Age=0/.test(c)) this.cookies.delete(k);
      else this.cookies.set(k, v);
    }
    const text = await res.text();
    return { status: res.status, location: res.headers.get('location'), text, json: () => JSON.parse(text) };
  }
  get(path: string) {
    return this.req('GET', path);
  }
  post(path: string, form: Record<string, string> = {}) {
    return this.req('POST', path, { form });
  }
  async signIn(email: string, password: string) {
    await this.get('/sign-in');
    return this.post('/sign-in', { email, password });
  }
}

const PASSWORD = 'correct-horse-battery';
let A: Awaited<ReturnType<typeof makeCafe>>;
let B: Awaited<ReturnType<typeof makeCafe>>;
let memberA: string;
let memberB: string;
let memberBCode: string;
let ownerAEmail = '';
let staffAEmail = '';
let customerEmail = '';

async function setPassword(userId: string) {
  await db.query('insert into user_credentials (user_id, password_hash) values ($1, $2) on conflict (user_id) do update set password_hash = excluded.password_hash', [
    userId,
    await hashPassword(PASSWORD),
  ]);
}

before(async () => {
  await resetDb();
  A = await makeCafe({ name: 'Alpha Café' });
  B = await makeCafe({ name: 'Bravo Café' });
  ownerAEmail = (await one(db, 'select email from users where id = $1', [A.ownerId])).email;
  await setPassword(A.ownerId);
  await setPassword(B.ownerId);
  const staff = await one(db, `insert into users (name, email) values ('Staff A', 'staff-a@example.com') returning id, email`);
  staffAEmail = staff.email;
  await setPassword(staff.id);
  await db.query(`insert into business_members (business_id, user_id, role) values ($1, $2, 'staff')`, [A.businessId, staff.id]);
  const cust = await one(db, `insert into users (name, email) values ('Cara Customer', 'cara@example.com') returning id, email`);
  customerEmail = cust.email;
  await setPassword(cust.id);
  const c = await one(db, `insert into customers (user_id, name, email) values ($1, 'Cara Customer', 'cara@example.com') returning id`, [cust.id]);
  memberA = (await tx((q) => loyalty.joinBusiness(q, { businessId: A.businessId, customerId: c.id, source: 'qr', marketingConsent: false }))).membershipId;
  const mb = await makeMember(B, 'Bravo Only Member');
  memberB = mb.membershipId;
  memberBCode = (await one(db, 'select member_code from loyalty_memberships where id = $1', [memberB])).member_code;
  await db.query(`update customers set email = 'bravo-only@example.com' where id = $1`, [mb.customerId]);
  server = http.createServer(createApp());
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  server?.close();
  await closePool();
});

describe('authentication', () => {
  test('a user can register, is signed in, and can sign out', async () => {
    const c = new Client();
    await c.get('/sign-up');
    const r = await c.post('/sign-up', { name: 'New Person', email: 'new.person@example.com', password: 'a-long-password-1' });
    assert.equal(r.status, 303);
    assert.ok(c.cookies.has('pk_session'));
    assert.equal((await c.get('/wallet')).status, 200);
    const out = await c.post('/sign-out');
    assert.equal(out.status, 303);
    assert.equal(c.cookies.has('pk_session'), false);
    const after2 = await c.get('/wallet');
    assert.equal(after2.status, 303);
    assert.match(after2.location ?? '', /\/sign-in/);
  });

  test('invalid credentials are rejected', async () => {
    const c = new Client();
    const r = await c.signIn(ownerAEmail, 'wrong-password-123');
    assert.equal(r.status, 401);
    assert.equal(c.cookies.has('pk_session'), false);
  });

  test('passwords are stored hashed, never in plain text', async () => {
    const row = await one(db, `select password_hash from user_credentials c join users u on u.id = c.user_id where u.email = 'new.person@example.com'`);
    assert.match(row.password_hash, /^scrypt\$/);
    assert.ok(!row.password_hash.includes('a-long-password-1'));
  });

  test('protected pages require authentication', async () => {
    const c = new Client();
    for (const p of ['/dashboard', '/dashboard/customers', '/terminal', '/wallet', '/account', '/onboarding', '/admin']) {
      const r = await c.get(p);
      assert.equal(r.status, 303, p);
      assert.match(r.location ?? '', /sign-in|get-started/, p);
    }
    const api = await c.req('POST', '/api/terminal/lookup', { json: { code: memberBCode } });
    assert.ok([401, 403].includes(api.status), `api status ${api.status}`);
  });

  test('sign-in attempts are rate limited per account', async () => {
    const c = new Client();
    let last = 0;
    for (let i = 0; i < 10; i++) last = (await c.signIn('rate-limit-target@example.com', 'nope-nope-nope')).status;
    assert.equal(last, 429);
  });
});

describe('roles', () => {
  test('staff cannot reach owner-only pages or platform administration', async () => {
    const c = new Client();
    assert.equal((await c.signIn(staffAEmail, PASSWORD)).status, 303);
    assert.equal((await c.get('/terminal')).status, 200);
    for (const p of ['/dashboard/team', '/dashboard/subscription', '/dashboard/settings', '/dashboard/programmes', '/dashboard/customers/export.csv']) {
      assert.equal((await c.get(p)).status, 403, p);
    }
    assert.equal((await c.get('/admin')).status, 403);
    const plan = await c.post('/dashboard/subscription', { plan_id: 'starter' });
    assert.equal(plan.status, 403);
  });

  test('staff cannot correct balances without permission', async () => {
    const c = new Client();
    await c.signIn(staffAEmail, PASSWORD);
    const r = await c.post(`/dashboard/customers/${memberA}/adjust`, { programme_id: A.stampProgrammeId, delta: '5', reason: 'free stamps' });
    assert.equal(r.status, 403);
    const bal = await one(db, 'select coalesce(sum(stamps_delta),0)::int as s from loyalty_transactions where membership_id = $1', [memberA]);
    assert.equal(bal.s, 0);
  });

  test('customers cannot award themselves credit or use staff tools', async () => {
    const c = new Client();
    await c.signIn(customerEmail, PASSWORD);
    const award = await c.req('POST', '/api/terminal/award', {
      json: { membershipId: memberA, programmeId: A.stampProgrammeId, quantity: 1, idempotencyKey: key() },
    });
    assert.ok([401, 403].includes(award.status), `status ${award.status}`);
    const redeem = await c.req('POST', '/api/terminal/redeem', { json: { membershipId: memberA, kind: 'points', rewardId: A.pointsRewardId, idempotencyKey: key() } });
    assert.ok([401, 403].includes(redeem.status));
    assert.equal((await c.get('/dashboard')).status, 303); // no café → sent to set one up
    const bal = await one(db, 'select coalesce(sum(stamps_delta + points_delta),0)::int as s from loyalty_transactions where membership_id = $1', [memberA]);
    assert.equal(bal.s, 0);
  });

  test('a customer’s QR state endpoint only works for their own membership', async () => {
    const c = new Client();
    await c.signIn(customerEmail, PASSWORD);
    const own = await c.get(`/api/wallet/${(await one(db, 'select slug from businesses where id = $1', [A.businessId])).slug}/qr`);
    assert.equal(own.status, 200);
    assert.match(own.json().svg, /^<svg/);
    const other = await c.get(`/wallet/${(await one(db, 'select slug from businesses where id = $1', [B.businessId])).slug}`);
    assert.equal(other.status, 303, 'not a member of B → redirected to B’s join page');
  });
});

describe('tenant isolation over HTTP', () => {
  let owner: Client;
  before(async () => {
    owner = new Client();
    await owner.signIn(ownerAEmail, PASSWORD);
  });

  test('café A cannot open café B’s customers', async () => {
    assert.equal((await owner.get(`/dashboard/customers/${memberB}`)).status, 404);
    const list = await owner.get('/dashboard/customers?q=Bravo');
    assert.equal(list.status, 200);
    assert.ok(!list.text.includes('Bravo Only Member'));
    const csv = await owner.get('/dashboard/customers/export.csv');
    assert.equal(csv.status, 200);
    assert.ok(!csv.text.includes('Bravo Only Member'));
    assert.ok(csv.text.includes('Cara Customer'));
  });

  test('café A cannot open or edit café B’s rewards and programmes', async () => {
    assert.equal((await owner.get(`/dashboard/rewards/${B.grantRewardId}`)).status, 404);
    assert.equal((await owner.get(`/dashboard/programmes/${B.stampProgrammeId}`)).status, 404);
    const edit = await owner.post(`/dashboard/rewards/${B.grantRewardId}`, { name: 'Hijacked', kind: 'grant', status: 'active' });
    assert.equal(edit.status, 404);
    const r = await one(db, 'select name from rewards where id = $1', [B.grantRewardId]);
    assert.equal(r.name, 'Free Pastry');
  });

  test('café A’s analytics and transactions contain only café A data', async () => {
    await tx((q) => loyalty.awardPurchase(q, { businessId: B.businessId, membershipId: memberB, programmeId: B.stampProgrammeId, actorUserId: B.ownerId, idempotencyKey: key(), source: 'terminal' }));
    const txns = await owner.get('/dashboard/transactions');
    assert.ok(!txns.text.includes('Bravo Only Member'));
    const a = await owner.get('/dashboard/analytics/export.csv?range=7');
    assert.equal(a.status, 200);
    const visits = a.text.trim().split('\n').slice(1).reduce((s, l) => s + Number(l.split(',')[1]), 0);
    assert.equal(visits, 0, 'café B’s visit is not counted for café A');
  });

  test('the terminal cannot find, award or redeem for another café’s member', async () => {
    const look = await owner.req('POST', '/api/terminal/lookup', { json: { code: memberBCode } });
    assert.equal(look.status, 404);
    const contact = await owner.req('POST', '/api/terminal/lookup', { json: { contact: 'bravo-only@example.com' } });
    assert.equal(contact.status, 404);
    const member = await owner.get(`/api/terminal/member/${memberB}`);
    assert.equal(member.status, 404);
    const award = await owner.req('POST', '/api/terminal/award', { json: { membershipId: memberB, programmeId: B.stampProgrammeId, quantity: 1, idempotencyKey: key() } });
    assert.equal(award.status, 404);
    const award2 = await owner.req('POST', '/api/terminal/award', { json: { membershipId: memberB, programmeId: A.stampProgrammeId, quantity: 1, idempotencyKey: key() } });
    assert.equal(award2.status, 404);
  });

  test('a signed QR token from another café is refused', async () => {
    const { issueMemberToken } = await import('../../src/server/domain/qrtoken');
    const { token } = issueMemberToken(memberB);
    const r = await owner.req('POST', '/api/terminal/lookup', { json: { token } });
    assert.equal(r.status, 404);
    assert.equal(r.json().error.code, 'other_cafe');
  });

  test('a tampered or expired QR token is refused', async () => {
    const { issueMemberToken } = await import('../../src/server/domain/qrtoken');
    const { token } = issueMemberToken(memberA);
    const tampered = token.slice(0, -2) + (token.endsWith('AA') ? 'BB' : 'AA');
    assert.equal((await owner.req('POST', '/api/terminal/lookup', { json: { token: tampered } })).json().error.code, 'invalid_token');
    const old = issueMemberToken(memberA, new Date(Date.now() - 10 * 60 * 1000)).token;
    assert.equal((await owner.req('POST', '/api/terminal/lookup', { json: { token: old } })).json().error.code, 'token_expired');
    const ok = await owner.req('POST', '/api/terminal/lookup', { json: { token } });
    assert.equal(ok.status, 200);
    assert.equal(ok.json().member.id, memberA);
    assert.ok(!JSON.stringify(ok.json()).includes('cara@example.com'), 'the terminal summary carries no contact details');
  });

  test('a café-selection cookie cannot switch into a café the user does not belong to', async () => {
    const c = new Client();
    await c.signIn(ownerAEmail, PASSWORD);
    c.cookies.set('pk_biz', B.businessId);
    const r = await c.get(`/dashboard/customers/${memberB}`);
    assert.equal(r.status, 404);
  });
});

describe('request forgery protection', () => {
  test('state-changing requests without the CSRF token are refused', async () => {
    const c = new Client();
    await c.signIn(ownerAEmail, PASSWORD);
    const r = await c.req('POST', '/dashboard/settings/loyalty', { form: { inactivityDays: '30' }, noCsrf: true });
    assert.equal(r.status, 403);
    const api = await c.req('POST', '/api/terminal/award', { json: { membershipId: memberA, programmeId: A.stampProgrammeId, idempotencyKey: key() }, noCsrf: true });
    assert.equal(api.status, 403);
  });

  test('cross-site form posts are refused even with a token', async () => {
    const c = new Client();
    await c.signIn(ownerAEmail, PASSWORD);
    const r = await c.req('POST', '/dashboard/settings/loyalty', { form: { inactivityDays: '30' }, origin: 'https://evil.example' });
    assert.equal(r.status, 403);
  });

  test('responses carry security headers', async () => {
    const res = await fetch(base + '/');
    assert.match(res.headers.get('content-security-policy') ?? '', /script-src 'self'/);
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  });
});

describe('end-to-end loyalty over HTTP', () => {
  test('staff award through the API, duplicates are ignored, the customer sees the balance', async () => {
    const staff = new Client();
    await staff.signIn(staffAEmail, PASSWORD);
    await staff.get('/terminal');
    const code = (await one(db, 'select member_code from loyalty_memberships where id = $1', [memberA])).member_code;
    const look = await staff.req('POST', '/api/terminal/lookup', { json: { code: code.slice(0, 4) + ' ' + code.slice(4) } });
    assert.equal(look.status, 200);
    const k = key();
    const body = { membershipId: memberA, programmeId: A.stampProgrammeId, quantity: 1, idempotencyKey: k };
    const [r1, r2] = await Promise.all([staff.req('POST', '/api/terminal/award', { json: body }), staff.req('POST', '/api/terminal/award', { json: body })]);
    assert.equal(r1.status, 200);
    assert.equal(r2.status, 200);
    assert.equal([r1.json().result.duplicate, r2.json().result.duplicate].filter(Boolean).length, 1);
    const cust = new Client();
    await cust.signIn(customerEmail, PASSWORD);
    const slug = (await one(db, 'select slug from businesses where id = $1', [A.businessId])).slug;
    const page = await cust.get(`/wallet/${slug}`);
    assert.ok(page.text.includes('1 of 9 stamps collected'));
  });

  test('a draft campaign is not shown to customers; a published one is', async () => {
    const c = await one(
      db,
      `insert into campaigns (business_id, name, campaign_type, status, start_date, benefit) values ($1, 'Secret Draft Offer', 'custom', 'draft', '2020-01-01', '{"kind":"none"}') returning id`,
      [A.businessId],
    );
    const cust = new Client();
    await cust.signIn(customerEmail, PASSWORD);
    const slug = (await one(db, 'select slug from businesses where id = $1', [A.businessId])).slug;
    assert.ok(!(await cust.get(`/wallet/${slug}/offers`)).text.includes('Secret Draft Offer'));
    await db.query(`update campaigns set status = 'published' where id = $1`, [c.id]);
    assert.ok((await cust.get(`/wallet/${slug}/offers`)).text.includes('Secret Draft Offer'));
  });
});

describe('team and membership flows', () => {
  test('an owner invites staff; only the invited email can accept; staff then use the terminal', async () => {
    const owner = new Client();
    await owner.signIn(ownerAEmail, PASSWORD);
    await owner.get('/dashboard/team');
    const inv = await owner.post('/dashboard/team/invite', { email: 'new.barista@example.com', name: 'New Barista' });
    assert.equal(inv.status, 200);
    const link = /\/invite\/([A-Za-z0-9_-]{30,60})/.exec(inv.text)?.[1];
    assert.ok(link, 'invitation link is shown');

    const wrong = new Client();
    await wrong.signIn(customerEmail, PASSWORD);
    await wrong.get(`/invite/${link}`);
    const refused = await wrong.post(`/invite/${link}`);
    assert.equal(refused.status, 403);

    const barista = new Client();
    await barista.get('/sign-up');
    await barista.post('/sign-up', { name: 'New Barista', email: 'new.barista@example.com', password: 'barista-password-1' });
    await barista.get(`/invite/${link}`);
    const ok = await barista.post(`/invite/${link}`);
    assert.equal(ok.status, 303);
    assert.equal(ok.location, '/terminal');
    assert.equal((await barista.get('/terminal')).status, 200);
    assert.equal((await barista.get('/dashboard/team')).status, 403);
    const again = await barista.post(`/invite/${link}`);
    assert.equal(again.status, 404, 'an invitation works once');
  });

  test('a counter-added customer can claim their membership with a one-time link', async () => {
    const owner = new Client();
    await owner.signIn(ownerAEmail, PASSWORD);
    await owner.get('/dashboard/customers/new');
    const add = await owner.post('/dashboard/customers/new', { name: 'Walk In', phone: '+90 533 111 22 33' });
    assert.equal(add.status, 303);
    const memberId = /\/dashboard\/customers\/([0-9a-f-]{36})/.exec(add.location ?? '')?.[1];
    assert.ok(memberId);
    const claim = await owner.post(`/dashboard/customers/${memberId}/claim`);
    const token = /claim=([A-Za-z0-9_-]+)/.exec(claim.location ?? '')?.[1];
    assert.ok(token);

    const person = new Client();
    await person.get('/sign-up');
    await person.post('/sign-up', { name: 'Walk In', email: 'walk.in@example.com', password: 'walk-in-password-1' });
    const r = await person.get(`/claim/${token}`);
    assert.equal(r.status, 303);
    assert.match(r.location ?? '', /\/wallet\//);
    const linked = await one(db, 'select c.user_id from loyalty_memberships m join customers c on c.id = m.customer_id where m.id = $1', [memberId]);
    assert.ok(linked.user_id);
    const reuse = await new Client().get(`/claim/${token}`);
    assert.equal(reuse.status, 303); // sign-up required; the token is already used
    const used = await one(db, 'select count(*)::int as n from membership_claims where used_at is not null and membership_id = $1', [memberId]);
    assert.equal(used.n, 1);
  });

  test('a customer can export and delete their account', async () => {
    const c = new Client();
    await c.get('/sign-up');
    await c.post('/sign-up', { name: 'Leaving Soon', email: 'leaving@example.com', password: 'leaving-password-1' });
    const slug = (await one(db, 'select slug from businesses where id = $1', [A.businessId])).slug;
    await c.get(`/c/${slug}`);
    await c.post(`/c/${slug}/join`, {});
    const exp = await c.get('/account/export.json');
    assert.equal(exp.status, 200);
    assert.equal(exp.json().account.email, 'leaving@example.com');
    const del = await c.post('/account/delete', { confirm: 'DELETE' });
    assert.equal(del.status, 303);
    const u = await one(db, `select status, email from users where email like 'deleted-%' and name = 'Deleted user' order by updated_at desc limit 1`);
    assert.equal(u.status, 'deleted');
    const cust = await one(db, `select count(*)::int as n from customers where email = 'leaving@example.com'`);
    assert.equal(cust.n, 0, 'personal data removed');
    assert.equal((await new Client().signIn('leaving@example.com', 'leaving-password-1')).status, 401);
  });
});
