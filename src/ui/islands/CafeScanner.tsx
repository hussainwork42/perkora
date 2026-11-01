import { useState } from 'react';
import { LuCamera, LuX } from 'react-icons/lu';
import { useQrScanner } from './useQrScanner';

interface Props {
  labels: {
    open: string;
    scanning: string;
    starting: string;
    close: string;
    notCafe: string;
    memberCode: string;
    denied: string;
    unsupported: string;
    insecure: string;
    nocamera: string;
  };
  variant?: 'primary' | 'secondary';
}

/** Customer-facing: scan a café's counter QR code inside Perkora and open its join page. */
export default function CafeScanner({ labels, variant = 'primary' }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="w-full">
      {!open ? (
        <button type="button" className={`btn ${variant === 'primary' ? 'btn-primary' : 'btn-secondary'} w-full`} onClick={() => (setError(null), setOpen(true))}>
          <LuCamera className="h-5 w-5" aria-hidden="true" /> {labels.open}
        </button>
      ) : (
        <ScannerView
          labels={labels}
          onClose={() => setOpen(false)}
          onCode={(raw) => {
            const target = cafeTarget(raw);
            if (target) {
              window.location.href = target;
              return;
            }
            setOpen(false);
            setError(/\/t\/m\/|^PK1\./.test(raw) ? labels.memberCode : labels.notCafe);
          }}
        />
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-[12px] bg-warning-tint px-4 py-3 text-[14px] text-warning-ink">
          {error}
        </p>
      )}
    </div>
  );
}

/** Only follow links to a café page on this same site. */
function cafeTarget(raw: string): string | null {
  try {
    const u = new URL(raw.trim(), window.location.origin);
    if (u.origin !== window.location.origin) return null;
    if (!/^\/c\/[a-z0-9-]+\/?$/.test(u.pathname)) return null;
    return u.pathname + u.search;
  } catch {
    return null;
  }
}

function ScannerView({ labels, onClose, onCode }: { labels: Props['labels']; onClose: () => void; onCode: (raw: string) => void }) {
  const { videoRef, problem, ready } = useQrScanner(onCode);
  const message = problem === 'denied' ? labels.denied : problem === 'insecure' ? labels.insecure : problem === 'nocamera' ? labels.nocamera : problem ? labels.unsupported : null;
  return (
    <div>
      {message ? (
        <p role="alert" className="rounded-[12px] bg-warning-tint px-4 py-3 text-[14px] text-warning-ink">
          {message}
        </p>
      ) : (
        <div className="relative overflow-hidden rounded-[16px] bg-coffee">
          <video ref={videoRef} className="aspect-square w-full object-cover sm:aspect-[4/3]" muted playsInline autoPlay aria-label={labels.scanning} />
          <div className="pointer-events-none absolute inset-10 rounded-[18px] border-2 border-cream/80" aria-hidden="true" />
          <p className="absolute inset-x-0 bottom-3 px-4 text-center text-[13.5px] text-cream" aria-live="polite">
            {ready ? labels.scanning : labels.starting}
          </p>
        </div>
      )}
      <button type="button" className="btn btn-secondary mt-3 w-full" onClick={onClose}>
        <LuX className="h-4 w-4" aria-hidden="true" /> {labels.close}
      </button>
    </div>
  );
}
