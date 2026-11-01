import { LuArrowDownLeft, LuArrowUpRight, LuCalendarClock, LuGift, LuStamp, LuUndo2, LuTrophy, LuUserPlus } from 'react-icons/lu';
import { usePage } from '../../page-context';
import { RewardBadgeIcon, StampGrid } from '../../components/brand';
import { ProgressBar } from '../../components/ui';
import { fmt, plural } from '../../../shared/i18n';
import { dateShort, num, relative } from '../../../shared/format';
import type { ActivityItem, ChallengeView, MemberView, OfferView, ProgrammeView, VoucherView } from '../../../server/domain/views';
import { cn } from '../../cn';

type Prog = MemberView['programmes'][number];

export function StampCardPanel({ p, color, icon, fresh = 0 }: { p: Prog; color: string; icon?: string; fresh?: number }) {
  const { t } = usePage();
  const need = Number(p.config?.stampsRequired ?? 9);
  const have = Math.min(p.balance, need);
  const reward = p.cardReward?.name ?? '';
  const progress = fmt(t.wallet.stampsProgress, { have, need });
  return (
    <section className="card p-5" aria-labelledby={`prog-${p.id}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={`prog-${p.id}`} className="text-[17px] font-semibold">
          {p.name}
        </h2>
        <span className="text-[13px] text-muted-ink tnum">
          {have}/{need}
        </span>
      </div>
      <div className="mt-4">
        <StampGrid required={need} filled={have} color={color} icon={icon} fresh={fresh} size={46} ariaLabel={progress} />
      </div>
      <p className="mt-4 text-[16px] font-semibold">{progress}</p>
      <p className="text-[14px] text-muted-ink">{have >= need ? t.wallet.cardFull : plural(t.wallet.stampsToGo, need - have, { reward })}</p>
    </section>
  );
}

export function PointsPanel({ p }: { p: Prog }) {
  const { t, locale } = usePage();
  const next = p.catalogue.filter((r) => r.cost > p.balance).sort((a, b) => a.cost - b.cost)[0];
  const affordable = p.catalogue.filter((r) => r.cost <= p.balance);
  return (
    <section className="card p-5" aria-labelledby={`prog-${p.id}`}>
      <h2 id={`prog-${p.id}`} className="text-[17px] font-semibold">
        {p.name}
      </h2>
      <p className="mt-3 text-[13px] text-muted-ink">{t.wallet.pointsBalance}</p>
      <p className="font-display text-[44px] font-semibold leading-none tracking-[-0.03em] tnum">{num(p.balance, locale)}</p>
      <dl className="mt-3 flex gap-6 text-[13px] text-muted-ink">
        <div>
          <dt className="inline">{t.wallet.pointsEarned}: </dt>
          <dd className="inline font-medium text-ink tnum">{num(p.lifetimeEarned, locale)}</dd>
        </div>
        <div>
          <dt className="inline">{t.wallet.pointsRedeemed}: </dt>
          <dd className="inline font-medium text-ink tnum">{num(p.lifetimeSpent, locale)}</dd>
        </div>
      </dl>
      {next && (
        <div className="mt-4">
          <ProgressBar value={p.balance} max={next.cost} tone="sage" label={fmt(t.wallet.nextReward, { n: next.cost - p.balance, reward: next.name })} />
          <p className="mt-2 text-[14px] text-muted-ink">{fmt(t.wallet.nextReward, { n: num(next.cost - p.balance, locale), reward: next.name })}</p>
        </div>
      )}
      {affordable.length > 0 && (
        <div className="mt-4 rounded-[12px] bg-sage-tint px-3.5 py-3">
          <p className="text-[13px] font-medium text-sage-ink">{t.wallet.canAfford}</p>
          <ul className="mt-1 text-[14.5px]">
            {affordable.map((r) => (
              <li key={r.id}>
                {r.name} · {fmt(t.wallet.costPoints, { n: num(r.cost, locale) })}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function VoucherCard({ v, tz, compact }: { v: VoucherView; tz: string; compact?: boolean }) {
  const { t, locale } = usePage();
  const status =
    v.status === 'available'
      ? v.expiresAt
        ? fmt(t.wallet.validUntil, { date: dateShort(v.expiresAt, tz, locale) })
        : t.common.noExpiry
      : v.status === 'redeemed'
        ? fmt(t.wallet.redeemedOn, { date: dateShort(v.redeemedAt ?? v.issuedAt, tz, locale) })
        : fmt(t.wallet.expiredOn, { date: v.expiresAt ? dateShort(v.expiresAt, tz, locale) : '' });
  return (
    <div className={cn('flex items-start gap-3.5 rounded-[14px] border p-4', v.status === 'available' ? 'border-terracotta/40 bg-paper' : 'border-beige bg-paper/60 opacity-80')}>
      <RewardBadgeIcon icon={v.icon} tone={v.status === 'available' ? 'accent' : 'muted'} />
      <div className="min-w-0 flex-1">
        <p className="text-[15.5px] font-semibold leading-snug">{v.name}</p>
        {!compact && v.description && <p className="mt-0.5 text-[14px] text-muted-ink">{v.description}</p>}
        <p className={cn('mt-1 text-[13px]', v.status === 'available' ? 'text-terracotta-ink' : 'text-muted-ink')}>{status}</p>
        {!compact && v.status === 'available' && <p className="mt-2 text-[13px] text-muted-ink">{t.wallet.howToRedeem}</p>}
        {!compact && v.terms && <p className="mt-1 text-[12.5px] text-muted">{v.terms}</p>}
      </div>
    </div>
  );
}

export function ChallengeCard({ c, tz }: { c: ChallengeView; tz: string }) {
  const { t, locale } = usePage();
  const unit = c.ruleType === 'distinct_days' ? t.wallet.challengeDays : t.wallet.challengeVisits;
  const period = c.period === 'week' ? t.wallet.periodWeek : c.period === 'month' ? t.wallet.periodMonth : t.wallet.periodCampaign;
  return (
    <section className="card p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sage-tint text-sage-ink">
          <LuTrophy className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-medium text-sage-ink">{t.wallet.challengeTitle}</p>
          <h3 className="text-[16px] font-semibold leading-snug">{c.name}</h3>
          {c.description && <p className="mt-0.5 text-[14px] text-muted-ink">{c.description}</p>}
        </div>
      </div>
      <div className="mt-4 flex gap-1.5" aria-hidden="true">
        {Array.from({ length: c.required }, (_, i) => (
          <span key={i} className={cn('h-2 flex-1 rounded-full', i < c.progress ? 'bg-sage' : 'bg-beige')} />
        ))}
      </div>
      <p className="mt-2.5 text-[14px]">
        <span className="font-semibold tnum">
          {c.progress} / {c.required}
        </span>{' '}
        {unit} {period} → {c.rewardLabel}
      </p>
      <p className="mt-1 text-[12.5px] text-muted-ink">
        {c.completedThisPeriod ? t.wallet.challengeDone : fmt(t.wallet.challengeEnds, { date: dateShort(c.endDate, tz, locale) })} · {t.wallet.challengeRule}
      </p>
    </section>
  );
}

const WEEKDAY_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAY_TR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

export function offerWhen(o: OfferView, locale: 'en' | 'tr'): string | null {
  const days = o.weekdays?.length && o.weekdays.length < 7 ? o.weekdays.map((d) => (locale === 'tr' ? WEEKDAY_TR : WEEKDAY_EN)[d - 1]).join(', ') : null;
  const time = o.startTime || o.endTime ? `${o.startTime ?? '00:00'}–${o.endTime ?? '24:00'}` : null;
  return [days, time].filter(Boolean).join(' · ') || null;
}

export function OfferCard({ o, tz, segmentLabel }: { o: OfferView; tz: string; segmentLabel?: string }) {
  const { t, locale } = usePage();
  const when = offerWhen(o, locale);
  return (
    <article className="card overflow-hidden">
      <div className="border-l-4 border-terracotta p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[16.5px] font-semibold leading-snug">{o.name}</h3>
          <span className="badge badge-accent shrink-0">{o.endDate ? fmt(t.wallet.offerValid, { date: dateShort(o.endDate, tz, locale) }) : t.wallet.offerOngoing}</span>
        </div>
        {o.description && <p className="mt-1.5 text-[14.5px] text-muted-ink">{o.description}</p>}
        {when && (
          <p className="mt-2 flex items-center gap-1.5 text-[13.5px] text-ink">
            <LuCalendarClock className="h-4 w-4 text-muted-ink" aria-hidden="true" /> {when}
          </p>
        )}
        {segmentLabel && (
          <p className="mt-2 text-[13px] text-muted-ink">
            <span className="font-medium text-ink">{t.wallet.offerEligibility}: </span>
            {segmentLabel}
          </p>
        )}
        {o.instructions && (
          <p className="mt-2 text-[13px] text-muted-ink">
            <span className="font-medium text-ink">{t.wallet.offerHow}: </span>
            {o.instructions}
          </p>
        )}
      </div>
    </article>
  );
}

export function ActivityList({ items, tz }: { items: ActivityItem[]; tz: string }) {
  const { t, locale } = usePage();
  if (!items.length) return <p className="py-6 text-center text-[14.5px] text-muted-ink">{t.wallet.activityEmpty}</p>;
  return (
    <ul className="divide-y divide-beige">
      {items.map((a) => {
        const Icon =
          a.type === 'redeem' ? LuGift : a.type === 'reversal' || a.type === 'voucher_void' ? LuUndo2 : a.type === 'referral' ? LuUserPlus : a.type === 'card_completed' || a.type === 'voucher_issued' ? LuGift : a.delta < 0 ? LuArrowUpRight : a.unit === 'stamps' ? LuStamp : LuArrowDownLeft;
        return (
          <li key={a.id} className="flex items-center gap-3 py-3">
            <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', a.delta > 0 ? 'bg-sage-tint text-sage-ink' : a.delta < 0 ? 'bg-terracotta-tint text-terracotta-ink' : 'bg-sand text-muted-ink')}>
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14.5px]">{activityText(a, t)}</p>
              <p className="text-[12.5px] text-muted-ink">
                {a.programmeName ? `${a.programmeName} · ` : ''}
                <time dateTime={new Date(a.createdAt).toISOString()}>{relative(a.createdAt, locale)}</time>
              </p>
            </div>
            {a.delta !== 0 && (
              <span className={cn('shrink-0 text-[14.5px] font-semibold tnum', a.delta > 0 ? 'text-success' : 'text-terracotta-ink')}>
                {a.delta > 0 ? '+' : ''}
                {a.delta}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function activityText(a: ActivityItem, t: any): string {
  const unit = a.unit === 'stamps' ? plural(t.common.stampOne, Math.abs(a.delta)) : plural(t.common.pointOne, Math.abs(a.delta));
  if (a.type === 'earn') return fmt(t.wallet.activityEarn, { n: unit });
  const m = /^(Redeemed: |Card completed: )(.+?)( unlocked)?$/.exec(a.description);
  if (a.type === 'redeem' && m) return fmt(t.wallet.activityRedeemed, { reward: m[2] });
  if (a.type === 'card_completed' && m) return fmt(t.wallet.activityCardDone, { reward: m[2] });
  return a.description;
}

export function ProgrammeSummary({ p, currency }: { p: ProgrammeView; currency: string }) {
  const { t, locale } = usePage();
  if (p.type === 'stamps') {
    return (
      <div>
        <p className="text-[15.5px] font-medium">{fmt(t.cafe.stampRule, { n: p.config?.stampsRequired, reward: p.cardReward?.name ?? '' })}</p>
        <p className="mt-1 text-[14px] text-muted-ink">{fmt(t.cafe.stampEligible, { what: p.config?.eligiblePurchase ?? '' })}</p>
      </div>
    );
  }
  const unit = new Intl.NumberFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(1);
  return (
    <div>
      <p className="text-[15.5px] font-medium">
        {p.config?.earnMode === 'per_currency_unit' ? plural(t.cafe.pointsRulePerUnit, p.config?.pointsPerUnit ?? 1, { unit }) : fmt(t.cafe.pointsRulePerPurchase, { n: p.config?.pointsPerPurchase ?? 10 })}
      </p>
      {p.catalogue.length > 0 && (
        <p className="mt-1 text-[14px] text-muted-ink">
          {t.cafe.pointsRewards}: {p.catalogue.map((r) => `${r.name} (${fmt(t.wallet.costPoints, { n: r.cost })})`).join(', ')}
        </p>
      )}
    </div>
  );
}

export { LuGift };
