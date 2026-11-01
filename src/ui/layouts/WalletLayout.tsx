import type { ReactNode } from 'react';
import { LuActivity, LuGift, LuIdCard, LuTicket, LuUserPlus, LuUser } from 'react-icons/lu';
import { usePage } from '../page-context';
import { CafeMark, Logo } from '../components/brand';
import { CafeBar, lightHeader, type CafeLook } from '../components/cafe-look';
import { DemoBanner, LanguageSwitcher } from '../components/ui';
import { cn, contrastText } from '../cn';

export interface WalletCafe extends CafeLook {
  slug: string;
  isDemo: boolean;
  stampIcon: string;
}

export function WalletLayout({ cafe, tab, children, showTabs = true, referralsOn = true }: { cafe: WalletCafe; tab: string; children: ReactNode; showTabs?: boolean; referralsOn?: boolean }) {
  const { t } = usePage();
  const base = `/wallet/${cafe.slug}`;
  const tabs = [
    { key: 'card', href: base, label: t.wallet.tabs.card, Icon: LuIdCard },
    { key: 'rewards', href: `${base}/rewards`, label: t.wallet.tabs.rewards, Icon: LuGift },
    { key: 'offers', href: `${base}/offers`, label: t.wallet.tabs.offers, Icon: LuTicket },
    { key: 'activity', href: `${base}/activity`, label: t.wallet.tabs.activity, Icon: LuActivity },
    ...(referralsOn ? [{ key: 'refer', href: `${base}/refer`, label: t.wallet.tabs.refer, Icon: LuUserPlus }] : []),
  ];
  return (
    <div className="min-h-screen bg-cream pb-24">
      {cafe.isDemo && <DemoBanner />}
      <CafeBar
        look={cafe}
        href="/wallet"
        subtitle={t.common.poweredBy}
        right={
          <a href="/account" className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', lightHeader(cafe) ? 'bg-sand hover:bg-beige' : 'bg-white/15 hover:bg-white/25')} aria-label={t.account.title}>
            <LuUser className="h-5 w-5" aria-hidden="true" />
          </a>
        }
      />
      <main className="mx-auto max-w-[520px] px-4 pt-5">{children}</main>
      {showTabs && (
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-beige bg-paper/95 backdrop-blur" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} aria-label="Card sections">
          <div className="mx-auto flex max-w-[520px]">
            {tabs.map(({ key, href, label, Icon }) => (
              <a
                key={key}
                href={href}
                aria-current={tab === key ? 'page' : undefined}
                className={cn('flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11.5px] font-medium', tab === key ? 'text-espresso' : 'text-muted')}
              >
                <Icon className={cn('h-[22px] w-[22px]', tab === key && 'text-terracotta')} aria-hidden="true" />
                {label}
              </a>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}

export function PlainCustomerLayout({ children, title }: { children: ReactNode; title?: string }) {
  const { t } = usePage();
  return (
    <div className="min-h-screen bg-cream pb-16">
      <header className="border-b border-beige bg-paper">
        <div className="mx-auto flex max-w-[640px] items-center justify-between px-4 py-3.5">
          <Logo />
          <div className="flex items-center gap-2">
            <a href="/wallet" className="btn btn-ghost btn-sm">
              {t.nav.wallet}
            </a>
            <LanguageSwitcher />
            <a href="/account" className="btn btn-ghost btn-sm" aria-label={t.account.title}>
              <LuUser className="h-5 w-5" aria-hidden="true" />
            </a>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[640px] px-4 pt-7">
        {title && <h1 className="mb-6 text-[28px] font-semibold">{title}</h1>}
        {children}
      </main>
    </div>
  );
}
