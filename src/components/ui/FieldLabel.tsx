/**
 * FieldLabel — the small uppercase label that annotates a single value or
 * form input.
 *
 * This is TIER 2 of the two-tier label system. Read the header of
 * ./SectionHeading.tsx first — it explains why the tiers exist and which one
 * to reach for. Short version: SectionHeading titles a REGION, FieldLabel
 * labels a VALUE or an INPUT.
 *
 * The treatment it replaces was copy-pasted across the app with drift in
 * tracking (`tracking-wider` vs `tracking-[0.15em]` vs `tracking-[0.2em]`) and
 * size (10px vs 12px), so the "system" was really several similar-looking
 * one-offs.
 *
 * MIGRATION IS PARTIAL. Adopted so far: DateInput, PullForm (3 labels). Still
 * hand-rolling the classes and worth converting when you next touch them:
 *   StatCard.tsx, Table.tsx (column headers), BannerStatsBreakdown.tsx,
 *   ModuleCollectionGrid.tsx (type headings), ModuleTable.tsx,
 *   PredictedGemsCard.tsx
 * Do not read this component's existence as "the system is enforced".
 *
 * NAMING CAVEAT: "Field" oversells it. Only some call sites label a real form
 * control (those pass `htmlFor`); others annotate a read-only value or head a
 * short group. Treat the name as "small annotating label", not "form field
 * label only".
 *
 * Renders a <label> when `htmlFor` is supplied (correct for form controls,
 * gives click-to-focus and a programmatic association) and a <span>
 * otherwise (correct for annotating a read-only value, where a <label> with
 * no control is invalid).
 */

interface FieldLabelProps {
  children: React.ReactNode;
  /**
   * Id of the control this labels. When present the component renders a real
   * <label for=...>; when absent it renders a <span>.
   *
   * ALWAYS pass this for form inputs. A visually-adjacent <span> is not an
   * accessible label — a screen reader will not associate the two.
   */
  htmlFor?: string;
  /**
   * Optional color override, for labels that carry semantic meaning through
   * color (StatCard accents, the epic-purple "Epic Modules" label in
   * PullForm). Defaults to the muted gray used everywhere else.
   *
   * Accepts any CSS color string including `var(--color-rarity-epic)`. If you
   * pass a custom color, verify it clears WCAG AA (4.5:1) against the
   * surface it sits on — these render at 10-12px, which counts as normal
   * text, not large text.
   */
  color?: string;
  /** Extra classes, mainly for spacing overrides at the call site. */
  className?: string;
}

export function FieldLabel({
  children,
  htmlFor,
  color,
  className = "",
}: FieldLabelProps) {
  // text-gray-400 (not 500/600) is the floor that clears 4.5:1 against every
  // navy surface in the app. Do not darken this.
  const classes = `block text-[11px] uppercase tracking-[0.15em] font-medium mb-1 ${
    color ? "" : "text-gray-400"
  } ${className}`;

  // `style` is only attached when a color is supplied so the Tailwind class
  // stays the single source of truth in the default case.
  const style = color ? { color } : undefined;

  if (htmlFor) {
    return (
      <label htmlFor={htmlFor} className={classes} style={style}>
        {children}
      </label>
    );
  }

  return (
    <span className={classes} style={style}>
      {children}
    </span>
  );
}
