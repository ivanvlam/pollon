"use client";

interface Props {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  disabled?: boolean;
  min?: number;
  max?: number;
}

/** Selector numérico con botones −/＋ (oculta las flechas default feas). */
export function Stepper({
  value,
  onChange,
  ariaLabel,
  disabled,
  min = 0,
  max = 99,
}: Props) {
  const num = value === "" ? null : Number(value);
  const clamp = (v: number) => String(Math.max(min, Math.min(max, v)));

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label={`Restar gol a ${ariaLabel}`}
        disabled={disabled || (num !== null && num <= min)}
        onClick={() => onChange(clamp((num ?? min + 1) - 1))}
        className="h-9 w-9 rounded-lg border border-neutral-700 text-xl leading-none text-neutral-300 transition hover:bg-neutral-800 disabled:opacity-40"
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        aria-label={ariaLabel}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-12 rounded-lg border border-neutral-700 bg-neutral-900 py-1.5 text-center text-2xl font-bold tabular-nums text-neutral-100 outline-none focus:border-emerald-500"
      />
      <button
        type="button"
        aria-label={`Sumar gol a ${ariaLabel}`}
        disabled={disabled || (num !== null && num >= max)}
        onClick={() => onChange(clamp((num ?? -1) + 1))}
        className="h-9 w-9 rounded-lg border border-neutral-700 text-xl leading-none text-neutral-300 transition hover:bg-neutral-800 disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}
