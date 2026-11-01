import crypto from 'node:crypto';
import type { Router } from '../http/router';
import type { Ctx, Reply } from '../http/core';
import { field, fieldAll, formObject, json, readBody, redirect, reply } from '../http/core';
import { render } from '../http/render';
import { db, many, maybeOne, one, tx } from '../db';
import { config } from '../config';
import { notFound } from '../domain/errors';
import { DomainError } from '../domain/errors';
import { createUser, changePassword, deleteCustomerAccount, ensureCustomerForUser, nameSchema, passwordSchema, signUpSchema } from '../domain/accounts';
import { joinBusiness, maybeIssueBirthdayReward } from '../domain/loyalty';
import { loadCafeBySlug, loadMemberView, loadProgrammes, loadRunningOffers, type PublicCafe } from '../domain/views';
import { issueMemberToken, memberScanUrl } from '../domain/qrtoken';
import { planFor } from '../auth/guards';
import { createSession, destroyAllSessions, destroySession } from '../auth/session';
import { rateLimit } from '../auth/ratelimit';
import { qrSvg } from '../../shared/qr/qrcode';
import { localDate } from '../../shared/time';
import { referralConfigSchema } from '../../shared/schemas';
import { SEGMENT_LABELS, isSegment, memberInSegment } from '../domain/segments';
import { fmt, plural } from '../../shared/i18n';
import { formatMemberCode } from '../../shared/format';
import { zodErrors } from './marketing';
import {
  AccountPage,
  CafePublicPage,
  WalletActivityPage,
  WalletCardPage,
  WalletCodePage,
  WalletListPage,
  WalletOffersPage,
  WalletReferPage,
  WalletRewardsPage,
} from '../../ui/pages/customer/CustomerPages';
import type { WalletCafe } from '../../ui/layouts/WalletLayout';
import { randomCode } from '../auth/crypto';

function walletCafe(c: PublicCafe): WalletCafe {
  return {
    name: c.name,
    slug: c.slug,
    logoUrl: c.logoUrl,
    bannerUrl: c.bannerUrl,
    primaryColour: c.primaryColour,
    secondaryColour: c.secondaryColour,
    layout: c.settings.pageLayout,
    tagline: c.settings.tagline,
    stampIcon: c.settings.stampIcon,
    isDemo: c.isDemo,
  };
}

async function referralSetup(cafe: PublicCafe) {
  const plan = await planFor(cafe.id);
  if (!plan.features.features.referrals) return null;
  const today = localDate(new Date(), cafe.timezone);
  const c = await maybeOne<any>(
    db,
    `select id, config from campaigns where business_id = $1 and campaign_type = 'referral' and status = 'published'
       and start_date <= $2 and (end_date is null or end_date >= $2) order by created_at limit 1`,
    [cafe.id, today],
  );
  if (!c) return null;
  const cfg = referralConfigSchema.safeParse(c.config);
  if (!cfg.success) return null;
  return cfg.data;
}

async function describeGrant(businessId: string, g: { kind: string; rewardId?: string; programmeId?: string; amount?: number }, locale: 'en' | 'tr') {
  if (g.kind === 'none') return '';
  if (g.kind === 'voucher') {
    const r = await maybeOne<{ name: string }>(db, 'select name from rewards where id = $1 and business_id = $2', [g.rewardId, businessId]);
    return r?.name ?? '';
  }
  const p = await maybeOne<{ programme_type: string }>(db, 'select programme_type from loyalty_programmes where id = $1 and business_id = $2', [g.programmeId, businessId]);
  const tmpl = p?.programme_type === 'stamps' ? (locale === 'tr' ? '{n} damga' : '{n} stamp|{n} stamps') : locale === 'tr' ? '{n} puan' : '{n} points';
  return plural(tmpl, g.amount ?? 0);
}

async function membershipFor(ctx: Ctx, cafe: PublicCafe): Promise<string | null> {
  if (!ctx.user) return null;
  const r = await maybeOne<{ id: string }>(
    db,
    `select m.id from loyalty_memberships m join customers c on c.id = m.customer_id
      where m.business_id = $1 and c.user_id = $2 and m.status = 'active'`,
    [cafe.id, ctx.user.id],
  );
  return r?.id ?? null;
}

