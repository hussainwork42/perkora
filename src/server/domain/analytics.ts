/**
 * Business analytics. Every number comes from database records; definitions
 * are documented in docs/METRICS.md and shown next to each metric in the UI.
 */
import type { Queryable } from '../db';
import { many, one } from '../db';
import type { BusinessSettings, SegmentKey } from '../../shared/schemas';
import { SEGMENTS } from '../../shared/schemas';
import { addDays, diffDays, isDateStr, localDate } from '../../shared/time';
import { paramBuilder, segmentPredicate } from './segments';

export interface Range {
  key: '7' | '30' | '90' | 'custom';
  from: string;
  to: string;
  days: number;
}

export function parseRange(q: URLSearchParams, tz: string, now = new Date()): Range {
  const today = localDate(now, tz);
  const key = q.get('range');
  if (key === 'custom') {
    const from = q.get('from');
    const to = q.get('to');
    if (isDateStr(from) && isDateStr(to) && from <= to && diffDays(to, from) <= 366) {
      return { key: 'custom', from, to, days: diffDays(to, from) + 1 };
    }
  }
  const n = key === '7' ? 7 : key === '90' ? 90 : 30;
  return { key: String(n) as Range['key'], from: addDays(today, -(n - 1)), to: today, days: n };
}

/** SQL helpers: [start, end) instants of a local-date range. */
const START = (p: (v: unknown) => string, d: string, tz: string) => `((${p(d)}::date)::timestamp at time zone ${p(tz)})`;
const END = (p: (v: unknown) => string, d: string, tz: string) => `((${p(d)}::date + 1)::timestamp at time zone ${p(tz)})`;

export interface OverviewMetrics {
  totalMembers: number;
  activeMembers: number;
  visits: number;
  uniqueVisitors: number;
  rewardsRedeemed: number;
  newMembers: number;
  returningRate: number | null;
  returningDenominator: number;
}

export async function overviewMetrics(q: Queryable, bizId: string, tz: string, s: BusinessSettings, r: Range, now = new Date()): Promise<OverviewMetrics> {
  const { params, p } = paramBuilder([bizId]);
  const start = START(p, r.from, tz);
  const end = END(p, r.to, tz);
  const nowP = p(now);
  const inactive = p(s.inactivityDays);
  const row = await one<any>(
    q,
    `select
       (select count(*)::int from loyalty_memberships m where m.business_id = $1 and m.status = 'active') as total_members,
       (select count(*)::int from loyalty_memberships m where m.business_id = $1 and m.status = 'active'
          and m.last_visit_at >= ${nowP}::timestamptz - make_interval(days => ${inactive}::int)) as active_members,
       (select count(*)::int from visits v where v.business_id = $1 and v.occurred_at >= ${start} and v.occurred_at < ${end}) as visits,
       (select count(distinct v.membership_id)::int from visits v where v.business_id = $1 and v.occurred_at >= ${start} and v.occurred_at < ${end}) as unique_visitors,
       (select count(*)::int from reward_redemptions rr where rr.business_id = $1 and rr.status = 'completed' and rr.redeemed_at >= ${start} and rr.redeemed_at < ${end}) as redeemed,
       (select count(*)::int from loyalty_memberships m where m.business_id = $1 and m.joined_at >= ${start} and m.joined_at < ${end}) as new_members,
       (select count(*)::int from (
          select v.membership_id from visits v where v.business_id = $1 and v.occurred_at >= ${start} and v.occurred_at < ${end}
          group by v.membership_id
          having (select count(*) from visits v2 where v2.membership_id = v.membership_id and v2.occurred_at < ${end}) >= 2
       ) x) as returning_visitors`,
    params,
  );
  const denom = row.unique_visitors;
  return {
    totalMembers: row.total_members,
    activeMembers: row.active_members,
    visits: row.visits,
    uniqueVisitors: denom,
    rewardsRedeemed: row.redeemed,
    newMembers: row.new_members,
    returningRate: denom >= 5 ? row.returning_visitors / denom : null,
    returningDenominator: denom,
  };
}

export interface DayPoint {
  date: string;
  visits: number;
  joins: number;
  redemptions: number;
  issued: number;
}

export async function dailySeries(q: Queryable, bizId: string, tz: string, r: Range): Promise<DayPoint[]> {
  return many<DayPoint>(
    q,
    `with days as (select generate_series($2::date, $3::date, interval '1 day')::date as d)
     select to_char(d, 'YYYY-MM-DD') as date,
       (select count(*)::int from visits v where v.business_id = $1 and v.local_date = d) as visits,
       (select count(*)::int from loyalty_memberships m where m.business_id = $1 and (m.joined_at at time zone $4)::date = d) as joins,
       (select count(*)::int from reward_redemptions rr where rr.business_id = $1 and rr.status = 'completed' and (rr.redeemed_at at time zone $4)::date = d) as redemptions,
       (select count(*)::int from customer_rewards cr where cr.business_id = $1 and (cr.issued_at at time zone $4)::date = d and cr.status <> 'void') as issued
     from days order by d`,
    [bizId, r.from, r.to, tz],
  );
}

