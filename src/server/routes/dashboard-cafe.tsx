/**
 * "My café": the owner's home for how their café looks to customers. The café is shown in its
 * own colours and photo, and each part (logo, photo, colours, welcome line, location, rewards,
 * offers) can be changed, added or removed right there.
 */
import type { Router } from '../http/router';
import { field, formObject, readBody, redirect } from '../http/core';
import { render } from '../http/render';
import { db, many, maybeOne } from '../db';
import { config } from '../config';
import { DomainError, notFound } from '../domain/errors';
import { loadCafeById } from '../domain/views';
import { businessSettingsSchema } from '../../shared/schemas';
import { qrSvg } from '../../shared/qr/qrcode';
import { withBiz, audit } from './dashboard-core';
import { storeImage } from './dashboard-settings';
import { benefitLabel } from './dashboard-manage';
import { MyCafePage, type MyCafeData } from '../../ui/pages/dashboard/MyCafe';
import { hasFeature, type BusinessContext } from '../auth/guards';

const appUrl = () => config().APP_URL.replace(/\/$/, '');
const HOME = '/dashboard/cafe';

async function saveSettings(biz: BusinessContext, patch: Record<string, unknown>) {
  const merged = businessSettingsSchema.parse({ ...biz.settings, ...patch });
  await db.query('update businesses set settings = $2, updated_at = now() where id = $1', [biz.id, merged]);
}

