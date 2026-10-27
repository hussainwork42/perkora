import { LuDownload, LuGift, LuSearch, LuUserPlus, LuUsers } from 'react-icons/lu';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { Alert, Badge, Button, Card, CardHeader, Checkbox, EmptyState, Field, Form, Input, PageHeader, Pagination, Select, Textarea } from '../../components/ui';
import { Island } from '../../islands/Island';
import type { BusinessContext } from '../../../server/auth/guards';
import { can } from '../../../server/auth/guards';
import type { MemberView } from '../../../server/domain/views';
import { dateShort, dateTime, formatMemberCode, num, relative } from '../../../shared/format';
import { cn } from '../../cn';

export interface CustomerRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  joined_at: Date;
  last_visit_at: Date | null;
  visit_count: number;
  balances: string | null;
  rewards: number;
  status: string;
  member_code: string;
}

const SEGMENT_OPTIONS: [string, string][] = [
  ['all', 'All members'],
  ['new', 'New members'],
  ['active', 'Active'],
  ['frequent', 'Frequent visitors'],
  ['approaching', 'Close to a reward'],
  ['unused_rewards', 'Unused rewards'],
  ['inactive', 'Not visited recently'],
  ['no_visits', 'Joined, no visit yet'],
];

export function CustomersPage({ biz, rows, total, page, pageSize, q, segment, sort, segmentsAllowed, segmentHelp, showContacts }: {
  biz: BusinessContext;
  rows: CustomerRow[];
  total: number;
  page: number;
  pageSize: number;
  q: string;
  segment: string;
  sort: string;
  segmentsAllowed: boolean;
  segmentHelp: string;
  showContacts: boolean;
}) {
  const tz = biz.timezone;
  const qs = (over: Record<string, string | number>) => {
    const p = new URLSearchParams({ q, segment, sort, page: String(page), ...Object.fromEntries(Object.entries(over).map(([k, v]) => [k, String(v)])) });
    for (const [k, v] of [...p.entries()]) if (!v || (k === 'segment' && v === 'all') || (k === 'page' && v === '1') || (k === 'sort' && v === 'recent')) p.delete(k);
    const s = p.toString();
    return `/dashboard/customers${s ? '?' + s : ''}`;
  };
  const sortLink = (key: string, label: string) => (
    <a href={qs({ sort: key, page: 1 })} className={cn('hover:text-ink', sort === key && 'text-ink underline underline-offset-4')}>
      {label}
    </a>
  );
  return (
    <DashboardLayout biz={biz} active="customers" wide>
      <PageHeader
        title="Customers"
        description={`${num(total)} ${segment === 'all' && !q ? 'loyalty members' : 'matching members'}`}
        actions={
          <>
            {biz.role === 'owner' && (
              <a className="btn btn-secondary btn-sm" href={`/dashboard/customers/export.csv?${new URLSearchParams({ q, segment }).toString()}`}>
                <LuDownload className="h-4 w-4" aria-hidden="true" /> Export CSV
              </a>
            )}
            <a className="btn btn-primary btn-sm" href="/dashboard/customers/new">
              <LuUserPlus className="h-4 w-4" aria-hidden="true" /> Add customer
            </a>
          </>
        }
      />
      <Card>
        <form method="get" action="/dashboard/customers" className="flex flex-col gap-3 border-b border-beige p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <LuSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input name="q" defaultValue={q} placeholder={showContacts ? 'Search name, email, phone or member code' : 'Search name or member code'} className="input pl-9" aria-label="Search customers" />
          </div>
          {segmentsAllowed ? (
            <select name="segment" defaultValue={segment} className="select sm:w-56" aria-label="Segment">
              {SEGMENT_OPTIONS.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          ) : (
            <select name="segment" defaultValue={segment} className="select sm:w-56" aria-label="Segment">
              {SEGMENT_OPTIONS.filter(([k]) => ['all', 'new', 'no_visits'].includes(k)).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          )}
          <input type="hidden" name="sort" value={sort} />
          <Button variant="secondary" size="sm">
            Apply
          </Button>
        </form>
        {segment !== 'all' && <p className="border-b border-beige bg-sand/50 px-4 py-2 text-[13px] text-muted-ink">{segmentHelp}</p>}
        {rows.length === 0 ? (
          <EmptyState
            icon={<LuUsers className="h-6 w-6" />}
            title={q || segment !== 'all' ? 'No members match' : 'No members yet'}
            body={q || segment !== 'all' ? 'Try a different search or segment.' : 'Customers appear here when they join with your QR code or you add them.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{sortLink('name', 'Customer')}</th>
                  {showContacts && <th>Contact</th>}
                  <th>{sortLink('joined', 'Joined')}</th>
                  <th>Balance</th>
                  <th>{sortLink('recent', 'Last visit')}</th>
                  <th className="text-right">{sortLink('visits', 'Visits')}</th>
                  <th className="text-right">Rewards</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <a href={`/dashboard/customers/${r.id}`} className="font-medium hover:underline">
                        {r.name}
                      </a>
                      <div className="text-[12px] text-muted-ink tnum">{formatMemberCode(r.member_code)}</div>
                    </td>
                    {showContacts && (
                      <td className="text-[13.5px] text-muted-ink">
                        {r.email && <div className="max-w-[220px] truncate">{r.email}</div>}
                        {r.phone && <div>{r.phone}</div>}
                        {!r.email && !r.phone && '—'}
                      </td>
                    )}
                    <td className="whitespace-nowrap text-muted-ink">{dateShort(r.joined_at, tz)}</td>
                    <td className="whitespace-nowrap tnum">{r.balances ?? '—'}</td>
                    <td className="whitespace-nowrap text-muted-ink">{r.last_visit_at ? relative(r.last_visit_at) : 'No visit yet'}</td>
                    <td className="text-right tnum">{r.visit_count}</td>
                    <td className="text-right">{r.rewards > 0 ? <Badge tone="accent">{r.rewards}</Badge> : <span className="text-muted">0</span>}</td>
                    <td>
                      <Badge tone={r.status === 'active' ? 'success' : 'neutral'}>{r.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageSize={pageSize} total={total} hrefFor={(p) => qs({ page: p })} />
      </Card>
    </DashboardLayout>
  );
}

export function CustomerNewPage({ biz, values = {}, errors = {} }: { biz: BusinessContext; values?: Record<string, string>; errors?: Record<string, string> }) {
  return (
    <DashboardLayout biz={biz} active="customers">
      <PageHeader title="Add customer" back={{ href: '/dashboard/customers', label: 'Customers' }} description="Register a customer at the counter. They can attach this membership to their own account later with a claim link." />
      <Card className="max-w-2xl p-6">
        <Form action="/dashboard/customers/new" className="grid gap-5" noValidate>
          <Field label="Name" name="name" error={errors.name}>
            <Input name="name" required maxLength={120} defaultValue={values.name} error={errors.name} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Email" name="email" optional error={errors.email}>
              <Input name="email" type="email" maxLength={254} defaultValue={values.email} error={errors.email} />
            </Field>
            <Field label="Phone" name="phone" optional error={errors.phone}>
              <Input name="phone" type="tel" maxLength={40} defaultValue={values.phone} error={errors.phone} />
            </Field>
          </div>
          <Checkbox name="marketing" value="1" defaultChecked={values.marketing === '1'} label="The customer agreed to receive offers from us" hint="Only tick this if the customer said yes. It is optional and does not affect their stamps or rewards." />
          <div>
            <Button>Add customer</Button>
          </div>
        </Form>
      </Card>
    </DashboardLayout>
  );
}

export function CustomerDetailPage({ biz, view, visits, referral, campaigns, claimLink, hasAccount, csrfOk }: {
  biz: BusinessContext;
  view: MemberView;
  visits: { occurred_at: Date; source: string; staff: string | null }[];
  referral: { referredBy: string | null; referred: number; qualified: number };
  campaigns: { name: string; event_type: string; created_at: Date }[];
  claimLink: string | null;
  hasAccount: boolean;
  csrfOk?: boolean;
}) {
  const tz = biz.timezone;
  const m = view.membership;
  const canAdjust = can(biz, 'adjust_balances');
  const available = view.vouchers.filter((v) => v.status === 'available');
  return (
    <DashboardLayout biz={biz} active="customers" wide>
      <PageHeader
        title={view.customer.name}
        back={{ href: '/dashboard/customers', label: 'Customers' }}
        description={`Member ${formatMemberCode(m.memberCode)} · joined ${dateShort(m.joinedAt, tz)} · ${m.visitCount} verified visit${m.visitCount === 1 ? '' : 's'}`}
        actions={
          <a href={`/terminal?m=${m.id}`} className="btn btn-primary btn-sm">
            Open in terminal
          </a>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {view.programmes.map((p) => (
              <Card key={p.id} className="p-5">
                <p className="text-[13px] text-muted-ink">{p.name}</p>
                <p className="mt-1 font-display text-[30px] font-semibold tnum">
                  {num(p.balance)}
                  <span className="ml-1 text-[15px] font-normal text-muted-ink">{p.type === 'stamps' ? `/ ${p.config?.stampsRequired} stamps` : 'points'}</span>
                </p>
                <p className="text-[12.5px] text-muted-ink">
                  Earned {num(p.lifetimeEarned)} · used {num(p.lifetimeSpent)}
                </p>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader title="Rewards" description={`${available.length} ready to use`} />
            {view.vouchers.length === 0 ? (
              <p className="px-5 pb-5 text-[14px] text-muted-ink">No rewards earned yet.</p>
            ) : (
              <ul className="divide-y divide-beige px-5 pb-2">
                {view.vouchers.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center gap-3 py-3">
                    <LuGift className={cn('h-5 w-5', v.status === 'available' ? 'text-terracotta-ink' : 'text-muted')} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[14.5px] font-medium">{v.name}</p>
                      <p className="text-[12.5px] text-muted-ink">
                        {v.source.replace('_', ' ')} · issued {dateShort(v.issuedAt, tz)}
                        {v.expiresAt && ` · ${v.status === 'expired' ? 'expired' : 'expires'} ${dateShort(v.expiresAt, tz)}`}
                        {v.redeemedAt && ` · redeemed ${dateShort(v.redeemedAt, tz)}`}
                      </p>
                    </div>
                    <Badge tone={v.status === 'available' ? 'accent' : v.status === 'redeemed' ? 'success' : 'neutral'}>{v.status}</Badge>
                    {v.status === 'available' && canAdjust && (
                      <Form action={`/dashboard/customers/${m.id}/void`} className="flex items-center gap-2">
                        <input type="hidden" name="voucher_id" value={v.id} />
                        <input type="hidden" name="idempotency_key" value={`void-${v.id}`} />
                        <input name="reason" className="input h-9 min-h-0 w-40 text-[13px]" placeholder="Reason" required minLength={3} aria-label="Reason for cancelling" />
                        <Button variant="danger-ghost" size="sm">
                          Cancel reward
                        </Button>
                      </Form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Recent transactions" action={<a className="text-[13.5px] link" href={`/dashboard/transactions?member=${m.id}`}>All</a>} />
            <ul className="divide-y divide-beige px-5 pb-2">
              {view.activity.length === 0 && <li className="py-3 text-[14px] text-muted-ink">No transactions yet.</li>}
              {view.activity.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px]">{a.description}</p>
                    <p className="text-[12px] text-muted-ink">
                      {a.programmeName ?? 'Reward'} · {dateTime(a.createdAt, tz)}
                    </p>
                  </div>
                  {a.delta !== 0 && <span className={cn('text-[14px] font-semibold tnum', a.delta > 0 ? 'text-success' : 'text-terracotta-ink')}>{a.delta > 0 ? `+${a.delta}` : a.delta}</span>}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="text-[16px] font-semibold">Details</h2>
            <dl className="mt-3 space-y-2 text-[14px]">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-ink">Status</dt>
                <dd>
                  <Badge tone={m.status === 'active' ? 'success' : 'neutral'}>{m.status}</Badge>
                </dd>
              </div>
              {can(biz, 'view_customers') && (
                <>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-ink">Email</dt>
                    <dd className="truncate">{view.customer.email ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-ink">Phone</dt>
                    <dd>{view.customer.phone ?? '—'}</dd>
                  </div>
                </>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-muted-ink">Marketing</dt>
                <dd>{m.marketingConsent ? 'Opted in' : 'Not opted in'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-ink">Account</dt>
                <dd>{hasAccount ? 'Self-service account' : 'Added at the counter'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-ink">Last visit</dt>
                <dd>{m.lastVisitAt ? relative(m.lastVisitAt) : 'No visit yet'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-ink">Referred by</dt>
                <dd>{referral.referredBy ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-ink">Referrals</dt>
                <dd className="tnum">
                  {referral.qualified} qualified / {referral.referred}
                </dd>
              </div>
            </dl>
          </Card>

          {!hasAccount && (
            <Card className="p-5">
              <h2 className="text-[16px] font-semibold">Claim link</h2>
              <p className="mt-1 text-[13.5px] text-muted-ink">Let the customer attach this membership to their own Perkora account so they can see their card on their phone. Each link works once and expires after 7 days.</p>
              {claimLink ? (
                <Island name="CopyField" props={{ value: claimLink, copyLabel: 'Copy', copiedLabel: 'Copied' }} />
              ) : (
                <Form action={`/dashboard/customers/${m.id}/claim`} className="mt-3">
                  <Button variant="secondary" size="sm">
                    Create claim link
                  </Button>
                </Form>
              )}
            </Card>
          )}

          {canAdjust && view.programmes.length > 0 && (
            <Card className="p-5">
              <h2 className="text-[16px] font-semibold">Correct balance</h2>
              <p className="mt-1 text-[13.5px] text-muted-ink">For mistakes or moving a paper card across. The change is recorded with your name and reason; nothing is deleted.</p>
              <Form action={`/dashboard/customers/${m.id}/adjust`} className="mt-4 grid gap-3">
                <input type="hidden" name="idempotency_key" value={`adj-${m.id}-${Date.now()}`} />
                <Field label="Programme" name="programme_id">
                  <Select name="programme_id">
                    {view.programmes.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.type})
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Change" name="delta" hint="Use a minus sign to remove, e.g. -2">
                  <Input name="delta" type="number" step="1" required />
                </Field>
                <Field label="Reason" name="reason">
                  <Textarea name="reason" rows={2} required minLength={3} maxLength={200} className="min-h-[64px]" />
                </Field>
                <div>
                  <Button variant="secondary" size="sm">
                    Save correction
                  </Button>
                </div>
              </Form>
            </Card>
          )}

          <Card className="p-5">
            <h2 className="text-[16px] font-semibold">Visit history</h2>
            {visits.length === 0 ? (
              <p className="mt-2 text-[14px] text-muted-ink">No verified visits yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-beige">
                {visits.map((v, i) => (
                  <li key={i} className="flex justify-between gap-3 py-2 text-[13.5px]">
                    <span>{dateTime(v.occurred_at, tz)}</span>
                    <span className="text-muted-ink">{v.staff ?? v.source}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="text-[16px] font-semibold">Campaign participation</h2>
            {campaigns.length === 0 ? (
              <p className="mt-2 text-[14px] text-muted-ink">No recorded campaign activity.</p>
            ) : (
              <ul className="mt-2 divide-y divide-beige">
                {campaigns.map((c, i) => (
                  <li key={i} className="flex justify-between gap-3 py-2 text-[13.5px]">
                    <span className="truncate">{c.name}</span>
                    <span className="shrink-0 text-muted-ink">
                      {c.event_type.replace('_', ' ')} · {dateShort(c.created_at, tz)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
      {csrfOk === false && <Alert tone="error">Session expired.</Alert>}
    </DashboardLayout>
  );
}
