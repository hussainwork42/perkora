/** Read models shared by the customer portal, public café page and staff terminal. */
import crypto from 'node:crypto';
import type { Queryable } from '../db';
import { many, maybeOne } from '../db';
import { campaignEligibilitySchema, parseSettings, type BusinessSettings, type SegmentKey } from '../../shared/schemas';
import { isoWeekKey, localDate, maxDate, minDate, monthRange, weekRange } from '../../shared/time';
import { isSegment, memberInSegment } from './segments';

export interface PublicCafe {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  city: string | null;
  address: string | null;
  website: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  primaryColour: string;
  secondaryColour: string;
  timezone: string;
  currency: 'EUR' | 'TRY';
  status: string;
  isDemo: boolean;
  settings: BusinessSettings;
}

export function logoUrl(uploadId: string | null): string | null {
  return uploadId ? `/media/${uploadId}` : null;
}

export async function loadCafeBySlug(q: Queryable, slug: string): Promise<PublicCafe | null> {
  const b = await maybeOne<any>(q, `select * from businesses where slug = $1`, [slug.toLowerCase()]);
  return b ? toPublicCafe(b) : null;
}

export async function loadCafeById(q: Queryable, id: string): Promise<PublicCafe | null> {
  const b = await maybeOne<any>(q, `select * from businesses where id = $1`, [id]);
  return b ? toPublicCafe(b) : null;
}

function toPublicCafe(b: any): PublicCafe {
  return {
    id: b.id,
    name: b.name,
    slug: b.slug,
    description: b.description,
    city: b.city,
    address: b.address,
    website: b.website,
    logoUrl: logoUrl(b.logo_upload_id),
    bannerUrl: logoUrl(b.banner_upload_id ?? null),
    primaryColour: b.primary_colour,
    secondaryColour: b.secondary_colour,
    timezone: b.timezone,
    currency: b.default_currency,
    status: b.status,
    isDemo: b.is_demo,
    settings: parseSettings(b.settings),
  };
}

export interface ProgrammeView {
  id: string;
  name: string;
  type: 'stamps' | 'points';
  config: any;
  terms: string | null;
  cardReward: { id: string; name: string; icon: string; description: string | null; validityDays: number | null } | null;
  catalogue: { id: string; name: string; icon: string; description: string | null; cost: number; terms: string | null; endDate: string | null }[];
}

export async function loadProgrammes(q: Queryable, businessId: string, today: string): Promise<ProgrammeView[]> {
  const progs = await many<any>(
    q,
    `select id, name, programme_type, config, terms from loyalty_programmes
      where business_id = $1 and status = 'active' and (start_date is null or start_date <= $2) and (end_date is null or end_date >= $2)
      order by case programme_type when 'stamps' then 0 else 1 end, created_at`,
    [businessId, today],
  );
  const rewards = await many<any>(
    q,
    `select id, programme_id, name, icon, description, points_cost, stamps_cost, is_card_reward, validity_days, terms, end_date
       from rewards where business_id = $1 and status = 'active' and programme_id is not null
        and (start_date is null or start_date <= $2) and (end_date is null or end_date >= $2)
      order by coalesce(points_cost, stamps_cost), name`,
    [businessId, today],
  );
  return progs.map((p) => {
    const card = rewards.find((r) => r.programme_id === p.id && r.is_card_reward);
    return {
      id: p.id,
      name: p.name,
      type: p.programme_type,
      config: p.config,
      terms: p.terms,
      cardReward: card ? { id: card.id, name: card.name, icon: card.icon, description: card.description, validityDays: card.validity_days } : null,
      catalogue: rewards
        .filter((r) => r.programme_id === p.id && !r.is_card_reward && r.points_cost)
        .map((r) => ({ id: r.id, name: r.name, icon: r.icon, description: r.description, cost: r.points_cost, terms: r.terms, endDate: r.end_date })),
    };
  });
}

export interface OfferView {
  id: string;
  name: string;
  description: string | null;
  type: string;
  endDate: string | null;
  startDate: string;
  weekdays: number[] | null;
  startTime: string | null;
  endTime: string | null;
  instructions: string | null;
  benefit: any;
  segment: string;
}

