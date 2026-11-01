/**
 * The Perkora loyalty engine.
 *
 * Every exported operation must be called inside a database transaction
 * (see `tx` in ../db). Each one:
 *   1. registers an idempotency key (a repeated key returns the stored result),
 *   2. locks the membership (and balance rows) it changes,
 *   3. validates everything on the server,
 *   4. writes append-only loyalty_transactions and updates the balance cache,
 *   5. stores its result on the operation row.
 * A thrown DomainError rolls the whole transaction back, so a failed request
 * never leaves a partial change behind.
 */
import type { Queryable } from '../db';
import { many, maybeOne, one, isUniqueViolation } from '../db';
import { DomainError, notFound } from './errors';
import { randomCode } from '../auth/crypto';
import {
  campaignBenefitSchema,
  campaignEligibilitySchema,
  grantSchema,
  parseSettings,
  pointsConfigSchema,
  referralConfigSchema,
  stampConfigSchema,
  type BusinessSettings,
  type Grant,
  type PointsConfig,
  type SegmentKey,
  type StampConfig,
} from '../../shared/schemas';
import { addDays, diffDays, isoWeekKey, localDate, localParts, maxDate, minDate, monthRange, weekRange } from '../../shared/time';
import { isSegment, memberInSegment, paramBuilder, segmentPredicate } from './segments';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface BusinessCtx {
  id: string;
  name: string;
  status: string;
  timezone: string;
  currency: 'EUR' | 'TRY';
  settings: BusinessSettings;
}

export interface ProgrammeRow {
  id: string;
  business_id: string;
  name: string;
  programme_type: 'stamps' | 'points';
  config: any;
  status: string;
  start_date: string | null;
  end_date: string | null;
}

export interface MembershipRow {
  id: string;
  business_id: string;
  customer_id: string;
  status: string;
  visit_count: number;
  last_visit_at: Date | null;
  joined_at: Date;
  referred_by_membership_id: string | null;
}

export interface IssuedVoucher {
  id: string;
  rewardId: string;
  rewardName: string;
  source: string;
  expiresAt: string | null;
}

export interface GrantOutcome {
  kind: 'voucher' | 'bonus';
  description: string;
  voucher?: IssuedVoucher;
  amount?: number;
  programmeId?: string;
  vouchers?: IssuedVoucher[];
}

export interface AwardInput {
  businessId: string;
  membershipId: string;
  programmeId: string;
  actorUserId: string | null;
  idempotencyKey: string;
  /** Stamps to add, or qualifying purchases for per-purchase points. */
  quantity?: number;
  /** Purchase total in minor units, for per-currency-unit points. */
  amountMinor?: number;
  currency?: string;
  referenceId?: string | null;
  usedOtherPromotion?: boolean;
  confirmSeparatePurchase?: boolean;
  source: 'terminal' | 'dashboard' | 'seed';
  now?: Date;
}

export interface AwardResult {
  operationId: string;
  duplicate: boolean;
  membershipId: string;
  programmeId: string;
  programmeName: string;
  programmeType: 'stamps' | 'points';
  credited: number;
  bonus: number;
  balanceBefore: number;
  balanceAfter: number;
  newVisit: boolean;
  visitId: string;
  vouchersIssued: IssuedVoucher[];
  bonuses: { campaignName: string; amount: number }[];
  challengeCompletions: { challengeId: string; challengeName: string; outcome: string }[];
  referralQualified: boolean;
  notices: string[];
}

/* ------------------------------------------------------------------ */
/* Loading & locking                                                   */
/* ------------------------------------------------------------------ */

export async function loadBusinessCtx(q: Queryable, businessId: string, requireActive = true): Promise<BusinessCtx> {
  const b = await maybeOne<any>(
    q,
    'select id, name, status, timezone, default_currency, settings from businesses where id = $1',
    [businessId],
  );
  if (!b) throw notFound('Café');
  if (requireActive && b.status !== 'active') {
    throw new DomainError('business_inactive', 'This café’s loyalty programme is not active right now.', 403);
  }
  return {
    id: b.id,
    name: b.name,
    status: b.status,
    timezone: b.timezone,
    currency: b.default_currency,
    settings: parseSettings(b.settings),
  };
}

async function lockMembership(q: Queryable, businessId: string, membershipId: string): Promise<MembershipRow> {
  const m = await maybeOne<MembershipRow>(
    q,
    `select id, business_id, customer_id, status, visit_count, last_visit_at, joined_at, referred_by_membership_id
       from loyalty_memberships where id = $1 and business_id = $2 for no key update`,
    [membershipId, businessId],
  );
  if (!m) throw notFound('Member');
  if (m.status !== 'active') {
    throw new DomainError('membership_inactive', 'This membership is not active.', 409);
  }
  return m;
}

export async function loadProgramme(q: Queryable, businessId: string, programmeId: string): Promise<ProgrammeRow> {
  const p = await maybeOne<ProgrammeRow>(
    q,
    `select id, business_id, name, programme_type, config, status, start_date, end_date
       from loyalty_programmes where id = $1 and business_id = $2`,
    [programmeId, businessId],
  );
  if (!p) throw notFound('Loyalty programme');
  return p;
}

function assertProgrammeRunning(p: ProgrammeRow, today: string) {
  if (p.status !== 'active') throw new DomainError('programme_inactive', `${p.name} is not active.`, 409);
  if (p.start_date && today < p.start_date) throw new DomainError('programme_inactive', `${p.name} starts on ${p.start_date}.`, 409);
  if (p.end_date && today > p.end_date) throw new DomainError('programme_inactive', `${p.name} ended on ${p.end_date}.`, 409);
}

export function stampConfig(p: ProgrammeRow): StampConfig {
  return stampConfigSchema.parse(p.config);
}
export function pointsConfig(p: ProgrammeRow): PointsConfig {
  return pointsConfigSchema.parse(p.config);
}

/* ------------------------------------------------------------------ */
/* Operations (idempotency)                                            */
/* ------------------------------------------------------------------ */

type OpKind = 'award' | 'redeem_voucher' | 'redeem_points' | 'reverse' | 'adjust' | 'void_voucher' | 'join' | 'campaign_issue';

async function beginOperation(
  q: Queryable,
  args: { businessId: string; membershipId: string | null; kind: OpKind; key: string; actorUserId: string | null; now: Date },
): Promise<{ id: string; duplicate: false } | { id: string; duplicate: true; result: any }> {
  if (!args.key || args.key.length < 8 || args.key.length > 120) {
    throw new DomainError('validation', 'A valid idempotency key is required.', 400);
  }
  const ins = await q.query<{ id: string }>(
    `insert into loyalty_operations (business_id, membership_id, kind, idempotency_key, actor_user_id, created_at)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (business_id, idempotency_key) do nothing
     returning id`,
    [args.businessId, args.membershipId, args.kind, args.key, args.actorUserId, args.now],
  );
  if (ins.rows[0]) return { id: ins.rows[0].id, duplicate: false };
  const ex = await one<{ id: string; kind: string; membership_id: string | null; result: any }>(
    q,
    'select id, kind, membership_id, result from loyalty_operations where business_id = $1 and idempotency_key = $2',
    [args.businessId, args.key],
  );
  if (ex.kind !== args.kind || (args.membershipId && ex.membership_id !== args.membershipId)) {
    throw new DomainError('idempotency_conflict', 'This request key was already used for a different action.', 409);
  }
  return { id: ex.id, duplicate: true, result: ex.result };
}

async function finishOperation(q: Queryable, id: string, result: unknown) {
  await q.query('update loyalty_operations set result = $2 where id = $1', [id, result]);
}

/* ------------------------------------------------------------------ */
/* Balances & transactions                                             */
/* ------------------------------------------------------------------ */

async function lockBalance(q: Queryable, businessId: string, membershipId: string, programmeId: string): Promise<number> {
  await q.query(
    `insert into membership_balances (membership_id, programme_id, business_id) values ($1, $2, $3)
     on conflict (membership_id, programme_id) do nothing`,
    [membershipId, programmeId, businessId],
  );
  const r = await one<{ balance: number }>(
    q,
    'select balance from membership_balances where membership_id = $1 and programme_id = $2 and business_id = $3 for update',
    [membershipId, programmeId, businessId],
  );
  return r.balance;
}

async function changeBalance(
  q: Queryable,
  a: { businessId: string; membershipId: string; programmeId: string; delta: number; earned?: number; spent?: number; now: Date },
): Promise<number> {
  const r = await one<{ balance: number }>(
    q,
    `update membership_balances
        set balance = balance + $4,
            lifetime_earned = greatest(0, lifetime_earned + $5),
            lifetime_spent = greatest(0, lifetime_spent + $6),
            updated_at = $7
      where membership_id = $1 and programme_id = $2 and business_id = $3
      returning balance`,
    [a.membershipId, a.programmeId, a.businessId, a.delta, a.earned ?? 0, a.spent ?? 0, a.now],
  );
  return r.balance;
}

interface TxnInsert {
  businessId: string;
  membershipId: string;
  programmeId: string | null;
  programmeType?: 'stamps' | 'points' | null;
  operationId: string | null;
  type: string;
  delta: number;
  balanceAfter: number | null;
  source: string;
  description: string;
  actorUserId: string | null;
  now: Date;
  referenceId?: string | null;
  amountMinor?: number | null;
  currency?: string | null;
  visitId?: string | null;
  campaignId?: string | null;
  challengeId?: string | null;
  customerRewardId?: string | null;
  redemptionId?: string | null;
  reversesId?: string | null;
}

