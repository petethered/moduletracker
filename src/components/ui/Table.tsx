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
 * screen readers and column-by-column nav work. Sortable columns render a real
 * `<button>` INSIDE the `<th>`, which gets focus, Enter/Space activation and
 * the right role for free; the `<th>` carries `aria-sort` to announce current
 * state. Do not move the click handler back onto the `<th>` itself — a bare
 * `<th>` is not focusable, which made sorting keyboard-unreachable.
 *
 * There is deliberately NO row-click affordance. An earlier `onRowClick` prop
 * existed but had no caller: the one consumer (PullHistoryTable) uses explicit
 * per-row Edit/Delete buttons instead, which is the better pattern here
 * because a row carries two distinct actions. If you ever need a drill-down
 * row, put a real `<button>` in the first cell rather than making the `<tr>`
 * clickable — a `<tr>` has no activation behaviour and faking one with
 * tabIndex/role fights the table's own semantics.
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
  /** Shown in place of the table when `data` is empty. Default `"No data"`. */
  emptyMessage?: string;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
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
      <div className="text-center text-gray-400 py-16" style={{ fontFamily: "var(--font-body)" }}>
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
            {columns.map((col) => {
              const isSorted = sortKey === col.key;
              return (
                <th
                  key={col.key}
                  // aria-sort is what actually communicates sort state to a
                  // screen reader. The ↑/↓ glyph below is a purely visual
                  // affordance and is hidden from the a11y tree.
                  // Non-sortable columns get no aria-sort at all (rather than
                  // "none", which would imply they are sortable but unsorted).
                  aria-sort={
                    col.sortable
                      ? isSorted
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                      : undefined
                  }
                  className="px-3 py-3 text-left text-[10px] uppercase tracking-[0.15em] text-gray-400 font-medium"
                >
                  {col.sortable ? (
                    // A REAL <button> inside the <th>, rather than onClick on
                    // the <th> itself. The old version was mouse-only: a bare
                    // th is not focusable, so sorting was unreachable by
                    // keyboard entirely. Using a native button gets focus,
                    // Enter/Space activation, and the correct role for free —
                    // no manual tabIndex/onKeyDown plumbing to get wrong.
                    <button
                      type="button"
                      onClick={() => handleSort(col.key)}
                      className="inline-flex items-center gap-1 uppercase tracking-[0.15em] font-medium cursor-pointer hover:text-gray-200 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-gold)] rounded-lg"
                    >
                      {col.header}
                      {isSorted && (
                        // aria-hidden: aria-sort on the <th> already conveys
                        // this. Announcing "up arrow" would be noise.
                        <span
                          aria-hidden="true"
                          className="text-[var(--color-accent-gold)]"
                        >
                          {sortDir === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((item) => (
            <tr
              key={keyExtractor(item)}
              className="border-b border-[var(--color-navy-600)]/30"
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
