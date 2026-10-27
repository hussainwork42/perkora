import type { ReactNode } from 'react';
import { cn } from '../cn';
import { usePage } from '../page-context';
import { LuCircleAlert, LuCircleCheck, LuInfo, LuX } from 'react-icons/lu';

export function CsrfField() {
  const { csrf } = usePage();
  return <input type="hidden" name="_csrf" value={csrf} />;
}

/** A POST form with CSRF protection built in. */
export function Form({ action, children, className, multipart, id, method = 'post', ...rest }: {
  action: string;
  children: ReactNode;
  className?: string;
  multipart?: boolean;
  id?: string;
  method?: 'post' | 'get';
  [k: string]: any;
}) {
  return (
    <form action={action} method={method} encType={multipart ? 'multipart/form-data' : undefined} className={className} id={id} {...rest}>
      {method === 'post' && <CsrfField />}
      {children}
    </form>
  );
}

type BtnVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost';
export function Button({ variant = 'primary', size, className, children, ...rest }: {
  variant?: BtnVariant;
  size?: 'sm' | 'lg';
  className?: string;
  children: ReactNode;
  [k: string]: any;
}) {
  return (
    <button className={cn('btn', `btn-${variant}`, size && `btn-${size}`, className)} type={rest.type ?? 'submit'} {...rest}>
      {children}
    </button>
  );
}

export function LinkButton({ href, variant = 'primary', size, className, children, ...rest }: {
  href: string;
  variant?: BtnVariant;
  size?: 'sm' | 'lg';
  className?: string;
  children: ReactNode;
  [k: string]: any;
}) {
  return (
    <a href={href} className={cn('btn', `btn-${variant}`, size && `btn-${size}`, className)} {...rest}>
      {children}
    </a>
  );
}

