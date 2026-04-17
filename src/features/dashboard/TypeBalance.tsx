import { useMemo } from "react";
import { useStore } from "../../store";
import { selectModulePullCounts } from "../../store/selectors";
import { MODULES } from "../../config/modules";
import type { ModuleType } from "../../types";
import { useRenderLog } from "../../utils/renderLog";

const TYPE_COLORS: Record<ModuleType, string> = {
  cannon: "#e94560",
  armor: "#3b82f6",
  generator: "#eab308",
  core: "#a855f7",
};

const TYPE_ORDER: ModuleType[] = ["cannon", "armor", "generator", "core"];

export function TypeBalance() {
  const pulls = useStore((s) => s.pulls);
  useRenderLog("TypeBalance", { pullsLen: pulls.length });

  const { typeCounts, total } = useMemo(() => {
    const counts = selectModulePullCounts(pulls);
    const tCounts: Record<ModuleType, number> = {
      cannon: 0,
      armor: 0,
      generator: 0,
      core: 0,
    };
    for (const mod of MODULES) {
      tCounts[mod.type] += counts[mod.id] || 0;
    }
    return {
      typeCounts: tCounts,
      total: TYPE_ORDER.reduce((sum, t) => sum + tCounts[t], 0),
    };
  }, [pulls]);

  if (total === 0) return null;

  return (
    <div
      style={{
        backgroundColor: "var(--color-navy-800)",
        borderRadius: 12,
        padding: 16,
        border: "1px solid var(--color-navy-500)",
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>
        Type Balance
        <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 400, marginLeft: 8 }}>
          epic pulls by type
        </span>
      </div>

      {/* Stacked bar */}
      <div
        style={{
          display: "flex",
          height: 18,
          borderRadius: 6,
          overflow: "hidden",
          marginBottom: 12,
          gap: 1,
        }}
      >
        {TYPE_ORDER.filter((t) => typeCounts[t] > 0).map((type) => {
          const pct = (typeCounts[type] / total) * 100;
          return (
            <div
              key={type}
              title={`${type}: ${typeCounts[type]} (${pct.toFixed(1)}%)`}
              style={{
                width: `${pct}%`,
                backgroundColor: TYPE_COLORS[type],
                transition: "width 0.3s ease",
              }}
            />
          );
        })}
      </div>

      {/* Labels */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: "6px 12px",
        }}
      >
        {TYPE_ORDER.map((type) => {
          const count = typeCounts[type];
          const pct = total > 0 ? (count / total) * 100 : 0;
          return (
            <div
              key={type}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  backgroundColor: TYPE_COLORS[type],
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    textTransform: "capitalize",
                    color: TYPE_COLORS[type],
                  }}
                >
                  {type}
                </span>
                <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 6 }}>
                  {count} ({pct.toFixed(1)}%)
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
