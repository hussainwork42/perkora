import type { ReactNode } from 'react';
import {
  LuChartColumn,
  LuChevronDown,
  LuCreditCard,
  LuGift,
  LuLayoutDashboard,
  LuLifeBuoy,
  LuMegaphone,
  LuMenu,
  LuReceiptText,
  LuScanLine,
  LuSettings,
  LuStamp,
  LuUsers,
  LuUserCog,
} from 'react-icons/lu';
import { usePage } from '../page-context';
import { CafeMark, LogoMark } from '../components/brand';
import { DemoBanner, Form, FlashMessage, Alert } from '../components/ui';
import { Island } from '../islands/Island';
import type { BusinessContext } from '../../server/auth/guards';
import { can } from '../../server/auth/guards';
import { cn } from '../cn';

export interface NavItem {
  key: string;
  href: string;
  label: string;
  Icon: (p: { className?: string }) => ReactNode;
  show: boolean;
}

export function dashboardNav(biz: BusinessContext): NavItem[] {
  const owner = biz.role === 'owner';
  return [
    { key: 'overview', href: '/dashboard', label: 'Overview', Icon: LuLayoutDashboard, show: owner || can(biz, 'view_reports') },
    { key: 'customers', href: '/dashboard/customers', label: 'Customers', Icon: LuUsers, show: can(biz, 'view_customers') },
    { key: 'programmes', href: '/dashboard/programmes', label: 'Loyalty Programmes', Icon: LuStamp, show: owner },
    { key: 'rewards', href: '/dashboard/rewards', label: 'Rewards', Icon: LuGift, show: can(biz, 'manage_rewards') },
    { key: 'campaigns', href: '/dashboard/campaigns', label: 'Campaigns', Icon: LuMegaphone, show: can(biz, 'manage_rewards') },
    { key: 'transactions', href: '/dashboard/transactions', label: 'Transactions', Icon: LuReceiptText, show: true },
    { key: 'analytics', href: '/dashboard/analytics', label: 'Analytics', Icon: LuChartColumn, show: can(biz, 'view_reports') },
    { key: 'team', href: '/dashboard/team', label: 'Team', Icon: LuUserCog, show: owner },
    { key: 'settings', href: '/dashboard/settings', label: 'Café Settings', Icon: LuSettings, show: owner },
    { key: 'subscription', href: '/dashboard/subscription', label: 'Subscription', Icon: LuCreditCard, show: owner },
    { key: 'help', href: '/dashboard/help', label: 'Help', Icon: LuLifeBuoy, show: true },
  ].filter((i) => i.show);
}