async function cafePage(ctx: Ctx, cafe: PublicCafe, extra: { errors?: Record<string, string>; values?: Record<string, string>; status?: number } = {}): Promise<Reply> {
  const today = localDate(new Date(), cafe.timezone);
  const programmes = await loadProgrammes(db, cafe.id, today);
  const offers = cafe.settings.showOffersPublicly ? await loadRunningOffers(db, cafe.id, today, { publicOnly: true }) : [];
  let state: 'guest' | 'signed-in' | 'member' | 'unavailable' = 'guest';
  if (cafe.status !== 'active' || programmes.length === 0) state = 'unavailable';
  else if (ctx.user) state = (await membershipFor(ctx, cafe)) ? 'member' : 'signed-in';
  let referral: { code: string; valid: boolean; on: 'join' | 'first_visit'; friendReward: string } | null = null;
  const ref = (ctx.query.get('ref') ?? extra.values?.ref ?? '').trim().toUpperCase();
  if (ref && /^[A-Z2-9]{6,10}$/.test(ref)) {
    const ok = await maybeOne(db, `select 1 from loyalty_memberships where business_id = $1 and referral_code = $2 and status = 'active'`, [cafe.id, ref]);
    const cfg = ok ? await referralSetup(cafe) : null;
    referral = { code: ref, valid: Boolean(ok), on: cfg?.qualifyOn ?? 'first_visit', friendReward: cfg ? await describeGrant(cafe.id, cfg.referredGrant, ctx.locale) : '' };
  }
  return render(
    ctx,
    <CafePublicPage cafe={cafe} programmes={programmes} offers={offers} state={state} errors={extra.errors} values={extra.values} referral={referral} />,
    { title: fmt(ctx.t.cafe.joinTitle, { cafe: cafe.name }), description: cafe.description ?? undefined, status: extra.status, themeColor: cafe.primaryColour },
  );
}

async function requireCafe(slug: string): Promise<PublicCafe> {
  const cafe = await loadCafeBySlug(db, slug);
  if (!cafe) throw notFound('Café');
  return cafe;
}

async function joinAndRedirect(ctx: Ctx, cafe: PublicCafe, marketing: boolean, ref: string | null, source: 'qr' | 'demo' = 'qr') {
  const userRow = { id: ctx.user!.id, name: ctx.user!.name, email: ctx.user!.email };
  await tx(async (q) => {
    const customerId = await ensureCustomerForUser(q, userRow);
    await joinBusiness(q, { businessId: cafe.id, customerId, source: ref ? 'referral' : source, marketingConsent: marketing, referralCode: ref });
  });
  return redirect(ctx, `/wallet/${cafe.slug}?welcome=1`);
}

/** Load everything a wallet page needs, or redirect to the café's join page. */
async function walletCtx(ctx: Ctx): Promise<Reply | { cafe: PublicCafe; membershipId: string; referralsOn: boolean }> {
  if (!ctx.user) return redirect(ctx, `/sign-in?next=${encodeURIComponent(ctx.path)}`);
  const cafe = await requireCafe(ctx.params.slug);
  if (cafe.status !== 'active') return cafePage(ctx, cafe);
  const membershipId = await membershipFor(ctx, cafe);
  if (!membershipId) return redirect(ctx, `/c/${cafe.slug}`);
  const referralsOn = Boolean(await referralSetup(cafe));
  return { cafe, membershipId, referralsOn };
}

/** Only offers whose target group includes this member. */
async function offersForMember(cafe: PublicCafe, membershipId: string) {
  const offers = await loadRunningOffers(db, cafe.id, localDate(new Date(), cafe.timezone));
  const out = [];
  for (const o of offers) {
    if (o.segment === 'all' || (isSegment(o.segment) && (await memberInSegment(db, cafe.id, membershipId, o.segment, cafe.settings, new Date())))) out.push(o);
  }
  return out;
}

function isReplyLike(v: any): v is Reply {
  return v && typeof v === 'object' && 'status' in v && 'body' in v;
}