export async function loadRunningOffers(q: Queryable, businessId: string, today: string, opts: { publicOnly?: boolean } = {}): Promise<OfferView[]> {
  const rows = await many<any>(
    q,
    `select id, name, description, campaign_type, start_date, end_date, eligibility, redemption_instructions, benefit, target_segment, is_public
       from campaigns
      where business_id = $1 and status = 'published' and start_date <= $2 and (end_date is null or end_date >= $2)
        and campaign_type not in ('referral')
        ${opts.publicOnly ? `and is_public and target_segment = 'all'` : ''}
      order by end_date nulls last, created_at`,
    [businessId, today],
  );
  return rows.map((r) => {
    const e = campaignEligibilitySchema.safeParse(r.eligibility ?? {});
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      type: r.campaign_type,
      startDate: r.start_date,
      endDate: r.end_date,
      weekdays: e.success && e.data.weekdays?.length ? e.data.weekdays : null,
      startTime: e.success ? (e.data.startTime ?? null) : null,
      endTime: e.success ? (e.data.endTime ?? null) : null,
      instructions: r.redemption_instructions,
      benefit: r.benefit,
      segment: r.target_segment,
    };
  });
}

export interface VoucherView {
  id: string;
  rewardId: string;
  name: string;
  icon: string;
  description: string | null;
  terms: string | null;
  source: string;
  status: 'available' | 'redeemed' | 'expired' | 'void';
  issuedAt: Date;
  expiresAt: Date | null;
  redeemedAt: Date | null;
}

export interface ChallengeView {
  id: string;
  name: string;
  description: string | null;
  ruleType: 'distinct_days' | 'visit_count';
  required: number;
  progress: number;
  period: 'campaign' | 'week' | 'month';
  endDate: string;
  completedThisPeriod: boolean;
  completionsTotal: number;
  maxCompletions: number;
  rewardLabel: string;
}

export interface ActivityItem {
  id: string;
  type: string;
  delta: number;
  unit: 'stamps' | 'points' | null;
  description: string;
  createdAt: Date;
  programmeName: string | null;
}

export interface MemberView {
  membership: {
    id: string;
    memberCode: string;
    referralCode: string;
    joinedAt: Date;
    visitCount: number;
    lastVisitAt: Date | null;
    status: string;
    marketingConsent: boolean;
    customerId: string;
  };
  customer: { name: string; email: string | null; phone: string | null };
  programmes: (ProgrammeView & { balance: number; lifetimeEarned: number; lifetimeSpent: number })[];
  vouchers: VoucherView[];
  challenges: ChallengeView[];
  activity: ActivityItem[];
  stateHash: string;
}

