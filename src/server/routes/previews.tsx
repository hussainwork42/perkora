/**
 * Café previews: the platform admin builds a café's loyalty card before a sales visit
 * (name, logo, colours, reward), shares a private link, and the owner makes it theirs
 * with an email and a password. Until then the café is in status 'preview': not in the
 * public café list, nobody can join, and only people who opened the link see it listed.
 */
import type { Router } from '../http/router';
import type { Ctx } from '../http/core';
import { field, formObject, readBody, redirect } from '../http/core';
import { rememberPreview } from './preview-cookie';
import { render } from '../http/render';
import { db, many, maybeOne, one, tx } from '../db';
import { config } from '../config';
import { notFound, DomainError } from '../domain/errors';
import { createUser, signUpSchema } from '../domain/accounts';
import { createSession } from '../auth/session';
import { rateLimit } from '../auth/ratelimit';
import { selectBusiness } from '../auth/guards';
import { randomCode } from '../auth/crypto';
import { loadCafeById, type PublicCafe } from '../domain/views';
import { loadPlans } from '../domain/plans';
import { businessSettingsSchema } from '../../shared/schemas';
import { qrSvg } from '../../shared/qr/qrcode';
import { moneyWhole, dateShort, relative } from '../../shared/format';
import { fmt } from '../../shared/i18n';
import { slugify, uniqueSlug } from './onboarding';
import { parseLook, storeImage } from './dashboard-settings';
import { zodErrors } from './marketing';
import { AdminLayout, guard } from './admin';
import { Alert, Badge, Button, Card, Field, Form, Input, PageHeader, Select } from '../../ui/components/ui';
import { CafeMark } from '../../ui/components/brand';
import { LookFields } from '../../ui/components/branding-fields';
import { Island } from '../../ui/islands/Island';
import { ClaimPage, ClaimedPage, PreviewPage, type PreviewRule } from '../../ui/pages/preview/PreviewPages';

const appUrl = () => config().APP_URL.replace(/\/$/, '');
async function previewRule(businessId: string): Promise<PreviewRule> {
  const r = await maybeOne<{ config: any; reward: string | null }>(
    db,
    `select p.config, (select name from rewards w where w.programme_id = p.id and w.is_card_reward order by w.created_at limit 1) as reward
       from loyalty_programmes p where p.business_id = $1 and p.programme_type = 'stamps' and p.status = 'active' order by p.created_at limit 1`,
    [businessId],
  );
  return { need: Number(r?.config?.stampsRequired ?? 9), reward: r?.reward ?? 'Free coffee' };
}

async function byToken(token: string): Promise<{ cafe: PublicCafe; row: any } | null> {
  if (!/^[a-z0-9]{12}$/.test(token)) return null;
  const row = await maybeOne<any>(db, `select id, status, claimed_at from businesses where preview_token = $1`, [token]);
  if (!row) return null;
  const cafe = await loadCafeById(db, row.id);
  return cafe ? { cafe, row } : null;
}

/* ------------------------------------------------------------------ admin form */

interface PreviewValues {
  [k: string]: string;
}

