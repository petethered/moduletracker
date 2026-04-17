import { useMemo } from "react";
import { useStore } from "../../store";
import { selectModulePullCounts } from "../../store/selectors";
import { MODULE_BY_ID, MODULES } from "../../config/modules";
import { useRenderLog } from "../../utils/renderLog";

const TYPE_COLORS: Record<string, string> = {
  cannon: "#e94560",
  armor: "#3b82f6",
  generator: "#eab308",
  core: "#a855f7",
};

const EPIC_MODULE_IDS = new Set(MODULES.map((m) => m.id));

export function PullHighlights() {
  const pulls = useStore((s) => s.pulls);
  useRenderLog("PullHighlights", { pullsLen: pulls.length });

  const epicEntries = useMemo(() => {
    const counts = selectModulePullCounts(pulls);
    const entries = Object.entries(counts).filter(([id]) =>
      EPIC_MODULE_IDS.has(id)
    );
    entries.sort((a, b) => b[1] - a[1]);
    return entries;
  }, [pulls]);

  if (epicEntries.length === 0) return null;

  const [mostId, mostCount] = epicEntries[0];
  const [leastId, leastCount] = epicEntries[epicEntries.length - 1];

  const mostModule = MODULE_BY_ID[mostId];
  const leastModule = MODULE_BY_ID[leastId];

  if (!mostModule || !leastModule) return null;

  return (
    <div
      style={{
        backgroundColor: "var(--color-navy-800)",
        borderRadius: 12,
        padding: 16,
        border: "1px solid var(--color-navy-500)",
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>
        Pull Highlights
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <HighlightRow
          label="Most Pulled"
          module={mostModule}
          count={mostCount}
          color={TYPE_COLORS[mostModule.type] || "#9ca3af"}
        />
        <HighlightRow
          label="Least Pulled"
          module={leastModule}
          count={leastCount}
          color={TYPE_COLORS[leastModule.type] || "#9ca3af"}
        />
      </div>
    </div>
  );
}

interface HighlightRowProps {
  label: string;
  module: { name: string; type: string };
  count: number;
  color: string;
}

function HighlightRow({ label, module, count, color }: HighlightRowProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        backgroundColor: "var(--color-navy-700)",
        borderRadius: 8,
        borderLeft: `3px solid ${color}`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            color: "#9ca3af",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: 2,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "#e5e7eb",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {module.name}
        </div>
        <div style={{ fontSize: 11, color }}>
          {module.type}
        </div>
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          color,
          minWidth: 32,
          textAlign: "right",
        }}
      >
        {count}x
      </div>
    </div>
  );
}
