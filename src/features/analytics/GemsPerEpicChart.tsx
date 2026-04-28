/**
 * GemsPerEpicChart — time-series trend of gem efficiency per epic pull.
 *
 * Derived stat: cumulative gems-spent / cumulative epics-pulled, computed at
 * each pull-event point. A lower number = better luck (fewer gems per epic).
 *
 * Game-mechanic context:
 *   In The Tower, every gacha pull costs gems. Epic+ rarities are the only
 *   "useful" outcomes for module progression — commons/rares are filler.
 *   The expected (mean) gems-per-epic given the published pull rate of ~2.5%
 *   epic-or-better and standard pull cost is ~8000. The red ReferenceLine at
 *   y=8000 is the player's break-even / "average luck" benchmark.
 *
 * How to read it:
 *   - Line below 8000 = running luckier than expected
 *   - Line above 8000 = running worse than expected
 *   - Long-run regression toward 8000 = law of large numbers in action
 *
 * This is the cumulative metric, not a rolling window — early variance is
 * dramatic and stabilizes as pull count grows. That's intentional.
 */
import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { useStore } from "../../store";
import { selectGemsPerEpicOverTime } from "../../store/selectors";
import { useRenderLog } from "../../utils/renderLog";

export function GemsPerEpicChart() {
  const pulls = useStore((s) => s.pulls);
  // Selector returns one row per pull-event-day with cumulative gemsPerEpic.
  // We attach a synthetic `idx` so XAxis can use a stable integer dataKey
  // even when dates collide or are sparse — categorical date strings would
  // either compress unevenly or duplicate ticks.
  const data = useMemo(() => {
    const raw = selectGemsPerEpicOverTime(pulls);
    return raw.map((d, i) => ({ ...d, idx: i }));
  }, [pulls]);
  useRenderLog("GemsPerEpicChart", { pullsLen: pulls.length, dataLen: data.length });

  // Need at least 2 points to draw a line. A single point would render only a dot.
  if (data.length < 2) return null;
  // Tick formatter: render "M/D" instead of full ISO date to keep axis dense
  // but legible. Strips leading zeros via parseInt (e.g. "04" -> "4").
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
          {/* Dark grid (#1a1a2e) — near-invisible against the navy theme but */}
          {/* still gives the eye a reference for tick alignment. */}
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
          {/* Use idx (integer) as dataKey, format to date string. See comment above. */}
          <XAxis dataKey="idx" tick={{ fill: "#6b7280", fontSize: 11 }} tickFormatter={formatTick} />
          {/* Y axis: no explicit domain — Recharts auto-fits. Auto-fit is correct */}
          {/* here because the 8000 reference line will always be in view as long as */}
          {/* the player's data straddles it, which is the interesting case. */}
          <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: "#16213e", border: "1px solid #0f3460", borderRadius: 8 }}
            labelStyle={{ color: "#ffd700" }} // gold accent for hovered date label
            // Tooltip header shows the real ISO date even though XAxis shows M/D.
            labelFormatter={(idx: unknown) => data[Number(idx)]?.date ?? ""}
            // 3 decimal places: gems/epic values are 4-5 digits; trim noise.
            formatter={(value?: number | string | readonly (number | string)[]) => [Number(Number(value).toFixed(3)), "Gems/Epic"]}
            isAnimationActive={false} // animation causes tooltip flicker on dense data
          />
          {/* Expected-value reference line at 8000 gems/epic. Red dashed = "warning */}
          {/* threshold" semantics: above this line = unlucky run. See top-of-file math. */}
          <ReferenceLine y={8000} stroke="#ef4444" strokeDasharray="5 5" label={{ value: "Expected 8000", fill: "#ef4444", fontSize: 10 }} />
          {/* Yellow/gold (#eab308) line — semantic match for "gems" theme. */}
          {/* monotone curve smooths between sparse points without overshoot. */}
          <Line type="monotone" dataKey="gemsPerEpic" stroke="#eab308" strokeWidth={2} dot={{ fill: "#eab308", r: 3 }} name="Gems/Epic" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