function readPreviewForm(body: any, errors: Record<string, string>) {
  const v = formObject(body) as PreviewValues;
  const name = (v.name ?? '').trim().replace(/\s+/g, ' ');
  if (!name) errors.name = 'Enter the café’s name.';
  else if (name.length > 120) errors.name = 'Use up to 120 characters.';
  const hex = /^#[0-9a-fA-F]{6}$/;
  const need = /^\d+$/.test(v.stamps_required ?? '') ? Number(v.stamps_required) : NaN;
  if (!(need >= 2 && need <= 30)) errors.stamps_required = 'Choose between 2 and 30 stamps.';
  const reward = (v.reward_name ?? '').trim();
  if (!reward) errors.reward_name = 'Describe the reward.';
  const ig = (v.instagram ?? '').trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/.*$/, '');
  if (ig && !/^[A-Za-z0-9._]{1,30}$/.test(ig)) errors.instagram = 'Enter the Instagram name, like @cafename.';
  const look = parseLook(body, errors);
  return {
    v,
    data: {
      name,
      city: (v.city ?? '').trim().slice(0, 80) || 'Girne',
      address: (v.address ?? '').trim().slice(0, 160) || null,
      website: ig ? `https://instagram.com/${ig}` : null,
      primary: hex.test(v.primary_colour) ? v.primary_colour.toUpperCase() : '#3B2925',
      secondary: hex.test(v.secondary_colour) ? v.secondary_colour.toUpperCase() : '#B86F52',
      currency: v.default_currency === 'EUR' ? 'EUR' : 'TRY',
      need,
      reward: reward.slice(0, 80),
      eligible: (v.eligible_purchase ?? '').trim().slice(0, 120) || 'Any coffee',
      look,
    },
  };
}

function PreviewForm({ action, values, errors = {}, logoUrl, bannerUrl, submit }: { action: string; values: PreviewValues; errors?: Record<string, string>; logoUrl: string | null; bannerUrl: string | null; submit: string }) {
  const primary = values.primary_colour || '#3B2925';
  const secondary = values.secondary_colour || '#B86F52';
  return (
    <div className="grid max-w-6xl grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <Card className="p-6">
        <Form action={action} multipart className="grid gap-6" id="preview-form">
          {errors.form && <Alert tone="error">{errors.form}</Alert>}
          <Field label="Café name" name="name" hint="Exactly as it is written on their sign." error={errors.name}>
            <Input name="name" required maxLength={120} defaultValue={values.name} error={errors.name} autoFocus={!values.name} />
          </Field>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Area" name="address" optional hint="For example Harbour or Karaoğlanoğlu." error={errors.address}>
              <Input name="address" maxLength={160} defaultValue={values.address} />
            </Field>
            <Field label="City" name="city" error={errors.city}>
              <Input name="city" maxLength={80} defaultValue={values.city || 'Girne'} />
            </Field>
          </div>
          <Field label="Logo" name="logo" optional hint="A screenshot of their Instagram picture works." error={errors.logo}>
            <Island name="ImagePicker" props={{ name: 'logo', label: 'Logo', current: logoUrl, maxSide: 600, shape: 'square', hint: 'PNG, JPEG or WebP.' }} />
          </Field>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Main colour" name="primary_colour" hint="Card and header." error={errors.primary_colour}>
              <input type="color" id="primary_colour" name="primary_colour" defaultValue={primary} className="h-11 w-14 cursor-pointer rounded-[10px] border border-beige-strong bg-paper p-1" />
            </Field>
            <Field label="Stamp colour" name="secondary_colour" hint="Stamps and accents." error={errors.secondary_colour}>
              <input type="color" id="secondary_colour" name="secondary_colour" defaultValue={secondary} className="h-11 w-14 cursor-pointer rounded-[10px] border border-beige-strong bg-paper p-1" />
            </Field>
          </div>
          <Island name="ColourFromLogo" props={{ formId: 'preview-form', note: 'Colours taken from the logo. Change them if you like.' }} />
          <fieldset className="grid gap-5 rounded-[16px] border border-beige p-4">
            <legend className="px-1 text-[14px] font-semibold">Reward</legend>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-[120px_minmax(0,1fr)]">
              <Field label="Stamps" name="stamps_required" error={errors.stamps_required}>
                <Input name="stamps_required" type="number" inputMode="numeric" min={2} max={30} required defaultValue={values.stamps_required || '9'} error={errors.stamps_required} />
              </Field>
              <Field label="Reward" name="reward_name" hint="9 stamps + Free coffee reads as “buy 9, the 10th is free”." error={errors.reward_name}>
                <Input name="reward_name" maxLength={80} required defaultValue={values.reward_name || 'Free coffee'} error={errors.reward_name} />
              </Field>
            </div>
            <Field label="What earns a stamp" name="eligible_purchase" optional>
              <Input name="eligible_purchase" maxLength={120} defaultValue={values.eligible_purchase || 'Any coffee'} />
            </Field>
          </fieldset>
          <details className="group rounded-[16px] border border-beige p-4" open={Boolean(errors.banner || errors.tagline || errors.instagram)}>
            <summary className="cursor-pointer text-[14px] font-semibold">More: photo banner, layout, stamp design, Instagram</summary>
            <div className="mt-5 grid gap-6">
          <LookFields
            values={{ page_layout: values.page_layout || 'classic', stamp_icon: values.stamp_icon || 'bean', tagline: values.tagline || '' }}
            errors={errors}
            primary={primary}
            secondary={secondary}
            bannerUrl={bannerUrl}
            showRemoveBanner
          />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Instagram" name="instagram" optional hint="Saved as their website link." error={errors.instagram}>
              <Input name="instagram" maxLength={80} placeholder="@cafename" defaultValue={values.instagram} error={errors.instagram} autoCapitalize="none" />
            </Field>
            <Field label="Prices in" name="default_currency" hint="Used later for points and reports.">
              <Select name="default_currency" defaultValue={values.default_currency || 'TRY'}>
                <option value="TRY">Turkish lira (TRY)</option>
                <option value="EUR">Euro (EUR)</option>
              </Select>
            </Field>
          </div>
            </div>
          </details>
          <div>
            <Button size="lg">{submit}</Button>
          </div>
        </Form>
      </Card>
      <div className="lg:sticky lg:top-6 lg:self-start">
        <p className="mb-2 text-[13px] font-medium text-muted-ink">Their customers’ card</p>
        <Island
          name="BrandPreview"
          props={{
            formId: 'preview-form',
            initial: { name: values.name || 'Café name', logoUrl, bannerUrl, primaryColour: primary, secondaryColour: secondary, layout: (values.page_layout as any) || 'classic', tagline: values.tagline || '' },
            stampIcon: values.stamp_icon || 'bean',
            subtitle: 'Loyalty by Perkora',
            label: 'Preview of the customer card',
          }}
        />
      </div>
    </div>
  );
}

