import crypto from 'node:crypto';
import type { Router } from '../http/router';
import type { Ctx } from '../http/core';
import { field, fieldAll, formObject, readBody, redirect } from '../http/core';
import { render } from '../http/render';
import { db, many, maybeOne, one, tx } from '../db';
import { config } from '../config';
import { STAFF_PERMISSIONS, loadBusinessContext, selectBusiness, type BusinessContext } from '../auth/guards';
import { randomToken, sha256 } from '../auth/crypto';
import { DomainError, notFound } from '../domain/errors';
import { emailSchema, ensureCustomerForUser } from '../domain/accounts';
import { loadPlans } from '../domain/plans';
import { businessSettingsSchema, PAGE_LAYOUTS, STAMP_ICONS } from '../../shared/schemas';
import { isValidTimezone } from '../../shared/time';
import { qrSvg } from '../../shared/qr/qrcode';
import { withBiz, audit } from './dashboard-core';
import {
  HelpPage,
  InvitePage,
  QrPosterPage,
  SettingsBrandingPage,
  SettingsLoyaltyPage,
  SettingsNotificationsPage,
  SettingsProfilePage,
  SettingsQrPage,
  SubscriptionPage,
  TeamPage,
} from '../../ui/pages/dashboard/Admin';

const appUrl = () => config().APP_URL.replace(/\/$/, '');

export function detectImage(buf: Buffer): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export async function storeImage(biz: { id: string }, userId: string, file: { data: Buffer }, purpose: 'logo' | 'reward' | 'banner'): Promise<string> {
  const limit = purpose === 'banner' ? 2 : 1;
  if (file.data.length > limit * 1024 * 1024) throw new DomainError('validation', `The image is larger than ${limit} MB. Choose a smaller photo.`, 422);
  const type = detectImage(file.data);
  if (!type) throw new DomainError('validation', 'Upload a PNG, JPEG or WebP image.', 422);
  const r = await one<{ id: string }>(
    db,
    `insert into uploads (business_id, uploaded_by, purpose, content_type, byte_size, sha256, data) values ($1,$2,$3,$4,$5,$6,$7) returning id`,
    [biz.id, userId, purpose, type, file.data.length, crypto.createHash('sha256').update(file.data).digest('hex'), file.data],
  );
  return r.id;
}

/** Layout, stamp icon and welcome message from a branding form. */
export function parseLook(body: { fields: Record<string, string[]> } | any, errors: Record<string, string>) {
  const layout = field(body, 'page_layout');
  const icon = field(body, 'stamp_icon');
  const tagline = field(body, 'tagline').trim().replace(/\s+/g, ' ');
  if (tagline.length > 140) errors.tagline = 'Use up to 140 characters.';
  return {
    pageLayout: (PAGE_LAYOUTS as readonly string[]).includes(layout) ? (layout as (typeof PAGE_LAYOUTS)[number]) : 'classic',
    stampIcon: (STAMP_ICONS as readonly string[]).includes(icon) ? (icon as (typeof STAMP_ICONS)[number]) : 'bean',
    tagline: tagline.slice(0, 140),
  };
}

async function seatsUsed(bizId: string) {
  const r = await one<{ n: number }>(
    db,
    `select ((select count(*) from business_members where business_id = $1 and role = 'staff' and status = 'active')
           + (select count(*) from staff_invitations where business_id = $1 and accepted_at is null and revoked_at is null and expires_at > now()))::int as n`,
    [bizId],
  );
  return r.n;
}

async function updateSettings(biz: BusinessContext, patch: Record<string, unknown>) {
  const merged = businessSettingsSchema.parse({ ...biz.settings, ...patch });
  await db.query('update businesses set settings = $2, updated_at = now() where id = $1', [biz.id, merged]);
  return merged;
}

