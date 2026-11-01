import type { ReactNode } from 'react';
import { LuGift, LuMegaphone, LuPlus, LuStamp, LuStar, LuTrophy, LuLock } from 'react-icons/lu';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { Alert, Badge, Button, Card, CardHeader, Checkbox, EmptyState, Field, Form, Input, PageHeader, Select, Textarea } from '../../components/ui';
import { RewardBadgeIcon, StampGrid } from '../../components/brand';
import { Island } from '../../islands/Island';
import type { BusinessContext } from '../../../server/auth/guards';
import { REWARD_ICONS } from '../../../shared/schemas';
import { dateShort, num } from '../../../shared/format';
import { cn } from '../../cn';

type V = Record<string, string>;
type E = Record<string, string>;

export function LockedFeature({ title, plan }: { title: string; plan: string }) {
  return (
    <div className="flex items-start gap-3 rounded-[14px] border border-dashed border-beige-strong bg-paper p-4">
      <LuLock className="mt-0.5 h-5 w-5 text-muted" aria-hidden="true" />
      <div>
        <p className="text-[14.5px] font-medium">{title}</p>
        <p className="text-[13.5px] text-muted-ink">
          Not included in the {plan} plan.{' '}
          <a href="/dashboard/subscription" className="link">
            Compare plans
          </a>
        </p>
      </div>
    </div>
  );
}

function StatusBadge({ s }: { s: string }) {
  const tone = s === 'active' ? 'success' : s === 'scheduled' ? 'sage' : s === 'draft' ? 'neutral' : s === 'paused' ? 'warning' : 'neutral';
  return <Badge tone={tone as any}>{s}</Badge>;
}

/* ================================================================ programmes */

export interface ProgrammeRowView {
  id: string;
  name: string;
  programme_type: 'stamps' | 'points';
  config: any;
  status: string;
  terms: string | null;
  start_date: string | null;
  end_date: string | null;
  members: number;
  card_reward: string | null;
}

export interface ChallengeRowView {
  id: string;
  name: string;
  description: string | null;
  rule_type: string;
  required_count: number;
  period: string;
  start_date: string;
  end_date: string;
  status: string;
  reward_label: string;
  completions: number;
  visibility: string;
  eligible_segment: string;
}

