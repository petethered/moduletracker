/**
 * PullHighlights.tsx
 *
 * Role: Dashboard "superlatives" card — surfaces the user's most-pulled and
 * least-pulled epic modules. Two rows, each showing the module name, its
 * type, and a big count.
 *
 * Game-domain concept ("highlight"):
 *   With ~24 epic modules in the roster, RNG creates obvious favorites and
 *   neglected ones. Players love seeing which module they've over-pulled
 *   (the "you got 17 of these" reveal) and feel motivated to chase the
 *   under-pulled tail. This card crystallizes both ends in one glance —
 *   essentially an "extremes" view of the same data the ModuleCollectionGrid
 *   shows in full.
 *
 * Why filter by EPIC_MODULE_IDS:
 *   `selectModulePullCounts` keys by module id, but legacy/imported pulls or
 *   typos could in theory contain ids not in our current roster. We
 *   defensively intersect with the canonical MODULES list so highlights only
 *   ever show modules that actually exist in the current config.
 *
 * Selectors consumed:
 *   - `selectModulePullCounts(pulls)` — { [moduleId]: count }
 */

import { useMemo } from "react";
import { useStore } from "../../store";
import { selectModulePullCounts } from "../../store/selectors";
import { MODULE_BY_ID, MODULES } from "../../config/modules";
import { useRenderLog } from "../../utils/renderLog";

// Same type-accent palette used across the dashboard (TypeBalance,
// ModuleCollectionGrid). Keep these in sync if the brand palette evolves.
const TYPE_COLORS: Record<string, string> = {
  cannon: "#e94560",
  armor: "#3b82f6",
  generator: "#eab308",
  core: "#a855f7",
};

// Precomputed once at module load. Used to filter out any orphaned ids in
// pull counts (modules removed from config, typos in imports, etc.).
const EPIC_MODULE_IDS = new Set(MODULES.map((m) => m.id));

export function PullHighlights() {
  const pulls = useStore((s) => s.pulls);
  useRenderLog("PullHighlights", { pullsLen: pulls.length });

  // Sort entries descending by count so [0] is "most pulled" and the last
  // element is "least pulled". `useMemo` because the sort and filter only
  // need to re-run when `pulls` changes.
  const epicEntries = useMemo(() => {
    const counts = selectModulePullCounts(pulls);
    const entries = Object.entries(counts).filter(([id]) =>
      EPIC_MODULE_IDS.has(id)
    );
    entries.sort((a, b) => b[1] - a[1]);
    return entries;
  }, [pulls]);

  // Empty state: no epic pulls yet -> hide the card entirely. Showing a
  // "no data" placeholder would clutter the dashboard for new users.
  if (epicEntries.length === 0) return null;

  // [0] = most-pulled, [last] = least-pulled. NOTE: when only one epic has
  // been pulled, both rows resolve to the same module — that's fine, the
  // user will see the same row labeled "Most" and "Least", which is honest.
  const [mostId, mostCount] = epicEntries[0];
  const [leastId, leastCount] = epicEntries[epicEntries.length - 1];

  const mostModule = MODULE_BY_ID[mostId];
  const leastModule = MODULE_BY_ID[leastId];

  // Defensive: if either id somehow doesn't resolve (config drift), bail
  // rather than render with broken data.
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
        {/* Color is keyed by the module's *type*, not its rarity, because
            highlight rows are a quick scan of "which slot did RNG bless
            you in" — a type-coded accent reads faster than rarity here. */}
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

/**
 * HighlightRow — one row inside the card. Layout:
 *   [colored left border] [eyebrow + name + type stack] [big count]
 * The left border doubles as a visual indicator of the module's type.
 */
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
        // 3px colored left border = the type accent. Cheaper than a full
        // border + adds visual hierarchy to the row.
        borderLeft: `3px solid ${color}`,
      }}
    >
      {/* Text stack: eyebrow label, module name (truncated if long), type. */}
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
            // Module names can occasionally exceed the row width on mobile —
            // truncate with ellipsis rather than wrap (keeps row height fixed).
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
      {/* Big count on the right. `minWidth: 32` keeps single-digit and
          double-digit counts visually aligned across rows. */}
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
