/**
 * ModuleDistributionChart — donut chart of epic+ pulls bucketed by module TYPE.
 *
 * Derived stat: per-type pull count, where the bucketing key is the module's
 * `type` field (cannon/armor/generator/core). Each row in the dataset
 * represents one module type and its total pull count across all pulls.
 *
 * Game-mechanic context:
 *   The Tower has 4 module categories. Each pull that yields an epic+
 *   resolves to a specific module within one of these 4 types. Players
 *   often want to know "am I getting balanced drops across my build, or
 *   am I cannon-flooded with no armor?" — that's what this chart answers.
 *
 * Why donut not pie: inner radius (35) creates a hole that visually
 * de-emphasizes the absolute volume and emphasizes proportions, which is
 * the actual question being asked.
 *
 * NOTE: Only counts modules whose pulls were logged. If a player has 0
 * pulls of a given type, that type is filtered OUT entirely — no zero
 * slices in the legend (would clutter and not be informative).
 */
import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useStore } from "../../store";
import { selectModulePullCounts } from "../../store/selectors";
import { MODULES } from "../../config/modules";
import {
  MODULE_TYPE_COLORS,
  MODULE_TYPE_LABELS,
  MODULE_TYPE_ORDER,
} from "../../config/moduleTypes";
import type { ModuleType } from "../../types";
import { useRenderLog } from "../../utils/renderLog";
import { SectionHeading } from "../../components/ui/SectionHeading";
import { CHART_TOOLTIP_STYLE } from "../../config/runtimeColors";
import { formatPercent } from "../../utils/formatNumber";

// Palette and labels come from src/config/moduleTypes.ts — see that file for
// why the type palette is muted. Imported as TS constants rather than the
// Tailwind/CSS route because Recharts needs a literal string for `fill`.

export function ModuleDistributionChart() {
  const pulls = useStore((s) => s.pulls);
  useRenderLog("ModuleDistributionChart", { pullsLen: pulls.length });

  // Aggregate: module-id counts -> type counts.
  // selectModulePullCounts returns Record<moduleId, count>; we re-bucket
  // those counts into the 4 TYPE bins by looking up each module's type
  // from the MODULES config. This keeps the selector type-agnostic and
  // lets the chart own its bucketing strategy.
  const { data, total } = useMemo(() => {
    const counts = selectModulePullCounts(pulls);
    const typeCounts: Record<ModuleType, number> = {
      cannon: 0,
      armor: 0,
      generator: 0,
      core: 0,
    };
    for (const m of MODULES) {
      typeCounts[m.type] += counts[m.id] || 0;
    }
    // Filter out zero-count types so the donut isn't cluttered with
    // empty slices and the legend stays focused on what the player has.
    //
    // Iterating MODULE_TYPE_ORDER rather than Object.entries(typeCounts) keeps
    // the key narrowed to ModuleType (Object.entries widens to string, which
    // can't index a Record<ModuleType, ...>) and makes slice order an explicit
    // shared decision. The resulting order is unchanged — it previously
    // matched by accident, via the object literal's insertion order.
    const entries = MODULE_TYPE_ORDER.filter((type) => typeCounts[type] > 0).map(
      (type) => ({
        name: MODULE_TYPE_LABELS[type],
        value: typeCounts[type],
        color: MODULE_TYPE_COLORS[type],
      })
    );
    return {
      data: entries,
      // Total for percentage math in tooltip + sidebar legend. Computed
      // once here instead of recomputing inside each render path.
      total: entries.reduce((sum, d) => sum + d.value, 0),
    };
  }, [pulls]);

  // Hide the entire card when no data — empty donut + empty legend is worse than nothing.
  if (data.length === 0) return null;

  return (
    <div data-testid="module-distribution-chart">
      <SectionHeading>
        Epic Pulls by Type
      </SectionHeading>
      <div className="flex items-center gap-6">
        {/* Fixed 160x160 — small donut beside its custom legend. ResponsiveContainer */}
        {/* still used for SVG sizing/aspect, even though dimensions are fixed. */}
        <ResponsiveContainer width={160} height={160}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              cx="50%"
              cy="50%"
              outerRadius={70}   // outer ring of donut
              innerRadius={35}   // hole — makes it a donut not a pie. ~50% ratio looks balanced.
              strokeWidth={0}    // no inter-slice borders; colors are distinct enough
            >
              {/* Cell-per-entry to apply per-slice colors. Recharts default uses */}
              {/* its own palette — we override with MODULE_TYPE_COLORS for theme fit. */}
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                ...CHART_TOOLTIP_STYLE,
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              // Tooltip shows raw count + percentage. `value` is always number here
              // (pie slice values), but Recharts' types are loose so we use any.
              formatter={(value: any, name: any) => {
                const pct = total > 0 ? (value / total) * 100 : 0;
                return [`${value} (${formatPercent(pct)})`, name];
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Custom inline legend — Recharts' built-in <Legend> is too rigid for */}
        {/* this layout. Each row: color swatch + label + count + percentage. */}
        <div className="space-y-3 text-sm">
          {data.map((d) => (
            <div key={d.name} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: d.color }}
              />
              <span className="text-gray-300 w-20">{d.name}</span>
              <span className="text-white font-medium">{d.value}</span>
              <span className="text-gray-400">
                ({formatPercent(total > 0 ? (d.value / total) * 100 : 0)})
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
