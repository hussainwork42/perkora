import { useEffect, useState } from 'react';
import { LuMenu, LuX } from 'react-icons/lu';

interface L {
  href: string;
  label: string;
}

export default function MobileNav({ links, signIn, demo, start, menuLabel, closeLabel }: {
  links: (L & { key: string })[];
  signIn: L;
  demo: L;
  start: L;
  menuLabel: string;
  closeLabel: string;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);
  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm" aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen(true)}>
        <LuMenu className="h-5 w-5" aria-hidden="true" />
        <span className="sr-only">{menuLabel}</span>
      </button>
      {open && (
        <div id="mobile-menu" role="dialog" aria-modal="true" aria-label={menuLabel} className="fixed inset-0 z-50 bg-cream animate-fade-in">
          <div className="flex h-16 items-center justify-end px-4">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} autoFocus>
              <LuX className="h-5 w-5" aria-hidden="true" />
              <span className="sr-only">{closeLabel}</span>
            </button>
          </div>
          <nav className="flex flex-col px-6" aria-label={menuLabel}>
            {links.map((l) => (
              <a key={l.key} href={l.href} onClick={() => setOpen(false)} className="border-b border-beige py-4 font-display text-[22px] font-semibold text-ink">
                {l.label}
              </a>
            ))}
            <a href={signIn.href} className="border-b border-beige py-4 font-display text-[22px] font-semibold text-ink">
              {signIn.label}
            </a>
            <div className="mt-8 grid gap-3">
              <a href={start.href} className="btn btn-primary btn-lg">
                {start.label}
              </a>
              <a href={demo.href} className="btn btn-secondary btn-lg">
                {demo.label}
              </a>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