export function ProgrammesPage({ biz, programmes, challenges, canAddProgramme, pointsAllowed, challengesAllowed }: {
  biz: BusinessContext;
  programmes: ProgrammeRowView[];
  challenges: ChallengeRowView[];
  canAddProgramme: boolean;
  pointsAllowed: boolean;
  challengesAllowed: boolean;
}) {
  return (
    <DashboardLayout biz={biz} active="programmes">
      <PageHeader
        title="Loyalty Programmes"
        description="How customers earn. Stamp cards turn full cards into rewards; points programmes let customers spend points on rewards you choose."
        actions={
          canAddProgramme ? (
            <a href="/dashboard/programmes/new" className="btn btn-primary btn-sm">
              <LuPlus className="h-4 w-4" aria-hidden="true" /> New programme
            </a>
          ) : undefined
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {programmes.map((p) => (
          <Card key={p.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-terracotta-tint text-terracotta-ink">
                  {p.programme_type === 'stamps' ? <LuStamp className="h-5 w-5" aria-hidden="true" /> : <LuStar className="h-5 w-5" aria-hidden="true" />}
                </span>
                <div>
                  <h2 className="text-[17px] font-semibold">{p.name}</h2>
                  <p className="text-[13px] text-muted-ink">{p.programme_type === 'stamps' ? 'Stamp card' : 'Points'}</p>
                </div>
              </div>
              <StatusBadge s={p.status} />
            </div>
            {p.programme_type === 'stamps' ? (
              <div className="mt-4">
                <StampGrid required={Number(p.config.stampsRequired)} filled={Math.max(0, Number(p.config.stampsRequired) - 2)} size={30} ariaLabel="Example card" />
                <p className="mt-3 text-[14.5px]">
                  Collect {p.config.stampsRequired} stamps → <span className="font-medium">{p.card_reward ?? 'no reward set'}</span>
                </p>
                <p className="text-[13px] text-muted-ink">
                  Qualifying: {p.config.eligiblePurchase} · up to {p.config.maxStampsPerTransaction ?? 1} per purchase
                </p>
              </div>
            ) : (
              <div className="mt-4">
                <p className="text-[14.5px]">
                  {p.config.earnMode === 'per_currency_unit'
                    ? `${p.config.pointsPerUnit} point${p.config.pointsPerUnit === 1 ? '' : 's'} per ${biz.currency === 'EUR' ? '€1' : '₺1'} spent`
                    : `${p.config.pointsPerPurchase} points per qualifying purchase`}
                </p>
                <p className="text-[13px] text-muted-ink">Qualifying: {p.config.eligiblePurchase}</p>
              </div>
            )}
            <div className="mt-4 flex items-center justify-between border-t border-beige pt-3">
              <span className="text-[13px] text-muted-ink">{num(p.members)} members with a balance</span>
              <a href={`/dashboard/programmes/${p.id}`} className="btn btn-secondary btn-sm">
                Edit
              </a>
            </div>
          </Card>
        ))}
      </div>
      {!pointsAllowed && (
        <div className="mt-4">
          <LockedFeature title="Points-based loyalty" plan={biz.plan.name} />
        </div>
      )}

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-[20px] font-semibold">Visit challenges</h2>
            <p className="text-[14px] text-muted-ink">Optional streaks such as “visit on three different days this week”. Only verified visits count; several purchases in one visit count once.</p>
          </div>
          {challengesAllowed && (
            <a href="/dashboard/challenges/new" className="btn btn-secondary btn-sm shrink-0">
              <LuPlus className="h-4 w-4" aria-hidden="true" /> New challenge
            </a>
          )}
        </div>
        {!challengesAllowed ? (
          <LockedFeature title="Configurable visit streaks" plan={biz.plan.name} />
        ) : challenges.length === 0 ? (
          <Card>
            <EmptyState icon={<LuTrophy className="h-6 w-6" />} title="No challenges yet" body="Challenges are optional. Create one if you want to reward regular visits." />
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Challenge</th>
                    <th>Rule</th>
                    <th>Reward</th>
                    <th>Dates</th>
                    <th className="text-right">Completed</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {challenges.map((c) => (
                    <tr key={c.id}>
                      <td className="font-medium">{c.name}</td>
                      <td className="text-[13.5px]">
                        {c.required_count} {c.rule_type === 'distinct_days' ? 'different days' : 'visits'} per {c.period === 'campaign' ? 'challenge' : c.period}
                      </td>
                      <td className="text-[13.5px]">{c.reward_label}</td>
                      <td className="whitespace-nowrap text-[13.5px] text-muted-ink">
                        {dateShort(c.start_date, biz.timezone)} – {dateShort(c.end_date, biz.timezone)}
                      </td>
                      <td className="text-right tnum">{c.completions}</td>
                      <td>
                        <StatusBadge s={c.status} />
                      </td>
                      <td>
                        <a className="btn btn-ghost btn-sm" href={`/dashboard/challenges/${c.id}`}>
                          Edit
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>
    </DashboardLayout>
  );
}

export function ProgrammeFormPage({ biz, mode, type, values, errors = {}, pointsAllowed }: { biz: BusinessContext; mode: 'new' | 'edit'; type: 'stamps' | 'points'; values: V; errors?: E; pointsAllowed: boolean }) {
  const action = mode === 'new' ? '/dashboard/programmes/new' : `/dashboard/programmes/${values.id}`;
  return (
    <DashboardLayout biz={biz} active="programmes">
      <PageHeader title={mode === 'new' ? 'New loyalty programme' : `Edit ${values.name}`} back={{ href: '/dashboard/programmes', label: 'Loyalty Programmes' }} />
      {mode === 'new' && (
        <div className="mb-4 flex gap-2">
          <a href="/dashboard/programmes/new?type=stamps" className={cn('btn btn-sm', type === 'stamps' ? 'btn-primary' : 'btn-secondary')}>
            Stamp card
          </a>
          {pointsAllowed ? (
            <a href="/dashboard/programmes/new?type=points" className={cn('btn btn-sm', type === 'points' ? 'btn-primary' : 'btn-secondary')}>
              Points
            </a>
          ) : (
            <span className="btn btn-secondary btn-sm" aria-disabled="true">
              <LuLock className="h-3.5 w-3.5" aria-hidden="true" /> Points (Premium plan)
            </span>
          )}
        </div>
      )}
      <Card className="max-w-3xl p-6">
        <Form action={action} className="grid gap-5" noValidate>
          {errors.form && <Alert tone="error">{errors.form}</Alert>}
          <input type="hidden" name="programme_type" value={type} />
          <Field label="Programme name" name="name" error={errors.name} hint="Shown to customers, e.g. “Coffee Club”.">
            <Input name="name" required maxLength={80} defaultValue={values.name} error={errors.name} />
          </Field>
          <Field label="Qualifying purchases" name="eligiblePurchase" error={errors.eligiblePurchase} hint="Be specific so staff and customers know what counts.">
            <Input name="eligiblePurchase" required maxLength={120} defaultValue={values.eligiblePurchase} placeholder={type === 'stamps' ? 'Any handcrafted coffee drink' : 'Any purchase'} error={errors.eligiblePurchase} />
          </Field>
          {type === 'stamps' ? (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Stamps for a reward" name="stampsRequired" error={errors.stampsRequired}>
                  <Input name="stampsRequired" type="number" min={2} max={30} required defaultValue={values.stampsRequired ?? '9'} error={errors.stampsRequired} />
                </Field>
                <Field label="Most stamps per purchase" name="maxStampsPerTransaction" error={errors.maxStampsPerTransaction} hint="Stops typing mistakes at the counter.">
                  <Input name="maxStampsPerTransaction" type="number" min={1} max={10} required defaultValue={values.maxStampsPerTransaction ?? '1'} error={errors.maxStampsPerTransaction} />
                </Field>
              </div>
              <fieldset className="rounded-[14px] border border-beige p-4">
                <legend className="px-1 text-[14px] font-semibold">Reward for a full card</legend>
                <div className="grid gap-4">
                  <Field label="Reward name" name="rewardName" error={errors.rewardName}>
                    <Input name="rewardName" required maxLength={80} defaultValue={values.rewardName ?? 'Free Regular Coffee'} error={errors.rewardName} />
                  </Field>
                  <Field label="Description" name="rewardDescription" optional>
                    <Input name="rewardDescription" maxLength={200} defaultValue={values.rewardDescription} />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Valid for (days after unlocking)" name="validityDays" optional error={errors.validityDays} hint="Leave empty for no expiry.">
                      <Input name="validityDays" type="number" min={1} max={730} defaultValue={values.validityDays} error={errors.validityDays} />
                    </Field>
                    <Field label="Icon" name="rewardIcon">
                      <Select name="rewardIcon" defaultValue={values.rewardIcon ?? 'coffee'}>
                        {REWARD_ICONS.map((i) => (
                          <option key={i} value={i}>
                            {i}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                </div>
              </fieldset>
            </>
          ) : (
            <>
              <Field label="How customers earn" name="earnMode">
                <Select name="earnMode" defaultValue={values.earnMode ?? 'per_currency_unit'}>
                  <option value="per_currency_unit">Points per {biz.currency === 'EUR' ? '€1' : '₺1'} spent</option>
                  <option value="per_purchase">Fixed points per qualifying purchase</option>
                </Select>
              </Field>
              <div className="grid gap-5 sm:grid-cols-3">
                <Field label={`Points per ${biz.currency === 'EUR' ? '€1' : '₺1'}`} name="pointsPerUnit" error={errors.pointsPerUnit}>
                  <Input name="pointsPerUnit" type="number" min={1} max={100} defaultValue={values.pointsPerUnit ?? '1'} error={errors.pointsPerUnit} />
                </Field>
                <Field label="Points per purchase" name="pointsPerPurchase" error={errors.pointsPerPurchase}>
                  <Input name="pointsPerPurchase" type="number" min={1} max={1000} defaultValue={values.pointsPerPurchase ?? '10'} error={errors.pointsPerPurchase} />
                </Field>
                <Field label="Most points per purchase" name="maxPointsPerTransaction" error={errors.maxPointsPerTransaction}>
                  <Input name="maxPointsPerTransaction" type="number" min={1} max={100000} defaultValue={values.maxPointsPerTransaction ?? '500'} error={errors.maxPointsPerTransaction} />
                </Field>
              </div>
              <Field label={`Minimum spend (${biz.currency})`} name="minSpend" optional error={errors.minSpend} hint="Purchases below this earn no points.">
                <Input name="minSpend" inputMode="decimal" defaultValue={values.minSpend} placeholder="0.00" error={errors.minSpend} />
              </Field>
              <p className="text-[13.5px] text-muted-ink">Add rewards customers can spend points on under Rewards after saving.</p>
            </>
          )}
          <Checkbox name="allowWithOtherPromotions" value="1" defaultChecked={values.allowWithOtherPromotions === '1'} label="Give credit for purchases that already used another discount or promotion" />
          <Field label="Programme terms" name="terms" optional hint="Shown on your public loyalty page.">
            <Textarea name="terms" rows={3} maxLength={2000} defaultValue={values.terms} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Status" name="status">
              <Select name="status" defaultValue={values.status ?? 'active'}>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="archived">Archived</option>
              </Select>
            </Field>
            <Field label="Starts" name="start_date" optional>
              <Input name="start_date" type="date" defaultValue={values.start_date} />
            </Field>
            <Field label="Ends" name="end_date" optional error={errors.end_date}>
              <Input name="end_date" type="date" defaultValue={values.end_date} error={errors.end_date} />
            </Field>
          </div>
          <div className="flex gap-3">
            <Button>{mode === 'new' ? 'Create programme' : 'Save changes'}</Button>
            <a href="/dashboard/programmes" className="btn btn-ghost">
              Cancel
            </a>
          </div>
        </Form>
      </Card>
    </DashboardLayout>
  );
}

export function ChallengeFormPage({ biz, mode, values, errors = {}, rewards, programmes, segmentsAllowed }: {
  biz: BusinessContext;
  mode: 'new' | 'edit';
  values: V;
  errors?: E;
  rewards: { id: string; name: string }[];
  programmes: { id: string; name: string; programme_type: string }[];
  segmentsAllowed: boolean;
}) {
  return (
    <DashboardLayout biz={biz} active="programmes">
      <PageHeader title={mode === 'new' ? 'New visit challenge' : `Edit ${values.name}`} back={{ href: '/dashboard/programmes', label: 'Loyalty Programmes' }} />
      <Card className="max-w-3xl p-6">
        <Form action={mode === 'new' ? '/dashboard/challenges/new' : `/dashboard/challenges/${values.id}`} className="grid gap-5" noValidate>
          {errors.form && <Alert tone="error">{errors.form}</Alert>}
          <Field label="Challenge name" name="name" error={errors.name}>
            <Input name="name" required maxLength={80} defaultValue={values.name} placeholder="Three-day week" error={errors.name} />
          </Field>
          <Field label="Description" name="description" optional hint="Explain the rule in one sentence for customers.">
            <Input name="description" maxLength={200} defaultValue={values.description} placeholder="Visit on three different days this week and get a free pastry." />
          </Field>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Count" name="rule_type">
              <Select name="rule_type" defaultValue={values.rule_type ?? 'distinct_days'}>
                <option value="distinct_days">Different visit days</option>
                <option value="visit_count">Verified visits</option>
              </Select>
            </Field>
            <Field label="Required" name="required_count" error={errors.required_count}>
              <Input name="required_count" type="number" min={1} max={100} defaultValue={values.required_count ?? '3'} error={errors.required_count} />
            </Field>
            <Field label="Within" name="period">
              <Select name="period" defaultValue={values.period ?? 'week'}>
                <option value="week">Each week (Mon–Sun)</option>
                <option value="month">Each month</option>
                <option value="campaign">The whole challenge</option>
              </Select>
            </Field>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Starts" name="start_date" error={errors.start_date}>
              <Input name="start_date" type="date" required defaultValue={values.start_date} error={errors.start_date} />
            </Field>
            <Field label="Ends" name="end_date" error={errors.end_date}>
              <Input name="end_date" type="date" required defaultValue={values.end_date} error={errors.end_date} />
            </Field>
          </div>
          <fieldset className="rounded-[14px] border border-beige p-4">
            <legend className="px-1 text-[14px] font-semibold">Reward</legend>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Type" name="reward_kind">
                <Select name="reward_kind" defaultValue={values.reward_kind ?? 'voucher'}>
                  <option value="voucher">A reward</option>
                  <option value="bonus">Bonus stamps or points</option>
                </Select>
              </Field>
              <div data-show-when="reward_kind:voucher" className="sm:col-span-2">
              <Field label="Reward" name="reward_id" error={errors.reward_id}>
                <Select name="reward_id" defaultValue={values.reward_id}>
                  <option value="">Choose…</option>
                  {rewards.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
              </Field>
              </div>
              <div data-show-when="reward_kind:bonus" className="sm:col-span-2">
              <Field label="Bonus" name="bonus_amount" error={errors.bonus_amount}>
                <div className="flex gap-2">
                  <Input name="bonus_amount" type="number" min={1} max={10000} defaultValue={values.bonus_amount} className="w-24" />
                  <Select name="bonus_programme_id" defaultValue={values.bonus_programme_id}>
                    {programmes.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </Field>
              </div>
            </div>
            <Island name="ShowWhen" props={{}} />
            {rewards.length === 0 && <p className="mt-3 text-[13px] text-muted-ink">Create a campaign reward under Rewards to use it here.</p>}
          </fieldset>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Times a customer can complete it" name="max_completions_per_customer" error={errors.max_completions_per_customer}>
              <Input name="max_completions_per_customer" type="number" min={1} max={520} defaultValue={values.max_completions_per_customer ?? '4'} />
            </Field>
            <Field label="Who can take part" name="eligible_segment">
              <Select name="eligible_segment" defaultValue={values.eligible_segment ?? 'all'}>
                <option value="all">All members</option>
                {segmentsAllowed && (
                  <>
                    <option value="new">New members</option>
                    <option value="active">Active members</option>
                    <option value="frequent">Frequent visitors</option>
                    <option value="inactive">Not visited recently</option>
                  </>
                )}
              </Select>
            </Field>
            <Field label="Visibility" name="visibility">
              <Select name="visibility" defaultValue={values.visibility ?? 'public'}>
                <option value="public">Shown to eligible members</option>
                <option value="invite_only">Invitation only</option>
              </Select>
            </Field>
          </div>
          <p className="-mt-2 text-[13px] text-muted-ink">Invitation-only challenges enrol the members who are in the chosen group when you activate it.</p>
          <Field label="Status" name="status">
            <Select name="status" defaultValue={values.status ?? 'draft'} className="sm:w-60">
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="ended">Ended</option>
            </Select>
          </Field>
          <div className="flex gap-3">
            <Button>{mode === 'new' ? 'Create challenge' : 'Save changes'}</Button>
            <a href="/dashboard/programmes" className="btn btn-ghost">
              Cancel
            </a>
          </div>
        </Form>
      </Card>
    </DashboardLayout>
  );
}

/* ================================================================ rewards */

export interface RewardRowView {
  id: string;
  name: string;
  description: string | null;
  reward_type: string;
  icon: string;
  points_cost: number | null;
  stamps_cost: number | null;
  programme_id: string | null;
  programme_name: string | null;
  is_card_reward: boolean;
  status: string;
  validity_days: number | null;
  start_date: string | null;
  end_date: string | null;
  issued: number;
  redeemed: number;
}

export function RewardsPage({ biz, rewards }: { biz: BusinessContext; rewards: RewardRowView[] }) {
  const groups: [string, string, RewardRowView[]][] = [
    ['Stamp card rewards', 'Unlocked automatically when a card is full. Edit them with the programme.', rewards.filter((r) => r.is_card_reward)],
    ['Points rewards', 'Customers spend points on these at the counter.', rewards.filter((r) => r.points_cost)],
    ['Campaign, challenge and referral rewards', 'Given by campaigns, challenges and referrals. They have no cost.', rewards.filter((r) => !r.is_card_reward && !r.points_cost)],
  ];
  return (
    <DashboardLayout biz={biz} active="rewards">
      <PageHeader
        title="Rewards"
        description="What customers can unlock. Unavailable rewards are never shown as redeemable."
        actions={
          <a href="/dashboard/rewards/new" className="btn btn-primary btn-sm">
            <LuPlus className="h-4 w-4" aria-hidden="true" /> Create reward
          </a>
        }
      />
      <div className="space-y-6">
        {groups.map(([title, help, items]) => (
          <Card key={title}>
            <CardHeader title={title} description={help} />
            {items.length === 0 ? (
              <p className="px-5 pb-5 text-[14px] text-muted-ink">None yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Reward</th>
                      <th>Cost</th>
                      <th>Validity</th>
                      <th className="text-right">Issued</th>
                      <th className="text-right">Redeemed</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <RewardBadgeIcon icon={r.icon} size="sm" />
                            <div>
                              <div className="font-medium">{r.name}</div>
                              <div className="text-[12.5px] capitalize text-muted-ink">{r.reward_type.replace('_', ' ')}</div>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap">{r.points_cost ? `${r.points_cost} points` : r.stamps_cost ? `${r.stamps_cost} stamps` : '—'}</td>
                        <td className="whitespace-nowrap text-[13.5px] text-muted-ink">
                          {r.validity_days ? `${r.validity_days} days after unlock` : 'No expiry'}
                          {r.end_date && <div>until {dateShort(r.end_date, biz.timezone)}</div>}
                        </td>
                        <td className="text-right tnum">{r.issued}</td>
                        <td className="text-right tnum">{r.redeemed}</td>
                        <td>
                          <StatusBadge s={r.status} />
                        </td>
                        <td>
                          <a className="btn btn-ghost btn-sm" href={r.is_card_reward && r.programme_id ? `/dashboard/programmes/${r.programme_id}` : `/dashboard/rewards/${r.id}`}>
                            Edit
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
}

export function RewardFormPage({ biz, mode, values, errors = {}, pointsProgrammes, stats }: {
  biz: BusinessContext;
  mode: 'new' | 'edit';
  values: V;
  errors?: E;
  pointsProgrammes: { id: string; name: string }[];
  stats?: { issued: number; redeemed: number; available: number } | null;
}) {
  return (
    <DashboardLayout biz={biz} active="rewards">
      <PageHeader title={mode === 'new' ? 'Create reward' : `Edit ${values.name}`} back={{ href: '/dashboard/rewards', label: 'Rewards' }} />
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <Card className="p-6">
          <Form action={mode === 'new' ? '/dashboard/rewards/new' : `/dashboard/rewards/${values.id}`} className="grid gap-5" id="reward-form" noValidate>
            {errors.form && <Alert tone="error">{errors.form}</Alert>}
            <Field label="How it is earned" name="kind">
              <Select name="kind" defaultValue={values.kind ?? (pointsProgrammes.length ? 'points' : 'grant')} disabled={mode === 'edit'}>
                {pointsProgrammes.length > 0 && <option value="points">Bought with points</option>}
                <option value="grant">Given by a campaign, challenge or referral</option>
              </Select>
            </Field>
            {mode === 'edit' && <input type="hidden" name="kind" value={values.kind} />}
            <Field label="Reward name" name="name" error={errors.name}>
              <Input name="name" required maxLength={80} defaultValue={values.name} placeholder="Free pastry" error={errors.name} />
            </Field>
            <Field label="Description" name="description" optional>
              <Input name="description" maxLength={200} defaultValue={values.description} placeholder="Any pastry from the counter" />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Type" name="reward_type">
                <Select name="reward_type" defaultValue={values.reward_type ?? 'free_item'}>
                  <option value="free_item">Free item</option>
                  <option value="discount">Discount</option>
                  <option value="free_upgrade">Free upgrade</option>
                  <option value="custom">Custom</option>
                </Select>
              </Field>
              <Field label="Icon" name="icon">
                <Select name="icon" defaultValue={values.icon ?? 'gift'}>
                  {REWARD_ICONS.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            {pointsProgrammes.length > 0 && (
              <div className="grid gap-5 sm:grid-cols-2" data-show-when="kind:points">
                <Field label="Points programme" name="programme_id">
                  <Select name="programme_id" defaultValue={values.programme_id}>
                    {pointsProgrammes.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Points cost" name="points_cost" error={errors.points_cost}>
                  <Input name="points_cost" type="number" min={1} max={100000} defaultValue={values.points_cost} error={errors.points_cost} />
                </Field>
              </div>
            )}
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Valid for (days)" name="validity_days" optional hint="After it is given.">
                <Input name="validity_days" type="number" min={1} max={730} defaultValue={values.validity_days} />
              </Field>
              <Field label="Available from" name="start_date" optional>
                <Input name="start_date" type="date" defaultValue={values.start_date} />
              </Field>
              <Field label="Available until" name="end_date" optional error={errors.end_date}>
                <Input name="end_date" type="date" defaultValue={values.end_date} error={errors.end_date} />
              </Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Limit per customer" name="per_customer_limit" optional>
                <Input name="per_customer_limit" type="number" min={1} defaultValue={values.per_customer_limit} />
              </Field>
              <Field label="Total limit" name="total_limit" optional hint="Across all customers.">
                <Input name="total_limit" type="number" min={1} defaultValue={values.total_limit} />
              </Field>
            </div>
            <Field label="Terms and restrictions" name="terms" optional>
              <Textarea name="terms" rows={2} maxLength={1000} defaultValue={values.terms} placeholder="Not valid with other offers." />
            </Field>
            <Field label="Status" name="status">
              <Select name="status" defaultValue={values.status ?? 'active'} className="sm:w-60">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="archived">Archived</option>
              </Select>
            </Field>
            <Island name="ShowWhen" props={{}} />
            <div className="flex gap-3">
              <Button>{mode === 'new' ? 'Create reward' : 'Save changes'}</Button>
              <a href="/dashboard/rewards" className="btn btn-ghost">
                Cancel
              </a>
            </div>
          </Form>
        </Card>
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="text-[15px] font-semibold">Customer preview</h2>
            <p className="mb-3 text-[13px] text-muted-ink">How this reward appears in a customer’s card.</p>
            <Island name="RewardPreview" props={{ formId: 'reward-form', initial: { name: values.name ?? '', description: values.description ?? '', icon: values.icon ?? 'gift', validity: values.validity_days ?? '', cost: values.points_cost ?? '' } }} />
          </Card>
          {stats && (
            <Card className="p-5">
              <h2 className="text-[15px] font-semibold">Performance</h2>
              <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
                {(
                  [
                    ['Issued', stats.issued],
                    ['Redeemed', stats.redeemed],
                    ['Unused', stats.available],
                  ] as const
                ).map(([l, v]) => (
                  <div key={l} className="rounded-[12px] bg-cream py-3">
                    <dt className="text-[12px] text-muted-ink">{l}</dt>
                    <dd className="font-display text-[22px] font-semibold tnum">{v}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

/* ================================================================ campaigns */

export interface CampaignRowView {
  id: string;
  name: string;
  campaign_type: string;
  display_status: string;
  start_date: string;
  end_date: string | null;
  target_segment: string;
  benefit_label: string;
  vouchers_issued: number;
  bonuses: number;
  redeemed: number;
  viewers: number;
}

export const CAMPAIGN_TYPE_LABEL: Record<string, string> = {
  custom: 'Bonus on purchases or a reward (most offers)',
  weekday: 'Certain days or hours (e.g. happy hour)',
  limited_time: 'A reward added to members’ cards',
  bonus_points: 'Extra points or stamps for a period',
  welcome: 'Welcome gift for new members',
  birthday: 'Birthday treat',
  win_back: 'Win back customers who stopped coming',
  referral: 'Referral (managed on the Referrals page)',
};

export function CampaignsPage({ biz, campaigns, allowed }: { biz: BusinessContext; campaigns: CampaignRowView[]; allowed: boolean }) {
  return (
    <DashboardLayout biz={biz} active="campaigns">
      <PageHeader
        title="Campaigns"
        description="Offers shown inside customers’ cards. Perkora doesn’t send email or SMS; for win-back campaigns it gives you a contact list of members who opted in."
        actions={
          allowed ? (
            <a href="/dashboard/campaigns/new" className="btn btn-primary btn-sm">
              <LuPlus className="h-4 w-4" aria-hidden="true" /> Create campaign
            </a>
          ) : undefined
        }
      />
      {!allowed ? (
        <LockedFeature title="Campaign management and promotional offers" plan={biz.plan.name} />
      ) : campaigns.length === 0 ? (
        <Card>
          <EmptyState icon={<LuMegaphone className="h-6 w-6" />} title="No campaigns yet" body="Start with a welcome offer or a weekday afternoon promotion." action={<a href="/dashboard/campaigns/new" className="btn btn-primary">Create campaign</a>} />
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Benefit</th>
                  <th>Dates</th>
                  <th className="text-right">Issued</th>
                  <th className="text-right">Redeemed</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <a href={`/dashboard/campaigns/${c.id}`} className="font-medium hover:underline">
                        {c.name}
                      </a>
                      <div className="text-[12.5px] text-muted-ink">{CAMPAIGN_TYPE_LABEL[c.campaign_type]}</div>
                    </td>
                    <td className="text-[13.5px]">{c.benefit_label}</td>
                    <td className="whitespace-nowrap text-[13.5px] text-muted-ink">
                      {dateShort(c.start_date, biz.timezone)} – {c.end_date ? dateShort(c.end_date, biz.timezone) : 'no end'}
                    </td>
                    <td className="text-right tnum">{c.vouchers_issued + c.bonuses}</td>
                    <td className="text-right tnum">{c.redeemed}</td>
                    <td>
                      <StatusBadge s={c.display_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </DashboardLayout>
  );
}

export function CampaignFormPage({ biz, mode, values, errors = {}, rewards, programmes, flexible, segmentsAllowed, referralsAllowed }: {
  biz: BusinessContext;
  mode: 'new' | 'edit';
  values: V;
  errors?: E;
  rewards: { id: string; name: string }[];
  programmes: { id: string; name: string; programme_type: string }[];
  flexible: boolean;
  segmentsAllowed: boolean;
  referralsAllowed: boolean;
}) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const chosenDays = (values.weekdays ?? '').split(',').filter(Boolean);
  const grantFields = (prefix: string, label: string) => (
    <fieldset className="rounded-[12px] border border-beige p-3">
      <legend className="px-1 text-[13px] font-semibold">{label}</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        <Select name={`${prefix}_kind`} defaultValue={values[`${prefix}_kind`] ?? 'bonus'} aria-label={`${label} type`}>
          <option value="bonus">Bonus stamps/points</option>
          <option value="voucher">A reward</option>
        </Select>
        <div className="flex gap-2">
          <Input name={`${prefix}_amount`} type="number" min={1} defaultValue={values[`${prefix}_amount`] ?? '1'} aria-label="Amount" className="w-20" />
          <Select name={`${prefix}_programme`} defaultValue={values[`${prefix}_programme`]} aria-label="Programme">
            {programmes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <Select name={`${prefix}_reward`} defaultValue={values[`${prefix}_reward`]} aria-label="Reward">
          <option value="">Reward…</option>
          {rewards.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
      </div>
    </fieldset>
  );
  return (
    <DashboardLayout biz={biz} active="campaigns">
      <PageHeader title={mode === 'new' ? 'Create campaign' : `Edit ${values.name}`} back={{ href: '/dashboard/campaigns', label: 'Campaigns' }} />
      <Card className="max-w-3xl p-6">
        <Form action={mode === 'new' ? '/dashboard/campaigns/new' : `/dashboard/campaigns/${values.id}/edit`} className="grid gap-5" noValidate>
          {errors.form && <Alert tone="error">{errors.form}</Alert>}
          <Field label="Campaign name" name="name" error={errors.name} hint="Call it anything you like. Customers see this name on their card.">
            <Input name="name" required maxLength={80} defaultValue={values.name} placeholder="Student exam week" error={errors.name} />
          </Field>
          <Island
            name="FillInput"
            props={{ target: 'name', label: 'Ideas:', options: ['Student exam week', 'Happy hour', 'Rainy day special', 'Weekend treat', 'Morning commuter offer', 'Thank-you week'] }}
          />
          <Field label="What kind of offer is it?" name="campaign_type" hint="This only decides how the offer works. The name above is what customers see.">
            <Select name="campaign_type" defaultValue={values.campaign_type ?? 'custom'}>
              {Object.entries(CAMPAIGN_TYPE_LABEL)
                .filter(([k]) => k !== 'referral' || values.campaign_type === 'referral')
                .map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
            </Select>
          </Field>
          {referralsAllowed && values.campaign_type !== 'referral' && (
            <p className="-mt-2 text-[13.5px] text-muted-ink">
              Looking for “bring a friend” rewards? Set them up on the <a className="link" href="/dashboard/referrals">Referrals</a> page.
            </p>
          )}
          <Field label="Description" name="description" optional>
            <Textarea name="description" rows={2} maxLength={400} defaultValue={values.description} placeholder="Double stamps on weekday afternoons." />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Starts" name="start_date" error={errors.start_date}>
              <Input name="start_date" type="date" required defaultValue={values.start_date} error={errors.start_date} />
            </Field>
            <Field label="Ends" name="end_date" optional error={errors.end_date}>
              <Input name="end_date" type="date" defaultValue={values.end_date} error={errors.end_date} />
            </Field>
          </div>

          <fieldset className="rounded-[14px] border border-beige p-4" data-show-when="campaign_type:welcome|bonus_points|limited_time|weekday|birthday|win_back|custom">
            <legend className="px-1 text-[14px] font-semibold">Benefit</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="What members get" name="benefit_kind">
                <Select name="benefit_kind" defaultValue={values.benefit_kind ?? 'bonus'}>
                  <option value="bonus">Bonus stamps or points on qualifying purchases</option>
                  <option value="voucher">A reward added to their card</option>
                  <option value="none">Nothing automatic (information only)</option>
                </Select>
              </Field>
              <div data-show-when="benefit_kind:voucher">
              <Field label="Reward" name="benefit_reward" error={errors.benefit_reward}>
                <Select name="benefit_reward" defaultValue={values.benefit_reward}>
                  <option value="">Choose…</option>
                  {rewards.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
              </Field>
              </div>
              <div data-show-when="benefit_kind:bonus">
              <Field label="Programme" name="benefit_programme" error={errors.benefit_programme}>
                <Select name="benefit_programme" defaultValue={values.benefit_programme}>
                  {programmes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Bonus" name="benefit_amount" error={errors.benefit_amount}>
                <div className="flex gap-2">
                  <Select name="benefit_mode" defaultValue={values.benefit_mode ?? 'flat'} aria-label="Bonus mode">
                    <option value="flat">Extra</option>
                    <option value="multiplier">Multiply by</option>
                  </Select>
                  <Input name="benefit_amount" type="number" min={1} max={10000} defaultValue={values.benefit_amount ?? '1'} className="w-24" error={errors.benefit_amount} />
                </div>
              </Field>
              </div>
            </div>
          </fieldset>

          <fieldset className="rounded-[14px] border border-beige p-4">
            <legend className="px-1 text-[14px] font-semibold">Who and when</legend>
            <div className="grid gap-4">
              <Field label="Target customers" name="target_segment">
                <Select name="target_segment" defaultValue={values.target_segment ?? 'all'}>
                  <option value="all">All members</option>
                  {segmentsAllowed ? (
                    <>
                      <option value="new">New members</option>
                      <option value="active">Active members</option>
                      <option value="frequent">Frequent visitors</option>
                      <option value="approaching">Close to a reward</option>
                      <option value="unused_rewards">Holding unused rewards</option>
                      <option value="inactive">Not visited recently ({biz.settings.inactivityDays}+ days)</option>
                      <option value="no_visits">Joined, no visit yet</option>
                    </>
                  ) : null}
                </Select>
              </Field>
              <div data-show-when="campaign_type:bonus_points|limited_time|weekday|win_back|custom">
                <p className="label">Days</p>
                <div className="flex flex-wrap gap-2">
                  {days.map((d, i) => (
                    <label key={d} className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-beige-strong bg-paper px-3 py-1.5 text-[13.5px]">
                      <input type="checkbox" name="weekday" value={String(i + 1)} defaultChecked={chosenDays.includes(String(i + 1))} className="checkbox h-4 w-4" />
                      {d}
                    </label>
                  ))}
                </div>
                <p className="hint">Leave all unticked for every day.</p>
              </div>
              {flexible ? (
                <div className="grid gap-4 sm:grid-cols-2" data-show-when="campaign_type:bonus_points|limited_time|weekday|win_back|custom">
                  <Field label="From time" name="start_time" optional>
                    <Input name="start_time" type="time" defaultValue={values.start_time} />
                  </Field>
                  <Field label="Until time" name="end_time" optional>
                    <Input name="end_time" type="time" defaultValue={values.end_time} />
                  </Field>
                </div>
              ) : (
                <LockedFeature title="Time-of-day windows (flexible campaign rules)" plan={biz.plan.name} />
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Uses per customer" name="usage_limit_per_customer" optional>
                  <Input name="usage_limit_per_customer" type="number" min={1} defaultValue={values.usage_limit_per_customer} />
                </Field>
                <Field label="Total uses" name="total_limit" optional>
                  <Input name="total_limit" type="number" min={1} defaultValue={values.total_limit} />
                </Field>
              </div>
              <div data-show-when="campaign_type:birthday">
              <Field label="Birthday window (days either side)" name="window_days" optional hint="The reward appears this many days before and after the birthday.">
                <Input name="window_days" type="number" min={0} max={31} defaultValue={values.window_days ?? '7'} className="sm:w-40" />
              </Field>
              </div>
            </div>
          </fieldset>

          {referralsAllowed && (
            <fieldset className="rounded-[14px] border border-beige p-4" data-show-when="campaign_type:referral">
              <legend className="px-1 text-[14px] font-semibold">Referral rewards</legend>
              <div className="grid gap-3">
                {grantFields('referrer', 'Reward for the member who invites')}
                {grantFields('referred', 'Reward for the new member')}
                <Field label="Rewarded referrals per member" name="max_per_referrer">
                  <Input name="max_per_referrer" type="number" min={1} max={100} defaultValue={values.max_per_referrer ?? '5'} className="sm:w-40" />
                </Field>
                <p className="text-[13px] text-muted-ink">A referral qualifies after the new member’s first verified visit. Customers can’t refer themselves.</p>
              </div>
            </fieldset>
          )}

          <Field label="How customers use it" name="redemption_instructions" optional>
            <Input name="redemption_instructions" maxLength={300} defaultValue={values.redemption_instructions} placeholder="Show your card when you order." />
          </Field>
          <Checkbox name="is_public" value="1" defaultChecked={values.is_public !== '0'} label="Also show on the public join page (only for campaigns open to all members)" />
          <Island name="ShowWhen" props={{}} />
          <div className="flex flex-wrap gap-3">
            <Button name="intent" value="preview">
              {mode === 'new' ? 'Save and preview' : 'Save changes'}
            </Button>
            <a href="/dashboard/campaigns" className="btn btn-ghost">
              Cancel
            </a>
          </div>
        </Form>
      </Card>
    </DashboardLayout>
  );
}

export function CampaignDetailPage({ biz, c, offerPreview, perf, contacts, eligible, canPublish, publishBlock }: {
  biz: BusinessContext;
  c: any;
  offerPreview: ReactNode;
  perf: { viewers: number; vouchers_issued: number; bonuses: number; bonus_total: number; redeemed: number; referrals_qualified: number; referrals_started: number };
  contacts: { name: string; email: string | null; phone: string | null; last_visit_at: Date | null }[] | null;
  eligible: number;
  canPublish: boolean;
  publishBlock: string | null;
}) {
  const voucherDistributable = c.benefit?.kind === 'voucher' && ['limited_time', 'win_back', 'custom'].includes(c.campaign_type) && c.display_status === 'active';
  return (
    <DashboardLayout biz={biz} active="campaigns">
      <PageHeader
        title={c.name}
        back={{ href: '/dashboard/campaigns', label: 'Campaigns' }}
        description={`${CAMPAIGN_TYPE_LABEL[c.campaign_type]} · ${dateShort(c.start_date, biz.timezone)} – ${c.end_date ? dateShort(c.end_date, biz.timezone) : 'no end date'}`}
        actions={
          <>
            <StatusBadge s={c.display_status} />
            <a href={`/dashboard/campaigns/${c.id}/edit`} className="btn btn-secondary btn-sm">
              Edit
            </a>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="text-[16px] font-semibold">Status</h2>
            {publishBlock && (
              <div className="mt-3">
                <Alert tone="warning">{publishBlock}</Alert>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {(c.status === 'draft' || c.status === 'paused') && (
                <Form action={`/dashboard/campaigns/${c.id}/status`}>
                  <input type="hidden" name="status" value="published" />
                  <Button size="sm" disabled={!canPublish}>
                    {c.status === 'draft' ? 'Publish' : 'Resume'}
                  </Button>
                </Form>
              )}
              {c.status === 'published' && (
                <Form action={`/dashboard/campaigns/${c.id}/status`}>
                  <input type="hidden" name="status" value="paused" />
                  <Button size="sm" variant="secondary">
                    Pause
                  </Button>
                </Form>
              )}
              {c.status !== 'completed' && c.status !== 'draft' && (
                <Form action={`/dashboard/campaigns/${c.id}/status`}>
                  <input type="hidden" name="status" value="completed" />
                  <Button size="sm" variant="ghost">
                    End campaign
                  </Button>
                </Form>
              )}
              {c.status === 'draft' && (
                <Form action={`/dashboard/campaigns/${c.id}/delete`}>
                  <Button size="sm" variant="danger-ghost">
                    Delete draft
                  </Button>
                </Form>
              )}
            </div>
            <p className="mt-3 text-[13px] text-muted-ink">
              Draft campaigns are never shown to customers. Published campaigns become active on their start date and complete after their end date.
            </p>
          </Card>

          <Card className="p-5">
            <h2 className="text-[16px] font-semibold">Performance</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  ['Eligible now', eligible],
                  ['Viewed in card', perf.viewers],
                  [c.campaign_type === 'referral' ? 'Referrals qualified' : 'Rewards issued', c.campaign_type === 'referral' ? `${perf.referrals_qualified} / ${perf.referrals_started}` : perf.vouchers_issued],
                  [c.benefit?.kind === 'bonus' ? 'Bonuses given' : 'Redeemed', c.benefit?.kind === 'bonus' ? `${perf.bonuses} (+${perf.bonus_total})` : perf.redeemed],
                ] as const
              ).map(([l, v]) => (
                <div key={l} className="rounded-[12px] bg-cream px-3 py-3">
                  <dt className="text-[12.5px] text-muted-ink">{l}</dt>
                  <dd className="font-display text-[22px] font-semibold tnum">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[12.5px] text-muted-ink">“Viewed” counts members who opened the Offers tab while the campaign ran. Perkora does not track email or SMS opens because it does not send messages.</p>
          </Card>

          {voucherDistributable && (
            <Card className="p-5">
              <h2 className="text-[16px] font-semibold">Add the reward to eligible cards</h2>
              <p className="mt-1 text-[14px] text-muted-ink">
                {eligible} member{eligible === 1 ? '' : 's'} currently match this campaign. Adding the reward places it in their card; members who already received it are skipped.
              </p>
              <Form action={`/dashboard/campaigns/${c.id}/distribute`} className="mt-3">
                <Button size="sm">Add reward to {eligible} card{eligible === 1 ? '' : 's'}</Button>
              </Form>
            </Card>
          )}

          {contacts && (
            <Card>
              <CardHeader
                title="Manual contact list"
                description="Perkora does not send messages. These eligible members agreed to hear from you; contact them yourself with the template below."
                action={
                  <a className="btn btn-secondary btn-sm" href={`/dashboard/campaigns/${c.id}/contacts.csv`}>
                    Export CSV
                  </a>
                }
              />
              <div className="px-5 pb-3">
                <p className="rounded-[12px] bg-cream p-3 text-[14px]">
                  Hi! We’ve missed you at {biz.name}. {c.description ?? ''} {c.end_date ? `Valid until ${dateShort(c.end_date, biz.timezone)}.` : ''} Reply STOP to opt out.
                </p>
              </div>
              {contacts.length === 0 ? (
                <p className="px-5 pb-5 text-[14px] text-muted-ink">No eligible members have opted in to marketing.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Phone</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.slice(0, 50).map((m, i) => (
                        <tr key={i}>
                          <td>{m.name}</td>
                          <td className="text-muted-ink">{m.email ?? '—'}</td>
                          <td className="text-muted-ink">{m.phone ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </div>
        <div>
          <Card className="p-5">
            <h2 className="text-[15px] font-semibold">Customer preview</h2>
            <p className="mb-3 text-[13px] text-muted-ink">As shown in the Offers tab of a member’s card.</p>
            <div className="rounded-[16px] bg-cream p-3">{offerPreview}</div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

export { LuGift };
