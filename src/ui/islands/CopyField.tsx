import { useEffect, useState } from 'react';
import { LuCopy, LuCheck, LuShare2 } from 'react-icons/lu';

export default function CopyField({ value, copyLabel, copiedLabel, shareLabel, shareTitle, mono }: {
  value: string;
  copyLabel: string;
  copiedLabel: string;
  shareLabel?: string;
  shareTitle?: string;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    if (shareLabel && 'share' in navigator) setCanShare(true);
  }, [shareLabel]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
      <input readOnly value={value} className={`input flex-1 ${mono ? 'font-mono text-[13px]' : 'text-[14px]'}`} onFocus={(e: any) => (e.currentTarget as HTMLInputElement).select()} aria-label={copyLabel} />
      <div className="flex gap-2">
        <button type="button" className="btn btn-secondary flex-1" onClick={copy}>
          {copied ? <LuCheck className="h-4 w-4" aria-hidden="true" /> : <LuCopy className="h-4 w-4" aria-hidden="true" />}
          <span aria-live="polite">{copied ? copiedLabel : copyLabel}</span>
        </button>
        {canShare && shareLabel && (
          <button type="button" className="btn btn-primary flex-1" onClick={() => navigator.share({ title: shareTitle, url: value }).catch(() => undefined)}>
            <LuShare2 className="h-4 w-4" aria-hidden="true" /> {shareLabel}
          </button>
        )}
      </div>
    </div>
  );
}
