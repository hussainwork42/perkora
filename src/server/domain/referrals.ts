/**
 * "Bring a friend": a café's referral programme. Stored as a campaign of type 'referral'
 * so the loyalty engine's existing qualification rules apply (no self-referral, per-member
 * limit, one reward per friend), but managed from its own simple settings page.
 */
import type { Queryable } from '../db';
import { many, maybeOne, one } from '../db';
import { referralConfigSchema, type ReferralConfig } from '../../shared/schemas';
import { localDate } from '../../shared/time';

export interface ReferralProgramme {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  config: ReferralConfig;
}

export async function loadReferralProgramme(q: Queryable, businessId: string): Promise<ReferralProgramme | null> {
  const row = await maybeOne<any>(
    q,
    `select id, name, description, status, config, start_date, end_date from campaigns
      where business_id = $1 and campaign_type = 'referral' and status <> 'completed'
      order by (status = 'published') desc, updated_at desc limit 1`,
    [businessId],
  );
  if (!row) return null;
  const cfg = referralConfigSchema.safeParse(row.config);
  if (!cfg.success) return null;
  return { id: row.id, name: row.name, description: row.description, enabled: row.status === 'published', config: cfg.data };
}

export async function saveReferralProgramme(
  q: Queryable,
  biz: { id: string; timezone: string },
  input: { enabled: boolean; name: string; description: string | null; config: ReferralConfig },
): Promise<string> {
  const today = localDate(new Date(), biz.timezone);
  const existing = await loadReferralProgramme(q, biz.id);
  const status = input.enabled ? 'published' : 'paused';
  if (existing) {
    await q.query(
      `update campaigns set name = $2, description = $3, config = $4, status = $5, end_date = null,
          start_date = least(start_date, $6::date), is_public = true, target_segment = 'all',
          published_at = case when $5 = 'published' then coalesce(published_at, now()) else published_at end, updated_at = now()
        where id = $1 and business_id = $7`,
      [existing.id, input.name, input.description, input.config, status, today, biz.id],
    );
    return existing.id;
  }
  const row = await one<{ id: string }>(
    q,
    `insert into campaigns (business_id, name, description, campaign_type, status, start_date, target_segment, benefit, config, is_public, published_at)
     values ($1, $2, $3, 'referral', $4, $5, 'all', '{"kind":"none"}', $6, true, case when $4 = 'published' then now() end) returning id`,
    [biz.id, input.name, input.description, status, today, input.config],
  );
  return row.id;
}

export async function referralStats(q: Queryable, businessId: string) {
  const counts = await one<{ pending: number; qualified: number; rejected: number }>(
    q,
    `select count(*) filter (where status = 'pending')::int as pending,
            count(*) filter (where status = 'qualified')::int as qualified,
            count(*) filter (where status = 'rejected')::int as rejected
       from referrals where business_id = $1`,
    [businessId],
  );
  const top = await many<{ name: string; n: number }>(
    q,
    `select c.name, count(*)::int as n
       from referrals r join loyalty_memberships m on m.id = r.referrer_membership_id join customers c on c.id = m.customer_id
      where r.business_id = $1 and r.status = 'qualified'
      group by c.name order by n desc, c.name limit 5`,
    [businessId],
  );
  return { ...counts, top };
}
