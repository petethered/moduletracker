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
 * IMPORTERS (non-exhaustive): ModuleTable "Pulls Since" column. Add future
 * stat displays here rather than calling toLocaleString inline — a single
 * choke point keeps formatting consistent and reviewable
 * (localization-enforcer agent checks for this).
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
