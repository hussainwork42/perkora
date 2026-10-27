/**
 * Demonstration environment. Everything created here is fictional and flagged
 * is_demo, so it can be reset without touching real cafés or customers.
 *
 * History is produced by running the real loyalty engine over ~4 months of
 * simulated visits, so balances, rewards and charts all come from genuine
 * transaction records.
 */
import crypto from 'node:crypto';
import { db, many, maybeOne, one, tx } from '../db';
import type { Queryable } from '../db';
import { config } from '../config';
import { createUser } from '../domain/accounts';
import { awardPurchase, distributeCampaignVouchers, joinBusiness, redeemPoints, redeemVoucher } from '../domain/loyalty';
import { addDays, localDate, localParts } from '../../shared/time';
import { seedPlans } from './seed';

export const DEMO_SLUG = 'perkora-demo-cafe';
const TZ = 'Asia/Famagusta';

/* deterministic PRNG so the demo looks the same after every reset */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Convert a local wall-clock time in TZ to a UTC instant. */
function zoned(dateStr: string, hour: number, minute: number, tz = TZ): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  let guess = Date.UTC(y, m - 1, d, hour, minute) - 2 * 3600 * 1000;
  for (let i = 0; i < 3; i++) {
    const lp = localParts(new Date(guess), tz);
    const diffMin = (lp.hour * 60 + lp.minute - (hour * 60 + minute)) + (lp.date === dateStr ? 0 : lp.date > dateStr ? 1440 : -1440);
    if (diffMin === 0) break;
    guess -= diffMin * 60000;
  }
  return new Date(guess);
}

const POOLS: [string[], string[]][] = [
  [
    ['Deniz', 'Elif', 'Kerem', 'Zeynep', 'Mert', 'Ayşe', 'Can', 'Ece', 'Emir', 'Selin', 'Hakan', 'Buse', 'Ozan', 'Derya', 'Tolga', 'İpek', 'Kemal', 'Nur', 'Baran', 'Ceren', 'Arda', 'Melis', 'Yusuf', 'Irem', 'Efe', 'Defne'],
    ['Arslan', 'Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Aydın', 'Öztürk', 'Kılıç', 'Doğan', 'Özkan', 'Erdem', 'Koç', 'Aksoy', 'Tekin', 'Uçar', 'Polat', 'Ateş'],
  ],
  [
    ['Sofia', 'Andreas', 'Eleni', 'Nikos', 'Maria', 'Christos', 'Katerina', 'Yiannis'],
    ['Georgiou', 'Christou', 'Ioannou', 'Papadopoulos', 'Charalambous', 'Nicolaou'],
  ],
  [
    ['Hannah', 'Oliver', 'Grace', 'James', 'Emily', 'Daniel', 'Chloe', 'Liam', 'Amelia', 'Noah', 'Lara'],
    ['Wright', 'Collins', 'Hughes', 'Bennett', 'Turner', 'Price', 'Ward', 'Ellis'],
  ],
];
interface Persona {
  name: string;
  email?: string;
  pattern: 'regular' | 'weekly' | 'occasional' | 'lapsed' | 'new' | 'joined_only';
  joinedDaysAgo: number;
  points: boolean;
  marketing: boolean;
  birthday?: [number, number];
  referrer?: string;
  fixed?: 'maya' | 'andreas' | 'hannah' | 'leyla' | 'deniz';
  /** fixed morning visits (days ago) used for personas that must end in a known state */
  schedule?: number[];
}

