import { LuChevronRight, LuMapPin, LuQrCode, LuSparkles } from 'react-icons/lu';
import { usePage } from '../../page-context';
import { Island } from '../../islands/Island';
import { CafeMark, Logo, RewardBadgeIcon } from '../../components/brand';
import { Alert, Button, Checkbox, DemoBanner, Field, FlashMessage, Form, Input, LanguageSwitcher, Select, TermsNote } from '../../components/ui';
import { PlainCustomerLayout, WalletLayout, type WalletCafe } from '../../layouts/WalletLayout';
import { ActivityList, ChallengeCard, OfferCard, PointsPanel, ProgrammeSummary, StampCardPanel, VoucherCard } from './parts';
import { fmt, plural } from '../../../shared/i18n';
import { dateShort, formatMemberCode, num } from '../../../shared/format';
import type { MemberView, OfferView, ProgrammeView, PublicCafe } from '../../../server/domain/views';
import { contrastText } from '../../cn';

/* ---------------------------------------------------------------- public café page */

export function CafePublicPage({ cafe, programmes, offers, state, errors = {}, values = {}, referral }: {
  cafe: PublicCafe;
  programmes: ProgrammeView[];
  offers: OfferView[];
  state: 'guest' | 'signed-in' | 'member' | 'unavailable';
  errors?: Record<string, string>;
  values?: Record<string, string>;
  referral?: { code: string; valid: boolean } | null;
}) {
  const { t, user } = usePage();
  const fg = contrastText(cafe.primaryColour);
  return (
    <div className="min-h-screen bg-cream pb-16">
      {cafe.isDemo && <DemoBanner />}
      <header style={{ background: cafe.primaryColour, color: fg }}>
        <div className="mx-auto flex max-w-[560px] items-center justify-between px-4 pt-4">
          <span className="text-[12.5px] opacity-75">{t.common.poweredBy}</span>
          <LanguageSwitcher tone={fg === '#292421' ? 'light' : 'dark'} />
        </div>
        <div className="mx-auto max-w-[560px] px-4 pb-10 pt-6">
          <CafeMark name={cafe.name} logoUrl={cafe.logoUrl} colour={cafe.secondaryColour} size={64} className="ring-2 ring-white/25" />
          <h1 className="mt-4 text-[30px] font-semibold leading-tight" style={{ color: fg }}>
            {fmt(t.cafe.joinTitle, { cafe: cafe.name })}
          </h1>
          {cafe.description && <p className="mt-2 max-w-[46ch] text-[15.5px] opacity-80">{cafe.description}</p>}
          {(cafe.city || cafe.address) && (
            <p className="mt-3 flex items-center gap-1.5 text-[13.5px] opacity-75">
              <LuMapPin className="h-4 w-4" aria-hidden="true" />
              {[cafe.address, cafe.city].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
      </header>

      <main className="mx-auto -mt-5 max-w-[560px] space-y-4 px-4">
        <FlashMessage />
        {state === 'unavailable' ? (
          <Alert tone="warning">{t.cafe.unavailable}</Alert>
        ) : (
          <>
            {referral && <Alert tone={referral.valid ? 'success' : 'info'}>{referral.valid ? t.cafe.referralApplied : t.cafe.referralInvalid}</Alert>}
            <section className="card p-5">
              <h2 className="text-[17px] font-semibold">{t.cafe.programmes}</h2>
              <div className="mt-3 space-y-4 divide-y divide-beige">
                {programmes.map((p) => (
                  <div key={p.id} className="flex gap-3 pt-4 first:pt-0">
                    <RewardBadgeIcon icon={p.type === 'stamps' ? (p.cardReward?.icon ?? 'coffee') : 'star'} size="sm" />
                    <div>
                      <p className="text-[13px] font-medium text-muted-ink">{p.name}</p>
                      <ProgrammeSummary p={p} currency={cafe.currency} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {state === 'member' ? (
              <section className="card p-5 text-center">
                <p className="text-[15px] font-medium">{t.cafe.alreadyMember}</p>
                <a href={`/wallet/${cafe.slug}`} className="btn btn-primary btn-lg mt-4 w-full">
                  {t.cafe.openCard}
                </a>
              </section>
            ) : state === 'signed-in' ? (
              <section className="card p-5">
                <Form action={`/c/${cafe.slug}/join`} className="space-y-4">
                  {referral?.valid && <input type="hidden" name="ref" value={referral.code} />}
                  <Checkbox name="marketing" value="1" label={fmt(t.cafe.marketing, { cafe: cafe.name })} hint={t.cafe.marketingHelp} />
                  <Button size="lg" className="w-full">
                    {fmt(t.cafe.joinSignedIn, { name: user?.name.split(' ')[0] ?? '' })}
                  </Button>
                </Form>
              </section>
            ) : (
              <section className="card p-5">
                <h2 className="text-[17px] font-semibold">{t.cafe.join}</h2>
                <Form action={`/c/${cafe.slug}/join`} className="mt-4 space-y-4" noValidate>
                  {referral?.valid && <input type="hidden" name="ref" value={referral.code} />}
                  {errors.form && <Alert tone="error">{errors.form}</Alert>}
                  <Field label={t.common.name} name="name" error={errors.name}>
                    <Input name="name" autoComplete="name" required maxLength={120} defaultValue={values.name} error={errors.name} />
                  </Field>
                  <Field label={t.common.email} name="email" error={errors.email}>
                    <Input name="email" type="email" autoComplete="email" required defaultValue={values.email} error={errors.email} />
                  </Field>
                  <Field label={t.common.password} name="password" hint={t.auth.passwordHint} error={errors.password}>
                    <Input name="password" type="password" autoComplete="new-password" required minLength={10} error={errors.password} />
                  </Field>
                  <Checkbox name="marketing" value="1" defaultChecked={values.marketing === '1'} label={fmt(t.cafe.marketing, { cafe: cafe.name })} hint={t.cafe.marketingHelp} />
                  <TermsNote />
                  <Button size="lg" className="w-full">
                    {t.cafe.joinCta}
                  </Button>
                </Form>
                <p className="mt-4 text-center text-[14px]">
                  <a className="link" href={`/sign-in?next=${encodeURIComponent(`/c/${cafe.slug}${referral?.valid ? `?ref=${referral.code}` : ''}`)}`}>
                    {t.cafe.signInToJoin}
                  </a>
                </p>
              </section>
            )}

            {cafe.isDemo && state !== 'member' && (
              <section className="rounded-[14px] border border-dashed border-warning/60 bg-warning-tint/60 p-5">
                <p className="flex items-center gap-2 text-[14.5px] font-semibold text-warning-ink">
                  <LuSparkles className="h-4 w-4" aria-hidden="true" /> {t.cafe.demoShortcut}
                </p>
                <p className="mt-1 text-[14px] text-ink/80">{t.cafe.demoShortcutBody}</p>
                <Form action={`/c/${cafe.slug}/demo-join`} className="mt-3">
                  <Button variant="secondary" className="w-full">
                    {t.cafe.demoShortcutButton}
                  </Button>
                </Form>
              </section>
            )}

            {offers.length > 0 && (
              <section>
                <h2 className="mb-3 mt-6 text-[17px] font-semibold">{t.cafe.offers}</h2>
                <div className="space-y-3">
                  {offers.map((o) => (
                    <OfferCard key={o.id} o={o} tz={cafe.timezone} />
                  ))}
                </div>
              </section>
            )}
            {programmes.some((p) => p.terms) && (
              <details className="card p-5 text-[14px]">
                <summary className="cursor-pointer font-medium">{t.cafe.terms}</summary>
                {programmes
                  .filter((p) => p.terms)
                  .map((p) => (
                    <p key={p.id} className="mt-3 whitespace-pre-line text-muted-ink">
                      <span className="font-medium text-ink">{p.name}: </span>
                      {p.terms}
                    </p>
                  ))}
              </details>
            )}
          </>
        )}
        <div className="pt-6 text-center">
          <Logo className="opacity-70" />
        </div>
      </main>
    </div>
  );
}

/* ---------------------------------------------------------------- wallet */

export interface WalletListItem {
  slug: string;
  name: string;
  logoUrl: string | null;
  primaryColour: string;
  summary: string;
  ready: number;
}

export function WalletListPage({ items }: { items: WalletListItem[] }) {
  const { t, user } = usePage();
  return (
    <PlainCustomerLayout>
      <h1 className="text-[28px] font-semibold">{t.wallet.title}</h1>
      {user && <p className="mt-1 text-muted-ink">{fmt(t.wallet.hello, { name: user.name.split(' ')[0] })}</p>}
      <div className="mt-6">
        <FlashMessage />
      </div>
      {items.length === 0 ? (
        <div className="card mt-2 px-6 py-12 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sand">
            <LuQrCode className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-[18px] font-semibold">{t.wallet.empty}</h2>
          <p className="mx-auto mt-1.5 max-w-sm text-[14.5px] text-muted-ink">{t.wallet.emptyBody}</p>
          <a href="/c/perkora-demo-cafe" className="btn btn-secondary mt-5">
            Perkora Demo Café
          </a>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((i) => (
            <li key={i.slug}>
              <a href={`/wallet/${i.slug}`} className="card flex items-center gap-4 p-4 hover:border-beige-strong">
                <CafeMark name={i.name} logoUrl={i.logoUrl} colour={i.primaryColour} size={48} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-semibold">{i.name}</span>
                  <span className="block truncate text-[14px] text-muted-ink">{i.summary}</span>
                  {i.ready > 0 && <span className="badge badge-accent mt-1.5">{plural(t.wallet.rewardsReady, i.ready)}</span>}
                </span>
                <LuChevronRight className="h-5 w-5 text-muted" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 text-center text-[13.5px] text-muted-ink">{t.wallet.addAnother}</p>
    </PlainCustomerLayout>
  );
}

export function WalletCardPage({ cafe, view, offers, welcome, referralsOn, tz }: { cafe: WalletCafe; view: MemberView; offers: OfferView[]; welcome?: boolean; referralsOn: boolean; tz: string }) {
  const { t, user } = usePage();
  const ready = view.vouchers.filter((v) => v.status === 'available');
  const stampColour = '#B86F52';
  return (
    <WalletLayout cafe={cafe} tab="card" referralsOn={referralsOn}>
      <Island name="WalletLive" props={{ url: `/api/wallet/${cafe.slug}/state`, hash: view.stateHash, message: t.wallet.updated }} />
      {welcome && (
        <Alert tone="success" title={fmt(t.cafe.welcomeTitle, { cafe: cafe.name })} className="mb-4">
          {t.cafe.welcomeBody}
        </Alert>
      )}
      <FlashMessage />
      <p className="text-[15px] text-muted-ink">{fmt(t.wallet.hello, { name: (user?.name ?? view.customer.name).split(' ')[0] })}</p>

      <a
        href={`/wallet/${cafe.slug}/code`}
        className="mt-3 flex items-center gap-4 rounded-[16px] bg-espresso px-5 py-4 text-cream hover:bg-coffee"
        style={{ boxShadow: 'var(--shadow-raised)' }}
      >
        <LuQrCode className="h-8 w-8 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-[16.5px] font-semibold">{t.wallet.showAtCounter}</span>
          <span className="block text-[13px] text-cream/70">
            {t.wallet.memberCode} {formatMemberCode(view.membership.memberCode)}
          </span>
        </span>
        <LuChevronRight className="h-5 w-5 opacity-70" aria-hidden="true" />
      </a>

      {ready.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2.5 text-[15px] font-semibold">
            {t.wallet.rewardReady} <span className="badge badge-accent ml-1 tnum">{ready.length}</span>
          </h2>
          <div className="space-y-2.5">
            {ready.map((v) => (
              <VoucherCard key={v.id} v={v} tz={tz} compact />
            ))}
          </div>
        </section>
      )}

      <div className="mt-5 space-y-4">
        {view.programmes.map((p) => (p.type === 'stamps' ? <StampCardPanel key={p.id} p={p} color={stampColour} /> : <PointsPanel key={p.id} p={p} />))}
        {view.challenges.map((c) => (
          <ChallengeCard key={c.id} c={c} tz={tz} />
        ))}
      </div>

      {offers.length > 0 && (
        <section className="mt-6">
          <div className="mb-2.5 flex items-baseline justify-between">
            <h2 className="text-[15px] font-semibold">{t.wallet.tabs.offers}</h2>
            <a href={`/wallet/${cafe.slug}/offers`} className="text-[13.5px] link">
              {t.wallet.seeAll}
            </a>
          </div>
          <OfferCard o={offers[0]} tz={tz} />
        </section>
      )}

      <section className="mt-6">
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold">{t.wallet.recentActivity}</h2>
          <a href={`/wallet/${cafe.slug}/activity`} className="text-[13.5px] link">
            {t.wallet.seeAll}
          </a>
        </div>
        <div className="card px-4">
          <ActivityList items={view.activity.slice(0, 5)} tz={tz} />
        </div>
      </section>
    </WalletLayout>
  );
}

export function WalletCodePage({ cafe, view, referralsOn }: { cafe: WalletCafe; view: MemberView; referralsOn: boolean }) {
  const { t } = usePage();
  return (
    <WalletLayout cafe={cafe} tab="card" referralsOn={referralsOn}>
      <div className="card px-5 py-7 text-center">
        <h1 className="text-[20px] font-semibold">{t.wallet.showAtCounter}</h1>
        <p className="mx-auto mt-1 max-w-xs text-[14px] text-muted-ink">{view.customer.name}</p>
        <Island
          name="MemberQr"
          props={{
            url: `/api/wallet/${cafe.slug}/qr`,
            refreshing: t.wallet.qrRefreshing,
            error: t.wallet.qrError,
          }}
        />
        <p className="mt-5 text-[13px] text-muted-ink">{t.wallet.memberCode}</p>
        <p className="font-display text-[30px] font-semibold tracking-[0.12em] tnum">{formatMemberCode(view.membership.memberCode)}</p>
        <p className="mx-auto mt-4 max-w-xs text-[13px] text-muted-ink">{t.wallet.qrHelp}</p>
      </div>
      <a href={`/wallet/${cafe.slug}`} className="btn btn-secondary mt-4 w-full">
        {t.common.back}
      </a>
    </WalletLayout>
  );
}

export function WalletRewardsPage({ cafe, view, referralsOn, tz }: { cafe: WalletCafe; view: MemberView; referralsOn: boolean; tz: string }) {
  const { t, locale } = usePage();
  const groups = [
    { key: 'available', title: t.wallet.available, items: view.vouchers.filter((v) => v.status === 'available') },
    { key: 'redeemed', title: t.wallet.redeemed, items: view.vouchers.filter((v) => v.status === 'redeemed') },
    { key: 'expired', title: t.wallet.expired, items: view.vouchers.filter((v) => v.status === 'expired') },
  ];
  const points = view.programmes.filter((p) => p.type === 'points');
  return (
    <WalletLayout cafe={cafe} tab="rewards" referralsOn={referralsOn}>
      <h1 className="text-[24px] font-semibold">{t.wallet.tabs.rewards}</h1>
      {view.vouchers.length === 0 && points.every((p) => p.catalogue.length === 0) && <p className="card mt-4 p-6 text-center text-[14.5px] text-muted-ink">{t.wallet.noRewards}</p>}
      {groups[0].items.length > 0 && <RewardGroup title={groups[0].title} items={groups[0].items} tz={tz} />}
      {points.map((p) =>
        p.catalogue.length ? (
          <section key={p.id} className="mt-6">
            <h2 className="mb-2.5 text-[15px] font-semibold">
              {p.name} · {fmt(t.common.pointOne.split('|')[1], { n: num(p.balance, locale) })}
            </h2>
            <ul className="space-y-2.5">
              {p.catalogue.map((r) => {
                const ok = p.balance >= r.cost;
                return (
                  <li key={r.id} className="card flex items-start gap-3.5 p-4">
                    <RewardBadgeIcon icon={r.icon} tone={ok ? 'accent' : 'muted'} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[15.5px] font-semibold">{r.name}</p>
                      {r.description && <p className="text-[14px] text-muted-ink">{r.description}</p>}
                      <p className={ok ? 'mt-1 text-[13px] text-sage-ink font-medium' : 'mt-1 text-[13px] text-muted-ink'}>
                        {fmt(t.wallet.costPoints, { n: num(r.cost, locale) })} · {ok ? t.wallet.affordable : fmt(t.terminal.cannotAfford, { n: num(r.cost - p.balance, locale) })}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null,
      )}
      {groups.slice(1).map((g) => (g.items.length ? <RewardGroup key={g.key} title={g.title} items={g.items} tz={tz} /> : null))}
    </WalletLayout>
  );
}

function RewardGroup({ title, items, tz }: { title: string; items: MemberView['vouchers']; tz: string }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2.5 text-[15px] font-semibold">{title}</h2>
      <div className="space-y-2.5">
        {items.map((v) => (
          <VoucherCard key={v.id} v={v} tz={tz} />
        ))}
      </div>
    </section>
  );
}

export function WalletOffersPage({ cafe, offers, referralsOn, tz, segmentLabels }: { cafe: WalletCafe; offers: OfferView[]; referralsOn: boolean; tz: string; segmentLabels: Record<string, string> }) {
  const { t } = usePage();
  return (
    <WalletLayout cafe={cafe} tab="offers" referralsOn={referralsOn}>
      <h1 className="text-[24px] font-semibold">{t.wallet.tabs.offers}</h1>
      <div className="mt-4 space-y-3">
        {offers.length === 0 ? (
          <p className="card p-6 text-center text-[14.5px] text-muted-ink">{t.wallet.offersEmpty}</p>
        ) : (
          offers.map((o) => <OfferCard key={o.id} o={o} tz={tz} segmentLabel={o.segment !== 'all' ? segmentLabels[o.segment] : undefined} />)
        )}
      </div>
    </WalletLayout>
  );
}

export function WalletActivityPage({ cafe, view, referralsOn, tz }: { cafe: WalletCafe; view: MemberView; referralsOn: boolean; tz: string }) {
  const { t } = usePage();
  return (
    <WalletLayout cafe={cafe} tab="activity" referralsOn={referralsOn}>
      <h1 className="text-[24px] font-semibold">{t.wallet.tabs.activity}</h1>
      <div className="card mt-4 px-4">
        <ActivityList items={view.activity} tz={tz} />
      </div>
    </WalletLayout>
  );
}

export function WalletReferPage({ cafe, view, link, rewards, joined }: { cafe: WalletCafe; view: MemberView; link: string | null; rewards: { mine: string; friend: string } | null; joined: number }) {
  const { t } = usePage();
  return (
    <WalletLayout cafe={cafe} tab="refer" referralsOn>
      <h1 className="text-[24px] font-semibold">{t.wallet.referTitle}</h1>
      {!link || !rewards ? (
        <p className="card mt-4 p-6 text-[14.5px] text-muted-ink">{fmt(t.wallet.referUnavailable, { cafe: cafe.name })}</p>
      ) : (
        <div className="card mt-4 p-5">
          <p className="text-[15px]">{fmt(t.wallet.referBody, { reward: rewards.mine, friend: rewards.friend, friendReward: rewards.friend })}</p>
          <p className="mt-5 text-[13px] font-medium text-muted-ink">{t.wallet.referLink}</p>
          <Island name="CopyField" props={{ value: link, copyLabel: t.common.copy, copiedLabel: t.common.copied, shareLabel: t.wallet.share, shareTitle: cafe.name }} />
          <p className="mt-4 text-[13.5px] text-muted-ink">{plural(t.wallet.referStats, joined)}</p>
          <p className="mt-1 text-[12.5px] text-muted-ink">
            {t.wallet.referYourCode}: <span className="font-medium tracking-[0.06em]">{view.membership.referralCode}</span>
          </p>
        </div>
      )}
    </WalletLayout>
  );
}

/* ---------------------------------------------------------------- account */

export interface AccountMembership {
  id: string;
  cafeName: string;
  slug: string;
  marketingConsent: boolean;
}

export function AccountPage({ profile, memberships, errors = {} }: {
  profile: { name: string; email: string; phone: string | null; birthdayMonth: number | null; birthdayDay: number | null };
  memberships: AccountMembership[];
  errors?: Record<string, string>;
}) {
  const { t } = usePage();
  return (
    <PlainCustomerLayout title={t.account.title}>
      <FlashMessage />
      <section className="card p-5 sm:p-6">
        <h2 className="text-[17px] font-semibold">{t.account.profile}</h2>
        <Form action="/account/profile" className="mt-4 grid gap-4" noValidate>
          <Field label={t.common.name} name="name" error={errors.name}>
            <Input name="name" defaultValue={profile.name} required maxLength={120} autoComplete="name" error={errors.name} />
          </Field>
          <Field label={t.common.email} name="email_display">
            <Input name="email_display" defaultValue={profile.email} disabled />
          </Field>
          <Field label={t.common.phone} name="phone" optional error={errors.phone}>
            <Input name="phone" type="tel" defaultValue={profile.phone ?? ''} maxLength={40} autoComplete="tel" error={errors.phone} />
          </Field>
          <fieldset>
            <legend className="label">
              {t.account.birthday} <span className="font-normal text-muted">({t.common.optional})</span>
            </legend>
            <div className="grid grid-cols-[1.4fr_1fr] gap-3">
              <Select name="birthday_month" aria-label={t.account.month} defaultValue={profile.birthdayMonth ? String(profile.birthdayMonth) : ''}>
                <option value="">{t.account.month}</option>
                {t.months.map((m, i) => (
                  <option key={m} value={String(i + 1)}>
                    {m}
                  </option>
                ))}
              </Select>
              <Select name="birthday_day" aria-label={t.account.day} defaultValue={profile.birthdayDay ? String(profile.birthdayDay) : ''}>
                <option value="">{t.account.day}</option>
                {Array.from({ length: 31 }, (_, i) => (
                  <option key={i} value={String(i + 1)}>
                    {i + 1}
                  </option>
                ))}
              </Select>
            </div>
            <p className="hint">{errors.birthday ?? t.account.birthdayHelp}</p>
          </fieldset>
          <div>
            <Button>{t.common.save}</Button>
          </div>
        </Form>
      </section>

      <section className="card mt-4 p-5 sm:p-6">
        <h2 className="text-[17px] font-semibold">{t.account.preferences}</h2>
        <p className="mt-1 text-[14px] text-muted-ink">{t.account.preferencesHelp}</p>
        {memberships.length === 0 ? (
          <p className="mt-4 text-[14.5px] text-muted-ink">{t.account.noMemberships}</p>
        ) : (
          <Form action="/account/preferences" className="mt-4 space-y-3">
            {memberships.map((m) => (
              <Checkbox key={m.id} name="consent" value={m.id} defaultChecked={m.marketingConsent} label={fmt(t.cafe.marketing, { cafe: m.cafeName }).replace(/ \(.*\)$/, '')} />
            ))}
            <div className="pt-1">
              <Button variant="secondary">{t.common.save}</Button>
            </div>
          </Form>
        )}
      </section>

      <section className="card mt-4 p-5 sm:p-6">
        <h2 className="text-[17px] font-semibold">{t.account.passwordTitle}</h2>
        <Form action="/account/password" className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label={t.account.currentPassword} name="current" error={errors.current}>
            <Input name="current" type="password" autoComplete="current-password" required error={errors.current} />
          </Field>
          <Field label={t.account.newPassword} name="next" hint={t.auth.passwordHint} error={errors.next}>
            <Input name="next" type="password" autoComplete="new-password" required minLength={10} error={errors.next} />
          </Field>
          <div>
            <Button variant="secondary">{t.account.passwordTitle}</Button>
          </div>
        </Form>
      </section>

      <section className="card mt-4 p-5 sm:p-6">
        <h2 className="text-[17px] font-semibold">{t.account.privacy}</h2>
        <p className="mt-1 text-[14px] text-muted-ink">
          {t.account.privacyBody}{' '}
          <a className="link" href="/privacy">
            {t.nav.privacy}
          </a>
        </p>
        <a href="/account/export.json" className="btn btn-secondary mt-4">
          {t.account.exportData}
        </a>
      </section>

      <section className="card mt-4 border-error/30 p-5 sm:p-6">
        <h2 className="text-[17px] font-semibold text-error">{t.account.deleteTitle}</h2>
        <p className="mt-1 text-[14px] text-muted-ink">{t.account.deleteBody}</p>
        <Form action="/account/delete" className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label={t.account.deleteConfirm} name="confirm" error={errors.confirm} className="sm:w-56">
            <Input name="confirm" autoComplete="off" error={errors.confirm} />
          </Field>
          <Button variant="danger">{t.account.deleteButton}</Button>
        </Form>
      </section>

      <Form action="/sign-out" className="mt-6">
        <Button variant="ghost">{t.common.signOut}</Button>
      </Form>
    </PlainCustomerLayout>
  );
}
