/**
 * SectionHeading — the heading for a content section or card.
 *
 * WHY THIS EXISTS (read before "simplifying" it back into a span):
 * The app previously rendered EVERY label at the same visual weight: a ~10px
 * uppercase wide-tracking gray micro-label. Stat labels, section headings,
 * table column headers, form field labels, module-type headings and card
 * titles all wore the identical uniform, in 17 separate places. When every
 * label looks equally important, nothing signals relative importance and the
 * eye has no path through the page.
 *
 * The fix is two explicit tiers, not one:
 *
 *   TIER 1 — SectionHeading (this file)
 *     "Recent Pulls", "Epic Pulls by Type", "Collection".
 *     Sentence case, 13px, medium weight, near-white. Deliberately NOT
 *     uppercase and NOT wide-tracked, so it reads as a heading rather than as
 *     another piece of chrome.
 *
 *   TIER 2 — FieldLabel (./FieldLabel.tsx)
 *     "Total Pulls", "Banner", "Date", column headers.
 *     Small uppercase wide-tracked gray. Annotates a value or an input.
 *
 * RULE OF THUMB: if it titles a REGION, use SectionHeading. If it labels a
 * single VALUE or INPUT, use FieldLabel. Do not invent a third tier without a
 * reason you can write down here.
 *
 * Renders an <h3> by default because these sit under the per-tab <h2> in each
 * feature panel, keeping the document outline sane. Override via `as` when the
 * nesting demands it — do not reach for a plain <div>, headings are how screen
 * reader users navigate between regions.
 */

interface SectionHeadingProps {
  children: React.ReactNode;
  /**
   * Heading level to render. Defaults to `"h3"`.
   *
   * Feature panels use <h2> for the tab title (e.g. "Dashboard"), so section
   * headings inside them are <h3>. If you nest a section inside a section,
   * pass "h4" rather than skipping a level.
   */
  as?: "h2" | "h3" | "h4";
  /** Extra classes, mainly for spacing overrides at the call site. */
  className?: string;
}

export function SectionHeading({
  children,
  as: Tag = "h3",
  className = "",
}: SectionHeadingProps) {
  return (
    <Tag
      className={`text-[13px] font-medium text-gray-200 mb-3 ${className}`}
      style={{ fontFamily: "var(--font-body)" }}
    >
      {children}
    </Tag>
  );
}
