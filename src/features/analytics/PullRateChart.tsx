/**
 * PullRateChart — time-series of cumulative epic+ pull rate (percentage).
 *
 * Derived stat: (epic+ pulls / total pulls) * 100, computed cumulatively at
 * each pull-event point. Y-axis is percent.
 *
 * Game-mechanic context:
 *   The Tower's published epic-or-better drop rate is approximately 2.5%.
 *   Over a long pull history, the player's empirical rate should converge
 *   toward 2.5% by the law of large numbers. The red dashed ReferenceLine
 *   at y=2.5 marks this expected mean.
 *
 * How to read it:
 *   - Line above 2.5%  = running luckier than expected
 *   - Line below 2.5%  = running unluckier than expected
 *   - Line is volatile early (small denominator amplifies single drops),
 *     stabilizes as total pulls grow.
 *
 * This is the COMPLEMENT view to GemsPerEpicChart:
 *   - PullRateChart looks at drop frequency (probability)
 *   - GemsPerEpicChart looks at gem efficiency (cost-weighted probability)
 * Both should regress toward expected values over time, in opposite directions.
 */
import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { useStore } from "../../store";
import { selectEpicRateOverTime } from "../../store/selectors";
import { MODULE_RARITY_COLORS } from "../../config/moduleRarities";
import { ACCENT_GOLD, SIGNAL_WARNING } from "../../config/runtimeColors";
import { useRenderLog } from "../../utils/renderLog";
import { SectionHeading } from "../../components/ui/SectionHeading";
import { CHART_GRID, CHART_TOOLTIP_STYLE } from "../../config/runtimeColors";
import { formatPercent } from "../../utils/formatNumber";

export function PullRateChart() {
  const pulls = useStore((s) => s.pulls);
  // Selector returns one row per pull-event point with cumulative epic rate %.
  // Synthetic `idx` lets XAxis use a stable integer key — see GemsPerEpicChart
  // for the same pattern and rationale.
  const data = useMemo(() => {
    const raw = selectEpicRateOverTime(pulls);
    return raw.map((d, i) => ({ ...d, idx: i }));
  }, [pulls]);
  useRenderLog("PullRateChart", { pullsLen: pulls.length, dataLen: data.length });

  // Need >=2 points to render a meaningful line.
  if (data.length < 2) return null;
  // "M/D" tick formatter — strips ISO leading zeros for axis density.
  const formatTick = (idx: number) => {
    const d = data[idx];
    if (!d) return "";
    const [, m, day] = d.date.split("-");
    return `${parseInt(m)}/${parseInt(day)}`;
  };

  return (
    <div data-testid="pull-rate-chart">
      <SectionHeading>
        Epic Pull Rate Over Time
      </SectionHeading>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          {/* Grid stroke token; see runtimeColors.ts for why it is this faint. */}
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
          <XAxis dataKey="idx" tick={{ fill: "#6b7280", fontSize: 11 }} tickFormatter={formatTick} />
          {/* Y axis: domain locked to [0, auto] so 0% always anchors the bottom. */}
          {/* "auto" upper bound lets Recharts size to the data — values above */}
          {/* the 2.5% reference are interesting and need to be visible. */}
          {/* unit="%" appends the percent sign to tick labels automatically. */}
          <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} domain={[0, "auto"]} unit="%" />
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            labelStyle={{ color: ACCENT_GOLD }} // gold accent for hovered date
            labelFormatter={(idx: unknown) => data[Number(idx)]?.date ?? ""}
            // 2 decimals, matching the epic-rate convention in formatNumber.ts.
            // This used to be 3, which rendered "2.500%" in the tooltip directly
            // above a reference line labelled "Expected 2.5%".
            formatter={(value?: number | string | readonly (number | string)[]) => [formatPercent(Number(value), 2), "Epic Rate"]}
            isAnimationActive={false}
          />
          {/* Expected drop rate reference: 2.5%. See top-of-file game-mechanic context. */}
          {/* Red dashed = "this is the benchmark to compare against". */}
          <ReferenceLine y={2.5} stroke={SIGNAL_WARNING} strokeDasharray="5 5" label={{ value: "Expected 2.5%", fill: SIGNAL_WARNING, fontSize: 10 }} />
          {/* Purple line = the epic rarity color, because this chart is */}
          {/* specifically about EPIC pull frequency. Imported rather than */}
          {/* hardcoded: the hex used to be inlined here and silently drifted */}
          {/* out of sync when the rarity palette moved to the -400 band. */}
          {/* monotone curve smooths between sparse points without overshoot. */}
          <Line type="monotone" dataKey="rate" stroke={MODULE_RARITY_COLORS.epic} strokeWidth={2} dot={{ fill: MODULE_RARITY_COLORS.epic, r: 3 }} name="Epic Rate %" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
