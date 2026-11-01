import { LuUserPlus } from 'react-icons/lu';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { Alert, Button, Card, Checkbox, Field, Form, Input, PageHeader, Select, Stat } from '../../components/ui';
import { Island } from '../../islands/Island';
import type { BusinessContext } from '../../../server/auth/guards';
import { num } from '../../../shared/format';

type V = Record<string, string>;
interface Opt {
  id: string;
  name: string;
  programme_type?: string;
}

export function ReferralsPage({ biz, values, errors = {}, programmes, rewards, stats, summary, locked }: {
  biz: BusinessContext;
  values: V;
  errors?: V;
  programmes: Opt[];
  rewards: Opt[];
  stats: { pending: number; qualified: number; rejected: number; top: { name: string; n: number }[] };
  summary: string | null;
  locked?: boolean;
}) {
  const grant = (prefix: 'referrer' | 'referred', label: string, allowNone: boolean) => (
    <fieldset className="rounded-[14px] border border-beige p-4">
      <legend className="px-1 text-[14.5px] font-semibold">{label}</legend>
      <div className="grid gap-3 sm:grid-cols-[170px_minmax(0,1fr)]">
        <Select name={`${prefix}_kind`} defaultValue={values[`${prefix}_kind`] ?? 'bonus'} aria-label={`${label}: type`}>
          <option value="bonus">Stamps or points</option>
          <option value="voucher">A reward</option>
          {allowNone && <option value="none">Nothing</option>}
        </Select>
        <div data-show-when={`${prefix}_kind:bonus`} className="flex gap-2">
          <Input name={`${prefix}_amount`} type="number" min={1} max={1000} defaultValue={values[`${prefix}_amount`] ?? '1'} aria-label="How many" className="w-24" error={errors[`${prefix}_amount`]} />
          <Select name={`${prefix}_programme`} defaultValue={values[`${prefix}_programme`]} aria-label="Stamps or points" className="flex-1">
            {programmes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.programme_type === 'points' ? 'points' : 'stamps'} · {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div data-show-when={`${prefix}_kind:voucher`}>
          <Select name={`${prefix}_reward`} defaultValue={values[`${prefix}_reward`]} aria-label="Reward" error={errors[`${prefix}_reward`]}>
            <option value="">Choose a reward…</option>
            {rewards.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
          {rewards.length === 0 && (
            <p className="hint">
              No rewards yet. <a className="link" href="/dashboard/rewards/new">Create one</a> first.
            </p>
          )}
        </div>
      </div>
    </fieldset>
  );

  return (
    <DashboardLayout biz={biz} active="referrals">
      <PageHeader title="Referrals" description="Reward customers who bring their friends. Each customer gets a personal invite link to share." />
      {locked ? (
        <Card className="max-w-2xl p-6">
          <p className="text-[15px]">Referral rewards aren’t included in your current plan.</p>
          <a href="/dashboard/subscription" className="btn btn-primary mt-4">
            See plans
          </a>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <Card className="p-6">
            <Form action="/dashboard/referrals" className="grid gap-5" noValidate>
              {errors.form && <Alert tone="error">{errors.form}</Alert>}
              <Checkbox
                name="enabled"
                value="1"
                defaultChecked={values.enabled === '1'}
                label={<span className="text-[15.5px] font-semibold">Turn on referral rewards</span>}
                hint="Customers see an “Invite friends” page with their own link. Turn it off at any time; rewards already earned stay on their cards."
              />
              <Field label="Name customers see" name="name" error={errors.name} hint="For example “Bring a friend” or “Coffee buddies”.">
                <Input name="name" maxLength={80} defaultValue={values.name ?? 'Bring a friend'} error={errors.name} />
              </Field>
              {programmes.length === 0 ? (
                <Alert tone="info">Set up a stamp card or points programme first, then choose the referral rewards here.</Alert>
              ) : (
                <>
                  {grant('referrer', 'The customer who invites gets', false)}
                  {grant('referred', 'Their friend gets', true)}
                </>
              )}
              <fieldset className="grid gap-2">
                <legend className="label">When does the inviter get the reward?</legend>
                <label className="flex cursor-pointer items-start gap-2.5 rounded-[12px] border border-beige p-3">
                  <input type="radio" name="qualify_on" value="first_visit" defaultChecked={values.qualify_on !== 'join'} className="mt-1" />
                  <span>
                    <span className="block text-[14.5px] font-medium">When the friend makes their first purchase (recommended)</span>
                    <span className="block text-[13.5px] text-muted-ink">Staff confirm the visit at the counter, so nobody can earn rewards with made-up accounts.</span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2.5 rounded-[12px] border border-beige p-3">
                  <input type="radio" name="qualify_on" value="join" defaultChecked={values.qualify_on === 'join'} className="mt-1" />
                  <span>
                    <span className="block text-[14.5px] font-medium">As soon as the friend joins</span>
                    <span className="block text-[13.5px] text-muted-ink">Faster, but someone could invite fake accounts. The limit below caps this.</span>
                  </span>
                </label>
              </fieldset>
              <Field label="Most rewards one customer can earn" name="max_per_referrer" error={errors.max_per_referrer}>
                <Input name="max_per_referrer" type="number" min={1} max={100} defaultValue={values.max_per_referrer ?? '10'} className="sm:w-40" error={errors.max_per_referrer} />
              </Field>
              <p className="text-[13px] text-muted-ink">Customers can’t refer themselves, and each friend can only be referred once.</p>
              <Island name="ShowWhen" props={{}} />
              <div>
                <Button>Save referral settings</Button>
              </div>
            </Form>
          </Card>
          <div className="grid content-start gap-4">
            <Card className="p-5">
              <h2 className="flex items-center gap-2 text-[15.5px] font-semibold">
                <LuUserPlus className="h-4 w-4" aria-hidden="true" /> What customers see
              </h2>
              {summary ? <p className="mt-2 text-[14.5px]">{summary}</p> : <p className="mt-2 text-[14px] text-muted-ink">Referral rewards are off. Customers don’t see an invite page.</p>}
            </Card>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Friends invited" value={num(stats.pending + stats.qualified)} hint="joined with a link" />
              <Stat label="Rewards earned" value={num(stats.qualified)} hint="referrals that counted" />
            </div>
            {stats.top.length > 0 && (
              <Card className="p-5">
                <h2 className="text-[15px] font-semibold">Top inviters</h2>
                <ul className="mt-2 space-y-1.5 text-[14px]">
                  {stats.top.map((t) => (
                    <li key={t.name} className="flex justify-between gap-3">
                      <span className="truncate">{t.name}</span>
                      <span className="tnum text-muted-ink">{t.n}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