export interface ActivityEvent {
  kind: 'joined' | 'stamps' | 'points' | 'redeemed' | 'reward' | 'campaign' | 'reversal';
  at: Date;
  who: string | null;
  text: string;
  delta: number;
  membershipId: string | null;
}

export async function recentActivity(q: Queryable, bizId: string, limit = 12): Promise<ActivityEvent[]> {
  const rows = await many<any>(
    q,
    `(select 'joined' as kind, m.joined_at as at, c.name as who, 'Joined the programme' as text, 0 as delta, m.id as membership_id
        from loyalty_memberships m join customers c on c.id = m.customer_id where m.business_id = $1 order by m.joined_at desc limit $2)
     union all
     (select case
               when t.transaction_type = 'redeem' then 'redeemed'
               when t.transaction_type in ('card_completed', 'voucher_issued') then 'reward'
               when t.transaction_type in ('reversal', 'voucher_void') then 'reversal'
               when t.stamps_delta <> 0 then 'stamps' else 'points' end,
             t.created_at, c.name, t.description, t.stamps_delta + t.points_delta, t.membership_id
        from loyalty_transactions t join loyalty_memberships m on m.id = t.membership_id join customers c on c.id = m.customer_id
       where t.business_id = $1 order by t.created_at desc limit $2)
     union all
     (select 'campaign', created_at, null, 'Campaign created: ' || name, 0, null from campaigns where business_id = $1 order by created_at desc limit $2)
     order by at desc limit $2`,
    [bizId, limit],
  );
  return rows.map((r) => ({ kind: r.kind, at: r.at, who: r.who, text: r.text, delta: r.delta, membershipId: r.membership_id }));
}

export interface DetailMetrics {
  stampsIssued: number;
  pointsIssued: number;
  rewardsIssued: number;
  rewardsIssuedRedeemed: number;
  redemptionRate: number | null;
  avgVisitsPerVisitor: number | null;
}

export async function detailMetrics(q: Queryable, bizId: string, tz: string, r: Range): Promise<DetailMetrics> {
  const { params, p } = paramBuilder([bizId]);
  const start = START(p, r.from, tz);
  const end = END(p, r.to, tz);
  const row = await one<any>(
    q,
    `select
      coalesce((select sum(stamps_delta) from loyalty_transactions where business_id = $1 and created_at >= ${start} and created_at < ${end}
        and transaction_type in ('earn','bonus','welcome','referral','challenge','adjustment','reversal') and (stamps_delta > 0 or transaction_type = 'reversal')), 0)::int as stamps,
      coalesce((select sum(points_delta) from loyalty_transactions where business_id = $1 and created_at >= ${start} and created_at < ${end}
        and transaction_type in ('earn','bonus','welcome','referral','challenge','adjustment','reversal') and (points_delta > 0 or (transaction_type = 'reversal' and redemption_id is null))), 0)::int as points,
      (select count(*)::int from customer_rewards where business_id = $1 and status <> 'void' and issued_at >= ${start} and issued_at < ${end}) as issued,
      (select count(*)::int from customer_rewards where business_id = $1 and status = 'redeemed' and issued_at >= ${start} and issued_at < ${end}) as issued_redeemed,
      (select count(*)::int from visits where business_id = $1 and occurred_at >= ${start} and occurred_at < ${end}) as visits,
      (select count(distinct membership_id)::int from visits where business_id = $1 and occurred_at >= ${start} and occurred_at < ${end}) as visitors`,
    params,
  );
  return {
    stampsIssued: Math.max(0, row.stamps),
    pointsIssued: Math.max(0, row.points),
    rewardsIssued: row.issued,
    rewardsIssuedRedeemed: row.issued_redeemed,
    redemptionRate: row.issued > 0 ? row.issued_redeemed / row.issued : null,
    avgVisitsPerVisitor: row.visitors > 0 ? row.visits / row.visitors : null,
  };
}

export async function segmentCounts(q: Queryable, bizId: string, s: BusinessSettings, now = new Date()): Promise<Record<SegmentKey, number>> {
  const out = {} as Record<SegmentKey, number>;
  for (const seg of SEGMENTS) {
    const { params, p } = paramBuilder([bizId]);
    const pred = segmentPredicate(seg, s, now, p);
    const r = await one<{ n: number }>(q, `select count(*)::int as n from loyalty_memberships m where m.business_id = $1 and m.status = 'active' and ${pred}`, params);
    out[seg] = r.n;
  }
  return out;
}

