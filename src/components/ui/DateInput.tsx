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

import { useId } from "react";
import { MetaLabel } from "./MetaLabel";

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
  // Generated id wiring the label to the input. Previously the <label> had no
  // `htmlFor` and the <input> had no `id`, so they were only VISUALLY
  // associated: a screen reader announced the field as an unlabelled date
  // input, and clicking the label didn't focus it. `useId` (not a hardcoded
  // string) because PullForm can render more than one DateInput at a time and
  // duplicate ids would cross-wire the labels.
  const inputId = useId();

  return (
    <div>
      {/* MetaLabel is the shared value/input label tier — see
          components/ui/SectionHeading.tsx for why the two tiers exist. */}
      {label && (
        <MetaLabel htmlFor={inputId} className="mb-1">
          {label}
        </MetaLabel>
      )}
      <input
        id={inputId}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        // `[color-scheme:dark]` flips the native calendar icon to a light
        // variant so it stays visible against the navy background. Don't
        // remove this without verifying the picker icon in Chrome + Safari.
        //
        // focus-visible ring: the field previously had `focus:outline-none`
        // with only a border-color change as the focus signal, which is easy
        // to miss on a dark theme. The gold outline is the app-wide focus
        // treatment.
        className="w-full px-3 py-2 rounded-lg bg-[var(--color-navy-800)] border border-[var(--color-navy-500)] text-gray-200 focus:outline-none focus:border-[var(--color-accent-gold)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-gold)] cursor-pointer [color-scheme:dark]"
      />
    </div>
  );
}