async function insertTxn(q: Queryable, t: TxnInsert): Promise<string> {
  const points = t.programmeType === 'points' ? t.delta : 0;
  const stamps = t.programmeType === 'stamps' ? t.delta : 0;
  try {
    const r = await one<{ id: string }>(
      q,
      `insert into loyalty_transactions
        (business_id, membership_id, programme_id, operation_id, transaction_type, points_delta, stamps_delta, balance_after,
         source, reference_id, purchase_amount_minor, currency, visit_id, campaign_id, challenge_id, customer_reward_id,
         redemption_id, reverses_transaction_id, actor_user_id, description, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       returning id`,
      [
        t.businessId,
        t.membershipId,
        t.programmeId,
        t.operationId,
        t.type,
        points,
        stamps,
        t.balanceAfter,
        t.source,
        t.referenceId ?? null,
        t.amountMinor ?? null,
        t.currency ?? null,
        t.visitId ?? null,
        t.campaignId ?? null,
        t.challengeId ?? null,
        t.customerRewardId ?? null,
        t.redemptionId ?? null,
        t.reversesId ?? null,
        t.actorUserId,
        t.description,
        t.now,
      ],
    );
    return r.id;
  } catch (e) {
    if (isUniqueViolation(e, 'loyalty_transactions_purchase_ref_key')) {
      throw new DomainError('duplicate_purchase', 'This purchase reference has already earned credit.', 409);
    }
    if (isUniqueViolation(e, 'loyalty_transactions_reverses_transaction_id_key')) {
      throw new DomainError('already_reversed', 'This transaction has already been reversed.', 409);
    }
    throw e;
  }
}

/* ------------------------------------------------------------------ */
/* Vouchers                                                            */
/* ------------------------------------------------------------------ */

/** Latest moment a voucher stays valid: end of the earliest applicable local day. */
async function voucherExpiry(
  q: Queryable,
  tz: string,
  now: Date,
  validityDays: number | null,
  endDates: (string | null | undefined)[],
): Promise<Date | null> {
  const candidates = endDates.filter((d): d is string => Boolean(d));
  if (validityDays) candidates.push(localDate(new Date(now.getTime() + validityDays * 86400000), tz));
  if (!candidates.length) return null;
  candidates.sort();
  const r = await one<{ t: Date }>(q, `select (($1::date + 1)::timestamp at time zone $2) as t`, [candidates[0], tz]);
  return r.t;
}

interface RewardRow {
  id: string;
  business_id: string;
  programme_id: string | null;
  name: string;
  status: string;
  points_cost: number | null;
  stamps_cost: number | null;
  validity_days: number | null;
  start_date: string | null;
  end_date: string | null;
  per_customer_limit: number | null;
  total_limit: number | null;
  is_card_reward: boolean;
}

async function loadReward(q: Queryable, businessId: string, rewardId: string): Promise<RewardRow> {
  const r = await maybeOne<RewardRow>(
    q,
    `select id, business_id, programme_id, name, status, points_cost, stamps_cost, validity_days, start_date, end_date,
            per_customer_limit, total_limit, is_card_reward
       from rewards where id = $1 and business_id = $2`,
    [rewardId, businessId],
  );
  if (!r) throw notFound('Reward');
  return r;
}

/** Why a reward cannot be handed out today, or null if it can. */
async function rewardBlocker(q: Queryable, reward: RewardRow, membershipId: string, today: string): Promise<string | null> {
  if (reward.status !== 'active') return 'reward_unavailable';
  if (reward.start_date && today < reward.start_date) return 'reward_not_started';
  if (reward.end_date && today > reward.end_date) return 'reward_expired';
  if (reward.per_customer_limit || reward.total_limit) {
    await q.query('select pg_advisory_xact_lock(hashtext($1))', ['reward:' + reward.id]);
    const c = await one<{ mine: number; total: number }>(
      q,
      `select count(*) filter (where membership_id = $2) as mine, count(*) as total
         from customer_rewards where reward_id = $1 and status <> 'void'`,
      [reward.id, membershipId],
    );
    if (reward.per_customer_limit && c.mine >= reward.per_customer_limit) return 'limit_reached';
    if (reward.total_limit && c.total >= reward.total_limit) return 'limit_reached';
  }
  return null;
}

async function issueVoucher(
  q: Queryable,
  a: {
    biz: BusinessCtx;
    membershipId: string;
    reward: RewardRow;
    source: 'stamp_card' | 'campaign' | 'challenge' | 'referral' | 'manual';
    sourceRefId?: string | null;
    operationId: string | null;
    now: Date;
    extraEndDates?: (string | null)[];
  },
): Promise<IssuedVoucher> {
  const expiresAt = await voucherExpiry(q, a.biz.timezone, a.now, a.reward.validity_days, [
    a.reward.end_date,
    ...(a.extraEndDates ?? []),
  ]);
  const r = await one<{ id: string }>(
    q,
    `insert into customer_rewards (business_id, membership_id, reward_id, source, source_ref_id, operation_id, status, issued_at, expires_at, created_at)
     values ($1, $2, $3, $4, $5, $6, 'available', $7, $8, $7) returning id`,
    [a.biz.id, a.membershipId, a.reward.id, a.source, a.sourceRefId ?? null, a.operationId, a.now, expiresAt],
  );
  return {
    id: r.id,
    rewardId: a.reward.id,
    rewardName: a.reward.name,
    source: a.source,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
  };
}

/* ------------------------------------------------------------------ */
/* Stamp cards                                                         */
/* ------------------------------------------------------------------ */

async function cardReward(q: Queryable, businessId: string, programmeId: string): Promise<RewardRow | null> {
  const r = await maybeOne<{ id: string }>(
    q,
    `select id from rewards where business_id = $1 and programme_id = $2 and is_card_reward and status <> 'archived'
      order by created_at limit 1`,
    [businessId, programmeId],
  );
  return r ? loadReward(q, businessId, r.id) : null;
}

/** Converts every full card into a reward voucher. Extra stamps carry over. */
async function completeStampCards(
  q: Queryable,
  a: { biz: BusinessCtx; membershipId: string; programme: ProgrammeRow; operationId: string | null; actorUserId: string | null; source: string; now: Date },
  notices: string[],
): Promise<{ vouchers: IssuedVoucher[]; balance: number }> {
  const cfg = stampConfig(a.programme);
  const today = localDate(a.now, a.biz.timezone);
  const vouchers: IssuedVoucher[] = [];
  let balance = await lockBalance(q, a.biz.id, a.membershipId, a.programme.id);
  for (let i = 0; i < 10 && balance >= cfg.stampsRequired; i++) {
    const reward = await cardReward(q, a.biz.id, a.programme.id);
    const blocker = reward ? await rewardBlocker(q, reward, a.membershipId, today) : 'reward_unavailable';
    if (!reward || blocker) {
      notices.push('card_full_reward_unavailable');
      break;
    }
    const voucher = await issueVoucher(q, {
      biz: a.biz,
      membershipId: a.membershipId,
      reward,
      source: 'stamp_card',
      sourceRefId: a.programme.id,
      operationId: a.operationId,
      now: a.now,
    });
    balance = await changeBalance(q, {
      businessId: a.biz.id,
      membershipId: a.membershipId,
      programmeId: a.programme.id,
      delta: -cfg.stampsRequired,
      spent: cfg.stampsRequired,
      now: a.now,
    });
    await insertTxn(q, {
      businessId: a.biz.id,
      membershipId: a.membershipId,
      programmeId: a.programme.id,
      programmeType: 'stamps',
      operationId: a.operationId,
      type: 'card_completed',
      delta: -cfg.stampsRequired,
      balanceAfter: balance,
      source: a.source === 'seed' ? 'seed' : 'system',
      description: `Card completed: ${reward.name} unlocked`,
      actorUserId: a.actorUserId,
      customerRewardId: voucher.id,
      now: a.now,
    });
    vouchers.push(voucher);
  }
  return { vouchers, balance };
}

/* ------------------------------------------------------------------ */
/* Grants (campaign / challenge / referral rewards)                    */
/* ------------------------------------------------------------------ */

async function applyGrant(
  q: Queryable,
  a: {
    biz: BusinessCtx;
    membershipId: string;
    grant: Grant;
    operationId: string | null;
    actorUserId: string | null;
    now: Date;
    voucherSource: 'campaign' | 'challenge' | 'referral';
    txnType: 'bonus' | 'challenge' | 'referral' | 'welcome';
    txnSource: 'campaign' | 'challenge' | 'referral';
    description: string;
    campaignId?: string | null;
    challengeId?: string | null;
    sourceRefId?: string | null;
    extraEndDates?: (string | null)[];
  },
  notices: string[],
): Promise<GrantOutcome | null> {
  const today = localDate(a.now, a.biz.timezone);
  if (a.grant.kind === 'voucher') {
    const reward = await loadReward(q, a.biz.id, a.grant.rewardId);
    const blocker = await rewardBlocker(q, reward, a.membershipId, today);
    if (blocker) {
      notices.push(`grant_skipped:${blocker}`);
      return null;
    }
    const voucher = await issueVoucher(q, {
      biz: a.biz,
      membershipId: a.membershipId,
      reward,
      source: a.voucherSource,
      sourceRefId: a.sourceRefId ?? a.campaignId ?? a.challengeId ?? null,
      operationId: a.operationId,
      now: a.now,
      extraEndDates: a.extraEndDates,
    });
    await insertTxn(q, {
      businessId: a.biz.id,
      membershipId: a.membershipId,
      programmeId: reward.programme_id,
      programmeType: null,
      operationId: a.operationId,
      type: 'voucher_issued',
      delta: 0,
      balanceAfter: null,
      source: a.txnSource,
      description: `${a.description}: ${reward.name}`,
      actorUserId: a.actorUserId,
      campaignId: a.campaignId,
      challengeId: a.challengeId,
      customerRewardId: voucher.id,
      now: a.now,
    });
    return { kind: 'voucher', description: reward.name, voucher };
  }
  const programme = await loadProgramme(q, a.biz.id, a.grant.programmeId);
  if (programme.status !== 'active') {
    notices.push('grant_skipped:programme_inactive');
    return null;
  }
  await lockBalance(q, a.biz.id, a.membershipId, programme.id);
  const balance = await changeBalance(q, {
    businessId: a.biz.id,
    membershipId: a.membershipId,
    programmeId: programme.id,
    delta: a.grant.amount,
    earned: a.grant.amount,
    now: a.now,
  });
  const unit = programme.programme_type === 'stamps' ? (a.grant.amount === 1 ? 'stamp' : 'stamps') : 'points';
  await insertTxn(q, {
    businessId: a.biz.id,
    membershipId: a.membershipId,
    programmeId: programme.id,
    programmeType: programme.programme_type,
    operationId: a.operationId,
    type: a.txnType,
    delta: a.grant.amount,
    balanceAfter: balance,
    source: a.txnSource,
    description: `${a.description}: +${a.grant.amount} ${unit}`,
    actorUserId: a.actorUserId,
    campaignId: a.campaignId,
    challengeId: a.challengeId,
    now: a.now,
  });
  let vouchers: IssuedVoucher[] = [];
  if (programme.programme_type === 'stamps') {
    vouchers = (
      await completeStampCards(
        q,
        { biz: a.biz, membershipId: a.membershipId, programme, operationId: a.operationId, actorUserId: a.actorUserId, source: a.txnSource, now: a.now },
        notices,
      )
    ).vouchers;
  }
  return { kind: 'bonus', description: `+${a.grant.amount} ${unit}`, amount: a.grant.amount, programmeId: programme.id, vouchers };
}

