import { LuCheck, LuDownload, LuPrinter } from 'react-icons/lu';
import { usePage } from '../page-context';
import { CafeMark, Logo, StampGrid } from '../components/brand';
import { Alert, Button, Checkbox, Field, FlashMessage, Form, Input, Select, Textarea } from '../components/ui';
import { Island } from '../islands/Island';
import { LookFields } from '../components/branding-fields';
import { cn, contrastText } from '../cn';

type V = Record<string, string>;
const STEPS = ['Business information', 'Loyalty programme', 'Rewards', 'Look & QR code', 'Review'];

function Shell({ step, children, maxStep }: { step: number; children: React.ReactNode; maxStep: number }) {
  const { user } = usePage();
  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-beige bg-paper">
        <div className="mx-auto flex h-16 max-w-[980px] items-center justify-between px-4">
          <Logo />
          <span className="text-[13.5px] text-muted-ink">{user?.name}</span>
        </div>
      </header>
      <div className="mx-auto max-w-[980px] px-4 py-8">
        <ol className="mb-8 grid grid-cols-5 gap-2" aria-label="Setup progress">
          {STEPS.map((s, i) => {
            const n = i + 1;
            const done = n < step;
            const reachable = n <= maxStep;
            const inner = (
              <>
                <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold', n === step ? 'bg-espresso text-cream' : done ? 'bg-sage text-white' : 'bg-beige text-muted-ink')}>
                  {done ? <LuCheck className="h-4 w-4" aria-hidden="true" /> : n}
                </span>
                <span className={cn('hidden text-[13px] md:block', n === step ? 'font-semibold text-ink' : 'text-muted-ink')}>{s}</span>
              </>
            );
            return (
              <li key={s} aria-current={n === step ? 'step' : undefined}>
                {reachable && n !== step ? (
                  <a href={`/onboarding?step=${n}`} className="flex items-center gap-2 border-t-2 border-beige-strong pt-3 hover:border-espresso">
                    {inner}
                  </a>
                ) : (
                  <div className={cn('flex items-center gap-2 border-t-2 pt-3', n === step ? 'border-espresso' : 'border-beige')}>{inner}</div>
                )}
              </li>
            );
          })}
        </ol>
        <FlashMessage />
        {children}
      </div>
    </div>
  );
}

