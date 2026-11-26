import { LuMapPin, LuQrCode, LuSearch, LuSmartphone } from 'react-icons/lu';
import { usePage } from '../../page-context';
import { CafeMark, Logo } from '../../components/brand';
import { CafeBar, type CafeLook } from '../../components/cafe-look';
import { Alert, Button, Field, Form, Input, LanguageSwitcher, PasswordField } from '../../components/ui';
import { PhoneFrame } from '../../components/mockups';
import { StampCardPanel, PassButton } from '../customer/parts';
import { fmt } from '../../../shared/i18n';
import type { PublicCafe } from '../../../server/domain/views';

export interface PreviewRule {
  need: number;
  reward: string;
}

const lookOf = (c: PublicCafe): CafeLook => ({
  name: c.name,
  logoUrl: c.logoUrl,
  bannerUrl: c.bannerUrl,
  primaryColour: c.primaryColour,
  secondaryColour: c.secondaryColour,
  layout: c.settings.pageLayout,
  tagline: c.settings.tagline,
});

function TopBar() {
  return (
    <header className="mx-auto flex h-16 w-full max-w-[1080px] items-center justify-between px-4 sm:px-6">
      <Logo href={null} />
      <LanguageSwitcher />
    </header>
  );
}

/** What a customer sees in their phone: the café's own card, a few stamps in. */
export function PreviewPhone({ cafe, rule, filled }: { cafe: PublicCafe; rule: PreviewRule; filled: number }) {
  const { t } = usePage();
  const look = lookOf(cafe);
  const prog = { id: 'preview', name: cafe.name, config: { stampsRequired: rule.need }, balance: filled, cardReward: { name: rule.reward } } as any;
  return (
    <PhoneFrame className="mx-auto w-[300px] sm:w-[320px]">
      <div className="pt-7">
        <CafeBar look={look} href="#" subtitle={t.common.poweredBy} />
        <div className="space-y-3 p-3.5 pb-6">
          <StampCardPanel
            p={prog}
            color={cafe.secondaryColour}
            icon={cafe.settings.stampIcon}
            pass={{ primary: cafe.primaryColour, secondary: cafe.secondaryColour }}
            footer={
              <PassButton href="#" colours={{ primary: cafe.primaryColour, secondary: cafe.secondaryColour }}>
                <LuQrCode className="h-5 w-5" aria-hidden="true" /> {t.wallet.showAtCounter}
              </PassButton>
            }
          />
        </div>
      </div>
    </PhoneFrame>
  );
}

