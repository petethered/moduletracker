/**
 * Modules.tsx — "Modules" tab page wrapper.
 *
 * Role:
 *   - Thin layout shell rendered by App.tsx when activeTab === "modules".
 *   - Owns the section heading; ModuleTable does all the real work.
 *
 * User flow it supports:
 *   - User opens the "Modules" tab to see per-module progress: how many
 *     copies pulled, % share of total epics, last pulled date, and the
 *     player-asserted current rarity tier.
 *
 * Why split into two files:
 *   - Same rationale as History.tsx — leaves headroom for future page-level
 *     filters/sort/group controls without bloating ModuleTable.
 */
import { ModuleTable } from "./ModuleTable";

export function Modules() {
  return (
    <div>
      {/* Page heading — matches the gold/display-font treatment used on every tab. */}
      <h2 className="text-lg text-[var(--color-accent-gold)]/80 mb-6" style={{ fontFamily: "var(--font-display)", fontWeight: 600, letterSpacing: "0.06em" }}>Module Collection</h2>
      <ModuleTable />
    </div>
  );
}
