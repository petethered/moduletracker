/**
 * MergeProgressSummary.tsx
 *
 * Role: Dashboard card that visualizes the user's progress toward two
 * end-game milestones across their *entire* module collection:
 *   1. Every module reaching Ancestral rarity.
 *   2. Every module reaching at least 5-star.
 *
 * Game-domain concept ("merge progress"):
 *   In The Tower, modules are leveled up by *merging duplicates*. Each rarity
 *   tier (epic -> legendary -> mythic -> ancestral) requires a specific number
 *   of duplicate copies. To get a module to Ancestral, the user needs many
 *   epic copies of that exact module; to get it to 5-star, even more. The
 *   selector `selectMergeProgress` rolls these per-module copy requirements up
 *   into two collection-wide counters:
 *     - `copiesForAncestral`     : copies the user has that contribute toward
 *                                  *some* module's path to Ancestral
 *     - `neededForAllAncestral`  : total copies needed if every module were to
 *                                  reach Ancestral
 *   The same idea applies for 5-star. The "X / Y modules complete" subtitle
 *   tells the user how many modules are *already* at that tier.
 *
 * Selectors consumed:
 *   - `selectMergeProgress(pulls, MODULES.length)` from `store/selectors`
 *
 * Why total counts (not per-module bars): a per-module breakdown lives in the
 * Modules tab. This card is meant to be glanceable — one bar per milestone.
 */

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

/**
 * ProgressBar — one horizontal progress row inside the card.
 * Kept local because the layout (label/value/track/subtext stack) is bespoke
 * to this card. If reused elsewhere, promote to `components/ui/`.
 */
function ProgressBar({ label, value, max, color, modulesAt, totalModules }: ProgressBarProps) {
  // Guard against divide-by-zero when `max` is 0 (e.g. empty module config).
  // Also clamp to 100% in case `value` overshoots `max` due to surplus copies
  // accumulated past the goal.
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Header row: label on the left, raw "X / Y copies" counter on the right. */}
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
      {/* Progress track. The fill is a single absolutely-sized div whose width
          is the computed percentage. The `transition` makes the bar animate
          when new pulls arrive and the percentage shifts. */}
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
      {/* Secondary subtitle: how many *modules* (not copies) are already at
          the target tier. This is the more emotionally meaningful number for
          the user since merges happen per-module, not in aggregate. */}
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
  // Single selector call returns both the Ancestral and 5-Star aggregates so
  // we only walk `pulls` once per render.
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
      {/* Ancestral bar — green ("complete the dex" vibe). */}
      <ProgressBar
        label="All Ancestral"
        value={copiesForAncestral}
        max={neededForAllAncestral}
        color="#22c55e"
        modulesAt={modulesAtAncestral}
        totalModules={MODULES.length}
      />
      {/* 5-Star bar — gold (the "ultimate" milestone, post-Ancestral). */}
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
