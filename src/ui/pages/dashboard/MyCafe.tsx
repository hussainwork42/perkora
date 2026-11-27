import type { ReactNode } from 'react';
import { LuCamera, LuDownload, LuExternalLink, LuGift, LuImage, LuMapPin, LuMegaphone, LuPalette, LuPencil, LuPlus, LuQrCode, LuMessageSquareText, LuStamp, LuTrash2, LuUsers } from 'react-icons/lu';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { Badge, Button, Form, Input } from '../../components/ui';
import { CafeMark, RewardBadgeIcon } from '../../components/brand';
import { Island } from '../../islands/Island';
import { PreviewPhone } from '../preview/PreviewPages';
import { contrastText, mix } from '../../cn';
import type { BusinessContext } from '../../../server/auth/guards';
import type { PublicCafe } from '../../../server/domain/views';

export interface MyCafeData {
  cafe: PublicCafe;
  phone: string | null;
  card: { programmeId: string; need: number; reward: string; eligible: string } | null;
  rewards: { id: string; name: string; isCard: boolean; status: string; cost: string }[];
  offers: { id: string; name: string; status: string; benefit: string | null }[];
  members: number;
  joinUrl: string;
  qr: string;
  canOffers: boolean;
}

/** One part of the café, with its own "Change" panel that opens in place. */
function Part({ id, icon, title, summary, open, action, children }: { id: string; icon: ReactNode; title: string; summary: ReactNode; open?: boolean; action?: ReactNode; children?: ReactNode }) {
  const head = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-terracotta-tint text-terracotta-ink">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15.5px] font-semibold">{title}</span>
        <span className="block text-[13.5px] text-muted-ink">{summary}</span>
      </span>
    </>
  );
  if (!children) {
    return (
      <div id={id} className="card flex items-center gap-3.5 p-4">
        {head}
        {action}
      </div>
    );
  }
  return (
    <details id={id} className="card group p-4" open={open}>
      <summary className="flex cursor-pointer list-none items-center gap-3.5 [&::-webkit-details-marker]:hidden">
        {head}
        <span className="btn btn-secondary btn-sm shrink-0 group-open:hidden">
          <LuPencil className="h-3.5 w-3.5" aria-hidden="true" /> Change
        </span>
        <span className="btn btn-ghost btn-sm hidden shrink-0 group-open:inline-flex">Close</span>
      </summary>
      <div className="mt-4 border-t border-beige pt-4">{children}</div>
    </details>
  );
}