export async function loadMemberView(
  q: Queryable,
  cafe: { id: string; timezone: string; settings: BusinessSettings },
  membershipId: string,
  opts: { now?: Date; activityLimit?: number } = {},
): Promise<MemberView | null> {
  const now = opts.now ?? new Date();
  const today = localDate(now, cafe.timezone);
  const m = await maybeOne<any>(
    q,
    `select m.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone
       from loyalty_memberships m join customers c on c.id = m.customer_id
      where m.id = $1 and m.business_id = $2`,
    [membershipId, cafe.id],
  );
  if (!m) return null;
  const programmes = await loadProgrammes(q, cafe.id, today);
  const balances = await many<any>(q, `select programme_id, balance, lifetime_earned, lifetime_spent from membership_balances where membership_id = $1`, [m.id]);
  const vouchers = await many<any>(
    q,
    `select cr.id, cr.reward_id, cr.source, cr.status, cr.issued_at, cr.expires_at, cr.redeemed_at, r.name, r.icon, r.description, r.terms
       from customer_rewards cr join rewards r on r.id = cr.reward_id
      where cr.membership_id = $1 and cr.status <> 'void'
      order by cr.issued_at desc limit 100`,
    [m.id],
  );
  const challengeRows = await many<any>(
    q,
    `select c.*, r.name as reward_name, p.name as bonus_programme_name, p.programme_type as bonus_programme_type,
            exists (select 1 from challenge_enrolments e where e.challenge_id = c.id and e.membership_id = $3) as enrolled
       from challenges c
       left join rewards r on r.id = c.reward_id
       left join loyalty_programmes p on p.id = c.bonus_programme_id
      where c.business_id = $1 and c.status = 'active' and c.start_date <= $2 and c.end_date >= $2
      order by c.end_date`,
    [cafe.id, today, m.id],
  );
  const challenges: ChallengeView[] = [];
  for (const ch of challengeRows) {
    if (ch.visibility === 'invite_only' && !ch.enrolled) continue;
    if (ch.eligible_segment !== 'all' && isSegment(ch.eligible_segment) && !(await memberInSegment(q, cafe.id, m.id, ch.eligible_segment as SegmentKey, cafe.settings, now))) continue;
    let ps = ch.start_date as string;
    let pe = ch.end_date as string;
    let key = 'all';
    if (ch.period === 'week') {
      const [a, b] = weekRange(today);
      ps = maxDate(a, ps);
      pe = minDate(b, pe);
      key = isoWeekKey(today);
    } else if (ch.period === 'month') {
      const [a, b] = monthRange(today);
      ps = maxDate(a, ps);
      pe = minDate(b, pe);
      key = today.slice(0, 7);
    }
    const prog = await maybeOne<{ n: number }>(
      q,
      ch.rule_type === 'distinct_days'
        ? 'select count(distinct local_date)::int as n from visits where membership_id = $1 and local_date between $2 and $3'
        : 'select count(*)::int as n from visits where membership_id = $1 and local_date between $2 and $3',
      [m.id, ps, pe],
    );
    const comp = await maybeOne<{ total: number; this_period: number }>(
      q,
      `select count(*)::int as total, count(*) filter (where period_key = $3)::int as this_period from challenge_completions where challenge_id = $1 and membership_id = $2`,
      [ch.id, m.id, key],
    );
    challenges.push({
      id: ch.id,
      name: ch.name,
      description: ch.description,
      ruleType: ch.rule_type,
      required: ch.required_count,
      progress: Math.min(prog?.n ?? 0, ch.required_count),
      period: ch.period,
      endDate: ch.end_date,
      completedThisPeriod: (comp?.this_period ?? 0) > 0,
      completionsTotal: comp?.total ?? 0,
      maxCompletions: ch.max_completions_per_customer,
      rewardLabel: ch.reward_kind === 'voucher' ? ch.reward_name : `+${ch.bonus_amount} ${ch.bonus_programme_type === 'stamps' ? 'stamps' : 'points'}`,
    });
  }
  const activity = await many<any>(
    q,
    `select t.id, t.transaction_type, t.points_delta, t.stamps_delta, t.description, t.created_at, p.name as programme_name, p.programme_type
       from loyalty_transactions t left join loyalty_programmes p on p.id = t.programme_id
      where t.membership_id = $1
      order by t.created_at desc, t.id desc limit $2`,
    [m.id, opts.activityLimit ?? 30],
  );
  const progViews = programmes.map((p) => {
    const b = balances.find((x) => x.programme_id === p.id);
    return { ...p, balance: b?.balance ?? 0, lifetimeEarned: b?.lifetime_earned ?? 0, lifetimeSpent: b?.lifetime_spent ?? 0 };
  });
  const vouchersView: VoucherView[] = vouchers.map((v) => ({
    id: v.id,
    rewardId: v.reward_id,
    name: v.name,
    icon: v.icon,
    description: v.description,
    terms: v.terms,
    source: v.source,
    status: v.status === 'available' && v.expires_at && v.expires_at.getTime() <= now.getTime() ? 'expired' : v.status,
    issuedAt: v.issued_at,
    expiresAt: v.expires_at,
    redeemedAt: v.redeemed_at,
  }));
  const stateHash = [
    ...progViews.map((p) => `${p.id}:${p.balance}`),
    ...vouchersView.map((v) => `${v.id}:${v.status}`),
    activity[0]?.id ?? '',
  ].join('|');
  return {
    membership: {
      id: m.id,
      memberCode: m.member_code,
      referralCode: m.referral_code,
      joinedAt: m.joined_at,
      visitCount: m.visit_count,
      lastVisitAt: m.last_visit_at,
      status: m.status,
      marketingConsent: m.marketing_consent,
      customerId: m.customer_id,
    },
    customer: { name: m.customer_name, email: m.customer_email, phone: m.customer_phone },
    programmes: progViews,
    vouchers: vouchersView,
    challenges,
    activity: activity.map((a) => ({
      id: a.id,
      type: a.transaction_type,
      delta: a.points_delta || a.stamps_delta,
      unit: a.programme_type ?? null,
      description: a.description,
      createdAt: a.created_at,
      programmeName: a.programme_name,
    })),
    stateHash: crypto.createHash('sha1').update(stateHash).digest('hex').slice(0, 16),
  };
}
