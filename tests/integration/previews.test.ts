/**
 * Café previews: the admin builds a café before a sales visit, the owner opens a private link
 * and makes it theirs. Until then nobody can join, and it is hidden from the public café list.
 */
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { closePool, db, one, resetDb } from '../helpers';

const { createApp } = await import('../../src/server/app');
const { hashPassword } = await import('../../src/server/auth/crypto');

let server: http.Server;
let base = '';

class Client {
  cookies = new Map<string, string>();
  async req(method: string, path: string, form?: Record<string, string>) {
    const headers: Record<string, string> = { cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '), origin: base };
    let body: string | undefined;
    if (form) {
      headers['content-type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams({ _csrf: this.cookies.get('pk_csrf') ?? '', ...form }).toString();
    }
    const res = await fetch(base + path, { method, headers, body, redirect: 'manual' });
    for (const c of res.headers.getSetCookie()) {
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
  async post(path: string, form: Record<string, string> = {}) {
    if (!this.cookies.has('pk_csrf')) await this.get('/');
    return this.req('POST', path, form);
  }
}

const admin = new Client();
let previewId = '';
let token = '';
let slug = '';

before(async () => {
  await resetDb();
  server = http.createServer(createApp());
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const a = await one(db, `insert into users (name, email, platform_role) values ('Ada Admin', 'ada@example.com', 'admin') returning id`);
  await db.query('insert into user_credentials (user_id, password_hash) values ($1, $2)', [a.id, await hashPassword('admin-password-123')]);
  await admin.get('/sign-in');
  const r = await admin.post('/sign-in', { email: 'ada@example.com', password: 'admin-password-123' });
  assert.equal(r.status, 303);
});
after(async () => {
  server?.close();
  await closePool();
});

describe('café previews', () => {
  test('only the platform admin can make previews', async () => {
    const stranger = new Client();
    const r = await stranger.get('/admin/previews');
    assert.equal(r.status, 303);
    assert.match(r.location ?? '', /sign-in/);
  });

  test('the admin creates a preview with the café’s reward', async () => {
    const r = await admin.post('/admin/previews/new', {
      name: 'Harbour Bean Test',
      address: 'Harbour',
      city: 'Girne',
      primary_colour: '#1f5c4a',
      secondary_colour: '#e7b448',
      stamps_required: '8',
      reward_name: 'Free flat white',
      eligible_purchase: 'Any hot drink',
      instagram: '@harbourbeantest',
      default_currency: 'TRY',
      page_layout: 'classic',
      stamp_icon: 'cup',
    });
    assert.equal(r.status, 303, r.text.slice(0, 300));
    const b = await one(db, `select id, slug, status, preview_token, website, primary_colour, default_currency from businesses where name = 'Harbour Bean Test'`);
    assert.equal(b.status, 'preview');
    assert.match(b.preview_token, /^[a-z0-9]{12}$/);
    assert.equal(b.website, 'https://instagram.com/harbourbeantest');
    assert.equal(b.primary_colour, '#1F5C4A');
    assert.equal(b.default_currency, 'TRY');
    const reward = await one(db, `select r.name, r.stamps_cost, p.config from rewards r join loyalty_programmes p on p.id = r.programme_id where r.business_id = $1 and r.is_card_reward`, [b.id]);
    assert.equal(reward.name, 'Free flat white');
    assert.equal(reward.stamps_cost, 8);
    assert.equal(reward.config.stampsRequired, 8);
    previewId = b.id;
    token = b.preview_token;
    slug = b.slug;
    const list = await admin.get('/admin/previews');
    assert.ok(list.text.includes(`/p/${token}`));
    // not counted or listed as a real café
    const cafes = await admin.get('/admin');
    assert.ok(!cafes.text.includes('Harbour Bean Test'));
  });

  test('invalid previews are refused with clear errors', async () => {
    const r = await admin.post('/admin/previews/new', { name: '', stamps_required: '1', reward_name: '' });
    assert.equal(r.status, 422);
    assert.match(r.text, /Enter the café’s name/);
    assert.match(r.text, /between 2 and 30/);
  });

  test('a stranger can’t find it, can’t join it and doesn’t see the claim button', async () => {
    const s = new Client();
    const list = await s.get('/cafes');
    assert.ok(!list.text.includes('Harbour Bean Test'));
    const page = await s.get(`/c/${slug}`);
    assert.equal(page.status, 200);
    assert.match(page.text, /Not live yet/);
    assert.ok(!page.text.includes(`/p/${token}/claim`));
    assert.match(page.text, /noindex/);
    const join = await s.post(`/c/${slug}/join`, { email: 'early@example.com', password: 'early-pass-123' });
    assert.notEqual(join.status, 303);
    const n = await one(db, `select count(*)::int as n from loyalty_memberships where business_id = $1`, [previewId]);
    assert.equal(n.n, 0);
    const wrong = await s.get('/p/aaaaaaaaaaaa');
    assert.equal(wrong.status, 404);
  });

  test('the owner opens the link: their card, their poster, and their café in the list for them only', async () => {
    const owner = new Client();
    const p = await owner.get(`/p/${token}`);
    assert.equal(p.status, 200);
    assert.ok(p.text.includes('Harbour Bean Test'));
    assert.ok(p.text.includes('Free flat white'));
    assert.ok(p.text.includes(`/p/${token}/claim`));
    assert.match(p.text, /<svg/);
    const list = await owner.get('/cafes');
    assert.ok(list.text.includes('Harbour Bean Test'));
    assert.match(list.text, /only you can see this/);
    const join = await owner.get(`/c/${slug}`);
    assert.ok(join.text.includes(`/p/${token}/claim`));
  });

  test('the admin is not allowed to claim it by accident', async () => {
    const r = await admin.post(`/p/${token}/claim`, {});
    assert.equal(r.status, 409);
    assert.equal((await one(db, 'select status from businesses where id = $1', [previewId])).status, 'preview');
  });

  test('a shared demo account can’t claim it either', async () => {
    const d = await one(db, `insert into users (name, email, is_demo) values ('Demo Guest', 'demo.guest@example.com', true) returning id`);
    await db.query('insert into user_credentials (user_id, password_hash) values ($1, $2)', [d.id, await hashPassword('demo-password-123')]);
    const demo = new Client();
    await demo.get('/sign-in');
    await demo.post('/sign-in', { email: 'demo.guest@example.com', password: 'demo-password-123' });
    const page = await demo.get(`/p/${token}/claim`);
    assert.match(page.text, /demo account/);
    const r = await demo.post(`/p/${token}/claim`, {});
    assert.equal(r.status, 409);
    assert.equal((await one(db, 'select status from businesses where id = $1', [previewId])).status, 'preview');
  });

  test('the owner makes it theirs with an email and a password, and it goes live', async () => {
    const owner = new Client();
    await owner.get(`/p/${token}`);
    const bad = await owner.post(`/p/${token}/claim`, { email: 'not-an-email', password: 'short' });
    assert.equal(bad.status, 422);
    const r = await owner.post(`/p/${token}/claim`, { email: 'harbour.owner@example.com', password: 'harbour-pass-123' });
    assert.equal(r.status, 303);
    assert.equal(r.location, '/onboarding/done');
    const b = await one(db, `select b.status, b.owner_user_id, b.claimed_at, b.business_email, u.email from businesses b join users u on u.id = b.owner_user_id where b.id = $1`, [previewId]);
    assert.equal(b.status, 'active');
    assert.equal(b.email, 'harbour.owner@example.com');
    assert.equal(b.business_email, 'harbour.owner@example.com');
    assert.ok(b.claimed_at);
    const m = await one(db, `select role from business_members where business_id = $1 and user_id = $2`, [previewId, b.owner_user_id]);
    assert.equal(m.role, 'owner');
    const sub = await one(db, `select status, plan_id, trial_ends_at from subscriptions where business_id = $1`, [previewId]);
    assert.equal(sub.status, 'trialing');
    assert.ok(new Date(sub.trial_ends_at).getTime() > Date.now() + 29 * 86400_000);
    const done = await owner.get('/onboarding/done');
    assert.equal(done.status, 200);
    assert.ok(done.text.includes('Harbour Bean Test'));
    const dash = await owner.get('/dashboard');
    assert.equal(dash.status, 200);
    // customers can join now, and it is in the public list
    const c = new Client();
    const join = await c.post(`/c/${slug}/join`, { email: 'first.guest@example.com', password: 'guest-pass-123' });
    assert.equal(join.status, 303);
    assert.match(join.location ?? '', new RegExp(`/wallet/${slug}`));
    assert.ok((await new Client().get('/cafes')).text.includes('Harbour Bean Test'));
  });

  test('a second claim, and editing or deleting it as admin, are refused once it is live', async () => {
    const late = new Client();
    const r = await late.post(`/p/${token}/claim`, { email: 'someone.else@example.com', password: 'someone-pass-123' });
    assert.equal(r.status, 200);
    assert.match(r.text, /already set up/);
    assert.equal((await one(db, `select count(*)::int as n from users where email = 'someone.else@example.com'`)).n, 0);
    const edit = await admin.post(`/admin/previews/${previewId}`, { name: 'Changed', stamps_required: '9', reward_name: 'x' });
    assert.equal(edit.status, 303);
    assert.equal((await one(db, 'select name from businesses where id = $1', [previewId])).name, 'Harbour Bean Test');
    const del = await admin.post(`/admin/previews/${previewId}/delete`);
    assert.equal(del.status, 404);
  });

  test('a preview offered on a chosen plan shows that price, and the trial starts on it', async () => {
    const r = await admin.post('/admin/previews/new', { name: 'Plan Choice Test', stamps_required: '9', reward_name: 'Free coffee', plan_id: 'basic' });
    assert.equal(r.status, 303);
    const b = await one(db, `select id, preview_token, preview_plan_id from businesses where name = 'Plan Choice Test'`);
    assert.equal(b.preview_plan_id, 'basic');
    await db.query(`update plans set monthly_price_minor = 5000 where id = 'basic'`);
    const page = await new Client().get(`/p/${b.preview_token}`);
    assert.match(page.text, /Then €50 a month/);
    const bad = await admin.post('/admin/previews/new', { name: 'Bad Plan Test', stamps_required: '9', reward_name: 'x', plan_id: 'gold' });
    assert.equal(bad.status, 422);
    const o = new Client();
    await o.get(`/p/${b.preview_token}`);
    await o.post(`/p/${b.preview_token}/claim`, { email: 'plan.owner@example.com', password: 'plan-owner-123' });
    assert.equal((await one(db, 'select plan_id from subscriptions where business_id = $1', [b.id])).plan_id, 'basic');
    await db.query(`update plans set monthly_price_minor = 900 where id = 'basic'`);
  });

  test('an unclaimed preview can be edited and deleted', async () => {
    await admin.post('/admin/previews/new', { name: 'Old Town Test', stamps_required: '10', reward_name: 'Free tea' });
    const b = await one(db, `select id from businesses where name = 'Old Town Test'`);
    const e = await admin.post(`/admin/previews/${b.id}`, { name: 'Old Town Test Café', stamps_required: '6', reward_name: 'Free cake', page_layout: 'minimal' });
    assert.equal(e.status, 303);
    const after = await one(db, `select b.name, b.settings, r.stamps_cost, r.name as reward from businesses b join rewards r on r.business_id = b.id where b.id = $1`, [b.id]);
    assert.deepEqual([after.name, after.stamps_cost, after.reward, after.settings.pageLayout], ['Old Town Test Café', 6, 'Free cake', 'minimal']);
    const d = await admin.post(`/admin/previews/${b.id}/delete`);
    assert.equal(d.status, 303);
    assert.equal((await one(db, `select count(*)::int as n from businesses where id = $1`, [b.id])).n, 0);
  });
});
