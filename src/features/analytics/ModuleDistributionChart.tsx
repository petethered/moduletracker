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
import { useRenderLog } from "../../utils/renderLog";

// Per-type colors. Chosen for distinctness on the dark navy background AND
// for thematic match: cannon=red (offensive/firepower), armor=blue (defense),
// generator=yellow (energy/electric), core=purple (special/unique).
// These do NOT match rarity colors — those are reserved for rarity displays.
const TYPE_COLORS: Record<string, string> = {
  cannon: "#e94560",   // crimson — offensive
  armor: "#3b82f6",    // blue   — defensive
  generator: "#eab308", // gold  — energy
  core: "#a855f7",     // purple — special
};

// Human-readable labels for legend/tooltip. Kept separate from TYPE_COLORS
// so future agents can change one without diff-touching the other.
const TYPE_LABELS: Record<string, string> = {
  cannon: "Cannon",
  armor: "Armor",
  generator: "Generator",
  core: "Core",
};

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
    const typeCounts: Record<string, number> = { cannon: 0, armor: 0, generator: 0, core: 0 };
    for (const m of MODULES) {
      typeCounts[m.type] += counts[m.id] || 0;
    }
    // Filter out zero-count types so the donut isn't cluttered with
    // empty slices and the legend stays focused on what the player has.
    const entries = Object.entries(typeCounts)
      .filter(([, count]) => count > 0)
      .map(([type, count]) => ({
        name: TYPE_LABELS[type],
        value: count,
        color: TYPE_COLORS[type],
      }));
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
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
        Epic Pulls by Type
      </h3>
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
              {/* its own palette — we override with TYPE_COLORS for theme fit. */}
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
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              // Tooltip shows raw count + percentage. `value` is always number here
              // (pie slice values), but Recharts' types are loose so we use any.
              formatter={(value: any, name: any) => {
                const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0";
                return [`${value} (${pct}%)`, name];
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
              <span className="text-gray-500">
                ({total > 0 ? ((d.value / total) * 100).toFixed(1) : "0"}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
