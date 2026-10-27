import { intlLocale, type Locale } from './i18n';

const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();

function nf(key: string, make: () => Intl.NumberFormat): Intl.NumberFormat {
  let f = cache.get(key) as Intl.NumberFormat | undefined;
  if (!f) {
    f = make();
    cache.set(key, f);
  }
  return f;
}
function df(key: string, make: () => Intl.DateTimeFormat): Intl.DateTimeFormat {
  let f = cache.get(key) as Intl.DateTimeFormat | undefined;
  if (!f) {
    f = make();
    cache.set(key, f);
  }
  return f;
}

/** Format integer minor units (cents / kuruş) as money. Never converts currencies. */
export function money(minor: number, currency: string, locale: Locale = 'en'): string {
  return nf(`m:${locale}:${currency}`, () => new Intl.NumberFormat(intlLocale(locale), { style: 'currency', currency, minimumFractionDigits: 2 })).format(
    minor / 100,
  );
}

export function moneyWhole(minor: number, currency: string, locale: Locale = 'en'): string {
  const whole = minor % 100 === 0;
  return nf(`mw:${locale}:${currency}:${whole}`, () =>
    new Intl.NumberFormat(intlLocale(locale), { style: 'currency', currency, minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 }),
  ).format(minor / 100);
}

export function num(n: number, locale: Locale = 'en'): string {
  return nf(`n:${locale}`, () => new Intl.NumberFormat(intlLocale(locale))).format(n);
}

export function pct(ratio: number, locale: Locale = 'en', digits = 0): string {
  return nf(`p:${locale}:${digits}`, () => new Intl.NumberFormat(intlLocale(locale), { style: 'percent', maximumFractionDigits: digits })).format(ratio);
}

export function dateShort(d: Date | string, tz: string, locale: Locale = 'en'): string {
  const date = typeof d === 'string' ? new Date(d.length === 10 ? d + 'T12:00:00Z' : d) : d;
  const zone = typeof d === 'string' && d.length === 10 ? 'UTC' : tz;
  return df(`ds:${locale}:${zone}`, () => new Intl.DateTimeFormat(intlLocale(locale), { day: 'numeric', month: 'short', year: 'numeric', timeZone: zone })).format(date);
}

export function dateNoYear(d: Date | string, tz: string, locale: Locale = 'en'): string {
  const date = typeof d === 'string' ? new Date(d.length === 10 ? d + 'T12:00:00Z' : d) : d;
  const zone = typeof d === 'string' && d.length === 10 ? 'UTC' : tz;
  return df(`dn:${locale}:${zone}`, () => new Intl.DateTimeFormat(intlLocale(locale), { day: 'numeric', month: 'short', timeZone: zone })).format(date);
}

export function dateTime(d: Date | string, tz: string, locale: Locale = 'en'): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return df(`dt:${locale}:${tz}`, () =>
    new Intl.DateTimeFormat(intlLocale(locale), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: tz, hourCycle: 'h23' }),
  ).format(date);
}

export function timeOnly(d: Date | string, tz: string, locale: Locale = 'en'): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return df(`t:${locale}:${tz}`, () => new Intl.DateTimeFormat(intlLocale(locale), { hour: '2-digit', minute: '2-digit', timeZone: tz, hourCycle: 'h23' })).format(date);
}

/** "3 days ago" style relative time. */
export function relative(d: Date | string, locale: Locale = 'en', now = new Date()): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const diff = (date.getTime() - now.getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  if (abs < 86400 * 365) return rtf.format(Math.round(diff / (86400 * 30)), 'month');
  return rtf.format(Math.round(diff / (86400 * 365)), 'year');
}

/** Parse a user-typed money amount ("4,50", "4.5", "12") into minor units. */
export function parseMoneyToMinor(input: string): number | null {
  const s = input.trim().replace(/\s/g, '').replace(/[€₺]|EUR|TRY|TL/gi, '');
  if (!/^\d{1,7}([.,]\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ''] = s.split(/[.,]/);
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

/** "Deniz A." — enough for staff to confirm who they are serving. */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] ?? '';
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

export function formatMemberCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)} ${code.slice(4)}` : code;
}
