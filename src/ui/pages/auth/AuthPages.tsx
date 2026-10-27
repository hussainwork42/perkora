import type { ReactNode } from 'react';
import { usePage } from '../../page-context';
import { Logo } from '../../components/brand';
import { Alert, Button, Field, FlashMessage, Form, Input, LanguageSwitcher } from '../../components/ui';
import { fmt } from '../../../shared/i18n';

export function AuthLayout({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex h-16 w-full max-w-[1180px] items-center justify-between px-4 sm:px-6">
        <Logo />
        <LanguageSwitcher />
      </header>
      <main className="mx-auto grid w-full max-w-[1000px] flex-1 items-start gap-10 px-4 pb-16 pt-8 sm:px-6 md:grid-cols-[1fr_0.9fr] md:pt-14">
        <div className="panel p-6 sm:p-8">{children}</div>
        {aside && <aside>{aside}</aside>}
      </main>
    </div>
  );
}

export interface DemoAccounts {
  password: string;
  owner: string;
  staff: string;
  customer: string;
}

export function SignInPage({ next, email, error, demo }: { next: string; email?: string; error?: string; demo?: DemoAccounts | null }) {
  const { t } = usePage();
  return (
    <AuthLayout aside={demo ? <DemoAccountsBox demo={demo} next={next} /> : undefined}>
      <h1 className="text-[26px] font-semibold">{t.auth.signInTitle}</h1>
      <p className="mt-1.5 text-muted-ink">{t.auth.signInIntro}</p>
      <Form action="/sign-in" className="mt-6 grid gap-5">
        <FlashMessage />
        {error && <Alert tone="error">{error}</Alert>}
        <input type="hidden" name="next" value={next} />
        <Field label={t.common.email} name="email">
          <Input name="email" type="email" autoComplete="email" required defaultValue={email} autoFocus={!email} />
        </Field>
        <Field label={t.common.password} name="password">
          <Input name="password" type="password" autoComplete="current-password" required autoFocus={Boolean(email)} />
        </Field>
        <Button size="lg">{t.common.signIn}</Button>
      </Form>
      <div className="mt-6 space-y-2 border-t border-beige pt-5 text-[14.5px] text-muted-ink">
        <p>
          {t.auth.noAccount}{' '}
          <a className="link" href={`/sign-up?next=${encodeURIComponent(next)}`}>
            {t.auth.createOne}
          </a>
        </p>
        <p>
          {t.auth.forBusiness}{' '}
          <a className="link" href="/get-started">
            {t.auth.forBusinessLink}
          </a>
        </p>
      </div>
    </AuthLayout>
  );
}

function DemoAccountsBox({ demo, next }: { demo: DemoAccounts; next: string }) {
  const { t } = usePage();
  const rows = [
    [t.auth.demoOwner, demo.owner],
    [t.auth.demoStaff, demo.staff],
    [t.auth.demoCustomer, demo.customer],
  ];
  return (
    <div className="rounded-[20px] border border-dashed border-beige-strong p-6">
      <h2 className="text-[17px] font-semibold">{t.auth.demoAccounts}</h2>
      <p className="mt-1 text-[14px] text-muted-ink">{fmt(t.auth.demoAccountsBody, { password: demo.password })}</p>
      <ul className="mt-4 space-y-2">
        {rows.map(([label, email]) => (
          <li key={email}>
            <Form action="/sign-in" className="flex items-center justify-between gap-3 rounded-[12px] bg-paper px-3.5 py-2.5 border border-beige">
              <input type="hidden" name="email" value={email} />
              <input type="hidden" name="password" value={demo.password} />
              <input type="hidden" name="next" value={next} />
              <span className="min-w-0">
                <span className="block text-[14px] font-medium">{label}</span>
                <span className="block truncate text-[12.5px] text-muted-ink">{email}</span>
              </span>
              <button className="btn btn-secondary btn-sm" type="submit">
                {t.common.signIn}
              </button>
            </Form>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SignUpPage({ next, values = {}, errors = {}, business, plan }: { next: string; values?: Record<string, string>; errors?: Record<string, string>; business?: boolean; plan?: string }) {
  const { t } = usePage();
  return (
    <AuthLayout
      aside={
        business ? (
          <div className="space-y-4 text-[15px] text-muted-ink">
            <ol className="space-y-3">
              {t.home.howSteps.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-espresso text-[13px] font-semibold text-espresso tnum">{i + 1}</span>
                  <span>
                    <span className="block font-medium text-ink">{s.title}</span>
                    {s.body}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : undefined
      }
    >
      <h1 className="text-[26px] font-semibold">{business ? t.auth.businessSignUpTitle : t.auth.signUpTitle}</h1>
      <p className="mt-1.5 text-muted-ink">{business ? t.auth.businessSignUpIntro : t.auth.signUpIntro}</p>
      <Form action={business ? '/get-started' : '/sign-up'} className="mt-6 grid gap-5" noValidate>
        <FlashMessage />
        {errors.form && <Alert tone="error">{errors.form}</Alert>}
        <input type="hidden" name="next" value={next} />
        {plan && <input type="hidden" name="plan" value={plan} />}
        <Field label={t.common.name} name="name" error={errors.name}>
          <Input name="name" autoComplete="name" required maxLength={120} defaultValue={values.name} error={errors.name} />
        </Field>
        <Field label={t.common.email} name="email" error={errors.email}>
          <Input name="email" type="email" autoComplete="email" required maxLength={254} defaultValue={values.email} error={errors.email} />
        </Field>
        <Field label={t.common.password} name="password" hint={t.auth.passwordHint} error={errors.password}>
          <Input name="password" type="password" autoComplete="new-password" required minLength={10} error={errors.password} />
        </Field>
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
        <Button size="lg">{business ? t.common.continue : t.common.signUp}</Button>
      </Form>
      <p className="mt-6 border-t border-beige pt-5 text-[14.5px] text-muted-ink">
        {t.auth.haveAccount}{' '}
        <a className="link" href={`/sign-in?next=${encodeURIComponent(next)}`}>
          {t.common.signIn}
        </a>
      </p>
    </AuthLayout>
  );
}