export function dashboardCafeRoutes(r: Router) {
  r.get(
    HOME,
    withBiz({ owner: true }, async (ctx, biz) => {
      const cafe = await loadCafeById(db, biz.id);
      if (!cafe) throw notFound('Café');
      const [card, rewards, offers, members, extra] = await Promise.all([
        maybeOne<any>(
          db,
          `select p.id, p.name, p.config, r.name as reward, r.id as reward_id from loyalty_programmes p
             left join rewards r on r.programme_id = p.id and r.is_card_reward and r.status <> 'archived'
            where p.business_id = $1 and p.programme_type = 'stamps' and p.status <> 'archived' order by p.created_at limit 1`,
          [biz.id],
        ),
        many<any>(
          db,
          `select id, name, reward_type, stamps_cost, points_cost, is_card_reward, status, icon from rewards
            where business_id = $1 and status <> 'archived' order by is_card_reward desc, created_at limit 20`,
          [biz.id],
        ),
        many<any>(
          db,
          `select * from campaigns
            where business_id = $1 and status in ('draft', 'published', 'paused') order by status = 'published' desc, start_date desc limit 8`,
          [biz.id],
        ),
        maybeOne<{ n: number }>(db, `select count(*)::int as n from loyalty_memberships where business_id = $1 and status = 'active'`, [biz.id]),
        maybeOne<any>(db, `select phone from businesses where id = $1`, [biz.id]),
      ]);
      const joinUrl = `${appUrl()}/c/${biz.slug}`;
      const data: MyCafeData = {
        cafe,
        phone: extra?.phone ?? null,
        card: card ? { programmeId: card.id, need: Number(card.config?.stampsRequired ?? 9), reward: card.reward ?? 'Reward', eligible: card.config?.eligiblePurchase ?? '' } : null,
        rewards: rewards.map((x) => ({ id: x.id, name: x.name, isCard: x.is_card_reward, status: x.status, cost: x.is_card_reward ? `${x.stamps_cost} stamps` : x.points_cost ? `${x.points_cost} points` : x.stamps_cost ? `${x.stamps_cost} stamps` : 'Given by you' })),
        offers: await Promise.all(offers.map(async (o) => ({ id: o.id, name: o.name, status: o.status, benefit: await benefitLabel(biz, o).catch(() => null) }))),
        members: members?.n ?? 0,
        joinUrl,
        qr: qrSvg(joinUrl, { ecc: 'Q' }),
        canOffers: hasFeature(biz, 'campaigns'),
      };
      return render(ctx, <MyCafePage biz={biz} d={data} open={ctx.query.get('edit') ?? ''} />, { title: 'My café', noindex: true });
    }),
  );

  /** Logo or café photo: upload a new one, or remove it. */
  r.post(
    '/dashboard/cafe/image/:kind',
    withBiz({ owner: true }, async (ctx, biz) => {
      const kind = ctx.params.kind === 'logo' ? 'logo' : ctx.params.kind === 'banner' ? 'banner' : null;
      if (!kind) throw notFound('Page');
      const body = await readBody(ctx, 6 * 1024 * 1024);
      const file = body.files.find((f) => f.field === kind && f.data.length > 0);
      const remove = field(body, 'remove') === '1';
      let id: string | null = null;
      if (file) {
        try {
          id = await storeImage(biz, ctx.user!.id, file, kind);
        } catch (e) {
          if (e instanceof DomainError) return redirect(ctx, `${HOME}?edit=${kind}`, { type: 'error', message: e.message });
          throw e;
        }
      } else if (!remove) return redirect(ctx, `${HOME}?edit=${kind}`, { type: 'error', message: 'Choose a picture first.' });
      const col = kind === 'logo' ? 'logo_upload_id' : 'banner_upload_id';
      await db.query(`update businesses set ${col} = $2::uuid, updated_at = now() where id = $1`, [biz.id, id]);
      // a new café photo shows straight away: switch the page to the photo layout if it was on the default
      if (kind === 'banner' && id && biz.settings.pageLayout === 'classic') await saveSettings(biz, { pageLayout: 'banner' });
      if (kind === 'banner' && !id && biz.settings.pageLayout === 'banner') await saveSettings(biz, { pageLayout: 'classic' });
      await audit(biz, ctx.user!.id, `cafe.${kind}.${id ? 'changed' : 'removed'}`, 'business', biz.id);
      const what = kind === 'logo' ? 'Logo' : 'Café photo';
      return redirect(ctx, HOME, { type: 'success', message: id ? `${what} updated. Customers see it straight away.` : `${what} removed.` });
    }),
  );

  r.post(
    '/dashboard/cafe/colours',
    withBiz({ owner: true }, async (ctx, biz) => {
      const v = formObject(await readBody(ctx));
      const hex = /^#[0-9a-fA-F]{6}$/;
      if (!hex.test(v.primary_colour ?? '') || !hex.test(v.secondary_colour ?? '')) return redirect(ctx, `${HOME}?edit=colours`, { type: 'error', message: 'Choose both colours.' });
      await db.query(`update businesses set primary_colour = $2, secondary_colour = $3, updated_at = now() where id = $1`, [biz.id, v.primary_colour.toUpperCase(), v.secondary_colour.toUpperCase()]);
      await audit(biz, ctx.user!.id, 'cafe.colours', 'business', biz.id);
      return redirect(ctx, HOME, { type: 'success', message: 'Colours updated.' });
    }),
  );

  r.post(
    '/dashboard/cafe/welcome',
    withBiz({ owner: true }, async (ctx, biz) => {
      const v = formObject(await readBody(ctx));
      const tagline = (v.tagline ?? '').trim().replace(/\s+/g, ' ');
      if (tagline.length > 140) return redirect(ctx, `${HOME}?edit=welcome`, { type: 'error', message: 'Keep the welcome line under 140 characters.' });
      await saveSettings(biz, { tagline });
      await audit(biz, ctx.user!.id, 'cafe.welcome', 'business', biz.id);
      return redirect(ctx, HOME, { type: 'success', message: tagline ? 'Welcome line updated.' : 'Welcome line removed.' });
    }),
  );

  r.post(
    '/dashboard/cafe/location',
    withBiz({ owner: true }, async (ctx, biz) => {
      const v = formObject(await readBody(ctx));
      const phone = (v.phone ?? '').trim();
      if (phone && !/^[+0-9 ()-]{6,40}$/.test(phone)) return redirect(ctx, `${HOME}?edit=location`, { type: 'error', message: 'Enter a valid phone number.' });
      const ig = (v.instagram ?? '').trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/.*$/, '');
      if (ig && !/^[A-Za-z0-9._]{1,30}$/.test(ig)) return redirect(ctx, `${HOME}?edit=location`, { type: 'error', message: 'Enter the Instagram name, like @yourcafe.' });
      const current = await maybeOne<{ website: string | null }>(db, 'select website from businesses where id = $1', [biz.id]);
      const keepSite = current?.website && !current.website.startsWith('https://instagram.com/') ? current.website : null;
      await db.query(`update businesses set address = $2, city = $3, phone = $4, website = $5, updated_at = now() where id = $1`, [
        biz.id,
        (v.address ?? '').trim().slice(0, 160) || null,
        (v.city ?? '').trim().slice(0, 80) || null,
        phone || null,
        ig ? `https://instagram.com/${ig}` : keepSite,
      ]);
      await audit(biz, ctx.user!.id, 'cafe.location', 'business', biz.id);
      return redirect(ctx, HOME, { type: 'success', message: 'Details updated.' });
    }),
  );

  r.post(
    '/dashboard/cafe/rewards/:id/remove',
    withBiz({ owner: true }, async (ctx, biz) => {
      await readBody(ctx);
      const res = await db.query(`update rewards set status = 'archived', updated_at = now() where id = $1 and business_id = $2 and not is_card_reward and status <> 'archived'`, [ctx.params.id, biz.id]);
      if (!res.rowCount) return redirect(ctx, HOME, { type: 'error', message: 'The main card reward can be changed, not removed.' });
      await audit(biz, ctx.user!.id, 'reward.archived', 'reward', ctx.params.id);
      return redirect(ctx, HOME, { type: 'success', message: 'Reward removed. Rewards customers already hold stay valid.' });
    }),
  );
}
