import { LuGift, LuQrCode, LuRepeat, LuStamp, LuTicket, LuUndo2 } from 'react-icons/lu';
import { usePage } from '../../page-context';
import { MarketingLayout } from '../../layouts/MarketingLayout';
import { CustomerCardMock, DashboardMock, PhoneFrame, StepVisual, TerminalMock } from '../../components/mockups';
import { StampGrid } from '../../components/brand';
import { BarChart } from '../../charts/charts';
import { PlanCards, type PlanCardData } from './PlanCards';
import { fmt, plural } from '../../../shared/i18n';

export function HomePage({ plans }: { plans: PlanCardData[] }) {
  const { t, locale } = usePage();
  const h = t.home;
  const reward = locale === 'tr' ? 'ücretsiz bir kahve' : 'free regular coffee';
  const progress = fmt(t.wallet.stampsProgress, { have: 7, need: 9 });
  const toGo = plural(t.wallet.stampsToGo, 2, { reward: '{reward}' });
  return (
    <MarketingLayout>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-[1180px] items-center gap-12 px-4 pb-16 pt-12 sm:px-6 md:pt-16 lg:grid-cols-[1.05fr_1fr] lg:pb-24 lg:pt-20">
          <div>
            <h1 className="max-w-[15ch] text-[42px] font-semibold leading-[1.04] tracking-[-0.035em] sm:text-[56px] lg:text-[64px]">{h.heroTitle}</h1>
            <p className="mt-6 max-w-[54ch] text-[17px] leading-relaxed text-muted-ink sm:text-[18px]">{h.heroBody}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="/get-started" className="btn btn-primary btn-lg">
                {h.heroPrimary}
              </a>
              <a href="#how-it-works" className="btn btn-secondary btn-lg">
                {h.heroSecondary}
              </a>
            </div>
            <p className="mt-6 text-[14.5px] text-muted-ink">{h.heroNote}</p>
            <p className="mt-2 text-[14.5px] text-muted-ink">
              {h.heroCustomer}{' '}
              <a href="/start" className="link font-medium text-ink">
                {h.heroCustomerLink}
              </a>
            </p>
          </div>
          <div className="relative mx-auto w-full max-w-[560px] sm:min-h-[520px] lg:mx-0" aria-label="Product preview: a customer loyalty card and the café dashboard">
            <DashboardMock className="hidden w-[76%] sm:block" />
            <PhoneFrame className="relative mx-auto w-[72%] max-w-[260px] sm:absolute sm:bottom-0 sm:right-0 sm:mx-0 sm:w-[46%] sm:max-w-[248px]">
              <CustomerCardMock filled={7} required={9} reward={reward} progressText={progress} toGoText={toGo} cta={t.wallet.showAtCounter} />
            </PhoneFrame>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="border-y border-beige bg-paper">
        <div className="mx-auto max-w-[1180px] px-4 py-20 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.35fr]">
            <div>
              <h2 className="max-w-[20ch] text-[32px] font-semibold sm:text-[38px]">{h.problemTitle}</h2>
              <p className="mt-4 max-w-[42ch] text-[16.5px] text-muted-ink">{h.problemIntro}</p>
            </div>
            <div className="divide-y divide-beige">
              {h.problems.map((p, i) => (
                <div key={i} className="grid gap-2 py-6 first:pt-0 sm:grid-cols-[1fr_1.2fr] sm:gap-8">
                  <p className="text-[17px] font-semibold text-ink">{p.problem}</p>
                  <p className="text-[16px] text-muted-ink">{p.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-[1180px] px-4 py-24 sm:px-6">
        <h2 className="max-w-[22ch] text-[32px] font-semibold sm:text-[38px]">{h.featuresTitle}</h2>
        <p className="mt-3 text-[16.5px] text-muted-ink">{h.featuresIntro}</p>
        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          <div className="panel flex flex-col justify-between gap-8 p-7">
            <div>
              <h3 className="text-[21px] font-semibold">{h.features.card.title}</h3>
              <p className="mt-2 max-w-[40ch] text-[15.5px] text-muted-ink">{h.features.card.body}</p>
            </div>
            <div className="rounded-[16px] border border-beige bg-cream p-5">
              <StampGrid required={9} filled={4} size={40} ariaLabel={fmt(t.wallet.stampsProgress, { have: 4, need: 9 })} />
            </div>
          </div>
          <div className="panel flex flex-col justify-between gap-8 p-7">
            <div>
              <h3 className="text-[21px] font-semibold">{h.features.insights.title}</h3>
              <p className="mt-2 max-w-[40ch] text-[15.5px] text-muted-ink">{h.features.insights.body}</p>
            </div>
            <div className="rounded-[16px] border border-beige bg-cream p-4">
              <BarChart
                ariaLabel="Example chart of verified visits per week"
                height={150}
                data={['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'].map((l, i) => ({ label: l, value: [42, 51, 47, 58, 63, 60, 71, 76][i] }))}
                showEvery={1}
              />
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-x-8 gap-y-8 rounded-[20px] border border-beige bg-paper p-7 sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              ['stamps', LuStamp],
              ['streaks', LuRepeat],
              ['rewards', LuGift],
              ['qr', LuQrCode],
              ['offers', LuTicket],
              ['winback', LuUndo2],
            ] as const
          ).map(([k, Icon]) => (
            <div key={k} className="flex gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-terracotta-tint text-terracotta-ink">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-[16.5px] font-semibold">{h.features[k].title}</h3>
                <p className="mt-1 text-[15px] text-muted-ink">{h.features[k].body}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6">
          <a href="/features" className="link text-[15px]">
            {t.nav.features}
          </a>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 border-y border-beige bg-sand/60">
        <div className="mx-auto max-w-[1180px] px-4 py-24 sm:px-6">
          <h2 className="text-[32px] font-semibold sm:text-[38px]">{h.howTitle}</h2>
          <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {h.howSteps.map((s, i) => (
              <li key={i} className="relative">
                <div className="flex items-center gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-espresso font-display text-[18px] font-semibold text-espresso tnum">
                    {i + 1}
                  </span>
                  {i < 2 && <span className="hidden h-px flex-1 bg-beige-strong md:block" aria-hidden="true" />}
                </div>
                <h3 className="mt-5 text-[19px] font-semibold">{s.title}</h3>
                <p className="mt-2 text-[15.5px] text-muted-ink">{s.body}</p>
                <div className="mt-5 rounded-[14px] border border-beige bg-paper p-4">
                  <StepVisual step={i} />
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Product preview */}
      <section id="product" className="scroll-mt-16 bg-coffee text-cream">
        <div className="mx-auto max-w-[1180px] px-4 py-24 sm:px-6">
          <h2 className="text-[32px] font-semibold text-cream sm:text-[38px]">{h.previewTitle}</h2>
          <p className="mt-3 max-w-[56ch] text-[16.5px] text-cream/70">{h.previewBody}</p>
          <div className="mt-12 grid items-start gap-8 lg:grid-cols-[0.8fr_1fr_1.2fr]">
            <figure>
              <PhoneFrame className="mx-auto max-w-[270px] border-cream/10">
                <CustomerCardMock filled={8} required={9} reward={reward} progressText={fmt(t.wallet.stampsProgress, { have: 8, need: 9 })} toGoText={plural(t.wallet.stampsToGo, 1, { reward: '{reward}' })} cta={t.wallet.showAtCounter} />
              </PhoneFrame>
              <figcaption className="mt-4 text-center text-[14px] text-cream/70">{h.previewCustomer}</figcaption>
            </figure>
            <figure>
              <TerminalMock className="text-ink" />
              <figcaption className="mt-4 text-center text-[14px] text-cream/70">{h.previewStaff}</figcaption>
            </figure>
            <figure>
              <DashboardMock className="text-ink" />
              <figcaption className="mt-4 text-center text-[14px] text-cream/70">{h.previewOwner}</figcaption>
            </figure>
          </div>
          <div className="mt-12 flex flex-col gap-3 sm:flex-row">
            <a href="/c/perkora-demo-cafe" className="btn btn-lg bg-cream text-espresso hover:bg-paper">
              {t.demo.tryDemo}
            </a>
            <a href="/demo" className="btn btn-lg border border-cream/25 text-cream hover:bg-cream/10">
              {t.common.bookDemo}
            </a>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-[1180px] px-4 py-24 sm:px-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <h2 className="text-[32px] font-semibold sm:text-[38px]">{h.pricingTitle}</h2>
          <a href="/pricing" className="link text-[15px]">
            {h.pricingCta}
          </a>
        </div>
        <div className="mt-10">
          <PlanCards plans={plans} compact />
        </div>
        <p className="mt-5 max-w-[80ch] text-[13.5px] text-muted-ink">{h.pricingNote}</p>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-[1180px] px-4 sm:px-6">
        <div className="rounded-[24px] bg-terracotta-tint px-6 py-14 text-center sm:px-12">
          <h2 className="mx-auto max-w-[22ch] text-[32px] font-semibold sm:text-[40px]">{h.finalTitle}</h2>
          <p className="mx-auto mt-3 max-w-[48ch] text-[16.5px] text-muted-ink">{h.finalBody}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a href="/get-started" className="btn btn-primary btn-lg">
              {t.common.getStarted}
            </a>
            <a href="/demo" className="btn btn-secondary btn-lg">
              {t.common.bookDemo}
            </a>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
