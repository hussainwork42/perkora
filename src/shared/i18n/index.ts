import { en } from './en';
import { tr } from './tr';

export type Locale = 'en' | 'tr';
export const LOCALES: Locale[] = ['en', 'tr'];

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
export type Messages = Widen<typeof en>;

const dictionaries: Record<Locale, Messages> = { en, tr };

export function getMessages(locale: Locale): Messages {
  return dictionaries[locale] ?? en;
}

export function isLocale(v: unknown): v is Locale {
  return v === 'en' || v === 'tr';
}

/** Replace {name} placeholders. */
export function fmt(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/** Pick singular/plural form: "one|other". */
export function plural(template: string, n: number, vars: Record<string, string | number> = {}): string {
  const [one, other] = template.split('|');
  return fmt(n === 1 ? one : (other ?? one), { n, ...vars });
}

export function intlLocale(locale: Locale): string {
  return locale === 'tr' ? 'tr-TR' : 'en-GB';
}

export function detectLocale(acceptLanguage: string | undefined): Locale {
  if (!acceptLanguage) return 'en';
  const first = acceptLanguage.split(',')[0]?.trim().toLowerCase() ?? '';
  return first.startsWith('tr') ? 'tr' : 'en';
}