export function Field({ label, name, hint, error, children, className, optional }: {
  label: ReactNode;
  name: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
  optional?: boolean;
}) {
  const { t } = usePage();
  return (
    <div className={className}>
      <label htmlFor={name} className="label">
        {label}
        {optional && <span className="font-normal text-muted"> ({t.common.optional})</span>}
      </label>
      {children}
      {error ? (
        <p className="error-text" id={`${name}-error`}>
          {error}
        </p>
      ) : hint ? (
        <p className="hint" id={`${name}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ name, error, className, ...rest }: { name: string; error?: string | null; className?: string; [k: string]: any }) {
  return (
    <input
      id={rest.id ?? name}
      name={name}
      className={cn('input', className)}
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={error ? `${name}-error` : undefined}
      {...rest}
    />
  );
}

export function Select({ name, error, className, children, ...rest }: { name: string; error?: string | null; className?: string; children: ReactNode; [k: string]: any }) {
  return (
    <select id={rest.id ?? name} name={name} className={cn('select', className)} aria-invalid={error ? 'true' : undefined} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({ name, error, className, ...rest }: { name: string; error?: string | null; className?: string; [k: string]: any }) {
  return <textarea id={rest.id ?? name} name={name} className={cn('textarea', className)} aria-invalid={error ? 'true' : undefined} {...rest} />;
}

export function Checkbox({ name, label, hint, className, ...rest }: { name: string; label: ReactNode; hint?: ReactNode; className?: string; [k: string]: any }) {
  const id = rest.id ?? `${name}-${typeof rest.value === 'string' ? rest.value : 'cb'}`;
  return (
    <label htmlFor={id} className={cn('flex gap-3 items-start cursor-pointer', className)}>
      <input type="checkbox" id={id} name={name} className="checkbox mt-[3px] shrink-0" {...rest} />
      <span>
        <span className="text-[15px] text-ink">{label}</span>
        {hint && <span className="block text-[13px] text-muted-ink mt-0.5">{hint}</span>}
      </span>
    </label>
  );
}

export function Badge({ tone = 'neutral', children, className }: { tone?: 'neutral' | 'success' | 'warning' | 'error' | 'accent' | 'sage'; children: ReactNode; className?: string }) {
  return <span className={cn('badge', `badge-${tone}`, className)}>{children}</span>;
}

export function Card({ children, className, ...rest }: { children: ReactNode; className?: string; [k: string]: any }) {
  return (
    <div className={cn('card', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
      <div className="min-w-0">
        <h2 className="text-[17px] font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-ink mt-1">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Alert({ tone = 'info', title, children, className }: { tone?: 'info' | 'success' | 'warning' | 'error'; title?: ReactNode; children?: ReactNode; className?: string }) {
  const styles = {
    info: 'bg-sand border-beige text-ink',
    success: 'bg-success-tint border-success/25 text-ink',
    warning: 'bg-warning-tint border-warning/30 text-ink',
    error: 'bg-error-tint border-error/25 text-ink',
  }[tone];
  const Icon = { info: LuInfo, success: LuCircleCheck, warning: LuCircleAlert, error: LuCircleAlert }[tone];
  const iconColor = { info: 'text-muted-ink', success: 'text-success', warning: 'text-warning-ink', error: 'text-error' }[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-[12px] border px-4 py-3 text-[14.5px]', styles, className)}>
      <Icon className={cn('mt-0.5 h-[18px] w-[18px] shrink-0', iconColor)} aria-hidden="true" />
      <div className="min-w-0">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5 text-muted-ink')}>{children}</div>}
      </div>
    </div>
  );
}

export function FlashMessage() {
  const { flash } = usePage();
  if (!flash) return null;
  return (
    <div className="mb-5">
      <Alert tone={flash.type === 'error' ? 'error' : flash.type === 'success' ? 'success' : 'info'}>{flash.message}</Alert>
    </div>
  );
}

export function EmptyState({ icon, title, body, action, className }: { icon?: ReactNode; title: ReactNode; body?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center text-center px-6 py-12', className)}>
      {icon && <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-sand text-espresso">{icon}</div>}
      <h3 className="text-[17px] font-semibold">{title}</h3>
      {body && <p className="mt-1.5 max-w-md text-[14.5px] text-muted-ink">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions, back }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <a href={back.href} className="mb-2 inline-flex items-center gap-1 text-sm text-muted-ink hover:text-ink">
            <span aria-hidden="true">‹</span> {back.label}
          </a>
        )}
        <h1 className="text-[26px] font-semibold sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[15px] text-muted-ink">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tooltip }: { label: string; value: ReactNode; hint?: ReactNode; tooltip?: string }) {
  return (
    <div className="card px-5 py-4" title={tooltip}>
      <p className="text-[13px] text-muted-ink">{label}</p>
      <p className="mt-1 font-display text-[28px] font-semibold tnum leading-tight">{value}</p>
      {hint && <p className="mt-0.5 text-[12.5px] text-muted-ink">{hint}</p>}
    </div>
  );
}

export function ProgressBar({ value, max, tone = 'terracotta', label }: { value: number; max: number; tone?: 'terracotta' | 'sage'; label: string }) {
  const pctVal = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className="h-2 w-full overflow-hidden rounded-full bg-beige">
      <div className={cn('h-full rounded-full', tone === 'sage' ? 'bg-sage' : 'bg-terracotta')} style={{ width: `${pctVal}%` }} />
    </div>
  );
}

export function Tabs({ items, current }: { items: { href: string; label: ReactNode; key: string; count?: number }[]; current: string }) {
  return (
    <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-beige" aria-label="Sections">
      {items.map((i) => (
        <a
          key={i.key}
          href={i.href}
          aria-current={i.key === current ? 'page' : undefined}
          className={cn(
            '-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-[14.5px] font-medium',
            i.key === current ? 'border-espresso text-ink' : 'border-transparent text-muted-ink hover:text-ink',
          )}
        >
          {i.label}
          {i.count !== undefined && <span className="ml-1.5 rounded-full bg-sand px-1.5 text-[12px] text-muted-ink tnum">{i.count}</span>}
        </a>
      ))}
    </nav>
  );
}

export function Pagination({ page, pageSize, total, hrefFor }: { page: number; pageSize: number; total: number; hrefFor: (p: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-muted-ink">
      <span className="tnum">
        {from}–{to} of {total}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <a className="btn btn-secondary btn-sm" href={hrefFor(page - 1)}>
            Previous
          </a>
        ) : (
          <span className="btn btn-secondary btn-sm" aria-disabled="true">
            Previous
          </span>
        )}
        {page < pages ? (
          <a className="btn btn-secondary btn-sm" href={hrefFor(page + 1)}>
            Next
          </a>
        ) : (
          <span className="btn btn-secondary btn-sm" aria-disabled="true">
            Next
          </span>
        )}
      </div>
    </div>
  );
}

export function DemoBanner({ dark }: { dark?: boolean }) {
  const { t } = usePage();
  return (
    <div className={cn('px-4 py-2 text-center text-[13px]', dark ? 'bg-coffee text-cream/85' : 'bg-warning-tint text-warning-ink')} role="note">
      {t.common.demoBanner}
    </div>
  );
}

export function LanguageSwitcher({ className, tone = 'light' }: { className?: string; tone?: 'light' | 'dark' }) {
  const { locale, t, path, query } = usePage();
  const next = path + (Object.keys(query).length ? '?' + new URLSearchParams(query).toString() : '');
  return (
    <Form action="/locale" className={cn('inline-flex items-center', className)}>
      <input type="hidden" name="next" value={next} />
      <span className="sr-only">{t.common.language}</span>
      <div className={cn('inline-flex rounded-full border p-0.5 text-[13px]', tone === 'dark' ? 'border-cream/20' : 'border-beige-strong')}>
        {(['en', 'tr'] as const).map((l) => (
          <button
            key={l}
            name="locale"
            value={l}
            type="submit"
            aria-pressed={locale === l}
            className={cn(
              'rounded-full px-2.5 py-1 font-medium',
              locale === l ? (tone === 'dark' ? 'bg-cream text-coffee' : 'bg-espresso text-cream') : tone === 'dark' ? 'text-cream/75' : 'text-muted-ink hover:text-ink',
            )}
          >
            {l === 'en' ? 'EN' : 'TR'}
          </button>
        ))}
      </div>
    </Form>
  );
}

export function CloseIcon() {
  return <LuX aria-hidden="true" />;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-beige-strong bg-sand px-1.5 py-0.5 font-sans text-[12px]">{children}</kbd>;
}

export function TermsNote() {
  const { t } = usePage();
  return (
    <p className="text-[12.5px] text-muted-ink">
      {t.auth.terms.split(/(\{terms\}|\{privacy\})/).map((part, i) =>
        part === '{terms}' ? (
          <a key={i} className="link" href="/terms" target="_blank">
            {t.nav.terms}
          </a>
        ) : part === '{privacy}' ? (
          <a key={i} className="link" href="/privacy" target="_blank">
            {t.nav.privacy}
          </a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  );
}
