import { LuCheck, LuCircleAlert } from 'react-icons/lu';
import { usePage } from '../../page-context';
import { MarketingLayout } from '../../layouts/MarketingLayout';
import { PlanCards, type PlanCardData } from './PlanCards';
import { Alert, Button, Field, Form, Input, Textarea, FlashMessage } from '../../components/ui';
import { StampGrid } from '../../components/brand';
import { BarChart } from '../../charts/charts';
import { CustomerCardMock, PhoneFrame, TerminalMock } from '../../components/mockups';
import { fmt, plural } from '../../../shared/i18n';

export function FeaturesPage() {
  const { t } = usePage();
  const f = t.featuresPage;
  const visual = (key: string) => {
    switch (key) {
      case 'digital':
        return (
          <PhoneFrame className="mx-auto max-w-[240px]">
            <CustomerCardMock compact filled={5} required={9} progressText={fmt(t.wallet.stampsProgress, { have: 5, need: 9 })} toGoText={plural(t.wallet.stampsToGo, 4, { reward: '{reward}' })} reward="☕" />
          </PhoneFrame>
        );
      case 'stamps':
        return (
          <div className="rounded-[16px] border border-beige bg-paper p-5">
            <StampGrid required={9} filled={9} size={38} ariaLabel={t.wallet.cardFull} />
            <p className="mt-4 text-[14px] font-medium">{t.wallet.cardFull}</p>
          </div>
        );
      case 'qr':
        return <TerminalMock />;
      case 'analytics':
        return (
          <div className="rounded-[16px] border border-beige bg-paper p-4">
            <BarChart ariaLabel="Example: rewards redeemed per week" height={150} color="#B86F52" showEvery={1} data={[3, 5, 4, 7, 6, 8].map((v, i) => ({ label: `W${i + 1}`, value: v }))} />
          </div>
        );
      default:
        return null;
    }
  };
  return (
    <MarketingLayout active="features">
      <section className="mx-auto max-w-[1180px] px-4 pb-8 pt-14 sm:px-6">
        <h1 className="max-w-[20ch] text-[40px] font-semibold tracking-[-0.03em] sm:text-[52px]">{f.title}</h1>
        <p className="mt-5 max-w-[60ch] text-[17px] text-muted-ink">{f.intro}</p>
      </section>
      <div className="mx-auto max-w-[1180px] divide-y divide-beige px-4 sm:px-6">
        {f.sections.map((s) => {
          const v = visual(s.key);
          return (
            <section key={s.key} id={s.key} className="grid scroll-mt-20 gap-8 py-14 md:grid-cols-[1.2fr_1fr] md:items-center">
              <div>
                <h2 className="text-[26px] font-semibold sm:text-[30px]">{s.title}</h2>
                <p className="mt-3 max-w-[62ch] text-[16px] leading-relaxed text-muted-ink">{s.body}</p>
                <ul className="mt-5 space-y-2">
                  {s.points.map((p) => (
                    <li key={p} className="flex gap-2.5 text-[15px]">
                      <LuCheck className="mt-[3px] h-4 w-4 shrink-0 text-sage-ink" aria-hidden="true" /> {p}
                    </li>
                  ))}
                </ul>
              </div>
              {v && <div>{v}</div>}
            </section>
          );
        })}
      </div>
      <section className="mx-auto mt-6 max-w-[1180px] px-4 sm:px-6">
        <div className="rounded-[20px] border border-beige bg-sand/70 p-7">
          <h2 className="text-[20px] font-semibold">{f.limitsTitle}</h2>
          <ul className="mt-4 space-y-2.5">
            {f.limits.map((l) => (
              <li key={l} className="flex gap-2.5 text-[15px] text-ink">
                <LuCircleAlert className="mt-[3px] h-4 w-4 shrink-0 text-warning-ink" aria-hidden="true" /> {l}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <a href="/get-started" className="btn btn-primary btn-lg">
            {t.common.getStarted}
          </a>
          <a href="/demo" className="btn btn-secondary btn-lg">
            {t.common.bookDemo}
          </a>
        </div>
      </section>
    </MarketingLayout>
  );
}

export function PricingPage({ plans }: { plans: PlanCardData[] }) {
  const { t } = usePage();
  const p = t.pricing;
  return (
    <MarketingLayout active="pricing">
      <section className="mx-auto max-w-[1180px] px-4 pt-14 sm:px-6">
        <h1 className="text-[40px] font-semibold tracking-[-0.03em] sm:text-[52px]">{p.title}</h1>
        <p className="mt-4 max-w-[60ch] text-[17px] text-muted-ink">{p.intro}</p>
        <div className="mt-10">
          <PlanCards plans={plans} />
        </div>
        <div className="mt-6 space-y-2 text-[14px] text-muted-ink">
          <p>{p.proposalNote}</p>
          <p>{p.extrasNote}</p>
          <p>{p.billingNote}</p>
        </div>
      </section>
      <section className="mx-auto mt-16 max-w-[820px] px-4 sm:px-6">
        <h2 className="text-[26px] font-semibold">{p.faqTitle}</h2>
        <dl className="mt-6 divide-y divide-beige border-y border-beige">
          {p.faq.map((f) => (
            <div key={f.q} className="py-5">
              <dt className="text-[16.5px] font-semibold">{f.q}</dt>
              <dd className="mt-1.5 text-[15.5px] text-muted-ink">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </MarketingLayout>
  );
}

export function DemoRequestPage({ kind, values = {}, errors = {}, done }: { kind: 'demo' | 'contact'; values?: Record<string, string>; errors?: Record<string, string>; done?: string }) {
  const { t } = usePage();
  const d = t.demo;
  return (
    <MarketingLayout>
      <section className="mx-auto grid max-w-[1180px] gap-12 px-4 pt-14 sm:px-6 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <h1 className="max-w-[18ch] text-[38px] font-semibold tracking-[-0.03em] sm:text-[46px]">{kind === 'demo' ? d.title : d.contactTitle}</h1>
          <p className="mt-4 max-w-[48ch] text-[16.5px] text-muted-ink">{kind === 'demo' ? d.intro : d.contactIntro}</p>
          <div className="mt-8 hidden max-w-[300px] lg:block">
            <PhoneFrame>
              <CustomerCardMock filled={6} required={9} progressText={fmt(t.wallet.stampsProgress, { have: 6, need: 9 })} toGoText={plural(t.wallet.stampsToGo, 3, { reward: '{reward}' })} reward="☕" />
            </PhoneFrame>
          </div>
        </div>
        <div className="panel p-6 sm:p-8">
          {done ? (
            <div>
              <Alert tone="success" title={d.thanksTitle}>
                {fmt(d.thanksBody, { email: done })}
              </Alert>
              <a href="/c/perkora-demo-cafe" className="btn btn-primary mt-6">
                {d.tryDemo}
              </a>
            </div>
          ) : (
            <Form action={kind === 'demo' ? '/demo' : '/contact'} className="grid gap-5" noValidate>
              <FlashMessage />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={t.common.name} name="name" error={errors.name}>
                  <Input name="name" autoComplete="name" required maxLength={120} defaultValue={values.name} error={errors.name} />
                </Field>
                <Field label={t.common.email} name="email" error={errors.email}>
                  <Input name="email" type="email" autoComplete="email" required maxLength={254} defaultValue={values.email} error={errors.email} />
                </Field>
              </div>
              {kind === 'demo' && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label={d.cafeName} name="cafe_name" error={errors.cafe_name}>
                    <Input name="cafe_name" maxLength={120} defaultValue={values.cafe_name} error={errors.cafe_name} />
                  </Field>
                  <Field label={d.city} name="city" optional>
                    <Input name="city" maxLength={80} defaultValue={values.city ?? 'Girne'} />
                  </Field>
                </div>
              )}
              <Field label={t.common.phone} name="phone" optional>
                <Input name="phone" type="tel" autoComplete="tel" maxLength={40} defaultValue={values.phone} />
              </Field>
              <Field label={kind === 'demo' ? d.message : d.messageContact} name="message" error={errors.message} optional={kind === 'demo'}>
                <Textarea name="message" rows={4} maxLength={2000} defaultValue={values.message} error={errors.message} />
              </Field>
              <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
              <div>
                <Button size="lg">{kind === 'demo' ? d.submit : d.submitContact}</Button>
                <p className="mt-3 text-[13px] text-muted-ink">{d.privacyNote}</p>
              </div>
            </Form>
          )}
        </div>
      </section>
    </MarketingLayout>
  );
}

export function LegalPage({ kind }: { kind: 'privacy' | 'terms' }) {
  return (
    <MarketingLayout>
      <article className="prose-legal mx-auto max-w-[760px] px-4 pt-14 sm:px-6">
        {kind === 'privacy' ? <PrivacyContent /> : <TermsContent />}
      </article>
    </MarketingLayout>
  );
}

function DraftNotice() {
  return (
    <div className="my-6">
      <Alert tone="warning" title="Template for the pilot — not legal advice">
        This text describes how the Perkora software handles data. It has not been reviewed by a lawyer. Before commercial launch, the operator must review it against the privacy,
        consumer-protection, electronic-marketing and data-retention rules that apply in Northern Cyprus and anywhere else customers are located, and add the operator’s legal name and
        contact details.
      </Alert>
    </div>
  );
}

function PrivacyContent() {
  return (
    <>
      <h1 className="text-[38px] font-semibold tracking-[-0.03em]">Privacy policy</h1>
      <p className="text-muted-ink">Draft for pilot use. Last updated 27 October 2026.</p>
      <DraftNotice />
      <h2>Who is responsible</h2>
      <p>
        Each participating café runs its own loyalty programme and decides how it uses its members’ data. Perkora provides the software that stores and processes that data on the café’s
        behalf. The operator’s contact details will be added here before launch.
      </p>
      <h2>What we collect</h2>
      <ul>
        <li>Account details: your name, email address and a securely hashed password.</li>
        <li>Optional details you choose to add: phone number, and the day and month of your birthday (never the year).</li>
        <li>Loyalty activity at each café you join: verified visits, stamps and points earned or used, rewards unlocked and redeemed, and which staff member recorded each action.</li>
        <li>Your marketing choice for each café, and when you changed it.</li>
        <li>Basic technical data needed to keep the service secure, such as session cookies and rate-limit counters.</li>
      </ul>
      <p>We do not collect your precise location, payment card details, or the contents of your purchases beyond an optional receipt number and amount entered by staff.</p>
      <h2>How it is used</h2>
      <ul>
        <li>To operate the loyalty programmes you joined: show your balance, add stamps or points, and let you redeem rewards.</li>
        <li>To show each café reports about its own programme. A café never sees your activity at another café.</li>
        <li>To show you offers inside your card. A café may contact you about offers only if you opted in for that café; joining never depends on it.</li>
        <li>To prevent fraud and mistakes, for example duplicate awards.</li>
      </ul>
      <h2>Cookies</h2>
      <p>We use only the cookies needed to run the service: a sign-in session, a security token for forms, your language choice and the café you are working in. We do not use advertising or tracking cookies.</p>
      <h2>Your choices</h2>
      <ul>
        <li>Change your details and marketing choices at any time under Account settings.</li>
        <li>Download a copy of your data from Account settings.</li>
        <li>Delete your account. Your name and contact details are removed and your memberships closed. Cafés may keep anonymised transaction records where they need them.</li>
      </ul>
      <h2>Retention</h2>
      <p>Retention periods will be set with each café before launch, according to the applicable record-keeping rules.</p>
    </>
  );
}

function TermsContent() {
  return (
    <>
      <h1 className="text-[38px] font-semibold tracking-[-0.03em]">Terms of service</h1>
      <p className="text-muted-ink">Draft for pilot use. Last updated 27 October 2026.</p>
      <DraftNotice />
      <h2>The service</h2>
      <p>Perkora is software that lets cafés run digital loyalty programmes. Each café sets its own programme rules, rewards and offers and is responsible for honouring them.</p>
      <h2>For customers</h2>
      <ul>
        <li>Joining a programme is free. Stamps, points and rewards have no cash value and cannot be exchanged for money.</li>
        <li>Each café decides which purchases qualify, when rewards expire and any other conditions, which are shown on its programme page.</li>
        <li>A café may correct mistakes in your balance; every correction is recorded.</li>
        <li>If a café stops using Perkora, its programme and unused rewards may end.</li>
      </ul>
      <h2>For cafés</h2>
      <ul>
        <li>Plans and prices shown on the pricing page are introductory proposals and may change. A trial does not take payment; billing is agreed separately.</li>
        <li>You are responsible for the accuracy of the purchases your staff confirm and for honouring rewards you offer.</li>
        <li>You must have a lawful basis for any marketing you send to members and respect their choices.</li>
        <li>Do not use the service to collect more personal data than your programme needs.</li>
      </ul>
      <h2>Availability</h2>
      <p>During the pilot the service is provided as is. We aim for high availability but do not yet offer a contractual service level.</p>
    </>
  );
}