/* ------------------------------------------------------------------ */
/* Campaign helpers                                                    */
/* ------------------------------------------------------------------ */

interface CampaignRow {
  id: string;
  name: string;
  campaign_type: string;
  status: string;
  start_date: string;
  end_date: string | null;
  target_segment: string;
  benefit: any;
  eligibility: any;
  config: any;
  usage_limit_per_customer: number | null;
  total_limit: number | null;
}

const CAMPAIGN_COLS = `id, name, campaign_type, status, start_date, end_date, target_segment, benefit, eligibility, config,
  usage_limit_per_customer, total_limit`;

async function runningCampaigns(q: Queryable, businessId: string, today: string, types: string[]): Promise<CampaignRow[]> {
  return many<CampaignRow>(
    q,
    `select ${CAMPAIGN_COLS} from campaigns
      where business_id = $1 and status = 'published' and campaign_type = any($2::text[])
        and start_date <= $3 and (end_date is null or end_date >= $3)
      order by created_at`,
    [businessId, types, today],
  );
}

function withinEligibilityWindow(c: CampaignRow, now: Date, tz: string): boolean {
  const e = campaignEligibilitySchema.safeParse(c.eligibility ?? {});
  if (!e.success) return false;
  const lp = localParts(now, tz);
  if (e.data.weekdays?.length && !e.data.weekdays.includes(lp.weekday)) return false;
  if (e.data.startTime || e.data.endTime) {
    const mins = lp.hour * 60 + lp.minute;
    const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
    if (e.data.startTime && mins < toMin(e.data.startTime)) return false;
    if (e.data.endTime && mins >= toMin(e.data.endTime)) return false;
  }
  return true;
}

async function campaignUsage(q: Queryable, campaignId: string, membershipId: string, eventType: string) {
  await q.query('select pg_advisory_xact_lock(hashtext($1))', ['campaign:' + campaignId]);
  return one<{ mine: number; total: number }>(
    q,
    `select count(*) filter (where membership_id = $2) as mine, count(*) as total
       from campaign_events where campaign_id = $1 and event_type = $3`,
    [campaignId, membershipId, eventType],
  );
}

async function recordCampaignEvent(
  q: Queryable,
  a: { businessId: string; campaignId: string; membershipId: string; customerId?: string | null; type: string; dedupeKey: string; operationId?: string | null; data?: unknown; now: Date },
): Promise<boolean> {
  const r = await q.query(
    `insert into campaign_events (business_id, campaign_id, membership_id, customer_id, event_type, dedupe_key, operation_id, event_data, created_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     on conflict (campaign_id, membership_id, event_type, dedupe_key) do nothing returning id`,
    [a.businessId, a.campaignId, a.membershipId, a.customerId ?? null, a.type, a.dedupeKey, a.operationId ?? null, a.data ?? {}, a.now],
  );
  return r.rows.length === 1;
}

/* ------------------------------------------------------------------ */
/* Award a purchase                                                    */
/* ------------------------------------------------------------------ */

