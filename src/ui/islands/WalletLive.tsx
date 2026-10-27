import { useEffect, useState } from 'react';

/**
 * Polls the member's card state while the page is visible. When the server
 * confirms a change (e.g. staff added a stamp), the page reloads to show it.
 */
export default function WalletLive({ url, hash, message }: { url: string; hash: string; message: string }) {
  const [changed, setChanged] = useState(false);
  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;
    const tick = async () => {
      if (stopped) return;
      if (document.visibilityState === 'visible') {
        try {
          const r = await fetch(url, { headers: { accept: 'application/json' }, cache: 'no-store' });
          if (r.ok) {
            const data = await r.json();
            if (data.hash && data.hash !== hash) {
              setChanged(true);
              setTimeout(() => window.location.reload(), 900);
              return;
            }
          }
        } catch {
          /* offline: try again later */
        }
      }
      timer = window.setTimeout(tick, 5000);
    };
    timer = window.setTimeout(tick, 5000);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [url, hash]);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-3 z-40 flex justify-center px-4">
      {changed && <div className="animate-sheet-up rounded-full bg-espresso px-4 py-2 text-[14px] font-medium text-cream shadow-lg">{message}</div>}
    </div>
  );
}
