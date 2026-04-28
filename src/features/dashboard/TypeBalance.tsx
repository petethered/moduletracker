/**
 * TypeBalance.tsx
 *
 * Role: Dashboard card showing how the user's *epic pulls* are distributed
 * across the four module types (cannon / armor / generator / core). Renders
 * as a stacked horizontal bar with a 2-column legend below it.
 *
 * Game-domain concept:
 *   In The Tower, each loadout slot wants epics of a specific type. RNG
 *   rarely distributes pulls evenly — players often end up "armor-rich,
 *   core-poor" or vice versa. This card surfaces that imbalance so the user
 *   can decide whether to spend gems on a different banner / event focused
 *   on the under-represented type.
 *
 * Selectors consumed:
 *   - `selectModulePullCounts(pulls)` — { [moduleId]: count }, then we sum
 *     counts by *type* via the static MODULES config.
 *
 * Why module-by-module roll-up (instead of a dedicated "byType" selector):
 *   Module type is a static property of each module, so this aggregation is
 *   trivial and not worth a dedicated selector + memoization layer. If more
 *   views need per-type counts, hoist this up.
 *
 * Why early-return on `total === 0`:
 *   An empty stacked bar is meaningless and would render as zero-width. The
 *   adjacent PullCalendar / RecentPullsList already handle the new-user
 *   empty state, so we just hide this card entirely.
 */

import { useMemo } from "react";
import { useStore } from "../../store";
import { selectModulePullCounts } from "../../store/selectors";
import { MODULES } from "../../config/modules";
import type { ModuleType } from "../../types";
import { useRenderLog } from "../../utils/renderLog";

// Same type-accent palette used across the dashboard. If colors change,
// also update PullHighlights and ModuleCollectionGrid.
const TYPE_COLORS: Record<ModuleType, string> = {
  cannon: "#e94560",
  armor: "#3b82f6",
  generator: "#eab308",
  core: "#a855f7",
};

// Display order matches the rest of the dashboard for consistency.
const TYPE_ORDER: ModuleType[] = ["cannon", "armor", "generator", "core"];

export function TypeBalance() {
  const pulls = useStore((s) => s.pulls);
  useRenderLog("TypeBalance", { pullsLen: pulls.length });

  // Aggregate epic-pull counts by type. We initialize all four types to 0 so
  // the legend always shows every type even if some are missing — important
  // because a 0 in this view IS the headline ("you've never pulled a core").
  const { typeCounts, total } = useMemo(() => {
    const counts = selectModulePullCounts(pulls);
    const tCounts: Record<ModuleType, number> = {
      cannon: 0,
      armor: 0,
      generator: 0,
      core: 0,
    };
    // Walk MODULES (static) rather than counts (dynamic) so unknown ids in
    // pull data don't poison the totals.
    for (const mod of MODULES) {
      tCounts[mod.type] += counts[mod.id] || 0;
    }
    return {
      typeCounts: tCounts,
      // Total is recomputed here (rather than reused from a global selector)
      // because we specifically want the *roster-recognised* total — must
      // match the sum of typeCounts so percentages add to 100%.
      total: TYPE_ORDER.reduce((sum, t) => sum + tCounts[t], 0),
    };
  }, [pulls]);

  // Hide for new users — see top-of-file note.
  if (total === 0) return null;

  return (
    <div
      style={{
        backgroundColor: "var(--color-navy-800)",
        borderRadius: 12,
        padding: 16,
        border: "1px solid var(--color-navy-500)",
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>
        Type Balance
        {/* Subtitle clarifies that this is *epic* pulls only — common/rare
            pulls aren't tracked per-module so they can't be type-bucketed. */}
        <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 400, marginLeft: 8 }}>
          epic pulls by type
        </span>
      </div>

      {/* Stacked bar.
          Each segment's width is its share of `total`. A 1px gap between
          segments (`gap: 1`) provides visual separation without needing
          inner borders that would muddy the colors. We filter zero-count
          types out of the bar so empty segments don't render at all (they
          still appear in the legend below as "0 (0%)" so the user sees them). */}
      <div
        style={{
          display: "flex",
          height: 18,
          borderRadius: 6,
          overflow: "hidden",
          marginBottom: 12,
          gap: 1,
        }}
      >
        {TYPE_ORDER.filter((t) => typeCounts[t] > 0).map((type) => {
          const pct = (typeCounts[type] / total) * 100;
          return (
            <div
              key={type}
              // Native tooltip — fine here because the legend already shows
              // exact counts; the tooltip is for users who hover the bar.
              title={`${type}: ${typeCounts[type]} (${pct.toFixed(1)}%)`}
              style={{
                width: `${pct}%`,
                backgroundColor: TYPE_COLORS[type],
                transition: "width 0.3s ease",
              }}
            />
          );
        })}
      </div>

      {/* Legend.
          2-column grid so all four types fit compactly without wrapping
          unpredictably. Always renders all four types (no filter) so a
          zero-count type is still visible — that's the most important
          information ("which type am I missing?"). */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: "6px 12px",
        }}
      >
        {TYPE_ORDER.map((type) => {
          const count = typeCounts[type];
          // Guard against div-by-zero defensively — total>0 by this point
          // (early-return above) but the conditional protects against future
          // refactors removing the guard.
          const pct = total > 0 ? (count / total) * 100 : 0;
          return (
            <div
              key={type}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {/* Color swatch — same color as the bar segment for that type. */}
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  backgroundColor: TYPE_COLORS[type],
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    textTransform: "capitalize",
                    color: TYPE_COLORS[type],
                  }}
                >
                  {type}
                </span>
                <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 6 }}>
                  {count} ({pct.toFixed(1)}%)
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