export async function awardPurchase(q: Queryable, input: AwardInput): Promise<AwardResult> {
  const now = input.now ?? new Date();
  const biz = await loadBusinessCtx(q, input.businessId);
  const op = await beginOperation(q, {
    businessId: biz.id,
    membershipId: input.membershipId,
    kind: 'award',
    key: input.idempotencyKey,
    actorUserId: input.actorUserId,
    now,
  });
  if (op.duplicate) return { ...(op.result as AwardResult), duplicate: true };

  const member = await lockMembership(q, biz.id, input.membershipId);
  const programme = await loadProgramme(q, biz.id, input.programmeId);
  const lp = localParts(now, biz.timezone);
  const today = lp.date;
  assertProgrammeRunning(programme, today);
  const notices: string[] = [];

  // 1. Work out the credit, validating against the programme's rules.
  let credit: number;
  let amountMinor: number | null = null;
  let currency: string | null = null;
  const cfgAllowPromo = Boolean(programme.config?.allowWithOtherPromotions);
  if (input.usedOtherPromotion && !cfgAllowPromo) {
    throw new DomainError(
      'promotion_not_combinable',
      'This programme does not give credit for purchases already discounted by another promotion.',
      422,
    );
  }
  if (programme.programme_type === 'stamps') {
    const cfg = stampConfig(programme);
    const qty = input.quantity ?? 1;
    if (!Number.isInteger(qty) || qty < 1 || qty > cfg.maxStampsPerTransaction) {
      throw new DomainError(
        'invalid_quantity',
        `Between 1 and ${cfg.maxStampsPerTransaction} stamp${cfg.maxStampsPerTransaction === 1 ? '' : 's'} can be added per purchase.`,
        422,
        { max: cfg.maxStampsPerTransaction },
      );
    }
    credit = qty;
  } else {
    const cfg = pointsConfig(programme);
    if (cfg.earnMode === 'per_currency_unit') {
      const amt = input.amountMinor;
      if (!Number.isInteger(amt) || (amt as number) <= 0) {
        throw new DomainError('invalid_amount', 'Enter the purchase amount.', 422);
      }
      currency = input.currency ?? biz.currency;
      if (currency !== biz.currency) {
        throw new DomainError('currency_mismatch', `Amounts must be entered in ${biz.currency}. Perkora does not convert currencies.`, 422);
      }
      if ((amt as number) < cfg.minSpendMinor) {
        throw new DomainError('below_min_spend', 'This purchase is below the minimum spend for points.', 422, {
          minSpendMinor: cfg.minSpendMinor,
        });
      }
      amountMinor = amt as number;
      // integer arithmetic only: points per whole currency unit, rounded down
      credit = Math.floor((amountMinor * cfg.pointsPerUnit) / 100);
      if (credit < 1) throw new DomainError('invalid_amount', 'This amount is too small to earn points.', 422);
    } else {
      const qty = input.quantity ?? 1;
      if (!Number.isInteger(qty) || qty < 1 || qty > 10) {
        throw new DomainError('invalid_quantity', 'Between 1 and 10 qualifying purchases can be recorded at once.', 422, { max: 10 });
      }
      credit = qty * cfg.pointsPerPurchase;
      if (Number.isInteger(input.amountMinor) && (input.amountMinor as number) > 0) {
        amountMinor = input.amountMinor as number;
        currency = biz.currency;
      }
    }
    if (credit > cfg.maxPointsPerTransaction) {
      throw new DomainError('amount_too_large', `A single purchase can earn at most ${cfg.maxPointsPerTransaction} points. Check the amount.`, 422, {
        max: cfg.maxPointsPerTransaction,
      });
    }
  }

  // 2. Duplicate-purchase protection.
  const reference = input.referenceId?.trim() || null;
  if (reference) {
    const dupe = await maybeOne(
      q,
      `select 1 from loyalty_transactions where business_id = $1 and programme_id = $2 and reference_id = $3 and transaction_type = 'earn'`,
      [biz.id, programme.id, reference],
    );
    if (dupe) throw new DomainError('duplicate_purchase', 'This purchase reference has already earned credit.', 409);
  }
  const guard = biz.settings.duplicateGuardSeconds;
  if (guard > 0 && !input.confirmSeparatePurchase) {
    const recent = await maybeOne<{ created_at: Date }>(
      q,
      `select created_at from loyalty_transactions
        where membership_id = $1 and programme_id = $2 and transaction_type = 'earn'
          and created_at > $3::timestamptz - make_interval(secs => $4::int) and created_at <= $3
        order by created_at desc limit 1`,
      [member.id, programme.id, now, guard],
    );
    if (recent) {
      throw new DomainError('recent_award', 'This member received credit moments ago. Confirm that this is a separate purchase.', 409, {
        secondsAgo: Math.max(0, Math.round((now.getTime() - recent.created_at.getTime()) / 1000)),
      });
    }
  }

  // 3. Snapshot segment membership before this visit changes it.
  const segCache = new Map<SegmentKey, boolean>();
  const inSegment = async (seg: string) => {
    if (!isSegment(seg) || seg === 'all') return true;
    if (!segCache.has(seg)) segCache.set(seg, await memberInSegment(q, biz.id, member.id, seg, biz.settings, now));
    return segCache.get(seg)!;
  };
  const bonusCampaigns = (await runningCampaigns(q, biz.id, today, ['bonus_points', 'weekday', 'limited_time', 'custom', 'win_back'])).filter(
    (c) => c.benefit?.kind === 'bonus' && c.benefit?.programmeId === programme.id,
  );
  const eligibleBonus: CampaignRow[] = [];
  for (const c of bonusCampaigns) {
    if (withinEligibilityWindow(c, now, biz.timezone) && (await inSegment(c.target_segment))) eligibleBonus.push(c);
  }
  const challenges = await many<any>(
    q,
    `select c.*, exists (select 1 from challenge_enrolments e where e.challenge_id = c.id and e.membership_id = $3) as enrolled
       from challenges c
      where c.business_id = $1 and c.status = 'active' and c.start_date <= $2 and c.end_date >= $2`,
    [biz.id, today, member.id],
  );
  const eligibleChallenges: any[] = [];
  for (const ch of challenges) {
    if (ch.visibility === 'invite_only' && !ch.enrolled) continue;
    if (!(await inSegment(ch.eligible_segment))) continue;
    eligibleChallenges.push(ch);
  }

  // 4. Record (or reuse) the verified visit.
  const windowMin = biz.settings.visitWindowMinutes;
  const lastVisit = await maybeOne<{ id: string }>(
    q,
    `select id from visits where membership_id = $1
       and occurred_at > $2::timestamptz - make_interval(mins => $3::int) and occurred_at <= $2
     order by occurred_at desc limit 1`,
    [member.id, now, windowMin],
  );
  let visitId: string;
  let newVisit = false;
  const firstEverVisit = member.visit_count === 0;
  if (lastVisit) {
    visitId = lastVisit.id;
  } else {
    const v = await one<{ id: string }>(
      q,
      `insert into visits (business_id, membership_id, verified_by, source, reference_id, occurred_at, local_date, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $6) returning id`,
      [biz.id, member.id, input.actorUserId, input.source, reference, now, today],
    );
    visitId = v.id;
    newVisit = true;
  }
  await q.query(
    `update loyalty_memberships
        set visit_count = visit_count + $2, last_visit_at = greatest(coalesce(last_visit_at, $3), $3), updated_at = $3
      where id = $1`,
    [member.id, newVisit ? 1 : 0, now],
  );

  // 5. The earn transaction itself.
  const balanceBefore = await lockBalance(q, biz.id, member.id, programme.id);
  let balance = await changeBalance(q, {
    businessId: biz.id,
    membershipId: member.id,
    programmeId: programme.id,
    delta: credit,
    earned: credit,
    now,
  });
  const unit = programme.programme_type === 'stamps' ? (credit === 1 ? 'stamp' : 'stamps') : 'points';
  await insertTxn(q, {
    businessId: biz.id,
    membershipId: member.id,
    programmeId: programme.id,
    programmeType: programme.programme_type,
    operationId: op.id,
    type: 'earn',
    delta: credit,
    balanceAfter: balance,
    source: input.source,
    description: `+${credit} ${unit} for a qualifying purchase`,
    actorUserId: input.actorUserId,
    referenceId: reference,
    amountMinor,
    currency,
    visitId,
    now,
  });

  // 6. Campaign bonuses (e.g. double points, weekday promotions).
  let bonusTotal = 0;
  const bonuses: AwardResult['bonuses'] = [];
  for (const c of eligibleBonus) {
    const benefit = campaignBenefitSchema.safeParse(c.benefit);
    if (!benefit.success || benefit.data.kind !== 'bonus') continue;
    const usage = await campaignUsage(q, c.id, member.id, 'bonus_awarded');
    if (c.usage_limit_per_customer && usage.mine >= c.usage_limit_per_customer) continue;
    if (c.total_limit && usage.total >= c.total_limit) continue;
    const amount = benefit.data.mode === 'multiplier' ? credit * (benefit.data.amount - 1) : benefit.data.amount;
    if (amount <= 0) continue;
    balance = await changeBalance(q, { businessId: biz.id, membershipId: member.id, programmeId: programme.id, delta: amount, earned: amount, now });
    await insertTxn(q, {
      businessId: biz.id,
      membershipId: member.id,
      programmeId: programme.id,
      programmeType: programme.programme_type,
      operationId: op.id,
      type: 'bonus',
      delta: amount,
      balanceAfter: balance,
      source: 'campaign',
      description: `${c.name}: +${amount} ${programme.programme_type === 'stamps' ? (amount === 1 ? 'stamp' : 'stamps') : 'points'}`,
      actorUserId: input.actorUserId,
      campaignId: c.id,
      visitId,
      now,
    });
    await recordCampaignEvent(q, {
      businessId: biz.id,
      campaignId: c.id,
      membershipId: member.id,
      customerId: member.customer_id,
      type: 'bonus_awarded',
      dedupeKey: op.id,
      operationId: op.id,
      data: { amount },
      now,
    });
    bonusTotal += amount;
    bonuses.push({ campaignName: c.name, amount });
  }

  // 7. Full stamp cards become reward vouchers.
  const vouchersIssued: IssuedVoucher[] = [];
  if (programme.programme_type === 'stamps') {
    const done = await completeStampCards(
      q,
      { biz, membershipId: member.id, programme, operationId: op.id, actorUserId: input.actorUserId, source: input.source, now },
      notices,
    );
    vouchersIssued.push(...done.vouchers);
    balance = done.balance;
  }

  // 8. Visit challenges count distinct verified visits / visit days.
  const challengeCompletions: AwardResult['challengeCompletions'] = [];
  if (newVisit) {
    for (const ch of eligibleChallenges) {
      let ps: string = ch.start_date;
      let pe: string = ch.end_date;
      let key = 'all';
      if (ch.period === 'week') {
        const [ws, we] = weekRange(today);
        ps = maxDate(ws, ch.start_date);
        pe = minDate(we, ch.end_date);
        key = isoWeekKey(today);
      } else if (ch.period === 'month') {
        const [ms, me] = monthRange(today);
        ps = maxDate(ms, ch.start_date);
        pe = minDate(me, ch.end_date);
        key = today.slice(0, 7);
      }
      const prog = await one<{ n: number }>(
        q,
        ch.rule_type === 'distinct_days'
          ? 'select count(distinct local_date) as n from visits where membership_id = $1 and local_date between $2 and $3'
          : 'select count(*) as n from visits where membership_id = $1 and local_date between $2 and $3',
        [member.id, ps, pe],
      );
      if (prog.n < ch.required_count) continue;
      const done = await one<{ total: number; this_period: number }>(
        q,
        `select count(*) as total, count(*) filter (where period_key = $3) as this_period
           from challenge_completions where challenge_id = $1 and membership_id = $2`,
        [ch.id, member.id, key],
      );
      if (done.this_period > 0 || done.total >= ch.max_completions_per_customer) continue;
      const ins = await q.query<{ id: string }>(
        `insert into challenge_completions (business_id, challenge_id, membership_id, period_key, operation_id, completed_at)
         values ($1,$2,$3,$4,$5,$6) on conflict do nothing returning id`,
        [biz.id, ch.id, member.id, key, op.id, now],
      );
      if (!ins.rows[0]) continue;
      const grant: Grant =
        ch.reward_kind === 'voucher'
          ? { kind: 'voucher', rewardId: ch.reward_id }
          : { kind: 'bonus', programmeId: ch.bonus_programme_id, amount: ch.bonus_amount };
      const outcome = await applyGrant(
        q,
        {
          biz,
          membershipId: member.id,
          grant,
          operationId: op.id,
          actorUserId: input.actorUserId,
          now,
          voucherSource: 'challenge',
          txnType: 'challenge',
          txnSource: 'challenge',
          description: `Challenge complete — ${ch.name}`,
          challengeId: ch.id,
          sourceRefId: ch.id,
        },
        notices,
      );
      if (outcome?.voucher) {
        vouchersIssued.push(outcome.voucher);
        await q.query('update challenge_completions set customer_reward_id = $2 where id = $1', [ins.rows[0].id, outcome.voucher.id]);
      }
      if (outcome?.vouchers) vouchersIssued.push(...outcome.vouchers);
      if (outcome?.kind === 'bonus' && outcome.programmeId === programme.id) {
        balance = await lockBalance(q, biz.id, member.id, programme.id);
      }
      challengeCompletions.push({ challengeId: ch.id, challengeName: ch.name, outcome: outcome?.description ?? 'Completed' });
    }
  }

  // 9. A referred member's first verified visit qualifies the referral.
  let referralQualified = false;
  if (newVisit && firstEverVisit) {
    referralQualified = await qualifyReferral(q, { biz, member, operationId: op.id, actorUserId: input.actorUserId, now, today, on: 'first_visit' }, notices);
    if (referralQualified) balance = await lockBalance(q, biz.id, member.id, programme.id);
  }

  const result: AwardResult = {
    operationId: op.id,
    duplicate: false,
    membershipId: member.id,
    programmeId: programme.id,
    programmeName: programme.name,
    programmeType: programme.programme_type,
    credited: credit,
    bonus: bonusTotal,
    balanceBefore,
    balanceAfter: balance,
    newVisit,
    visitId,
    vouchersIssued,
    bonuses,
    challengeCompletions,
    referralQualified,
    notices,
  };
  await finishOperation(q, op.id, result);
  return result;
}

