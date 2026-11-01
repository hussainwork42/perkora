import crypto from 'node:crypto';

process.env.NODE_ENV = 'test';
// Tests drop and recreate the schema, so they only ever use TEST_DATABASE_URL and refuse
// any database whose name does not end in "_test" — an exported DATABASE_URL is ignored.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? `postgres://postgres:${process.env.PGPASSWORD ?? 'postgres'}@127.0.0.1:5432/perkora_test?sslmode=disable`;
if (!/_test$/.test(new URL(process.env.DATABASE_URL).pathname)) {
  throw new Error('Refusing to run tests: TEST_DATABASE_URL must point at a database whose name ends in "_test".');
}
process.env.APP_SECRET ??= 'test-only-secret-value-that-is-long-enough-123';
process.env.DEMO_MODE ??= 'true';

const { db, one, tx, closePool } = await import('../src/server/db');
const { migrate } = await import('../src/server/db/migrate');
const loyalty = await import('../src/server/domain/loyalty');

export { db, one, tx, closePool, loyalty };

export const key = () => crypto.randomUUID();

export async function resetDb() {
  await db.query('drop schema if exists public cascade; create schema public;');
  await migrate(undefined, () => undefined);
  const { seedPlans } = await import('../src/server/seed/seed');
  await seedPlans();
}

let counter = 0;

export interface TestCafe {
  businessId: string;
  ownerId: string;
  stampProgrammeId: string;
  pointsProgrammeId: string;
  cardRewardId: string;
  pointsRewardId: string;
  grantRewardId: string;
}

export async function makeCafe(opts: { name?: string; stampsRequired?: number; validityDays?: number | null; settings?: object; tz?: string } = {}): Promise<TestCafe> {
  counter++;
  const tag = `${Date.now().toString(36)}${counter}`;
  const owner = await one(db, `insert into users (name, email) values ($1, $2) returning id`, ['Owner ' + tag, `owner-${tag}@example.com`]);
  const biz = await one(
    db,
    `insert into businesses (name, slug, owner_user_id, status, timezone, default_currency, settings, activated_at)
     values ($1, $2, $3, 'active', $4, 'EUR', $5, now()) returning id`,
    [opts.name ?? 'Café ' + tag, 'cafe-' + tag, owner.id, opts.tz ?? 'Asia/Famagusta', opts.settings ?? {}],
  );
  await db.query(`insert into business_members (business_id, user_id, role) values ($1, $2, 'owner')`, [biz.id, owner.id]);
  await db.query(`insert into subscriptions (business_id, plan_id, status) values ($1, 'premium', 'trialing')`, [biz.id]);
  const stamps = await one(
    db,
    `insert into loyalty_programmes (business_id, name, programme_type, config) values ($1, 'Coffee Club', 'stamps', $2) returning id`,
    [biz.id, { stampsRequired: opts.stampsRequired ?? 9, eligiblePurchase: 'Any coffee', maxStampsPerTransaction: 3, allowWithOtherPromotions: false }],
  );
  const card = await one(
    db,
    `insert into rewards (business_id, programme_id, name, reward_type, stamps_cost, is_card_reward, validity_days)
     values ($1, $2, 'Free Regular Coffee', 'free_item', $3, true, $4) returning id`,
    [biz.id, stamps.id, opts.stampsRequired ?? 9, opts.validityDays === undefined ? 30 : opts.validityDays],
  );
  const points = await one(
    db,
    `insert into loyalty_programmes (business_id, name, programme_type, config) values ($1, 'Coffee Points', 'points', $2) returning id`,
    [biz.id, { earnMode: 'per_currency_unit', pointsPerUnit: 10, eligiblePurchase: 'Anything', maxPointsPerTransaction: 2000, minSpendMinor: 0 }],
  );
  const pr = await one(
    db,
    `insert into rewards (business_id, programme_id, name, reward_type, points_cost) values ($1, $2, 'Free Upgrade', 'free_upgrade', 100) returning id`,
    [biz.id, points.id],
  );
  const gr = await one(
    db,
    `insert into rewards (business_id, name, reward_type, validity_days) values ($1, 'Free Pastry', 'free_item', 14) returning id`,
    [biz.id],
  );
  return {
    businessId: biz.id,
    ownerId: owner.id,
    stampProgrammeId: stamps.id,
    pointsProgrammeId: points.id,
    cardRewardId: card.id,
    pointsRewardId: pr.id,
    grantRewardId: gr.id,
  };
}

export async function makeMember(cafe: TestCafe, name = 'Test Customer', opts: { referralCode?: string; now?: Date } = {}) {
  const c = await one(db, `insert into customers (name) values ($1) returning id`, [name]);
  const r = await tx((q) =>
    loyalty.joinBusiness(q, { businessId: cafe.businessId, customerId: c.id, source: 'qr', marketingConsent: false, referralCode: opts.referralCode, now: opts.now }),
  );
  return { customerId: c.id as string, membershipId: r.membershipId, join: r };
}

export function award(cafe: TestCafe, membershipId: string, extra: Partial<Parameters<typeof loyalty.awardPurchase>[1]> = {}) {
  return tx((q) =>
    loyalty.awardPurchase(q, {
      businessId: cafe.businessId,
      membershipId,
      programmeId: cafe.stampProgrammeId,
      actorUserId: cafe.ownerId,
      idempotencyKey: key(),
      source: 'terminal',
      confirmSeparatePurchase: true,
      ...extra,
    }),
  );
}

export async function balanceOf(membershipId: string, programmeId: string): Promise<number> {
  const r = await db.query('select balance from membership_balances where membership_id = $1 and programme_id = $2', [membershipId, programmeId]);
  return r.rows[0]?.balance ?? 0;
}

export async function ledgerSum(membershipId: string, programmeId: string): Promise<number> {
  const r = await one(
    db,
    `select coalesce(sum(points_delta + stamps_delta), 0)::int as s from loyalty_transactions where membership_id = $1 and programme_id = $2`,
    [membershipId, programmeId],
  );
  return r.s;
}

export async function expectCode(p: Promise<unknown>, code: string) {
  try {
    await p;
  } catch (e) {
    const got = (e as { code?: string }).code;
    if (got !== code) throw new Error(`Expected error code ${code}, got ${got}: ${(e as Error).message}`);
    return e;
  }
  throw new Error(`Expected error code ${code}, but the call succeeded`);
}

export const at = (iso: string) => new Date(iso);