async function saveImages(bizId: string, userId: string, body: any, errors: Record<string, string>) {
  const out: { logo?: string | null; banner?: string | null } = {};
  for (const [fieldName, purpose] of [
    ['logo', 'logo'],
    ['banner', 'banner'],
  ] as const) {
    const file = body.files.find((f: any) => f.field === fieldName && f.data.length > 0);
    if (file) {
      try {
        out[fieldName] = await storeImage({ id: bizId }, userId, file, purpose);
      } catch (e) {
        if (e instanceof DomainError) errors[fieldName] = e.message;
        else throw e;
      }
    } else if (field(body, `remove_${fieldName}`) === '1') out[fieldName] = null;
  }
  return out;
}

/** A café photo was added while the layout was left on the default: show the photo. */
async function useBannerLayout(id: string, layout: string) {
  if (layout !== 'classic') return;
  await db.query(`update businesses set settings = jsonb_set(settings, '{pageLayout}', '"banner"') where id = $1`, [id]);
}

async function previewValues(id: string): Promise<{ values: PreviewValues; logoUrl: string | null; bannerUrl: string | null; status: string } | null> {
  const b = await maybeOne<any>(db, `select * from businesses where id = $1 and preview_token is not null`, [id]);
  if (!b) return null;
  const rule = await maybeOne<any>(
    db,
    `select p.config, w.name as reward from loyalty_programmes p left join rewards w on w.programme_id = p.id and w.is_card_reward
      where p.business_id = $1 and p.programme_type = 'stamps' order by p.created_at limit 1`,
    [id],
  );
  const s = businessSettingsSchema.parse(b.settings ?? {});
  return {
    status: b.status,
    logoUrl: b.logo_upload_id ? `/media/${b.logo_upload_id}` : null,
    bannerUrl: b.banner_upload_id ? `/media/${b.banner_upload_id}` : null,
    values: {
      name: b.name,
      city: b.city ?? '',
      address: b.address ?? '',
      instagram: b.website?.startsWith('https://instagram.com/') ? '@' + b.website.slice('https://instagram.com/'.length) : '',
      primary_colour: b.primary_colour,
      secondary_colour: b.secondary_colour,
      default_currency: b.default_currency,
      stamps_required: String(rule?.config?.stampsRequired ?? 9),
      reward_name: rule?.reward ?? 'Free coffee',
      eligible_purchase: rule?.config?.eligiblePurchase ?? 'Any coffee',
      page_layout: s.pageLayout,
      stamp_icon: s.stampIcon,
      tagline: s.tagline,
    },
  };
}

