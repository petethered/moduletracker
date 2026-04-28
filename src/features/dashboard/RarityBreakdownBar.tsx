/**
 * RarityBreakdownBar.tsx
 *
 * Role: Dashboard donut chart + legend showing what fraction of all pulls
 * resolved to common, rare, and epic rarity. Sits in the second column of
 * the dashboard's "activity" row, paired with RecentPullsList.
 *
 * Game-domain concept:
 *   Each 10x pull yields 10 individual modules of varying rarity. The Tower's
 *   advertised rates put epics around 2.5%, but real rolls drift around that
 *   number. This donut is the most direct visualization of "is my luck
 *   matching expectations?" — paired with the "Epic Rate" KPI in StatCardGrid
 *   which shows the same data as a single percentage.
 *
 * Selectors consumed:
 *   - `selectRarityCounts(pulls)`      — raw counts per rarity tier
 *   - `selectRarityPercentages(pulls)` — percentages per rarity tier
 *
 * Why both selectors: the tooltip needs both ("12.3% (45)") and the legend
 * shows percent + raw. We could derive one from the other but going through
 * the selectors keeps the math centralized and tested.
 *
 * Why filter zero-value slices: Recharts will render a degenerate slice for
 * a 0% segment which appears as a hairline in the donut. Filtering keeps
 * the donut clean for new users who haven't pulled any rares/epics yet.
 */

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useStore } from "../../store";
import { selectRarityPercentages, selectRarityCounts } from "../../store/selectors";
import { RARITY_COLORS } from "../../config/rarityColors";
import { useRenderLog } from "../../utils/renderLog";

export function RarityBreakdownBar() {
  const pulls = useStore((s) => s.pulls);
  useRenderLog("RarityBreakdownBar", { pullsLen: pulls.length });

  // Build the chart data once per pulls change. Each entry carries:
  //   - name : human label for the legend / tooltip
  //   - value: raw count (drives the slice angle)
  //   - color: rarity-specific color from the global palette
  //   - pct  : pre-computed percentage (used in tooltip + legend)
  // We exclude rarities with zero pulls so the donut has clean segments.
  const data = useMemo(() => {
    const pcts = selectRarityPercentages(pulls);
    const counts = selectRarityCounts(pulls);
    return [
      { name: "Common", value: counts.common, color: RARITY_COLORS.common, pct: pcts.common },
      { name: "Rare", value: counts.rare, color: RARITY_COLORS.rare, pct: pcts.rare },
      { name: "Epic", value: counts.epic, color: RARITY_COLORS.epic, pct: pcts.epic },
    ].filter((d) => d.value > 0);
  }, [pulls]);

  // Hide the entire card for empty state — RecentPullsList already shows the
  // "click Add 10x Pull to get started" copy in the adjacent column, so a
  // duplicate empty state here would be noise.
  if (pulls.length === 0) return null;

  return (
    <div className="flex items-center gap-4">
      {/* Fixed 140x140 donut. Inner radius 30 / outer 60 = a chunky ring
          that reads at small sizes without looking like a pie. */}
      <ResponsiveContainer width={140} height={140}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            cx="50%"
            cy="50%"
            outerRadius={60}
            innerRadius={30}
            // strokeWidth: 0 because Recharts' default white stroke creates
            // gaps between slices that look broken on the dark background.
            strokeWidth={0}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "#16213e",
              border: "1px solid #0f3460",
              borderRadius: 8,
            }}
            // Custom formatter so the tooltip shows "12.3% (45) Epic" instead
            // of Recharts' default "Epic: 45". Looks up the matching entry by
            // name to avoid recalculating the percentage here.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any) => {
              const entry = data.find((d: any) => d.name === name);
              return [`${entry?.pct.toFixed(1)}% (${value})`, name];
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      {/* Legend column to the right of the donut. Mirrors slice order
          (filtered, so no zero rows). One row per rarity:
            [color dot] [name] [pct] [(raw count)] */}
      <div className="space-y-2 text-sm">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: d.color }}
            />
            <span className="text-gray-300">{d.name}</span>
            <span className="text-gray-500">{d.pct.toFixed(1)}%</span>
            <span className="text-gray-600">({d.value})</span>
          </div>
        ))}
      </div>
    </div>
  );
}
