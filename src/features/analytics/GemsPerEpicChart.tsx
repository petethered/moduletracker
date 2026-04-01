import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { useStore } from "../../store";
import { selectGemsPerEpicOverTime } from "../../store/selectors";

export function GemsPerEpicChart() {
  const pulls = useStore((s) => s.pulls);
  const raw = selectGemsPerEpicOverTime(pulls);

  if (raw.length < 2) return null;

  const data = raw.map((d, i) => ({ ...d, idx: i }));
  const formatTick = (idx: number) => {
    const d = data[idx];
    if (!d) return "";
    const [, m, day] = d.date.split("-");
    return `${parseInt(m)}/${parseInt(day)}`;
  };

  return (
    <div data-testid="gems-per-epic-chart">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
        Gems per Epic Over Time
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
          <XAxis dataKey="idx" tick={{ fill: "#6b7280", fontSize: 11 }} tickFormatter={formatTick} />
          <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: "#16213e", border: "1px solid #0f3460", borderRadius: 8 }}
            labelStyle={{ color: "#ffd700" }}
            labelFormatter={(idx: unknown) => data[Number(idx)]?.date ?? ""}
            formatter={(value?: number | string | readonly (number | string)[]) => [Number(Number(value).toFixed(3)), "Gems/Epic"]}
            isAnimationActive={false}
          />
          <ReferenceLine y={8000} stroke="#ef4444" strokeDasharray="5 5" label={{ value: "Expected 8000", fill: "#ef4444", fontSize: 10 }} />
          <Line type="monotone" dataKey="gemsPerEpic" stroke="#eab308" strokeWidth={2} dot={{ fill: "#eab308", r: 3 }} name="Gems/Epic" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
