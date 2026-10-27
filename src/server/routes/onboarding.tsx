import type { Router } from '../http/router';
import type { Ctx } from '../http/core';
import { field, formObject, readBody, redirect } from '../http/core';
import { render } from '../http/render';
import { db, many, maybeOne, one, tx } from '../db';
import type { Queryable } from '../db';
import { config } from '../config';
import { loadBusinessContext, selectBusiness, planFor } from '../auth/guards';
import { DomainError } from '../domain/errors';
import { emailSchema } from '../domain/accounts';
import { isValidTimezone } from '../../shared/time';
import { qrSvg } from '../../shared/qr/qrcode';
import { detectImage } from './dashboard-settings';
import { OnboardingDone, OnboardingStep1, OnboardingStep2, OnboardingStep3, OnboardingStep4, OnboardingStep5 } from '../../ui/pages/Onboarding';
import crypto from 'node:crypto';

const appUrl = () => config().APP_URL.replace(/\/$/, '');

export function slugify(name: string): string {
  const map: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', İ: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', é: 'e', è: 'e', à: 'a', ô: 'o' };
  const s = name
    .toLowerCase()
    .replace(/[çğıİöşüâéèàô]/g, (c) => map[c] ?? c)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return s.length >= 3 ? s : `cafe-${s || crypto.randomBytes(3).toString('hex')}`;
}

export async function uniqueSlug(q: Queryable, base: string): Promise<string> {
  let slug = base;
  for (let i = 2; i < 200; i++) {
    const ex = await maybeOne(q, 'select 1 from businesses where slug = $1', [slug]);
    if (!ex && !['dashboard', 'admin', 'demo', 'api', 'perkora'].includes(slug)) return slug;
    slug = `${base}-${i}`;
  }
  return `${base}-${crypto.randomBytes(3).toString('hex')}`;
}

async function ownerBusiness(ctx: Ctx) {
  const biz = await loadBusinessContext(ctx);
  if (!biz) return null;
  if (biz.role !== 'owner') throw new DomainError('forbidden', 'Only the café owner can set up the programme.', 403);
  return biz;
}

function summarise(p: any, rewardName: string | null, rewardCost: number | null, currency: string) {
  if (p.programme_type === 'stamps') return `Collect ${p.config.stampsRequired} stamps and receive ${rewardName ?? 'a reward'}`;
  const per = p.config.earnMode === 'per_currency_unit' ? `${p.config.pointsPerUnit} point${p.config.pointsPerUnit === 1 ? '' : 's'} per ${currency === 'EUR' ? '€1' : '₺1'}` : `${p.config.pointsPerPurchase} points per purchase`;
  return rewardName ? `${per}; ${rewardCost} points for ${rewardName}` : per;
}

async function programmeSummaries(bizId: string, currency: string) {
  const progs = await many<any>(db, `select * from loyalty_programmes where business_id = $1 and status <> 'archived' order by created_at`, [bizId]);
  const out = [];
  for (const p of progs) {
    const r = await maybeOne<any>(
      db,
      p.programme_type === 'stamps'
        ? `select name, null::int as cost from rewards where programme_id = $1 and is_card_reward limit 1`
        : `select name, points_cost as cost from rewards where programme_id = $1 and points_cost is not null order by points_cost limit 1`,
      [p.id],
    );
    out.push({ name: p.name, type: p.programme_type, summary: summarise(p, r?.name ?? null, r?.cost ?? null, currency) });
  }
  return out;
}