export function MyCafePage({ biz, d, open }: { biz: BusinessContext; d: MyCafeData; open: string }) {
  const c = d.cafe;
  const fg = contrastText(c.primaryColour);
  const heroBg = c.bannerUrl
    ? `linear-gradient(180deg, ${mix(c.primaryColour, '#000000', 0.1)}33 0%, ${mix(c.primaryColour, '#000000', 0.35)}e6 100%), center/cover no-repeat url(${c.bannerUrl})`
    : `radial-gradient(120% 120% at 100% 0%, ${mix(c.primaryColour, '#ffffff', 0.25)} 0%, transparent 55%), linear-gradient(160deg, ${mix(c.primaryColour, '#ffffff', 0.06)}, ${mix(c.primaryColour, '#000000', 0.28)})`;
  const heroFg = c.bannerUrl ? '#FFFFFF' : fg;
  const instagram = c.website?.startsWith('https://instagram.com/') ? '@' + c.website.slice('https://instagram.com/'.length) : '';
  const place = [c.address, c.city].filter(Boolean).join(', ');
  const extraRewards = d.rewards.filter((r) => !r.isCard);
  return (
    <DashboardLayout biz={biz} active="cafe">
      {/* the café, as big as it deserves */}
      <section className="relative overflow-hidden rounded-[24px] shadow-[var(--shadow-raised)]" style={{ background: heroBg, color: heroFg }}>
        <div className="flex min-h-[230px] flex-col justify-end gap-5 p-5 sm:min-h-[270px] sm:p-8">
          <div className="absolute right-4 top-4 flex gap-2 sm:right-6 sm:top-6">
            <a href={`/c/${c.slug}`} target="_blank" rel="noopener" className="btn btn-sm border border-white/30 bg-white/15 backdrop-blur hover:bg-white/25" style={{ color: heroFg }}>
              <LuExternalLink className="h-4 w-4" aria-hidden="true" /> <span className="hidden sm:inline">See it as a customer</span>
              <span className="sm:hidden">Customer view</span>
            </a>
          </div>
          <div className="flex items-end gap-4">
            <CafeMark name={c.name} logoUrl={c.logoUrl} colour={mix(c.primaryColour, '#ffffff', 0.12)} size={84} className="shrink-0 ring-4 ring-white/40 shadow-lg" />
            <div className="min-w-0 pb-1">
              <h1 className="font-display text-[30px] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-[40px]" style={{ color: heroFg, textShadow: c.bannerUrl ? '0 1px 12px rgb(0 0 0 / 0.35)' : undefined }}>
                {c.name}
              </h1>
              {c.settings.tagline && <p className="mt-1.5 max-w-[52ch] text-[15px] opacity-90">{c.settings.tagline}</p>}
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] opacity-85">
                {place && (
                  <span className="inline-flex items-center gap-1">
                    <LuMapPin className="h-3.5 w-3.5" aria-hidden="true" /> {place}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <LuUsers className="h-3.5 w-3.5" aria-hidden="true" /> {d.members} {d.members === 1 ? 'member' : 'members'}
                </span>
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          {/* how it looks */}
          <section>
            <h2 className="mb-3 text-[18px] font-semibold">How your café looks</h2>
            <div className="grid grid-cols-1 gap-3">
              <Part id="logo" open={open === 'logo'} icon={<LuCamera className="h-[18px] w-[18px]" />} title="Logo" summary={c.logoUrl ? 'Shown on cards, the poster and the café list.' : 'No logo yet — add one so customers recognise you.'}>
                <Form action="/dashboard/cafe/image/logo" multipart className="grid gap-3">
                  <Island name="ImagePicker" props={{ name: 'logo', label: 'Logo', current: c.logoUrl, maxSide: 600, shape: 'square', hint: 'PNG, JPEG or WebP. A square picture works best.' }} />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm">Save logo</Button>
                    {c.logoUrl && (
                      <button type="submit" name="remove" value="1" className="btn btn-ghost btn-sm text-error" formNoValidate>
                        Remove logo
                      </button>
                    )}
                  </div>
                </Form>
              </Part>

              <Part
                id="banner"
                open={open === 'banner'}
                icon={<LuImage className="h-[18px] w-[18px]" />}
                title="Café photo"
                summary={c.bannerUrl ? 'Shown across the top of your page.' : 'Add a photo of your café, counter or coffee.'}
              >
                <Form action="/dashboard/cafe/image/banner" multipart className="grid gap-3">
                  <Island name="ImagePicker" props={{ name: 'banner', label: 'Café photo', current: c.bannerUrl, maxSide: 1600, shape: 'wide', hint: 'A wide photo works best. Large photos are made smaller automatically.' }} />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm">Save photo</Button>
                    {c.bannerUrl && (
                      <button type="submit" name="remove" value="1" className="btn btn-ghost btn-sm text-error" formNoValidate>
                        Remove photo
                      </button>
                    )}
                  </div>
                </Form>
              </Part>

              <Part
                id="colours"
                open={open === 'colours'}
                icon={<LuPalette className="h-[18px] w-[18px]" />}
                title="Colours"
                summary={
                  <span className="flex items-center gap-2">
                    <span className="flex shrink-0 -space-x-1">
                      <span className="inline-block h-4 w-4 rounded-full ring-2 ring-paper" style={{ background: c.primaryColour }} />
                      <span className="inline-block h-4 w-4 rounded-full ring-2 ring-paper" style={{ background: c.secondaryColour }} />
                    </span>
                    <span>Your card, stamps and this dashboard use them.</span>
                  </span>
                }
              >
                <Form action="/dashboard/cafe/colours" className="grid gap-4">
                  <div className="flex flex-wrap gap-6">
                    <label className="grid gap-1.5 text-[14px] font-medium">
                      Main colour
                      <input type="color" name="primary_colour" defaultValue={c.primaryColour} className="h-11 w-16 cursor-pointer rounded-[10px] border border-beige-strong bg-paper p-1" />
                    </label>
                    <label className="grid gap-1.5 text-[14px] font-medium">
                      Stamp colour
                      <input type="color" name="secondary_colour" defaultValue={c.secondaryColour} className="h-11 w-16 cursor-pointer rounded-[10px] border border-beige-strong bg-paper p-1" />
                    </label>
                  </div>
                  <div>
                    <Button size="sm">Save colours</Button>
                  </div>
                  <p className="text-[13px] text-muted-ink">
                    Layout and stamp design are in{' '}
                    <a className="link" href="/dashboard/settings/branding">
                      Settings → Branding
                    </a>
                    .
                  </p>
                </Form>
              </Part>

              <Part
                id="welcome"
                open={open === 'welcome'}
                icon={<LuMessageSquareText className="h-[18px] w-[18px]" />}
                title="Welcome line"
                summary={c.settings.tagline ? `“${c.settings.tagline}”` : 'A short line under your name, like “Fresh coffee by the harbour”.'}
              >
                <Form action="/dashboard/cafe/welcome" className="grid gap-3">
                  <label className="sr-only" htmlFor="tagline">
                    Welcome line
                  </label>
                  <Input id="tagline" name="tagline" maxLength={140} defaultValue={c.settings.tagline} placeholder="Fresh coffee by the harbour" />
                  <div>
                    <Button size="sm">Save</Button>
                  </div>
                </Form>
              </Part>

              <Part
                id="location"
                open={open === 'location'}
                icon={<LuMapPin className="h-[18px] w-[18px]" />}
                title="Where to find you"
                summary={[place, d.phone, instagram].filter(Boolean).join(' · ') || 'Add your address, phone and Instagram.'}
              >
                <Form action="/dashboard/cafe/location" className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-[14px] font-medium">
                    Address or area
                    <Input name="address" maxLength={160} defaultValue={c.address ?? ''} />
                  </label>
                  <label className="grid gap-1.5 text-[14px] font-medium">
                    City
                    <Input name="city" maxLength={80} defaultValue={c.city ?? ''} />
                  </label>
                  <label className="grid gap-1.5 text-[14px] font-medium">
                    Phone
                    <Input name="phone" type="tel" maxLength={40} defaultValue={d.phone ?? ''} />
                  </label>
                  <label className="grid gap-1.5 text-[14px] font-medium">
                    Instagram
                    <Input name="instagram" maxLength={80} defaultValue={instagram} placeholder="@yourcafe" autoCapitalize="none" />
                  </label>
                  <div className="sm:col-span-2">
                    <Button size="sm">Save details</Button>
                  </div>
                </Form>
              </Part>
            </div>
          </section>

          {/* what customers get */}
          <section>
            <h2 className="mb-3 text-[18px] font-semibold">What customers get</h2>
            <div className="grid grid-cols-1 gap-3">
              <Part
                id="card"
                icon={<LuStamp className="h-[18px] w-[18px]" />}
                title="Loyalty card"
                summary={d.card ? `${d.card.need} stamps → ${d.card.reward}${d.card.eligible ? ` · a stamp for: ${d.card.eligible.toLowerCase()}` : ''}` : 'No stamp card yet.'}
                action={
                  <a className="btn btn-secondary btn-sm shrink-0" href={d.card ? `/dashboard/programmes/${d.card.programmeId}` : '/dashboard/programmes/new'}>
                    <LuPencil className="h-3.5 w-3.5" aria-hidden="true" /> {d.card ? 'Change' : 'Create'}
                  </a>
                }
              />
              <div className="card p-4">
                <div className="flex items-center gap-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-terracotta-tint text-terracotta-ink">
                    <LuGift className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15.5px] font-semibold">Extra rewards</span>
                    <span className="block text-[13.5px] text-muted-ink">For points, birthdays, or anything you give by hand.</span>
                  </span>
                  <a href="/dashboard/rewards/new" className="btn btn-primary btn-sm shrink-0">
                    <LuPlus className="h-4 w-4" aria-hidden="true" /> Add
                  </a>
                </div>
                {extraRewards.length > 0 && (
                  <ul className="mt-3 divide-y divide-beige border-t border-beige">
                    {extraRewards.map((r) => (
                      <li key={r.id} className="flex items-center gap-3 py-2.5">
                        <a href={`/dashboard/rewards/${r.id}`} className="min-w-0 flex-1 hover:underline">
                          <span className="block truncate text-[14.5px] font-medium">{r.name}</span>
                          <span className="block text-[12.5px] text-muted-ink">
                            {r.cost}
                            {r.status !== 'active' ? ' · hidden' : ''}
                          </span>
                        </a>
                        <Form action={`/dashboard/cafe/rewards/${r.id}/remove`}>
                          <button type="submit" className="btn btn-ghost btn-sm text-error" aria-label={`Remove ${r.name}`}>
                            <LuTrash2 className="h-4 w-4" aria-hidden="true" /> <span className="hidden sm:inline">Remove</span>
                          </button>
                        </Form>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="card p-4">
                <div className="flex items-center gap-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-terracotta-tint text-terracotta-ink">
                    <LuMegaphone className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15.5px] font-semibold">Offers</span>
                    <span className="block text-[13.5px] text-muted-ink">{d.canOffers ? 'Double stamps, happy hour, a treat for regulars.' : 'Offers and campaigns come with Premium.'}</span>
                  </span>
                  {d.canOffers ? (
                    <a href="/dashboard/campaigns/new" className="btn btn-primary btn-sm shrink-0">
                      <LuPlus className="h-4 w-4" aria-hidden="true" /> Add
                    </a>
                  ) : (
                    <a href="/dashboard/subscription" className="btn btn-secondary btn-sm shrink-0">
                      See plans
                    </a>
                  )}
                </div>
                {d.offers.length > 0 && (
                  <ul className="mt-3 divide-y divide-beige border-t border-beige">
                    {d.offers.map((o) => (
                      <li key={o.id}>
                        <a href={`/dashboard/campaigns/${o.id}`} className="flex items-center gap-3 py-2.5 hover:underline">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14.5px] font-medium">{o.name}</span>
                            {o.benefit && <span className="block truncate text-[12.5px] text-muted-ink">{o.benefit}</span>}
                          </span>
                          <Badge tone={o.status === 'published' ? 'success' : o.status === 'paused' ? 'warning' : 'neutral'}>{o.status === 'published' ? 'Live' : o.status === 'paused' ? 'Paused' : 'Draft'}</Badge>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* right column: what customers see, and the poster */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          {d.card && (
            <div>
              <p className="mb-2 text-center text-[13px] font-medium text-muted-ink">What customers see</p>
              <PreviewPhone cafe={c} rule={{ need: d.card.need, reward: d.card.reward }} filled={Math.max(1, Math.round(d.card.need * 0.6))} />
            </div>
          )}
          <div className="card p-4 text-center">
            <p className="flex items-center justify-center gap-1.5 text-[15px] font-semibold">
              <LuQrCode className="h-4 w-4" aria-hidden="true" /> Your QR code
            </p>
            <div className="mx-auto mt-3 w-[150px] rounded-[12px] bg-white p-2 [&>svg]:h-auto [&>svg]:w-full" aria-hidden="true" dangerouslySetInnerHTML={{ __html: d.qr }} />
            <p className="mt-2 text-[13px] text-muted-ink">Customers scan it to get your card.</p>
            <a href="/dashboard/settings/qr" className="btn btn-primary btn-sm mt-3 w-full">
              <LuDownload className="h-4 w-4" aria-hidden="true" /> Download poster
            </a>
          </div>
        </aside>
      </div>
    </DashboardLayout>
  );
}
