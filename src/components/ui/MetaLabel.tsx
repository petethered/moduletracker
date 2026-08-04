/**
 * MetaLabel — the small uppercase label that annotates a value, an input, or a
 * short group.
 *
 * This is TIER 2 of the two-tier label system. Read the header of
 * ./SectionHeading.tsx first — it explains why the tiers exist and which one
 * to reach for. Short version: SectionHeading titles a REGION, MetaLabel
 * annotates a VALUE, an INPUT, or a small group.
 *
 * The treatment it replaces was copy-pasted across the app with drift in
 * tracking (`tracking-wider` vs `tracking-[0.15em]` vs `tracking-[0.2em]`) and
 * size (10px vs 12px), so the "system" was really several similar-looking
 * one-offs.
 *
 * NAMING: it is `MetaLabel`, not `FieldLabel`, because most call sites are not
 * form fields. Only the ones passing `htmlFor` label a real control; the rest
 * annotate read-only values (StatCard) or head a short group (PullForm's "Epic
 * Modules", the collection grid's type rows).
 *
 * --- TWO DELIBERATE NON-ADOPTERS ---
 * Both hand-roll a similar treatment on purpose. Do not "finish the migration"
 * by converting them without reading this:
 *
 *   1. Table.tsx column headers. A `<th>` is a different box context: this
 *      component renders `display: block`, and sortable headers nest their
 *      text inside an inline-flex `<button>` alongside a sort arrow. Forcing
 *      MetaLabel in would need a variant prop that only Table uses.
 *   2. ModuleTable.tsx type-section dividers ("Cannon (Attack)"). Those are
 *      gold uppercase band headings that separate sections of a long table —
 *      a third thing, structurally between a heading and a label. Converting
 *      them to either tier loses the visual separation that makes the table
 *      scannable.
 *
 * Renders a <label> when `htmlFor` is supplied (correct for form controls,
 * gives click-to-focus and a programmatic association) and a <span>
 * otherwise (correct for annotating a read-only value, where a <label> with
 * no control is invalid).
 *
 * SPACING IS NOT BAKED IN. There is no default margin: call sites pass their
 * own (`mb-1`, `mb-2`, or none). An earlier version hardcoded `mb-1`, which a
 * call site could not reliably override — appending `mb-2` via className loses
 * to `mb-1` or wins depending on stylesheet order, not on the order you wrote
 * them. Explicit margin at the call site is the only predictable option.
 */

interface MetaLabelProps {
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
  /** Extra classes. Pass the call site's own margin here. */
  className?: string;
}

export function MetaLabel({
  children,
  htmlFor,
  color,
  className = "",
}: MetaLabelProps) {
  // text-gray-400 (not 500/600) is the floor that clears 4.5:1 against every
  // navy surface in the app. Do not darken this.
  const classes = `block text-[11px] uppercase tracking-[0.15em] font-medium ${
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
