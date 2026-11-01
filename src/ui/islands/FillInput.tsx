/** Suggestion chips that fill a text input when tapped (the input stays free text). */
export default function FillInput({ target, label, options }: { target: string; label: string; options: string[] }) {
  return (
    <div className="-mt-2 flex flex-wrap items-center gap-1.5">
      <span className="text-[13px] text-muted-ink">{label}</span>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          className="rounded-full border border-beige-strong bg-paper px-2.5 py-1 text-[13px] hover:border-espresso"
          onClick={() => {
            const el = document.getElementById(target) as HTMLInputElement | null;
            if (!el) return;
            el.value = o;
            el.focus();
          }}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
