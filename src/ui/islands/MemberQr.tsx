import { useEffect, useRef, useState } from 'react';

/** Rotating, signed member QR code. Fetches a fresh code before the old one expires. */
export default function MemberQr({ url, refreshing, error }: { url: string; refreshing: string; error: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const expiry = useRef<number>(0);

  useEffect(() => {
    let stopped = false;
    let refreshTimer: number | undefined;
    const load = async () => {
      try {
        const r = await fetch(url, { headers: { accept: 'application/json' }, cache: 'no-store' });
        if (!r.ok) throw new Error(String(r.status));
        const data = await r.json();
        if (stopped) return;
        setSvg(data.svg);
        setFailed(false);
        expiry.current = new Date(data.expiresAt).getTime();
        const refreshIn = Math.max(10_000, expiry.current - Date.now() - 60_000);
        refreshTimer = window.setTimeout(load, refreshIn);
      } catch {
        if (stopped) return;
        setFailed(true);
        refreshTimer = window.setTimeout(load, 10_000);
      }
    };
    load();
    const clock = window.setInterval(() => {
      if (expiry.current) setSecondsLeft(Math.max(0, Math.round((expiry.current - Date.now()) / 1000)));
    }, 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible' && expiry.current - Date.now() < 90_000) load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      clearInterval(clock);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [url]);

  return (
    <div className="mx-auto mt-5 w-full max-w-[260px]">
      <div className="relative aspect-square w-full overflow-hidden rounded-[16px] border border-beige bg-white p-2">
        {svg ? (
          <div className="h-full w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[13px] text-muted-ink">{refreshing}</div>
        )}
        {secondsLeft !== null && secondsLeft === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/90 text-[13px] text-muted-ink">{refreshing}</div>
        )}
      </div>
      {failed && (
        <p role="alert" className="mt-3 text-[13px] text-error">
          {error}
        </p>
      )}
    </div>
  );
}
