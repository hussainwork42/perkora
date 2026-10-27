import { LuCheck } from 'react-icons/lu';
import { usePage } from '../../page-context';
import { fmt } from '../../../shared/i18n';
import { moneyWhole } from '../../../shared/format';
import { cn } from '../../cn';

export interface PlanCardData {
  id: string;
  name: string;
  description: string;
  monthlyPriceMinor: number;
  currency: string;
  recommended: boolean;
  highlights: string[];
  highlightsTr: string[];
  inheritsFrom: string | null;
}

export function PlanCards({ plans, compact }: { plans: PlanCardData[]; compact?: boolean }) {
  const { t, locale } = usePage();
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {plans.map((p) => {
        const items = locale === 'tr' ? p.highlightsTr : p.highlights;
        return (
          <div
            key={p.id}
            className={cn(
              'relative flex flex-col rounded-[20px] border p-6',
              p.recommended ? 'border-espresso bg-espresso text-cream' : 'border-beige bg-paper',
            )}
            style={p.recommended ? { boxShadow: 'var(--shadow-raised)' } : undefined}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className={cn('text-[19px] font-semibold', p.recommended && 'text-cream')}>{p.name}</h3>
              {p.recommended && <span className="badge bg-terracotta text-white">{t.pricing.recommended}</span>}
            </div>
            <p className={cn('mt-1 text-[14.5px]', p.recommended ? 'text-cream/75' : 'text-muted-ink')}>{p.description}</p>
            <p className="mt-5 flex items-baseline gap-1">
              <span className="font-display text-[40px] font-semibold tracking-[-0.03em] tnum">{moneyWhole(p.monthlyPriceMinor, p.currency, locale)}</span>
              <span className={cn('text-[15px]', p.recommended ? 'text-cream/70' : 'text-muted-ink')}>{t.pricing.perMonth}</span>
            </p>
            {!compact && (
              <>
                {p.inheritsFrom && <p className={cn('mt-5 text-[14px] font-medium', p.recommended ? 'text-cream/85' : 'text-ink')}>{fmt(t.pricing.everythingIn, { plan: p.inheritsFrom })}</p>}
                <ul className={cn('space-y-2.5', p.inheritsFrom ? 'mt-3' : 'mt-5')}>
                  {items.map((h) => (
                    <li key={h} className="flex gap-2.5 text-[14.5px]">
                      <LuCheck className={cn('mt-[3px] h-4 w-4 shrink-0', p.recommended ? 'text-terracotta-tint' : 'text-sage-ink')} aria-hidden="true" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="mt-auto pt-6">
              <a href={`/get-started?plan=${p.id}`} className={cn('btn w-full', p.recommended ? 'bg-cream text-espresso hover:bg-paper' : 'btn-secondary')}>
                {fmt(t.pricing.choose, { plan: p.name })}
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}