async function qualifyReferral(
  q: Queryable,
  a: { biz: BusinessCtx; member: MembershipRow; operationId: string; actorUserId: string | null; now: Date; today: string; on: 'first_visit' | 'join' },
  notices: string[],
): Promise<boolean> {
  const ref = await maybeOne<any>(
    q,
    `select * from referrals where business_id = $1 and referred_membership_id = $2 and status = 'pending' for update`,
    [a.biz.id, a.member.id],
  );
  if (!ref) return false;
  const reject = async (reason: string) => {
    await q.query(`update referrals set status = 'rejected', rejection_reason = $2 where id = $1`, [ref.id, reason]);
    notices.push(`referral_rejected:${reason}`);
    return false;
  };
  const campaigns = await runningCampaigns(q, a.biz.id, a.today, ['referral']);
  const campaign = campaigns.find((c) => c.id === ref.campaign_id) ?? campaigns[0];
  if (!campaign) return reject('no_active_referral_campaign');
  const cfg = referralConfigSchema.safeParse(campaign.config);
  if (!cfg.success) return reject('referral_campaign_misconfigured');
  // a programme set to reward on joining has already handled this referral at join time
  if (cfg.data.qualifyOn !== a.on) return false;
  const referrer = await maybeOne<{ id: string; status: string; customer_id: string }>(
    q,
    'select id, status, customer_id from loyalty_memberships where id = $1 and business_id = $2',
    [ref.referrer_membership_id, a.biz.id],
  );
  if (!referrer || referrer.status !== 'active') return reject('referrer_inactive');
  if (referrer.customer_id === a.member.customer_id) return reject('self_referral');
  await q.query('select pg_advisory_xact_lock(hashtext($1))', ['referrer:' + referrer.id]);
  const count = await one<{ n: number }>(
    q,
    `select count(*) as n from referrals where referrer_membership_id = $1 and status = 'qualified'`,
    [referrer.id],
  );
  if (count.n >= cfg.data.maxPerReferrer) return reject('referrer_limit');

  const common = {
    biz: a.biz,
    operationId: a.operationId,
    actorUserId: a.actorUserId,
    now: a.now,
    voucherSource: 'referral' as const,
    txnType: 'referral' as const,
    txnSource: 'referral' as const,
    campaignId: campaign.id,
    sourceRefId: ref.id,
    extraEndDates: [],
  };
  if (cfg.data.referredGrant.kind !== 'none') {
    await applyGrant(q, { ...common, membershipId: a.member.id, grant: cfg.data.referredGrant, description: 'Welcome referral reward' }, notices);
  }
  await applyGrant(q, { ...common, membershipId: referrer.id, grant: cfg.data.referrerGrant, description: 'Referral reward' }, notices);
  await q.query(
    `update referrals set status = 'qualified', qualified_at = $2, qualifying_operation_id = $3, campaign_id = $4 where id = $1`,
    [ref.id, a.now, a.operationId, campaign.id],
  );
  await recordCampaignEvent(q, {
    businessId: a.biz.id,
    campaignId: campaign.id,
    membershipId: referrer.id,
    customerId: referrer.customer_id,
    type: 'referral_qualified',
    dedupeKey: ref.id,
    operationId: a.operationId,
    now: a.now,
  });
  return true;
}

/* ------------------------------------------------------------------ */
/* Redemption                                                          */
/* ------------------------------------------------------------------ */

export interface RedeemResult {
  operationId: string;
  duplicate: boolean;
  redemptionId: string;
  redemptionCode: string;
  rewardName: string;
  membershipId: string;
  pointsSpent: number;
  balanceAfter: number | null;
}

async function newRedemptionCode(q: Queryable): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = randomCode(8);
    const ex = await maybeOne(q, 'select 1 from reward_redemptions where redemption_code = $1', [code]);
    if (!ex) return code;
  }
  throw new Error('Could not allocate a redemption code');
}

/** Redeem a reward the member already holds (filled card, campaign gift, …). */
export async function redeemVoucher(
  q: Queryable,
  input: { businessId: string; customerRewardId: string; membershipId?: string; actorUserId: string | null; idempotencyKey: string; now?: Date; source?: 'terminal' | 'seed' },
): Promise<RedeemResult> {
  const now = input.now ?? new Date();
  const biz = await loadBusinessCtx(q, input.businessId);
  const voucherRef = await maybeOne<{ membership_id: string }>(
    q,
    'select membership_id from customer_rewards where id = $1 and business_id = $2',
    [input.customerRewardId, biz.id],
  );
  if (!voucherRef) throw notFound('Reward');
  if (input.membershipId && voucherRef.membership_id !== input.membershipId) throw notFound('Reward');
  const op = await beginOperation(q, {
    businessId: biz.id,
    membershipId: voucherRef.membership_id,
    kind: 'redeem_voucher',
    key: input.idempotencyKey,
    actorUserId: input.actorUserId,
    now,
  });
  if (op.duplicate) return { ...(op.result as RedeemResult), duplicate: true };

  const member = await lockMembership(q, biz.id, voucherRef.membership_id);
  const v = await one<any>(
    q,
    `select cr.*, r.name as reward_name, r.programme_id as reward_programme_id
       from customer_rewards cr join rewards r on r.id = cr.reward_id
      where cr.id = $1 and cr.business_id = $2 for no key update of cr`,
    [input.customerRewardId, biz.id],
  );
  if (v.status === 'redeemed') throw new DomainError('already_redeemed', 'This reward has already been redeemed.', 409);
  if (v.status === 'void') throw new DomainError('voucher_void', 'This reward was cancelled and cannot be redeemed.', 409);
  if (v.status === 'expired' || (v.expires_at && v.expires_at.getTime() <= now.getTime())) {
    // status is flipped to 'expired' by expireVouchers(); this transaction rolls back
    throw new DomainError('reward_expired', 'This reward has expired.', 409);
  }
  const code = await newRedemptionCode(q);
  const red = await one<{ id: string }>(
    q,
    `insert into reward_redemptions (business_id, membership_id, reward_id, customer_reward_id, programme_id, status,
        redemption_code, operation_id, redeemed_by, redeemed_at, created_at)
     values ($1,$2,$3,$4,$5,'completed',$6,$7,$8,$9,$9) returning id`,
    [biz.id, member.id, v.reward_id, v.id, v.reward_programme_id, code, op.id, input.actorUserId, now],
  );
  await q.query(`update customer_rewards set status = 'redeemed', redeemed_at = $2 where id = $1`, [v.id, now]);
  await insertTxn(q, {
    businessId: biz.id,
    membershipId: member.id,
    programmeId: v.reward_programme_id,
    programmeType: null,
    operationId: op.id,
    type: 'redeem',
    delta: 0,
    balanceAfter: null,
    source: input.source ?? 'terminal',
    description: `Redeemed: ${v.reward_name}`,
    actorUserId: input.actorUserId,
    customerRewardId: v.id,
    redemptionId: red.id,
    now,
  });
  if (v.source === 'campaign' && v.source_ref_id) {
    await recordCampaignEvent(q, {
      businessId: biz.id,
      campaignId: v.source_ref_id,
      membershipId: member.id,
      customerId: member.customer_id,
      type: 'redeemed',
      dedupeKey: v.id,
      operationId: op.id,
      now,
    }).catch(() => undefined);
  }
  const result: RedeemResult = {
    operationId: op.id,
    duplicate: false,
    redemptionId: red.id,
    redemptionCode: code,
    rewardName: v.reward_name,
    membershipId: member.id,
    pointsSpent: 0,
    balanceAfter: null,
  };
  await finishOperation(q, op.id, result);
  return result;
}

/** Spend points on a catalogue reward. */
export async function redeemPoints(
  q: Queryable,
  input: { businessId: string; membershipId: string; rewardId: string; actorUserId: string | null; idempotencyKey: string; now?: Date; source?: 'terminal' | 'seed' },
): Promise<RedeemResult> {
  const now = input.now ?? new Date();
  const biz = await loadBusinessCtx(q, input.businessId);
  const op = await beginOperation(q, {
    businessId: biz.id,
    membershipId: input.membershipId,
    kind: 'redeem_points',
    key: input.idempotencyKey,
    actorUserId: input.actorUserId,
    now,
  });
  if (op.duplicate) return { ...(op.result as RedeemResult), duplicate: true };
  const member = await lockMembership(q, biz.id, input.membershipId);
  const reward = await loadReward(q, biz.id, input.rewardId);
  if (!reward.points_cost || !reward.programme_id) {
    throw new DomainError('reward_unavailable', 'This reward is not available for points.', 409);
  }
  const programme = await loadProgramme(q, biz.id, reward.programme_id);
  const today = localDate(now, biz.timezone);
  assertProgrammeRunning(programme, today);
  const blocker = await rewardBlocker(q, reward, member.id, today);
  if (blocker === 'reward_not_started') throw new DomainError('reward_not_started', 'This reward is not available yet.', 409);
  if (blocker === 'reward_expired') throw new DomainError('reward_expired', 'This reward is no longer available.', 409);
  if (blocker === 'limit_reached') throw new DomainError('limit_reached', 'The redemption limit for this reward has been reached.', 409);
  if (blocker) throw new DomainError('reward_unavailable', 'This reward is not active.', 409);
  const balance = await lockBalance(q, biz.id, member.id, programme.id);
  if (balance < reward.points_cost) {
    throw new DomainError('insufficient_balance', `Needs ${reward.points_cost} points; the member has ${balance}.`, 409, {
      required: reward.points_cost,
      balance,
    });
  }
  const voucher = await one<{ id: string }>(
    q,
    `insert into customer_rewards (business_id, membership_id, reward_id, source, operation_id, status, issued_at, redeemed_at, created_at)
     values ($1,$2,$3,'points',$4,'redeemed',$5,$5,$5) returning id`,
    [biz.id, member.id, reward.id, op.id, now],
  );
  const code = await newRedemptionCode(q);
  const red = await one<{ id: string }>(
    q,
    `insert into reward_redemptions (business_id, membership_id, reward_id, customer_reward_id, programme_id, points_spent, status,
        redemption_code, operation_id, redeemed_by, redeemed_at, created_at)
     values ($1,$2,$3,$4,$5,$6,'completed',$7,$8,$9,$10,$10) returning id`,
    [biz.id, member.id, reward.id, voucher.id, programme.id, reward.points_cost, code, op.id, input.actorUserId, now],
  );
  const after = await changeBalance(q, {
    businessId: biz.id,
    membershipId: member.id,
    programmeId: programme.id,
    delta: -reward.points_cost,
    spent: reward.points_cost,
    now,
  });
  await insertTxn(q, {
    businessId: biz.id,
    membershipId: member.id,
    programmeId: programme.id,
    programmeType: 'points',
    operationId: op.id,
    type: 'redeem',
    delta: -reward.points_cost,
    balanceAfter: after,
    source: input.source ?? 'terminal',
    description: `Redeemed: ${reward.name}`,
    actorUserId: input.actorUserId,
    customerRewardId: voucher.id,
    redemptionId: red.id,
    now,
  });
  const result: RedeemResult = {
    operationId: op.id,
    duplicate: false,
    redemptionId: red.id,
    redemptionCode: code,
    rewardName: reward.name,
    membershipId: member.id,
    pointsSpent: reward.points_cost,
    balanceAfter: after,
  };
  await finishOperation(q, op.id, result);
  return result;
}

