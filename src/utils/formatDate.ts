/** Format a YYYY-MM-DD string as a locale-aware date (e.g. "Mar 31, 2026"). */
export function formatDisplayDate(dateStr: string): string {
  // Parse as local date (not UTC) by using component parts
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Format a Date object as YYYY-MM-DD in local time. */
export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Get today's date as YYYY-MM-DD in local time. */
export function getLocalDateString(): string {
  return toDateString(new Date());
}
