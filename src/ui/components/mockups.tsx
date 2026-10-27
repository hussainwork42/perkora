/**
 * Product mock-ups for the marketing site, assembled from the same components
 * the application uses (StampGrid, charts, badges). Figures are illustrative.
 */
import { LuCheck, LuGift, LuQrCode, LuScanLine, LuSearch, LuStamp, LuUsers } from 'react-icons/lu';
import { CafeMark, RewardBadgeIcon, StampGrid } from './brand';
import { SparkBars } from '../charts/charts';
import { cn } from '../cn';

export function PhoneFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('relative rounded-[38px] border border-coffee/10 bg-coffee p-[9px]', className)} style={{ boxShadow: 'var(--shadow-float)' }}>
      <div className="relative overflow-hidden rounded-[30px] bg-cream">
        <div className="absolute left-1/2 top-2 z-10 h-[18px] w-[86px] -translate-x-1/2 rounded-full bg-coffee" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}

export function CustomerCardMock({ filled = 7, required = 9, cafe = 'Perkora Demo Café', reward = 'a free regular coffee', progressText, toGoText, compact, cta = 'Show at the counter' }: {
  cta?: string;
  filled?: number;
  required?: number;
  cafe?: string;
  reward?: string;
  progressText: string;
  toGoText: string;
  compact?: boolean;
}) {
  return (
    <div className={cn('px-4 pb-5', compact ? 'pt-9' : 'pt-10')}>
      <div className="flex items-center gap-2.5">
        <CafeMark name={cafe} colour="#3B2925" size={34} />
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold leading-tight text-ink">{cafe}</p>
          <p className="text-[11.5px] text-muted-ink">Coffee Club</p>
        </div>
      </div>
      <div className="mt-4 rounded-[18px] border border-beige bg-paper p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
        <StampGrid required={required} filled={filled} size={compact ? 30 : 34} ariaLabel={progressText} />
        <p className="mt-4 text-[14px] font-semibold text-ink">{progressText}</p>
        <p className="text-[12.5px] text-muted-ink">{toGoText.replace('{reward}', reward)}</p>
      </div>
      {!compact && (
        <div className="mt-3 flex items-center gap-3 rounded-[14px] bg-espresso px-3.5 py-3 text-cream">
          <LuQrCode className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="text-[13px] font-medium">{cta}</span>
        </div>
      )}
    </div>
  );
}

export function DashboardMock({ className }: { className?: string }) {
  const visits = [18, 22, 19, 26, 31, 24, 29, 33, 27, 35, 38, 34, 41, 39];
  return (
    <div className={cn('rounded-[18px] border border-beige bg-paper p-5', className)} style={{ boxShadow: 'var(--shadow-raised)' }}>
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-muted-ink">Last 30 days</p>
        <span className="badge badge-sage">Illustrative</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {[
          ['Members', '248'],
          ['Visits', '612'],
          ['Rewards redeemed', '57'],
        ].map(([l, v]) => (
          <div key={l} className="rounded-[12px] bg-cream px-3 py-2.5">
            <p className="text-[11.5px] leading-tight text-muted-ink">{l}</p>
            <p className="mt-0.5 font-display text-[22px] font-semibold tnum">{v}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[12.5px] font-medium text-ink">Verified visits per day</p>
      <SparkBars values={visits} className="mt-2 h-16 w-full" />
    </div>
  );
}

export function TerminalMock({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-[18px] border border-beige bg-paper p-4', className)} style={{ boxShadow: 'var(--shadow-raised)' }}>
      <div className="flex items-center gap-2 rounded-[10px] border border-beige-strong bg-cream px-3 py-2 text-[13px] text-muted-ink">
        <LuSearch className="h-4 w-4" aria-hidden="true" /> K7M2 9QXA
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div>
          <p className="text-[15px] font-semibold">Deniz A.</p>
          <p className="text-[12px] text-muted-ink">14 visits · Coffee Club 7 / 9</p>
        </div>
        <span className="badge badge-accent">
          <LuGift className="h-3.5 w-3.5" aria-hidden="true" /> 1 reward
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <span className="btn btn-primary btn-sm">
          <LuStamp className="h-4 w-4" aria-hidden="true" /> Add stamp
        </span>
        <span className="btn btn-secondary btn-sm">Redeem</span>
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-[10px] bg-success-tint px-3 py-2 text-[12.5px] text-success">
        <LuCheck className="h-4 w-4" aria-hidden="true" /> Added 1 stamp: 7 → 8 of 9
      </div>
    </div>
  );
}

export function StepVisual({ step }: { step: number }) {
  if (step === 0)
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <CafeMark name="Your Café" colour="#B86F52" size={28} />
          <div className="h-2.5 w-24 rounded-full bg-beige" />
        </div>
        <div className="flex gap-1.5">
          {['#3B2925', '#B86F52', '#87947A', '#C18A35'].map((c) => (
            <span key={c} className="h-5 w-5 rounded-full border border-paper" style={{ background: c }} />
          ))}
        </div>
        <div className="rounded-lg border border-beige bg-paper px-2.5 py-1.5 text-[12px] text-muted-ink">Collect 9 stamps → 1 free coffee</div>
      </div>
    );
  if (step === 1)
    return (
      <div className="flex items-center gap-3">
        <div className="rounded-lg border border-beige bg-paper p-2">
          <LuQrCode className="h-12 w-12 text-espresso" aria-hidden="true" />
        </div>
        <div className="text-[12px] text-muted-ink">
          <p className="font-medium text-ink">Scan to join</p>
          <p>No app needed</p>
        </div>
      </div>
    );
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-espresso text-cream">
        <LuScanLine className="h-6 w-6" aria-hidden="true" />
      </div>
      <div className="flex -space-x-1">
        {[0, 1, 2].map((i) => (
          <RewardBadgeIcon key={i} icon="coffee" size="sm" />
        ))}
      </div>
    </div>
  );
}

export const featureIcons = { LuUsers };