/* ------------------------------------------------------------------ */
/* Corrections                                                         */
/* ------------------------------------------------------------------ */

const REVERSIBLE = ['earn', 'bonus', 'adjustment', 'welcome', 'referral', 'challenge'];

export interface ReverseResult {
  operationId: string;
  duplicate: boolean;
  reversedTransactionIds: string[];
  voidedVoucherIds: string[];
}

/**
 * Reverse credit-giving transactions (e.g. a refunded purchase). With
 * `wholeOperation`, every reversible transaction from the same award is
 * reversed. If the stamps have already been converted into a reward that is
 * still unused, that reward is cancelled first; if it was redeemed, the
 * reversal is refused so balances never go negative.
 */
export async function reverseTransaction(
  q: Queryable,
  input: {
    businessId: string;
    transactionId: string;
    wholeOperation?: boolean;
    reason: string;
    actorUserId: string;
    idempotencyKey: string;
    now?: Date;
  },
): Promise<ReverseResult> {
  const now = input.now ?? new Date();
  const reason = input.reason.trim();
  if (reason.length < 3) throw new DomainError('validation', 'Give a short reason for the correction.', 422);
  const biz = await loadBusinessCtx(q, input.businessId, false);
  const target = await maybeOne<any>(q, 'select * from loyalty_transactions where id = $1 and business_id = $2', [
    input.transactionId,
    biz.id,
  ]);
  if (!target) throw notFound('Transaction');
  const op = await beginOperation(q, {
    businessId: biz.id,
    membershipId: target.membership_id,
    kind: 'reverse',
    key: input.idempotencyKey,
    actorUserId: input.actorUserId,
    now,
  });
  if (op.duplicate) return { ...(op.result as ReverseResult), duplicate: true };
  await q.query('select id from loyalty_memberships where id = $1 for no key update', [target.membership_id]);

  let targets: any[] = [target];
  if (input.wholeOperation && target.operation_id) {
    targets = await many<any>(
      q,
      `select * from loyalty_transactions where operation_id = $1 and business_id = $2 and transaction_type = any($3::text[])
        order by created_at, id`,
      [target.operation_id, biz.id, REVERSIBLE],
    );
  }
  const reversed: string[] = [];
  const voided: string[] = [];
  for (const t of targets) {
    if (!REVERSIBLE.includes(t.transaction_type)) {
      throw new DomainError('cannot_reverse', 'Only credit-giving transactions can be reversed. Use “Reverse redemption” for redemptions.', 409);
    }
    const already = await maybeOne(q, 'select 1 from loyalty_transactions where reverses_transaction_id = $1', [t.id]);
    if (already) {
      if (input.wholeOperation) continue;
      throw new DomainError('already_reversed', 'This transaction has already been reversed.', 409);
    }
    const delta = t.points_delta || t.stamps_delta;
    if (!t.programme_id || delta <= 0) continue;
    const programme = await loadProgramme(q, biz.id, t.programme_id);
    let balance = await lockBalance(q, biz.id, t.membership_id, programme.id);
    if (balance < delta && programme.programme_type === 'stamps') {
      // stamps were converted into a reward; cancel an unused one from this programme
      const v = await maybeOne<any>(
        q,
        `select cr.id from customer_rewards cr
          where cr.membership_id = $1 and cr.business_id = $2 and cr.source = 'stamp_card' and cr.source_ref_id = $3
            and cr.status = 'available'
          order by cr.issued_at desc limit 1 for no key update`,
        [t.membership_id, biz.id, programme.id],
      );
      if (v) {
        const res = await voidVoucherInner(q, { biz, voucherId: v.id, operationId: op.id, actorUserId: input.actorUserId, reason, now });
        voided.push(res.voucherId);
        balance = res.balanceAfter ?? balance;
      }
    }
    if (balance < delta) {
      throw new DomainError(
        'cannot_reverse',
        'These credits have already been used for a redeemed reward, so they cannot be reversed automatically. Make a manual adjustment instead.',
        409,
      );
    }
    const after = await changeBalance(q, {
      businessId: biz.id,
      membershipId: t.membership_id,
      programmeId: programme.id,
      delta: -delta,
      earned: -delta,
      now,
    });
    await insertTxn(q, {
      businessId: biz.id,
      membershipId: t.membership_id,
      programmeId: programme.id,
      programmeType: programme.programme_type,
      operationId: op.id,
      type: 'reversal',
      delta: -delta,
      balanceAfter: after,
      source: 'dashboard',
      description: `Reversal: ${reason}`,
      actorUserId: input.actorUserId,
      reversesId: t.id,
      now,
    });
    reversed.push(t.id);
  }
  if (!reversed.length) throw new DomainError('already_reversed', 'Nothing left to reverse for this purchase.', 409);
  await q.query(
    `insert into audit_logs (business_id, actor_user_id, action, target_type, target_id, metadata, created_at)
     values ($1, $2, 'loyalty.reverse', 'loyalty_transaction', $3, $4, $5)`,
    [biz.id, input.actorUserId, input.transactionId, { reason, reversed, voided }, now],
  );
  const result: ReverseResult = { operationId: op.id, duplicate: false, reversedTransactionIds: reversed, voidedVoucherIds: voided };
  await finishOperation(q, op.id, result);
  return result;
}

async function voidVoucherInner(
  q: Queryable,
  a: { biz: BusinessCtx; voucherId: string; operationId: string; actorUserId: string; reason: string; now: Date },
): Promise<{ voucherId: string; balanceAfter: number | null }> {
  const v = await one<any>(
    q,
    `select cr.*, r.name as reward_name from customer_rewards cr join rewards r on r.id = cr.reward_id
      where cr.id = $1 and cr.business_id = $2 for no key update of cr`,
    [a.voucherId, a.biz.id],
  );
  if (v.status !== 'available') throw new DomainError('cannot_reverse', 'Only unused rewards can be cancelled.', 409);
  await q.query(`update customer_rewards set status = 'void', voided_at = $2 where id = $1`, [v.id, a.now]);
  let balanceAfter: number | null = null;
  let programmeId: string | null = null;
  let delta = 0;
  if (v.source === 'stamp_card' && v.source_ref_id) {
    const programme = await loadProgramme(q, a.biz.id, v.source_ref_id);
    const cfg = stampConfig(programme);
    programmeId = programme.id;
    delta = cfg.stampsRequired;
    await lockBalance(q, a.biz.id, v.membership_id, programme.id);
    balanceAfter = await changeBalance(q, {
      businessId: a.biz.id,
      membershipId: v.membership_id,
      programmeId: programme.id,
      delta,
      spent: -delta,
      now: a.now,
    });
  }
  await insertTxn(q, {
    businessId: a.biz.id,
    membershipId: v.membership_id,
    programmeId,
    programmeType: programmeId ? 'stamps' : null,
    operationId: a.operationId,
    type: 'voucher_void',
    delta,
    balanceAfter,
    source: 'dashboard',
    description: delta ? `Reward cancelled (${a.reason}); ${delta} stamps returned` : `Reward cancelled: ${a.reason}`,
    actorUserId: a.actorUserId,
    customerRewardId: v.id,
    now: a.now,
  });
  return { voucherId: v.id, balanceAfter };
}

/** Cancel an unused reward. Stamp-card rewards return their stamps to the card. */
export async function voidVoucher(
  q: Queryable,
  input: { businessId: string; voucherId: string; reason: string; actorUserId: string; idempotencyKey: string; now?: Date },
) {
  const now = input.now ?? new Date();
  const reason = input.reason.trim();
  if (reason.length < 3) throw new DomainError('validation', 'Give a short reason for cancelling this reward.', 422);
  const biz = await loadBusinessCtx(q, input.businessId, false);
  const v = await maybeOne<{ membership_id: string }>(q, 'select membership_id from customer_rewards where id = $1 and business_id = $2', [
    input.voucherId,
    biz.id,
  ]);
  if (!v) throw notFound('Reward');
  const op = await beginOperation(q, { businessId: biz.id, membershipId: v.membership_id, kind: 'void_voucher', key: input.idempotencyKey, actorUserId: input.actorUserId, now });
  if (op.duplicate) return { ...(op.result as any), duplicate: true };
  await q.query('select id from loyalty_memberships where id = $1 for no key update', [v.membership_id]);
  const res = await voidVoucherInner(q, { biz, voucherId: input.voucherId, operationId: op.id, actorUserId: input.actorUserId, reason, now });
  await q.query(
    `insert into audit_logs (business_id, actor_user_id, action, target_type, target_id, metadata, created_at)
     values ($1, $2, 'loyalty.void_reward', 'customer_reward', $3, $4, $5)`,
    [biz.id, input.actorUserId, input.voucherId, { reason }, now],
  );
  const result = { operationId: op.id, duplicate: false, ...res };
  await finishOperation(q, op.id, result);
  return result;
}

