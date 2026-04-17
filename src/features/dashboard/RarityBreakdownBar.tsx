import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useStore } from "../../store";
import { selectRarityPercentages, selectRarityCounts } from "../../store/selectors";
import { RARITY_COLORS } from "../../config/rarityColors";
import { useRenderLog } from "../../utils/renderLog";

export function RarityBreakdownBar() {
  const pulls = useStore((s) => s.pulls);
  useRenderLog("RarityBreakdownBar", { pullsLen: pulls.length });

  const data = useMemo(() => {
    const pcts = selectRarityPercentages(pulls);
    const counts = selectRarityCounts(pulls);
    return [
      { name: "Common", value: counts.common, color: RARITY_COLORS.common, pct: pcts.common },
      { name: "Rare", value: counts.rare, color: RARITY_COLORS.rare, pct: pcts.rare },
      { name: "Epic", value: counts.epic, color: RARITY_COLORS.epic, pct: pcts.epic },
    ].filter((d) => d.value > 0);
  }, [pulls]);

  if (pulls.length === 0) return null;

  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width={140} height={140}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            cx="50%"
            cy="50%"
            outerRadius={60}
            innerRadius={30}
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any) => {
              const entry = data.find((d: any) => d.name === name);
              return [`${entry?.pct.toFixed(1)}% (${value})`, name];
            }}
          />
        </PieChart>
      </ResponsiveContainer>
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
