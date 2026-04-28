/**
 * History.tsx — "History" tab page wrapper.
 *
 * Role:
 *   - Thin layout shell rendered by App.tsx when activeTab === "history".
 *   - Owns the section heading; delegates all data + interaction to
 *     PullHistoryTable (which is the actual table + edit/delete affordances).
 *
 * User flow it supports:
 *   - User taps the "History" tab to see every recorded 10x pull in reverse
 *     chronological order, with inline Edit / Delete actions per row.
 *
 * Why split into two files:
 *   - Keeps the page-level heading + future header chrome (filters, export,
 *     etc.) separate from the table mechanics. If you add toolbar controls,
 *     they belong here, not inside PullHistoryTable.
 */
import { PullHistoryTable } from "./PullHistoryTable";

export function History() {
  return (
    <div>
      {/* Page heading — matches the gold/display-font treatment used on every tab. */}
      <h2 className="text-lg text-[var(--color-accent-gold)]/80 mb-6" style={{ fontFamily: "var(--font-display)", fontWeight: 600, letterSpacing: "0.06em" }}>Pull History</h2>
      <PullHistoryTable />
    </div>
  );
}
