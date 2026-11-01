import { StampMark } from './brand';
import { Checkbox, Field, Input } from './ui';
import { Island } from '../islands/Island';
import { cn } from '../cn';

const LAYOUTS: { key: 'classic' | 'banner' | 'minimal'; title: string; body: string }[] = [
  { key: 'classic', title: 'Classic', body: 'Your colour across the top' },
  { key: 'banner', title: 'Photo banner', body: 'A photo of your café on top' },
  { key: 'minimal', title: 'Light', body: 'Clean and light, colour as an accent' },
];
const ICONS: { key: string; label: string }[] = [
  { key: 'bean', label: 'Coffee bean' },
  { key: 'cup', label: 'Cup' },
  { key: 'star', label: 'Star' },
  { key: 'heart', label: 'Heart' },
  { key: 'leaf', label: 'Leaf' },
  { key: 'check', label: 'Tick' },
];

function LayoutThumb({ k, primary, secondary }: { k: string; primary: string; secondary: string }) {
  if (k === 'banner')
    return (
      <span className="block h-14 overflow-hidden rounded-[8px] border border-beige bg-paper">
        <span className="block h-7" style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }} />
        <span className="-mt-2.5 ml-2 block h-5 w-5 rounded-[5px] border-2 border-paper" style={{ background: secondary }} />
      </span>
    );
  if (k === 'minimal')
    return (
      <span className="flex h-14 flex-col items-center justify-center gap-1 rounded-[8px] border border-beige bg-paper" style={{ borderTop: `4px solid ${primary}` }}>
        <span className="block h-4 w-4 rounded-[4px]" style={{ background: primary }} />
        <span className="block h-1.5 w-10 rounded bg-beige-strong" />
      </span>
    );
  return (
    <span className="flex h-14 items-center gap-1.5 rounded-[8px] px-2" style={{ background: primary }}>
      <span className="block h-5 w-5 rounded-[5px] ring-1 ring-white/30" style={{ background: secondary }} />
      <span className="block h-1.5 w-12 rounded bg-white/60" />
    </span>
  );
}

/** Layout, stamp icon, banner and welcome message: the parts of a café's look beyond logo and colours. */
export function LookFields({ values, errors = {}, primary, secondary, bannerUrl, showRemoveBanner }: {
  values: Record<string, string>;
  errors?: Record<string, string>;
  primary: string;
  secondary: string;
  bannerUrl: string | null;
  showRemoveBanner?: boolean;
}) {
  const layout = values.page_layout || 'classic';
  const icon = values.stamp_icon || 'bean';
  return (
    <>
      <fieldset>
        <legend className="label">Page layout</legend>
        <div className="grid gap-2.5 sm:grid-cols-3">
          {LAYOUTS.map((l) => (
            <label key={l.key} className="cursor-pointer">
              <input type="radio" name="page_layout" value={l.key} defaultChecked={layout === l.key} className="peer sr-only" />
              <span className="block rounded-[14px] border-2 border-beige p-2.5 peer-checked:border-espresso peer-focus-visible:ring-2 peer-focus-visible:ring-terracotta">
                <LayoutThumb k={l.key} primary={primary} secondary={secondary} />
                <span className="mt-2 block text-[14px] font-semibold">{l.title}</span>
                <span className="block text-[12.5px] text-muted-ink">{l.body}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Banner photo" name="banner" optional hint="Used by the Photo banner layout. A wide photo of your café, counter or coffee works best." error={errors.banner}>
        <Island name="ImagePicker" props={{ name: 'banner', label: 'Banner photo', current: bannerUrl, maxSide: 1600, shape: 'wide', hint: 'JPEG, PNG or WebP. Large photos are resized automatically.' }} />
      </Field>
      {showRemoveBanner && bannerUrl && <Checkbox name="remove_banner" value="1" label="Remove the current banner" />}
      <fieldset>
        <legend className="label">Stamp design</legend>
        <div className="flex flex-wrap gap-2">
          {ICONS.map((i) => (
            <label key={i.key} className="cursor-pointer" title={i.label}>
              <input type="radio" name="stamp_icon" value={i.key} defaultChecked={icon === i.key} className="peer sr-only" />
              <span className={cn('flex flex-col items-center gap-1 rounded-[12px] border-2 border-beige px-2.5 py-2 peer-checked:border-espresso peer-focus-visible:ring-2 peer-focus-visible:ring-terracotta')}>
                <StampMark index={0} color={secondary} icon={i.key} size={34} />
                <span className="text-[12px] text-muted-ink">{i.label}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Welcome message" name="tagline" optional hint="A short line under your name, e.g. “Fresh coffee by the harbour since 2019”." error={errors.tagline}>
        <Input name="tagline" maxLength={140} defaultValue={values.tagline} error={errors.tagline} />
      </Field>
    </>
  );
}
