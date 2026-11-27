import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Readable text colour (cream or ink) for a given background hex. */
export function contrastText(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#FAF6EF';
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.42 ? '#292421' : '#FAF6EF';
}

/** Mix a hex colour with another (ratio 0–1 of `other`). */
export function mix(hex: string, other: string, ratio: number): string {
  const p = (h: string) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(h);
    const n = m ? parseInt(m[1], 16) : 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const a = p(hex);
  const b = p(other);
  return '#' + a.map((c, i) => Math.round(c + (b[i] - c) * ratio).toString(16).padStart(2, '0')).join('');
}

/** Hex colour to rgba() with the given alpha. */
export function alpha(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  const n = m ? parseInt(m[1], 16) : 0;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function rgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  const n = m ? parseInt(m[1], 16) : 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** WCAG relative luminance of a hex colour. */
export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colours. */
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Darken a colour step by step until it reaches the contrast ratio against `bg`. */
export function readableOn(hex: string, bg: string, ratio = 4.5): string {
  let c = hex;
  for (let i = 0; i < 24 && contrast(c, bg) < ratio; i++) c = mix(c, '#000000', 0.08);
  return c;
}

/**
 * The café's own colours for the owner's area: buttons and the active menu item in their main
 * colour (darkened when needed so white text stays readable), a light tint of it as the page
 * background, and their stamp colour as the accent.
 */
export function cafeTheme(primary: string, secondary: string): Record<string, string> {
  const ok = (h: string) => /^#[0-9a-f]{6}$/i.test(h);
  const p = ok(primary) ? primary : '#3B2925';
  const s = ok(secondary) ? secondary : '#B86F52';
  const ink = readableOn(p, '#FFFFFF', 4.6);
  const accent = readableOn(s, '#FFFFFF', 4.6);
  const tint = mix(s, '#FFFFFF', 0.84);
  return {
    '--color-espresso': ink,
    '--color-espresso-soft': mix(ink, '#FFFFFF', 0.16),
    '--color-coffee': mix(ink, '#000000', 0.25),
    '--color-cream': mix(p, '#FBF8F4', 0.93),
    '--color-sand': mix(p, '#F4EEE6', 0.88),
    '--color-beige': mix(p, '#E9DED0', 0.84),
    '--color-beige-strong': mix(p, '#D9C9B6', 0.8),
    '--color-terracotta': accent,
    '--color-terracotta-ink': readableOn(accent, tint, 4.6),
    '--color-terracotta-tint': tint,
    '--cafe-primary': p,
    '--cafe-secondary': s,
  };
}
