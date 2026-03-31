import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useStore } from "../../store";
import { selectModulePullCounts } from "../../store/selectors";
import { MODULES } from "../../config/modules";

export function ModuleDistributionChart() {
  const pulls = useStore((s) => s.pulls);
  const counts = selectModulePullCounts(pulls);

  const data = MODULES.map((m) => ({
    name: m.name,
    count: counts[m.id] || 0,
    type: m.type,
  })).filter((d) => d.count > 0);

  if (data.length === 0) return null;

  return (
    <div data-testid="module-distribution-chart">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
        Module Pull Distribution
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
          <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 11 }} />
          <YAxis type="category" dataKey="name" tick={{ fill: "#6b7280", fontSize: 10 }} width={150} />
          <Tooltip
            contentStyle={{ backgroundColor: "#16213e", border: "1px solid #0f3460", borderRadius: 8 }}
            labelStyle={{ color: "#ffd700" }}
          />
          <Bar dataKey="count" fill="#a855f7" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
