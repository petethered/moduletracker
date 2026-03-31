import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useStore } from "../../store";
import { selectModulePullCounts } from "../../store/selectors";
import { MODULES } from "../../config/modules";

const TYPE_COLORS: Record<string, string> = {
  cannon: "#e94560",
  armor: "#3b82f6",
  generator: "#eab308",
  core: "#a855f7",
};

const TYPE_LABELS: Record<string, string> = {
  cannon: "Cannon",
  armor: "Armor",
  generator: "Generator",
  core: "Core",
};

export function ModuleDistributionChart() {
  const pulls = useStore((s) => s.pulls);
  const counts = selectModulePullCounts(pulls);

  const typeCounts: Record<string, number> = { cannon: 0, armor: 0, generator: 0, core: 0 };
  for (const m of MODULES) {
    typeCounts[m.type] += counts[m.id] || 0;
  }

  const data = Object.entries(typeCounts)
    .filter(([, count]) => count > 0)
    .map(([type, count]) => ({
      name: TYPE_LABELS[type],
      value: count,
      color: TYPE_COLORS[type],
    }));

  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (data.length === 0) return null;

  return (
    <div data-testid="module-distribution-chart">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
        Epic Pulls by Type
      </h3>
      <div className="flex items-center gap-6">
        <ResponsiveContainer width={160} height={160}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              cx="50%"
              cy="50%"
              outerRadius={70}
              innerRadius={35}
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
                const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0";
                return [`${value} (${pct}%)`, name];
              }}
            />
          </PieChart>
        </ResponsiveContainer>
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
