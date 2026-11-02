import { useEffect, useState } from 'react';
import { LuShare, LuSmartphone, LuX } from 'react-icons/lu';

const KEY = 'pk_install_dismissed';

/**
 * Suggests adding Perkora to the phone's home screen, so the card opens like an app.
 * Uses the browser's install prompt where there is one (Android); on iPhone it explains
 * the Share → Add to Home Screen step. Hidden once installed or dismissed.
 */
export default function InstallPrompt({ title, body, iosHint, install, close, bottom = 84 }: {
  title: string;
  body: string;
  iosHint: string;
  install: string;
  close: string;
  bottom?: number;
}) {
  const [mode, setMode] = useState<'none' | 'prompt' | 'ios'>('none');
  const [evt, setEvt] = useState<any>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY)) return;
    } catch {
      /* storage unavailable: still fine to show */
    }
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone;
    if (standalone || window.innerWidth > 820) return;
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    const t = window.setTimeout(() => ios && setMode('ios'), 1800);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e);
      setMode('prompt');
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('beforeinstallprompt', onPrompt);
    };
  }, []);

  const dismiss = () => {
    setMode('none');
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* ignore */
    }
  };
  if (mode === 'none') return null;
  return (
    <div className="fixed inset-x-3 z-30 mx-auto max-w-[496px] animate-sheet-up rounded-[18px] border border-beige bg-paper/95 p-3.5 backdrop-blur" style={{ bottom: `calc(${bottom}px + env(safe-area-inset-bottom))`, boxShadow: 'var(--shadow-float)' }} role="dialog" aria-label={title}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-espresso text-cream">
          <LuSmartphone className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-semibold">{title}</p>
          <p className="text-[13px] text-muted-ink">
            {mode === 'ios' ? (
              <>
                {iosHint.split('{share}')[0]}
                <LuShare className="mx-0.5 inline h-3.5 w-3.5 align-[-2px]" aria-label="Share" />
                {iosHint.split('{share}')[1] ?? ''}
              </>
            ) : (
              body
            )}
          </p>
          {mode === 'prompt' && (
            <button
              type="button"
              className="btn btn-primary btn-sm mt-2.5"
              onClick={async () => {
                try {
                  await evt?.prompt();
                } finally {
                  dismiss();
                }
              }}
            >
              {install}
            </button>
          )}
        </div>
        <button type="button" onClick={dismiss} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-ink hover:bg-sand" aria-label={close}>
          <LuX className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
