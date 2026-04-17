import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { useStore } from "../../store";
import { selectEpicRateOverTime } from "../../store/selectors";
import { useRenderLog } from "../../utils/renderLog";

export function PullRateChart() {
  const pulls = useStore((s) => s.pulls);
  const data = useMemo(() => {
    const raw = selectEpicRateOverTime(pulls);
    return raw.map((d, i) => ({ ...d, idx: i }));
  }, [pulls]);
  useRenderLog("PullRateChart", { pullsLen: pulls.length, dataLen: data.length });

  if (data.length < 2) return null;
  const formatTick = (idx: number) => {
    const d = data[idx];
    if (!d) return "";
    const [, m, day] = d.date.split("-");
    return `${parseInt(m)}/${parseInt(day)}`;
  };

  return (
    <div data-testid="pull-rate-chart">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
        Epic Pull Rate Over Time
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
          <XAxis dataKey="idx" tick={{ fill: "#6b7280", fontSize: 11 }} tickFormatter={formatTick} />
          <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} domain={[0, "auto"]} unit="%" />
          <Tooltip
            contentStyle={{ backgroundColor: "#16213e", border: "1px solid #0f3460", borderRadius: 8 }}
            labelStyle={{ color: "#ffd700" }}
            labelFormatter={(idx: unknown) => data[Number(idx)]?.date ?? ""}
            formatter={(value?: number | string | readonly (number | string)[]) => [`${Number(value).toFixed(3)}%`, "Epic Rate"]}
            isAnimationActive={false}
          />
          <ReferenceLine y={2.5} stroke="#ef4444" strokeDasharray="5 5" label={{ value: "Expected 2.5%", fill: "#ef4444", fontSize: 10 }} />
          <Line type="monotone" dataKey="rate" stroke="#a855f7" strokeWidth={2} dot={{ fill: "#a855f7", r: 3 }} name="Epic Rate %" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
