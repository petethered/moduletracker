/**
 * StatCard — KPI tile for headline numbers (totals, rates, counts).
 *
 * Where it's used: dashboard hero strip, analytics summaries, modules overview.
 * Composes well in a CSS grid — the card is self-contained and assumes its
 * width is dictated by the parent container.
 *
 * Composition pattern:
 *   - One label (small caps, accent color)
 *   - One value (large, mono, white)
 *   - Optional subtitle (small gray, body font)
 *   - Two thin "L-bracket" lines in the top-left corner that pick up the
 *     accent color — purely decorative, signals the futuristic theme.
 *
 * Accessibility: this is presentational. The label/value/subtitle text is read
 * in source order, which is appropriate for screen readers.
 */

/**
 * Props for {@link StatCard}.
 */
interface StatCardProps {
  /** Short uppercase descriptor (e.g. "TOTAL PULLS"). Rendered in small caps. */
  label: string;
  /**
   * The big number/string. Accepts both because some stats are formatted
   * (`"12.4%"`, `"3 / 10"`) and we don't want callers to stringify just to
   * satisfy the type.
   */
  value: string | number;
  /** Optional muted line below the value (e.g. "+3 today"). */
  subtitle?: string;
  /**
   * Accent color for the label and the corner bracket lines. Defaults to the
   * gold theme accent. Pass a rarity color (see `src/config/rarityColors.ts`)
   * to thematically tag the stat (e.g. legendary=gold, mythic=red).
   */
  color?: string;
}

export function StatCard({
  label,
  value,
  subtitle,
  color = "var(--color-accent-gold)",
}: StatCardProps) {
  return (
    <div
      className="relative bg-[var(--color-navy-700)]/60 backdrop-blur-sm border border-[var(--color-navy-500)]/40 rounded-xl p-4 overflow-hidden transition-all duration-300 hover:border-opacity-60"
      style={{
        // Inset white hairline + outer shadow gives a subtle "lit panel" feel.
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.03), 0 0 20px rgba(0,0,0,0.2)`,
      }}
    >
      {/* Subtle corner accent — two 1px lines forming an L-bracket in the
          top-left. Decorative only; reinforces the dashboard's sci-fi look. */}
      <div
        className="absolute top-0 left-0 w-8 h-[1px]"
        style={{ backgroundColor: color, opacity: 0.4 }}
      />
      <div
        className="absolute top-0 left-0 w-[1px] h-8"
        style={{ backgroundColor: color, opacity: 0.4 }}
      />
      <div
        // `tracking-[0.15em]` (extra wide letter-spacing) is a deliberate
        // tradeoff — the label reads as a "category tag" rather than copy.
        className="text-[10px] uppercase tracking-[0.15em] mb-2 font-medium"
        style={{ color, fontFamily: "var(--font-body)" }}
      >
        {label}
      </div>
      <div
        // Mono font for numbers so digits align across stacked cards (helps
        // visual scanning when a row of cards shows comparable values).
        className="text-2xl font-semibold text-white"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {value}
      </div>
      {subtitle && (
        <div
          className="text-[10px] text-gray-500 mt-1.5"
          style={{ fontFamily: "var(--font-body)" }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}
