import { useStore } from "../../store";
import { MODULES } from "../../config/modules";
import { selectMergeProgress } from "../../store/selectors";

interface ProgressBarProps {
  label: string;
  value: number;
  max: number;
  color: string;
  modulesAt: number;
  totalModules: number;
}

function ProgressBar({ label, value, max, color, modulesAt, totalModules }: ProgressBarProps) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 12, color: "#9ca3af" }}>
          {value.toLocaleString()} / {max.toLocaleString()} copies
        </span>
      </div>
      <div
        style={{
          backgroundColor: "var(--color-navy-700)",
          borderRadius: 6,
          height: 10,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            backgroundColor: color,
            borderRadius: 6,
            transition: "width 0.3s ease",
          }}
        />
      </div>
      <div
        style={{
          fontSize: 11,
          color: "#9ca3af",
          marginTop: 4,
        }}
      >
        {modulesAt}/{totalModules} modules complete
      </div>
    </div>
  );
}

export function MergeProgressSummary() {
  const pulls = useStore((s) => s.pulls);
  const {
    copiesForAncestral,
    neededForAllAncestral,
    modulesAtAncestral,
    copiesFor5Star,
    neededForAll5Star,
    modulesAt5Star,
  } = selectMergeProgress(pulls, MODULES.length);

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
        Merge Progress
      </div>
      <ProgressBar
        label="All Ancestral"
        value={copiesForAncestral}
        max={neededForAllAncestral}
        color="#22c55e"
        modulesAt={modulesAtAncestral}
        totalModules={MODULES.length}
      />
      <ProgressBar
        label="All 5-Star"
        value={copiesFor5Star}
        max={neededForAll5Star}
        color="var(--color-accent-gold)"
        modulesAt={modulesAt5Star}
        totalModules={MODULES.length}
      />
    </div>
  );
}
