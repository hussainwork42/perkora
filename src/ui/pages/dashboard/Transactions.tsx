import { LuDownload, LuReceiptText } from 'react-icons/lu';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { Badge, Button, Card, EmptyState, Form, PageHeader, Pagination } from '../../components/ui';
import type { BusinessContext } from '../../../server/auth/guards';
import { can } from '../../../server/auth/guards';
import { dateTime, money } from '../../../shared/format';
import { cn } from '../../cn';

export interface TxnRow {
  id: string;
  created_at: Date;
  transaction_type: string;
  stamps_delta: number;
  points_delta: number;
  balance_after: number | null;
  description: string;
  reference_id: string | null;
  purchase_amount_minor: number | null;
  currency: string | null;
  source: string;
  membership_id: string;
  customer_name: string;
  programme_name: string | null;
  actor_name: string | null;
  reversed: boolean;
  redemption_id: string | null;
  redemption_status: string | null;
  operation_id: string | null;
}

const TYPE_LABEL: Record<string, string> = {
  earn: 'Purchase',
  bonus: 'Bonus',
  card_completed: 'Card completed',
  redeem: 'Redeemed',
  adjustment: 'Adjustment',
  reversal: 'Reversal',
  voucher_void: 'Reward cancelled',
  welcome: 'Welcome',
  referral: 'Referral',
  challenge: 'Challenge',
  voucher_issued: 'Reward issued',
};
const REVERSIBLE = ['earn', 'bonus', 'adjustment', 'welcome', 'referral', 'challenge'];

