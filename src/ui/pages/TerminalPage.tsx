import { LuLayoutDashboard, LuLogOut } from 'react-icons/lu';
import { usePage } from '../page-context';
import { Island } from '../islands/Island';
import { CafeMark, LogoMark } from '../components/brand';
import { DemoBanner, FlashMessage, Form, LanguageSwitcher } from '../components/ui';
import type { BusinessContext } from '../../server/auth/guards';
import { can } from '../../server/auth/guards';

export function TerminalPage({ biz, initialMemberId }: { biz: BusinessContext; initialMemberId: string | null }) {
  const { t, csrf, user } = usePage();
  const s = {
    ...t.terminal,
    points: t.common.points,
    stampOne: t.common.stampOne,
    optional: t.common.optional,
    cancel: t.common.cancel,
  };
  const showDashboard = biz.role === 'owner' || can(biz, 'view_customers') || can(biz, 'view_reports') || can(biz, 'manage_rewards');
  const symbol = biz.currency === 'EUR' ? '€' : '₺';
  return (
    <div className="min-h-screen bg-sand/60">
      {biz.isDemo && <DemoBanner />}
      <header className="border-b border-beige bg-paper">
        <div className="mx-auto flex h-16 max-w-[1100px] items-center gap-3 px-4">
          <CafeMark name={biz.name} colour={biz.primaryColour} logoUrl={biz.logoUploadId ? `/media/${biz.logoUploadId}` : null} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15.5px] font-semibold leading-tight">{biz.name}</p>
            <p className="flex items-center gap-1.5 text-[12.5px] text-muted-ink">
              <LogoMark className="h-3.5 w-3.5" /> {t.terminal.title} · {user?.name}
            </p>
          </div>
          <LanguageSwitcher className="hidden sm:inline-flex" />
          {showDashboard && (
            <a href="/dashboard" className="btn btn-ghost btn-sm">
              <LuLayoutDashboard className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{t.terminal.dashboard}</span>
            </a>
          )}
          <Form action="/sign-out">
            <button className="btn btn-ghost btn-sm" type="submit" aria-label={t.common.signOut}>
              <LuLogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </Form>
        </div>
      </header>
      <main className="px-4 py-5">
        <div className="mx-auto max-w-[1100px]">
          <FlashMessage />
        </div>
        <Island
          name="StaffTerminal"
          props={{
            s,
            csrf,
            currency: biz.currency,
            currencySymbol: symbol,
            initialMemberId,
            instructions: biz.settings.staffInstructions || '',
          }}
        />
      </main>
    </div>
  );
}
