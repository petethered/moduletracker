/**
 * Badge — small inline pill used to label rarity (and other taxonomy) values.
 *
 * Where it's used: history rows, module cards, pull entries, anywhere a rarity
 * label needs a colored chip. The color is driven by the caller (see
 * `src/config/rarityColors.ts` for the canonical rarity palette) rather than a
 * hard-coded variant map — that's intentional so we can encode arbitrary
 * non-rarity tags (e.g. event labels) without expanding a variant union.
 *
 * Composition pattern: the caller passes the raw color hex/string, and this
 * component derives the background (`color + "15"` ≈ ~8% alpha) and border
 * (`color + "40"` ≈ ~25% alpha) from that single value. This keeps callers
 * simple and guarantees the trio (text/bg/border) stays harmonized.
 *
 * Accessibility: this is a presentational `<span>`. If a badge ever conveys
 * meaning that isn't already in the surrounding text, the caller is responsible
 * for adding an aria-label — color alone is not sufficient.
 */

/**
 * Props for {@link Badge}.
 */
interface BadgeProps {
  /**
   * Foreground color for the label text. Background and border tints are
   * derived from this value via hex-alpha suffixes — pass a 6-digit hex
   * (e.g. "#e94560") or a CSS color string that supports `+ "15"` / `+ "40"`
   * concatenation. Named colors like "red" will NOT render correctly here.
   */
  color: string;
  /** Badge contents — typically a short text label like "EPIC" or "x3". */
  children: React.ReactNode;
  /**
   * Escape hatch for layout tweaks from the parent (margins, alignment).
   * Avoid overriding visual styles here — those should live on `color`.
   */
  className?: string;
}

export function Badge({ color, children, className = "" }: BadgeProps) {
  return (
    <span
      // Tailwind handles layout/typography; inline `style` handles the
      // color-derived trio because Tailwind can't express dynamic hex-alpha
      // values without arbitrary-value JIT churn.
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide ${className}`}
      style={{
        color,
        // "15" hex suffix => ~8% alpha background fill (subtle tint).
        backgroundColor: color + "15",
        // "40" hex suffix => ~25% alpha border (visible outline).
        border: `1px solid ${color}40`,
        fontFamily: "var(--font-mono)",
      }}
    >
      {children}
    </span>
  );
}
