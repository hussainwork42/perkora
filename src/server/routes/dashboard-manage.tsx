import type { Router } from '../http/router';
import type { Ctx } from '../http/core';
import { field, fieldAll, formObject, readBody, redirect } from '../http/core';
import { render } from '../http/render';
import { db, many, maybeOne, one, tx } from '../db';
import { assertCan, assertFeature, hasFeature, type BusinessContext } from '../auth/guards';
import { DomainError, notFound } from '../domain/errors';
import { distributeCampaignVouchers } from '../domain/loyalty';
import { campaignPerformance } from '../domain/analytics';
import { isSegment, paramBuilder, segmentPredicate } from '../domain/segments';
import { loadRunningOffers, type OfferView } from '../domain/views';
import { pointsConfigSchema, stampConfigSchema, referralConfigSchema, type Grant } from '../../shared/schemas';
import { isDateStr, localDate } from '../../shared/time';
import { parseMoneyToMinor } from '../../shared/format';
import { withBiz, audit, csvReply } from './dashboard-core';
import {
  CAMPAIGN_TYPE_LABEL,
  CampaignDetailPage,
  CampaignFormPage,
  CampaignsPage,
  ChallengeFormPage,
  ProgrammeFormPage,
  ProgrammesPage,
  RewardFormPage,
  RewardsPage,
} from '../../ui/pages/dashboard/Manage';
import { OfferCard } from '../../ui/pages/customer/parts';
import { ReferralsPage } from '../../ui/pages/dashboard/Referrals';
import { loadReferralProgramme, referralStats, saveReferralProgramme } from '../domain/referrals';
import type { Reply } from '../http/core';

const UUID = /^[0-9a-f-]{36}$/;
const int = (s: string | undefined) => (s && /^-?\d+$/.test(s.trim()) ? Number(s) : null);
const dateOrNull = (s: string | undefined) => (s && isDateStr(s) ? s : null);
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));

async function programmesFor(biz: BusinessContext) {
  return many<{ id: string; name: string; programme_type: string }>(
    db,
    `select id, name, programme_type from loyalty_programmes where business_id = $1 and status <> 'archived' order by created_at`,
    [biz.id],
  );
}
async function grantRewardsFor(biz: BusinessContext) {
  return many<{ id: string; name: string }>(
    db,
    `select id, name from rewards where business_id = $1 and status = 'active' and not is_card_reward and points_cost is null order by name`,
    [biz.id],
  );
}

function displayStatus(c: { status: string; start_date: string; end_date: string | null }, today: string) {
  if (c.status !== 'published') return c.status;
  if (c.start_date > today) return 'scheduled';
  if (c.end_date && c.end_date < today) return 'completed';
  return 'active';
}

async function benefitLabel(biz: BusinessContext, c: any): Promise<string> {
  if (c.campaign_type === 'referral') return 'Referral rewards';
  const b = c.benefit ?? {};
  if (b.kind === 'voucher') {
    const r = await maybeOne<{ name: string }>(db, 'select name from rewards where id = $1 and business_id = $2', [b.rewardId, biz.id]);
    return r?.name ?? 'Reward';
  }
  if (b.kind === 'bonus') {
    const p = await maybeOne<{ name: string; programme_type: string }>(db, 'select name, programme_type from loyalty_programmes where id = $1', [b.programmeId]);
    const unit = p?.programme_type === 'stamps' ? 'stamp' : 'point';
    return b.mode === 'multiplier' ? `${b.amount}× ${unit}s` : `+${b.amount} ${unit}${b.amount === 1 ? '' : 's'}`;
  }
  return 'Information only';
}


/** Plain-English description of a referral reward, for the dashboard. */
async function grantText(biz: BusinessContext, g: { kind: string; rewardId?: string; programmeId?: string; amount?: number }): Promise<string> {
  if (g.kind === 'none') return 'nothing';
  if (g.kind === 'voucher') {
    const r = await maybeOne<{ name: string }>(db, 'select name from rewards where id = $1 and business_id = $2', [g.rewardId, biz.id]);
    return r ? `a ${r.name}` : 'a reward';
  }
  const p = await maybeOne<{ programme_type: string }>(db, 'select programme_type from loyalty_programmes where id = $1 and business_id = $2', [g.programmeId, biz.id]);
  const n = g.amount ?? 0;
  return p?.programme_type === 'points' ? `${n} points` : `${n} ${n === 1 ? 'stamp' : 'stamps'}`;
}

async function referralsPage(ctx: Ctx, biz: BusinessContext, values?: Record<string, string>, errors: Record<string, string> = {}, status = 200): Promise<Reply> {
  const locked = !hasFeature(biz, 'referrals');
  const programmes = await many<{ id: string; name: string; programme_type: string }>(
    db,
    `select id, name, programme_type from loyalty_programmes where business_id = $1 and status = 'active' order by created_at`,
    [biz.id],
  );
  const rewards = await grantRewardsFor(biz);
  const current = await loadReferralProgramme(db, biz.id);
  const stats = await referralStats(db, biz.id);
  if (!values) {
    const c = current?.config;
    const fromGrant = (prefix: string, g: any): Record<string, string> =>
      !g
        ? {}
        : g.kind === 'voucher'
          ? { [`${prefix}_kind`]: 'voucher', [`${prefix}_reward`]: g.rewardId }
          : g.kind === 'bonus'
            ? { [`${prefix}_kind`]: 'bonus', [`${prefix}_amount`]: String(g.amount), [`${prefix}_programme`]: g.programmeId }
            : { [`${prefix}_kind`]: 'none' };
    values = current
      ? {
          enabled: current.enabled ? '1' : '',
          name: current.name,
          qualify_on: c!.qualifyOn,
          max_per_referrer: String(c!.maxPerReferrer),
          ...fromGrant('referrer', c!.referrerGrant),
          ...fromGrant('referred', c!.referredGrant),
        }
      : { enabled: '', name: 'Bring a friend', qualify_on: 'first_visit', max_per_referrer: '10', referrer_kind: 'bonus', referrer_amount: '1', referred_kind: 'bonus', referred_amount: '1' };
  }
  let summary: string | null = null;
  if (current?.enabled) {
    const mine = await grantText(biz, current.config.referrerGrant);
    const friend = await grantText(biz, current.config.referredGrant);
    summary = `“${current.name}”: invite a friend and get ${mine} ${current.config.qualifyOn === 'join' ? 'as soon as they join' : 'after their first purchase'}.${friend !== 'nothing' ? ` Your friend gets ${friend}.` : ''}`;
  }
  return render(ctx, <ReferralsPage biz={biz} values={values} errors={errors} programmes={programmes} rewards={rewards} stats={stats} summary={summary} locked={locked} />, {
    title: 'Referrals',
    noindex: true,
    status,
  });
}

