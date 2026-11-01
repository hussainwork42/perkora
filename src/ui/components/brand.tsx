import type { ReactNode } from 'react';
import { cn, contrastText } from '../cn';
import { LuCake, LuCoffee, LuCroissant, LuCupSoda, LuGift, LuHeart, LuPercent, LuSparkles, LuStar } from 'react-icons/lu';

export function LogoMark({ className, tone = 'dark' }: { className?: string; tone?: 'dark' | 'light' }) {
  const fg = tone === 'dark' ? '#3B2925' : '#FAF6EF';
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="13" fill="none" stroke={fg} strokeWidth="3" />
      <circle cx="16" cy="16" r="6.2" fill="#B86F52" />
      <path d="M16 3 v5" stroke={tone === 'dark' ? '#FAF6EF' : '#3B2925'} strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className, tone = 'dark', href = '/' }: { className?: string; tone?: 'dark' | 'light'; href?: string | null }) {
  const inner = (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark className="h-7 w-7" tone={tone} />
      <span className={cn('font-display text-[21px] font-semibold tracking-[-0.03em]', tone === 'dark' ? 'text-espresso' : 'text-cream')}>perkora</span>
    </span>
  );
  return href ? (
    <a href={href} aria-label="Perkora home" className="inline-flex">
      {inner}
    </a>
  ) : (
    inner
  );
}

/** Deterministic, slightly irregular rotation so stamps look hand-pressed. */
function stampRotation(i: number) {
  return ((i * 47) % 25) - 12;
}

/** Five-pointed star centred at 24,24. */
const STAR = Array.from({ length: 10 }, (_, i) => {
  const r = i % 2 === 0 ? 10 : 4.4;
  const a = (Math.PI / 5) * i - Math.PI / 2;
  return `${(24 + r * Math.cos(a)).toFixed(2)},${(24 + r * Math.sin(a)).toFixed(2)}`;
}).join(' ');

function StampGlyph({ icon, color }: { icon: string; color: string }) {
  const ink = contrastText(color) === '#292421' ? '#2A1D1A' : '#FFFDF9';
  switch (icon) {
    case 'cup':
      return (
        <g fill={ink} fillOpacity="0.94">
          <path d="M15.5 19.5h14.5v6.2a7.25 7.25 0 0 1-14.5 0z" />
          <path d="M30 21.2h1.6a3.3 3.3 0 0 1 0 6.6H30v-2.2h1.4a1.1 1.1 0 0 0 0-2.2H30z" />
          <rect x="14" y="33.4" width="17.5" height="2" rx="1" />
          <path d="M19.5 17.5c-1.4-1.6 1.4-2.6 0-4.4M23.5 17.5c-1.4-1.6 1.4-2.6 0-4.4" stroke={ink} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </g>
      );
    case 'star':
      return <polygon points={STAR} fill={ink} fillOpacity="0.94" />;
    case 'heart':
      return <path d="M24 33.5s-9.5-5.6-9.5-12a5.2 5.2 0 0 1 9.5-2.9 5.2 5.2 0 0 1 9.5 2.9c0 6.4-9.5 12-9.5 12z" fill={ink} fillOpacity="0.94" />;
    case 'leaf':
      return (
        <g>
          <path d="M15 32c0-10 6.5-16.5 18-17-0.4 11.6-7 18-17 18z" fill={ink} fillOpacity="0.94" />
          <path d="M16.5 31.5c4-5 8-8.5 12.5-11" stroke={color} strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </g>
      );
    case 'check':
      return <path d="M16 24.5l5.2 5.2L32.5 18.4" stroke={ink} strokeOpacity="0.95" strokeWidth="3.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />;
    default:
      return (
        <g>
          <ellipse cx="24" cy="24" rx="6.6" ry="9.2" fill={ink} fillOpacity="0.92" transform="rotate(28 24 24)" />
          <path d="M21.4 16.9 C 26 20.5, 22 27.5, 26.6 31.1" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" transform="rotate(28 24 24)" />
        </g>
      );
  }
}

