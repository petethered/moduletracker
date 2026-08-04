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
 *   TIER 2 — MetaLabel (./MetaLabel.tsx)
 *     "Total Pulls", "Banner", "Date", "Epic Modules (3)", the collection
 *     grid's type rows. Small uppercase wide-tracked. Annotates a value, an
 *     input, or a short group.
 *
 * RULE OF THUMB: SectionHeading titles a REGION the reader navigates to.
 * MetaLabel annotates something specific — a value, a control, or a handful of
 * related rows. When it is genuinely borderline, ask whether a screen-reader
 * user would want to jump to it: headings are navigation landmarks, labels are
 * not. "Epic Modules (3)" heads a list but is a MetaLabel, because it is part
 * of the form it sits inside rather than a destination.
 *
 * Two components deliberately opt out of both tiers; MetaLabel's header
 * documents which and why. Read that before adding a third tier.
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
  /**
   * Optional color override, for headings where the color itself carries
   * meaning — e.g. PredictedGemsCard's two goal panels, where ancestral-green
   * and legendary-gold tell the reader which rarity target each panel is about
   * before they read a word.
   *
   * Use sparingly. A colored heading is a signal; if every heading is colored,
   * none of them are. Verify any custom color clears WCAG AA (4.5:1) against
   * the surface behind it.
   */
  color?: string;
  /** Extra classes, mainly for spacing overrides at the call site. */
  className?: string;
}

export function SectionHeading({
  children,
  as: Tag = "h3",
  color,
  className = "",
}: SectionHeadingProps) {
  return (
    <Tag
      className={`text-[13px] font-medium mb-3 ${
        color ? "" : "text-gray-200"
      } ${className}`}
      style={{ fontFamily: "var(--font-body)", ...(color ? { color } : {}) }}
    >
      {children}
    </Tag>
  );
}
