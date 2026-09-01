/**
 * PredictedGemsCard — projected gem cost to reach two endgame milestones.
 *
 * Renders three stacked tiles:
 *   1. Average gems-per-epic (the input to all predictions)
 *   2. "All Ancestral" progress + gem cost to finish
 *   3. "All 5-Star" progress + gem cost to finish
 *
 * ===== THE PREDICTION MODEL =====
 * Gem cost prediction = (copies still needed) * (player's actual gemsPerEpic).
 *
 * KEY ASSUMPTIONS (and why this is a heuristic, not a guarantee):
 *   - Assumes the player's PAST gems/epic ratio holds for FUTURE pulls.
 *     Variance in early pulls makes this very noisy until ~50+ epics pulled.
 *   - Assumes every epic-or-better pull contributes a "copy" toward merge,
 *     but does NOT distinguish WHICH module is pulled. In reality you can
 *     get duplicate copies of one module while needing copies of another.
 *     This means the prediction is a LOWER BOUND on actual gem cost.
 *   - Does not model pity: pity guarantees only ensure SOME epic, not a
 *     specific module-type-balanced epic.
 *
 * ===== MERGE TARGETS =====
 *   Each module in The Tower has rarity tiers. To upgrade, you merge copies:
 *     - 8 copies of an epic   -> ancestral-grade module   (top tier — green)
 *     - 18 copies of an epic  -> all-5-star module        (max-stars across tiers)
 *   The literals 8 and 18 are passed to selectPredictedGemsForMerge.
 *   The "N modules ready"/"N modules at 5*" denominators render
 *   {MODULES.length} directly, so they follow the roster automatically when a
 *   module is added or removed — do NOT reintroduce a hardcoded total here.
 */
import { StatCard } from "../../components/ui/StatCard";
import { useStore } from "../../store";
import {
  selectGemsPerEpic,
  selectMergeProgress,
  selectPredictedGemsForMerge,
} from "../../store/selectors";
import { MODULES } from "../../config/modules";
import { formatInteger } from "../../utils/formatNumber";
import { SectionHeading } from "../../components/ui/SectionHeading";

export function PredictedGemsCard() {
  const pulls = useStore((s) => s.pulls);
  // Average gems spent per epic pulled — the multiplier in the prediction model.
  const gemsPerEpic = selectGemsPerEpic(pulls);
  // Aggregate: copies pulled vs. copies needed for both merge tiers.
  // Pass MODULES.length so the selector knows how many distinct modules exist.
  const progress = selectMergeProgress(pulls, MODULES.length);
  // Predicted gem cost = (remaining copies) * gemsPerEpic.
  // 8  = copies needed per module to reach ancestral grade.
  // 18 = copies needed per module to max-star (5-star).
  const gemsForAncestral = selectPredictedGemsForMerge(pulls, MODULES.length, 8);
  const gemsFor5Star = selectPredictedGemsForMerge(pulls, MODULES.length, 18);

  return (
    <div className="space-y-4">
      {/* The "input" stat for the predictions below. Show "-" when no epics */}
      {/* have been pulled yet to avoid "0 gems/epic" looking like a real value. */}
      <StatCard
        label="Gems/Epic"
        value={gemsPerEpic > 0 ? formatInteger(Math.round(gemsPerEpic)) : "-"}
        subtitle="Average gems per epic pull"
        color="var(--color-rarity-legendary)"
      />

      {/* === Tier 1: All Ancestral (8 copies each) === */}
      {/* Ancestral is the top rarity in The Tower; green color matches that tier. */}
      <div className="bg-[var(--color-navy-600)] rounded-xl p-4">
        <SectionHeading as="h4" color="var(--color-rarity-ancestral)">
          All Ancestral (8 copies each)
        </SectionHeading>
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 bg-[var(--color-navy-800)] rounded-full h-3 overflow-hidden">
            {/* Progress bar width = (copies pulled / copies needed). Caps at 100% */}
            {/* visually because container has overflow-hidden, but the value can */}
            {/* technically exceed if player has overpulled some modules. */}
            <div
              className="h-full rounded-full bg-[var(--color-rarity-ancestral)]"
              style={{ width: `${(progress.copiesForAncestral / progress.neededForAllAncestral) * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-400 w-20 text-right">
            {progress.copiesForAncestral}/{progress.neededForAllAncestral}
          </span>
        </div>
        <div className="flex justify-between text-xs">
          {/* Denominator is the live roster size, not a literal — see top-of-file note. */}
          <span className="text-gray-400">{progress.modulesAtAncestral}/{MODULES.length} modules ready</span>
          {/* Crimson highlight for the gem cost — visually loud because */}
          {/* it's the actionable number ("how much do I still need to spend?"). */}
          {/* "Done!" replaces the cost when all modules are at the target tier. */}
          <span className="text-[var(--color-accent-crimson)]">
            {gemsForAncestral > 0 ? `~${formatInteger(gemsForAncestral)} gems` : "Done!"}
          </span>
        </div>
      </div>

      {/* === Tier 2: All 5-Star (18 copies each) === */}
      {/* 5-Star is a separate progression axis (max stars per module). */}
      {/* Gold color = legendary tier semantics (max-star feel). */}
      <div className="bg-[var(--color-navy-600)] rounded-xl p-4">
        <SectionHeading as="h4" color="var(--color-rarity-legendary)">
          All 5-Star (18 copies each)
        </SectionHeading>
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 bg-[var(--color-navy-800)] rounded-full h-3 overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--color-rarity-legendary)]"
              style={{ width: `${(progress.copiesFor5Star / progress.neededForAll5Star) * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-400 w-20 text-right">
            {progress.copiesFor5Star}/{progress.neededForAll5Star}
          </span>
        </div>
        <div className="flex justify-between text-xs">
          {/* Same live-roster denominator as the Ancestral tile above. */}
          <span className="text-gray-400">{progress.modulesAt5Star}/{MODULES.length} modules at 5*</span>
          <span className="text-[var(--color-accent-crimson)]">
            {gemsFor5Star > 0 ? `~${formatInteger(gemsFor5Star)} gems` : "Done!"}
          </span>
        </div>
      </div>
    </div>
  );
}