export function OnboardingStep1({ values, errors = {}, maxStep }: { values: V; errors?: V; maxStep: number }) {
  return (
    <Shell step={1} maxStep={maxStep}>
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="panel p-6 sm:p-8">
          <h1 className="text-[26px] font-semibold">Tell us about your café</h1>
          <p className="mt-1 text-muted-ink">Customers see your name, logo and colours on their loyalty card.</p>
          <Form action="/onboarding/1" multipart className="mt-6 grid gap-5" noValidate>
            {errors.form && <Alert tone="error">{errors.form}</Alert>}
            <input type="hidden" name="plan" value={values.plan ?? ''} />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Café name" name="name" error={errors.name}>
                <Input name="name" required maxLength={120} defaultValue={values.name} error={errors.name} autoFocus />
              </Field>
              <Field label="Owner’s name" name="owner_name" error={errors.owner_name}>
                <Input name="owner_name" required maxLength={120} defaultValue={values.owner_name} error={errors.owner_name} />
              </Field>
              <Field label="Business email" name="business_email" error={errors.business_email}>
                <Input name="business_email" type="email" required defaultValue={values.business_email} error={errors.business_email} />
              </Field>
              <Field label="Phone" name="phone" optional error={errors.phone}>
                <Input name="phone" type="tel" maxLength={40} defaultValue={values.phone} error={errors.phone} />
              </Field>
              <Field label="City" name="city" error={errors.city}>
                <Input name="city" required maxLength={80} defaultValue={values.city ?? 'Girne'} error={errors.city} />
              </Field>
              <Field label="Website" name="website" optional error={errors.website}>
                <Input name="website" type="url" maxLength={200} defaultValue={values.website} placeholder="https://" error={errors.website} />
              </Field>
            </div>
            <Field label="Address" name="address" optional>
              <Input name="address" maxLength={200} defaultValue={values.address} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Logo" name="logo" optional hint="PNG, JPEG or WebP, max 1 MB." error={errors.logo} className="sm:col-span-1">
                <input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" className="text-[13.5px]" />
              </Field>
              <Field label="Primary colour" name="primary_colour">
                <input id="primary_colour" type="color" name="primary_colour" defaultValue={values.primary_colour ?? '#3B2925'} className="h-11 w-full cursor-pointer rounded-[10px] border border-beige-strong bg-paper p-1" />
              </Field>
              <Field label="Secondary colour" name="secondary_colour">
                <input id="secondary_colour" type="color" name="secondary_colour" defaultValue={values.secondary_colour ?? '#B86F52'} className="h-11 w-full cursor-pointer rounded-[10px] border border-beige-strong bg-paper p-1" />
              </Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Currency" name="default_currency" hint="Points are calculated in this currency.">
                <Select name="default_currency" defaultValue={values.default_currency ?? 'EUR'}>
                  <option value="EUR">Euro (EUR)</option>
                  <option value="TRY">Turkish lira (TRY)</option>
                </Select>
              </Field>
              <Field label="Timezone" name="timezone">
                <Select name="timezone" defaultValue={values.timezone ?? 'Asia/Famagusta'}>
                  <option value="Asia/Famagusta">Northern Cyprus (Asia/Famagusta)</option>
                  <option value="Europe/Istanbul">Turkey (Europe/Istanbul)</option>
                  <option value="Asia/Nicosia">Cyprus (Asia/Nicosia)</option>
                  <option value="Europe/London">UK (Europe/London)</option>
                </Select>
              </Field>
            </div>
            <div>
              <Button size="lg">Save and continue</Button>
            </div>
          </Form>
        </div>
        <aside className="text-[14px] text-muted-ink">
          <p className="font-medium text-ink">What happens next</p>
          <p className="mt-1">Choose how customers earn, set your first reward and download your QR code. Nothing goes live until you activate it in the last step.</p>
        </aside>
      </div>
    </Shell>
  );
}

export function OnboardingStep2({ values, pointsAllowed, maxStep }: { values: V; pointsAllowed: boolean; maxStep: number }) {
  const opts = [
    { v: 'stamps', title: 'Digital stamp card', body: 'Recommended to start. “Collect 9 stamps, get a free coffee.” Easy for customers and staff.' },
    { v: 'points', title: 'Points', body: 'Customers earn points per euro or per purchase and spend them on rewards you choose.' },
    { v: 'both', title: 'Both, side by side', body: 'A stamp card for coffee plus points on everything else. Each balance is separate.' },
  ];
  return (
    <Shell step={2} maxStep={maxStep}>
      <div className="panel max-w-3xl p-6 sm:p-8">
        <h1 className="text-[26px] font-semibold">How should customers earn?</h1>
        <p className="mt-1 text-muted-ink">You can add or change programmes later.</p>
        <Form action="/onboarding/2" className="mt-6 grid gap-3">
          {opts.map((o) => {
            const disabled = o.v !== 'stamps' && !pointsAllowed;
            return (
              <label key={o.v} className={cn('flex cursor-pointer gap-4 rounded-[14px] border border-beige-strong bg-paper p-4 has-[:checked]:border-espresso has-[:checked]:bg-cream', disabled && 'cursor-not-allowed opacity-50')}>
                <input type="radio" name="programme_choice" value={o.v} defaultChecked={(values.programme_choice ?? 'stamps') === o.v} disabled={disabled} className="mt-1 h-4 w-4 accent-[#3B2925]" />
                <span>
                  <span className="block text-[16px] font-semibold">
                    {o.title} {o.v === 'stamps' && <span className="badge badge-sage ml-1">Recommended</span>}
                  </span>
                  <span className="block text-[14.5px] text-muted-ink">{disabled ? 'Points are included in the Premium plan.' : o.body}</span>
                </span>
              </label>
            );
          })}
          <div className="mt-3 flex gap-3">
            <Button size="lg">Continue</Button>
            <a href="/onboarding?step=1" className="btn btn-ghost btn-lg">
              Back
            </a>
          </div>
        </Form>
      </div>
    </Shell>
  );
}