export async function seedDemo() {
  if (!config().DEMO_MODE) {
    console.log('DEMO_MODE=false — skipping demo data');
    return;
  }
  await seedPlans();
  const existing = await maybeOne(db, 'select 1 from businesses where slug = $1', [DEMO_SLUG]);
  if (existing) {
    console.log('demo café already exists (use demo-reset to rebuild it)');
    return;
  }
  const t0 = Date.now();
  const password = config().DEMO_PASSWORD ?? 'perkora-demo-2026';
  const now = new Date();
  const today = localDate(now, TZ);
  const rand = mulberry32(20261027);
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];

  /* ---------------- accounts */
  const userId = async (name: string, email: string) => {
    const ex = await maybeOne<{ id: string }>(db, 'select id from users where lower(email) = $1', [email]);
    if (ex) return ex.id;
    return (await tx((q) => createUser(q, { name, email, password, isDemo: true }))).id;
  };
  const ownerId = await userId('Aylin Kaya', 'owner@demo.perkora.app');
  const staffId = await userId('Emre Yıldız', 'staff@demo.perkora.app');
  const bakeryOwnerId = await userId('Sophie Ward', 'bakery@demo.perkora.app');
  const mayaUserId = await userId('Maya Collins', 'maya.collins@example.com');

  /* ---------------- café */
  const biz = await one<{ id: string }>(
    db,
    `insert into businesses (name, slug, owner_user_id, owner_name, business_email, city, address, description, primary_colour, secondary_colour, timezone, default_currency,
        status, onboarding_step, is_demo, activated_at, settings, created_at)
     values ('Perkora Demo Café', $1, $2, 'Aylin Kaya', 'hello@demo.perkora.app', 'Girne', 'Harbour Road (fictional address)',
        'A contemporary independent café serving specialty coffee and everyday favourites.', '#3B2925', '#B86F52', $3, 'EUR',
        'active', 6, true, $4, $5, $4) returning id`,
    [
      DEMO_SLUG,
      ownerId,
      TZ,
      new Date(now.getTime() - 130 * 86400000),
      {
        inactivityDays: 21,
        staffInstructions: 'Demo: one stamp per coffee drink (up to 2 per order). Ask for the receipt number on orders over €20.',
      },
    ],
  );
  const B = biz.id;
  await db.query(`insert into business_members (business_id, user_id, role) values ($1, $2, 'owner')`, [B, ownerId]);
  await db.query(`insert into business_members (business_id, user_id, role, permissions, invited_by) values ($1, $2, 'staff', $3, $4)`, [B, staffId, { view_customers: true }, ownerId]);
  await db.query(`insert into subscriptions (business_id, plan_id, status, payment_status, provider, notes) values ($1, 'premium', 'demo', 'not_configured', 'manual', 'Demonstration account')`, [B]);

  /* ---------------- programmes & rewards */
  const start = addDays(today, -130);
  const stamps = await one<{ id: string }>(
    db,
    `insert into loyalty_programmes (business_id, name, programme_type, config, terms, created_at) values ($1, 'Coffee Club', 'stamps', $2, $3, $4) returning id`,
    [
      B,
      { stampsRequired: 9, eligiblePurchase: 'Any handcrafted coffee drink', maxStampsPerTransaction: 2, allowWithOtherPromotions: false },
      'Demonstration settings. One stamp per coffee drink, up to two per order. Rewards have no cash value.',
      new Date(now.getTime() - 130 * 86400000),
    ],
  );
  const points = await one<{ id: string }>(
    db,
    `insert into loyalty_programmes (business_id, name, programme_type, config, terms, created_at) values ($1, 'Coffee Points', 'points', $2, $3, $4) returning id`,
    [
      B,
      { earnMode: 'per_currency_unit', pointsPerUnit: 1, pointsPerPurchase: 10, minSpendMinor: 0, maxPointsPerTransaction: 300, eligiblePurchase: 'Food and retail purchases', allowWithOtherPromotions: true },
      'Demonstration settings. 1 point per €1 on food and retail.',
      new Date(now.getTime() - 130 * 86400000),
    ],
  );
  const reward = async (cols: Record<string, unknown>) => {
    const keys = Object.keys(cols);
    const r = await one<{ id: string }>(db, `insert into rewards (business_id, ${keys.join(', ')}) values ($1, ${keys.map((_, i) => `$${i + 2}`).join(', ')}) returning id`, [B, ...Object.values(cols)]);
    return r.id;
  };
  await reward({ programme_id: stamps.id, name: 'Free Regular Coffee', description: 'Any regular-size hot or iced coffee', reward_type: 'free_item', icon: 'coffee', stamps_cost: 9, is_card_reward: true, validity_days: 30 });
  const upgradeId = await reward({ programme_id: points.id, name: 'Free Coffee Upgrade', description: 'Upgrade any drink to large, or add an extra shot', reward_type: 'free_upgrade', icon: 'cup', points_cost: 30, terms: 'Demonstration reward.' });
  const pastryPtsId = await reward({ programme_id: points.id, name: 'Pastry of Your Choice', description: 'Any pastry from the counter', reward_type: 'free_item', icon: 'croissant', points_cost: 45 });
  const freePastryId = await reward({ name: 'Free Pastry', description: 'Any pastry from the counter', reward_type: 'free_item', icon: 'croissant', validity_days: 14 });
  const cakeId = await reward({ name: 'Birthday Cake Slice', description: 'A slice of today’s cake', reward_type: 'free_item', icon: 'cake', validity_days: 14 });
  await reward({ name: 'Half-price Iced Latte', description: '50% off any iced latte', reward_type: 'discount', icon: 'percent', validity_days: 7, status: 'inactive' });

  /* ---------------- campaigns & challenge (exist before history so bonuses apply) */
  const camp = async (cols: Record<string, unknown>) => {
    cols = { created_at: cols.published_at ?? new Date(now.getTime() - 2 * 86400000), ...cols };
    const keys = Object.keys(cols);
    return (await one<{ id: string }>(db, `insert into campaigns (business_id, ${keys.join(', ')}) values ($1, ${keys.map((_, i) => `$${i + 2}`).join(', ')}) returning id`, [B, ...Object.values(cols)])).id;
  };
  await camp({
    name: 'Welcome stamp',
    description: 'Join the Coffee Club and your first stamp is on us.',
    campaign_type: 'welcome',
    status: 'published',
    start_date: start,
    benefit: { kind: 'bonus', programmeId: stamps.id, mode: 'flat', amount: 1 },
    redemption_instructions: 'Added automatically when you join.',
    is_public: true,
    published_at: new Date(now.getTime() - 130 * 86400000),
  });
  await camp({
    name: 'Afternoon Coffee Offer',
    description: 'Double stamps on weekday afternoons (demonstration setting).',
    campaign_type: 'weekday',
    status: 'published',
    start_date: addDays(today, -45),
    end_date: addDays(today, 30),
    benefit: { kind: 'bonus', programmeId: stamps.id, mode: 'multiplier', amount: 2 },
    eligibility: { weekdays: [1, 2, 3, 4, 5], startTime: '14:00', endTime: '17:00' },
    redemption_instructions: 'Show your card for any coffee between 14:00 and 17:00, Monday to Friday.',
    is_public: true,
    published_at: new Date(now.getTime() - 45 * 86400000),
  });
  const referralId = await camp({
    name: 'Bring a Friend',
    description: 'Invite a friend. After their first visit you get 2 stamps and they get a free pastry.',
    campaign_type: 'referral',
    status: 'published',
    start_date: addDays(today, -90),
    config: { referrerGrant: { kind: 'bonus', programmeId: stamps.id, amount: 2 }, referredGrant: { kind: 'voucher', rewardId: freePastryId }, maxPerReferrer: 5 },
    is_public: false,
    published_at: new Date(now.getTime() - 90 * 86400000),
  });
  await camp({
    name: 'Birthday treat',
    description: 'A slice of cake on us around your birthday.',
    campaign_type: 'birthday',
    status: 'published',
    start_date: start,
    benefit: { kind: 'voucher', rewardId: cakeId },
    config: { windowDays: 7 },
    redemption_instructions: 'Appears in your card in your birthday week.',
    is_public: true,
    published_at: new Date(now.getTime() - 130 * 86400000),
  });
  await camp({
    name: 'Summer Iced Latte Week',
    description: 'Draft for next summer: half-price iced lattes for members.',
    campaign_type: 'limited_time',
    status: 'draft',
    start_date: addDays(today, 200),
    end_date: addDays(today, 207),
    benefit: { kind: 'none' },
  });
  await db.query(
    `insert into challenges (business_id, name, description, rule_type, required_count, period, start_date, end_date, reward_kind, bonus_programme_id, bonus_amount, max_completions_per_customer, status)
     values ($1, 'Three-day week', 'Visit on three different days in a week and get 2 bonus stamps.', 'distinct_days', 3, 'week', $2, $3, 'bonus', $4, 2, 12, 'active')`,
    [B, addDays(today, -60), addDays(today, 60), stamps.id],
  );

  /* ---------------- personas */
  const personas: Persona[] = [
    // 1 welcome stamp + 15 single-stamp morning visits = 16 stamps: one full card (redeemed) and 7 of 9
    { name: 'Maya Collins', email: 'maya.collins@example.com', pattern: 'weekly', joinedDaysAgo: 66, points: true, marketing: true, fixed: 'maya', schedule: [64, 60, 56, 52, 48, 44, 40, 36, 32, 28, 24, 20, 14, 8, 2] },
    { name: 'Deniz Arslan', email: 'deniz.arslan@example.com', pattern: 'regular', joinedDaysAgo: 125, points: true, marketing: true, birthday: [11, 2], fixed: 'deniz' },
    // 1 welcome stamp + 10 visits = 11: one unused reward (unlocked ~13 days ago) and 2 stamps
    { name: 'Andreas Georgiou', email: 'andreas.georgiou@example.com', pattern: 'weekly', joinedDaysAgo: 62, points: false, marketing: false, fixed: 'andreas', schedule: [61, 55, 49, 43, 37, 31, 25, 13, 7, 1] },
    { name: 'Hannah Wright', email: 'hannah.wright@example.com', pattern: 'lapsed', joinedDaysAgo: 110, points: true, marketing: true, fixed: 'hannah' },
    { name: 'Leyla Özkan', email: 'leyla.ozkan@example.com', pattern: 'new', joinedDaysAgo: 2, points: false, marketing: false, fixed: 'leyla' },
  ];
  const used = new Set(personas.map((p) => p.name));
  const patterns: Persona['pattern'][] = ['regular', 'regular', 'weekly', 'weekly', 'weekly', 'occasional', 'occasional', 'occasional', 'lapsed', 'lapsed', 'new', 'joined_only'];
  while (personas.length < 72) {
    const pool = POOLS[rand() < 0.55 ? 0 : rand() < 0.5 ? 1 : 2];
    const name = `${pick(pool[0])} ${pick(pool[1])}`;
    if (used.has(name)) continue;
    used.add(name);
    const pattern = pick(patterns);
    const joinedDaysAgo = pattern === 'new' || pattern === 'joined_only' ? 1 + Math.floor(rand() * 14) : 20 + Math.floor(rand() * 105);
    const slug = name
      .toLowerCase()
      .replace(/ş/g, 's')
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/i̇/g, 'i')
      .replace(/[^a-z]+/g, '.');
    personas.push({
      name,
      email: rand() < 0.85 ? `${slug}${personas.length}@example.com` : undefined,
      pattern,
      joinedDaysAgo,
      points: rand() < 0.45,
      marketing: rand() < 0.55,
      birthday: rand() < 0.3 ? [1 + Math.floor(rand() * 12), 1 + Math.floor(rand() * 28)] : undefined,
      referrer: rand() < 0.12 ? 'Deniz Arslan' : undefined,
    });
  }

  /* ---------------- build the event timeline */
  type Ev = { at: Date; kind: 'join' | 'visit'; p: Persona; qty?: number; amount?: number; redeem?: boolean };
  const events: Ev[] = [];
  for (const p of personas) {
    const joinDate = addDays(today, -p.joinedDaysAgo);
    const joinAt = zoned(joinDate, 8 + Math.floor(rand() * 9), Math.floor(rand() * 60));
    events.push({ at: joinAt, kind: 'join', p });
    let lastVisitDaysAgo = 0;
    let gapMean = 3;
    switch (p.pattern) {
      case 'regular':
        gapMean = 3.2;
        break;
      case 'weekly':
        gapMean = 6;
        break;
      case 'occasional':
        gapMean = 12;
        break;
      case 'lapsed':
        gapMean = 5;
        lastVisitDaysAgo = 25 + Math.floor(rand() * 30);
        break;
      case 'new':
        gapMean = 3;
        break;
      case 'joined_only':
        continue;
    }
    if (p.fixed === 'hannah') lastVisitDaysAgo = 38;
    if (p.schedule) {
      for (const daysAgo of p.schedule) {
        events.push({ at: zoned(addDays(today, -daysAgo), 9, 15), kind: 'visit', p, qty: 1, amount: p.points ? 420 + daysAgo * 7 : undefined, redeem: true });
      }
      continue;
    }
    let d = p.joinedDaysAgo;
    let first = true;
    while (d >= lastVisitDaysAgo) {
      const date = addDays(today, -d);
      const afternoon = rand() < 0.35;
      const hour = afternoon ? 14 + Math.floor(rand() * 3) : 8 + Math.floor(rand() * 5);
      let at = zoned(date, hour, Math.floor(rand() * 60));
      if (first && at.getTime() <= joinAt.getTime()) at = new Date(joinAt.getTime() + 5 * 60000);
      if (at.getTime() < now.getTime() - 60 * 60000) {
        events.push({ at, kind: 'visit', p, qty: rand() < 0.2 ? 2 : 1, amount: p.points && rand() < 0.6 ? 350 + Math.floor(rand() * 1400) : undefined, redeem: true });
      }
      first = false;
      d -= Math.max(1, Math.round(gapMean * (0.5 + rand())));
    }
  }
  events.sort((a, b) => a.at.getTime() - b.at.getTime());

  /* ---------------- replay through the engine */
  const memberships = new Map<string, string>();
  const customerIds = new Map<string, string>();
  for (const ev of events) {
    const p = ev.p;
    if (ev.kind === 'join') {
      const customerId = await tx(async (q) => {
        const c = await one<{ id: string }>(
          q,
          `insert into customers (name, email, birthday_month, birthday_day, is_demo, user_id, created_at) values ($1, $2, $3, $4, true, $5, $6) returning id`,
          [p.name, p.email ?? null, p.birthday?.[0] ?? null, p.birthday?.[1] ?? null, p.fixed === 'maya' ? mayaUserId : null, ev.at],
        );
        return c.id;
      });
      customerIds.set(p.name, customerId);
      const refCode = p.referrer && memberships.has(p.referrer) ? (await one<{ referral_code: string }>(db, 'select referral_code from loyalty_memberships where id = $1', [memberships.get(p.referrer)])).referral_code : null;
      const j = await tx((q) => joinBusiness(q, { businessId: B, customerId, source: refCode ? 'referral' : 'demo', marketingConsent: p.marketing, referralCode: refCode, now: ev.at }));
      memberships.set(p.name, j.membershipId);
      continue;
    }
    const m = memberships.get(p.name);
    if (!m) continue;
    const staff = rand() < 0.7 ? staffId : ownerId;
    // Use a held reward on roughly half of the visits after it was unlocked
    if (ev.redeem && p.fixed !== 'andreas' && (p.fixed === 'maya' || rand() < 0.5)) {
      const v = await maybeOne<{ id: string }>(
        db,
        `select id from customer_rewards where membership_id = $1 and status = 'available' and (expires_at is null or expires_at > $2) and issued_at < $2 order by issued_at limit 1`,
        [m, ev.at],
      );
      if (v) await tx((q) => redeemVoucher(q, { businessId: B, customerRewardId: v.id, actorUserId: staff, idempotencyKey: crypto.randomUUID(), now: new Date(ev.at.getTime() - 60000), source: 'seed' }));
    }
    await tx((q) =>
      awardPurchase(q, { businessId: B, membershipId: m, programmeId: stamps.id, actorUserId: staff, idempotencyKey: crypto.randomUUID(), quantity: ev.qty, source: 'seed', confirmSeparatePurchase: true, now: ev.at }),
    );
    if (ev.amount) {
      await tx((q) =>
        awardPurchase(q, {
          businessId: B,
          membershipId: m,
          programmeId: points.id,
          actorUserId: staff,
          idempotencyKey: crypto.randomUUID(),
          amountMinor: ev.amount,
          currency: 'EUR',
          source: 'seed',
          confirmSeparatePurchase: true,
          now: new Date(ev.at.getTime() + 20000),
        }),
      );
      const bal = await one<{ balance: number }>(db, 'select balance from membership_balances where membership_id = $1 and programme_id = $2', [m, points.id]);
      if (bal.balance >= 45 && rand() < 0.35 && p.fixed !== 'maya') {
        await tx((q) =>
          redeemPoints(q, { businessId: B, membershipId: m, rewardId: rand() < 0.6 ? upgradeId : pastryPtsId, actorUserId: staff, idempotencyKey: crypto.randomUUID(), now: new Date(ev.at.getTime() + 40000), source: 'seed' }),
        );
      }
    }
  }

  /* ---------------- win-back vouchers for members who drifted away */
  const winBackId = await camp({
    name: 'We miss you',
    description: 'Haven’t seen you in a while — here’s a free pastry with your next coffee.',
    campaign_type: 'win_back',
    status: 'published',
    start_date: addDays(today, -3),
    end_date: addDays(today, 25),
    target_segment: 'inactive',
    benefit: { kind: 'voucher', rewardId: freePastryId },
    usage_limit_per_customer: 1,
    redemption_instructions: 'Show your card at the counter.',
    is_public: false,
    published_at: new Date(now.getTime() - 3 * 86400000),
  });
  await tx((q) => distributeCampaignVouchers(q, { businessId: B, campaignId: winBackId, actorUserId: ownerId, now: new Date(now.getTime() - 3 * 86400000 + 3600000) }));

  // A few recorded offer views so campaign reporting has real events
  for (const name of ['Deniz Arslan', 'Maya Collins', 'Hannah Wright']) {
    const m = memberships.get(name);
    if (m) await db.query(`insert into campaign_events (business_id, campaign_id, membership_id, event_type, dedupe_key) values ($1, $2, $3, 'viewed', $4) on conflict do nothing`, [B, winBackId, m, today]);
  }

  /* ---------------- second demo café (shows separate balances per café) */
  const bakery = await one<{ id: string }>(
    db,
    `insert into businesses (name, slug, owner_user_id, owner_name, city, description, primary_colour, secondary_colour, timezone, default_currency, status, onboarding_step, is_demo, activated_at)
     values ('Lemon Tree Bakery', 'lemon-tree-bakery-demo', $1, 'Sophie Ward', 'Lefkoşa', 'A fictional neighbourhood bakery used to show multi-café wallets.', '#5C6851', '#C18A35', $2, 'TRY', 'active', 6, true, now() - interval '60 days')
     returning id`,
    [bakeryOwnerId, TZ],
  );
  await db.query(`insert into business_members (business_id, user_id, role) values ($1, $2, 'owner')`, [bakery.id, bakeryOwnerId]);
  await db.query(`insert into subscriptions (business_id, plan_id, status, payment_status, notes) values ($1, 'starter', 'demo', 'not_configured', 'Demonstration account')`, [bakery.id]);
  const bStamps = await one<{ id: string }>(
    db,
    `insert into loyalty_programmes (business_id, name, programme_type, config) values ($1, 'Bread Card', 'stamps', $2) returning id`,
    [bakery.id, { stampsRequired: 6, eligiblePurchase: 'Any loaf of bread', maxStampsPerTransaction: 1, allowWithOtherPromotions: false }],
  );
  await db.query(`insert into rewards (business_id, programme_id, name, reward_type, icon, stamps_cost, is_card_reward, validity_days) values ($1, $2, 'Free Sourdough Loaf', 'free_item', 'gift', 6, true, 21)`, [bakery.id, bStamps.id]);
  const mayaCustomer = customerIds.get('Maya Collins')!;
  const bm = await tx((q) => joinBusiness(q, { businessId: bakery.id, customerId: mayaCustomer, source: 'demo', marketingConsent: false, now: new Date(now.getTime() - 20 * 86400000) }));
  for (const daysAgo of [18, 11, 4]) {
    await tx((q) =>
      awardPurchase(q, { businessId: bakery.id, membershipId: bm.membershipId, programmeId: bStamps.id, actorUserId: bakeryOwnerId, idempotencyKey: crypto.randomUUID(), source: 'seed', confirmSeparatePurchase: true, now: new Date(now.getTime() - daysAgo * 86400000) }),
    );
  }

  const counts = await one<any>(db, `select (select count(*)::int from loyalty_memberships where business_id = $1) as members, (select count(*)::int from loyalty_transactions where business_id = $1) as txns`, [B]);
  console.log(`demo ready in ${((Date.now() - t0) / 1000).toFixed(1)}s: ${counts.members} members, ${counts.txns} transactions`);
}