export function onboardingRoutes(r: Router) {
  r.get('/onboarding', async (ctx) => {
    if (!ctx.user) return redirect(ctx, '/get-started');
    const biz = await ownerBusiness(ctx);
    if (biz && biz.status !== 'onboarding') return redirect(ctx, '/dashboard', undefined, 302);
    const maxStep = biz?.onboardingStep ?? 1;
    const requested = Number(ctx.query.get('step')) || maxStep;
    const step = Math.min(Math.max(1, requested), maxStep);
    if (step === 1 || !biz) {
      const b = biz ? await one<any>(db, 'select * from businesses where id = $1', [biz.id]) : null;
      const values = b
        ? Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v === null ? '' : String(v)]))
        : { owner_name: ctx.user.name, business_email: ctx.user.email, plan: ctx.query.get('plan') ?? '' };
      return render(ctx, <OnboardingStep1 values={values} maxStep={maxStep} />, { title: 'Set up your café', noindex: true });
    }
    const b = await one<any>(db, 'select * from businesses where id = $1', [biz.id]);
    if (step === 2) {
      return render(ctx, <OnboardingStep2 values={{ programme_choice: b.settings?.onboardingChoice ?? 'stamps' }} pointsAllowed={biz.plan.features.features.points} maxStep={maxStep} />, {
        title: 'Loyalty programme',
        noindex: true,
      });
    }
    if (step === 3) {
      const progs = await many<any>(db, `select * from loyalty_programmes where business_id = $1 and status <> 'archived'`, [biz.id]);
      const stamps = progs.find((p) => p.programme_type === 'stamps');
      const points = progs.find((p) => p.programme_type === 'points');
      const values: Record<string, string> = {};
      if (stamps) {
        const card = await maybeOne<any>(db, `select * from rewards where programme_id = $1 and is_card_reward limit 1`, [stamps.id]);
        Object.assign(values, {
          eligiblePurchase: stamps.config.eligiblePurchase,
          stampsRequired: String(stamps.config.stampsRequired),
          allowWithOtherPromotions: stamps.config.allowWithOtherPromotions ? '1' : '',
          rewardName: card?.name ?? '',
          rewardDescription: card?.description ?? '',
          validityDays: card?.validity_days ? String(card.validity_days) : '',
          terms: stamps.terms ?? '',
        });
      }
      if (points) {
        const pr = await maybeOne<any>(db, `select * from rewards where programme_id = $1 and points_cost is not null order by created_at limit 1`, [points.id]);
        Object.assign(values, { pointsPerUnit: String(points.config.pointsPerUnit ?? 1), pointsRewardName: pr?.name ?? '', pointsRewardCost: pr ? String(pr.points_cost) : '', terms: values.terms ?? points.terms ?? '' });
      }
      return render(ctx, <OnboardingStep3 values={values} hasStamps={Boolean(stamps)} hasPoints={Boolean(points)} currency={biz.currency} maxStep={maxStep} />, { title: 'First reward', noindex: true });
    }
    if (step === 4) {
      const url = `${appUrl()}/c/${biz.slug}`;
      return render(ctx, <OnboardingStep4 svg={qrSvg(url, { ecc: 'Q' })} url={url} slug={biz.slug} maxStep={maxStep} />, { title: 'QR code', noindex: true });
    }
    const card = await maybeOne<any>(db, `select p.config from loyalty_programmes p where p.business_id = $1 and p.programme_type = 'stamps' limit 1`, [biz.id]);
    return render(ctx, <OnboardingStep5 cafe={{ ...b, stamps_required: card?.config?.stampsRequired ?? 9 }} programmes={await programmeSummaries(biz.id, biz.currency)} plan={biz.plan.name} maxStep={maxStep} />, {
      title: 'Review',
      noindex: true,
    });
  });

  /* ---------- step 1: business information (creates the café) */
  r.post('/onboarding/1', async (ctx) => {
    if (!ctx.user) return redirect(ctx, '/get-started');
    let biz = await ownerBusiness(ctx);
    if (biz && biz.status !== 'onboarding') return redirect(ctx, '/dashboard');
    const body = await readBody(ctx, 2 * 1024 * 1024);
    const v = formObject(body);
    const errors: Record<string, string> = {};
    if (!v.name?.trim()) errors.name = 'Enter your café’s name.';
    if (!v.owner_name?.trim()) errors.owner_name = 'Enter the owner’s name.';
    if (!emailSchema.safeParse(v.business_email).success) errors.business_email = 'Enter a valid email address.';
    if (!v.city?.trim()) errors.city = 'Enter the city.';
    if (v.phone?.trim() && !/^[+0-9 ()-]{6,40}$/.test(v.phone.trim())) errors.phone = 'Enter a valid phone number.';
    if (v.website?.trim() && !/^https?:\/\/\S+$/.test(v.website.trim())) errors.website = 'Enter a full address starting with https://';
    const hex = /^#[0-9a-fA-F]{6}$/;
    const primary = hex.test(v.primary_colour) ? v.primary_colour : '#3B2925';
    const secondary = hex.test(v.secondary_colour) ? v.secondary_colour : '#B86F52';
    const logo = body.files.find((f) => f.field === 'logo');
    let logoType: string | null = null;
    if (logo) {
      logoType = detectImage(logo.data);
      if (!logoType) errors.logo = 'Upload a PNG, JPEG or WebP image.';
      else if (logo.data.length > 1024 * 1024) errors.logo = 'The image is larger than 1 MB.';
    }
    if (Object.keys(errors).length) return render(ctx, <OnboardingStep1 values={v} errors={errors} maxStep={biz?.onboardingStep ?? 1} />, { title: 'Set up your café', status: 422, noindex: true });
    const tz = isValidTimezone(v.timezone) ? v.timezone : 'Asia/Famagusta';
    const currency = v.default_currency === 'TRY' ? 'TRY' : 'EUR';
    const planId = ['starter', 'growth', 'premium'].includes(v.plan) ? v.plan : 'growth';
    const bizId = await tx(async (q) => {
      let id: string;
      const cols = [v.name.trim(), v.owner_name.trim(), v.business_email.trim().toLowerCase(), v.phone?.trim() || null, v.city.trim(), v.address?.trim() || null, v.website?.trim() || null, primary, secondary, tz, currency];
      if (!biz) {
        const slug = await uniqueSlug(q, slugify(v.name));
        id = (
          await one<{ id: string }>(
            q,
            `insert into businesses (name, owner_name, business_email, phone, city, address, website, primary_colour, secondary_colour, timezone, default_currency, slug, owner_user_id, status, onboarding_step)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'onboarding',2) returning id`,
            [...cols, slug, ctx.user!.id],
          )
        ).id;
        await q.query(`insert into business_members (business_id, user_id, role) values ($1, $2, 'owner')`, [id, ctx.user!.id]);
        await q.query(`insert into subscriptions (business_id, plan_id, status, payment_status, trial_ends_at) values ($1, $2, 'trialing', 'not_collected', now() + interval '30 days')`, [id, planId]);
        await q.query(`insert into audit_logs (business_id, actor_user_id, action, target_type, target_id) values ($1, $2, 'business.created', 'business', $3)`, [id, ctx.user!.id, id]);
      } else {
        id = biz.id;
        await q.query(
          `update businesses set name=$1, owner_name=$2, business_email=$3, phone=$4, city=$5, address=$6, website=$7, primary_colour=$8, secondary_colour=$9, timezone=$10, default_currency=$11, updated_at=now() where id=$12`,
          [...cols, id],
        );
      }
      if (logo && logoType) {
        const up = await one<{ id: string }>(
          q,
          `insert into uploads (business_id, uploaded_by, purpose, content_type, byte_size, sha256, data) values ($1,$2,'logo',$3,$4,$5,$6) returning id`,
          [id, ctx.user!.id, logoType, logo.data.length, crypto.createHash('sha256').update(logo.data).digest('hex'), logo.data],
        );
        await q.query('update businesses set logo_upload_id = $2 where id = $1', [id, up.id]);
      }
      return id;
    });
    selectBusiness(ctx, bizId);
    return redirect(ctx, '/onboarding?step=2');
  });

  /* ---------- step 2: programme choice (creates programmes with sensible defaults) */
  r.post('/onboarding/2', async (ctx) => {
    const biz = await ownerBusiness(ctx);
    if (!biz) return redirect(ctx, '/onboarding');
    let choice = field(await readBody(ctx), 'programme_choice');
    if (!['stamps', 'points', 'both'].includes(choice)) choice = 'stamps';
    if (choice !== 'stamps' && !biz.plan.features.features.points) choice = 'stamps';
    await tx(async (q) => {
      const existing = await many<any>(q, `select id, programme_type from loyalty_programmes where business_id = $1`, [biz.id]);
      const want = new Set(choice === 'both' ? ['stamps', 'points'] : [choice]);
      for (const p of existing) {
        await q.query(`update loyalty_programmes set status = $2, updated_at = now() where id = $1`, [p.id, want.has(p.programme_type) ? 'active' : 'archived']);
      }
      if (want.has('stamps') && !existing.some((p) => p.programme_type === 'stamps')) {
        const p = await one<{ id: string }>(
          q,
          `insert into loyalty_programmes (business_id, name, programme_type, config) values ($1, 'Coffee Club', 'stamps', $2) returning id`,
          [biz.id, { stampsRequired: 9, eligiblePurchase: 'Any handcrafted coffee drink', maxStampsPerTransaction: 2, allowWithOtherPromotions: false }],
        );
        await q.query(`insert into rewards (business_id, programme_id, name, reward_type, icon, stamps_cost, is_card_reward, validity_days) values ($1,$2,'Free Regular Coffee','free_item','coffee',9,true,30)`, [biz.id, p.id]);
      }
      if (want.has('points') && !existing.some((p) => p.programme_type === 'points')) {
        const p = await one<{ id: string }>(
          q,
          `insert into loyalty_programmes (business_id, name, programme_type, config) values ($1, 'Coffee Points', 'points', $2) returning id`,
          [biz.id, { earnMode: 'per_currency_unit', pointsPerUnit: 1, pointsPerPurchase: 10, minSpendMinor: 0, maxPointsPerTransaction: 500, eligiblePurchase: 'Any purchase', allowWithOtherPromotions: false }],
        );
        await q.query(`insert into rewards (business_id, programme_id, name, reward_type, icon, points_cost) values ($1,$2,'Free Coffee Upgrade','free_upgrade','cup',40)`, [biz.id, p.id]);
      }
      await q.query(`update businesses set onboarding_step = greatest(onboarding_step, 3), settings = settings || $2, updated_at = now() where id = $1`, [biz.id, { onboardingChoice: choice }]);
    });
    return redirect(ctx, '/onboarding?step=3');
  });

  /* ---------- step 3: first reward */
  r.post('/onboarding/3', async (ctx) => {
    const biz = await ownerBusiness(ctx);
    if (!biz) return redirect(ctx, '/onboarding');
    const v = formObject(await readBody(ctx));
    const progs = await many<any>(db, `select * from loyalty_programmes where business_id = $1 and status = 'active'`, [biz.id]);
    const stamps = progs.find((p) => p.programme_type === 'stamps');
    const points = progs.find((p) => p.programme_type === 'points');
    const errors: Record<string, string> = {};
    const n = (s: string) => (/^\d+$/.test(s ?? '') ? Number(s) : NaN);
    if (stamps) {
      if (!(n(v.stampsRequired) >= 2 && n(v.stampsRequired) <= 30)) errors.stampsRequired = 'Choose between 2 and 30 stamps.';
      if (!v.rewardName?.trim()) errors.rewardName = 'Describe the reward.';
      if (!v.eligiblePurchase?.trim() || v.eligiblePurchase.trim().length < 2) errors.eligiblePurchase = 'Say which purchases earn a stamp.';
      if (v.validityDays?.trim() && !(n(v.validityDays) >= 1 && n(v.validityDays) <= 730)) errors.validityDays = 'Enter 1–730 days or leave empty.';
    }
    if (points) {
      if (!(n(v.pointsPerUnit) >= 1 && n(v.pointsPerUnit) <= 100)) errors.pointsPerUnit = 'Enter 1–100.';
      if (!v.pointsRewardName?.trim()) errors.pointsRewardName = 'Name a reward.';
      if (!(n(v.pointsRewardCost) >= 1)) errors.pointsRewardCost = 'Enter a points cost.';
    }
    if (Object.keys(errors).length)
      return render(ctx, <OnboardingStep3 values={v} errors={errors} hasStamps={Boolean(stamps)} hasPoints={Boolean(points)} currency={biz.currency} maxStep={biz.onboardingStep} />, { title: 'First reward', status: 422, noindex: true });
    await tx(async (q) => {
      if (stamps) {
        const cfg = { ...stamps.config, stampsRequired: n(v.stampsRequired), eligiblePurchase: v.eligiblePurchase.trim(), allowWithOtherPromotions: v.allowWithOtherPromotions === '1' };
        await q.query(`update loyalty_programmes set config = $2, terms = $3, updated_at = now() where id = $1`, [stamps.id, cfg, v.terms?.trim() || null]);
        await q.query(`update rewards set name = $2, description = $3, stamps_cost = $4, validity_days = $5, updated_at = now() where programme_id = $1 and is_card_reward`, [
          stamps.id,
          v.rewardName.trim(),
          v.rewardDescription?.trim() || null,
          n(v.stampsRequired),
          v.validityDays?.trim() ? n(v.validityDays) : null,
        ]);
      }
      if (points) {
        await q.query(`update loyalty_programmes set config = $2, terms = coalesce($3, terms), updated_at = now() where id = $1`, [points.id, { ...points.config, pointsPerUnit: n(v.pointsPerUnit) }, stamps ? null : v.terms?.trim() || null]);
        const pr = await maybeOne<{ id: string }>(q, `select id from rewards where programme_id = $1 and points_cost is not null order by created_at limit 1`, [points.id]);
        if (pr) await q.query(`update rewards set name = $2, points_cost = $3, updated_at = now() where id = $1`, [pr.id, v.pointsRewardName.trim(), n(v.pointsRewardCost)]);
      }
      await q.query(`update businesses set onboarding_step = greatest(onboarding_step, 4), updated_at = now() where id = $1`, [biz.id]);
    });
    return redirect(ctx, '/onboarding?step=4');
  });

  r.post('/onboarding/4', async (ctx) => {
    const biz = await ownerBusiness(ctx);
    if (!biz) return redirect(ctx, '/onboarding');
    await db.query(`update businesses set onboarding_step = greatest(onboarding_step, 5), updated_at = now() where id = $1`, [biz.id]);
    return redirect(ctx, '/onboarding?step=5');
  });

  r.post('/onboarding/5', async (ctx) => {
    const biz = await ownerBusiness(ctx);
    if (!biz) return redirect(ctx, '/onboarding');
    if (biz.status === 'onboarding') {
      const progs = await one<{ n: number }>(db, `select count(*)::int as n from loyalty_programmes where business_id = $1 and status = 'active'`, [biz.id]);
      if (!progs.n) return redirect(ctx, '/onboarding?step=2', { type: 'error', message: 'Choose a loyalty programme first.' });
      await db.query(`update businesses set status = 'active', activated_at = now(), onboarding_step = 6, updated_at = now() where id = $1 and status = 'onboarding'`, [biz.id]);
      await db.query(`insert into audit_logs (business_id, actor_user_id, action, target_type, target_id) values ($1, $2, 'business.activated', 'business', $3)`, [biz.id, ctx.user!.id, biz.id]);
    }
    return redirect(ctx, '/onboarding/done');
  });

  r.get('/onboarding/done', async (ctx) => {
    if (!ctx.user) return redirect(ctx, '/sign-in');
    const biz = await ownerBusiness(ctx);
    if (!biz) return redirect(ctx, '/onboarding');
    if (biz.status === 'onboarding') return redirect(ctx, '/onboarding');
    const cafe = await one<any>(db, 'select * from businesses where id = $1', [biz.id]);
    const url = `${appUrl()}/c/${cafe.slug}`;
    return render(ctx, <OnboardingDone cafe={cafe} url={url} svg={qrSvg(url, { ecc: 'Q' })} programmes={await programmeSummaries(biz.id, biz.currency)} />, { title: 'You’re live', noindex: true });
  });
}

export { planFor };
