import { useState } from "react";

/**
 * Table — generic data table with optional per-column sorting.
 *
 * Where it's used: history list, modules list — anywhere a tabular view of
 * domain records is needed. Generic over the row type `T` so callers get
 * type-safe `render` and `sortValue` functions.
 *
 * Composition pattern:
 *   - Caller supplies a `columns` array describing how to render and sort.
 *   - Caller supplies a stable `keyExtractor` for React list keys.
 *   - Sort state lives INSIDE the table — it's a UI concern, not data.
 *     If a parent ever needs persistent sort, lift state up via new props
 *     (`sortKey`, `sortDir`, `onSortChange`); don't try to read it via ref.
 *
 * Accessibility: uses native `<table>`/`<thead>`/`<tbody>`/`<th>`/`<td>` so
 * screen readers and column-by-column nav work. Sort headers are clickable
 * `<th>` elements (NOT buttons) — acceptable for a presentational table but
 * note that keyboard-only users currently can't sort. If this matters, swap
 * the sort header to a real `<button>` inside the `<th>`.
 */

/**
 * Column descriptor. Generic over the row type `T`.
 */
export interface Column<T> {
  /**
   * Stable identifier for this column. Used as the React `key`, the sort
   * state key, and the dedup key when looking up the active sort column.
   * Must be unique across all columns in a single table.
   */
  key: string;
  /** Header text shown in the `<th>`. Rendered uppercase by the styles below. */
  header: string;
  /**
   * Cell renderer. Receives the row item and returns ReactNode — caller has
   * full control over cell content (badges, links, formatted numbers, etc.).
   */
  render: (item: T) => React.ReactNode;
  /** When `true`, the header becomes clickable and toggles asc/desc sort. */
  sortable?: boolean;
  /**
   * Returns the value to compare when sorting by this column. Required for
   * `sortable: true` to actually sort — without it, clicks toggle the arrow
   * but rows don't reorder. (We don't enforce this at the type level because
   * a column can be `sortable` but have its sort logic provided externally
   * via a default initial sort handled by the caller.)
   */
  sortValue?: (item: T) => string | number;
}

/**
 * Props for {@link Table}.
 */
interface TableProps<T> {
  /** Column definitions in render order (left → right). */
  columns: Column<T>[];
  /** Row data. Sorting is non-mutating — the original array is not modified. */
  data: T[];
  /** Returns a stable React key for each row (typically the row's id). */
  keyExtractor: (item: T) => string;
  /**
   * If provided, rows become clickable and the cursor turns into a pointer.
   * Use for "drill down to detail" patterns — e.g. clicking a history row
   * opens its edit modal.
   */
  onRowClick?: (item: T) => void;
  /** Shown in place of the table when `data` is empty. Default `"No data"`. */
  emptyMessage?: string;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyMessage = "No data",
}: TableProps<T>) {
  // Sort state is intentionally local — see the top-of-file note about lifting
  // state if persistence is ever needed.
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Header click handler: clicking the active column toggles direction;
  // clicking a different column resets to ascending. Matches the convention
  // of most spreadsheet apps.
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  // Copy first so the in-place `.sort()` below never mutates the parent's
  // `data` array (would cause subtle bugs in selectors / memoized parents).
  const sortedData = [...data];
  if (sortKey) {
    const col = columns.find((c) => c.key === sortKey);
    // If the column is missing `sortValue`, we silently skip sorting. The
    // header arrow still toggles — this is a known soft-failure mode (see
    // the prop docs). Add a dev-only `console.warn` here if it ever bites.
    if (col?.sortValue) {
      sortedData.sort((a, b) => {
        const aVal = col.sortValue!(a);
        const bVal = col.sortValue!(b);
        // Generic compare that works for both string and number return types.
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
  }

  // Empty state: skip rendering the whole `<table>` chrome — a centered
  // message is friendlier than an empty grid.
  if (data.length === 0) {
    return (
      <div className="text-center text-gray-600 py-16" style={{ fontFamily: "var(--font-body)" }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    // `overflow-x-auto` lets the table scroll horizontally on narrow viewports
    // instead of squishing columns or wrapping content.
    <div className="overflow-x-auto rounded-xl border border-[var(--color-navy-500)]/30 bg-[var(--color-navy-800)]/40">
      <table className="w-full text-sm" style={{ fontFamily: "var(--font-body)" }}>
        <thead>
          <tr className="border-b border-[var(--color-navy-500)]/40">
            {columns.map((col) => (
              <th
                key={col.key}
                // Only attach the click handler when the column opts in to
                // sorting — keeps the cursor/affordance honest.
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
                className={`px-3 py-3 text-left text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium ${
                  col.sortable ? "cursor-pointer hover:text-gray-300 transition-colors" : ""
                }`}
              >
                {col.header}
                {sortKey === col.key && (
                  // Up/down arrow indicates direction. Gold accent so it
                  // pops against the muted gray header text.
                  <span className="text-[var(--color-accent-gold)] ml-1">
                    {sortDir === "asc" ? "↑" : "↓"}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((item) => (
            <tr
              key={keyExtractor(item)}
              // Same opt-in pattern as headers: only wire the click + hover
              // styles when the caller actually wants row interaction.
              onClick={onRowClick ? () => onRowClick(item) : undefined}
              className={`border-b border-[var(--color-navy-600)]/30 transition-colors ${
                onRowClick
                  ? "cursor-pointer hover:bg-[var(--color-navy-600)]/40"
                  : ""
              }`}
            >
              {columns.map((col) => (
                <td key={col.key} className="px-3 py-3">
                  {col.render(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