export function PreviewPage({ cafe, token, rule, previewUrl, joinUrl, posterSvg, phoneSvg, price }: {
  cafe: PublicCafe;
  token: string;
  rule: PreviewRule;
  previewUrl: string;
  joinUrl: string;
  posterSvg: string;
  phoneSvg: string;
  price: string | null;
}) {
  const { t } = usePage();
  const p = t.preview;
  const need = rule.need;
  const filled = Math.max(1, Math.min(need - 2, Math.round(need * 0.67)));
  const claim = `/p/${token}/claim`;
  const ruleLine = fmt(t.cafe.stampRule, { n: need, reward: rule.reward });
  return (
    <div className="min-h-screen bg-cream pb-28 md:pb-16">
      <TopBar />
      <main className="mx-auto max-w-[1080px] px-4 sm:px-6">
        {/* hero: the café's own card */}
        <section className="grid grid-cols-1 items-center gap-10 pb-12 pt-4 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] md:pt-10">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-beige bg-paper py-1 pl-1 pr-3 text-[13.5px] font-medium">
              <CafeMark name={cafe.name} logoUrl={cafe.logoUrl} colour={cafe.primaryColour} size={26} className="rounded-full" />
              {fmt(p.madeFor, { cafe: cafe.name })}
            </p>
            <h1 className="mt-5 font-display text-[40px] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[54px]">{p.title}</h1>
            <p className="mt-4 max-w-[44ch] text-[17px] text-muted-ink">{p.intro}</p>
            <div className="mt-7 hidden flex-wrap items-center gap-3 md:flex">
              <a href={claim} className="btn btn-primary btn-lg">
                {p.cta}
              </a>
              <a href={joinUrl} className="btn btn-secondary btn-lg">
                {p.seeCustomerPage}
              </a>
            </div>
            <p className="mt-3 hidden text-[13.5px] text-muted-ink md:block">{p.ctaNote}</p>
          </div>
          <div>
            <PreviewPhone cafe={cafe} rule={rule} filled={filled} />
            <p className="mt-4 text-center text-[13px] text-muted-ink">{p.cardLabel}</p>
          </div>
        </section>

        {/* counter poster and directory listing */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="panel p-5 sm:p-6">
            <h2 className="text-[19px] font-semibold">{p.counterTitle}</h2>
            <p className="mt-1 text-[14.5px] text-muted-ink">{p.counterBody}</p>
            <div className="mx-auto mt-5 max-w-[260px] rounded-[18px] border border-beige bg-white px-5 pb-5 pt-6 text-center shadow-card">
              <CafeMark name={cafe.name} logoUrl={cafe.logoUrl} colour={cafe.primaryColour} size={44} className="mx-auto" />
              <p className="mt-2.5 font-display text-[19px] font-semibold leading-tight">{cafe.name}</p>
              <p className="text-[13px] text-muted-ink">{p.posterJoin}</p>
              <div className="mx-auto mt-3 w-[150px] [&>svg]:h-auto [&>svg]:w-full" aria-hidden="true" dangerouslySetInnerHTML={{ __html: posterSvg }} />
              <p className="mt-2 text-[12.5px] font-medium">{p.posterScan}</p>
              <p className="mt-0.5 text-[11.5px] text-muted-ink">{ruleLine}</p>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="panel p-5 sm:p-6">
              <h2 className="text-[19px] font-semibold">{p.listTitle}</h2>
              <p className="mt-1 text-[14.5px] text-muted-ink">{p.listBody}</p>
              <div className="mt-4 rounded-[14px] border border-beige bg-cream p-3">
                <p className="mb-2 flex items-center gap-2 rounded-[10px] border border-beige bg-paper px-3 py-2 text-[13px] text-muted">
                  <LuSearch className="h-4 w-4" aria-hidden="true" /> {cafe.city || 'Girne'}
                </p>
                <div className="card flex items-center gap-3.5 p-3.5">
                  <CafeMark name={cafe.name} logoUrl={cafe.logoUrl} colour={cafe.primaryColour} size={48} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-semibold">{cafe.name}</span>
                    <span className="flex items-center gap-1 text-[13px] text-muted-ink">
                      <LuMapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{[cafe.address, cafe.city].filter(Boolean).join(', ')}</span>
                    </span>
                    <span className="block truncate text-[13px] text-muted-ink">{ruleLine}</span>
                  </span>
                </div>
              </div>
            </div>
            <div className="panel p-5 sm:p-6">
              <h2 className="text-[19px] font-semibold">{p.stepsTitle}</h2>
              <ol className="mt-3 space-y-3">
                {p.steps.map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold tnum" style={{ background: cafe.primaryColour, color: '#fff' }}>
                      {i + 1}
                    </span>
                    <span className="text-[14.5px]">
                      <span className="block font-semibold">{s.title}</span>
                      <span className="text-muted-ink">{fmt(s.body, { n: need, reward: rule.reward.toLowerCase() })}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* price and opening on another phone */}
        <section className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="panel flex flex-col justify-center p-5 sm:p-6">
            {price && <p className="text-[17px] font-semibold">{fmt(p.price, { price })}</p>}
            <p className="mt-1 text-[14.5px] text-muted-ink">{fmt(p.notLive, { cafe: cafe.name })}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a href={claim} className="btn btn-primary">
                {p.cta}
              </a>
              <a href={joinUrl} className="btn btn-secondary md:hidden">
                {p.seeCustomerPage}
              </a>
            </div>
          </div>
          <div className="panel flex items-center gap-4 p-5">
            <div className="w-[112px] shrink-0 [&>svg]:h-auto [&>svg]:w-full" aria-hidden="true" dangerouslySetInnerHTML={{ __html: phoneSvg }} />
            <div className="max-w-[16ch]">
              <p className="flex items-center gap-1.5 text-[15px] font-semibold">
                <LuSmartphone className="h-4 w-4 shrink-0" aria-hidden="true" /> {p.openOnPhone}
              </p>
              <p className="mt-1 text-[13.5px] text-muted-ink">{p.openOnPhoneBody}</p>
              <span className="sr-only">{previewUrl}</span>
            </div>
          </div>
        </section>
        <div className="py-10 text-center">
          <Logo href={null} className="opacity-60" />
        </div>
      </main>

      {/* phones: the main action stays in reach */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-beige bg-paper/90 px-4 pt-3 backdrop-blur-xl md:hidden" style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}>
        <a href={claim} className="btn btn-primary btn-lg w-full">
          {p.cta}
        </a>
        <p className="mt-1.5 text-center text-[12.5px] text-muted-ink">{p.ctaNote}</p>
      </div>
    </div>
  );
}

export function ClaimPage({ cafe, token, rule, errors = {}, values = {}, blocked }: {
  cafe: PublicCafe;
  token: string;
  rule: PreviewRule;
  errors?: Record<string, string>;
  values?: Record<string, string>;
  blocked?: 'admin' | 'demo' | null;
}) {
  const { t, user } = usePage();
  const p = t.preview;
  const action = `/p/${token}/claim`;
  return (
    <div className="min-h-screen bg-cream">
      <TopBar />
      <main className="mx-auto grid max-w-[980px] grid-cols-1 items-start gap-10 px-4 pb-16 pt-4 sm:px-6 md:grid-cols-[minmax(0,1fr)_auto] md:pt-10">
        <div className="panel p-6 sm:p-8">
          <CafeMark name={cafe.name} logoUrl={cafe.logoUrl} colour={cafe.primaryColour} size={52} />
          <h1 className="mt-4 text-[26px] font-semibold leading-tight">{fmt(p.claimTitle, { cafe: cafe.name })}</h1>
          <p className="mt-1.5 text-muted-ink">{p.claimIntro}</p>
          {errors.form && (
            <Alert tone="error" className="mt-5">
              {errors.form}
            </Alert>
          )}
          {blocked ? (
            <Alert tone="warning" className="mt-5">
              {blocked === 'admin' ? p.claimAdmin : p.claimDemo}
            </Alert>
          ) : user ? (
            <Form action={action} className="mt-6 grid gap-4">
              <p className="rounded-[12px] border border-beige bg-cream px-4 py-3 text-[14.5px]">{fmt(p.claimSignedIn, { email: user.email })}</p>
              <Button size="lg">{p.claimContinue}</Button>
              <p className="text-[13.5px] text-muted-ink">{p.ctaNote}</p>
            </Form>
          ) : (
            <Form action={action} className="mt-6 grid gap-5" noValidate>
              <Field label={t.common.email} name="email" error={errors.email}>
                <Input name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" required maxLength={254} defaultValue={values.email} error={errors.email} autoFocus />
              </Field>
              <PasswordField label={t.common.password} hint={t.auth.passwordHint} error={errors.password} autoComplete="new-password" />
              <p className="text-[13px] text-muted-ink">
                {t.auth.terms.split(/(\{terms\}|\{privacy\})/).map((part, i) =>
                  part === '{terms}' ? (
                    <a key={i} className="link" href="/terms" target="_blank">
                      {t.nav.terms}
                    </a>
                  ) : part === '{privacy}' ? (
                    <a key={i} className="link" href="/privacy" target="_blank">
                      {t.nav.privacy}
                    </a>
                  ) : (
                    <span key={i}>{part}</span>
                  ),
                )}
              </p>
              <Button size="lg">{p.claimButton}</Button>
            </Form>
          )}
          <div className="mt-6 border-t border-beige pt-5 text-[14.5px] text-muted-ink">
            {user ? (
              <Form action="/sign-out" className="inline">
                <input type="hidden" name="next" value={action} />
                <button type="submit" className="link">
                  {p.claimOther}
                </button>
              </Form>
            ) : (
              <>
                {p.haveAccount}{' '}
                <a className="link" href={`/sign-in?as=cafe&next=${encodeURIComponent(action)}`}>
                  {t.common.signIn}
                </a>
              </>
            )}
            <span className="mx-2 text-muted">·</span>
            <a className="link" href={`/p/${token}`}>
              {p.backToPreview}
            </a>
          </div>
        </div>
        <div className="hidden md:block">
          <PreviewPhone cafe={cafe} rule={rule} filled={Math.max(1, rule.need - 2)} />
        </div>
      </main>
    </div>
  );
}

export function ClaimedPage({ cafe }: { cafe: PublicCafe }) {
  const { t } = usePage();
  return (
    <div className="min-h-screen bg-cream">
      <TopBar />
      <main className="mx-auto max-w-[520px] px-4 pb-16 pt-10">
        <div className="panel p-6 text-center sm:p-8">
          <CafeMark name={cafe.name} logoUrl={cafe.logoUrl} colour={cafe.primaryColour} size={56} className="mx-auto" />
          <h1 className="mt-4 text-[24px] font-semibold">{fmt(t.preview.claimed, { cafe: cafe.name })}</h1>
          <div className="mt-6 grid gap-2.5">
            <a href="/sign-in?as=cafe" className="btn btn-primary btn-lg w-full">
              {t.preview.claimedSignIn}
            </a>
            <a href={`/c/${cafe.slug}`} className="btn btn-secondary w-full">
              {t.preview.seeCustomerPage}
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
