import { useEffect, useState } from 'react';
import { StampGrid } from '../components/brand';
import { CafeBar, type CafeLook } from '../components/cafe-look';

/**
 * Live preview of a customer's card page while the owner edits branding.
 * Reads the surrounding form (colours, layout, stamp icon, tagline) and picked images.
 */
export default function BrandPreview({ formId, initial, stampIcon, subtitle, label }: { formId: string; initial: CafeLook; stampIcon: string; subtitle: string; label: string }) {
  const [look, setLook] = useState<CafeLook>(initial);
  const [icon, setIcon] = useState(stampIcon);

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    const read = () => {
      const fd = new FormData(form);
      const v = (k: string) => (typeof fd.get(k) === 'string' ? (fd.get(k) as string) : '');
      setLook((l) => ({
        ...l,
        name: v('name') || l.name,
        primaryColour: v('primary_colour') || l.primaryColour,
        secondaryColour: v('secondary_colour') || l.secondaryColour,
        layout: (['classic', 'banner', 'minimal'].includes(v('page_layout')) ? v('page_layout') : l.layout) as CafeLook['layout'],
        tagline: fd.has('tagline') ? v('tagline') : l.tagline,
        logoUrl: v('remove_logo') === '1' ? null : l.logoUrl,
        bannerUrl: v('remove_banner') === '1' ? null : l.bannerUrl,
      }));
      if (v('stamp_icon')) setIcon(v('stamp_icon'));
    };
    const onImage = (e: Event) => {
      const d = (e as CustomEvent<{ field: string; url: string }>).detail;
      if (d.field === 'logo') setLook((l) => ({ ...l, logoUrl: d.url }));
      if (d.field === 'banner') setLook((l) => ({ ...l, bannerUrl: d.url, layout: l.layout }));
    };
    form.addEventListener('input', read);
    form.addEventListener('change', read);
    document.addEventListener('brand-image', onImage);
    return () => {
      form.removeEventListener('input', read);
      form.removeEventListener('change', read);
      document.removeEventListener('brand-image', onImage);
    };
  }, [formId]);

  return (
    <div className="overflow-hidden rounded-[18px] border border-beige bg-cream" aria-label={label}>
      <CafeBar look={look} href="#" subtitle={subtitle} />
      <div className="p-4">
        <div className="card p-4">
          <StampGrid required={9} filled={6} size={34} color={look.secondaryColour} icon={icon} ariaLabel={label} />
        </div>
      </div>
    </div>
  );
}