/** Undo a redemption made by mistake: the reward (or points) go back to the member. */
export async function reverseRedemption(
  q: Queryable,
  input: { businessId: string; redemptionId: string; reason: string; actorUserId: string; idempotencyKey: string; now?: Date },
) {
  const now = input.now ?? new Date();
  const reason = input.reason.trim();
  if (reason.length < 3) throw new DomainError('validation', 'Give a short reason for the correction.', 422);
  const biz = await loadBusinessCtx(q, input.businessId, false);
  const red = await maybeOne<any>(
    q,
    `select rr.*, r.name as reward_name from reward_redemptions rr join rewards r on r.id = rr.reward_id
      where rr.id = $1 and rr.business_id = $2`,
    [input.redemptionId, biz.id],
  );
  if (!red) throw notFound('Redemption');
  const op = await beginOperation(q, { businessId: biz.id, membershipId: red.membership_id, kind: 'reverse', key: input.idempotencyKey, actorUserId: input.actorUserId, now });
  if (op.duplicate) return { ...(op.result as any), duplicate: true };
  await q.query('select id from loyalty_memberships where id = $1 for no key update', [red.membership_id]);
  const locked = await one<any>(q, 'select status from reward_redemptions where id = $1 for no key update', [red.id]);
  if (locked.status === 'reversed') throw new DomainError('already_reversed', 'This redemption has already been reversed.', 409);
  await q.query(`update reward_redemptions set status = 'reversed' where id = $1`, [red.id]);
  let balanceAfter: number | null = null;
  if (red.points_spent > 0 && red.programme_id) {
    await lockBalance(q, biz.id, red.membership_id, red.programme_id);
    balanceAfter = await changeBalance(q, {
      businessId: biz.id,
      membershipId: red.membership_id,
      programmeId: red.programme_id,
      delta: red.points_spent,
      spent: -red.points_spent,
      now,
    });
    await q.query(`update customer_rewards set status = 'void', voided_at = $2 where id = $1`, [red.customer_reward_id, now]);
  } else {
    await q.query(`update customer_rewards set status = 'available', redeemed_at = null where id = $1`, [red.customer_reward_id]);
  }
  const origTxn = await maybeOne<{ id: string }>(q, `select id from loyalty_transactions where redemption_id = $1 and transaction_type = 'redeem'`, [red.id]);
  await insertTxn(q, {
    businessId: biz.id,
    membershipId: red.membership_id,
    programmeId: red.programme_id,
    programmeType: red.points_spent > 0 ? 'points' : null,
    operationId: op.id,
    type: 'reversal',
    delta: red.points_spent,
    balanceAfter,
    source: 'dashboard',
    description: red.points_spent > 0 ? `Redemption reversed (${reason}); ${red.points_spent} points returned` : `Redemption reversed (${reason}); reward returned`,
    actorUserId: input.actorUserId,
    customerRewardId: red.customer_reward_id,
    redemptionId: red.id,
    reversesId: origTxn?.id ?? null,
    now,
  });
  await q.query(
    `insert into audit_logs (business_id, actor_user_id, action, target_type, target_id, metadata, created_at)
     values ($1, $2, 'loyalty.reverse_redemption', 'reward_redemption', $3, $4, $5)`,
    [biz.id, input.actorUserId, red.id, { reason }, now],
  );
  const result = { operationId: op.id, duplicate: false, redemptionId: red.id, balanceAfter };
  await finishOperation(q, op.id, result);
  return result;
}

/** A manual, audited balance correction (owners, or staff with permission). */
export async function adjustBalance(
  q: Queryable,
  input: { businessId: string; membershipId: string; programmeId: string; delta: number; reason: string; actorUserId: string; idempotencyKey: string; now?: Date },
) {
  const now = input.now ?? new Date();
  const reason = input.reason.trim();
  if (!Number.isInteger(input.delta) || input.delta === 0 || Math.abs(input.delta) > 10000) {
    throw new DomainError('validation', 'Enter a whole number other than zero.', 422);
  }
  if (reason.length < 3) throw new DomainError('validation', 'Give a short reason for the adjustment.', 422);
  const biz = await loadBusinessCtx(q, input.businessId, false);
  const op = await beginOperation(q, { businessId: biz.id, membershipId: input.membershipId, kind: 'adjust', key: input.idempotencyKey, actorUserId: input.actorUserId, now });
  if (op.duplicate) return { ...(op.result as any), duplicate: true };
  const member = await lockMembership(q, biz.id, input.membershipId);
  const programme = await loadProgramme(q, biz.id, input.programmeId);
  const balance = await lockBalance(q, biz.id, member.id, programme.id);
  if (balance + input.delta < 0) {
    throw new DomainError('insufficient_balance', `The balance is ${balance}; it cannot go below zero.`, 409, { balance });
  }
  let after = await changeBalance(q, {
    businessId: biz.id,
    membershipId: member.id,
    programmeId: programme.id,
    delta: input.delta,
    earned: input.delta > 0 ? input.delta : 0,
    spent: input.delta < 0 ? -input.delta : 0,
    now,
  });
  const unit = programme.programme_type === 'stamps' ? 'stamps' : 'points';
  await insertTxn(q, {
    businessId: biz.id,
    membershipId: member.id,
    programmeId: programme.id,
    programmeType: programme.programme_type,
    operationId: op.id,
    type: 'adjustment',
    delta: input.delta,
    balanceAfter: after,
    source: 'dashboard',
    description: `Adjustment ${input.delta > 0 ? '+' : ''}${input.delta} ${unit}: ${reason}`,
    actorUserId: input.actorUserId,
    now,
  });
  const notices: string[] = [];
  let vouchers: IssuedVoucher[] = [];
  if (programme.programme_type === 'stamps' && input.delta > 0 && programme.status === 'active') {
    const done = await completeStampCards(q, { biz, membershipId: member.id, programme, operationId: op.id, actorUserId: input.actorUserId, source: 'dashboard', now }, notices);
    vouchers = done.vouchers;
    after = done.balance;
  }
  await q.query(
    `insert into audit_logs (business_id, actor_user_id, action, target_type, target_id, metadata, created_at)
     values ($1, $2, 'loyalty.adjust', 'loyalty_membership', $3, $4, $5)`,
    [biz.id, input.actorUserId, member.id, { programmeId: programme.id, delta: input.delta, reason }, now],
  );
  const result = { operationId: op.id, duplicate: false, balanceAfter: after, vouchersIssued: vouchers, notices };
  await finishOperation(q, op.id, result);
  return result;
}

/* ------------------------------------------------------------------ */
/* Joining                                                             */
/* ------------------------------------------------------------------ */

export interface JoinResult {
  membershipId: string;
  memberCode: string;
  alreadyMember: boolean;
  welcome: GrantOutcome[];
  referral: 'none' | 'pending' | 'qualified' | 'invalid' | 'self';
}

async function allocateCodes(q: Queryable): Promise<{ memberCode: string; referralCode: string }> {
  for (let i = 0; i < 8; i++) {
    const memberCode = randomCode(8);
    const referralCode = randomCode(7);
    const clash = await maybeOne(q, 'select 1 from loyalty_memberships where member_code = $1 or referral_code = $2', [memberCode, referralCode]);
    if (!clash) return { memberCode, referralCode };
  }
  throw new Error('Could not allocate a member code');
}

