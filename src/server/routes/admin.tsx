import type { ReactNode } from 'react';
import type { Router } from '../http/router';
import type { Ctx } from '../http/core';
import { field, fieldAll, formObject, readBody, redirect } from '../http/core';
import { render } from '../http/render';
import { db, many, maybeOne, one } from '../db';
import { requireAdmin } from '../auth/guards';
import { notFound } from '../domain/errors';
import { loadPlans } from '../domain/plans';
import { planFeaturesSchema } from '../../shared/schemas';
import { Logo } from '../../ui/components/brand';
import { Alert, Badge, Button, Card, CardHeader, Checkbox, Field, FlashMessage, Form, Input, PageHeader, Select, Stat, Tabs } from '../../ui/components/ui';
import { dateShort, dateTime, moneyWhole, num, relative } from '../../shared/format';
import { config } from '../config';

function AdminLayout({ tab, children }: { tab: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-beige bg-coffee text-cream">
        <div className="mx-auto flex h-14 max-w-[1240px] items-center gap-4 px-4">
          <Logo tone="light" href="/admin" />
          <span className="badge bg-terracotta text-white">Platform admin</span>
          <Form action="/sign-out" className="ml-auto">
            <button className="btn btn-sm text-cream hover:bg-cream/10" type="submit">
              Sign out
            </button>
          </Form>
        </div>
      </header>
      <main className="mx-auto max-w-[1240px] px-4 py-6">
        <Tabs
          current={tab}
          items={[
            { key: 'cafes', href: '/admin', label: 'Cafés' },
            { key: 'plans', href: '/admin/plans', label: 'Plans' },
            { key: 'requests', href: '/admin/requests', label: 'Demo requests' },
            { key: 'logs', href: '/admin/logs', label: 'Error logs' },
            { key: 'demo', href: '/admin/demo', label: 'Demo data' },
          ]}
        />
        <FlashMessage />
        {children}
      </main>
    </div>
  );
}

function guard(fn: (ctx: Ctx) => Promise<any>) {
  return async (ctx: Ctx) => {
    const r = requireAdmin(ctx);
    if (r) return r;
    return fn(ctx);
  };
}

async function adminAudit(ctx: Ctx, action: string, targetType: string, targetId: string, metadata: object = {}) {
  await db.query(`insert into audit_logs (business_id, actor_user_id, action, target_type, target_id, metadata) values (null, $1, $2, $3, $4, $5)`, [ctx.user!.id, action, targetType, targetId, metadata]);
}

