import { LuDownload, LuGift, LuMegaphone, LuQrCode, LuStamp, LuUserPlus, LuInfo } from 'react-icons/lu';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { Card, CardHeader, EmptyState, PageHeader, Stat } from '../../components/ui';
import { BarChart, AreaChart, type Point } from '../../charts/charts';
import type { BusinessContext } from '../../../server/auth/guards';
import type { ActivityEvent, DayPoint, DetailMetrics, Insight, OverviewMetrics, Range } from '../../../server/domain/analytics';
import { METRIC_DEFINITIONS } from '../../../server/domain/analytics';
import { dateNoYear, num, pct, relative, shortName } from '../../../shared/format';
import { cn } from '../../cn';

export function RangeFilter({ range, base }: { range: Range; base: string }) {
  const opts: [Range['key'], string][] = [
    ['7', 'Last 7 days'],
    ['30', 'Last 30 days'],
    ['90', 'Last 90 days'],
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-[10px] border border-beige-strong bg-paper p-0.5" role="group" aria-label="Date range">
        {opts.map(([k, label]) => (
          <a key={k} href={`${base}?range=${k}`} aria-current={range.key === k ? 'true' : undefined} className={cn('rounded-[8px] px-3 py-1.5 text-[13.5px] font-medium', range.key === k ? 'bg-espresso text-cream' : 'text-muted-ink hover:text-ink')}>
            {label}
          </a>
        ))}
      </div>
      <details className="relative" open={range.key === 'custom' ? true : undefined}>
        <summary className={cn('btn btn-sm list-none', range.key === 'custom' ? 'btn-primary' : 'btn-secondary')}>Custom range</summary>
        <form method="get" action={base} className="absolute right-0 z-20 mt-2 flex w-[290px] flex-col gap-3 rounded-[14px] border border-beige bg-paper p-4 shadow-xl sm:left-0 sm:right-auto">
          <input type="hidden" name="range" value="custom" />
          <label className="text-[13px] font-medium">
            From
            <input type="date" name="from" defaultValue={range.from} className="input mt-1" required />
          </label>
          <label className="text-[13px] font-medium">
            To
            <input type="date" name="to" defaultValue={range.to} className="input mt-1" required />
          </label>
          <button className="btn btn-primary btn-sm" type="submit">
            Apply
          </button>
        </form>
      </details>
    </div>
  );
}

export function seriesPoints(series: DayPoint[], key: keyof Omit<DayPoint, 'date'>, tz: string): Point[] {
  // aggregate into weeks when the range is long, so bars stay readable
  if (series.length > 45) {
    const out: Point[] = [];
    for (let i = 0; i < series.length; i += 7) {
      const chunk = series.slice(i, i + 7);
      const v = chunk.reduce((s, d) => s + (d[key] as number), 0);
      out.push({ label: dateNoYear(chunk[0].date, tz), value: v, title: `Week of ${dateNoYear(chunk[0].date, tz)}` });
    }
    return out;
  }
  return series.map((d) => ({ label: dateNoYear(d.date, tz), value: d[key] as number, title: dateNoYear(d.date, tz) }));
}

function MetricHelp({ k }: { k: string }) {
  const def = METRIC_DEFINITIONS[k];
  if (!def) return null;
  return (
    <span className="group relative ml-1 inline-flex align-middle">
      <button type="button" className="text-muted hover:text-ink" aria-label={`How this is calculated: ${def}`}>
        <LuInfo className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-64 -translate-x-1/2 rounded-[10px] bg-coffee px-3 py-2 text-[12.5px] leading-snug text-cream shadow-lg group-hover:block group-focus-within:block">
        {def}
      </span>
    </span>
  );
}

export function MetricTile({ label, k, value, hint }: { label: string; k: string; value: string; hint?: string }) {
  return (
    <div className="card px-5 py-4">
      <p className="text-[13px] text-muted-ink">
        {label}
        <MetricHelp k={k} />
      </p>
      <p className="mt-1 font-display text-[28px] font-semibold leading-tight tnum">{value}</p>
      {hint && <p className="mt-0.5 text-[12.5px] text-muted-ink">{hint}</p>}
    </div>
  );
}