export function dashboardManageRoutes(r: Router) {
  r.get('/dashboard/referrals', withBiz({ owner: true }, (ctx, biz) => referralsPage(ctx, biz)));
  r.post(
    '/dashboard/referrals',
    withBiz({ owner: true }, async (ctx, biz) => {
      assertFeature(biz, 'referrals', 'Referral rewards');
      const v = formObject(await readBody(ctx));
      const errors: Record<string, string> = {};
      const programmes = await many<{ id: string }>(db, `select id from loyalty_programmes where business_id = $1 and status = 'active'`, [biz.id]);
      const rewards = await grantRewardsFor(biz);
      const grant = (who: 'referrer' | 'referred'): any => {
        const kind = v[`${who}_kind`];
        if (kind === 'none' && who === 'referred') return { kind: 'none' };
        if (kind === 'voucher') {
          if (!rewards.some((r) => r.id === v[`${who}_reward`])) {
            errors[`${who}_reward`] = 'Choose a reward.';
            return null;
          }
          return { kind: 'voucher', rewardId: v[`${who}_reward`] };
        }
        const amount = int(v[`${who}_amount`]) ?? 0;
        if (amount < 1 || amount > 1000) {
          errors[`${who}_amount`] = 'Enter a number from 1 to 1,000.';
          return null;
        }
        if (!programmes.some((p) => p.id === v[`${who}_programme`])) {
          errors.form = 'Choose which stamp card or points programme the reward goes on.';
          return null;
        }
        return { kind: 'bonus', programmeId: v[`${who}_programme`], amount };
      };
      const name = (v.name ?? '').trim() || 'Bring a friend';
      if (name.length > 80) errors.name = 'Use up to 80 characters.';
      const max = int(v.max_per_referrer) ?? 10;
      if (max < 1 || max > 100) errors.max_per_referrer = 'Enter a number from 1 to 100.';
      const enabled = v.enabled === '1';
      let config: any = null;
      if (!programmes.length) {
        if (enabled) errors.form = 'Set up a stamp card or points programme first.';
      } else {
        const rg = grant('referrer');
        const dg = grant('referred');
        const parsed = referralConfigSchema.safeParse({ referrerGrant: rg, referredGrant: dg, maxPerReferrer: max, qualifyOn: v.qualify_on === 'join' ? 'join' : 'first_visit' });
        if (parsed.success) config = parsed.data;
        else if (!Object.keys(errors).length) errors.form = 'Check the referral rewards.';
      }
      if (Object.keys(errors).length || !config) return referralsPage(ctx, biz, v, Object.keys(errors).length ? errors : { form: 'Check the referral rewards.' }, 422);
      const id = await tx((q) => saveReferralProgramme(q, biz, { enabled, name, description: null, config }));
      await audit(biz, ctx.user!.id, 'referrals.updated', 'campaign', id, { enabled, qualifyOn: config.qualifyOn });
      return redirect(ctx, '/dashboard/referrals', { type: 'success', message: enabled ? 'Referral rewards are on. Customers can now invite friends from their card.' : 'Referral settings saved. Rewards are off.' });
    }),
  );

  /* ================================================ programmes */
  r.get(
    '/dashboard/programmes',
    withBiz({ owner: true }, async (ctx, biz) => {
      const programmes = await many<any>(
        db,
        `select p.*, (select count(*)::int from membership_balances b where b.programme_id = p.id and b.balance > 0) as members,
                (select name from rewards r where r.programme_id = p.id and r.is_card_reward and r.status <> 'archived' limit 1) as card_reward
           from loyalty_programmes p where p.business_id = $1 order by p.status = 'archived', p.created_at`,
        [biz.id],
      );
      const challenges = await many<any>(
        db,
        `select c.*, coalesce(r.name, '+' || c.bonus_amount || ' ' || coalesce(case when p.programme_type = 'stamps' then 'stamps' else 'points' end, '')) as reward_label,
                (select count(*)::int from challenge_completions cc where cc.challenge_id = c.id) as completions
           from challenges c left join rewards r on r.id = c.reward_id left join loyalty_programmes p on p.id = c.bonus_programme_id
          where c.business_id = $1 order by c.created_at desc`,
        [biz.id],
      );
      const active = programmes.filter((p) => p.status !== 'archived').length;
      return render(
        ctx,
        <ProgrammesPage
          biz={biz}
          programmes={programmes}
          challenges={challenges}
          canAddProgramme={active < biz.plan.features.limits.programmes}
          pointsAllowed={hasFeature(biz, 'points')}
          challengesAllowed={hasFeature(biz, 'challenges')}
        />,
        { title: 'Loyalty Programmes', noindex: true },
      );
    }),
  );

  const programmeForm = async (ctx: Ctx, biz: BusinessContext, mode: 'new' | 'edit', type: 'stamps' | 'points', values: Record<string, string>, errors = {}, status = 200) =>
    render(ctx, <ProgrammeFormPage biz={biz} mode={mode} type={type} values={values} errors={errors} pointsAllowed={hasFeature(biz, 'points')} />, { title: 'Loyalty programme', status, noindex: true });

  r.get(
    '/dashboard/programmes/new',
    withBiz({ owner: true }, async (ctx, biz) => {
      const type = ctx.query.get('type') === 'points' && hasFeature(biz, 'points') ? 'points' : 'stamps';
      return programmeForm(ctx, biz, 'new', type, { name: type === 'stamps' ? 'Coffee Club' : 'Coffee Points', eligiblePurchase: type === 'stamps' ? 'Any handcrafted coffee drink' : 'Any purchase' });
    }),
  );

  r.get(
    '/dashboard/programmes/:id',
    withBiz({ owner: true }, async (ctx, biz) => {
      if (!UUID.test(ctx.params.id)) throw notFound();
      const p = await maybeOne<any>(db, 'select * from loyalty_programmes where id = $1 and business_id = $2', [ctx.params.id, biz.id]);
      if (!p) throw notFound('Programme');
      const card = await maybeOne<any>(db, `select * from rewards where programme_id = $1 and is_card_reward and status <> 'archived' limit 1`, [p.id]);
      const c = p.config;
      const values: Record<string, string> = {
        id: p.id,
        name: p.name,
        terms: p.terms ?? '',
        status: p.status,
        start_date: p.start_date ?? '',
        end_date: p.end_date ?? '',
        eligiblePurchase: c.eligiblePurchase,
        allowWithOtherPromotions: c.allowWithOtherPromotions ? '1' : '',
        stampsRequired: str(c.stampsRequired),
        maxStampsPerTransaction: str(c.maxStampsPerTransaction),
        rewardName: card?.name ?? '',
        rewardDescription: card?.description ?? '',
        rewardIcon: card?.icon ?? 'coffee',
        validityDays: str(card?.validity_days),
        earnMode: c.earnMode ?? '',
        pointsPerUnit: str(c.pointsPerUnit),
        pointsPerPurchase: str(c.pointsPerPurchase),
        maxPointsPerTransaction: str(c.maxPointsPerTransaction),
        minSpend: c.minSpendMinor ? (c.minSpendMinor / 100).toFixed(2) : '',
      };
      return programmeForm(ctx, biz, 'edit', p.programme_type, values);
    }),
  );

  const saveProgramme = (mode: 'new' | 'edit') =>
    withBiz({ owner: true }, async (ctx, biz) => {
      const body = await readBody(ctx);
      const v = formObject(body);
      let existing: any = null;
      if (mode === 'edit') {
        if (!UUID.test(ctx.params.id)) throw notFound();
        existing = await maybeOne<any>(db, 'select * from loyalty_programmes where id = $1 and business_id = $2', [ctx.params.id, biz.id]);
        if (!existing) throw notFound('Programme');
        v.id = existing.id;
      }
      const type: 'stamps' | 'points' = mode === 'edit' ? existing.programme_type : v.programme_type === 'points' ? 'points' : 'stamps';
      if (type === 'points') assertFeature(biz, 'points', 'Points-based loyalty');
      const errors: Record<string, string> = {};
      const name = v.name?.trim() ?? '';
      if (!name || name.length > 80) errors.name = 'Enter a name up to 80 characters.';
      const status = ['active', 'paused', 'archived'].includes(v.status) ? v.status : 'active';
      const start = dateOrNull(v.start_date);
      const end = dateOrNull(v.end_date);
      if (start && end && end < start) errors.end_date = 'The end date must be after the start date.';
      let config: any;
      if (type === 'stamps') {
        const parsed = stampConfigSchema.safeParse({
          stampsRequired: int(v.stampsRequired),
          eligiblePurchase: v.eligiblePurchase,
          maxStampsPerTransaction: int(v.maxStampsPerTransaction) ?? 1,
          allowWithOtherPromotions: v.allowWithOtherPromotions === '1',
        });
        if (!parsed.success) for (const i of parsed.error.issues) errors[String(i.path[0])] ??= i.message.includes('expected number') ? 'Enter a whole number.' : i.message;
        else config = parsed.data;
        if (!v.rewardName?.trim()) errors.rewardName = 'Name the reward for a full card.';
        const vd = v.validityDays?.trim() ? int(v.validityDays) : null;
        if (v.validityDays?.trim() && (!vd || vd < 1 || vd > 730)) errors.validityDays = 'Enter 1–730 days, or leave empty.';
      } else {
        const minSpend = v.minSpend?.trim() ? parseMoneyToMinor(v.minSpend) : 0;
        if (minSpend === null) errors.minSpend = 'Enter an amount like 5.00';
        const parsed = pointsConfigSchema.safeParse({
          earnMode: v.earnMode === 'per_purchase' ? 'per_purchase' : 'per_currency_unit',
          pointsPerUnit: int(v.pointsPerUnit) ?? 1,
          pointsPerPurchase: int(v.pointsPerPurchase) ?? 10,
          minSpendMinor: minSpend ?? 0,
          maxPointsPerTransaction: int(v.maxPointsPerTransaction) ?? 500,
          eligiblePurchase: v.eligiblePurchase,
          allowWithOtherPromotions: v.allowWithOtherPromotions === '1',
        });
        if (!parsed.success) for (const i of parsed.error.issues) errors[String(i.path[0])] ??= i.message;
        else config = parsed.data;
      }
      if (mode === 'new' && status !== 'archived') {
        const active = await one<{ n: number }>(db, `select count(*)::int as n from loyalty_programmes where business_id = $1 and status <> 'archived'`, [biz.id]);
        if (active.n >= biz.plan.features.limits.programmes) errors.form = `Your ${biz.plan.name} plan includes ${biz.plan.features.limits.programmes} programme${biz.plan.features.limits.programmes === 1 ? '' : 's'}. Archive one or change plan.`;
      }
      if (Object.keys(errors).length) return programmeForm(ctx, biz, mode, type, v, errors, 422);
      const id = await tx(async (q) => {
        let pid: string;
        if (mode === 'new') {
          pid = (
            await one<{ id: string }>(
              q,
              `insert into loyalty_programmes (business_id, name, programme_type, config, terms, status, start_date, end_date) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
              [biz.id, name, type, config, v.terms?.trim() || null, status, start, end],
            )
          ).id;
        } else {
          pid = existing.id;
          await q.query(`update loyalty_programmes set name = $3, config = $4, terms = $5, status = $6, start_date = $7, end_date = $8, updated_at = now() where id = $1 and business_id = $2`, [
            pid,
            biz.id,
            name,
            config,
            v.terms?.trim() || null,
            status,
            start,
            end,
          ]);
        }
        if (type === 'stamps') {
          const card = await maybeOne<{ id: string }>(q, `select id from rewards where programme_id = $1 and is_card_reward and status <> 'archived' limit 1`, [pid]);
          const vd = v.validityDays?.trim() ? int(v.validityDays) : null;
          if (card) {
            await q.query(`update rewards set name = $2, description = $3, icon = $4, validity_days = $5, stamps_cost = $6, updated_at = now() where id = $1`, [
              card.id,
              v.rewardName.trim(),
              v.rewardDescription?.trim() || null,
              v.rewardIcon || 'coffee',
              vd,
              config.stampsRequired,
            ]);
          } else {
            await q.query(
              `insert into rewards (business_id, programme_id, name, description, reward_type, icon, stamps_cost, is_card_reward, validity_days) values ($1,$2,$3,$4,'free_item',$5,$6,true,$7)`,
              [biz.id, pid, v.rewardName.trim(), v.rewardDescription?.trim() || null, v.rewardIcon || 'coffee', config.stampsRequired, vd],
            );
          }
        }
        return pid;
      });
      await audit(biz, ctx.user!.id, mode === 'new' ? 'programme.created' : 'programme.updated', 'loyalty_programme', id, { name, status });
      return redirect(ctx, '/dashboard/programmes', { type: 'success', message: mode === 'new' ? `${name} created.` : `${name} saved.` });
    });
  r.post('/dashboard/programmes/new', saveProgramme('new'));
  r.post('/dashboard/programmes/:id', saveProgramme('edit'));

  /* ================================================ challenges */
  const challengeForm = async (ctx: Ctx, biz: BusinessContext, mode: 'new' | 'edit', values: Record<string, string>, errors = {}, status = 200) =>
    render(
      ctx,
      <ChallengeFormPage biz={biz} mode={mode} values={values} errors={errors} rewards={await grantRewardsFor(biz)} programmes={await programmesFor(biz)} segmentsAllowed={hasFeature(biz, 'segments')} />,
      { title: 'Visit challenge', status, noindex: true },
    );

  r.get(
    '/dashboard/challenges/new',
    withBiz({ owner: true }, async (ctx, biz) => {
      assertFeature(biz, 'challenges', 'Visit streaks');
      const today = localDate(new Date(), biz.timezone);
      return challengeForm(ctx, biz, 'new', { start_date: today, end_date: `${Number(today.slice(0, 4)) + 0}-12-31` });
    }),
  );
  r.get(
    '/dashboard/challenges/:id',
    withBiz({ owner: true }, async (ctx, biz) => {
      if (!UUID.test(ctx.params.id)) throw notFound();
      const c = await maybeOne<any>(db, 'select * from challenges where id = $1 and business_id = $2', [ctx.params.id, biz.id]);
      if (!c) throw notFound('Challenge');
      return challengeForm(ctx, biz, 'edit', Object.fromEntries(Object.entries(c).map(([k, v]) => [k, str(v)])));
    }),
  );
  const saveChallenge = (mode: 'new' | 'edit') =>
    withBiz({ owner: true }, async (ctx, biz) => {
      assertFeature(biz, 'challenges', 'Visit streaks');
      const v = formObject(await readBody(ctx));
      let existingId: string | null = null;
      if (mode === 'edit') {
        const ex = await maybeOne<{ id: string; status: string }>(db, 'select id, status from challenges where id = $1 and business_id = $2', [ctx.params.id, biz.id]);
        if (!ex) throw notFound('Challenge');
        existingId = ex.id;
        v.id = ex.id;
      }
      const errors: Record<string, string> = {};
      if (!v.name?.trim()) errors.name = 'Enter a name.';
      const required = int(v.required_count);
      if (!required || required < 1 || required > 100) errors.required_count = 'Enter 1–100.';
      const start = dateOrNull(v.start_date);
      const end = dateOrNull(v.end_date);
      if (!start) errors.start_date = 'Choose a start date.';
      if (!end) errors.end_date = 'Choose an end date.';
      if (start && end && end < start) errors.end_date = 'The end date must be after the start date.';
      const kind = v.reward_kind === 'bonus' ? 'bonus' : 'voucher';
      if (kind === 'voucher' && !UUID.test(v.reward_id ?? '')) errors.reward_id = 'Choose a reward.';
      const bonus = int(v.bonus_amount);
      if (kind === 'bonus' && (!bonus || bonus < 1 || !UUID.test(v.bonus_programme_id ?? ''))) errors.bonus_amount = 'Enter a bonus amount and programme.';
      if (kind === 'voucher' && UUID.test(v.reward_id ?? '')) {
        const ok = await maybeOne(db, 'select 1 from rewards where id = $1 and business_id = $2', [v.reward_id, biz.id]);
        if (!ok) errors.reward_id = 'Choose a reward.';
      }
      if (kind === 'bonus' && UUID.test(v.bonus_programme_id ?? '')) {
        const ok = await maybeOne(db, 'select 1 from loyalty_programmes where id = $1 and business_id = $2', [v.bonus_programme_id, biz.id]);
        if (!ok) errors.bonus_amount = 'Choose a programme.';
      }
      const segment = isSegment(v.eligible_segment) && (v.eligible_segment === 'all' || hasFeature(biz, 'segments')) ? v.eligible_segment : 'all';
      const status = ['draft', 'active', 'paused', 'ended'].includes(v.status) ? v.status : 'draft';
      if (Object.keys(errors).length) return challengeForm(ctx, biz, mode, v, errors, 422);
      const vals = [
        biz.id,
        v.name.trim(),
        v.description?.trim() || null,
        v.rule_type === 'visit_count' ? 'visit_count' : 'distinct_days',
        required,
        ['week', 'month', 'campaign'].includes(v.period) ? v.period : 'week',
        start,
        end,
        kind,
        kind === 'voucher' ? v.reward_id : null,
        kind === 'bonus' ? v.bonus_programme_id : null,
        kind === 'bonus' ? bonus : null,
        Math.max(1, Math.min(520, int(v.max_completions_per_customer) ?? 1)),
        segment,
        v.visibility === 'invite_only' ? 'invite_only' : 'public',
        status,
      ];
      const id = await tx(async (q) => {
        let cid: string;
        if (mode === 'new') {
          cid = (
            await one<{ id: string }>(
              q,
              `insert into challenges (business_id, name, description, rule_type, required_count, period, start_date, end_date, reward_kind, reward_id, bonus_programme_id, bonus_amount, max_completions_per_customer, eligible_segment, visibility, status)
               values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) returning id`,
              vals,
            )
          ).id;
        } else {
          cid = existingId!;
          await q.query(
            `update challenges set name=$2, description=$3, rule_type=$4, required_count=$5, period=$6, start_date=$7, end_date=$8, reward_kind=$9, reward_id=$10, bonus_programme_id=$11, bonus_amount=$12,
               max_completions_per_customer=$13, eligible_segment=$14, visibility=$15, status=$16, updated_at=now() where id=$17 and business_id=$1`,
            [...vals, cid],
          );
        }
        if (vals[14] === 'invite_only' && status === 'active') {
          const { params, p } = paramBuilder([biz.id, cid]);
          const pred = segmentPredicate(segment as any, biz.settings, new Date(), p);
          await q.query(
            `insert into challenge_enrolments (challenge_id, membership_id) select $2, m.id from loyalty_memberships m where m.business_id = $1 and m.status = 'active' and ${pred} on conflict do nothing`,
            params,
          );
        }
        return cid;
      });
      await audit(biz, ctx.user!.id, mode === 'new' ? 'challenge.created' : 'challenge.updated', 'challenge', id, { status });
      return redirect(ctx, '/dashboard/programmes', { type: 'success', message: 'Challenge saved.' });
    });
  r.post('/dashboard/challenges/new', saveChallenge('new'));
  r.post('/dashboard/challenges/:id', saveChallenge('edit'));

  /* ================================================ rewards */
  r.get(
    '/dashboard/rewards',
    withBiz({ perm: 'manage_rewards' }, async (ctx, biz) => {
      const rewards = await many<any>(
        db,
        `select r.*, p.name as programme_name,
           (select count(*)::int from customer_rewards cr where cr.reward_id = r.id and cr.status <> 'void') as issued,
           (select count(*)::int from reward_redemptions rr where rr.reward_id = r.id and rr.status = 'completed') as redeemed
         from rewards r left join loyalty_programmes p on p.id = r.programme_id
         where r.business_id = $1 and r.status <> 'archived' order by r.is_card_reward desc, r.points_cost nulls last, r.name`,
        [biz.id],
      );
      return render(ctx, <RewardsPage biz={biz} rewards={rewards} />, { title: 'Rewards', noindex: true });
    }),
  );

  const pointsProgs = (biz: BusinessContext) =>
    many<{ id: string; name: string }>(db, `select id, name from loyalty_programmes where business_id = $1 and programme_type = 'points' and status <> 'archived' order by created_at`, [biz.id]);

  const rewardForm = async (ctx: Ctx, biz: BusinessContext, mode: 'new' | 'edit', values: Record<string, string>, errors = {}, status = 200, stats: any = null) =>
    render(ctx, <RewardFormPage biz={biz} mode={mode} values={values} errors={errors} pointsProgrammes={await pointsProgs(biz)} stats={stats} />, { title: 'Reward', status, noindex: true });

  r.get('/dashboard/rewards/new', withBiz({ perm: 'manage_rewards' }, async (ctx, biz) => rewardForm(ctx, biz, 'new', { icon: 'gift' })));
  r.get(
    '/dashboard/rewards/:id',
    withBiz({ perm: 'manage_rewards' }, async (ctx, biz) => {
      if (!UUID.test(ctx.params.id)) throw notFound();
      const rw = await maybeOne<any>(db, 'select * from rewards where id = $1 and business_id = $2', [ctx.params.id, biz.id]);
      if (!rw) throw notFound('Reward');
      if (rw.is_card_reward && rw.programme_id) return redirect(ctx, `/dashboard/programmes/${rw.programme_id}`, undefined, 302);
      const stats = await one<any>(
        db,
        `select count(*) filter (where status <> 'void')::int as issued, count(*) filter (where status = 'redeemed')::int as redeemed,
                count(*) filter (where status = 'available' and (expires_at is null or expires_at > now()))::int as available
           from customer_rewards where reward_id = $1`,
        [rw.id],
      );
      const values = Object.fromEntries(Object.entries(rw).map(([k, v]) => [k, str(v)]));
      values.kind = rw.points_cost ? 'points' : 'grant';
      return rewardForm(ctx, biz, 'edit', values, {}, 200, stats);
    }),
  );
  const saveReward = (mode: 'new' | 'edit') =>
    withBiz({ perm: 'manage_rewards' }, async (ctx, biz) => {
      const v = formObject(await readBody(ctx));
      let existing: any = null;
      if (mode === 'edit') {
        existing = await maybeOne<any>(db, 'select * from rewards where id = $1 and business_id = $2', [ctx.params.id, biz.id]);
        if (!existing || existing.is_card_reward) throw notFound('Reward');
        v.id = existing.id;
        v.kind = existing.points_cost ? 'points' : 'grant';
      }
      const errors: Record<string, string> = {};
      if (!v.name?.trim() || v.name.trim().length > 80) errors.name = 'Enter a name up to 80 characters.';
      const kind = v.kind === 'points' ? 'points' : 'grant';
      let programmeId: string | null = null;
      let cost: number | null = null;
      if (kind === 'points') {
        assertFeature(biz, 'points', 'Points rewards');
        cost = int(v.points_cost);
        if (!cost || cost < 1 || cost > 100000) errors.points_cost = 'Enter a points cost between 1 and 100,000.';
        const prog = UUID.test(v.programme_id ?? '') ? await maybeOne<{ id: string }>(db, `select id from loyalty_programmes where id = $1 and business_id = $2 and programme_type = 'points'`, [v.programme_id, biz.id]) : null;
        if (!prog) errors.points_cost = 'Choose a points programme.';
        programmeId = prog?.id ?? null;
      }
      const start = dateOrNull(v.start_date);
      const end = dateOrNull(v.end_date);
      if (start && end && end < start) errors.end_date = 'The end date must be after the start date.';
      if (Object.keys(errors).length) return rewardForm(ctx, biz, mode, v, errors, 422);
      const validity = int(v.validity_days);
      const vals = [
        biz.id,
        programmeId,
        v.name.trim(),
        v.description?.trim() || null,
        ['free_item', 'discount', 'free_upgrade', 'custom'].includes(v.reward_type) ? v.reward_type : 'custom',
        v.icon || 'gift',
        cost,
        validity && validity > 0 && validity <= 730 ? validity : null,
        start,
        end,
        int(v.per_customer_limit) && int(v.per_customer_limit)! > 0 ? int(v.per_customer_limit) : null,
        int(v.total_limit) && int(v.total_limit)! > 0 ? int(v.total_limit) : null,
        v.terms?.trim() || null,
        ['active', 'inactive', 'archived'].includes(v.status) ? v.status : 'active',
      ];
      let id: string;
      if (mode === 'new') {
        id = (
          await one<{ id: string }>(
            db,
            `insert into rewards (business_id, programme_id, name, description, reward_type, icon, points_cost, validity_days, start_date, end_date, per_customer_limit, total_limit, terms, status)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) returning id`,
            vals,
          )
        ).id;
      } else {
        id = existing.id;
        await db.query(
          `update rewards set programme_id=$2, name=$3, description=$4, reward_type=$5, icon=$6, points_cost=$7, validity_days=$8, start_date=$9, end_date=$10, per_customer_limit=$11, total_limit=$12, terms=$13, status=$14, updated_at=now()
           where id=$15 and business_id=$1`,
          [...vals, id],
        );
      }
      await audit(biz, ctx.user!.id, mode === 'new' ? 'reward.created' : 'reward.updated', 'reward', id, { name: v.name });
      return redirect(ctx, '/dashboard/rewards', { type: 'success', message: `${v.name.trim()} saved.` });
    });
  r.post('/dashboard/rewards/new', saveReward('new'));
  r.post('/dashboard/rewards/:id', saveReward('edit'));

  /* ================================================ campaigns */
  r.get(
    '/dashboard/campaigns',
    withBiz({ perm: 'manage_rewards' }, async (ctx, biz) => {
      const allowed = hasFeature(biz, 'campaigns');
      const today = localDate(new Date(), biz.timezone);
      const perf = allowed ? await campaignPerformance(db, biz.id) : [];
      const rows = [];
      for (const c of perf) {
        rows.push({ ...c, display_status: displayStatus(c, today), benefit_label: await benefitLabel(biz, c) });
      }
      return render(ctx, <CampaignsPage biz={biz} campaigns={rows} allowed={allowed} />, { title: 'Campaigns', noindex: true });
    }),
  );

  const campaignForm = async (ctx: Ctx, biz: BusinessContext, mode: 'new' | 'edit', values: Record<string, string>, errors = {}, status = 200) =>
    render(
      ctx,
      <CampaignFormPage
        biz={biz}
        mode={mode}
        values={values}
        errors={errors}
        rewards={await grantRewardsFor(biz)}
        programmes={await programmesFor(biz)}
        flexible={hasFeature(biz, 'flexibleCampaignRules')}
        segmentsAllowed={hasFeature(biz, 'segments')}
        referralsAllowed={hasFeature(biz, 'referrals')}
      />,
      { title: 'Campaign', status, noindex: true },
    );

  r.get(
    '/dashboard/campaigns/new',
    withBiz({ perm: 'manage_rewards' }, async (ctx, biz) => {
      assertFeature(biz, 'campaigns', 'Campaigns');
      return campaignForm(ctx, biz, 'new', { start_date: localDate(new Date(), biz.timezone), campaign_type: ctx.query.get('type') ?? 'weekday' });
    }),
  );

  function campaignToValues(c: any): Record<string, string> {
    const v: Record<string, string> = Object.fromEntries(Object.entries(c).map(([k, x]) => [k, typeof x === 'object' ? '' : str(x)]));
    v.benefit_kind = c.benefit?.kind ?? 'none';
    v.benefit_reward = c.benefit?.rewardId ?? '';
    v.benefit_programme = c.benefit?.programmeId ?? '';
    v.benefit_mode = c.benefit?.mode ?? 'flat';
    v.benefit_amount = str(c.benefit?.amount ?? 1);
    v.weekdays = (c.eligibility?.weekdays ?? []).join(',');
    v.start_time = c.eligibility?.startTime ?? '';
    v.end_time = c.eligibility?.endTime ?? '';
    v.is_public = c.is_public ? '1' : '0';
    v.window_days = str(c.config?.windowDays ?? 7);
    for (const who of ['referrer', 'referred'] as const) {
      const g = c.config?.[`${who}Grant`];
      if (g) {
        v[`${who}_kind`] = g.kind;
        v[`${who}_amount`] = str(g.amount ?? 1);
        v[`${who}_programme`] = g.programmeId ?? '';
        v[`${who}_reward`] = g.rewardId ?? '';
      }
    }
    v.max_per_referrer = str(c.config?.maxPerReferrer ?? 5);
    return v;
  }

  r.get(
    '/dashboard/campaigns/:id/edit',
    withBiz({ perm: 'manage_rewards' }, async (ctx, biz) => {
      if (!UUID.test(ctx.params.id)) throw notFound();
      const c = await maybeOne<any>(db, 'select * from campaigns where id = $1 and business_id = $2', [ctx.params.id, biz.id]);
      if (!c) throw notFound('Campaign');
      return campaignForm(ctx, biz, 'edit', campaignToValues(c));
    }),
  );

  const saveCampaign = (mode: 'new' | 'edit') =>
    withBiz({ perm: 'manage_rewards' }, async (ctx, biz) => {
      assertFeature(biz, 'campaigns', 'Campaigns');
      const body = await readBody(ctx);
      const v = formObject(body);
      v.weekdays = fieldAll(body, 'weekday').join(',');
      let existing: any = null;
      if (mode === 'edit') {
        existing = await maybeOne<any>(db, 'select * from campaigns where id = $1 and business_id = $2', [ctx.params.id, biz.id]);
        if (!existing) throw notFound('Campaign');
        v.id = existing.id;
      }
      const errors: Record<string, string> = {};
      const type = (Object.keys(CAMPAIGN_TYPE_LABEL) as string[]).includes(v.campaign_type) ? v.campaign_type : 'custom';
      if (type === 'referral') assertFeature(biz, 'referrals', 'Referral campaigns');
      if (!v.name?.trim() || v.name.trim().length > 80) errors.name = 'Enter a name up to 80 characters.';
      const start = dateOrNull(v.start_date);
      const end = dateOrNull(v.end_date);
      if (!start) errors.start_date = 'Choose a start date.';
      if (start && end && end < start) errors.end_date = 'The end date must be after the start date.';
      const progs = await programmesFor(biz);
      const rewards = await grantRewardsFor(biz);
      const progOk = (id: string) => progs.some((p) => p.id === id);
      const rewardOk = (id: string) => rewards.some((r) => r.id === id);
      let benefit: any = { kind: 'none' };
      const amount = int(v.benefit_amount) ?? 0;
      if (type !== 'referral') {
        if (v.benefit_kind === 'voucher') {
          if (!rewardOk(v.benefit_reward)) errors.benefit_reward = 'Choose a reward (create one under Rewards first).';
          benefit = { kind: 'voucher', rewardId: v.benefit_reward };
        } else if (v.benefit_kind === 'bonus') {
          if (!progOk(v.benefit_programme)) errors.benefit_programme = 'Choose a programme.';
          if (amount < 1 || amount > 10000) errors.benefit_amount = 'Enter a bonus between 1 and 10,000.';
          if (v.benefit_mode === 'multiplier' && amount < 2) errors.benefit_amount = 'A multiplier must be 2 or more.';
          benefit = { kind: 'bonus', programmeId: v.benefit_programme, mode: v.benefit_mode === 'multiplier' ? 'multiplier' : 'flat', amount };
          if (['welcome', 'birthday'].includes(type) && benefit.mode === 'multiplier') errors.benefit_amount = 'Welcome and birthday bonuses must be a fixed amount.';
        }
        if (['birthday', 'win_back', 'limited_time'].includes(type) && benefit.kind === 'bonus' && type === 'birthday') errors.benefit_reward = 'Birthday offers give a reward. Choose one.';
      }
      let config: any = {};
      if (type === 'birthday') config.windowDays = Math.max(0, Math.min(31, int(v.window_days) ?? 7));
      if (type === 'referral') {
        const grant = (who: 'referrer' | 'referred'): Grant | null => {
          if (v[`${who}_kind`] === 'voucher') return rewardOk(v[`${who}_reward`]) ? { kind: 'voucher', rewardId: v[`${who}_reward`] } : null;
          const a = int(v[`${who}_amount`]) ?? 0;
          return progOk(v[`${who}_programme`]) && a > 0 ? { kind: 'bonus', programmeId: v[`${who}_programme`], amount: a } : null;
        };
        const rg = grant('referrer');
        const dg = grant('referred');
        if (!rg || !dg) errors.form = 'Set a valid reward for both the inviting member and the new member.';
        const parsed = referralConfigSchema.safeParse({ referrerGrant: rg, referredGrant: dg, maxPerReferrer: int(v.max_per_referrer) ?? 5 });
        if (parsed.success) config = parsed.data;
        else if (!errors.form) errors.form = 'Check the referral settings.';
      }
      const weekdays = v.weekdays
        .split(',')
        .map(Number)
        .filter((d) => d >= 1 && d <= 7);
      const eligibility: any = {};
      if (weekdays.length && weekdays.length < 7) eligibility.weekdays = weekdays;
      if (hasFeature(biz, 'flexibleCampaignRules')) {
        if (/^\d{2}:\d{2}$/.test(v.start_time ?? '')) eligibility.startTime = v.start_time;
        if (/^\d{2}:\d{2}$/.test(v.end_time ?? '')) eligibility.endTime = v.end_time;
        if (eligibility.startTime && eligibility.endTime && eligibility.endTime <= eligibility.startTime) errors.form = 'The end time must be after the start time.';
      }
      const segment = isSegment(v.target_segment) && (v.target_segment === 'all' || hasFeature(biz, 'segments')) ? v.target_segment : 'all';
      if (Object.keys(errors).length) return campaignForm(ctx, biz, mode, v, errors, 422);
      const vals = [
        biz.id,
        v.name.trim(),
        v.description?.trim() || null,
        type,
        start,
        end,
        segment,
        benefit,
        eligibility,
        config,
        int(v.usage_limit_per_customer) && int(v.usage_limit_per_customer)! > 0 ? int(v.usage_limit_per_customer) : null,
        int(v.total_limit) && int(v.total_limit)! > 0 ? int(v.total_limit) : null,
        v.redemption_instructions?.trim() || null,
        v.is_public === '1',
      ];
      let id: string;
      if (mode === 'new') {
        id = (
          await one<{ id: string }>(
            db,
            `insert into campaigns (business_id, name, description, campaign_type, start_date, end_date, target_segment, benefit, eligibility, config, usage_limit_per_customer, total_limit, redemption_instructions, is_public, status)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'draft') returning id`,
            vals,
          )
        ).id;
      } else {
        id = existing.id;
        await db.query(
          `update campaigns set name=$2, description=$3, campaign_type=$4, start_date=$5, end_date=$6, target_segment=$7, benefit=$8, eligibility=$9, config=$10,
             usage_limit_per_customer=$11, total_limit=$12, redemption_instructions=$13, is_public=$14, updated_at=now() where id=$15 and business_id=$1`,
          [...vals, id],
        );
      }
      await audit(biz, ctx.user!.id, mode === 'new' ? 'campaign.created' : 'campaign.updated', 'campaign', id, { type });
      return redirect(ctx, `/dashboard/campaigns/${id}`, { type: 'success', message: mode === 'new' ? 'Draft saved. Review the preview, then publish.' : 'Campaign saved.' });
    });
  r.post('/dashboard/campaigns/new', saveCampaign('new'));
  r.post('/dashboard/campaigns/:id/edit', saveCampaign('edit'));

  async function eligibleQuery(biz: BusinessContext, segment: string, extra = 'true') {
    const { params, p } = paramBuilder([biz.id]);
    const pred = segmentPredicate(isSegment(segment) ? segment : 'all', biz.settings, new Date(), p);
    return { sql: `from loyalty_memberships m join customers c on c.id = m.customer_id where m.business_id = $1 and m.status = 'active' and ${pred} and ${extra}`, params };
  }

  r.get(
    '/dashboard/campaigns/:id',
    withBiz({ perm: 'manage_rewards' }, async (ctx, biz) => {
      if (!UUID.test(ctx.params.id)) throw notFound();
      const c = await maybeOne<any>(db, 'select * from campaigns where id = $1 and business_id = $2', [ctx.params.id, biz.id]);
      if (!c) throw notFound('Campaign');
      const today = localDate(new Date(), biz.timezone);
      c.display_status = displayStatus(c, today);
      const perf = (await campaignPerformance(db, biz.id)).find((x) => x.id === c.id);
      const e = await eligibleQuery(biz, c.target_segment);
      const eligible = (await one<{ n: number }>(db, `select count(*)::int as n ${e.sql}`, e.params)).n;
      let contacts = null;
      if (c.campaign_type === 'win_back' || c.target_segment === 'inactive') {
        const q2 = await eligibleQuery(biz, c.target_segment, 'm.marketing_consent and (c.email is not null or c.phone is not null)');
        contacts = await many<any>(db, `select c.name, c.email, c.phone, m.last_visit_at ${q2.sql} order by m.last_visit_at desc nulls last limit 500`, q2.params);
      }
      const offer: OfferView = {
        id: c.id,
        name: c.name,
        description: c.description,
        type: c.campaign_type,
        startDate: c.start_date,
        endDate: c.end_date,
        weekdays: c.eligibility?.weekdays ?? null,
        startTime: c.eligibility?.startTime ?? null,
        endTime: c.eligibility?.endTime ?? null,
        instructions: c.redemption_instructions,
        benefit: c.benefit,
        segment: c.target_segment,
      };
      let publishBlock: string | null = null;
      if (c.status !== 'published') {
        const running = await one<{ n: number }>(
          db,
          `select count(*)::int as n from campaigns where business_id = $1 and status = 'published' and campaign_type <> 'referral' and (end_date is null or end_date >= $2) and id <> $3`,
          [biz.id, today, c.id],
        );
        if (running.n >= biz.plan.features.limits.activeCampaigns)
          publishBlock = `Your ${biz.plan.name} plan allows ${biz.plan.features.limits.activeCampaigns} running campaign${biz.plan.features.limits.activeCampaigns === 1 ? '' : 's'}. End one to publish this.`;
        if (c.end_date && c.end_date < today) publishBlock = 'This campaign’s end date has passed. Edit the dates to publish it.';
      }
      return render(
        ctx,
        <CampaignDetailPage
          biz={biz}
          c={c}
          offerPreview={<OfferCard o={offer} tz={biz.timezone} />}
          perf={perf ?? { viewers: 0, vouchers_issued: 0, bonuses: 0, bonus_total: 0, redeemed: 0, referrals_qualified: 0, referrals_started: 0 }}
          contacts={contacts}
          eligible={eligible}
          canPublish={!publishBlock}
          publishBlock={publishBlock}
        />,
        { title: c.name, noindex: true },
      );
    }),
  );

  r.post(
    '/dashboard/campaigns/:id/status',
    withBiz({ perm: 'manage_rewards' }, async (ctx, biz) => {
      const c = await maybeOne<any>(db, 'select * from campaigns where id = $1 and business_id = $2', [ctx.params.id, biz.id]);
      if (!c) throw notFound('Campaign');
      const next = field(await readBody(ctx), 'status');
      if (!['published', 'paused', 'completed'].includes(next)) throw new DomainError('validation', 'Unknown status', 422);
      const today = localDate(new Date(), biz.timezone);
      if (next === 'published') {
        assertFeature(biz, 'campaigns', 'Campaigns');
        if (c.end_date && c.end_date < today) return redirect(ctx, `/dashboard/campaigns/${c.id}`, { type: 'error', message: 'The end date has passed. Edit the dates first.' });
        const running = await one<{ n: number }>(
          db,
          `select count(*)::int as n from campaigns where business_id = $1 and status = 'published' and campaign_type <> 'referral' and (end_date is null or end_date >= $2) and id <> $3`,
          [biz.id, today, c.id],
        );
        if (running.n >= biz.plan.features.limits.activeCampaigns) return redirect(ctx, `/dashboard/campaigns/${c.id}`, { type: 'error', message: 'Your plan’s running-campaign limit has been reached.' });
        if (c.campaign_type === 'referral') {
          const other = await maybeOne(db, `select 1 from campaigns where business_id = $1 and campaign_type = 'referral' and status = 'published' and id <> $2 and (end_date is null or end_date >= $3)`, [biz.id, c.id, today]);
          if (other) return redirect(ctx, `/dashboard/campaigns/${c.id}`, { type: 'error', message: 'Only one referral campaign can run at a time.' });
        }
      }
      await db.query(`update campaigns set status = $3, published_at = case when $3 = 'published' then coalesce(published_at, now()) else published_at end, updated_at = now() where id = $1 and business_id = $2`, [
        c.id,
        biz.id,
        next,
      ]);
      await audit(biz, ctx.user!.id, `campaign.${next}`, 'campaign', c.id);
      const msg = next === 'published' ? (c.start_date > today ? 'Published. It becomes active on its start date.' : 'Published. Customers can see it now.') : next === 'paused' ? 'Campaign paused.' : 'Campaign ended.';
      return redirect(ctx, `/dashboard/campaigns/${c.id}`, { type: 'success', message: msg });
    }),
  );

  r.post(
    '/dashboard/campaigns/:id/delete',
    withBiz({ perm: 'manage_rewards' }, async (ctx, biz) => {
      const r2 = await db.query(`delete from campaigns where id = $1 and business_id = $2 and status = 'draft'`, [ctx.params.id, biz.id]);
      if (!r2.rowCount) return redirect(ctx, `/dashboard/campaigns/${ctx.params.id}`, { type: 'error', message: 'Only drafts can be deleted. End the campaign instead.' });
      await audit(biz, ctx.user!.id, 'campaign.deleted', 'campaign', ctx.params.id);
      return redirect(ctx, '/dashboard/campaigns', { type: 'success', message: 'Draft deleted.' });
    }),
  );

  r.post(
    '/dashboard/campaigns/:id/distribute',
    withBiz({ perm: 'manage_rewards' }, async (ctx, biz) => {
      try {
        const res = await tx((q) => distributeCampaignVouchers(q, { businessId: biz.id, campaignId: ctx.params.id, actorUserId: ctx.user!.id }));
        await audit(biz, ctx.user!.id, 'campaign.distributed', 'campaign', ctx.params.id, { issued: res.issued });
        return redirect(ctx, `/dashboard/campaigns/${ctx.params.id}`, {
          type: 'success',
          message: res.issued ? `Reward added to ${res.issued} card${res.issued === 1 ? '' : 's'}.` : 'No new members to add the reward to.',
        });
      } catch (e) {
        if (e instanceof DomainError) return redirect(ctx, `/dashboard/campaigns/${ctx.params.id}`, { type: 'error', message: e.message });
        throw e;
      }
    }),
  );

  r.get(
    '/dashboard/campaigns/:id/contacts.csv',
    withBiz({ owner: true }, async (ctx, biz) => {
      const c = await maybeOne<any>(db, 'select * from campaigns where id = $1 and business_id = $2', [ctx.params.id, biz.id]);
      if (!c) throw notFound('Campaign');
      const q2 = await eligibleQuery(biz, c.target_segment, 'm.marketing_consent');
      const rows = await many<any>(db, `select c.name, c.email, c.phone, m.last_visit_at ${q2.sql} order by c.name`, q2.params);
      await audit(biz, ctx.user!.id, 'export.campaign_contacts', 'campaign', c.id, { count: rows.length });
      return csvReply(`perkora-${c.campaign_type}-contacts.csv`, ['name', 'email', 'phone', 'last_visit_at'], rows.map((r) => [r.name, r.email, r.phone, r.last_visit_at]));
    }),
  );
}

export { assertCan, loadRunningOffers };