export function OnboardingStep3({ values, errors = {}, hasStamps, hasPoints, currency, maxStep }: { values: V; errors?: V; hasStamps: boolean; hasPoints: boolean; currency: string; maxStep: number }) {
  return (
    <Shell step={3} maxStep={maxStep}>
      <div className="panel max-w-3xl p-6 sm:p-8">
        <h1 className="text-[26px] font-semibold">Set your first reward</h1>
        <p className="mt-1 text-muted-ink">For example: “Collect 9 stamps and receive 1 free regular coffee.”</p>
        <Form action="/onboarding/3" className="mt-6 grid gap-5" noValidate>
          {hasStamps && (
            <fieldset className="grid gap-4 rounded-[14px] border border-beige p-4">
              <legend className="px-1 text-[14px] font-semibold">Stamp card</legend>
              <Field label="Qualifying purchase" name="eligiblePurchase" error={errors.eligiblePurchase}>
                <Input name="eligiblePurchase" maxLength={120} defaultValue={values.eligiblePurchase ?? 'Any handcrafted coffee drink'} error={errors.eligiblePurchase} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Stamps required" name="stampsRequired" error={errors.stampsRequired}>
                  <Input name="stampsRequired" type="number" min={2} max={30} defaultValue={values.stampsRequired ?? '9'} error={errors.stampsRequired} />
                </Field>
                <Field label="Reward" name="rewardName" error={errors.rewardName} className="sm:col-span-2">
                  <Input name="rewardName" maxLength={80} defaultValue={values.rewardName ?? 'Free Regular Coffee'} error={errors.rewardName} />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Reward valid for (days)" name="validityDays" optional hint="After the card is completed. Empty means no expiry." error={errors.validityDays}>
                  <Input name="validityDays" type="number" min={1} max={730} defaultValue={values.validityDays ?? '30'} error={errors.validityDays} />
                </Field>
                <Field label="Restrictions" name="rewardDescription" optional>
                  <Input name="rewardDescription" maxLength={200} defaultValue={values.rewardDescription ?? 'Any regular-size hot or iced coffee'} />
                </Field>
              </div>
              <Checkbox name="allowWithOtherPromotions" value="1" defaultChecked={values.allowWithOtherPromotions === '1'} label="Give a stamp even when the purchase used another promotion" />
            </fieldset>
          )}
          {hasPoints && (
            <fieldset className="grid gap-4 rounded-[14px] border border-beige p-4">
              <legend className="px-1 text-[14px] font-semibold">Points</legend>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label={`Points per ${currency === 'EUR' ? '€1' : '₺1'}`} name="pointsPerUnit" error={errors.pointsPerUnit}>
                  <Input name="pointsPerUnit" type="number" min={1} max={100} defaultValue={values.pointsPerUnit ?? '1'} />
                </Field>
                <Field label="First points reward" name="pointsRewardName" error={errors.pointsRewardName}>
                  <Input name="pointsRewardName" maxLength={80} defaultValue={values.pointsRewardName ?? 'Free Coffee Upgrade'} />
                </Field>
                <Field label="Costs (points)" name="pointsRewardCost" error={errors.pointsRewardCost}>
                  <Input name="pointsRewardCost" type="number" min={1} max={100000} defaultValue={values.pointsRewardCost ?? '40'} />
                </Field>
              </div>
            </fieldset>
          )}
          <fieldset className="grid gap-3 rounded-[14px] border border-beige p-4">
            <legend className="px-1 text-[14px] font-semibold">Bring a friend</legend>
            <Checkbox
              name="referral_on"
              value="1"
              defaultChecked={values.referral_on !== '0'}
              label="Reward customers who bring a friend"
              hint="Each customer gets an invite link. When their friend makes a first purchase, both of them get a reward. You can change this later under Referrals."
            />
            <input type="hidden" name="referral_seen" value="1" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={`The inviter gets (${hasStamps ? 'stamps' : 'points'})`} name="referral_referrer">
                <Input name="referral_referrer" type="number" min={1} max={1000} defaultValue={values.referral_referrer ?? (hasStamps ? '1' : '20')} />
              </Field>
              <Field label={`Their friend gets (${hasStamps ? 'stamps' : 'points'})`} name="referral_referred" optional hint="Leave empty for nothing.">
                <Input name="referral_referred" type="number" min={0} max={1000} defaultValue={values.referral_referred ?? (hasStamps ? '1' : '20')} />
              </Field>
            </div>
          </fieldset>
          <Field label="Programme terms" name="terms" optional hint="Shown on your public loyalty page.">
            <Textarea name="terms" rows={3} maxLength={2000} defaultValue={values.terms ?? 'One stamp per qualifying drink. Rewards have no cash value and cannot be exchanged.'} />
          </Field>
          <div className="flex gap-3">
            <Button size="lg">Save and continue</Button>
            <a href="/onboarding?step=2" className="btn btn-ghost btn-lg">
              Back
            </a>
          </div>
        </Form>
      </div>
    </Shell>
  );
}

