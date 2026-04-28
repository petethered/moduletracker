/**
 * Date formatting helpers — the entire app's source of truth for converting
 * between `YYYY-MM-DD` storage strings and human-readable display dates.
 *
 * ROLE IN SYSTEM:
 * Pull records are stored with a `YYYY-MM-DD` string date (NOT a Date
 * object, NOT a timestamp), keyed in local time. This file handles the two
 * directions of that conversion:
 *   1. `YYYY-MM-DD` storage string  -> human display string  (formatDisplayDate)
 *   2. JavaScript `Date` object     -> `YYYY-MM-DD` string   (toDateString)
 *   3. "Today" as a `YYYY-MM-DD`    -> getLocalDateString
 *
 * IMPORTERS (non-exhaustive): pull entry forms, history list rows, charts
 * with date axes, anywhere `pulls[i].date` is rendered.
 *
 * GOTCHA — TIMEZONES (this is why the file exists at all):
 *   `new Date('2026-04-27')` parses as **UTC midnight**, which can be the
 *   previous day in negative-offset timezones (e.g. shows "Apr 26" in PT).
 *   We sidestep this by manually splitting the string and constructing a
 *   `Date` with year/month/day components (which the `Date` constructor
 *   interprets in **local time**). DO NOT "simplify" by passing the string
 *   directly to `new Date()` — you will reintroduce the off-by-one bug.
 *
 *   Likewise, `toDateString` and `getLocalDateString` use the local-time
 *   getters (`getFullYear`, `getMonth`, `getDate`) NOT the UTC variants,
 *   so "today" matches what the user's wall clock says.
 */

/**
 * Format a `YYYY-MM-DD` storage string as a locale-aware display date.
 *
 * @param dateStr A date in `YYYY-MM-DD` format (the canonical storage
 *   shape). Behavior is undefined for any other shape — caller is expected
 *   to have validated input.
 * @returns Localized short date, e.g. `"Mar 31, 2026"` in `en-US`. Output
 *   varies by user locale (`undefined` is passed to `toLocaleDateString`,
 *   which defers to the runtime's default locale).
 *
 * GOTCHA: Parses the string in **local time** by splitting components
 *   manually. See file-level docblock for why we don't pass `dateStr`
 *   directly to `new Date()`.
 */
export function formatDisplayDate(dateStr: string): string {
  // Parse as local date (not UTC) by using component parts.
  // `new Date('2026-04-27')` would be UTC midnight => off-by-one in many tz.
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format a `Date` object as a `YYYY-MM-DD` string in **local time**.
 *
 * @param date A JS Date.
 * @returns A zero-padded ISO-style date string (the canonical storage shape).
 *   Always 10 chars, always parseable by `formatDisplayDate`.
 *
 * GOTCHA: Uses local-time getters intentionally — see file-level docblock.
 *   If you ever need UTC behavior, write a separate function; do not change
 *   this one.
 */
export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Get today's date as a `YYYY-MM-DD` string in the user's **local timezone**.
 *
 * @returns Same shape as `toDateString` — the local "wall clock" date.
 *
 * USE WHEN: pre-filling a new pull record's date, defaulting form inputs,
 *   or computing "is this pull from today" comparisons (compare the strings
 *   directly — both sides will be in the same local-time format).
 *
 * GOTCHA: Just-past-midnight UTC users in eastern timezones will see
 *   "tomorrow's" date here, which is correct (it IS tomorrow for them).
 *   Test fixtures should freeze the date via Vitest's fake timers if they
 *   care about determinism.
 */
export function getLocalDateString(): string {
  return toDateString(new Date());
}