export function customerRoutes(r: Router) {
  /* ------------------------------ public café */
  r.get('/c/:slug', async (ctx) => cafePage(ctx, await requireCafe(ctx.params.slug)));

  r.post('/c/:slug/join', async (ctx) => {
    const cafe = await requireCafe(ctx.params.slug);
    if (cafe.status !== 'active') return cafePage(ctx, cafe);
    const body = await readBody(ctx);
    const marketing = field(body, 'marketing') === '1';
    const ref = field(body, 'ref').trim().toUpperCase() || null;
    if (ctx.user) return joinAndRedirect(ctx, cafe, marketing, ref);
    const values = formObject(body);
    const parsed = signUpSchema.safeParse(values);
    if (!parsed.success) return cafePage(ctx, cafe, { errors: zodErrors(parsed.error), values, status: 422 });
    try {
      await rateLimit(`signup:${ctx.ip}`, 10, 3600);
    } catch (e) {
      if (e instanceof DomainError) return cafePage(ctx, cafe, { errors: { form: ctx.t.errors.tooMany }, values, status: 429 });
      throw e;
    }
    let userId: string;
    try {
      userId = (await tx((q) => createUser(q, { ...parsed.data, locale: ctx.locale }))).id;
    } catch (e) {
      if (e instanceof DomainError && e.code === 'conflict') return cafePage(ctx, cafe, { errors: { email: ctx.t.auth.emailTaken }, values, status: 409 });
      throw e;
    }
    await createSession(ctx, userId);
    ctx.user = { id: userId, name: parsed.data.name, email: parsed.data.email, platformRole: null, locale: ctx.locale, isDemo: false };
    return joinAndRedirect(ctx, cafe, marketing, ref);
  });

  r.post('/c/:slug/demo-join', async (ctx) => {
    const cafe = await requireCafe(ctx.params.slug);
    if (!cafe.isDemo || !config().DEMO_MODE) throw notFound();
    await rateLimit(`demo-join:${ctx.ip}`, 30, 3600);
    const n = crypto.randomInt(1000, 9999);
    const name = `Demo Guest ${n}`;
    const email = `guest-${randomCode(6).toLowerCase()}@demo.perkora.invalid`;
    const userId = (await tx((q) => createUser(q, { name, email, password: crypto.randomBytes(18).toString('base64url'), locale: ctx.locale, isDemo: true }))).id;
    await createSession(ctx, userId);
    ctx.user = { id: userId, name, email, platformRole: null, locale: ctx.locale, isDemo: true };
    return joinAndRedirect(ctx, cafe, false, null, 'demo');
  });

  r.get('/c/:slug/qr.svg', async (ctx) => {
    const cafe = await requireCafe(ctx.params.slug);
    const url = `${config().APP_URL.replace(/\/$/, '')}/c/${cafe.slug}`;
    const svg = qrSvg(url, { ecc: 'Q', title: `${cafe.name} loyalty programme` });
    const headers: Record<string, string> = { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'public, max-age=3600' };
    if (ctx.query.get('download')) headers['content-disposition'] = `attachment; filename="${cafe.slug}-loyalty-qr.svg"`;
    return reply(200, svg, headers);
  });

  r.get('/media/:id', async (ctx) => {
    if (!/^[0-9a-f-]{36}$/.test(ctx.params.id)) throw notFound();
    const u = await maybeOne<{ content_type: string; data: Buffer; sha256: string }>(db, 'select content_type, data, sha256 from uploads where id = $1', [ctx.params.id]);
    if (!u) throw notFound();
    return reply(200, u.data, {
      'content-type': u.content_type,
      'cache-control': 'public, max-age=86400',
      etag: `"${u.sha256.slice(0, 16)}"`,
      'content-security-policy': "default-src 'none'",
    });
  });

  /* ------------------------------ wallet */
  r.get('/wallet', async (ctx) => {
    if (!ctx.user) return redirect(ctx, '/sign-in?next=/wallet');
    const rows = await many<any>(
      db,
      `select b.slug, b.name, b.logo_upload_id, b.primary_colour, m.id as membership_id,
              (select count(*)::int from customer_rewards cr where cr.membership_id = m.id and cr.status = 'available' and (cr.expires_at is null or cr.expires_at > now())) as ready,
              (select string_agg(case when lp.programme_type = 'stamps' then mb.balance || '/' || (lp.config->>'stampsRequired') || ' ' || lp.name else mb.balance || ' pts' end, ' · ' order by lp.programme_type desc)
                 from membership_balances mb join loyalty_programmes lp on lp.id = mb.programme_id and lp.status = 'active' where mb.membership_id = m.id) as summary
         from loyalty_memberships m
         join customers c on c.id = m.customer_id
         join businesses b on b.id = m.business_id
        where c.user_id = $1 and m.status = 'active' and b.status = 'active'
        order by m.last_visit_at desc nulls last, m.joined_at desc`,
      [ctx.user.id],
    );
    return render(
      ctx,
      <WalletListPage
        items={rows.map((r) => ({ slug: r.slug, name: r.name, logoUrl: r.logo_upload_id ? `/media/${r.logo_upload_id}` : null, primaryColour: r.primary_colour, summary: r.summary ?? '', ready: r.ready }))}
      />,
      { title: ctx.t.wallet.title, noindex: true },
    );
  });

  r.get('/wallet/:slug', async (ctx) => {
    const w = await walletCtx(ctx);
    if (isReplyLike(w)) return w;
    await tx((q) => maybeIssueBirthdayReward(q, { businessId: w.cafe.id, membershipId: w.membershipId })).catch(() => undefined);
    const view = (await loadMemberView(db, w.cafe, w.membershipId))!;
    const offers = await offersForMember(w.cafe, w.membershipId);
    const refCfg = w.referralsOn ? await referralSetup(w.cafe) : null;
    const referralPitch = refCfg ? await describeGrant(w.cafe.id, refCfg.referrerGrant, ctx.locale) : null;
    return render(ctx, <WalletCardPage cafe={walletCafe(w.cafe)} view={view} offers={offers} welcome={ctx.query.get('welcome') === '1'} referralsOn={w.referralsOn} referralPitch={referralPitch} tz={w.cafe.timezone} />, {
      title: w.cafe.name,
      noindex: true,
      themeColor: w.cafe.primaryColour,
    });
  });

  r.get('/wallet/:slug/code', async (ctx) => {
    const w = await walletCtx(ctx);
    if (isReplyLike(w)) return w;
    const view = (await loadMemberView(db, w.cafe, w.membershipId, { activityLimit: 1 }))!;
    return render(ctx, <WalletCodePage cafe={walletCafe(w.cafe)} view={view} referralsOn={w.referralsOn} />, { title: ctx.t.wallet.showAtCounter, noindex: true, themeColor: w.cafe.primaryColour });
  });

  r.get('/wallet/:slug/rewards', async (ctx) => {
    const w = await walletCtx(ctx);
    if (isReplyLike(w)) return w;
    const view = (await loadMemberView(db, w.cafe, w.membershipId, { activityLimit: 1 }))!;
    return render(ctx, <WalletRewardsPage cafe={walletCafe(w.cafe)} view={view} referralsOn={w.referralsOn} tz={w.cafe.timezone} />, { title: ctx.t.wallet.tabs.rewards, noindex: true });
  });

  r.get('/wallet/:slug/offers', async (ctx) => {
    const w = await walletCtx(ctx);
    if (isReplyLike(w)) return w;
    const today = localDate(new Date(), w.cafe.timezone);
    const offers = await offersForMember(w.cafe, w.membershipId);
    // record that these offers were viewed (one event per member, offer and day)
    for (const o of offers) {
      await db.query(
        `insert into campaign_events (business_id, campaign_id, membership_id, event_type, dedupe_key)
         values ($1, $2, $3, 'viewed', $4) on conflict do nothing`,
        [w.cafe.id, o.id, w.membershipId, today],
      );
    }
    const labels = Object.fromEntries(Object.entries(SEGMENT_LABELS).map(([k, v]) => [k, v.describe(w.cafe.settings)]));
    return render(ctx, <WalletOffersPage cafe={walletCafe(w.cafe)} offers={offers} referralsOn={w.referralsOn} tz={w.cafe.timezone} segmentLabels={labels} />, { title: ctx.t.wallet.tabs.offers, noindex: true });
  });

  r.get('/wallet/:slug/activity', async (ctx) => {
    const w = await walletCtx(ctx);
    if (isReplyLike(w)) return w;
    const view = (await loadMemberView(db, w.cafe, w.membershipId, { activityLimit: 200 }))!;
    return render(ctx, <WalletActivityPage cafe={walletCafe(w.cafe)} view={view} referralsOn={w.referralsOn} tz={w.cafe.timezone} />, { title: ctx.t.wallet.tabs.activity, noindex: true });
  });

  r.get('/wallet/:slug/refer', async (ctx) => {
    const w = await walletCtx(ctx);
    if (isReplyLike(w)) return w;
    const view = (await loadMemberView(db, w.cafe, w.membershipId, { activityLimit: 1 }))!;
    const cfg = await referralSetup(w.cafe);
    let rewards: { mine: string; friend: string; on: 'join' | 'first_visit'; name: string } | null = null;
    if (cfg) {
      const name = (await maybeOne<{ name: string }>(db, `select name from campaigns where business_id = $1 and campaign_type = 'referral' and status = 'published' order by created_at limit 1`, [w.cafe.id]))?.name ?? '';
      rewards = { mine: await describeGrant(w.cafe.id, cfg.referrerGrant, ctx.locale), friend: await describeGrant(w.cafe.id, cfg.referredGrant, ctx.locale), on: cfg.qualifyOn, name };
    }
    const joined = await one<{ n: number; q: number }>(db, `select count(*)::int as n, count(*) filter (where status = 'qualified')::int as q from referrals where referrer_membership_id = $1`, [w.membershipId]);
    const link = cfg ? `${config().APP_URL.replace(/\/$/, '')}/c/${w.cafe.slug}?ref=${view.membership.referralCode}` : null;
    return render(ctx, <WalletReferPage cafe={walletCafe(w.cafe)} view={view} link={link} rewards={rewards} joined={joined.n} rewarded={joined.q} />, { title: ctx.t.wallet.referTitle, noindex: true });
  });

  r.get('/api/wallet/:slug/state', async (ctx) => {
    const w = await walletCtx(ctx);
    if (isReplyLike(w)) return json({ error: { code: 'unauthorised', message: 'Sign in again.' } }, 401);
    const view = (await loadMemberView(db, w.cafe, w.membershipId, { activityLimit: 1 }))!;
    return json({ hash: view.stateHash });
  });

  r.get('/api/wallet/:slug/qr', async (ctx) => {
    const w = await walletCtx(ctx);
    if (isReplyLike(w)) return json({ error: { code: 'unauthorised', message: 'Sign in again.' } }, 401);
    const m = await one<{ member_code: string }>(db, 'select member_code from loyalty_memberships where id = $1', [w.membershipId]);
    const { token, expiresAt } = issueMemberToken(w.membershipId);
    const svg = qrSvg(memberScanUrl(token), { ecc: 'M', margin: 4, title: 'Member code' });
    return json({ svg, expiresAt: expiresAt.toISOString(), memberCode: formatMemberCode(m.member_code) });
  });

  /* ------------------------------ account */
  const accountPage = async (ctx: Ctx, errors: Record<string, string> = {}, status = 200) => {
    const u = await one<any>(db, 'select name, email from users where id = $1', [ctx.user!.id]);
    const c = await maybeOne<any>(db, 'select id, phone, birthday_month, birthday_day from customers where user_id = $1', [ctx.user!.id]);
    const memberships = c
      ? await many<any>(
          db,
          `select m.id, m.marketing_consent, b.name, b.slug from loyalty_memberships m join businesses b on b.id = m.business_id
            where m.customer_id = $1 and m.status = 'active' order by b.name`,
          [c.id],
        )
      : [];
    return render(
      ctx,
      <AccountPage
        profile={{ name: u.name, email: u.email, phone: c?.phone ?? null, birthdayMonth: c?.birthday_month ?? null, birthdayDay: c?.birthday_day ?? null }}
        memberships={memberships.map((m) => ({ id: m.id, cafeName: m.name, slug: m.slug, marketingConsent: m.marketing_consent }))}
        errors={errors}
      />,
      { title: ctx.t.account.title, noindex: true, status },
    );
  };

  r.get('/account', async (ctx) => {
    if (!ctx.user) return redirect(ctx, '/sign-in?next=/account');
    return accountPage(ctx);
  });

  r.post('/account/profile', async (ctx) => {
    if (!ctx.user) return redirect(ctx, '/sign-in?next=/account');
    const body = await readBody(ctx);
    const name = nameSchema.safeParse(field(body, 'name'));
    const phone = field(body, 'phone').trim();
    const month = Number(field(body, 'birthday_month')) || null;
    const day = Number(field(body, 'birthday_day')) || null;
    const errors: Record<string, string> = {};
    if (!name.success) errors.name = name.error.issues[0].message;
    if (phone && !/^[+0-9 ()-]{6,40}$/.test(phone)) errors.phone = 'Enter a valid phone number.';
    if ((month && !day) || (!month && day)) errors.birthday = 'Choose both a month and a day, or neither.';
    if (month && day && day > [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]) errors.birthday = 'That date does not exist.';
    if (Object.keys(errors).length) return accountPage(ctx, errors, 422);
    await tx(async (q) => {
      await q.query('update users set name = $2, updated_at = now() where id = $1', [ctx.user!.id, name.data]);
      const customerId = await ensureCustomerForUser(q, { id: ctx.user!.id, name: name.data!, email: ctx.user!.email });
      await q.query('update customers set name = $2, phone = $3, birthday_month = $4, birthday_day = $5, updated_at = now() where id = $1', [
        customerId,
        name.data,
        phone || null,
        month,
        day,
      ]);
    });
    return redirect(ctx, '/account', { type: 'success', message: ctx.t.common.saved });
  });

  r.post('/account/preferences', async (ctx) => {
    if (!ctx.user) return redirect(ctx, '/sign-in?next=/account');
    const body = await readBody(ctx);
    const chosen = new Set(fieldAll(body, 'consent'));
    const c = await maybeOne<{ id: string }>(db, 'select id from customers where user_id = $1', [ctx.user.id]);
    if (c) {
      const ms = await many<{ id: string; marketing_consent: boolean }>(db, `select id, marketing_consent from loyalty_memberships where customer_id = $1 and status = 'active'`, [c.id]);
      for (const m of ms) {
        const want = chosen.has(m.id);
        if (want !== m.marketing_consent) {
          await db.query('update loyalty_memberships set marketing_consent = $2, consent_updated_at = now(), updated_at = now() where id = $1', [m.id, want]);
        }
      }
    }
    return redirect(ctx, '/account', { type: 'success', message: ctx.t.common.saved });
  });

  r.post('/account/password', async (ctx) => {
    if (!ctx.user) return redirect(ctx, '/sign-in?next=/account');
    const body = await readBody(ctx);
    await rateLimit(`pw:${ctx.user.id}`, 10, 3600);
    const next = passwordSchema.safeParse(field(body, 'next'));
    if (!next.success) return accountPage(ctx, { next: next.error.issues[0].message }, 422);
    const ok = await changePassword(ctx.user.id, field(body, 'current'), next.data);
    if (!ok) return accountPage(ctx, { current: ctx.t.account.wrongPassword }, 422);
    await destroyAllSessions(ctx.user.id);
    await createSession(ctx, ctx.user.id);
    return redirect(ctx, '/account', { type: 'success', message: ctx.t.account.passwordChanged });
  });

  r.get('/account/export.json', async (ctx) => {
    if (!ctx.user) return redirect(ctx, '/sign-in?next=/account');
    const u = await one<any>(db, 'select name, email, locale, created_at from users where id = $1', [ctx.user.id]);
    const c = await maybeOne<any>(db, 'select id, name, email, phone, birthday_month, birthday_day, created_at from customers where user_id = $1', [ctx.user.id]);
    const memberships = c
      ? await many<any>(
          db,
          `select m.id, b.name as cafe, m.member_code, m.joined_at, m.visit_count, m.last_visit_at, m.marketing_consent,
                  (select json_agg(json_build_object('type', t.transaction_type, 'stamps', t.stamps_delta, 'points', t.points_delta, 'description', t.description, 'at', t.created_at) order by t.created_at)
                     from loyalty_transactions t where t.membership_id = m.id) as transactions,
                  (select json_agg(json_build_object('reward', r.name, 'status', cr.status, 'issued', cr.issued_at, 'expires', cr.expires_at, 'redeemed', cr.redeemed_at))
                     from customer_rewards cr join rewards r on r.id = cr.reward_id where cr.membership_id = m.id) as rewards
             from loyalty_memberships m join businesses b on b.id = m.business_id where m.customer_id = $1`,
          [c.id],
        )
      : [];
    const data = { exportedAt: new Date().toISOString(), account: u, customer: c ? { ...c, id: undefined } : null, memberships };
    return reply(200, JSON.stringify(data, null, 2), {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': 'attachment; filename="perkora-my-data.json"',
      'cache-control': 'no-store',
    });
  });

  r.post('/account/delete', async (ctx) => {
    if (!ctx.user) return redirect(ctx, '/sign-in?next=/account');
    const body = await readBody(ctx);
    if (field(body, 'confirm').trim() !== 'DELETE') return accountPage(ctx, { confirm: ctx.t.account.deleteConfirm }, 422);
    try {
      await deleteCustomerAccount(ctx.user.id);
    } catch (e) {
      if (e instanceof DomainError) return accountPage(ctx, { confirm: e.message }, 409);
      throw e;
    }
    await destroySession(ctx);
    return redirect(ctx, '/', { type: 'success', message: ctx.t.account.deleted });
  });
}