/* ------------------------------------------------------------------ routes */

export function previewRoutes(r: Router) {
  r.get(
    '/admin/previews',
    guard(async (ctx) => {
      const rows = await many<any>(
        db,
        `select b.id, b.name, b.slug, b.city, b.address, b.status, b.preview_token, b.logo_upload_id, b.primary_colour, b.created_at, b.claimed_at,
                u.email as claimed_email
           from businesses b left join users u on u.id = b.claimed_by
          where b.preview_token is not null order by b.claimed_at is not null, b.created_at desc limit 200`,
      );
      const created = ctx.query.get('created');
      return render(
        ctx,
        <AdminLayout tab="previews">
          <PageHeader
            title="Café previews"
            description="Build a café’s card before you visit. Show the link or QR code; the owner taps “Make it mine” and is live."
            actions={
              <a href="/admin/previews/new" className="btn btn-primary">
                New preview
              </a>
            }
          />
          {rows.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-[16px] font-semibold">No previews yet</p>
              <p className="mt-1 text-muted-ink">Add the cafés you’re visiting. Each takes about a minute.</p>
              <a href="/admin/previews/new" className="btn btn-primary mt-4">
                New preview
              </a>
            </Card>
          ) : (
            <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {rows.map((b) => {
                const url = `${appUrl()}/p/${b.preview_token}`;
                const claimed = b.status !== 'preview';
                return (
                  <li key={b.id} className="card p-5">
                    <div className="flex items-start gap-3.5">
                      <CafeMark name={b.name} logoUrl={b.logo_upload_id ? `/media/${b.logo_upload_id}` : null} colour={b.primary_colour} size={52} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[17px] font-semibold">{b.name}</p>
                        <p className="truncate text-[13.5px] text-muted-ink">{[b.address, b.city].filter(Boolean).join(', ')}</p>
                        <p className="mt-1.5">
                          {claimed ? (
                            <>
                              <Badge tone="success">Live since {dateShort(b.claimed_at, 'Asia/Famagusta')}</Badge>
                              {b.claimed_email && <span className="mt-1 block truncate text-[13px] text-muted-ink">Owner: {b.claimed_email}</span>}
                            </>
                          ) : (
                            <Badge tone="accent">Preview · made {relative(b.created_at)}</Badge>
                          )}
                        </p>
                      </div>
                    </div>
                    {claimed ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <a href={`/c/${b.slug}`} target="_blank" rel="noopener" className="btn btn-secondary btn-sm">
                          Customer page
                        </a>
                        <a href="/admin" className="btn btn-ghost btn-sm">
                          See in Cafés
                        </a>
                      </div>
                    ) : (
                      <>
                        <Island name="CopyField" props={{ value: url, copyLabel: 'Copy link', copiedLabel: 'Copied', shareLabel: 'Share', shareTitle: b.name }} />
                        <div className="mt-3 flex flex-wrap gap-2">
                          <a href={`/p/${b.preview_token}`} target="_blank" rel="noopener" className="btn btn-primary btn-sm">
                            Open preview
                          </a>
                          <a
                            href={`https://wa.me/?text=${encodeURIComponent(`${b.name} – your loyalty card on Perkora: ${url}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary btn-sm"
                          >
                            WhatsApp
                          </a>
                          <a href={`/admin/previews/${b.id}`} className="btn btn-secondary btn-sm">
                            Edit
                          </a>
                        </div>
                        <details className="mt-3" open={created === b.id}>
                          <summary className="cursor-pointer text-[14px] font-medium text-espresso">QR code for the owner’s phone</summary>
                          <div className="mt-3 flex items-center gap-4">
                            <div className="w-[160px] shrink-0 rounded-[12px] bg-white p-2 [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg(url, { ecc: 'M' }) }} />
                            <p className="text-[13.5px] text-muted-ink">They point their camera at it and the preview opens on their phone.</p>
                          </div>
                        </details>
                        <details className="mt-2">
                          <summary className="cursor-pointer text-[13.5px] text-muted-ink">Delete…</summary>
                          <Form action={`/admin/previews/${b.id}/delete`} className="mt-2">
                            <Button variant="secondary" size="sm">
                              Delete this preview
                            </Button>
                          </Form>
                        </details>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </AdminLayout>,
        { title: 'Café previews', noindex: true },
      );
    }),
  );

  r.get(
    '/admin/previews/new',
    guard(async (ctx) =>
      render(
        ctx,
        <AdminLayout tab="previews">
          <PageHeader title="New café preview" back={{ href: '/admin/previews', label: 'Previews' }} />
          <PreviewForm action="/admin/previews/new" values={{}} logoUrl={null} bannerUrl={null} submit="Create preview" />
        </AdminLayout>,
        { title: 'New café preview', noindex: true },
      ),
    ),
  );

  r.post(
    '/admin/previews/new',
    guard(async (ctx) => {
      const body = await readBody(ctx, 6 * 1024 * 1024);
      const errors: Record<string, string> = {};
      const { v, data } = readPreviewForm(body, errors);
      const page = (status: number) =>
        render(
          ctx,
          <AdminLayout tab="previews">
            <PageHeader title="New café preview" back={{ href: '/admin/previews', label: 'Previews' }} />
            <PreviewForm action="/admin/previews/new" values={v} errors={errors} logoUrl={null} bannerUrl={null} submit="Create preview" />
          </AdminLayout>,
          { title: 'New café preview', status, noindex: true },
        );
      if (Object.keys(errors).length) return page(422);
      const id = await createPreview(ctx.user!.id, data);
      const imgErrors: Record<string, string> = {};
      const imgs = await saveImages(id, ctx.user!.id, body, imgErrors);
      await db.query(`update businesses set logo_upload_id = coalesce($2::uuid, logo_upload_id), banner_upload_id = coalesce($3::uuid, banner_upload_id) where id = $1`, [id, imgs.logo ?? null, imgs.banner ?? null]);
      if (imgs.banner) await useBannerLayout(id, data.look.pageLayout);
      if (Object.keys(imgErrors).length) return redirect(ctx, `/admin/previews/${id}`, { type: 'error', message: Object.values(imgErrors)[0] });
      return redirect(ctx, `/admin/previews?created=${id}`, { type: 'success', message: `${data.name} is ready. Open it or show the QR code.` });
    }),
  );

  r.get(
    '/admin/previews/:id',
    guard(async (ctx) => {
      const p = await previewValues(ctx.params.id);
      if (!p) throw notFound('Preview');
      if (p.status !== 'preview') return redirect(ctx, '/admin/previews', { type: 'info', message: 'This café is live now. Its owner manages it.' });
      return render(
        ctx,
        <AdminLayout tab="previews">
          <PageHeader title={p.values.name} back={{ href: '/admin/previews', label: 'Previews' }} />
          <PreviewForm action={`/admin/previews/${ctx.params.id}`} values={p.values} logoUrl={p.logoUrl} bannerUrl={p.bannerUrl} submit="Save preview" />
        </AdminLayout>,
        { title: `Edit ${p.values.name}`, noindex: true },
      );
    }),
  );

  r.post(
    '/admin/previews/:id',
    guard(async (ctx) => {
      const id = ctx.params.id;
      const current = await previewValues(id);
      if (!current) throw notFound('Preview');
      if (current.status !== 'preview') return redirect(ctx, '/admin/previews', { type: 'info', message: 'This café is live now. Its owner manages it.' });
      const body = await readBody(ctx, 6 * 1024 * 1024);
      const errors: Record<string, string> = {};
      const { v, data } = readPreviewForm(body, errors);
      if (Object.keys(errors).length) {
        return render(
          ctx,
          <AdminLayout tab="previews">
            <PageHeader title={current.values.name} back={{ href: '/admin/previews', label: 'Previews' }} />
            <PreviewForm action={`/admin/previews/${id}`} values={v} errors={errors} logoUrl={current.logoUrl} bannerUrl={current.bannerUrl} submit="Save preview" />
          </AdminLayout>,
          { title: 'Edit preview', status: 422, noindex: true },
        );
      }
      await updatePreview(id, data);
      const imgErrors: Record<string, string> = {};
      const imgs = await saveImages(id, ctx.user!.id, body, imgErrors);
      await db.query(
        `update businesses set logo_upload_id = case when $2 then $3::uuid else logo_upload_id end,
                               banner_upload_id = case when $4 then $5::uuid else banner_upload_id end where id = $1`,
        [id, imgs.logo !== undefined, imgs.logo ?? null, imgs.banner !== undefined, imgs.banner ?? null],
      );
      if (imgs.banner) await useBannerLayout(id, data.look.pageLayout);
      if (Object.keys(imgErrors).length) return redirect(ctx, `/admin/previews/${id}`, { type: 'error', message: Object.values(imgErrors)[0] });
      return redirect(ctx, '/admin/previews', { type: 'success', message: 'Preview saved.' });
    }),
  );

  r.post(
    '/admin/previews/:id/delete',
    guard(async (ctx) => {
      await readBody(ctx);
      await tx(async (q) => {
        const b = await maybeOne<{ id: string }>(q, `select id from businesses where id = $1 and status = 'preview' and preview_token is not null for update`, [ctx.params.id]);
        if (!b) throw notFound('Preview');
        for (const sql of [
          'delete from rewards where business_id = $1',
          'delete from loyalty_programmes where business_id = $1',
          'delete from audit_logs where business_id = $1',
          'update businesses set logo_upload_id = null, banner_upload_id = null where id = $1',
          'delete from uploads where business_id = $1',
          'delete from businesses where id = $1',
        ])
          await q.query(sql, [b.id]);
      });
      return redirect(ctx, '/admin/previews', { type: 'success', message: 'Preview deleted.' });
    }),
  );

  /* ---------------- the owner's side */

  r.get('/p/:token', async (ctx) => {
    const found = await byToken(ctx.params.token);
    if (!found) throw notFound('Preview');
    const { cafe, row } = found;
    if (row.status !== 'preview') return render(ctx, <ClaimedPage cafe={cafe} />, { title: cafe.name, noindex: true });
    rememberPreview(ctx, ctx.params.token);
    const plans = await loadPlans(db);
    const cheapest = plans.filter((p) => p.monthlyPriceMinor > 0).sort((a, b) => a.monthlyPriceMinor - b.monthlyPriceMinor)[0];
    const previewUrl = `${appUrl()}/p/${ctx.params.token}`;
    const joinUrl = `${appUrl()}/c/${cafe.slug}`;
    return render(
      ctx,
      <PreviewPage
        cafe={cafe}
        token={ctx.params.token}
        rule={await previewRule(cafe.id)}
        previewUrl={previewUrl}
        joinUrl={`/c/${cafe.slug}`}
        posterSvg={qrSvg(joinUrl, { ecc: 'Q' })}
        phoneSvg={qrSvg(previewUrl, { ecc: 'M' })}
        price={cheapest ? moneyWhole(cheapest.monthlyPriceMinor, cheapest.currency) : null}
      />,
      { title: fmt(ctx.t.preview.metaTitle, { cafe: cafe.name }), noindex: true, themeColor: cafe.primaryColour },
    );
  });

  r.get('/p/:token/claim', async (ctx) => {
    const found = await byToken(ctx.params.token);
    if (!found) throw notFound('Preview');
    const { cafe, row } = found;
    if (row.status !== 'preview') return render(ctx, <ClaimedPage cafe={cafe} />, { title: cafe.name, noindex: true });
    rememberPreview(ctx, ctx.params.token);
    return render(ctx, <ClaimPage cafe={cafe} token={ctx.params.token} rule={await previewRule(cafe.id)} adminBlocked={ctx.user?.platformRole === 'admin'} />, {
      title: fmt(ctx.t.preview.claimTitle, { cafe: cafe.name }),
      noindex: true,
      themeColor: cafe.primaryColour,
    });
  });

  r.post('/p/:token/claim', async (ctx) => {
    const token = ctx.params.token;
    const found = await byToken(token);
    if (!found) throw notFound('Preview');
    const { cafe, row } = found;
    if (row.status !== 'preview') return render(ctx, <ClaimedPage cafe={cafe} />, { title: cafe.name, noindex: true });
    const rule = await previewRule(cafe.id);
    const body = await readBody(ctx);
    const values = formObject(body);
    const page = (errors: Record<string, string>, status: number) =>
      render(ctx, <ClaimPage cafe={cafe} token={token} rule={rule} errors={errors} values={values} adminBlocked={ctx.user?.platformRole === 'admin'} />, {
        title: fmt(ctx.t.preview.claimTitle, { cafe: cafe.name }),
        status,
        noindex: true,
      });
    if (ctx.user?.platformRole === 'admin') return page({}, 409);
    if (!ctx.user) {
      const parsed = signUpSchema.safeParse(values);
      if (!parsed.success) return page(zodErrors(parsed.error), 422);
      try {
        await rateLimit(`signup:${ctx.ip}`, 10, 3600);
      } catch (e) {
        if (e instanceof DomainError) return page({ form: ctx.t.errors.tooMany }, 429);
        throw e;
      }
      let userId: string;
      try {
        userId = (await tx((q) => createUser(q, { ...parsed.data, locale: ctx.locale }))).id;
      } catch (e) {
        if (e instanceof DomainError && e.code === 'conflict') return page({ email: ctx.t.auth.emailTaken }, 409);
        throw e;
      }
      await createSession(ctx, userId);
      ctx.user = { id: userId, name: parsed.data.name, email: parsed.data.email, platformRole: null, locale: ctx.locale, isDemo: false };
    }
    const ok = await claimPreview(cafe.id, { id: ctx.user.id, name: ctx.user.name, email: ctx.user.email });
    if (!ok) return render(ctx, <ClaimedPage cafe={cafe} />, { title: cafe.name, noindex: true });
    selectBusiness(ctx, cafe.id);
    return redirect(ctx, '/onboarding/done', { type: 'success', message: fmt(ctx.t.preview.welcome, { cafe: cafe.name }) });
  });
}

/* ------------------------------------------------------------------ data */

type PreviewData = ReturnType<typeof readPreviewForm>['data'];

export async function createPreview(adminId: string, d: PreviewData): Promise<string> {
  return tx(async (q) => {
    const slug = await uniqueSlug(q, slugify(d.name));
    const token = randomCode(12).toLowerCase();
    const settings = businessSettingsSchema.parse({ pageLayout: d.look.pageLayout, stampIcon: d.look.stampIcon, tagline: d.look.tagline });
    const b = await one<{ id: string }>(
      q,
      `insert into businesses (name, slug, owner_user_id, city, address, website, primary_colour, secondary_colour, timezone, default_currency,
                               status, onboarding_step, settings, preview_token, preview_created_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,'Asia/Famagusta',$9,'preview',6,$10,$11,$3) returning id`,
      [d.name, slug, adminId, d.city, d.address, d.website, d.primary, d.secondary, d.currency, settings, token],
    );
    const p = await one<{ id: string }>(
      q,
      `insert into loyalty_programmes (business_id, name, programme_type, config) values ($1, 'Coffee Club', 'stamps', $2) returning id`,
      [b.id, { stampsRequired: d.need, eligiblePurchase: d.eligible, maxStampsPerTransaction: 2, allowWithOtherPromotions: false }],
    );
    await q.query(`insert into rewards (business_id, programme_id, name, reward_type, icon, stamps_cost, is_card_reward, validity_days) values ($1,$2,$3,'free_item','coffee',$4,true,30)`, [
      b.id,
      p.id,
      d.reward,
      d.need,
    ]);
    await q.query(`insert into audit_logs (business_id, actor_user_id, action, target_type, target_id) values ($1, $2, 'business.preview_created', 'business', $3)`, [b.id, adminId, b.id]);
    return b.id;
  });
}

async function updatePreview(id: string, d: PreviewData) {
  await tx(async (q) => {
    const b = await one<any>(q, `select settings from businesses where id = $1 and status = 'preview' for update`, [id]);
    const settings = businessSettingsSchema.parse({ ...(b.settings ?? {}), pageLayout: d.look.pageLayout, stampIcon: d.look.stampIcon, tagline: d.look.tagline });
    await q.query(
      `update businesses set name=$2, city=$3, address=$4, website=$5, primary_colour=$6, secondary_colour=$7, default_currency=$8, settings=$9, updated_at=now() where id=$1`,
      [id, d.name, d.city, d.address, d.website, d.primary, d.secondary, d.currency, settings],
    );
    const p = await maybeOne<any>(q, `select id, config from loyalty_programmes where business_id = $1 and programme_type = 'stamps' order by created_at limit 1`, [id]);
    if (p) {
      await q.query(`update loyalty_programmes set config = $2, updated_at = now() where id = $1`, [p.id, { ...p.config, stampsRequired: d.need, eligiblePurchase: d.eligible }]);
      await q.query(`update rewards set name = $2, stamps_cost = $3, updated_at = now() where programme_id = $1 and is_card_reward`, [p.id, d.reward, d.need]);
    }
  });
}

/** Hand a preview café to its owner: they become the owner, the free trial starts and the card goes live. */
export async function claimPreview(businessId: string, user: { id: string; name: string; email: string }): Promise<boolean> {
  return tx(async (q) => {
    const b = await maybeOne<{ id: string }>(q, `select id from businesses where id = $1 and status = 'preview' for update`, [businessId]);
    if (!b) return false;
    await q.query(
      `update businesses set status = 'active', owner_user_id = $2, owner_name = coalesce(owner_name, $3), business_email = coalesce(business_email, $4),
              activated_at = now(), onboarding_step = 6, claimed_at = now(), claimed_by = $2, updated_at = now() where id = $1`,
      [b.id, user.id, user.name, user.email],
    );
    await q.query(`insert into business_members (business_id, user_id, role) values ($1, $2, 'owner') on conflict do nothing`, [b.id, user.id]);
    const sub = await maybeOne(q, `select 1 from subscriptions where business_id = $1`, [b.id]);
    if (!sub) {
      await q.query(`insert into subscriptions (business_id, plan_id, status, payment_status, trial_ends_at) values ($1, 'premium', 'trialing', 'not_collected', now() + interval '30 days')`, [b.id]);
    }
    await q.query(`insert into audit_logs (business_id, actor_user_id, action, target_type, target_id) values ($1, $2, 'business.claimed', 'business', $3)`, [b.id, user.id, b.id]);
    return true;
  });
}

