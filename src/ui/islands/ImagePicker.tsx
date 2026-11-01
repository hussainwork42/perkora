import { useRef, useState } from 'react';
import { LuImagePlus } from 'react-icons/lu';

/**
 * File input for logos and banners. Large phone photos are scaled down in the browser
 * (to at most `maxSide` pixels, JPEG) before upload so they stay well under the size limit.
 * Without JavaScript the plain file input still works.
 */
export default function ImagePicker({ name, label, current, maxSide = 1600, shape = 'square', hint }: {
  name: string;
  label: string;
  current: string | null;
  maxSide?: number;
  shape?: 'square' | 'wide';
  hint?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(current);
  const [busy, setBusy] = useState(false);

  const onChange = async () => {
    const el = input.current;
    const file = el?.files?.[0];
    if (!el || !file) return;
    setBusy(true);
    try {
      const out = await shrink(file, maxSide);
      if (out !== file && typeof DataTransfer !== 'undefined') {
        const dt = new DataTransfer();
        dt.items.add(out);
        el.files = dt.files;
      }
      const url = URL.createObjectURL(out);
      setPreview(url);
      document.dispatchEvent(new CustomEvent('brand-image', { detail: { field: name, url } }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <span
        className={`flex shrink-0 items-center justify-center overflow-hidden rounded-[12px] border border-beige bg-sand ${shape === 'wide' ? 'h-16 w-28' : 'h-16 w-16'}`}
        aria-hidden="true"
      >
        {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <LuImagePlus className="h-6 w-6 text-muted" />}
      </span>
      <span className="min-w-0">
        <input ref={input} id={name} name={name} type="file" accept="image/png,image/jpeg,image/webp" className="block max-w-full text-[14px]" onChange={onChange} aria-label={label} />
        <span className="mt-1 block text-[12.5px] text-muted-ink" aria-live="polite">
          {busy ? '…' : hint}
        </span>
      </span>
    </div>
  );
}

async function shrink(file: File, maxSide: number): Promise<File> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return file;
  const small = file.size <= 600 * 1024;
  let bitmap: ImageBitmap | HTMLImageElement;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  const w = (bitmap as ImageBitmap).width;
  const h = (bitmap as ImageBitmap).height;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  if (small && scale === 1) return file;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  // keep transparent logos transparent (PNG); photos become JPEG
  const keepPng = file.type === 'image/png' && maxSide <= 800;
  if (!keepPng) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  const type = keepPng ? 'image/png' : 'image/jpeg';
  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, type, 0.84));
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.\w+$/, keepPng ? '.png' : '.jpg'), { type });
}
