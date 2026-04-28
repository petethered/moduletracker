import type { ButtonHTMLAttributes } from "react";

/**
 * Button — the single canonical button primitive for the app.
 *
 * Where it's used: every feature surface (modals, forms, toolbars, dialogs).
 * If you find yourself writing a raw `<button>` with Tailwind classes, you
 * almost certainly want this instead — the variants below already encode the
 * agreed visual language (gradient primary, navy secondary, red danger,
 * transparent ghost).
 *
 * Composition pattern: extends native `ButtonHTMLAttributes` so any standard
 * button prop (onClick, type, disabled, aria-*, data-*, form, etc.) just works.
 * Only one custom prop (`variant`) is layered on top.
 *
 * Accessibility: native `<button>` so keyboard activation, focus ring, and
 * `disabled` semantics come for free. The `disabled:opacity-40` + cursor rule
 * gives consistent disabled visuals across all variants.
 */

// Variant union kept narrow on purpose — adding a new variant should be a
// deliberate design decision, not a one-off override via className.
type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

/**
 * Props for {@link Button}. Accepts every native `<button>` attribute in
 * addition to `variant`.
 */
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Visual treatment. Defaults to `"primary"` (the crimson gradient CTA).
   * - `primary`  — main affirmative action (Save, Add, Confirm)
   * - `secondary`— neutral / cancel-style action
   * - `danger`   — destructive action (Delete, Reset)
   * - `ghost`    — low-emphasis action, blends into surrounding chrome
   */
  variant?: ButtonVariant;
}

// Pre-baked Tailwind class strings per variant. Stored outside the component
// so the object literal isn't reallocated each render. CSS variables
// (`--color-navy-*`, `--color-accent-*`) come from the global theme — keep
// these in sync if the palette ever expands.
const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-[var(--color-accent-crimson)] to-[#c23152] text-white hover:brightness-110 shadow-[0_0_16px_rgba(233,69,96,0.2)] hover:shadow-[0_0_24px_rgba(233,69,96,0.35)]",
  secondary:
    "bg-[var(--color-navy-600)] text-gray-200 hover:bg-[var(--color-navy-500)] border border-[var(--color-navy-500)] hover:border-[var(--color-accent-gold)]/30",
  danger: "bg-red-800/80 text-white hover:bg-red-700 border border-red-700/50",
  ghost: "text-gray-400 hover:text-gray-200 hover:bg-[var(--color-navy-600)]",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      // Order matters: base classes → variant classes → caller's `className`.
      // Caller overrides win because Tailwind's later class beats earlier ones
      // when specificity is equal (after JIT processing).
      className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none ${variantClasses[variant]} ${className}`}
      style={{ fontFamily: "var(--font-body)" }}
      {...props}
    >
      {children}
    </button>
  );
}