export async function topRewards(q: Queryable, bizId: string, tz: string, r: Range) {
  const { params, p } = paramBuilder([bizId]);
  return many<{ name: string; redeemed: number; reward_id: string }>(
    q,
    `select rw.id as reward_id, rw.name, count(*)::int as redeemed
       from reward_redemptions rr join rewards rw on rw.id = rr.reward_id
      where rr.business_id = $1 and rr.status = 'completed' and rr.redeemed_at >= ${START(p, r.from, tz)} and rr.redeemed_at < ${END(p, r.to, tz)}
      group by rw.id, rw.name order by redeemed desc, rw.name limit 5`,
    params,
  );
}

export async function campaignPerformance(q: Queryable, bizId: string) {
  return many<any>(
    q,
    `select c.id, c.name, c.campaign_type, c.status, c.start_date, c.end_date, c.target_segment, c.benefit,
        (select count(distinct membership_id)::int from campaign_events e where e.campaign_id = c.id and e.event_type = 'viewed') as viewers,
        (select count(*)::int from campaign_events e where e.campaign_id = c.id and e.event_type = 'voucher_issued') as vouchers_issued,
        (select count(*)::int from campaign_events e where e.campaign_id = c.id and e.event_type = 'bonus_awarded') as bonuses,
        (select coalesce(sum((e.event_data->>'amount')::int), 0)::int from campaign_events e where e.campaign_id = c.id and e.event_type = 'bonus_awarded') as bonus_total,
        (select count(*)::int from customer_rewards cr where cr.source = 'campaign' and cr.source_ref_id = c.id and cr.status = 'redeemed') as redeemed,
        (select count(*)::int from referrals rf where rf.campaign_id = c.id and rf.status = 'qualified') as referrals_qualified,
        (select count(*)::int from referrals rf where rf.campaign_id = c.id) as referrals_started
       from campaigns c where c.business_id = $1 order by c.created_at desc`,
    [bizId],
  );
}

export interface Insight {
  text: string;
  href?: string;
}

export async function insights(q: Queryable, bizId: string, tz: string, s: BusinessSettings, now = new Date()): Promise<Insight[]> {
  const out: Insight[] = [];
  const today = localDate(now, tz);
  const monthStart = today.slice(0, 8) + '01';
  const monthRange: Range = { key: 'custom', from: monthStart, to: today, days: diffDays(today, monthStart) + 1 };
  const top = await topRewards(q, bizId, tz, monthRange);
  if (top[0]) out.push({ text: `Your most redeemed reward this month is ${top[0].name} (${top[0].redeemed} redeemed).`, href: '/dashboard/rewards' });
  const seg = await segmentCounts(q, bizId, s, now);
  if (seg.inactive > 0)
    out.push({ text: `${seg.inactive} member${seg.inactive === 1 ? ' has' : 's have'} not made a verified visit in the last ${s.inactivityDays} days.`, href: '/dashboard/customers?segment=inactive' });
  const joined = await one<{ n: number }>(
    q,
    `select count(*)::int as n from loyalty_memberships where business_id = $1 and joined_at >= (($2::date)::timestamp at time zone $3)`,
    [bizId, monthStart, tz],
  );
  if (joined.n > 0) out.push({ text: `Your loyalty programme gained ${joined.n} member${joined.n === 1 ? '' : 's'} this month.`, href: '/dashboard/customers?segment=new' });
  if (seg.approaching > 0) out.push({ text: `${seg.approaching} member${seg.approaching === 1 ? ' is' : 's are'} close to unlocking a reward.`, href: '/dashboard/customers?segment=approaching' });
  if (seg.unused_rewards > 0)
    out.push({ text: `${seg.unused_rewards} member${seg.unused_rewards === 1 ? ' holds' : 's hold'} a reward they haven’t used yet.`, href: '/dashboard/customers?segment=unused_rewards' });
  return out;
}

export const METRIC_DEFINITIONS: Record<string, string> = {
  totalMembers: 'Active loyalty memberships at this café today (closed memberships are excluded).',
  activeMembers: 'Members with at least one verified visit in the last N days, where N is your inactivity threshold.',
  visits: 'Verified visits in the period. Awards for the same member within your visit window count as one visit.',
  uniqueVisitors: 'Distinct members with at least one verified visit in the period.',
  rewardsRedeemed: 'Rewards redeemed at the counter in the period (reversed redemptions excluded).',
  newMembers: 'Members who joined in the period.',
  returningRate: 'Of members who visited in the period, the share with at least two verified visits in total up to the end of the period. Shown only when at least 5 members visited. It describes loyalty members only, not all café customers.',
  stampsIssued: 'Stamps given in the period (purchases, bonuses, challenges, referrals and adjustments), net of reversals.',
  pointsIssued: 'Points given in the period, net of reversals.',
  rewardsIssued: 'Rewards unlocked or granted in the period: filled stamp cards, campaign, challenge and referral rewards, and points rewards claimed.',
  redemptionRate: 'Of the rewards issued in the period, the share already redeemed. Shown only when at least one reward was issued.',
};