export function dashboardSettingsRoutes(r: Router) {
  /* ------------------------------------------------ team */
  const teamPage = async (ctx: Ctx, biz: BusinessContext, extra: { inviteLink?: string | null; errors?: Record<string, string>; values?: Record<string, string>; status?: number } = {}) => {
    const members = await many<any>(
      db,
      `select bm.id, bm.user_id, bm.role, bm.status, bm.permissions, u.name, u.email, u.last_sign_in_at
         from business_members bm join users u on u.id = bm.user_id where bm.business_id = $1 order by bm.role, u.name`,
      [biz.id],
    );
    const invitations = await many<any>(
      db,
      `select id, email, name, expires_at, created_at from staff_invitations where business_id = $1 and accepted_at is null and revoked_at is null and expires_at > now() order by created_at desc`,
      [biz.id],
    );
    return render(ctx, <TeamPage biz={biz} members={members} invitations={invitations} seatsUsed={await seatsUsed(biz.id)} inviteLink={extra.inviteLink ?? null} errors={extra.errors} values={extra.values} />, {
      title: 'Team',
      noindex: true,
      status: extra.status,
    });
  };

  r.get('/dashboard/team', withBiz({ owner: true }, async (ctx, biz) => teamPage(ctx, biz)));

  r.post(
    '/dashboard/team/invite',
    withBiz({ owner: true }, async (ctx, biz) => {
      const body = await readBody(ctx);
      const values = formObject(body);
      const email = emailSchema.safeParse(values.email);
      if (!email.success) return teamPage(ctx, biz, { errors: { email: 'Enter a valid email address.' }, values, status: 422 });
      if ((await seatsUsed(biz.id)) >= biz.plan.features.limits.staffSeats) throw new DomainError('plan_limit', 'All staff seats are in use.', 403);
      const already = await maybeOne(db, `select 1 from business_members bm join users u on u.id = bm.user_id where bm.business_id = $1 and lower(u.email) = $2 and bm.status = 'active'`, [biz.id, email.data]);
      if (already) return teamPage(ctx, biz, { errors: { email: 'This person is already on your team.' }, values, status: 409 });
      const perms = Object.fromEntries(fieldAll(body, 'perm').filter((p) => STAFF_PERMISSIONS.some((s) => s.key === p)).map((p) => [p, true]));
      const token = randomToken(32);
      await db.query(
        `insert into staff_invitations (business_id, email, name, permissions, token_hash, invited_by, expires_at) values ($1,$2,$3,$4,$5,$6, now() + interval '7 days')`,
        [biz.id, email.data, values.name?.trim() || null, perms, sha256(token), ctx.user!.id],
      );
      await audit(biz, ctx.user!.id, 'team.invited', 'staff_invitation', email.data, { permissions: perms });
      return teamPage(ctx, biz, { inviteLink: `${appUrl()}/invite/${token}` });
    }),
  );

  r.post(
    '/dashboard/team/invitations/:id/revoke',
    withBiz({ owner: true }, async (ctx, biz) => {
      await db.query(`update staff_invitations set revoked_at = now() where id = $1 and business_id = $2 and accepted_at is null`, [ctx.params.id, biz.id]);
      await audit(biz, ctx.user!.id, 'team.invitation_revoked', 'staff_invitation', ctx.params.id);
      return redirect(ctx, '/dashboard/team', { type: 'success', message: 'Invitation revoked.' });
    }),
  );

  r.post(
    '/dashboard/team/:id/permissions',
    withBiz({ owner: true }, async (ctx, biz) => {
      const body = await readBody(ctx);
      const perms = Object.fromEntries(fieldAll(body, 'perm').filter((p) => STAFF_PERMISSIONS.some((s) => s.key === p)).map((p) => [p, true]));
      const r2 = await db.query(`update business_members set permissions = $3, updated_at = now() where id = $1 and business_id = $2 and role = 'staff'`, [ctx.params.id, biz.id, perms]);
      if (!r2.rowCount) throw notFound('Team member');
      await audit(biz, ctx.user!.id, 'team.permissions_changed', 'business_member', ctx.params.id, { permissions: perms });
      return redirect(ctx, '/dashboard/team', { type: 'success', message: 'Permissions saved.' });
    }),
  );

  r.post(
    '/dashboard/team/:id/status',
    withBiz({ owner: true }, async (ctx, biz) => {
      const status = field(await readBody(ctx), 'status') === 'active' ? 'active' : 'deactivated';
      if (status === 'active' && (await seatsUsed(biz.id)) >= biz.plan.features.limits.staffSeats) throw new DomainError('plan_limit', 'All staff seats are in use.', 403);
      const r2 = await db.query(`update business_members set status = $3, updated_at = now() where id = $1 and business_id = $2 and role = 'staff'`, [ctx.params.id, biz.id, status]);
      if (!r2.rowCount) throw notFound('Team member');
      await audit(biz, ctx.user!.id, `team.${status}`, 'business_member', ctx.params.id);
      return redirect(ctx, '/dashboard/team', { type: 'success', message: status === 'active' ? 'Access restored.' : 'Access removed. They can no longer use the terminal.' });
    }),
  );

  /* ------------------------------------------------ invitations (staff side) */
  const loadInvite = async (token: string) => {
    if (!/^[A-Za-z0-9_-]{30,60}$/.test(token)) return null;
    return maybeOne<any>(
      db,
      `select i.*, b.name as cafe_name from staff_invitations i join businesses b on b.id = i.business_id
        where i.token_hash = $1 and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()`,
      [sha256(token)],
    );
  };
  r.get('/invite/:token', async (ctx) => {
    const inv = await loadInvite(ctx.params.token);
    if (!inv) return render(ctx, <InvitePage state="invalid" />, { title: 'Invitation', noindex: true, status: 404 });
    const state = !ctx.user ? 'signin' : ctx.user.email.toLowerCase() === inv.email.toLowerCase() ? 'accept' : 'mismatch';
    return render(ctx, <InvitePage state={state} cafeName={inv.cafe_name} email={inv.email} path={ctx.path} />, { title: 'Invitation', noindex: true });
  });
  r.post('/invite/:token', async (ctx) => {
    const inv = await loadInvite(ctx.params.token);
    if (!inv) return render(ctx, <InvitePage state="invalid" />, { title: 'Invitation', noindex: true, status: 404 });
    if (!ctx.user) return redirect(ctx, `/sign-in?next=${encodeURIComponent(ctx.path)}`);
    if (ctx.user.email.toLowerCase() !== inv.email.toLowerCase()) return render(ctx, <InvitePage state="mismatch" cafeName={inv.cafe_name} email={inv.email} />, { title: 'Invitation', status: 403 });
    await tx(async (q) => {
      const claimed = await q.query(`update staff_invitations set accepted_at = now(), accepted_by = $2 where id = $1 and accepted_at is null returning id`, [inv.id, ctx.user!.id]);
      if (!claimed.rowCount) throw new DomainError('conflict', 'This invitation was already used.', 409);
      await q.query(
        `insert into business_members (business_id, user_id, role, status, permissions, invited_by) values ($1, $2, 'staff', 'active', $3, $4)
         on conflict (business_id, user_id) do update set status = 'active', permissions = excluded.permissions, updated_at = now()`,
        [inv.business_id, ctx.user!.id, inv.permissions, inv.invited_by],
      );
      await q.query(`insert into audit_logs (business_id, actor_user_id, action, target_type, target_id) values ($1, $2, 'team.joined', 'user', $3)`, [inv.business_id, ctx.user!.id, ctx.user!.id]);
    });
    selectBusiness(ctx, inv.business_id);
    return redirect(ctx, '/terminal', { type: 'success', message: `You’ve joined ${inv.cafe_name}.` });
  });

  /* ------------------------------------------------ claim a counter-added membership */
  r.get('/claim/:token', async (ctx) => {
    if (!ctx.user) return redirect(ctx, `/sign-up?next=${encodeURIComponent(ctx.path)}`);
    const token = ctx.params.token;
    if (!/^[A-Za-z0-9_-]{30,60}$/.test(token)) throw notFound();
    const claim = await maybeOne<any>(
      db,
      `select mc.*, b.slug from membership_claims mc join businesses b on b.id = mc.business_id where mc.token_hash = $1 and mc.used_at is null and mc.expires_at > now()`,
      [sha256(token)],
    );
    if (!claim) return redirect(ctx, '/wallet', { type: 'error', message: 'This claim link is invalid or has expired. Ask the café for a new one.' });
    try {
      await tx(async (q) => {
        const used = await q.query(`update membership_claims set used_at = now() where id = $1 and used_at is null returning id`, [claim.id]);
        if (!used.rowCount) throw new DomainError('conflict', 'This claim link was already used.', 409);
        const m = await one<any>(q, `select m.id, m.customer_id, c.user_id from loyalty_memberships m join customers c on c.id = m.customer_id where m.id = $1 for no key update of m`, [claim.membership_id]);
        if (m.user_id) throw new DomainError('conflict', 'This membership is already linked to an account.', 409);
        const own = await maybeOne<{ id: string }>(q, 'select id from customers where user_id = $1', [ctx.user!.id]);
        if (!own) {
          await q.query('update customers set user_id = $2, email = coalesce(email, $3), updated_at = now() where id = $1', [m.customer_id, ctx.user!.id, ctx.user!.email]);
        } else {
          const clash = await maybeOne(q, 'select 1 from loyalty_memberships where customer_id = $1 and business_id = $2', [own.id, claim.business_id]);
          if (clash) throw new DomainError('conflict', 'Your account already has a card at this café. Ask the café to combine them with a balance correction.', 409);
          await q.query('update loyalty_memberships set customer_id = $2, source = $3, updated_at = now() where id = $1', [m.id, own.id, 'claim']);
          await q.query(`update customers set deleted_at = now(), name = 'Merged customer', email = null, phone = null where id = $1`, [m.customer_id]);
        }
        await q.query(`insert into audit_logs (business_id, actor_user_id, action, target_type, target_id) values ($1, $2, 'membership.claimed', 'loyalty_membership', $3)`, [claim.business_id, ctx.user!.id, m.id]);
        await ensureCustomerForUser(q, ctx.user!);
      });
    } catch (e) {
      if (e instanceof DomainError) return redirect(ctx, '/wallet', { type: 'error', message: e.message });
      throw e;
    }
    return redirect(ctx, `/wallet/${claim.slug}`, { type: 'success', message: 'Your card is now linked to your account.' });
  });

  /* ------------------------------------------------ settings */
  const profileValues = async (biz: BusinessContext) => {
    const b = await one<any>(db, 'select * from businesses where id = $1', [biz.id]);
    return {
      name: b.name,
      description: b.description ?? '',
      city: b.city ?? '',
      address: b.address ?? '',
      business_email: b.business_email ?? '',
      phone: b.phone ?? '',
      website: b.website ?? '',
      timezone: b.timezone,
      default_currency: b.default_currency,
    };
  };
  r.get(
    '/dashboard/settings',
    withBiz({ owner: true }, async (ctx, biz) =>
      render(ctx, <SettingsProfilePage biz={biz} values={await profileValues(biz)} publicUrl={`${appUrl()}/c/${biz.slug}`} />, { title: 'Café Settings', noindex: true }),
    ),
  );
  r.post(
    '/dashboard/settings',
    withBiz({ owner: true }, async (ctx, biz) => {
      const v = formObject(await readBody(ctx));
      const errors: Record<string, string> = {};
      if (!v.name?.trim() || v.name.trim().length > 120) errors.name = 'Enter your café’s name.';
      if (v.business_email?.trim() && !emailSchema.safeParse(v.business_email).success) errors.business_email = 'Enter a valid email address.';
      if (v.phone?.trim() && !/^[+0-9 ()-]{6,40}$/.test(v.phone.trim())) errors.phone = 'Enter a valid phone number.';
      if (v.website?.trim() && !/^https?:\/\/[^\s]+$/.test(v.website.trim())) errors.website = 'Enter a full address starting with https://';
      const tz = isValidTimezone(v.timezone) ? v.timezone : biz.timezone;
      const currency = v.default_currency === 'TRY' ? 'TRY' : 'EUR';
      if (currency !== biz.currency) {
        const hasMoney = await maybeOne(db, `select 1 from loyalty_transactions where business_id = $1 and purchase_amount_minor is not null limit 1`, [biz.id]);
        if (hasMoney) errors.default_currency = 'Purchases have already been recorded in the current currency. Contact support to change it.';
      }
      if (Object.keys(errors).length)
        return render(ctx, <SettingsProfilePage biz={biz} values={v} errors={errors} publicUrl={`${appUrl()}/c/${biz.slug}`} />, { title: 'Café Settings', status: 422, noindex: true });
      await db.query(
        `update businesses set name=$2, description=$3, city=$4, address=$5, business_email=$6, phone=$7, website=$8, timezone=$9, default_currency=$10, updated_at=now() where id=$1`,
        [biz.id, v.name.trim(), v.description?.trim() || null, v.city?.trim() || null, v.address?.trim() || null, v.business_email?.trim() || null, v.phone?.trim() || null, v.website?.trim() || null, tz, currency],
      );
      await audit(biz, ctx.user!.id, 'settings.profile', 'business', biz.id);
      return redirect(ctx, '/dashboard/settings', { type: 'success', message: 'Profile saved.' });
    }),
  );

  r.get('/dashboard/settings/branding', withBiz({ owner: true }, async (ctx, biz) => render(ctx, <SettingsBrandingPage biz={biz} />, { title: 'Branding', noindex: true })));
  r.post(
    '/dashboard/settings/branding',
    withBiz({ owner: true }, async (ctx, biz) => {
      const body = await readBody(ctx, 5 * 1024 * 1024);
      const errors: Record<string, string> = {};
      const hex = /^#[0-9a-fA-F]{6}$/;
      const primary = field(body, 'primary_colour');
      const secondary = field(body, 'secondary_colour');
      if (!hex.test(primary)) errors.primary_colour = 'Choose a colour.';
      if (!hex.test(secondary)) errors.secondary_colour = 'Choose a colour.';
      const look = parseLook(body, errors);
      const images: Record<'logo' | 'banner', string | null | undefined> = { logo: undefined, banner: undefined };
      for (const kind of ['logo', 'banner'] as const) {
        const file = body.files.find((f) => f.field === kind && f.data.length > 0);
        if (file) {
          try {
            images[kind] = await storeImage(biz, ctx.user!.id, file, kind);
          } catch (e) {
            if (e instanceof DomainError) errors[kind] = e.message;
            else throw e;
          }
        } else if (field(body, `remove_${kind}`) === '1') images[kind] = null;
      }
      if (Object.keys(errors).length) return render(ctx, <SettingsBrandingPage biz={biz} errors={errors} />, { title: 'Branding', status: 422, noindex: true });
      const listed = field(body, 'directory_seen') === '1' ? field(body, 'list_in_directory') === '1' : biz.listInDirectory;
      await db.query(
        `update businesses set primary_colour = $2, secondary_colour = $3,
            logo_upload_id = case when $4 then $5::uuid else logo_upload_id end,
            banner_upload_id = case when $6 then $7::uuid else banner_upload_id end,
            list_in_directory = $8, updated_at = now() where id = $1`,
        [biz.id, primary, secondary, images.logo !== undefined, images.logo ?? null, images.banner !== undefined, images.banner ?? null, listed],
      );
      await updateSettings(biz, look);
      await audit(biz, ctx.user!.id, 'settings.branding', 'business', biz.id, { layout: look.pageLayout });
      return redirect(ctx, '/dashboard/settings/branding', { type: 'success', message: 'Saved. Customers see the new look straight away.' });
    }),
  );

  r.get('/dashboard/settings/loyalty', withBiz({ owner: true }, async (ctx, biz) => render(ctx, <SettingsLoyaltyPage biz={biz} />, { title: 'Loyalty settings', noindex: true })));
  r.post(
    '/dashboard/settings/loyalty',
    withBiz({ owner: true }, async (ctx, biz) => {
      const v = formObject(await readBody(ctx));
      const num = (k: string) => (/^\d+$/.test(v[k] ?? '') ? Number(v[k]) : NaN);
      const parsed = businessSettingsSchema.safeParse({
        ...biz.settings,
        inactivityDays: num('inactivityDays'),
        newMemberDays: num('newMemberDays'),
        frequentVisits: num('frequentVisits'),
        approachingStamps: num('approachingStamps'),
        visitWindowMinutes: num('visitWindowMinutes'),
        duplicateGuardSeconds: num('duplicateGuardSeconds'),
        refundPolicy: v.refundPolicy === 'keep' ? 'keep' : 'reverse',
        staffInstructions: (v.staffInstructions ?? '').slice(0, 1000),
      });
      if (!parsed.success) {
        const errors: Record<string, string> = {};
        for (const i of parsed.error.issues) errors[String(i.path[0])] ??= 'Enter a number in the allowed range.';
        return render(ctx, <SettingsLoyaltyPage biz={biz} errors={errors} />, { title: 'Loyalty settings', status: 422, noindex: true });
      }
      await db.query('update businesses set settings = $2, updated_at = now() where id = $1', [biz.id, parsed.data]);
      await audit(biz, ctx.user!.id, 'settings.loyalty', 'business', biz.id, parsed.data);
      return redirect(ctx, '/dashboard/settings/loyalty', { type: 'success', message: 'Loyalty settings saved.' });
    }),
  );

  r.get(
    '/dashboard/settings/notifications',
    withBiz({ owner: true }, async (ctx, biz) => {
      const c = await one<{ opted: number; total: number }>(
        db,
        `select count(*) filter (where marketing_consent)::int as opted, count(*)::int as total from loyalty_memberships where business_id = $1 and status = 'active'`,
        [biz.id],
      );
      return render(ctx, <SettingsNotificationsPage biz={biz} consent={c} />, { title: 'Notifications', noindex: true });
    }),
  );
  r.post(
    '/dashboard/settings/notifications',
    withBiz({ owner: true }, async (ctx, biz) => {
      const body = await readBody(ctx);
      await updateSettings(biz, { showOffersPublicly: field(body, 'showOffersPublicly') === '1', operationalAlerts: field(body, 'operationalAlerts') === '1' });
      return redirect(ctx, '/dashboard/settings/notifications', { type: 'success', message: 'Saved.' });
    }),
  );

  r.get(
    '/dashboard/settings/qr',
    withBiz({}, async (ctx, biz) => {
      const url = `${appUrl()}/c/${biz.slug}`;
      return render(ctx, <SettingsQrPage biz={biz} url={url} svg={qrSvg(url, { ecc: 'Q', title: 'Join QR code' })} />, { title: 'QR code', noindex: true });
    }),
  );
  r.get(
    '/dashboard/settings/qr/poster',
    withBiz({}, async (ctx, biz) => {
      const url = `${appUrl()}/c/${biz.slug}`;
      const p = await maybeOne<any>(
        db,
        `select p.config, r.name from loyalty_programmes p left join rewards r on r.programme_id = p.id and r.is_card_reward where p.business_id = $1 and p.status = 'active' and p.programme_type = 'stamps' limit 1`,
        [biz.id],
      );
      const rule = p ? `Collect ${p.config.stampsRequired} stamps and receive ${String(p.name ?? 'a reward').toLowerCase()}.` : '';
      return render(ctx, <QrPosterPage biz={biz} svg={qrSvg(url, { ecc: 'Q', title: 'Join QR code' })} rule={rule} />, { title: `${biz.name} QR poster`, noindex: true, bodyClass: 'bg-white' });
    }),
  );

  /* ------------------------------------------------ subscription */
  r.get(
    '/dashboard/subscription',
    withBiz({ owner: true }, async (ctx, biz) => {
      const plans = await loadPlans(db);
      const sub = await maybeOne<any>(db, 'select * from subscriptions where business_id = $1', [biz.id]);
      const usage = await one<any>(
        db,
        `select (select count(*)::int from loyalty_programmes where business_id = $1 and status <> 'archived') as programmes,
                (select count(*)::int from business_members where business_id = $1 and role = 'staff' and status = 'active') as staff,
                (select count(*)::int from campaigns where business_id = $1 and status = 'published' and (end_date is null or end_date >= current_date)) as campaigns`,
        [biz.id],
      );
      return render(ctx, <SubscriptionPage biz={biz} plans={plans} sub={sub} usage={usage} />, { title: 'Subscription', noindex: true });
    }),
  );
  r.post(
    '/dashboard/subscription',
    withBiz({ owner: true }, async (ctx, biz) => {
      if (biz.isDemo) throw new DomainError('forbidden', 'Plans can’t be changed on the demo café.', 403);
      const planId = field(await readBody(ctx), 'plan_id');
      const plan = await maybeOne<{ id: string; name: string }>(db, `select id, name from plans where id = $1 and status = 'active'`, [planId]);
      if (!plan) throw notFound('Plan');
      const sub = await one<any>(db, 'select * from subscriptions where business_id = $1', [biz.id]);
      if (sub.status === 'trialing') {
        await db.query('update subscriptions set plan_id = $2, requested_plan_id = null, updated_at = now() where business_id = $1', [biz.id, plan.id]);
        await audit(biz, ctx.user!.id, 'subscription.plan_changed', 'subscription', sub.id, { from: sub.plan_id, to: plan.id });
        return redirect(ctx, '/dashboard/subscription', { type: 'success', message: `Your trial now uses the ${plan.name} plan. No payment was taken.` });
      }
      await db.query('update subscriptions set requested_plan_id = $2, updated_at = now() where business_id = $1', [biz.id, plan.id]);
      await audit(biz, ctx.user!.id, 'subscription.change_requested', 'subscription', sub.id, { to: plan.id });
      return redirect(ctx, '/dashboard/subscription', { type: 'success', message: `Request sent. Our team will confirm the ${plan.name} plan with you before anything changes.` });
    }),
  );

  r.get('/dashboard/help', withBiz({}, async (ctx, biz) => render(ctx, <HelpPage biz={biz} />, { title: 'Help', noindex: true })));
}

export { loadBusinessContext };