export function OnboardingStep4({ svg, url, slug, maxStep, cafe, values, errors = {} }: {
  svg: string;
  url: string;
  slug: string;
  maxStep: number;
  cafe: { name: string; logoUrl: string | null; bannerUrl: string | null; primaryColour: string; secondaryColour: string };
  values: V;
  errors?: V;
}) {
  return (
    <Shell step={4} maxStep={maxStep}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="panel p-6 sm:p-8">
          <h1 className="text-[26px] font-semibold">Make it yours</h1>
          <p className="mt-1 text-muted-ink">Pick how your page and stamp card look to customers. Everything here is optional and can be changed later in Café Settings.</p>
          <Form action="/onboarding/4" multipart className="mt-6 grid gap-6" id="look-form" noValidate>
            {errors.form && <Alert tone="error">{errors.form}</Alert>}
            <LookFields values={values} errors={errors} primary={cafe.primaryColour} secondary={cafe.secondaryColour} bannerUrl={cafe.bannerUrl} showRemoveBanner />
            <div className="flex gap-3">
              <Button size="lg">Continue to review</Button>
              <a href="/onboarding?step=3" className="btn btn-ghost btn-lg">
                Back
              </a>
            </div>
          </Form>
        </div>
        <div className="grid content-start gap-4">
          <div>
            <p className="mb-2 text-[13px] font-medium text-muted-ink">Live preview</p>
            <Island
              name="BrandPreview"
              props={{ formId: 'look-form', initial: { ...cafe, layout: values.page_layout || 'classic', tagline: values.tagline ?? '' }, stampIcon: values.stamp_icon || 'bean', subtitle: 'Loyalty by Perkora', label: 'Preview of the customer card' }}
            />
          </div>
          <div className="panel p-5">
            <h2 className="text-[16px] font-semibold">Your QR code</h2>
            <div className="mx-auto mt-3 aspect-square w-40 rounded-[12px] border border-beige bg-white p-1.5 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
            <p className="mt-3 text-[13px] text-muted-ink">Customers scan it to open your page and join:</p>
            <p className="mt-1 break-all text-[13px] font-medium">{url}</p>
            <div className="mt-3 grid gap-2">
              <a href={`/c/${slug}/qr.svg?download=1`} className="btn btn-secondary btn-sm">
                <LuDownload className="h-4 w-4" aria-hidden="true" /> Download QR code
              </a>
              <a href="/dashboard/settings/qr/poster" target="_blank" className="btn btn-secondary btn-sm">
                <LuPrinter className="h-4 w-4" aria-hidden="true" /> Print-ready poster
              </a>
            </div>
            <p className="mt-2 text-[12.5px] text-muted-ink">The page says “not available yet” until you activate in the next step.</p>
          </div>
        </div>
      </div>
    </Shell>
  );
}

