/**
 * Timezone-aware calendar helpers. Dates are 'YYYY-MM-DD' strings in a café's
 * local timezone; instants are JS Dates (UTC).
 */
const fmtCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hourCycle: 'h23',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export interface LocalParts {
  date: string;
  hour: number;
  minute: number;
  /** ISO weekday: 1 = Monday … 7 = Sunday */
  weekday: number;
}

export function localParts(d: Date, tz: string): LocalParts {
  const parts: Record<string, string> = {};
  for (const p of partsFormatter(tz).formatToParts(d)) parts[p.type] = p.value;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    weekday: WEEKDAYS.indexOf(parts.weekday) + 1,
  };
}

export function localDate(d: Date, tz: string): string {
  return localParts(d, tz).date;
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function toUtc(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(dateStr: string, n: number): string {
  const d = toUtc(dateStr);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUtc(d);
}

export function diffDays(a: string, b: string): number {
  return Math.round((toUtc(a).getTime() - toUtc(b).getTime()) / 86400000);
}

/** ISO weekday of a calendar date (1 = Monday). */
export function weekdayOf(dateStr: string): number {
  const wd = toUtc(dateStr).getUTCDay();
  return wd === 0 ? 7 : wd;
}

export function weekRange(dateStr: string): [string, string] {
  const start = addDays(dateStr, 1 - weekdayOf(dateStr));
  return [start, addDays(start, 6)];
}

export function monthRange(dateStr: string): [string, string] {
  const [y, m] = dateStr.split('-').map(Number);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const end = fromUtc(new Date(Date.UTC(y, m, 0)));
  return [start, end];
}

/** ISO-8601 week key, e.g. 2026-W44 */
export function isoWeekKey(dateStr: string): string {
  const d = toUtc(dateStr);
  const wd = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - wd); // Thursday of this week
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function maxDate(a: string, b: string) {
  return a > b ? a : b;
}
export function minDate(a: string, b: string) {
  return a < b ? a : b;
}

export function isDateStr(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(toUtc(s).getTime());
}
