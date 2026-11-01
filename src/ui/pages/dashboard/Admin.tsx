import { LuCheck, LuDownload, LuPrinter, LuX } from 'react-icons/lu';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { Alert, Badge, Button, Card, CardHeader, Checkbox, Field, Form, Input, PageHeader, Select, Tabs, Textarea } from '../../components/ui';
import { CafeMark, Logo, StampGrid } from '../../components/brand';
import { LookFields } from '../../components/branding-fields';
import { Island } from '../../islands/Island';
import type { BusinessContext } from '../../../server/auth/guards';
import { STAFF_PERMISSIONS } from '../../../server/auth/guards';
import type { PlanView } from '../../../server/domain/plans';
import { dateShort, moneyWhole, relative } from '../../../shared/format';
import { METRIC_DEFINITIONS } from '../../../server/domain/analytics';
import { SEGMENT_LABELS } from '../../../server/domain/segments';
import { contrastText } from '../../cn';

type V = Record<string, string>;

/* ================================================================ team */

export interface TeamMember {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  permissions: Record<string, boolean>;
  last_sign_in_at: Date | null;
}
export interface Invitation {
  id: string;
  email: string;
  name: string | null;
  expires_at: Date;
  created_at: Date;
}

export function TeamPage({ biz, members, invitations, seatsUsed, inviteLink, errors = {}, values = {} }: {
  biz: BusinessContext;
  members: TeamMember[];
  invitations: Invitation[];
  seatsUsed: number;
  inviteLink: string | null;
  errors?: V;
  values?: V;
}) {
  const seats = biz.plan.features.limits.staffSeats;
  return (
    <DashboardLayout biz={biz} active="team">
      <PageHeader title="Team" description={`Staff accounts for the counter terminal. ${seatsUsed} of ${seats} staff seats used on the ${biz.plan.name} plan.`} />
      {inviteLink && (
        <Alert tone="success" title="Invitation created" className="mb-5">
          Perkora doesn’t send email yet, so share this one-time link with your staff member directly. It expires in 7 days.
          <Island name="CopyField" props={{ value: inviteLink, copyLabel: 'Copy link', copiedLabel: 'Copied' }} />
        </Alert>
      )}
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <Card>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Role</th>
                  <th>Permissions</th>
                  <th>Last sign-in</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className={m.status !== 'active' ? 'opacity-60' : ''}>
                    <td>
                      <div className="font-medium">{m.name}</div>
                      <div className="text-[12.5px] text-muted-ink">{m.email}</div>
                    </td>
                    <td>
                      <Badge tone={m.role === 'owner' ? 'accent' : 'neutral'}>{m.role}</Badge>
                      {m.status !== 'active' && <Badge tone="error" className="ml-1">deactivated</Badge>}
                    </td>
                    <td className="min-w-[230px]">
                      {m.role === 'owner' ? (
                        <span className="text-[13px] text-muted-ink">Everything</span>
                      ) : (
                        <Form action={`/dashboard/team/${m.id}/permissions`} className="space-y-1">
                          <span className="block text-[12.5px] text-muted-ink">Always: counter terminal</span>
                          {STAFF_PERMISSIONS.map((p) => (
                            <label key={p.key} className="flex items-center gap-2 text-[13px]" title={p.help}>
                              <input type="checkbox" name="perm" value={p.key} defaultChecked={Boolean(m.permissions[p.key])} className="checkbox h-4 w-4" disabled={m.status !== 'active'} />
                              {p.label}
                            </label>
                          ))}
                          {m.status === 'active' && (
                            <button className="btn btn-ghost btn-sm -ml-2 text-[13px]" type="submit">
                              Save permissions
                            </button>
                          )}
                        </Form>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-[13px] text-muted-ink">{m.last_sign_in_at ? relative(m.last_sign_in_at) : 'Never'}</td>
                    <td>
                      {m.role !== 'owner' && (
                        <Form action={`/dashboard/team/${m.id}/status`}>
                          <input type="hidden" name="status" value={m.status === 'active' ? 'deactivated' : 'active'} />
                          <Button variant={m.status === 'active' ? 'danger-ghost' : 'secondary'} size="sm">
                            {m.status === 'active' ? 'Deactivate' : 'Reactivate'}
                          </Button>
                        </Form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {invitations.length > 0 && (
            <div className="border-t border-beige px-5 py-4">
              <h3 className="text-[14px] font-semibold">Pending invitations</h3>
              <ul className="mt-2 divide-y divide-beige">
                {invitations.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 py-2 text-[13.5px]">
                    <span>
                      {i.name ? `${i.name} · ` : ''}
                      {i.email} <span className="text-muted-ink">· expires {relative(i.expires_at)}</span>
                    </span>
                    <Form action={`/dashboard/team/invitations/${i.id}/revoke`}>
                      <Button variant="ghost" size="sm">
                        Revoke
                      </Button>
                    </Form>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="text-[16px] font-semibold">Invite staff</h2>
          <p className="mt-1 text-[13.5px] text-muted-ink">Staff can always use the counter terminal. Give extra access only if they need it. Staff can never change your plan or ownership.</p>
          {seatsUsed >= seats ? (
            <Alert tone="warning" className="mt-4">
              All {seats} staff seats are in use. Deactivate someone or change plan to invite more.
            </Alert>
          ) : (
            <Form action="/dashboard/team/invite" className="mt-4 grid gap-4" noValidate>
              <Field label="Name" name="name" optional>
                <Input name="name" maxLength={120} defaultValue={values.name} />
              </Field>
              <Field label="Email" name="email" error={errors.email} hint="They must sign up or sign in with this email to accept.">
                <Input name="email" type="email" required defaultValue={values.email} error={errors.email} />
              </Field>
              <fieldset>
                <legend className="label">Extra access</legend>
                <div className="space-y-2">
                  {STAFF_PERMISSIONS.map((p) => (
                    <Checkbox key={p.key} name="perm" value={p.key} label={p.label} hint={p.help} />
                  ))}
                </div>
              </fieldset>
              <div>
                <Button>Create invitation link</Button>
              </div>
            </Form>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}

/* ================================================================ settings */

const TIMEZONES = ['Asia/Famagusta', 'Asia/Nicosia', 'Europe/Istanbul', 'Europe/Athens', 'Europe/London', 'Europe/Berlin', 'UTC'];

export function SettingsTabs({ current }: { current: string }) {
  return (
    <Tabs
      current={current}
      items={[
        { key: 'profile', href: '/dashboard/settings', label: 'Business profile' },
        { key: 'branding', href: '/dashboard/settings/branding', label: 'Branding' },
        { key: 'loyalty', href: '/dashboard/settings/loyalty', label: 'Loyalty settings' },
        { key: 'notifications', href: '/dashboard/settings/notifications', label: 'Notifications' },
        { key: 'qr', href: '/dashboard/settings/qr', label: 'QR code' },
      ]}
    />
  );
}

export function SettingsProfilePage({ biz, values, errors = {}, publicUrl }: { biz: BusinessContext; values: V; errors?: V; publicUrl: string }) {
  return (
    <DashboardLayout biz={biz} active="settings">
      <PageHeader title="Café Settings" />
      <SettingsTabs current="profile" />
      <Card className="max-w-3xl p-6">
        <Form action="/dashboard/settings" className="grid gap-5" noValidate>
          <Field label="Café name" name="name" error={errors.name}>
            <Input name="name" required maxLength={120} defaultValue={values.name} error={errors.name} />
          </Field>
          <Field label="Short description" name="description" optional hint="Shown on your public loyalty page.">
            <Textarea name="description" rows={2} maxLength={300} defaultValue={values.description} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="City" name="city" optional>
              <Input name="city" maxLength={80} defaultValue={values.city} />
            </Field>
            <Field label="Address" name="address" optional>
              <Input name="address" maxLength={200} defaultValue={values.address} />
            </Field>
            <Field label="Business email" name="business_email" optional error={errors.business_email}>
              <Input name="business_email" type="email" maxLength={254} defaultValue={values.business_email} error={errors.business_email} />
            </Field>
            <Field label="Phone" name="phone" optional error={errors.phone}>
              <Input name="phone" type="tel" maxLength={40} defaultValue={values.phone} error={errors.phone} />
            </Field>
            <Field label="Website" name="website" optional error={errors.website}>
              <Input name="website" type="url" maxLength={200} defaultValue={values.website} placeholder="https://" error={errors.website} />
            </Field>
            <Field label="Timezone" name="timezone" hint="Used for visit days, streaks, campaign dates and reports.">
              <Select name="timezone" defaultValue={values.timezone}>
                {[...new Set([values.timezone, ...TIMEZONES])].map((tz) => (
                  <option key={tz} value={tz}>
                    {tz === 'Asia/Famagusta' ? 'Asia/Famagusta (Northern Cyprus)' : tz}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Currency" name="default_currency" hint="Points are calculated in this currency. Perkora never converts currencies." error={errors.default_currency}>
              <Select name="default_currency" defaultValue={values.default_currency}>
                <option value="EUR">Euro (EUR)</option>
                <option value="TRY">Turkish lira (TRY)</option>
              </Select>
            </Field>
          </div>
          <div>
            <p className="label">Public loyalty page</p>
            <p className="text-[14.5px]">
              <a className="link" href={publicUrl} target="_blank" rel="noopener">
                {publicUrl}
              </a>
            </p>
          </div>
          <div>
            <Button>Save changes</Button>
          </div>
        </Form>
      </Card>
    </DashboardLayout>
  );
}

export function SettingsBrandingPage({ biz, errors = {} }: { biz: BusinessContext; errors?: V }) {
  const logo = biz.logoUploadId ? `/media/${biz.logoUploadId}` : null;
  const banner = biz.bannerUploadId ? `/media/${biz.bannerUploadId}` : null;
  const s = biz.settings;
  return (
    <DashboardLayout biz={biz} active="settings">
      <PageHeader title="Café Settings" description="Choose how your café looks to customers on its join page and loyalty card." />
      <SettingsTabs current="branding" />
      <div className="grid max-w-6xl gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="p-6">
          <Form action="/dashboard/settings/branding" multipart className="grid gap-6" id="branding-form">
            {errors.form && <Alert tone="error">{errors.form}</Alert>}
            <Field label="Logo" name="logo" optional hint="Square images look best." error={errors.logo}>
              <Island name="ImagePicker" props={{ name: 'logo', label: 'Logo', current: logo, maxSide: 600, shape: 'square', hint: 'PNG, JPEG or WebP. Large images are resized automatically.' }} />
            </Field>
            {logo && <Checkbox name="remove_logo" value="1" label="Remove the current logo" />}
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Main colour" name="primary_colour" hint="Header and buttons." error={errors.primary_colour}>
                <div className="flex items-center gap-3">
                  <input type="color" id="primary_colour" name="primary_colour" defaultValue={biz.primaryColour} className="h-11 w-14 cursor-pointer rounded-[10px] border border-beige-strong bg-paper p-1" />
                  <span className="text-[14px] tnum text-muted-ink">{biz.primaryColour}</span>
                </div>
              </Field>
              <Field label="Stamp colour" name="secondary_colour" hint="Stamps, logo background and accents." error={errors.secondary_colour}>
                <div className="flex items-center gap-3">
                  <input type="color" id="secondary_colour" name="secondary_colour" defaultValue={biz.secondaryColour} className="h-11 w-14 cursor-pointer rounded-[10px] border border-beige-strong bg-paper p-1" />
                  <span className="text-[14px] tnum text-muted-ink">{biz.secondaryColour}</span>
                </div>
              </Field>
            </div>
            <LookFields
              values={{ page_layout: s.pageLayout, stamp_icon: s.stampIcon, tagline: s.tagline }}
              errors={errors}
              primary={biz.primaryColour}
              secondary={biz.secondaryColour}
              bannerUrl={banner}
              showRemoveBanner
            />
            <Checkbox
              name="list_in_directory"
              value="1"
              defaultChecked={biz.listInDirectory}
              label="Show my café in the Perkora café list"
              hint="Customers can find you at Find a café and join without scanning your QR code."
            />
            <input type="hidden" name="directory_seen" value="1" />
            <div>
              <Button>Save look</Button>
            </div>
          </Form>
        </Card>
        <div className="lg:sticky lg:top-6 lg:self-start">
          <p className="mb-2 text-[13px] font-medium text-muted-ink">Live preview of a customer’s card</p>
          <Island
            name="BrandPreview"
            props={{
              formId: 'branding-form',
              initial: { name: biz.name, logoUrl: logo, bannerUrl: banner, primaryColour: biz.primaryColour, secondaryColour: biz.secondaryColour, layout: s.pageLayout, tagline: s.tagline },
              stampIcon: s.stampIcon,
              subtitle: 'Loyalty by Perkora',
              label: 'Preview of the customer card',
            }}
          />
          <a href={`/c/${biz.slug}`} target="_blank" rel="noopener" className="btn btn-secondary mt-3 w-full">
            Open your join page
          </a>
        </div>
      </div>
    </DashboardLayout>
  );
}

export function SettingsLoyaltyPage({ biz, errors = {} }: { biz: BusinessContext; errors?: V }) {
  const s = biz.settings;
  return (
    <DashboardLayout biz={biz} active="settings">
      <PageHeader title="Café Settings" />
      <SettingsTabs current="loyalty" />
      <div className="max-w-3xl space-y-4">
        <Alert tone="info">
          Programme type, earning rules, reward costs and expiry are set per programme under{' '}
          <a href="/dashboard/programmes" className="link">
            Loyalty Programmes
          </a>{' '}
          and{' '}
          <a href="/dashboard/rewards" className="link">
            Rewards
          </a>
          .
        </Alert>
        <Card className="p-6">
          <Form action="/dashboard/settings/loyalty" className="grid gap-5" noValidate>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Inactive after (days)" name="inactivityDays" hint={SEGMENT_LABELS.inactive.describe(s)} error={errors.inactivityDays}>
                <Input name="inactivityDays" type="number" min={7} max={365} defaultValue={String(s.inactivityDays)} error={errors.inactivityDays} />
              </Field>
              <Field label="“New member” for (days)" name="newMemberDays" error={errors.newMemberDays}>
                <Input name="newMemberDays" type="number" min={7} max={120} defaultValue={String(s.newMemberDays)} />
              </Field>
              <Field label="Frequent visitor: visits in 30 days" name="frequentVisits" error={errors.frequentVisits}>
                <Input name="frequentVisits" type="number" min={2} max={60} defaultValue={String(s.frequentVisits)} />
              </Field>
              <Field label="“Close to a reward”: stamps to go" name="approachingStamps" error={errors.approachingStamps}>
                <Input name="approachingStamps" type="number" min={1} max={10} defaultValue={String(s.approachingStamps)} />
              </Field>
              <Field label="One visit lasts (minutes)" name="visitWindowMinutes" hint="Several awards within this window count as one verified visit." error={errors.visitWindowMinutes}>
                <Input name="visitWindowMinutes" type="number" min={15} max={720} defaultValue={String(s.visitWindowMinutes)} />
              </Field>
              <Field label="Repeat-award check (seconds)" name="duplicateGuardSeconds" hint="Staff confirm when the same member earns again this quickly. 0 turns it off." error={errors.duplicateGuardSeconds}>
                <Input name="duplicateGuardSeconds" type="number" min={0} max={3600} defaultValue={String(s.duplicateGuardSeconds)} />
              </Field>
            </div>
            <Field label="When a purchase is refunded" name="refundPolicy">
              <Select name="refundPolicy" defaultValue={s.refundPolicy}>
                <option value="reverse">Reverse the stamps or points it earned (from Transactions)</option>
                <option value="keep">Let the customer keep them</option>
              </Select>
            </Field>
            <Field label="Notes for staff" name="staffInstructions" optional hint="Shown on the counter terminal.">
              <Textarea name="staffInstructions" rows={3} maxLength={1000} defaultValue={s.staffInstructions} placeholder="One stamp per hot or iced coffee. Ask for the receipt number on orders over €20." />
            </Field>
            <div>
              <Button>Save settings</Button>
            </div>
          </Form>
        </Card>
      </div>
    </DashboardLayout>
  );
}

export function SettingsNotificationsPage({ biz, consent }: { biz: BusinessContext; consent: { opted: number; total: number } }) {
  return (
    <DashboardLayout biz={biz} active="settings">
      <PageHeader title="Café Settings" />
      <SettingsTabs current="notifications" />
      <div className="max-w-3xl space-y-4">
        <Card className="p-6">
          <h2 className="text-[16px] font-semibold">Customer communication</h2>
          <p className="mt-1 text-[14px] text-muted-ink">
            {consent.opted} of {consent.total} members have agreed to receive offers from {biz.name}. Customers manage this themselves in their account; joining never depends on it.
          </p>
          <div className="mt-4 rounded-[12px] border border-beige bg-cream p-4">
            <p className="text-[14.5px] font-medium">Email and SMS delivery: not configured</p>
            <p className="mt-1 text-[13.5px] text-muted-ink">
              Perkora shows offers inside customers’ cards. It does not send email or SMS yet, so automated win-back messages are unavailable. Campaign pages give you a contact list of members who opted in.
            </p>
          </div>
        </Card>
        <Card className="p-6">
          <Form action="/dashboard/settings/notifications" className="grid gap-4">
            <h2 className="text-[16px] font-semibold">Display and alerts</h2>
            <Checkbox name="showOffersPublicly" value="1" defaultChecked={biz.settings.showOffersPublicly} label="Show offers open to everyone on the public join page" />
            <Checkbox name="operationalAlerts" value="1" defaultChecked={biz.settings.operationalAlerts} label="Show operational alerts on the dashboard" hint="For example, a reward that can’t be issued because it is inactive." />
            <div>
              <Button>Save</Button>
            </div>
          </Form>
        </Card>
      </div>
    </DashboardLayout>
  );
}

export function SettingsQrPage({ biz, svg, url }: { biz: BusinessContext; svg: string; url: string }) {
  return (
    <DashboardLayout biz={biz} active="settings">
      <PageHeader title="Café Settings" />
      <SettingsTabs current="qr" />
      <div className="grid max-w-4xl gap-5 md:grid-cols-[300px_1fr]">
        <Card className="p-5">
          <div className="aspect-square w-full rounded-[12px] border border-beige bg-white p-2 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="mt-3 break-all text-center text-[12.5px] text-muted-ink">{url}</p>
        </Card>
        <Card className="p-6">
          <h2 className="text-[17px] font-semibold">Your enrolment QR code</h2>
          <p className="mt-1 text-[14.5px] text-muted-ink">Customers scan this to open your loyalty page and join. Place it by the till, on tables or on receipts.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a href={`/c/${biz.slug}/qr.svg?download=1`} className="btn btn-primary">
              <LuDownload className="h-4 w-4" aria-hidden="true" /> Download SVG
            </a>
            <a href="/dashboard/settings/qr/poster" target="_blank" className="btn btn-secondary">
              <LuPrinter className="h-4 w-4" aria-hidden="true" /> Print-ready poster
            </a>
          </div>
          <p className="mt-4 text-[13px] text-muted-ink">SVG files scale to any size without losing quality, so they print sharply on stickers and table cards.</p>
        </Card>
      </div>
    </DashboardLayout>
  );
}

export function QrPosterPage({ biz, svg, rule }: { biz: BusinessContext; svg: string; rule: string }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-[720px] flex-col items-center justify-center bg-white px-10 py-12 text-center print:min-h-0">
      <CafeMark name={biz.name} logoUrl={biz.logoUploadId ? `/media/${biz.logoUploadId}` : null} colour={biz.primaryColour} size={72} />
      <h1 className="mt-5 text-[40px] font-semibold leading-tight">{biz.name}</h1>
      <p className="mt-2 text-[22px] text-muted-ink">Join our loyalty programme · Sadakat programımıza katılın</p>
      <div className="mt-8 w-[360px] max-w-full [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="mt-6 text-[24px] font-semibold">Scan to join · Katılmak için okutun</p>
      {rule && <p className="mt-2 max-w-md text-[18px] text-muted-ink">{rule}</p>}
      <p className="mt-3 text-[15px] text-muted-ink">No app needed · Uygulama gerekmez</p>
      <div className="mt-10 opacity-70">
        <Logo href={null} />
      </div>
      <div className="mt-8 print:hidden">
        <Island name="PrintButton" props={{ label: 'Print' }} />
      </div>
    </div>
  );
}

/* ================================================================ subscription */

export function SubscriptionPage({ biz, plans, sub, usage }: {
  biz: BusinessContext;
  plans: PlanView[];
  sub: any;
  usage: { programmes: number; staff: number; campaigns: number };
}) {
  const f = biz.plan.features;
  const statusText: Record<string, string> = {
    demo: 'Demo account — no billing',
    trialing: 'Free trial',
    pending_activation: 'Waiting for activation by Perkora',
    active: 'Active',
    past_due: 'Payment overdue',
    cancelled: 'Cancelled',
  };
  const featureRows: [keyof typeof f.features, string][] = [
    ['stamps', 'Digital stamp card'],
    ['points', 'Points-based loyalty'],
    ['challenges', 'Visit streaks'],
    ['campaigns', 'Campaign management and offers'],
    ['referrals', 'Referrals'],
    ['segments', 'Customer segmentation'],
    ['inactiveReport', 'Inactive-customer reporting'],
    ['flexibleCampaignRules', 'Time-of-day campaign rules'],
    ['advancedInsights', 'Advanced insights'],
    ['csvExport', 'CSV export'],
    ['prioritySupport', 'Priority support'],
  ];
  return (
    <DashboardLayout biz={biz} active="subscription">
      <PageHeader title="Subscription" />
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card className="p-6">
          <p className="text-[13px] text-muted-ink">Current plan</p>
          <p className="mt-1 font-display text-[30px] font-semibold">{biz.plan.name}</p>
          <dl className="mt-4 space-y-2 text-[14.5px]">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-ink">Subscription status</dt>
              <dd>
                <Badge tone={sub?.status === 'active' ? 'success' : sub?.status === 'past_due' ? 'error' : 'warning'}>{statusText[sub?.status] ?? sub?.status}</Badge>
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-ink">Payment</dt>
              <dd>{sub?.payment_status === 'paid' ? 'Paid' : sub?.payment_status === 'failed' ? 'Failed' : 'No payment taken (billing not configured)'}</dd>
            </div>
            {sub?.trial_ends_at && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-ink">Trial ends</dt>
                <dd>{dateShort(sub.trial_ends_at, biz.timezone)}</dd>
              </div>
            )}
            {sub?.requested_plan_id && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-ink">Requested change</dt>
                <dd className="capitalize">{sub.requested_plan_id} (awaiting confirmation)</dd>
              </div>
            )}
          </dl>
          <p className="mt-5 text-[13.5px] text-muted-ink">
            Online payment isn’t set up yet. During the pilot, our team arranges billing with you directly and activates your plan. Nothing is charged automatically.{' '}
            <a href="/contact" className="link">
              Contact us
            </a>
          </p>
        </Card>
        <Card className="p-6">
          <h2 className="text-[16px] font-semibold">Usage</h2>
          <dl className="mt-3 space-y-3 text-[14.5px]">
            {(
              [
                ['Loyalty programmes', usage.programmes, f.limits.programmes],
                ['Staff seats', usage.staff, f.limits.staffSeats],
                ['Running campaigns', usage.campaigns, f.limits.activeCampaigns],
                ['Café locations', 1, f.limits.locations],
              ] as const
            ).map(([l, used, max]) => (
              <div key={l}>
                <div className="flex justify-between">
                  <dt>{l}</dt>
                  <dd className="tnum">
                    {used} / {max}
                  </dd>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-beige">
                  <div className="h-full rounded-full bg-sage" style={{ width: `${max ? Math.min(100, (used / max) * 100) : 0}%` }} />
                </div>
              </div>
            ))}
          </dl>
          <h3 className="mt-6 text-[14px] font-semibold">Included features</h3>
          <ul className="mt-2 grid gap-1.5 text-[13.5px] sm:grid-cols-2">
            {featureRows.map(([k, l]) => (
              <li key={k} className="flex items-center gap-2">
                {f.features[k] ? <LuCheck className="h-4 w-4 text-success" aria-label="Included" /> : <LuX className="h-4 w-4 text-muted" aria-label="Not included" />}
                <span className={f.features[k] ? '' : 'text-muted-ink'}>{l}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <h2 className="mb-3 mt-8 text-[18px] font-semibold">Change plan</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => (
          <Card key={p.id} className={`p-5 ${p.id === biz.plan.id ? 'border-espresso' : ''}`}>
            <div className="flex items-center justify-between">
              <h3 className="text-[17px] font-semibold">{p.name}</h3>
              {p.recommended && <Badge tone="accent">Recommended</Badge>}
            </div>
            <p className="mt-1 font-display text-[26px] font-semibold tnum">
              {moneyWhole(p.monthlyPriceMinor, p.currency)}
              <span className="text-[14px] font-normal text-muted-ink">/month</span>
            </p>
            <p className="mt-1 text-[13.5px] text-muted-ink">{p.description}</p>
            <div className="mt-4">
              {p.id === biz.plan.id ? (
                <span className="btn btn-secondary btn-sm w-full" aria-disabled="true">
                  Current plan
                </span>
              ) : biz.isDemo ? (
                <span className="btn btn-secondary btn-sm w-full" aria-disabled="true">
                  Not available in the demo
                </span>
              ) : (
                <Form action="/dashboard/subscription">
                  <input type="hidden" name="plan_id" value={p.id} />
                  <Button variant="secondary" size="sm" className="w-full">
                    {sub?.status === 'trialing' ? `Switch to ${p.name}` : `Request ${p.name}`}
                  </Button>
                </Form>
              )}
            </div>
          </Card>
        ))}
      </div>
      <p className="mt-4 text-[13px] text-muted-ink">Prices are introductory proposals and may change. Taxes, payment processing fees and messaging charges may be additional.</p>
    </DashboardLayout>
  );
}

/* ================================================================ help */

export function HelpPage({ biz }: { biz: BusinessContext }) {
  const s = biz.settings;
  return (
    <DashboardLayout biz={biz} active="help">
      <PageHeader title="Help" description="How to run your programme day to day." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-[17px] font-semibold">At the counter</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-[14.5px]">
            <li>Open the Counter terminal on the till device and stay signed in.</li>
            <li>Ask the customer to open their card and tap “Show at the counter”.</li>
            <li>Tap “Scan customer QR”, or type the 8-character member code under the code.</li>
            <li>Check the name, choose Add stamp or Add points, and review the change.</li>
            <li>Tap Confirm. The customer’s card updates on their phone within a few seconds.</li>
            <li>To use a reward, tap Redeem next to it and confirm. Give the customer the item.</li>
          </ol>
          <p className="mt-3 text-[13.5px] text-muted-ink">
            Tip: on phones and tablets you can also scan the customer’s code with the normal camera app. The link opens the terminal on that customer, as long as the device is signed in.
          </p>
        </Card>
        <Card className="p-6">
          <h2 className="text-[17px] font-semibold">Fixing mistakes</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-[14.5px]">
            <li>Added a stamp to the wrong person? Open Transactions and choose Reverse on that row.</li>
            <li>Redeemed by mistake? Choose Undo on the redemption row; the reward goes back on the card.</li>
            <li>Moving a paper card across? Open the customer and use Correct balance with a reason.</li>
            <li>Every correction is added as a new, signed record. Nothing is ever deleted.</li>
          </ul>
        </Card>
        <Card className="p-6">
          <h2 className="text-[17px] font-semibold">How numbers are calculated</h2>
          <dl className="mt-3 space-y-3 text-[14px]">
            {Object.entries(METRIC_DEFINITIONS).map(([k, v]) => (
              <div key={k}>
                <dt className="font-medium capitalize">{k.replace(/([A-Z])/g, ' $1').toLowerCase()}</dt>
                <dd className="text-muted-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card className="p-6">
          <h2 className="text-[17px] font-semibold">Customer groups</h2>
          <dl className="mt-3 space-y-3 text-[14px]">
            {Object.entries(SEGMENT_LABELS).map(([k, v]) => (
              <div key={k}>
                <dt className="font-medium">{v.label}</dt>
                <dd className="text-muted-ink">{v.describe(s)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-[13.5px] text-muted-ink">
            Need help? <a href="/contact" className="link">Contact the Perkora team</a>.
          </p>
        </Card>
      </div>
    </DashboardLayout>
  );
}

export function InvitePage({ state, cafeName, email, error, path = '/' }: { state: 'invalid' | 'signin' | 'accept' | 'mismatch'; cafeName?: string; email?: string; error?: string; path?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md p-7 text-center">
        <Logo />
        {state === 'invalid' ? (
          <>
            <h1 className="mt-6 text-[22px] font-semibold">This invitation isn’t valid</h1>
            <p className="mt-2 text-muted-ink">It may have expired, been revoked or already been used. Ask the café owner for a new link.</p>
          </>
        ) : (
          <>
            <h1 className="mt-6 text-[22px] font-semibold">Join {cafeName} on Perkora</h1>
            <p className="mt-2 text-muted-ink">You’ve been invited as staff to use the counter terminal. The invitation is for {email}.</p>
            {error && <Alert tone="error" className="mt-4 text-left">{error}</Alert>}
            {state === 'mismatch' && (
              <Alert tone="warning" className="mt-4 text-left">
                You’re signed in with a different email. Sign out and sign in or create an account with {email}.
              </Alert>
            )}
            {state === 'accept' && (
              <Form action="" className="mt-6">
                <Button size="lg" className="w-full">
                  Accept invitation
                </Button>
              </Form>
            )}
            {state === 'signin' && (
              <div className="mt-6 grid gap-3">
                <a className="btn btn-primary btn-lg" href={`/sign-up?next=${encodeURIComponent(path)}`}>
                  Create an account
                </a>
                <a className="btn btn-secondary btn-lg" href={`/sign-in?next=${encodeURIComponent(path)}`}>
                  I already have an account
                </a>
              </div>
            )}
            {state === 'mismatch' && (
              <Form action="/sign-out" className="mt-4">
                <Button variant="secondary">Sign out</Button>
              </Form>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