export function StampMark({ index, color = '#B86F52', animate, size = 44, icon = 'bean' }: { index: number; color?: string; animate?: boolean; size?: number; icon?: string }) {
  const rot = stampRotation(index);
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={cn('block', animate && 'animate-stamp-in')}
      style={{ ['--stamp-rot' as any]: `${rot}deg`, transform: `rotate(${rot}deg)` }}
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="21" fill={color} opacity={0.94 - (index % 3) * 0.04} />
      <circle cx="24" cy="24" r="16.5" fill="none" stroke={contrastText(color) === '#292421' ? '#2A1D1A' : '#FFFDF9'} strokeOpacity="0.5" strokeWidth="1.4" strokeDasharray="2.2 2.6" />
      <StampGlyph icon={icon} color={color} />
    </svg>
  );
}

export function EmptySlot({ size = 44, label }: { size?: number; label?: string }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className="block" aria-hidden={label ? undefined : 'true'}>
      <circle cx="24" cy="24" r="20.5" fill="none" stroke="currentColor" strokeOpacity="0.28" strokeWidth="1.6" strokeDasharray="3 3.4" />
      {label && (
        <text x="24" y="28.5" textAnchor="middle" fontSize="13" fontWeight="600" fill="currentColor" fillOpacity="0.38" fontFamily="Inter, sans-serif">
          {label}
        </text>
      )}
    </svg>
  );
}

/**
 * The stamp grid: N stamp slots followed by the reward slot.
 * `fresh` marks the most recent stamps for the press-in animation.
 */
export function StampGrid({ required, filled, color, icon, fresh = 0, size = 44, className, ariaLabel }: {
  required: number;
  filled: number;
  color?: string;
  icon?: string;
  fresh?: number;
  size?: number;
  className?: string;
  ariaLabel: string;
}) {
  const slots = required + 1;
  const cols = slots <= 10 ? 5 : slots <= 12 ? 6 : 7;
  return (
    <div role="img" aria-label={ariaLabel} className={cn('grid justify-items-center gap-x-2 gap-y-2.5', className)} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {Array.from({ length: required }, (_, i) =>
        i < filled ? (
          <StampMark key={i} index={i} color={color} icon={icon} animate={i >= filled - fresh} size={size} />
        ) : (
          <span key={i} className="text-espresso">
            <EmptySlot size={size} label={String(i + 1)} />
          </span>
        ),
      )}
      <span
        className={cn('flex items-center justify-center rounded-full border-[1.6px] border-dashed', filled >= required ? 'border-terracotta bg-terracotta-tint' : 'border-terracotta/50')}
        style={{ width: size, height: size }}
      >
        <LuGift className="h-[45%] w-[45%] text-terracotta-ink" aria-hidden="true" />
      </span>
    </div>
  );
}

const ICONS: Record<string, (p: { className?: string }) => ReactNode> = {
  coffee: LuCoffee,
  cup: LuCupSoda,
  croissant: LuCroissant,
  cake: LuCake,
  gift: LuGift,
  percent: LuPercent,
  sparkles: LuSparkles,
  star: LuStar,
  heart: LuHeart,
};

export function RewardIcon({ icon, className }: { icon: string; className?: string }) {
  const I = ICONS[icon] ?? LuGift;
  return <I className={className} aria-hidden="true" />;
}

export function RewardBadgeIcon({ icon, size = 'md', tone = 'accent' }: { icon: string; size?: 'sm' | 'md' | 'lg'; tone?: 'accent' | 'muted' }) {
  const dims = size === 'sm' ? 'h-9 w-9' : size === 'lg' ? 'h-14 w-14' : 'h-11 w-11';
  const ic = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-6 w-6' : 'h-5 w-5';
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full', dims, tone === 'accent' ? 'bg-terracotta-tint text-terracotta-ink' : 'bg-sand text-muted-ink')}>
      <RewardIcon icon={icon} className={ic} />
    </span>
  );
}

/** Café brand mark: uploaded logo or a monogram in the café's colour. */
export function CafeMark({ name, logoUrl, colour, size = 44, className }: { name: string; logoUrl?: string | null; colour: string; size?: number; className?: string }) {
  if (logoUrl) {
    return <img src={logoUrl} alt="" width={size} height={size} className={cn('shrink-0 rounded-[12px] object-cover bg-paper', className)} style={{ width: size, height: size }} />;
  }
  const letters = name
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .split(/\s+/)
    .filter((w) => w && !/^(the|cafe|café|kafe)$/i.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || name.slice(0, 1).toUpperCase();
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center rounded-[12px] font-display font-semibold', className)}
      style={{ width: size, height: size, background: colour, color: contrastText(colour), fontSize: size * 0.38, letterSpacing: '-0.02em' }}
      aria-hidden="true"
    >
      {letters}
    </span>
  );
}
