import type { ReactNode } from 'react';
import { CafeMark } from './brand';
import { cn, contrastText } from '../cn';

/** What a café chose for the look of its customer pages. */
export interface CafeLook {
  name: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  primaryColour: string;
  secondaryColour: string;
  layout: 'classic' | 'banner' | 'minimal';
  tagline: string;
}

/** A brand colour if it reads well on a light background, otherwise the default text colour. */
const readableOnLight = (hex: string) => (contrastText(hex) === '#FAF6EF' ? hex : undefined);

/** True when text on this header should be dark. */
export function lightHeader(look: CafeLook): boolean {
  return look.layout === 'minimal' || (look.layout === 'classic' && contrastText(look.primaryColour) === '#292421');
}

const cover = (look: CafeLook) =>
  look.bannerUrl
    ? { backgroundImage: `url(${look.bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: `linear-gradient(135deg, ${look.primaryColour}, ${look.secondaryColour})` };

/** Big header on the café's public join page. */
export function CafeHero({ look, title, topBar, children }: { look: CafeLook; title: ReactNode; topBar?: ReactNode; children?: ReactNode }) {
  const fg = contrastText(look.primaryColour);
  if (look.layout === 'banner') {
    return (
      <header className="bg-paper">
        <div className="relative h-44 sm:h-52" style={cover(look)}>
          <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/10" aria-hidden="true" />
          <div className="relative mx-auto flex max-w-[560px] items-center justify-between px-4 pt-4 text-white">{topBar}</div>
        </div>
        <div className="mx-auto max-w-[560px] px-4 pb-9">
          <div className="relative z-10 -mt-10 w-fit">
            <CafeMark name={look.name} logoUrl={look.logoUrl} colour={look.secondaryColour} size={76} className="ring-4 ring-paper" />
          </div>
          <h1 className="mt-3 text-[28px] font-semibold leading-tight">{title}</h1>
          {look.tagline && <p className="mt-1.5 text-[16px] font-medium" style={{ color: readableOnLight(look.primaryColour) }}>{look.tagline}</p>}
          <div className="text-muted-ink">{children}</div>
        </div>
      </header>
    );
  }
  if (look.layout === 'minimal') {
    return (
      <header className="border-b border-beige bg-paper" style={{ borderTop: `6px solid ${look.primaryColour}` }}>
        <div className="mx-auto flex max-w-[560px] items-center justify-between px-4 pt-3 text-muted-ink">{topBar}</div>
        <div className="mx-auto max-w-[560px] px-4 pb-10 pt-6 text-center">
          <CafeMark name={look.name} logoUrl={look.logoUrl} colour={look.primaryColour} size={72} className="mx-auto" />
          <h1 className="mt-4 text-[28px] font-semibold leading-tight">{title}</h1>
          {look.tagline && <p className="mt-1.5 text-[16px] font-medium" style={{ color: readableOnLight(look.secondaryColour) }}>{look.tagline}</p>}
          <div className="mx-auto flex max-w-[46ch] flex-col items-center text-muted-ink">{children}</div>
        </div>
      </header>
    );
  }
  return (
    <header style={{ background: look.primaryColour, color: fg }}>
      <div className="mx-auto flex max-w-[560px] items-center justify-between px-4 pt-4">{topBar}</div>
      <div className="mx-auto max-w-[560px] px-4 pb-10 pt-6">
        <CafeMark name={look.name} logoUrl={look.logoUrl} colour={look.secondaryColour} size={64} className="ring-2 ring-white/25" />
        <h1 className="mt-4 text-[30px] font-semibold leading-tight" style={{ color: fg }}>
          {title}
        </h1>
        {look.tagline && <p className="mt-1.5 text-[16px] font-medium opacity-90">{look.tagline}</p>}
        <div className="opacity-80">{children}</div>
      </div>
    </header>
  );
}

/** Compact header on the customer's card pages. */
export function CafeBar({ look, href, subtitle, right }: { look: CafeLook; href: string; subtitle: string; right?: ReactNode }) {
  const name = (light: boolean) => (
    <a href={href} className="flex min-w-0 flex-1 items-center gap-3">
      <CafeMark name={look.name} logoUrl={look.logoUrl} colour={look.layout === 'classic' ? look.primaryColour : look.secondaryColour} size={40} className={light ? 'ring-1 ring-black/5' : 'ring-1 ring-white/25'} />
      <span className="min-w-0">
        <span className="block truncate font-display text-[18px] font-semibold leading-tight">{look.name}</span>
        <span className={cn('block truncate text-[12.5px]', light ? 'text-muted-ink' : 'opacity-80')}>{look.tagline || subtitle}</span>
      </span>
    </a>
  );
  if (look.layout === 'banner') {
    return (
      <header className="relative text-white" style={cover(look)}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-black/10" aria-hidden="true" />
        <div className="relative mx-auto flex max-w-[520px] items-end gap-3 px-4 pb-4 pt-12">
          {name(false)}
          {right}
        </div>
      </header>
    );
  }
  if (look.layout === 'minimal') {
    return (
      <header className="border-b border-beige bg-paper text-ink" style={{ borderTop: `4px solid ${look.primaryColour}` }}>
        <div className="mx-auto flex max-w-[520px] items-center gap-3 px-4 py-3.5">
          {name(true)}
          {right}
        </div>
      </header>
    );
  }
  return (
    <header className="relative" style={{ background: look.primaryColour, color: contrastText(look.primaryColour) }}>
      <div className="mx-auto flex max-w-[520px] items-center gap-3 px-4 py-4">
        {name(false)}
        {right}
      </div>
    </header>
  );
}
