import { z } from 'zod';
import type { Router } from '../http/router';
import type { Ctx, Reply } from '../http/core';
import { back, field, formObject, readBody, redirect, reply } from '../http/core';
import { render } from '../http/render';
import { db, many, maybeOne, one, tx } from '../db';
import { config } from '../config';
import { assertCan, can, hasFeature, isReply, requireBusiness, selectBusiness, type BusinessContext, type StaffPermission } from '../auth/guards';
import { DomainError, notFound } from '../domain/errors';
import { adjustBalance, joinBusiness, reverseRedemption, reverseTransaction, voidVoucher } from '../domain/loyalty';
import { loadMemberView } from '../domain/views';
import { campaignPerformance, dailySeries, detailMetrics, insights, overviewMetrics, parseRange, recentActivity, segmentCounts, topRewards } from '../domain/analytics';
import { isSegment, paramBuilder, segmentPredicate, SEGMENT_LABELS } from '../domain/segments';
import { randomToken, sha256 } from '../auth/crypto';
import { emailSchema, nameSchema } from '../domain/accounts';
import { isDateStr } from '../../shared/time';
import { OverviewPage, AnalyticsPage } from '../../ui/pages/dashboard/Overview';
import { CustomerDetailPage, CustomerNewPage, CustomersPage } from '../../ui/pages/dashboard/Customers';
import { TransactionsPage } from '../../ui/pages/dashboard/Transactions';

/** Run a dashboard handler with the café context, enforcing role/permission on the server. */
export function withBiz(opts: { owner?: boolean; perm?: StaffPermission; allowOnboarding?: boolean }, fn: (ctx: Ctx, biz: BusinessContext) => Promise<Reply>) {
  return async (ctx: Ctx) => {
    const b = await requireBusiness(ctx, opts);
    if (isReply(b)) return b;
    return fn(ctx, b);
  };
}

