import { z } from 'zod';
import type { Router } from '../http/router';
import type { Ctx } from '../http/core';
import { json, readBody, redirect } from '../http/core';
import { render } from '../http/render';
import { db, many, maybeOne, tx } from '../db';
import { isReply, requireBusiness, type BusinessContext } from '../auth/guards';
import { rateLimit } from '../auth/ratelimit';
import { DomainError, notFound } from '../domain/errors';
import { awardPurchase, maybeIssueBirthdayReward, redeemPoints, redeemVoucher } from '../domain/loyalty';
import { loadMemberView } from '../domain/views';
import { extractToken, verifyMemberToken } from '../domain/qrtoken';
import { dateShort, formatMemberCode, parseMoneyToMinor, relative, shortName, timeOnly } from '../../shared/format';
import { fmt } from '../../shared/i18n';
import { localDate } from '../../shared/time';
import { TerminalPage } from '../../ui/pages/TerminalPage';

async function terminalBiz(ctx: Ctx): Promise<BusinessContext> {
  const b = await requireBusiness(ctx);
  if (isReply(b)) throw new DomainError('forbidden', 'Sign in with a staff account to use the terminal.', 401);
  if (b.status !== 'active') throw new DomainError('business_inactive', 'This café’s account is suspended. Contact Perkora support.', 403);
  return b;
}

async function memberSummary(ctx: Ctx, biz: BusinessContext, membershipId: string) {
  await tx((q) => maybeIssueBirthdayReward(q, { businessId: biz.id, membershipId })).catch(() => undefined);
  const v = await loadMemberView(db, biz, membershipId, { activityLimit: 3 });
  if (!v) throw notFound('Member');
  if (v.membership.status !== 'active') throw new DomainError('membership_inactive', 'This membership is closed.', 409);
  const tz = biz.timezone;
  return {
    id: v.membership.id,
    shortName: shortName(v.customer.name),
    memberCode: formatMemberCode(v.membership.memberCode),
    visitCount: v.membership.visitCount,
    lastVisitLabel: v.membership.lastVisitAt ? relative(v.membership.lastVisitAt, ctx.locale) : null,
    sinceLabel: fmt(ctx.t.terminal.since, { date: dateShort(v.membership.joinedAt, tz, ctx.locale) }),
    programmes: v.programmes.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      balance: p.balance,
      stampsRequired: p.config?.stampsRequired,
      maxStampsPerTransaction: p.config?.maxStampsPerTransaction ?? 1,
      allowWithOtherPromotions: Boolean(p.config?.allowWithOtherPromotions),
      earnMode: p.config?.earnMode,
      pointsPerUnit: p.config?.pointsPerUnit,
      pointsPerPurchase: p.config?.pointsPerPurchase,
      cardRewardName: p.cardReward?.name ?? null,
      catalogue: p.catalogue.map((r) => ({ id: r.id, name: r.name, cost: r.cost })),
    })),
    vouchers: v.vouchers
      .filter((x) => x.status === 'available')
      .map((x) => ({ id: x.id, name: x.name, expiresLabel: x.expiresAt ? fmt(ctx.t.common.expires, { date: dateShort(x.expiresAt, tz, ctx.locale) }) : null })),
  };
}

const awardSchema = z.object({
  membershipId: z.string().uuid(),
  programmeId: z.string().uuid(),
  quantity: z.number().int().min(1).max(10).optional(),
  amount: z.string().max(20).optional(),
  currency: z.enum(['EUR', 'TRY']).optional(),
  referenceId: z.string().trim().max(60).optional(),
  usedOtherPromotion: z.boolean().optional(),
  confirmSeparatePurchase: z.boolean().optional(),
  idempotencyKey: z.string().min(8).max(120),
});

const redeemSchema = z.object({
  membershipId: z.string().uuid(),
  kind: z.enum(['voucher', 'points']),
  customerRewardId: z.string().uuid().optional(),
  rewardId: z.string().uuid().optional(),
  idempotencyKey: z.string().min(8).max(120),
});

