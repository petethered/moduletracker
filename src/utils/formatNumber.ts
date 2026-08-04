/**
 * Number formatting helpers — the app's source of truth for locale-aware
 * numeric display, sibling to formatDate.ts (which owns dates).
 *
 * ROLE IN SYSTEM:
 * Raw numbers from selectors are unformatted; display layers route them
 * through here so grouping separators follow the user's locale ("1,234" in
 * en-US, "1.234" in de-DE, "1 234" in fr-FR). Never interpolate a raw
 * selector number into JSX when it can plausibly exceed 3 digits.
 *
 * USE THESE, NOT INLINE CALLS. Every display of a count, a currency-like
 * total (gems), or a percentage goes through here. Inline `.toLocaleString()`
 * and `.toFixed()` are what let the app drift into rendering the same quantity
 * three different ways: the epic rate once showed as `2.500%` in a chart
 * tooltip eight lines from a reference line reading `Expected 2.5%`, and
 * gems-per-epic rendered as `8333.333` while every other gem figure had
 * grouping separators.
 *
 * The canvas screenshot renderer (src/features/screenshot/*) imports these too.
 * Number formatting is a locale concern and should match the live UI — unlike
 * that module's COLOR constants, which are a deliberately pinned snapshot.
 */

/**
 * Format an integer with locale-aware grouping separators.
 *
 * @param n An integer. Behavior for non-integers is whatever
 *   `toLocaleString` does (locale-dependent decimals) — callers are
 *   expected to pass integers; round first if unsure.
 * @returns e.g. `"1,234"` in `en-US`. `undefined` locale defers to the
 *   runtime default, matching formatDisplayDate's approach.
 */
export function formatInteger(n: number): string {
  return n.toLocaleString(undefined);
}

/**
 * Format a percentage value with locale-aware separators and a fixed number
 * of decimal places. Appends the `%` sign.
 *
 * @param n The percentage as a NUMBER OUT OF 100, not a fraction. Pass `2.5`
 *   for "2.5%", not `0.025`. This matches what every selector in the app
 *   already returns (see `selectEpicPullRate`), so callers do not multiply.
 * @param fractionDigits Decimal places. Defaults to 1.
 *
 * PRECISION CONVENTION — follow it rather than picking per call site:
 *   1 decimal (default) — distribution and share-of-total percentages, where
 *     the reader wants proportion at a glance (rarity breakdown, type
 *     balance, per-module share of pulls).
 *   2 decimals — the EPIC PULL RATE specifically. It hovers near 2.5% and
 *     rounding to one decimal hides the signal players actually track. Any
 *     surface showing epic rate uses 2, so the dashboard card, the banner
 *     breakdown, the chart tooltip and the screenshot all agree.
 *   More than 2 — don't. It reads as false precision on RNG data.
 *
 * Both bounds are set so the digit count is stable: without
 * `minimumFractionDigits` a whole number would render as "3%" next to
 * "2.5%" and the column would ragged-edge.
 */
export function formatPercent(n: number, fractionDigits = 1): string {
  return `${n.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}%`;
}