export function csvReply(filename: string, header: string[], rows: (string | number | null | undefined | Date)[][]): Reply {
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return '';
    let s = v instanceof Date ? v.toISOString() : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // neutralise spreadsheet formulas
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = '﻿' + [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
  return reply(200, body, {
    'content-type': 'text/csv; charset=utf-8',
    'content-disposition': `attachment; filename="${filename}"`,
    'cache-control': 'no-store',
  });
}

export async function audit(biz: BusinessContext | null, actor: string, action: string, targetType?: string, targetId?: string, metadata: object = {}) {
  await db.query(`insert into audit_logs (business_id, actor_user_id, action, target_type, target_id, metadata) values ($1, $2, $3, $4, $5, $6)`, [
    biz?.id ?? null,
    actor,
    action,
    targetType ?? null,
    targetId ?? null,
    metadata,
  ]);
}

function domainFlash(e: unknown): { type: 'error'; message: string } {
  if (e instanceof DomainError) return { type: 'error', message: e.message };
  throw e;
}

async function customerQuery(biz: BusinessContext, q: string, segment: string, sort: string, limit: number | null, offset: number, showContacts: boolean) {
  const { params, p } = paramBuilder([biz.id]);
  const conds = ['m.business_id = $1'];
  if (q) {
    const like = p(`%${q.replace(/[%_\\]/g, (c) => '\\' + c)}%`);
    const code = p(q.toUpperCase().replace(/[^A-Z0-9]/g, ''));
    conds.push(showContacts ? `(c.name ilike ${like} or c.email ilike ${like} or c.phone ilike ${like} or m.member_code = ${code})` : `(c.name ilike ${like} or m.member_code = ${code})`);
  }
  if (isSegment(segment) && segment !== 'all') conds.push(segmentPredicate(segment, biz.settings, new Date(), p));
  const order =
    sort === 'name' ? 'c.name asc' : sort === 'joined' ? 'm.joined_at desc' : sort === 'visits' ? 'm.visit_count desc, m.last_visit_at desc nulls last' : 'm.last_visit_at desc nulls last, m.joined_at desc';
  const where = conds.join(' and ');
  const total = (await one<{ n: number }>(db, `select count(*)::int as n from loyalty_memberships m join customers c on c.id = m.customer_id where ${where}`, params)).n;
  const rows = await many<any>(
    db,
    `select m.id, c.name, c.email, c.phone, m.joined_at, m.last_visit_at, m.visit_count, m.status, m.member_code, m.marketing_consent, c.user_id,
       (select string_agg(case when lp.programme_type = 'stamps' then mb.balance || '/' || (lp.config->>'stampsRequired') || ' stamps' else mb.balance || ' pts' end, ' · ' order by lp.programme_type desc)
          from membership_balances mb join loyalty_programmes lp on lp.id = mb.programme_id and lp.status = 'active' where mb.membership_id = m.id) as balances,
       (select count(*)::int from customer_rewards cr where cr.membership_id = m.id and cr.status = 'available' and (cr.expires_at is null or cr.expires_at > now())) as rewards
     from loyalty_memberships m join customers c on c.id = m.customer_id
     where ${where} order by ${order} ${limit ? `limit ${Number(limit)} offset ${Number(offset)}` : ''}`,
    params,
  );
  return { total, rows };
}

const PAGE = 25;

export function dashboardCoreRoutes(r: Router) {
  r.post('/dashboard/switch', async (ctx) => {
    const body = await readBody(ctx);
    const id = field(body, 'business_id');
    if (ctx.user && /^[0-9a-f-]{36}$/.test(id)) {
      const ok = await maybeOne(db, `select 1 from business_members where business_id = $1 and user_id = $2 and status = 'active'`, [id, ctx.user.id]);
      if (ok) selectBusiness(ctx, id);
    }
    return redirect(ctx, '/dashboard');
  });

  r.get(
    '/dashboard',
    withBiz({}, async (ctx, biz) => {
      if (biz.role !== 'owner' && !can(biz, 'view_reports')) return redirect(ctx, can(biz, 'view_customers') ? '/dashboard/customers' : '/terminal', undefined, 302);
      const range = parseRange(ctx.query, biz.timezone);
      const [m, series, activity, ins] = await Promise.all([
        overviewMetrics(db, biz.id, biz.timezone, biz.settings, range),
        dailySeries(db, biz.id, biz.timezone, range),
        recentActivity(db, biz.id, 12),
        insights(db, biz.id, biz.timezone, biz.settings),
      ]);
      const any = await maybeOne(db, 'select 1 from loyalty_memberships where business_id = $1 limit 1', [biz.id]);
      return render(ctx, <OverviewPage biz={biz} range={range} m={m} series={series} activity={activity} insights={hasFeature(biz, 'segments') ? ins : ins.filter((i) => !i.href?.includes('segment=inactive') && !i.href?.includes('approaching'))} hasMembers={Boolean(any)} />, {
        title: 'Overview',
        noindex: true,
      });
    }),
  );

  r.get(
    '/dashboard/analytics',
    withBiz({ perm: 'view_reports' }, async (ctx, biz) => {
      const range = parseRange(ctx.query, biz.timezone);
      const [m, d, series, top, campaigns] = await Promise.all([
        overviewMetrics(db, biz.id, biz.timezone, biz.settings, range),
        detailMetrics(db, biz.id, biz.timezone, range),
        dailySeries(db, biz.id, biz.timezone, range),
        topRewards(db, biz.id, biz.timezone, range),
        campaignPerformance(db, biz.id),
      ]);
      const segments = hasFeature(biz, 'segments') ? await segmentCounts(db, biz.id, biz.settings) : null;
      const today = range.to;
      for (const c of campaigns) {
        c.status = c.status !== 'published' ? c.status : c.start_date > today ? 'scheduled' : c.end_date && c.end_date < today ? 'completed' : 'active';
      }
      return render(ctx, <AnalyticsPage biz={biz} range={range} m={m} d={d} series={series} segments={segments} top={top} campaigns={campaigns} />, { title: 'Analytics', noindex: true });
    }),
  );

  r.get(
    '/dashboard/analytics/export.csv',
    withBiz({ perm: 'view_reports' }, async (ctx, biz) => {
      if (!hasFeature(biz, 'csvExport')) throw new DomainError('plan_feature', 'CSV export is not included in your plan.', 403);
      const range = parseRange(ctx.query, biz.timezone);
      const series = await dailySeries(db, biz.id, biz.timezone, range);
      await audit(biz, ctx.user!.id, 'export.analytics', 'business', biz.id, { from: range.from, to: range.to });
      return csvReply(`perkora-daily-${range.from}-to-${range.to}.csv`, ['date', 'verified_visits', 'new_members', 'rewards_issued', 'rewards_redeemed'], series.map((d) => [d.date, d.visits, d.joins, d.issued, d.redemptions]));
    }),
  );

  /* ------------------------------------------------ customers */
  r.get(
    '/dashboard/customers',
    withBiz({ perm: 'view_customers' }, async (ctx, biz) => {
      const q = (ctx.query.get('q') ?? '').trim().slice(0, 80);
      let segment = ctx.query.get('segment') ?? 'all';
      if (!isSegment(segment)) segment = 'all';
      const segmentsAllowed = hasFeature(biz, 'segments');
      if (!segmentsAllowed && !['all', 'new', 'no_visits'].includes(segment)) segment = 'all';
      const sort = ['name', 'joined', 'visits', 'recent'].includes(ctx.query.get('sort') ?? '') ? ctx.query.get('sort')! : 'recent';
      const page = Math.max(1, Math.min(1000, Number(ctx.query.get('page')) || 1));
      const showContacts = can(biz, 'view_customers');
      const { total, rows } = await customerQuery(biz, q, segment, sort, PAGE, (page - 1) * PAGE, showContacts);
      const help = isSegment(segment) ? `${SEGMENT_LABELS[segment].label}: ${SEGMENT_LABELS[segment].describe(biz.settings)}` : '';
      return render(ctx, <CustomersPage biz={biz} rows={rows} total={total} page={page} pageSize={PAGE} q={q} segment={segment} sort={sort} segmentsAllowed={segmentsAllowed} segmentHelp={help} showContacts={showContacts} />, {
        title: 'Customers',
        noindex: true,
      });
    }),
  );

  r.get(
    '/dashboard/customers/export.csv',
    withBiz({ owner: true }, async (ctx, biz) => {
      if (!hasFeature(biz, 'csvExport')) throw new DomainError('plan_feature', 'CSV export is not included in your plan.', 403);
      const q = (ctx.query.get('q') ?? '').trim().slice(0, 80);
      const segment = isSegment(ctx.query.get('segment')) ? ctx.query.get('segment')! : 'all';
      const { rows } = await customerQuery(biz, q, segment, 'name', null, 0, true);
      await audit(biz, ctx.user!.id, 'export.customers', 'business', biz.id, { count: rows.length, segment });
      return csvReply(
        `perkora-customers-${new Date().toISOString().slice(0, 10)}.csv`,
        ['name', 'email', 'phone', 'member_code', 'joined_at', 'last_visit_at', 'verified_visits', 'balances', 'available_rewards', 'marketing_consent', 'status'],
        rows.map((r) => [r.name, r.email, r.phone, r.member_code, r.joined_at, r.last_visit_at, r.visit_count, r.balances, r.rewards, r.marketing_consent ? 'yes' : 'no', r.status]),
      );
    }),
  );

  r.get('/dashboard/customers/new', withBiz({}, async (ctx, biz) => render(ctx, <CustomerNewPage biz={biz} />, { title: 'Add customer', noindex: true })));

  r.post(
    '/dashboard/customers/new',
    withBiz({}, async (ctx, biz) => {
      const body = await readBody(ctx);
      const values = formObject(body);
      const errors: Record<string, string> = {};
      const name = nameSchema.safeParse(values.name);
      if (!name.success) errors.name = name.error.issues[0].message;
      let email: string | null = null;
      if (values.email?.trim()) {
        const e = emailSchema.safeParse(values.email);
        if (!e.success) errors.email = e.error.issues[0].message;
        else email = e.data;
      }
      const phone = values.phone?.trim() || null;
      if (phone && !/^[+0-9 ()-]{6,40}$/.test(phone)) errors.phone = 'Enter a valid phone number.';
      if (email) {
        const dupe = await maybeOne(db, `select 1 from loyalty_memberships m join customers c on c.id = m.customer_id where m.business_id = $1 and lower(c.email) = $2`, [biz.id, email]);
        if (dupe) errors.email = 'A member with this email already exists. Search for them instead.';
      }
      if (Object.keys(errors).length) return render(ctx, <CustomerNewPage biz={biz} values={values} errors={errors} />, { title: 'Add customer', status: 422 });
      const id = await tx(async (q) => {
        const c = await one<{ id: string }>(q, `insert into customers (name, email, phone, is_demo) values ($1, $2, $3, $4) returning id`, [name.data, email, phone, biz.isDemo]);
        const j = await joinBusiness(q, { businessId: biz.id, customerId: c.id, source: 'dashboard', marketingConsent: values.marketing === '1', actorUserId: ctx.user!.id });
        return j.membershipId;
      });
      return redirect(ctx, `/dashboard/customers/${id}`, { type: 'success', message: `${name.data} added. Their member code is shown below.` });
    }),
  );

  r.get(
    '/dashboard/customers/:id',
    withBiz({}, async (ctx, biz) => {
      if (!/^[0-9a-f-]{36}$/.test(ctx.params.id)) throw notFound('Customer');
      const view = await loadMemberView(db, biz, ctx.params.id, { activityLimit: 25 });
      if (!view) throw notFound('Customer');
      if (!can(biz, 'view_customers')) view.customer = { ...view.customer, email: null, phone: null };
      const visits = await many<any>(
        db,
        `select v.occurred_at, v.source, u.name as staff from visits v left join users u on u.id = v.verified_by where v.membership_id = $1 order by v.occurred_at desc limit 15`,
        [view.membership.id],
      );
      const refBy = await maybeOne<{ name: string }>(
        db,
        `select c.name from loyalty_memberships m join loyalty_memberships r on r.id = m.referred_by_membership_id join customers c on c.id = r.customer_id where m.id = $1`,
        [view.membership.id],
      );
      const refs = await one<{ total: number; qualified: number }>(
        db,
        `select count(*)::int as total, count(*) filter (where status = 'qualified')::int as qualified from referrals where referrer_membership_id = $1`,
        [view.membership.id],
      );
      const campaigns = await many<any>(
        db,
        `select c.name, e.event_type, e.created_at from campaign_events e join campaigns c on c.id = e.campaign_id where e.membership_id = $1 and e.event_type <> 'viewed' order by e.created_at desc limit 10`,
        [view.membership.id],
      );
      const userLink = await one<{ user_id: string | null }>(db, 'select user_id from customers where id = $1', [view.membership.customerId]);
      const claimToken = ctx.query.get('claim');
      const claimLink = claimToken && /^[A-Za-z0-9_-]{30,60}$/.test(claimToken) ? `${config().APP_URL.replace(/\/$/, '')}/claim/${claimToken}` : null;
      return render(
        ctx,
        <CustomerDetailPage
          biz={biz}
          view={view}
          visits={visits}
          referral={{ referredBy: refBy?.name ?? null, referred: refs.total, qualified: refs.qualified }}
          campaigns={campaigns}
          claimLink={claimLink}
          hasAccount={Boolean(userLink.user_id)}
        />,
        { title: view.customer.name, noindex: true },
      );
    }),
  );

  r.post(
    '/dashboard/customers/:id/adjust',
    withBiz({ perm: 'adjust_balances' }, async (ctx, biz) => {
      const body = await readBody(ctx);
      const delta = Number(field(body, 'delta'));
      try {
        await tx((q) =>
          adjustBalance(q, {
            businessId: biz.id,
            membershipId: ctx.params.id,
            programmeId: field(body, 'programme_id'),
            delta,
            reason: field(body, 'reason'),
            actorUserId: ctx.user!.id,
            idempotencyKey: field(body, 'idempotency_key') || `adj-${Date.now()}`,
          }),
        );
      } catch (e) {
        return redirect(ctx, `/dashboard/customers/${ctx.params.id}`, domainFlash(e));
      }
      return redirect(ctx, `/dashboard/customers/${ctx.params.id}`, { type: 'success', message: 'Balance corrected. The change is recorded in the transaction history.' });
    }),
  );

  r.post(
    '/dashboard/customers/:id/void',
    withBiz({ perm: 'adjust_balances' }, async (ctx, biz) => {
      const body = await readBody(ctx);
      try {
        await tx((q) =>
          voidVoucher(q, { businessId: biz.id, voucherId: field(body, 'voucher_id'), reason: field(body, 'reason'), actorUserId: ctx.user!.id, idempotencyKey: field(body, 'idempotency_key') || `void-${Date.now()}` }),
        );
      } catch (e) {
        return redirect(ctx, `/dashboard/customers/${ctx.params.id}`, domainFlash(e));
      }
      return redirect(ctx, `/dashboard/customers/${ctx.params.id}`, { type: 'success', message: 'Reward cancelled.' });
    }),
  );

  r.post(
    '/dashboard/customers/:id/claim',
    withBiz({}, async (ctx, biz) => {
      const m = await maybeOne<{ id: string; user_id: string | null }>(
        db,
        `select m.id, c.user_id from loyalty_memberships m join customers c on c.id = m.customer_id where m.id = $1 and m.business_id = $2`,
        [ctx.params.id, biz.id],
      );
      if (!m) throw notFound('Customer');
      if (m.user_id) return redirect(ctx, `/dashboard/customers/${m.id}`, { type: 'info', message: 'This member already has their own account.' });
      const token = randomToken(32);
      await db.query(`update membership_claims set expires_at = now() where membership_id = $1 and used_at is null`, [m.id]);
      await db.query(`insert into membership_claims (business_id, membership_id, token_hash, created_by, expires_at) values ($1, $2, $3, $4, now() + interval '7 days')`, [
        biz.id,
        m.id,
        sha256(token),
        ctx.user!.id,
      ]);
      return redirect(ctx, `/dashboard/customers/${m.id}?claim=${token}`, { type: 'success', message: 'Claim link created. Share it with the customer; it works once.' });
    }),
  );

  /* ------------------------------------------------ transactions */
  const txnFilters = (ctx: Ctx) => ({
    type: (ctx.query.get('type') ?? '').replace(/[^a-z_]/g, ''),
    member: /^[0-9a-f-]{36}$/.test(ctx.query.get('member') ?? '') ? ctx.query.get('member')! : '',
    from: isDateStr(ctx.query.get('from')) ? ctx.query.get('from')! : '',
    to: isDateStr(ctx.query.get('to')) ? ctx.query.get('to')! : '',
    ref: (ctx.query.get('ref') ?? '').trim().slice(0, 60),
  });

  async function txnQuery(biz: BusinessContext, f: ReturnType<typeof txnFilters>, limit: number | null, offset: number, ownOnly: string | null) {
    const { params, p } = paramBuilder([biz.id]);
    const conds = ['t.business_id = $1'];
    if (f.type) conds.push(`t.transaction_type = ${p(f.type)}`);
    if (f.member) conds.push(`t.membership_id = ${p(f.member)}`);
    if (f.ref) conds.push(`t.reference_id = ${p(f.ref)}`);
    if (f.from) conds.push(`t.created_at >= ((${p(f.from)}::date)::timestamp at time zone ${p(biz.timezone)})`);
    if (f.to) conds.push(`t.created_at < ((${p(f.to)}::date + 1)::timestamp at time zone ${p(biz.timezone)})`);
    if (ownOnly) conds.push(`(t.actor_user_id = ${p(ownOnly)} and t.created_at > now() - interval '2 days')`);
    const where = conds.join(' and ');
    const total = (await one<{ n: number }>(db, `select count(*)::int as n from loyalty_transactions t where ${where}`, params)).n;
    const rows = await many<any>(
      db,
      `select t.*, c.name as customer_name, lp.name as programme_name, u.name as actor_name,
          exists (select 1 from loyalty_transactions r where r.reverses_transaction_id = t.id) as reversed,
          rr.status as redemption_status
         from loyalty_transactions t
         join loyalty_memberships m on m.id = t.membership_id
         join customers c on c.id = m.customer_id
         left join loyalty_programmes lp on lp.id = t.programme_id
         left join users u on u.id = t.actor_user_id
         left join reward_redemptions rr on rr.id = t.redemption_id
        where ${where} order by t.created_at desc, t.id desc ${limit ? `limit ${Number(limit)} offset ${Number(offset)}` : ''}`,
      params,
    );
    return { total, rows };
  }

  r.get(
    '/dashboard/transactions',
    withBiz({}, async (ctx, biz) => {
      const f = txnFilters(ctx);
      const page = Math.max(1, Math.min(2000, Number(ctx.query.get('page')) || 1));
      // staff without report access see only what they recorded recently
      const ownOnly = can(biz, 'view_reports') || can(biz, 'view_customers') ? null : ctx.user!.id;
      const { total, rows } = await txnQuery(biz, f, 50, (page - 1) * 50, ownOnly);
      const memberName = f.member ? (await maybeOne<{ name: string }>(db, 'select c.name from loyalty_memberships m join customers c on c.id = m.customer_id where m.id = $1 and m.business_id = $2', [f.member, biz.id]))?.name ?? null : null;
      return render(ctx, <TransactionsPage biz={biz} rows={rows} total={total} page={page} pageSize={50} filters={f} memberName={memberName} />, { title: 'Transactions', noindex: true });
    }),
  );

  r.get(
    '/dashboard/transactions/export.csv',
    withBiz({ perm: 'view_reports' }, async (ctx, biz) => {
      if (!hasFeature(biz, 'csvExport')) throw new DomainError('plan_feature', 'CSV export is not included in your plan.', 403);
      const f = txnFilters(ctx);
      const { rows } = await txnQuery(biz, f, 50000, 0, null);
      await audit(biz, ctx.user!.id, 'export.transactions', 'business', biz.id, { count: rows.length });
      return csvReply(
        `perkora-transactions-${new Date().toISOString().slice(0, 10)}.csv`,
        ['created_at', 'member', 'type', 'programme', 'stamps_delta', 'points_delta', 'balance_after', 'description', 'receipt', 'amount_minor', 'currency', 'staff', 'source', 'reversed'],
        rows.map((r) => [r.created_at, r.customer_name, r.transaction_type, r.programme_name, r.stamps_delta, r.points_delta, r.balance_after, r.description, r.reference_id, r.purchase_amount_minor, r.currency, r.actor_name, r.source, r.reversed ? 'yes' : 'no']),
      );
    }),
  );

  r.post(
    '/dashboard/transactions/:id/reverse',
    withBiz({ perm: 'adjust_balances' }, async (ctx, biz) => {
      const body = await readBody(ctx);
      try {
        await tx((q) =>
          reverseTransaction(q, {
            businessId: biz.id,
            transactionId: ctx.params.id,
            wholeOperation: field(body, 'whole') === '1',
            reason: field(body, 'reason'),
            actorUserId: ctx.user!.id,
            idempotencyKey: field(body, 'idempotency_key') || `rev-${ctx.params.id}`,
          }),
        );
      } catch (e) {
        return back(ctx, '/dashboard/transactions', domainFlash(e));
      }
      return back(ctx, '/dashboard/transactions', { type: 'success', message: 'Reversed. A correcting transaction was added to the history.' });
    }),
  );

  r.post(
    '/dashboard/redemptions/:id/reverse',
    withBiz({ perm: 'adjust_balances' }, async (ctx, biz) => {
      const body = await readBody(ctx);
      try {
        await tx((q) =>
          reverseRedemption(q, { businessId: biz.id, redemptionId: ctx.params.id, reason: field(body, 'reason'), actorUserId: ctx.user!.id, idempotencyKey: field(body, 'idempotency_key') || `revred-${ctx.params.id}` }),
        );
      } catch (e) {
        return back(ctx, '/dashboard/transactions', domainFlash(e));
      }
      return back(ctx, '/dashboard/transactions', { type: 'success', message: 'Redemption undone. The reward is back on the member’s card.' });
    }),
  );
}

export { z, assertCan };