export function OnboardingStep5({ cafe, programmes, plan, maxStep }: { cafe: any; programmes: { name: string; type: string; summary: string }[]; plan: string; maxStep: number }) {
  return (
    <Shell step={5} maxStep={maxStep}>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="panel p-6 sm:p-8">
          <h1 className="text-[26px] font-semibold">Review and activate</h1>
          <dl className="mt-6 divide-y divide-beige">
            {[
              ['Café', `${cafe.name}${cafe.city ? `, ${cafe.city}` : ''}`, 1],
              ['Contact', [cafe.business_email, cafe.phone].filter(Boolean).join(' · '), 1],
              ['Currency and timezone', `${cafe.default_currency} · ${cafe.timezone}`, 1],
              ...programmes.map((p) => [p.name, p.summary, 3] as [string, string, number]),
              ['Plan', `${plan} — free trial, no payment taken`, 0],
            ].map(([k, v, step]) => (
              <div key={String(k)} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                <dt className="text-[14px] text-muted-ink">{k}</dt>
                <dd className="flex items-center gap-3 text-[15px]">
                  {v}
                  {step ? (
                    <a href={`/onboarding?step=${step}`} className="text-[13px] link">
                      Edit
                    </a>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
          <Form action="/onboarding/5" className="mt-6 flex gap-3">
            <Button size="lg">Activate loyalty programme</Button>
            <a href="/onboarding?step=4" className="btn btn-ghost btn-lg">
              Back
            </a>
          </Form>
        </div>
        <CardPreview cafe={cafe} />
      </div>
    </Shell>
  );
}

function CardPreview({ cafe }: { cafe: any }) {
  return (
    <div className="overflow-hidden rounded-[20px] border border-beige bg-paper">
      <div className="flex items-center gap-3 px-5 py-4" style={{ background: cafe.primary_colour, color: contrastText(cafe.primary_colour) }}>
        <CafeMark name={cafe.name} logoUrl={cafe.logo_upload_id ? `/media/${cafe.logo_upload_id}` : null} colour={cafe.secondary_colour} size={38} />
        <span className="font-display text-[17px] font-semibold">{cafe.name}</span>
      </div>
      <div className="p-5">
        <StampGrid required={Number(cafe.stamps_required ?? 9)} filled={3} size={34} color={cafe.secondary_colour} icon={cafe.settings?.stampIcon} ariaLabel="Preview of the stamp card" />
        <p className="mt-3 text-[14px] text-muted-ink">Customer card preview</p>
      </div>
    </div>
  );
}

export function OnboardingDone({ cafe, url, svg, programmes }: { cafe: any; url: string; svg: string; programmes: { name: string; summary: string }[] }) {
  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto max-w-[880px] px-4 py-12">
        <div className="text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success text-white animate-stamp-in">
            <LuCheck className="h-8 w-8" aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-[32px] font-semibold">{cafe.name} is live on Perkora</h1>
          <p className="mt-2 text-muted-ink">Customers can join now by scanning your QR code.</p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-[280px_1fr]">
          <div className="panel p-4">
            <div className="aspect-square w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
            <a href={`/c/${cafe.slug}/qr.svg?download=1`} className="btn btn-secondary btn-sm mt-3 w-full">
              <LuDownload className="h-4 w-4" aria-hidden="true" /> Download QR code
            </a>
          </div>
          <div className="panel p-6">
            <h2 className="text-[18px] font-semibold">Your programme</h2>
            <ul className="mt-2 space-y-1 text-[15px]">
              {programmes.map((p) => (
                <li key={p.name}>
                  <span className="font-medium">{p.name}:</span> {p.summary}
                </li>
              ))}
            </ul>
            <h2 className="mt-5 text-[18px] font-semibold">Enrolment link</h2>
            <Island name="CopyField" props={{ value: url, copyLabel: 'Copy', copiedLabel: 'Copied' }} />
            <h2 className="mt-5 text-[18px] font-semibold">Instructions for staff</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-[14.5px] text-muted-ink">
              <li>Open perkora on the till device and sign in, then open the Counter terminal.</li>
              <li>Scan the customer’s card or type their member code.</li>
              <li>Tap Add stamp, check the change, and confirm.</li>
              <li>When a reward is ready, tap Redeem and confirm before handing it over.</li>
            </ol>
            <p className="mt-2 text-[13.5px] text-muted-ink">Invite staff accounts under Team.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="/dashboard" className="btn btn-primary btn-lg">
                Open the dashboard
              </a>
              <a href={url} className="btn btn-secondary btn-lg" target="_blank">
                View your loyalty page
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
