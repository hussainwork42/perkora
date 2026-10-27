import { useEffect, useState } from 'react';
import { LuCake, LuCoffee, LuCroissant, LuCupSoda, LuGift, LuHeart, LuPercent, LuSparkles, LuStar } from 'react-icons/lu';

const ICONS: Record<string, any> = { coffee: LuCoffee, cup: LuCupSoda, croissant: LuCroissant, cake: LuCake, gift: LuGift, percent: LuPercent, sparkles: LuSparkles, star: LuStar, heart: LuHeart };

interface P {
  name: string;
  description: string;
  icon: string;
  validity: string;
  cost: string;
}

/** Live preview of a reward as it will appear in the customer's card. */
export default function RewardPreview({ formId, initial }: { formId: string; initial: P }) {
  const [v, setV] = useState<P>(initial);
  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    const read = () => {
      const get = (n: string) => (form.elements.namedItem(n) as HTMLInputElement | null)?.value ?? '';
      setV({ name: get('name'), description: get('description'), icon: get('icon') || 'gift', validity: get('validity_days'), cost: get('kind') === 'points' ? get('points_cost') : '' });
    };
    form.addEventListener('input', read);
    form.addEventListener('change', read);
    return () => {
      form.removeEventListener('input', read);
      form.removeEventListener('change', read);
    };
  }, [formId]);
  const Icon = ICONS[v.icon] ?? LuGift;
  return (
    <div className="flex items-start gap-3.5 rounded-[14px] border border-terracotta/40 bg-paper p-4">
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-terracotta-tint text-terracotta-ink">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15.5px] font-semibold leading-snug">{v.name || 'Reward name'}</p>
        {v.description && <p className="mt-0.5 text-[14px] text-muted-ink">{v.description}</p>}
        <p className="mt-1 text-[13px] text-terracotta-ink">
          {v.cost ? `${v.cost} points` : 'Ready to redeem'}
          {v.validity ? ` · valid ${v.validity} days` : ''}
        </p>
        <p className="mt-2 text-[13px] text-muted-ink">Tell the staff you’d like to use it, and show your card.</p>
      </div>
    </div>
  );
}