export function DashboardLayout({ biz, active, children, wide }: { biz: BusinessContext; active: string; children: ReactNode; wide?: boolean }) {
  const { user } = usePage();
  const nav = dashboardNav(biz);
  const logo = biz.logoUploadId ? `/media/${biz.logoUploadId}` : null;
  const navList = (
    <ul className="space-y-0.5">
      {nav.map(({ key, href, label, Icon }) => (
        <li key={key}>
          <a
            href={href}
            aria-current={active === key ? 'page' : undefined}
            title={label}
            className={cn(
              'dash-link flex items-center gap-3 rounded-[10px] px-3 py-2 text-[14.5px]',
              active === key ? 'bg-espresso text-cream' : 'text-ink/80 hover:bg-sand hover:text-ink',
            )}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
            <span className="dash-label truncate">{label}</span>
          </a>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="min-h-screen bg-cream">
      {biz.isDemo && <DemoBanner />}
      <div className="flex">
        {/* desktop sidebar */}
        <aside className="dash-sidebar sticky top-0 hidden h-screen w-[252px] shrink-0 flex-col border-r border-beige bg-paper lg:flex">
          <div className="flex items-center gap-3 px-4 pb-3 pt-5">
            <CafeMark name={biz.name} logoUrl={logo} colour={biz.primaryColour} size={38} />
            <div className="dash-label min-w-0">
              <p className="truncate text-[15px] font-semibold leading-tight">{biz.name}</p>
              <p className="text-[12.5px] text-muted-ink">{biz.plan.name} plan</p>
            </div>
          </div>
          {biz.memberships.length > 1 && <CafeSwitcher biz={biz} />}
          <div className="px-3 pb-3">
            <a href="/terminal" className="dash-link btn btn-accent btn-sm w-full" title="Counter terminal">
              <LuScanLine className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="dash-label">Counter terminal</span>
            </a>
          </div>
          <nav className="flex-1 overflow-y-auto px-3" aria-label="Dashboard">
            {navList}
          </nav>
          <div className="border-t border-beige p-3">
            <details className="group relative">
              <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-[10px] px-2 py-2 hover:bg-sand">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sand text-[13px] font-semibold">{(user?.name ?? '?').slice(0, 1).toUpperCase()}</span>
                <span className="dash-label min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium">{user?.name}</span>
                  <span className="block truncate text-[12px] text-muted-ink">{biz.role === 'owner' ? 'Owner' : 'Staff'}</span>
                </span>
                <LuChevronDown className="dash-label h-4 w-4 text-muted-ink" aria-hidden="true" />
              </summary>
              <div className="absolute bottom-full left-0 mb-2 w-56 rounded-[12px] border border-beige bg-paper p-1.5 shadow-lg">
                <a href="/account" className="block rounded-lg px-3 py-2 text-[14px] hover:bg-sand">
                  Account settings
                </a>
                <a href="/wallet" className="block rounded-lg px-3 py-2 text-[14px] hover:bg-sand">
                  My loyalty cards
                </a>
                <Form action="/sign-out">
                  <button className="block w-full rounded-lg px-3 py-2 text-left text-[14px] hover:bg-sand" type="submit">
                    Sign out
                  </button>
                </Form>
              </div>
            </details>
            <div className="mt-2 flex items-center justify-between px-2">
              <a href="/" className="flex items-center gap-1.5 text-[12px] text-muted-ink">
                <LogoMark className="h-4 w-4" /> <span className="dash-label">Perkora</span>
              </a>
              <Island name="SidebarToggle" props={{}} />
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {/* mobile header */}
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-beige bg-paper/95 px-4 backdrop-blur lg:hidden">
            <CafeMark name={biz.name} logoUrl={logo} colour={biz.primaryColour} size={30} />
            <p className="min-w-0 flex-1 truncate text-[15px] font-semibold">{biz.name}</p>
            <a href="/terminal" className="btn btn-accent btn-sm" aria-label="Counter terminal">
              <LuScanLine className="h-4 w-4" aria-hidden="true" />
            </a>
            <details className="relative">
              <summary className="btn btn-ghost btn-sm list-none" aria-label="Menu">
                <LuMenu className="h-5 w-5" aria-hidden="true" />
              </summary>
              <div className="absolute right-0 top-full mt-2 w-64 rounded-[14px] border border-beige bg-paper p-2 shadow-xl">
                {navList}
                <div className="mt-2 border-t border-beige pt-2">
                  <a href="/account" className="block rounded-lg px-3 py-2 text-[14px] hover:bg-sand">
                    Account settings
                  </a>
                  <Form action="/sign-out">
                    <button className="block w-full rounded-lg px-3 py-2 text-left text-[14px] hover:bg-sand" type="submit">
                      Sign out
                    </button>
                  </Form>
                </div>
              </div>
            </details>
          </header>
          <main className={cn('mx-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8', wide ? 'max-w-[1320px]' : 'max-w-[1180px]')}>
            {biz.status === 'suspended' && (
              <div className="mb-5">
                <Alert tone="error" title="This café account is suspended">
                  Customers can’t join or collect rewards and the counter terminal is disabled. Contact Perkora support to restore access.
                </Alert>
              </div>
            )}
            <FlashMessage />
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

function CafeSwitcher({ biz }: { biz: BusinessContext }) {
  return (
    <Form action="/dashboard/switch" className="px-3 pb-3">
      <label className="sr-only" htmlFor="switch-cafe">
        Switch café
      </label>
      <select id="switch-cafe" name="business_id" className="select dash-label text-[14px]" defaultValue={biz.id} data-autosubmit="1">
        {biz.memberships.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name} ({m.role})
          </option>
        ))}
      </select>
      <button className="btn btn-secondary btn-sm dash-label mt-2 w-full" type="submit">
        Switch café
      </button>
    </Form>
  );
}
