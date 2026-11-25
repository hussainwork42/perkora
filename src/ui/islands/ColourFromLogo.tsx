import { useEffect, useState } from 'react';
import { LuPalette } from 'react-icons/lu';

/**
 * When a logo is picked (ImagePicker's `brand-image` event), take the café's colours from it:
 * the most common non-white colour becomes the main colour, the next clearly different one the
 * stamp colour. Fills the form's colour inputs; they can still be changed by hand.
 */
export default function ColourFromLogo({ formId, note }: { formId: string; note: string }) {
  const [picked, setPicked] = useState<string[] | null>(null);

  useEffect(() => {
    const onImage = (e: Event) => {
      const d = (e as CustomEvent<{ field: string; url: string }>).detail;
      if (d?.field !== 'logo') return;
      const img = new Image();
      img.onload = () => {
        const colours = paletteOf(img);
        if (!colours) return;
        const form = document.getElementById(formId) as HTMLFormElement | null;
        const set = (name: string, v: string) => {
          const el = form?.querySelector<HTMLInputElement>(`input[name="${name}"]`);
          if (el) {
            el.value = v;
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }
        };
        set('primary_colour', colours[0]);
        set('secondary_colour', colours[1]);
        setPicked(colours);
      };
      img.src = d.url;
    };
    document.addEventListener('brand-image', onImage);
    return () => document.removeEventListener('brand-image', onImage);
  }, [formId]);

  if (!picked) return null;
  return (
    <p className="flex items-center gap-2 text-[13px] text-muted-ink" aria-live="polite">
      <LuPalette className="h-4 w-4" aria-hidden="true" />
      {picked.map((c) => (
        <span key={c} className="inline-block h-4 w-4 rounded-full ring-1 ring-black/10" style={{ background: c }} />
      ))}
      {note}
    </p>
  );
}

const hex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();

function paletteOf(img: HTMLImageElement): [string, string] | null {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, size, size);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, size, size).data;
  } catch {
    return null;
  }
  // bucket by 5 bits per channel; ignore transparent and near-white pixels (logo backgrounds)
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (a < 128) continue;
    if (r > 236 && g > 236 && b > 236) continue;
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++;
    e.r += r;
    e.g += g;
    e.b += b;
    buckets.set(key, e);
  }
  if (!buckets.size) return null;
  // merge neighbouring buckets into colour groups
  const groups: { n: number; r: number; g: number; b: number }[] = [];
  for (const e of [...buckets.values()].sort((a, b) => b.n - a.n)) {
    const c = { r: e.r / e.n, g: e.g / e.n, b: e.b / e.n };
    const near = groups.find((gr) => dist(gr.r / gr.n, gr.g / gr.n, gr.b / gr.n, c.r, c.g, c.b) < 40);
    if (near) {
      near.n += e.n;
      near.r += e.r;
      near.g += e.g;
      near.b += e.b;
    } else groups.push({ ...e });
  }
  groups.sort((a, b) => b.n - a.n);
  const avg = (g: (typeof groups)[number]) => [g.r / g.n, g.g / g.n, g.b / g.n] as const;
  const total = groups.reduce((s, g) => s + g.n, 0);
  // prefer a colourful group for the main colour when it is a real part of the logo
  const colourful = groups.find((g) => g.n / total > 0.12 && chroma(...avg(g)) > 60);
  const main = colourful && chroma(...avg(groups[0])) < 30 && luma(...avg(groups[0])) > 60 ? colourful : groups[0];
  const [r1, g1, b1] = avg(main);
  const second = groups.find((g) => g !== main && g.n / total > 0.04 && dist(...avg(g), r1, g1, b1) > 70);
  const accent = second ? avg(second) : luma(r1, g1, b1) < 110 ? mixRgb([r1, g1, b1], [255, 255, 255], 0.45) : mixRgb([r1, g1, b1], [0, 0, 0], 0.35);
  return [hex(r1, g1, b1), hex(...accent)];
}

function dist(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number) {
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
}
function chroma(r: number, g: number, b: number) {
  return Math.max(r, g, b) - Math.min(r, g, b);
}
function luma(r: number, g: number, b: number) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
function mixRgb(a: readonly number[], b: readonly number[], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