export function adminRoutes(r: Router) {
  r.get(
    '/admin',
    guard(async (ctx) => {
      const m = await one<any>(
        db,
        `select (select count(*)::int from businesses where not is_demo) as cafes,
                (select count(*)::int from businesses where status = 'active' and not is_demo) as active_cafes,
                (select count(*)::int from businesses where status = 'onboarding') as onboarding,
                (select count(*)::int from businesses where status = 'suspended') as suspended,
                (select count(*)::int from loyalty_memberships) as members,
                (select count(*)::int from loyalty_transactions where created_at > now() - interval '30 days') as txns,
                (select count(*)::int from demo_requests where status = 'new') as requests,
                (select count(*)::int from error_logs where created_at > now() - interval '7 days') as errors`,
      );
      const cafes = await many<any>(
        db,
        `select b.id, b.name, b.slug, b.city, b.status, b.is_demo, b.created_at, s.plan_id, s.status as sub_status, s.payment_status, s.requested_plan_id,
                (select count(*)::int from loyalty_memberships m where m.business_id = b.id) as members,
                (select count(*)::int from loyalty_transactions t where t.business_id = b.id and t.created_at > now() - interval '30 days') as txns_30d
           from businesses b left join subscriptions s on s.business_id = b.id order by b.created_at desc limit 200`,
      );
      return render(
        ctx,
        <AdminLayout tab="cafes">
          <PageHeader title="Cafés" description="Platform view. Customer personal data is not shown here." />
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Cafés (excl. demo)" value={num(m.cafes)} hint={`${m.active_cafes} active · ${m.onboarding} onboarding · ${m.suspended} suspended`} />
            <Stat label="Loyalty memberships" value={num(m.members)} hint="all cafés" />
            <Stat label="Transactions (30 days)" value={num(m.txns)} />
            <Stat label="Open demo requests" value={num(m.requests)} hint={`${m.errors} errors in 7 days`} />
          </div>
          <Card>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Café</th>
                    <th>Status</th>
                    <th>Plan</th>
                    <th>Subscription</th>
                    <th className="text-right">Members</th>
                    <th className="text-right">Txns 30d</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cafes.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <a href={`/c/${c.slug}`} className="font-medium hover:underline" target="_blank">
                          {c.name}
                        </a>
                        <div className="text-[12px] text-muted-ink">
                          {c.city ?? '—'} {c.is_demo && <Badge tone="warning">demo</Badge>}
                        </div>
                      </td>
                      <td>
                        <Badge tone={c.status === 'active' ? 'success' : c.status === 'suspended' ? 'error' : 'neutral'}>{c.status}</Badge>
                      </td>
                      <td className="capitalize">
                        {c.plan_id}
                        {c.requested_plan_id && <div className="text-[12px] text-warning-ink">requests {c.requested_plan_id}</div>}
                      </td>
                      <td className="text-[13px]">
                        {c.sub_status}
                        <div className="text-[12px] text-muted-ink">{c.payment_status}</div>
                      </td>
                      <td className="text-right tnum">{c.members}</td>
                      <td className="text-right tnum">{c.txns_30d}</td>
                      <td className="whitespace-nowrap text-[13px] text-muted-ink">{dateShort(c.created_at, 'UTC')}</td>
                      <td className="min-w-[230px]">
                        <div className="flex flex-wrap gap-1.5">
                          {c.status !== 'onboarding' && (
                            <Form action={`/admin/cafes/${c.id}/status`}>
                              <input type="hidden" name="status" value={c.status === 'suspended' ? 'active' : 'suspended'} />
                              <Button size="sm" variant={c.status === 'suspended' ? 'secondary' : 'danger-ghost'}>
                                {c.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                              </Button>
                            </Form>
                          )}
                          {!c.is_demo && (
                            <Form action={`/admin/cafes/${c.id}/subscription`} className="flex gap-1.5">
                              <select name="action" className="select h-9 min-h-0 w-36 text-[13px]" aria-label="Subscription action">
                                <option value="activate">Activate plan</option>
                                {c.requested_plan_id && <option value="apply_request">Apply requested plan</option>}
                                <option value="mark_paid">Mark period paid</option>
                                <option value="past_due">Mark past due</option>
                                <option value="cancel">Cancel</option>
                              </select>
                              <Button size="sm" variant="secondary">
                                Apply
                              </Button>
                            </Form>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </AdminLayout>,
        { title: 'Admin', noindex: true },
      );
    }),
  );

  r.post(
    '/admin/cafes/:id/status',
    guard(async (ctx) => {
      const status = field(await readBody(ctx), 'status') === 'active' ? 'active' : 'suspended';
      const r2 = await db.query(
        `update businesses set status = $2, suspended_at = case when $2 = 'suspended' then now() else null end, updated_at = now() where id = $1 and status <> 'onboarding'`,
        [ctx.params.id, status],
      );
      if (!r2.rowCount) throw notFound('Café');
      await adminAudit(ctx, `admin.cafe_${status}`, 'business', ctx.params.id);
      return redirect(ctx, '/admin', { type: 'success', message: status === 'active' ? 'Café reactivated.' : 'Café suspended.' });
    }),
  );

  r.post(
    '/admin/cafes/:id/subscription',
    guard(async (ctx) => {
      const action = field(await readBody(ctx), 'action');
      const sub = await maybeOne<any>(db, 'select * from subscriptions where business_id = $1', [ctx.params.id]);
      if (!sub) throw notFound('Subscription');
      const q: Record<string, string> = {
        activate: `update subscriptions set status = 'active', current_period_start = now(), current_period_end = now() + interval '1 month', updated_at = now() where business_id = $1`,
        apply_request: `update subscriptions set plan_id = coalesce(requested_plan_id, plan_id), requested_plan_id = null, updated_at = now() where business_id = $1`,
        mark_paid: `update subscriptions set payment_status = 'paid', provider = 'manual', current_period_start = now(), current_period_end = now() + interval '1 month', updated_at = now() where business_id = $1`,
        past_due: `update subscriptions set status = 'past_due', payment_status = 'failed', updated_at = now() where business_id = $1`,
        cancel: `update subscriptions set status = 'cancelled', updated_at = now() where business_id = $1`,
      };
      if (!q[action]) throw notFound();
      await db.query(q[action], [ctx.params.id]);
      await adminAudit(ctx, `admin.subscription_${action}`, 'subscription', sub.id);
      return redirect(ctx, '/admin', { type: 'success', message: 'Subscription updated. Payments are recorded manually; nothing was charged.' });
    }),
  );

  r.get(
    '/admin/plans',
    guard(async (ctx) => {
      const plans = await loadPlans(db, true);
      const featureKeys = Object.keys(planFeaturesSchema.parse({}).features);
      return render(
        ctx,
        <AdminLayout tab="plans">
          <PageHeader title="Plans" description="The single source of truth for prices, features and limits shown on the pricing page and enforced in the app." />
          <div className="grid gap-4 lg:grid-cols-3">
            {plans.map((p) => (
              <Card key={p.id} className="p-5">
                <Form action={`/admin/plans/${p.id}`} className="grid gap-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[17px] font-semibold">{p.id}</h2>
                    <span className="text-[13px] text-muted-ink">{moneyWhole(p.monthlyPriceMinor, p.currency)}/month</span>
                  </div>
                  <Field label="Name" name={`name`}>
                    <Input name="name" defaultValue={p.name} required />
                  </Field>
                  <Field label="Description" name="description">
                    <Input name="description" defaultValue={p.description} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Monthly price" name="price">
                      <Input name="price" defaultValue={(p.monthlyPriceMinor / 100).toFixed(2)} required />
                    </Field>
                    <Field label="Status" name="status">
                      <Select name="status" defaultValue={p.status}>
                        <option value="active">active</option>
                        <option value="hidden">hidden</option>
                        <option value="retired">retired</option>
                      </Select>
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {(['programmes', 'staffSeats', 'activeCampaigns', 'locations'] as const).map((k) => (
                      <Field key={k} label={k} name={`limit_${k}`}>
                        <Input name={`limit_${k}`} type="number" min={0} defaultValue={String(p.features.limits[k])} />
                      </Field>
                    ))}
                  </div>
                  <fieldset className="grid grid-cols-2 gap-1.5 text-[13px]">
                    <legend className="label">Features</legend>
                    {featureKeys.map((k) => (
                      <label key={k} className="flex items-center gap-2">
                        <input type="checkbox" name="feature" value={k} defaultChecked={Boolean((p.features.features as any)[k])} className="checkbox h-4 w-4" /> {k}
                      </label>
                    ))}
                  </fieldset>
                  <Checkbox name="recommended" value="1" defaultChecked={p.recommended} label="Mark as recommended" />
                  <Button size="sm">Save {p.name}</Button>
                </Form>
              </Card>
            ))}
          </div>
        </AdminLayout>,
        { title: 'Plans', noindex: true },
      );
    }),
  );

  r.post(
    '/admin/plans/:id',
    guard(async (ctx) => {
      const body = await readBody(ctx);
      const v = formObject(body);
      const plan = await maybeOne<any>(db, 'select * from plans where id = $1', [ctx.params.id]);
      if (!plan) throw notFound('Plan');
      const price = Math.round(Number(String(v.price).replace(',', '.')) * 100);
      if (!Number.isFinite(price) || price < 0 || price > 10_000_000) return redirect(ctx, '/admin/plans', { type: 'error', message: 'Enter a valid price.' });
      const features = Object.fromEntries(fieldAll(body, 'feature').map((k) => [k, true]));
      const limits = Object.fromEntries((['programmes', 'staffSeats', 'activeCampaigns', 'locations'] as const).map((k) => [k, Math.max(0, Number(v[`limit_${k}`]) || 0)]));
      limits.programmes = Math.max(1, limits.programmes);
      limits.staffSeats = Math.max(1, limits.staffSeats);
      limits.locations = Math.max(1, limits.locations);
      const fc = { ...plan.feature_configuration, features, limits };
      planFeaturesSchema.parse(fc);
      await db.query(`update plans set name = $2, description = $3, monthly_price_minor = $4, status = $5, feature_configuration = $6, is_recommended = $7, updated_at = now() where id = $1`, [
        plan.id,
        v.name?.trim() || plan.name,
        v.description?.trim() ?? '',
        price,
        ['active', 'hidden', 'retired'].includes(v.status) ? v.status : 'active',
        fc,
        v.recommended === '1',
      ]);
      await adminAudit(ctx, 'admin.plan_updated', 'plan', plan.id, { price, limits });
      return redirect(ctx, '/admin/plans', { type: 'success', message: 'Plan saved. The pricing page and limits use it immediately.' });
    }),
  );

  r.get(
    '/admin/requests',
    guard(async (ctx) => {
      const rows = await many<any>(db, `select * from demo_requests order by created_at desc limit 200`);
      return render(
        ctx,
        <AdminLayout tab="requests">
          <PageHeader title="Demo and contact requests" description="From the public website. Reply to these personally." />
          <Card>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>From</th>
                    <th>Café</th>
                    <th>Message</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-muted-ink">
                        No requests yet.
                      </td>
                    </tr>
                  )}
                  {rows.map((d) => (
                    <tr key={d.id}>
                      <td className="whitespace-nowrap text-[13px] text-muted-ink">{relative(d.created_at)}</td>
                      <td>
                        <div className="font-medium">{d.name}</div>
                        <div className="text-[12.5px] text-muted-ink">
                          {d.email}
                          {d.phone ? ` · ${d.phone}` : ''}
                        </div>
                      </td>
                      <td className="text-[13.5px]">
                        {d.cafe_name ?? '—'}
                        <div className="text-[12px] text-muted-ink">
                          {d.kind} {d.city ? `· ${d.city}` : ''}
                        </div>
                      </td>
                      <td className="max-w-[320px] text-[13.5px]">{d.message ?? '—'}</td>
                      <td>
                        <Form action={`/admin/requests/${d.id}`} className="flex gap-1.5">
                          <select name="status" defaultValue={d.status} className="select h-9 min-h-0 w-32 text-[13px]" aria-label="Status">
                            <option value="new">new</option>
                            <option value="contacted">contacted</option>
                            <option value="closed">closed</option>
                          </select>
                          <Button size="sm" variant="secondary">
                            Save
                          </Button>
                        </Form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </AdminLayout>,
        { title: 'Requests', noindex: true },
      );
    }),
  );
  r.post(
    '/admin/requests/:id',
    guard(async (ctx) => {
      const status = field(await readBody(ctx), 'status');
      if (['new', 'contacted', 'closed'].includes(status)) await db.query('update demo_requests set status = $2 where id = $1', [ctx.params.id, status]);
      return redirect(ctx, '/admin/requests', { type: 'success', message: 'Saved.' });
    }),
  );

  r.get(
    '/admin/logs',
    guard(async (ctx) => {
      const rows = await many<any>(db, `select id, level, message, path, method, error_code, created_at from error_logs order by created_at desc limit 200`);
      return render(
        ctx,
        <AdminLayout tab="logs">
          <PageHeader title="Error logs" description="Server errors, newest first. Messages are truncated and contain no passwords or tokens." />
          <Card>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Request</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-muted-ink">
                        No errors logged.
                      </td>
                    </tr>
                  )}
                  {rows.map((e) => (
                    <tr key={e.id}>
                      <td className="whitespace-nowrap text-[13px]">{dateTime(e.created_at, 'UTC')} UTC</td>
                      <td className="text-[13px]">
                        {e.method} {e.path}
                      </td>
                      <td className="text-[13px]">
                        {e.error_code && <Badge tone="error">{e.error_code}</Badge>} {e.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </AdminLayout>,
        { title: 'Error logs', noindex: true },
      );
    }),
  );

  r.get(
    '/admin/demo',
    guard(async (ctx) => {
      const demo = await many<any>(db, `select b.name, b.slug, (select count(*)::int from loyalty_memberships m where m.business_id = b.id) as members from businesses b where b.is_demo order by b.name`);
      return render(
        ctx,
        <AdminLayout tab="demo">
          <PageHeader title="Demo data" description="Fictional cafés, customers and history used for sales demonstrations." />
          <Card className="max-w-2xl p-6">
            <ul className="space-y-1 text-[14.5px]">
              {demo.map((d) => (
                <li key={d.slug}>
                  <a className="link" href={`/c/${d.slug}`} target="_blank">
                    {d.name}
                  </a>{' '}
                  — {d.members} fictional members
                </li>
              ))}
              {demo.length === 0 && <li className="text-muted-ink">No demo cafés. Reset to create them.</li>}
            </ul>
            <Alert tone="warning" className="mt-5">
              Resetting deletes only records marked as demo (the demo cafés, their fictional customers and demo guest accounts) and recreates them. Real cafés and customers are never touched.
            </Alert>
            {config().DEMO_MODE ? (
              <Form action="/admin/demo/reset" className="mt-4">
                <Button variant="danger">Reset demo data</Button>
              </Form>
            ) : (
              <p className="mt-4 text-[14px] text-muted-ink">Demo mode is off (DEMO_MODE=false).</p>
            )}
          </Card>
        </AdminLayout>,
        { title: 'Demo data', noindex: true },
      );
    }),
  );

  r.post(
    '/admin/demo/reset',
    guard(async (ctx) => {
      if (!config().DEMO_MODE) throw notFound();
      const { resetDemoData } = await import('../seed/demo');
      await resetDemoData();
      await adminAudit(ctx, 'admin.demo_reset', 'demo', 'all');
      return redirect(ctx, '/admin/demo', { type: 'success', message: 'Demo data reset.' });
    }),
  );
}