export async function joinBusiness(
  q: Queryable,
  input: {
    businessId: string;
    customerId: string;
    source: 'qr' | 'dashboard' | 'referral' | 'demo' | 'claim';
    marketingConsent: boolean;
    referralCode?: string | null;
    actorUserId?: string | null;
    now?: Date;
  },
): Promise<JoinResult> {
  const now = input.now ?? new Date();
  const biz = await loadBusinessCtx(q, input.businessId);
  const today = localDate(now, biz.timezone);
  await q.query('select pg_advisory_xact_lock(hashtext($1))', ['join:' + biz.id + ':' + input.customerId]);
  const existing = await maybeOne<{ id: string; member_code: string }>(
    q,
    'select id, member_code from loyalty_memberships where business_id = $1 and customer_id = $2',
    [biz.id, input.customerId],
  );
  if (existing) return { membershipId: existing.id, memberCode: existing.member_code, alreadyMember: true, welcome: [], referral: 'none' };

  let referrer: { id: string; customer_id: string } | null = null;
  let referral: JoinResult['referral'] = 'none';
  const code = input.referralCode?.trim().toUpperCase();
  if (code) {
    referrer = await maybeOne(
      q,
      `select id, customer_id from loyalty_memberships where business_id = $1 and referral_code = $2 and status = 'active'`,
      [biz.id, code],
    );
    if (!referrer) referral = 'invalid';
    else if (referrer.customer_id === input.customerId) {
      referral = 'self';
      referrer = null;
    }
  }
  const { memberCode, referralCode } = await allocateCodes(q);
  const m = await one<{ id: string }>(
    q,
    `insert into loyalty_memberships (business_id, customer_id, member_code, referral_code, status, source, marketing_consent,
        consent_updated_at, referred_by_membership_id, joined_at, created_at, updated_at)
     values ($1,$2,$3,$4,'active',$5,$6,$7,$8,$9,$9,$9) returning id`,
    [biz.id, input.customerId, memberCode, referralCode, input.source, input.marketingConsent, input.marketingConsent ? now : null, referrer?.id ?? null, now],
  );
  await q.query(
    `insert into membership_balances (membership_id, programme_id, business_id, updated_at)
     select $1, id, business_id, $3 from loyalty_programmes where business_id = $2 and status = 'active'
     on conflict do nothing`,
    [m.id, biz.id, now],
  );
  if (referrer) {
    const refCampaign = (await runningCampaigns(q, biz.id, today, ['referral']))[0];
    await q.query(
      `insert into referrals (business_id, campaign_id, referrer_membership_id, referred_membership_id, referral_code, status, created_at)
       values ($1, $2, $3, $4, $5, 'pending', $6)`,
      [biz.id, refCampaign?.id ?? null, referrer.id, m.id, code, now],
    );
    referral = 'pending';
  }

  // welcome offers
  const welcome: GrantOutcome[] = [];
  const notices: string[] = [];
  const op = await beginOperation(q, {
    businessId: biz.id,
    membershipId: m.id,
    kind: 'join',
    key: 'join:' + m.id,
    actorUserId: input.actorUserId ?? null,
    now,
  });
  for (const c of await runningCampaigns(q, biz.id, today, ['welcome'])) {
    const benefit = campaignBenefitSchema.safeParse(c.benefit);
    if (!benefit.success || benefit.data.kind === 'none') continue;
    const usage = await campaignUsage(q, c.id, m.id, benefit.data.kind === 'voucher' ? 'voucher_issued' : 'bonus_awarded');
    if (c.total_limit && usage.total >= c.total_limit) continue;
    const grant: Grant =
      benefit.data.kind === 'voucher'
        ? { kind: 'voucher', rewardId: benefit.data.rewardId }
        : { kind: 'bonus', programmeId: benefit.data.programmeId, amount: benefit.data.amount };
    const outcome = await applyGrant(
      q,
      {
        biz,
        membershipId: m.id,
        grant,
        operationId: op.id,
        actorUserId: input.actorUserId ?? null,
        now,
        voucherSource: 'campaign',
        txnType: 'welcome',
        txnSource: 'campaign',
        description: c.name,
        campaignId: c.id,
        sourceRefId: c.id,
        extraEndDates: [c.end_date],
      },
      notices,
    );
    if (outcome) {
      welcome.push(outcome);
      await recordCampaignEvent(q, {
        businessId: biz.id,
        campaignId: c.id,
        membershipId: m.id,
        customerId: input.customerId,
        type: outcome.kind === 'voucher' ? 'voucher_issued' : 'bonus_awarded',
        dedupeKey: 'welcome',
        operationId: op.id,
        now,
      });
    }
  }
  // programmes that reward the inviter as soon as the friend joins
  const refNow = referral === 'pending' ? (await runningCampaigns(q, biz.id, today, ['referral']))[0] : null;
  if (refNow && referralConfigSchema.safeParse(refNow.config).data?.qualifyOn === 'join') {
    const member = await lockMembership(q, biz.id, m.id);
    const done = await qualifyReferral(q, { biz, member, operationId: op.id, actorUserId: input.actorUserId ?? null, now, today, on: 'join' }, notices);
    if (done) referral = 'qualified';
  }
  const result: JoinResult = { membershipId: m.id, memberCode, alreadyMember: false, welcome, referral };
  await finishOperation(q, op.id, result);
  return result;
}

/* ------------------------------------------------------------------ */
/* Campaign distribution & birthday offers                             */
/* ------------------------------------------------------------------ */

/**
 * Issue a campaign's reward to every eligible member (win-back, limited-time,
 * custom offers with a voucher). Safe to run repeatedly: each member receives
 * at most `usage_limit_per_customer` (default 1) vouchers from one campaign.
 */
export async function distributeCampaignVouchers(q: Queryable, input: { businessId: string; campaignId: string; actorUserId: string | null; now?: Date }) {
  const now = input.now ?? new Date();
  const biz = await loadBusinessCtx(q, input.businessId);
  const today = localDate(now, biz.timezone);
  const c = await maybeOne<CampaignRow>(q, `select ${CAMPAIGN_COLS} from campaigns where id = $1 and business_id = $2`, [input.campaignId, biz.id]);
  if (!c) throw notFound('Campaign');
  if (c.status !== 'published' || c.start_date > today || (c.end_date && c.end_date < today)) {
    throw new DomainError('conflict', 'Only a running campaign can issue rewards.', 409);
  }
  const benefit = campaignBenefitSchema.safeParse(c.benefit);
  if (!benefit.success || benefit.data.kind !== 'voucher') return { issued: 0 };
  const reward = await loadReward(q, biz.id, benefit.data.rewardId);
  const { params, p } = paramBuilder([biz.id]);
  const seg = isSegment(c.target_segment) ? c.target_segment : 'all';
  const pred = segmentPredicate(seg, biz.settings, now, p);
  const members = await many<{ id: string; customer_id: string }>(
    q,
    `select m.id, m.customer_id from loyalty_memberships m where m.business_id = $1 and m.status = 'active' and ${pred} order by m.joined_at`,
    params,
  );
  const op = await beginOperation(q, {
    businessId: biz.id,
    membershipId: null,
    kind: 'campaign_issue',
    key: `campaign:${c.id}:${now.getTime()}`,
    actorUserId: input.actorUserId,
    now,
  });
  let issued = 0;
  const notices: string[] = [];
  for (const m of members) {
    const usage = await campaignUsage(q, c.id, m.id, 'voucher_issued');
    if (usage.mine >= (c.usage_limit_per_customer ?? 1)) continue;
    if (c.total_limit && usage.total >= c.total_limit) break;
    const blocker = await rewardBlocker(q, reward, m.id, today);
    if (blocker) {
      if (blocker === 'limit_reached') continue;
      notices.push(blocker);
      break;
    }
    const voucher = await issueVoucher(q, {
      biz,
      membershipId: m.id,
      reward,
      source: 'campaign',
      sourceRefId: c.id,
      operationId: op.id,
      now,
      extraEndDates: [c.end_date],
    });
    await insertTxn(q, {
      businessId: biz.id,
      membershipId: m.id,
      programmeId: reward.programme_id,
      programmeType: null,
      operationId: op.id,
      type: 'voucher_issued',
      delta: 0,
      balanceAfter: null,
      source: 'campaign',
      description: `${c.name}: ${reward.name}`,
      actorUserId: input.actorUserId,
      campaignId: c.id,
      customerRewardId: voucher.id,
      now,
    });
    await recordCampaignEvent(q, {
      businessId: biz.id,
      campaignId: c.id,
      membershipId: m.id,
      customerId: m.customer_id,
      type: 'voucher_issued',
      dedupeKey: `issue:${usage.mine + 1}`,
      operationId: op.id,
      now,
    });
    issued++;
  }
  await finishOperation(q, op.id, { issued, notices });
  return { issued, notices, eligible: members.length };
}

/** Lazily issue a birthday reward around the member's birthday, once per year. */
export async function maybeIssueBirthdayReward(q: Queryable, input: { businessId: string; membershipId: string; now?: Date }) {
  const now = input.now ?? new Date();
  const biz = await loadBusinessCtx(q, input.businessId);
  const today = localDate(now, biz.timezone);
  const campaigns = (await runningCampaigns(q, biz.id, today, ['birthday'])).filter((c) => c.benefit?.kind === 'voucher');
  if (!campaigns.length) return null;
  const m = await maybeOne<any>(
    q,
    `select m.id, m.customer_id, m.status, c.birthday_month, c.birthday_day
       from loyalty_memberships m join customers c on c.id = m.customer_id
      where m.id = $1 and m.business_id = $2 for no key update of m`,
    [input.membershipId, biz.id],
  );
  if (!m || m.status !== 'active' || !m.birthday_month || !m.birthday_day) return null;
  // nearest occurrence of the birthday (handles windows that cross a year boundary)
  const thisYear = Number(today.slice(0, 4));
  const occurrence = (y: number) => {
    const mm = String(m.birthday_month).padStart(2, '0');
    const lastDay = Number(monthRange(`${y}-${mm}-01`)[1].slice(8));
    return `${y}-${mm}-${String(Math.min(m.birthday_day, lastDay)).padStart(2, '0')}`;
  };
  const candidates = [thisYear - 1, thisYear, thisYear + 1].map((y) => ({ y, date: occurrence(y) }));
  candidates.sort((a, b) => Math.abs(diffDays(today, a.date)) - Math.abs(diffDays(today, b.date)));
  const { y: bdayYear, date: bday } = candidates[0];
  const issued: IssuedVoucher[] = [];
  for (const c of campaigns) {
    const windowDays = Math.min(31, Math.max(0, Number(c.config?.windowDays ?? 7)));
    const d = diffDays(today, bday);
    if (d < -windowDays || d > windowDays) continue;
    const benefit = campaignBenefitSchema.safeParse(c.benefit);
    if (!benefit.success || benefit.data.kind !== 'voucher') continue;
    const reward = await loadReward(q, biz.id, benefit.data.rewardId);
    if (await rewardBlocker(q, reward, m.id, today)) continue;
    const fresh = await recordCampaignEvent(q, {
      businessId: biz.id,
      campaignId: c.id,
      membershipId: m.id,
      customerId: m.customer_id,
      type: 'voucher_issued',
      dedupeKey: `birthday:${bdayYear}`,
      now,
    });
    if (!fresh) continue;
    const voucher = await issueVoucher(q, {
      biz,
      membershipId: m.id,
      reward,
      source: 'campaign',
      sourceRefId: c.id,
      operationId: null,
      now,
      extraEndDates: [addDays(bday, windowDays), c.end_date],
    });
    await insertTxn(q, {
      businessId: biz.id,
      membershipId: m.id,
      programmeId: reward.programme_id,
      programmeType: null,
      operationId: null,
      type: 'voucher_issued',
      delta: 0,
      balanceAfter: null,
      source: 'campaign',
      description: `${c.name}: ${reward.name}`,
      actorUserId: null,
      campaignId: c.id,
      customerRewardId: voucher.id,
      now,
    });
    issued.push(voucher);
  }
  return issued;
}

/** Mark vouchers past their expiry as expired (idempotent housekeeping). */
export async function expireVouchers(q: Queryable, now = new Date()) {
  const r = await q.query(`update customer_rewards set status = 'expired' where status = 'available' and expires_at is not null and expires_at <= $1`, [now]);
  return r.rowCount;
}

export { grantSchema };
