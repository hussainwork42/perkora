import type { ReactNode } from 'react';
import { usePage } from '../page-context';
import { Logo } from '../components/brand';
import { LanguageSwitcher } from '../components/ui';
import { Island } from '../islands/Island';
import { cn } from '../cn';

export function MarketingLayout({ children, active }: { children: ReactNode; active?: string }) {
  const { t, user } = usePage();
  const links = [
    { href: '/#product', label: t.nav.product, key: 'product' },
    { href: '/features', label: t.nav.features, key: 'features' },
    { href: '/#how-it-works', label: t.nav.howItWorks, key: 'how' },
    { href: '/pricing', label: t.nav.pricing, key: 'pricing' },
  ];
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-paper focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-beige/80 bg-cream/92 backdrop-blur supports-[backdrop-filter]:bg-cream/80">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center gap-6 px-4 sm:px-6">
          <Logo />
          <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Main">
            {links.map((l) => (
              <a
                key={l.key}
                href={l.href}
                aria-current={active === l.key ? 'page' : undefined}
                className={cn('rounded-lg px-3 py-2 text-[15px] text-muted-ink hover:text-ink', active === l.key && 'text-ink font-medium')}
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto hidden items-center gap-2 lg:flex">
            <LanguageSwitcher />
            {user ? (
              <a href="/home" className="btn btn-ghost btn-sm">
                {t.nav.dashboard}
              </a>
            ) : (
              <a href="/sign-in" className="btn btn-ghost btn-sm">
                {t.common.signIn}
              </a>
            )}
            <a href="/demo" className="btn btn-secondary btn-sm">
              {t.common.bookDemo}
            </a>
            <a href="/get-started" className="btn btn-primary btn-sm">
              {t.common.getStarted}
            </a>
          </div>
          <div className="ml-auto lg:hidden">
            <Island
              name="MobileNav"
              props={{
                links,
                signIn: user ? { href: '/home', label: t.nav.dashboard } : { href: '/sign-in', label: t.common.signIn },
                demo: { href: '/demo', label: t.common.bookDemo },
                start: { href: '/get-started', label: t.common.getStarted },
                menuLabel: t.nav.menu,
                closeLabel: t.common.close,
              }}
            />
          </div>
        </div>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}

export function Footer() {
  const { t } = usePage();
  return (
    <footer className="mt-24 bg-coffee text-cream/80">
      <div className="mx-auto grid max-w-[1180px] gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo tone="light" />
          <p className="mt-4 max-w-xs text-[15px] text-cream/70">{t.footer.tagline}</p>
          <div className="mt-6">
            <LanguageSwitcher tone="dark" />
          </div>
        </div>
        <FooterCol
          title={t.footer.product}
          links={[
            { href: '/#product', label: t.nav.product },
            { href: '/features', label: t.nav.features },
            { href: '/pricing', label: t.nav.pricing },
            { href: '/c/perkora-demo-cafe', label: 'Demo café' },
          ]}
        />
        <FooterCol
          title={t.footer.company}
          links={[
            { href: '/contact', label: t.nav.contact },
            { href: '/demo', label: t.common.bookDemo },
            { href: '/sign-in', label: t.common.signIn },
          ]}
        />
        <FooterCol
          title={t.footer.legal}
          links={[
            { href: '/privacy', label: t.nav.privacy },
            { href: '/terms', label: t.nav.terms },
          ]}
        />
      </div>
      <div className="border-t border-cream/10">
        <p className="mx-auto max-w-[1180px] px-4 py-5 text-[13px] text-cream/55 sm:px-6">{t.footer.rights}</p>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <h2 className="text-[13px] font-medium text-cream/50 font-sans tracking-normal">{title}</h2>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={l.href}>
            <a href={l.href} className="text-[15px] text-cream/85 hover:text-cream">
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