function parse<T>(schema: z.ZodType<T>, v: unknown): T {
  const r = schema.safeParse(v);
  if (!r.success) throw new DomainError('validation', r.error.issues[0]?.message ?? 'Invalid request', 422);
  return r.data;
}

export function terminalRoutes(r: Router) {
  r.get('/terminal', async (ctx) => {
    const b = await requireBusiness(ctx);
    if (isReply(b)) return b;
    if (b.status !== 'active') throw new DomainError('business_inactive', 'This café’s account is suspended. Contact Perkora support.', 403);
    const m = ctx.query.get('m');
    let initial: string | null = null;
    if (m && /^[0-9a-f-]{36}$/.test(m)) {
      const ok = await maybeOne(db, 'select 1 from loyalty_memberships where id = $1 and business_id = $2', [m, b.id]);
      if (ok) initial = m;
    }
    return render(ctx, <TerminalPage biz={b} initialMemberId={initial} />, { title: ctx.t.terminal.title, noindex: true });
  });

  /** Opened by scanning a customer's QR with the device's own camera app. */
  r.get('/t/m/:token', async (ctx) => {
    const b = await requireBusiness(ctx);
    if (isReply(b)) return b;
    const check = verifyMemberToken(ctx.params.token);
    if (!check.ok) return redirect(ctx, '/terminal', { type: 'error', message: ctx.t.terminal.invalidCode });
    const m = await maybeOne(db, 'select 1 from loyalty_memberships where id = $1 and business_id = $2', [check.membershipId, b.id]);
    if (!m) return redirect(ctx, '/terminal', { type: 'error', message: ctx.t.terminal.otherCafe });
    return redirect(ctx, `/terminal?m=${check.membershipId}`);
  });

  r.post('/api/terminal/lookup', async (ctx) => {
    const biz = await terminalBiz(ctx);
    await rateLimit(`lookup:${ctx.user!.id}`, 90, 60);
    const body = ((await readBody(ctx)).json ?? {}) as Record<string, unknown>;
    const token = typeof body.token === 'string' ? extractToken(body.token) : null;
    let membershipId: string | null = null;
    if (token) {
      const check = verifyMemberToken(token);
      if (!check.ok) throw new DomainError(check.reason === 'expired' ? 'token_expired' : 'invalid_token', ctx.t.terminal.invalidCode, 422);
      const m = await maybeOne<{ business_id: string }>(db, 'select business_id from loyalty_memberships where id = $1', [check.membershipId]);
      if (!m) throw new DomainError('not_found', ctx.t.terminal.notFound, 404);
      if (m.business_id !== biz.id) throw new DomainError('other_cafe' as any, ctx.t.terminal.otherCafe, 404);
      membershipId = check.membershipId;
    } else if (typeof body.code === 'string' && body.code.trim()) {
      const code = body.code.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (code.length !== 8) throw new DomainError('not_found', ctx.t.terminal.notFound, 404);
      const m = await maybeOne<{ id: string }>(db, `select id from loyalty_memberships where member_code = $1 and business_id = $2`, [code, biz.id]);
      if (!m) throw new DomainError('not_found', ctx.t.terminal.notFound, 404);
      membershipId = m.id;
    } else if (typeof body.contact === 'string' && body.contact.trim()) {
      const c = body.contact.trim().toLowerCase();
      const phone = c.replace(/[^0-9+]/g, '');
      const rows = await many<{ id: string }>(
        db,
        `select m.id from loyalty_memberships m join customers cu on cu.id = m.customer_id
          where m.business_id = $1 and m.status = 'active'
            and (lower(cu.email) = $2 or ($3 <> '' and length($3) >= 6 and regexp_replace(coalesce(cu.phone, ''), '[^0-9+]', '', 'g') = $3))
          limit 2`,
        [biz.id, c, phone],
      );
      if (rows.length !== 1) throw new DomainError('not_found', ctx.t.terminal.notFound, 404);
      membershipId = rows[0].id;
    } else throw new DomainError('validation', ctx.t.terminal.notFound, 422);
    return json({ member: await memberSummary(ctx, biz, membershipId) });
  });

  r.get('/api/terminal/member/:id', async (ctx) => {
    const biz = await terminalBiz(ctx);
    if (!/^[0-9a-f-]{36}$/.test(ctx.params.id)) throw notFound('Member');
    const m = await maybeOne(db, 'select 1 from loyalty_memberships where id = $1 and business_id = $2', [ctx.params.id, biz.id]);
    if (!m) throw notFound('Member');
    return json({ member: await memberSummary(ctx, biz, ctx.params.id) });
  });

  r.post('/api/terminal/award', async (ctx) => {
    const biz = await terminalBiz(ctx);
    await rateLimit(`award:${ctx.user!.id}`, 60, 60);
    const body = parse(awardSchema, (await readBody(ctx)).json);
    const programme = await maybeOne<{ programme_type: string; config: any }>(db, 'select programme_type, config from loyalty_programmes where id = $1 and business_id = $2', [
      body.programmeId,
      biz.id,
    ]);
    if (!programme) throw notFound('Loyalty programme');
    let amountMinor: number | undefined;
    if (body.amount) {
      const parsed = parseMoneyToMinor(body.amount);
      if (parsed === null) throw new DomainError('invalid_amount', 'Enter the amount as a number, for example 4.50.', 422);
      amountMinor = parsed;
    }
    const result = await tx((q) =>
      awardPurchase(q, {
        businessId: biz.id,
        membershipId: body.membershipId,
        programmeId: body.programmeId,
        actorUserId: ctx.user!.id,
        idempotencyKey: body.idempotencyKey,
        quantity: body.quantity,
        amountMinor,
        currency: body.currency,
        referenceId: body.referenceId,
        usedOtherPromotion: body.usedOtherPromotion,
        confirmSeparatePurchase: body.confirmSeparatePurchase,
        source: 'terminal',
      }),
    );
    return json({ result, member: await memberSummary(ctx, biz, body.membershipId) });
  });

  r.post('/api/terminal/redeem', async (ctx) => {
    const biz = await terminalBiz(ctx);
    await rateLimit(`redeem:${ctx.user!.id}`, 40, 60);
    const body = parse(redeemSchema, (await readBody(ctx)).json);
    const result =
      body.kind === 'voucher'
        ? await tx((q) =>
            redeemVoucher(q, { businessId: biz.id, membershipId: body.membershipId, customerRewardId: body.customerRewardId ?? '', actorUserId: ctx.user!.id, idempotencyKey: body.idempotencyKey }),
          )
        : await tx((q) => redeemPoints(q, { businessId: biz.id, membershipId: body.membershipId, rewardId: body.rewardId ?? '', actorUserId: ctx.user!.id, idempotencyKey: body.idempotencyKey }));
    return json({ result, member: await memberSummary(ctx, biz, body.membershipId) });
  });

  r.get('/api/terminal/recent', async (ctx) => {
    const biz = await terminalBiz(ctx);
    const today = localDate(new Date(), biz.timezone);
    const rows = await many<any>(
      db,
      `select t.id, t.description, t.points_delta, t.stamps_delta, t.created_at, c.name
         from loyalty_transactions t
         join loyalty_memberships m on m.id = t.membership_id
         join customers c on c.id = m.customer_id
        where t.business_id = $1 and t.source in ('terminal') and t.created_at >= (($2::date)::timestamp at time zone $3)
        order by t.created_at desc limit 12`,
      [biz.id, today, biz.timezone],
    );
    return json({
      items: rows.map((r) => ({ id: r.id, label: r.description, who: shortName(r.name), time: timeOnly(r.created_at, biz.timezone, ctx.locale), delta: r.points_delta || r.stamps_delta })),
    });
  });
}
