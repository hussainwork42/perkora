import type { Queryable } from '../db';
import { maybeOne } from '../db';
import type { BusinessSettings, SegmentKey } from '../../shared/schemas';
import { SEGMENTS } from '../../shared/schemas';

export type ParamFn = (v: unknown) => string;

export function paramBuilder(initial: unknown[] = []) {
  const params = [...initial];
  const p: ParamFn = (v) => {
    params.push(v);
    return `$${params.length}`;
  };
  return { params, p };
}

export function isSegment(s: unknown): s is SegmentKey {
  return typeof s === 'string' && (SEGMENTS as readonly string[]).includes(s);
}

/**
 * SQL predicate selecting memberships (alias `m`) in a segment.
 * Definitions are documented in docs/METRICS.md and shown in the UI.
 */
export function segmentPredicate(segment: SegmentKey, s: BusinessSettings, now: Date, p: ParamFn, m = 'm'): string {
  const nowP = () => `${p(now)}::timestamptz`;
  switch (segment) {
    case 'all':
      return 'true';
    case 'new':
      return `${m}.joined_at >= ${nowP()} - make_interval(days => ${p(s.newMemberDays)}::int)`;
    case 'active':
      return `${m}.last_visit_at >= ${nowP()} - make_interval(days => ${p(s.inactivityDays)}::int)`;
    case 'frequent':
      return `(select count(*) from visits v where v.membership_id = ${m}.id and v.occurred_at >= ${nowP()} - interval '30 days' and v.occurred_at <= ${nowP()}) >= ${p(s.frequentVisits)}::int`;
    case 'approaching':
      return `(exists (
        select 1 from membership_balances b
        join loyalty_programmes lp on lp.id = b.programme_id
        where b.membership_id = ${m}.id and lp.status = 'active' and lp.programme_type = 'stamps'
          and (lp.config->>'stampsRequired')::int - b.balance between 1 and ${p(s.approachingStamps)}::int)
      or exists (
        select 1 from membership_balances b
        join loyalty_programmes lp on lp.id = b.programme_id
        join rewards r on r.programme_id = lp.id and r.status = 'active' and r.points_cost is not null
        where b.membership_id = ${m}.id and lp.status = 'active' and lp.programme_type = 'points'
          and b.balance < r.points_cost and b.balance >= ceil(r.points_cost * 0.8)))`;
    case 'unused_rewards':
      return `exists (select 1 from customer_rewards cr where cr.membership_id = ${m}.id and cr.status = 'available' and (cr.expires_at is null or cr.expires_at > ${nowP()}))`;
    case 'inactive':
      return `(${m}.visit_count > 0 and ${m}.last_visit_at < ${nowP()} - make_interval(days => ${p(s.inactivityDays)}::int))`;
    case 'no_visits':
      return `${m}.visit_count = 0`;
  }
}

export async function memberInSegment(
  q: Queryable,
  businessId: string,
  membershipId: string,
  segment: SegmentKey,
  settings: BusinessSettings,
  now: Date,
): Promise<boolean> {
  if (segment === 'all') return true;
  const { params, p } = paramBuilder([membershipId, businessId]);
  const pred = segmentPredicate(segment, settings, now, p);
  const r = await maybeOne<{ ok: boolean }>(
    q,
    `select exists (select 1 from loyalty_memberships m where m.id = $1 and m.business_id = $2 and m.status = 'active' and ${pred}) as ok`,
    params,
  );
  return Boolean(r?.ok);
}

export const SEGMENT_LABELS: Record<SegmentKey, { label: string; describe: (s: BusinessSettings) => string }> = {
  all: { label: 'All members', describe: () => 'Every active loyalty member.' },
  new: { label: 'New members', describe: (s) => `Joined in the last ${s.newMemberDays} days.` },
  active: { label: 'Active', describe: (s) => `Made a verified visit in the last ${s.inactivityDays} days.` },
  frequent: { label: 'Frequent visitors', describe: (s) => `${s.frequentVisits} or more verified visits in the last 30 days.` },
  approaching: {
    label: 'Close to a reward',
    describe: (s) => `${s.approachingStamps} or fewer stamps to go, or within 20% of a points reward.`,
  },
  unused_rewards: { label: 'Unused rewards', describe: () => 'Holding at least one reward that has not been redeemed or expired.' },
  inactive: {
    label: 'Not visited recently',
    describe: (s) => `Visited before, but no verified visit in the last ${s.inactivityDays} days.`,
  },
  no_visits: { label: 'Joined, no visit yet', describe: () => 'Joined the programme but has no verified visit yet.' },
};
