import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { LuChevronRight, LuMenu, LuX } from 'react-icons/lu';

interface L {
  href: string;
  label: string;
}

/**
 * Full-screen menu for phones. Rendered into <body> through a portal: the sticky header
 * uses backdrop-filter, which would otherwise trap a fixed-position overlay inside it.
 */
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
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const sheet = (
    <div id="mobile-menu" role="dialog" aria-modal="true" aria-label={menuLabel} className="fixed inset-0 z-[60] flex flex-col bg-cream animate-fade-in">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-beige/80 px-4">
        <span className="font-display text-[17px] font-semibold text-ink">{menuLabel}</span>
        <button type="button" className="flex h-11 w-11 items-center justify-center rounded-full bg-sand text-ink" onClick={() => setOpen(false)} autoFocus>
          <LuX className="h-5 w-5" aria-hidden="true" />
          <span className="sr-only">{closeLabel}</span>
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-4 pt-2" aria-label={menuLabel}>
        <ul>
          {[...links, { ...signIn, key: 'signin' }].map((l) => (
            <li key={l.key}>
              <a href={l.href} onClick={() => setOpen(false)} className="flex items-center justify-between border-b border-beige/80 py-[18px] text-[19px] font-medium text-ink">
                {l.label}
                <LuChevronRight className="h-5 w-5 text-muted" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="grid shrink-0 gap-2.5 border-t border-beige/80 bg-paper px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-4">
        <a href={start.href} className="btn btn-primary btn-lg w-full">
          {start.label}
        </a>
        <a href={demo.href} className="btn btn-secondary btn-lg w-full">
          {demo.label}
        </a>
      </div>
    </div>
  );

  return (
    <>
      <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-sand" aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen(true)}>
        <LuMenu className="h-[22px] w-[22px]" aria-hidden="true" />
        <span className="sr-only">{menuLabel}</span>
      </button>
      {open && typeof document !== 'undefined' ? createPortal(sheet, document.body) : null}
    </>
  );
}
