import { useState } from 'react';
import { LuEye, LuEyeOff } from 'react-icons/lu';

/** Password field with a show/hide button, so people can check what they typed on a phone. */
export default function PasswordInput({ name, autoComplete, invalid, showLabel, hideLabel, autoFocus, minLength }: {
  name: string;
  autoComplete: string;
  invalid?: boolean;
  showLabel: string;
  hideLabel: string;
  autoFocus?: boolean;
  minLength?: number;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input
        id={name}
        name={name}
        type={shown ? 'text' : 'password'}
        autoComplete={autoComplete}
        required
        minLength={minLength}
        autoFocus={autoFocus}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${name}-error` : undefined}
        className="input pr-12"
        autoCapitalize="none"
        spellCheck={false}
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-[12px] text-muted-ink hover:text-ink"
        aria-label={shown ? hideLabel : showLabel}
        aria-pressed={shown}
      >
        {shown ? <LuEyeOff className="h-5 w-5" aria-hidden="true" /> : <LuEye className="h-5 w-5" aria-hidden="true" />}
      </button>
    </div>
  );
}