export function TransactionsPage({ biz, rows, total, page, pageSize, filters, memberName }: {
  biz: BusinessContext;
  rows: TxnRow[];
  total: number;
  page: number;
  pageSize: number;
  filters: { type: string; member: string; from: string; to: string; ref: string };
  memberName: string | null;
}) {
  const tz = biz.timezone;
  const canFix = can(biz, 'adjust_balances');
  const qs = (p: number) => {
    const s = new URLSearchParams({ ...filters, page: String(p) });
    for (const [k, v] of [...s.entries()]) if (!v || (k === 'page' && v === '1')) s.delete(k);
    return `/dashboard/transactions${s.toString() ? '?' + s : ''}`;
  };
  return (
    <DashboardLayout biz={biz} active="transactions" wide>
      <PageHeader
        title="Transactions"
        description={memberName ? `History for ${memberName}` : 'Every change to a loyalty balance, newest first. Corrections are added as new rows; nothing is deleted.'}
        actions={
          can(biz, 'view_reports') ? (
            <a className="btn btn-secondary btn-sm" href={`/dashboard/transactions/export.csv?${new URLSearchParams(filters).toString()}`}>
              <LuDownload className="h-4 w-4" aria-hidden="true" /> Export CSV
            </a>
          ) : undefined
        }
      />
      <Card>
        <form method="get" className="grid gap-3 border-b border-beige p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
          {filters.member && <input type="hidden" name="member" value={filters.member} />}
          <select name="type" defaultValue={filters.type} className="select" aria-label="Type">
            <option value="">All types</option>
            {Object.entries(TYPE_LABEL).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
          <input name="ref" defaultValue={filters.ref} className="input" placeholder="Receipt number" aria-label="Receipt number" />
          <input type="date" name="from" defaultValue={filters.from} className="input" aria-label="From" />
          <input type="date" name="to" defaultValue={filters.to} className="input" aria-label="To" />
          <Button variant="secondary" size="sm" className="self-center">
            Filter
          </Button>
        </form>
        {rows.length === 0 ? (
          <EmptyState icon={<LuReceiptText className="h-6 w-6" />} title="No transactions" body="Stamps, points and redemptions recorded at the counter appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Member</th>
                  <th>Type</th>
                  <th>Details</th>
                  <th className="text-right">Change</th>
                  <th className="text-right">Balance</th>
                  <th>By</th>
                  {canFix && <th className="sr-only">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const delta = r.stamps_delta || r.points_delta;
                  return (
                    <tr key={r.id} className={cn(r.reversed && 'opacity-60')}>
                      <td className="whitespace-nowrap text-muted-ink">{dateTime(r.created_at, tz)}</td>
                      <td>
                        <a href={`/dashboard/customers/${r.membership_id}`} className="font-medium hover:underline">
                          {r.customer_name}
                        </a>
                      </td>
                      <td>
                        <Badge tone={r.transaction_type === 'reversal' || r.transaction_type === 'voucher_void' ? 'error' : r.transaction_type === 'redeem' ? 'accent' : r.transaction_type === 'earn' ? 'neutral' : 'sage'}>
                          {TYPE_LABEL[r.transaction_type] ?? r.transaction_type}
                        </Badge>
                        {r.reversed && <span className="ml-1.5 text-[12px] text-error">reversed</span>}
                        {r.redemption_status === 'reversed' && r.transaction_type === 'redeem' && <span className="ml-1.5 text-[12px] text-error">reversed</span>}
                      </td>
                      <td className="min-w-[220px]">
                        <div className="text-[13.5px]">{r.description}</div>
                        <div className="text-[12px] text-muted-ink">
                          {[r.programme_name, r.reference_id && `Receipt ${r.reference_id}`, r.purchase_amount_minor !== null && r.currency && money(r.purchase_amount_minor, r.currency), r.source === 'seed' && 'demo data']
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      </td>
                      <td className={cn('text-right font-semibold tnum', delta > 0 ? 'text-success' : delta < 0 ? 'text-terracotta-ink' : 'text-muted')}>{delta === 0 ? '—' : delta > 0 ? `+${delta}` : delta}</td>
                      <td className="text-right tnum text-muted-ink">{r.balance_after ?? '—'}</td>
                      <td className="whitespace-nowrap text-[13px] text-muted-ink">{r.actor_name ?? (r.source === 'campaign' || r.source === 'system' ? 'Automatic' : '—')}</td>
                      {canFix && (
                        <td className="whitespace-nowrap">
                          {REVERSIBLE.includes(r.transaction_type) && !r.reversed && (
                            <details className="relative">
                              <summary className="btn btn-ghost btn-sm list-none text-[13px]">Reverse…</summary>
                              <Form action={`/dashboard/transactions/${r.id}/reverse`} className="absolute right-0 z-20 mt-1 w-72 rounded-[12px] border border-beige bg-paper p-3 shadow-xl">
                                <input type="hidden" name="idempotency_key" value={`rev-${r.id}`} />
                                <label className="label text-[13px]" htmlFor={`reason-${r.id}`}>
                                  Reason
                                </label>
                                <input id={`reason-${r.id}`} name="reason" className="input" required minLength={3} maxLength={200} placeholder="e.g. order refunded" />
                                {r.transaction_type === 'earn' && (
                                  <label className="mt-2 flex items-center gap-2 text-[13px]">
                                    <input type="checkbox" name="whole" value="1" className="checkbox" defaultChecked /> Include bonuses from the same purchase
                                  </label>
                                )}
                                <Button variant="danger" size="sm" className="mt-3 w-full">
                                  Reverse
                                </Button>
                              </Form>
                            </details>
                          )}
                          {r.transaction_type === 'redeem' && r.redemption_id && r.redemption_status === 'completed' && (
                            <details className="relative">
                              <summary className="btn btn-ghost btn-sm list-none text-[13px]">Undo…</summary>
                              <Form action={`/dashboard/redemptions/${r.redemption_id}/reverse`} className="absolute right-0 z-20 mt-1 w-72 rounded-[12px] border border-beige bg-paper p-3 shadow-xl">
                                <input type="hidden" name="idempotency_key" value={`revred-${r.redemption_id}`} />
                                <label className="label text-[13px]" htmlFor={`reason-${r.id}`}>
                                  Reason
                                </label>
                                <input id={`reason-${r.id}`} name="reason" className="input" required minLength={3} maxLength={200} placeholder="e.g. redeemed by mistake" />
                                <p className="mt-2 text-[12.5px] text-muted-ink">The reward (or points) go back to the member.</p>
                                <Button variant="danger" size="sm" className="mt-3 w-full">
                                  Undo redemption
                                </Button>
                              </Form>
                            </details>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageSize={pageSize} total={total} hrefFor={qs} />
      </Card>
    </DashboardLayout>
  );
}