/** Delete demo records only (businesses/customers/users flagged is_demo), then rebuild. */
export async function resetDemoData() {
  await tx(async (q: Queryable) => {
    const ids = (await many<{ id: string }>(q, 'select id from businesses where is_demo')).map((r) => r.id);
    if (ids.length) {
      const del = async (sql: string) => q.query(sql, [ids]);
      await del('update loyalty_transactions set reverses_transaction_id = null where business_id = any($1::uuid[])');
      await del('delete from loyalty_transactions where business_id = any($1::uuid[])');
      await del('delete from reward_redemptions where business_id = any($1::uuid[])');
      await del('delete from challenge_completions where business_id = any($1::uuid[])');
      await del('delete from customer_rewards where business_id = any($1::uuid[])');
      await del('delete from campaign_events where business_id = any($1::uuid[])');
      await del('delete from referrals where business_id = any($1::uuid[])');
      await del('delete from visits where business_id = any($1::uuid[])');
      await del('delete from membership_balances where business_id = any($1::uuid[])');
      await del('delete from membership_claims where business_id = any($1::uuid[])');
      await del('delete from loyalty_operations where business_id = any($1::uuid[])');
      await del('delete from challenges where business_id = any($1::uuid[])');
      await del('update loyalty_memberships set referred_by_membership_id = null where business_id = any($1::uuid[])');
      await del('delete from loyalty_memberships where business_id = any($1::uuid[])');
      await del('delete from campaigns where business_id = any($1::uuid[])');
      await del('delete from rewards where business_id = any($1::uuid[])');
      await del('delete from loyalty_programmes where business_id = any($1::uuid[])');
      await del('delete from staff_invitations where business_id = any($1::uuid[])');
      await del('delete from business_members where business_id = any($1::uuid[])');
      await del('delete from subscriptions where business_id = any($1::uuid[])');
      await del('delete from audit_logs where business_id = any($1::uuid[])');
      await del('update businesses set logo_upload_id = null where id = any($1::uuid[])');
      await del('delete from uploads where business_id = any($1::uuid[])');
      await del('delete from businesses where id = any($1::uuid[])');
    }
    await q.query(`delete from customers where is_demo and not exists (select 1 from loyalty_memberships m where m.customer_id = customers.id)`);
    await q.query(
      `delete from users where is_demo and platform_role is null
         and not exists (select 1 from business_members bm where bm.user_id = users.id)
         and not exists (select 1 from customers c join loyalty_memberships m on m.customer_id = c.id where c.user_id = users.id)`,
    );
  });
  console.log('demo data removed');
  await seedDemo();
}
