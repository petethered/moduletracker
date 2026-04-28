/**
 * DateInput — themed wrapper around the native `<input type="date">`.
 *
 * Where it's used: pull entry forms, history filters — anywhere a single
 * calendar day needs to be picked.
 *
 * Composition pattern: deliberately minimal. We rely on the browser's native
 * date picker (best a11y, no JS popup library) and only restyle the chrome.
 * The `[color-scheme:dark]` Tailwind arbitrary-value is critical here — without
 * it, Chrome/Safari render the picker icon black on our dark background and
 * it becomes invisible.
 *
 * Controlled component: `value` is always an ISO date string ("YYYY-MM-DD")
 * coming from the parent. The `onChange` callback receives the raw string from
 * the input event — no Date parsing happens at this layer (caller decides).
 */

/**
 * Props for {@link DateInput}.
 */
interface DateInputProps {
  /**
   * ISO date string in `YYYY-MM-DD` form (the format `<input type="date">`
   * natively emits and accepts). Empty string represents "no date selected".
   */
  value: string;
  /**
   * Fires on every native change event. Argument is the raw string from the
   * input — caller is responsible for any Date parsing / validation.
   */
  onChange: (value: string) => void;
  /** Optional uppercase label rendered above the field. */
  label?: string;
}

export function DateInput({ value, onChange, label }: DateInputProps) {
  return (
    <div>
      {label && (
        <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">
          {label}
        </label>
      )}
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        // `[color-scheme:dark]` flips the native calendar icon to a light
        // variant so it stays visible against the navy background. Don't
        // remove this without verifying the picker icon in Chrome + Safari.
        className="w-full px-3 py-2 rounded-lg bg-[var(--color-navy-800)] border border-[var(--color-navy-500)] text-gray-200 focus:outline-none focus:border-[var(--color-accent-gold)] cursor-pointer [color-scheme:dark]"
      />
    </div>
  );
}