export function OverviewPage({ biz, range, m, series, activity, insights, hasMembers }: {
  biz: BusinessContext;
  range: Range;
  m: OverviewMetrics;
  series: DayPoint[];
  activity: ActivityEvent[];
  insights: Insight[];
  hasMembers: boolean;
}) {
  const tz = biz.timezone;
  const label = range.key === 'custom' ? 'in range' : `last ${range.days} days`;
  const quick = [
    { href: '/dashboard/customers/new', label: 'Add customer', Icon: LuUserPlus },
    { href: '/terminal', label: 'Award loyalty credit', Icon: LuStamp },
    { href: '/dashboard/rewards/new', label: 'Create reward', Icon: LuGift },
    { href: '/dashboard/campaigns/new', label: 'Create campaign', Icon: LuMegaphone },
    { href: '/dashboard/settings/qr', label: 'Download QR code', Icon: LuQrCode },
  ];
  return (
    <DashboardLayout biz={biz} active="overview">
      <PageHeader title="Overview" description={`How ${biz.name}’s loyalty programme is doing.`} actions={hasMembers ? <RangeFilter range={range} base="/dashboard" /> : undefined} />
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {quick.map(({ href, label, Icon }) => (
          <a key={href} href={href} className="card flex items-center gap-2.5 px-3.5 py-3 text-[14px] font-medium hover:border-beige-strong">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-terracotta-tint text-terracotta-ink">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            {label}
          </a>
        ))}
      </div>
      {!hasMembers ? (
        <Card>
          <EmptyState
            icon={<LuQrCode className="h-6 w-6" aria-hidden="true" />}
            title="Your loyalty programme is ready."
            body="Invite your first customers to start seeing activity here. Print your QR code and place it by the till; customers scan it to join."
            action={
              <a href="/dashboard/settings/qr" className="btn btn-primary">
                <LuDownload className="h-4 w-4" aria-hidden="true" /> Download QR code
              </a>
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
            <MetricTile label="Loyalty members" k="totalMembers" value={num(m.totalMembers)} hint="today" />
            <MetricTile label="Active members" k="activeMembers" value={num(m.activeMembers)} hint={`visited in ${biz.settings.inactivityDays} days`} />
            <MetricTile label="Verified visits" k="visits" value={num(m.visits)} hint={label} />
            <MetricTile label="Rewards redeemed" k="rewardsRedeemed" value={num(m.rewardsRedeemed)} hint={label} />
            <MetricTile label="New members" k="newMembers" value={num(m.newMembers)} hint={label} />
            <MetricTile
              label="Returning members"
              k="returningRate"
              value={m.returningRate === null ? '—' : pct(m.returningRate)}
              hint={m.returningRate === null ? 'needs 5+ visiting members' : `of ${m.returningDenominator} who visited`}
            />
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader title="Customer activity" description="Verified visits per day" />
              <div className="px-4 pb-4">
                <BarChart ariaLabel="Verified visits over time" data={seriesPoints(series, 'visits', tz)} color="#3B2925" />
              </div>
            </Card>
            <Card>
              <CardHeader title="Insights" description="Written from your own data." />
              <ul className="divide-y divide-beige px-5 pb-3">
                {insights.length === 0 && <li className="py-3 text-[14px] text-muted-ink">Insights appear once there is more activity.</li>}
                {insights.slice(0, 5).map((i, n) => (
                  <li key={n} className="py-3 text-[14.5px]">
                    {i.href ? (
                      <a href={i.href} className="hover:underline">
                        {i.text}
                      </a>
                    ) : (
                      i.text
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="New members" description="Loyalty enrolments per day" />
              <div className="px-4 pb-4">
                <AreaChart ariaLabel="New members over time" data={seriesPoints(series, 'joins', tz)} color="#87947A" />
              </div>
            </Card>
            <Card>
              <CardHeader title="Rewards redeemed" description="Redemptions per day" />
              <div className="px-4 pb-4">
                <BarChart ariaLabel="Rewards redeemed over time" data={seriesPoints(series, 'redemptions', tz)} color="#B86F52" />
              </div>
            </Card>
          </div>

          <Card className="mt-4">
            <CardHeader title="Recent activity" action={<a href="/dashboard/transactions" className="text-[13.5px] link">All transactions</a>} />
            <ul className="divide-y divide-beige px-5 pb-2">
              {activity.map((a, i) => (
                <li key={i} className="flex items-center gap-3 py-3">
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', a.kind === 'joined' ? 'bg-sage' : a.kind === 'redeemed' ? 'bg-terracotta' : a.kind === 'reward' ? 'bg-warning' : a.kind === 'reversal' ? 'bg-error' : 'bg-espresso')} aria-hidden="true" />
                  <p className="min-w-0 flex-1 truncate text-[14.5px]">
                    {a.who && (a.membershipId ? <a href={`/dashboard/customers/${a.membershipId}`} className="font-medium hover:underline">{shortName(a.who)}</a> : <span className="font-medium">{shortName(a.who)}</span>)}
                    {a.who ? ' — ' : ''}
                    {a.text}
                  </p>
                  <time className="shrink-0 text-[12.5px] text-muted-ink" dateTime={new Date(a.at).toISOString()}>
                    {relative(a.at)}
                  </time>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </DashboardLayout>
  );
}

export function AnalyticsPage({ biz, range, m, d, series, segments, top, campaigns }: {
  biz: BusinessContext;
  range: Range;
  m: OverviewMetrics;
  d: DetailMetrics;
  series: DayPoint[];
  segments: Record<string, number> | null;
  top: { name: string; redeemed: number }[];
  campaigns: any[];
}) {
  const tz = biz.timezone;
  const label = range.key === 'custom' ? 'in range' : `last ${range.days} days`;
  const hasData = m.totalMembers > 0;
  return (
    <DashboardLayout biz={biz} active="analytics">
      <PageHeader
        title="Analytics"
        description="Loyalty programme activity from your own records. Hover the ⓘ icons for each definition."
        actions={
          <>
            <RangeFilter range={range} base="/dashboard/analytics" />
            <a className="btn btn-secondary btn-sm" href={`/dashboard/analytics/export.csv?range=${range.key}&from=${range.from}&to=${range.to}`}>
              <LuDownload className="h-4 w-4" aria-hidden="true" /> Export CSV
            </a>
          </>
        }
      />
      {!hasData ? (
        <Card>
          <EmptyState icon={<LuQrCode className="h-6 w-6" />} title="No data yet" body="Analytics appear once customers join and staff record visits." />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricTile label="Enrolled members" k="totalMembers" value={num(m.totalMembers)} hint="today" />
            <MetricTile label="New members" k="newMembers" value={num(m.newMembers)} hint={label} />
            <MetricTile label="Active members" k="activeMembers" value={num(m.activeMembers)} hint={`last ${biz.settings.inactivityDays} days`} />
            <MetricTile label="Verified visits" k="visits" value={num(m.visits)} hint={`${num(m.uniqueVisitors)} unique members`} />
            <MetricTile label="Stamps issued" k="stampsIssued" value={num(d.stampsIssued)} hint={label} />
            <MetricTile label="Points issued" k="pointsIssued" value={num(d.pointsIssued)} hint={label} />
            <MetricTile label="Rewards unlocked" k="rewardsIssued" value={num(d.rewardsIssued)} hint={label} />
            <MetricTile label="Rewards redeemed" k="rewardsRedeemed" value={num(m.rewardsRedeemed)} hint={label} />
            <MetricTile label="Redemption rate" k="redemptionRate" value={d.redemptionRate === null ? '—' : pct(d.redemptionRate)} hint={d.redemptionRate === null ? 'no rewards issued yet' : `${d.rewardsIssuedRedeemed} of ${d.rewardsIssued} used`} />
            <MetricTile label="Returning members" k="returningRate" value={m.returningRate === null ? '—' : pct(m.returningRate)} hint={m.returningRate === null ? 'needs 5+ visiting members' : `of ${m.returningDenominator} who visited`} />
            <MetricTile label="Visits per visiting member" k="visits" value={d.avgVisitsPerVisitor === null ? '—' : d.avgVisitsPerVisitor.toFixed(1)} hint={label} />
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Verified visits" />
              <div className="px-4 pb-4">
                <BarChart ariaLabel="Verified visits over time" data={seriesPoints(series, 'visits', tz)} />
              </div>
            </Card>
            <Card>
              <CardHeader title="Rewards unlocked vs redeemed" />
              <div className="grid gap-2 px-4 pb-4">
                <AreaChart ariaLabel="Rewards unlocked over time" data={seriesPoints(series, 'issued', tz)} color="#C18A35" height={120} />
                <BarChart ariaLabel="Rewards redeemed over time" data={seriesPoints(series, 'redemptions', tz)} color="#B86F52" height={120} />
              </div>
            </Card>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Most redeemed rewards" description={label} />
              {top.length === 0 ? (
                <p className="px-5 pb-5 text-[14px] text-muted-ink">No redemptions in this period.</p>
              ) : (
                <ul className="divide-y divide-beige px-5 pb-2">
                  {top.map((r) => (
                    <li key={r.name} className="flex justify-between py-3 text-[14.5px]">
                      <span>{r.name}</span>
                      <span className="font-semibold tnum">{r.redeemed}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <CardHeader title="Customer segments" description="Current counts" />
              {segments ? (
                <ul className="divide-y divide-beige px-5 pb-2">
                  {(
                    [
                      ['new', 'New members'],
                      ['active', 'Active'],
                      ['frequent', 'Frequent visitors'],
                      ['approaching', 'Close to a reward'],
                      ['unused_rewards', 'Holding unused rewards'],
                      ['inactive', 'Not visited recently'],
                      ['no_visits', 'Joined, no visit yet'],
                    ] as const
                  ).map(([k, l]) => (
                    <li key={k} className="flex justify-between py-2.5 text-[14.5px]">
                      <a href={`/dashboard/customers?segment=${k}`} className="hover:underline">
                        {l}
                      </a>
                      <span className="font-semibold tnum">{segments[k]}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 pb-5 text-[14px] text-muted-ink">Customer segmentation is included in the Growth and Premium plans.</p>
              )}
            </Card>
          </div>
          <Card className="mt-4">
            <CardHeader title="Campaign performance" description="Only events Perkora records are shown: views inside the card, rewards issued, bonuses and redemptions." />
            {campaigns.length === 0 ? (
              <p className="px-5 pb-5 text-[14px] text-muted-ink">No campaigns yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Campaign</th>
                      <th>Status</th>
                      <th className="text-right">Viewed by</th>
                      <th className="text-right">Rewards issued</th>
                      <th className="text-right">Bonuses</th>
                      <th className="text-right">Redeemed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <a href={`/dashboard/campaigns/${c.id}`} className="font-medium hover:underline">
                            {c.name}
                          </a>
                        </td>
                        <td className="capitalize">{c.status}</td>
                        <td className="text-right tnum">{c.viewers}</td>
                        <td className="text-right tnum">{c.vouchers_issued + c.referrals_qualified}</td>
                        <td className="text-right tnum">{c.bonuses}</td>
                        <td className="text-right tnum">{c.redeemed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <p className="mt-4 text-[13px] text-muted-ink">
            Perkora does not see your till, so it cannot measure revenue. These figures describe loyalty members only, not every customer who visits your café.
          </p>
        </>
      )}
    </DashboardLayout>
  );
}
