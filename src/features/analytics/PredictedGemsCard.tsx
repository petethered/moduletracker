import { StatCard } from "../../components/ui/StatCard";
import { useStore } from "../../store";
import {
  selectGemsPerEpic,
  selectMergeProgress,
  selectPredictedGemsForMerge,
} from "../../store/selectors";
import { MODULES } from "../../config/modules";

export function PredictedGemsCard() {
  const pulls = useStore((s) => s.pulls);
  const gemsPerEpic = selectGemsPerEpic(pulls);
  const progress = selectMergeProgress(pulls, MODULES.length);
  const gemsForAncestral = selectPredictedGemsForMerge(pulls, MODULES.length, 8);
  const gemsFor5Star = selectPredictedGemsForMerge(pulls, MODULES.length, 18);

  return (
    <div className="space-y-4">
      <StatCard
        label="Gems/Epic"
        value={gemsPerEpic > 0 ? gemsPerEpic.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "-"}
        subtitle="Average gems per epic pull"
        color="var(--color-rarity-legendary)"
      />

      <div className="bg-[var(--color-navy-600)] rounded-xl p-4">
        <h4 className="text-xs uppercase tracking-wider text-[var(--color-rarity-ancestral)] font-medium mb-3">
          All Ancestral (8 copies each)
        </h4>
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 bg-[var(--color-navy-800)] rounded-full h-3 overflow-hidden">
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
          <span className="text-gray-400">{progress.modulesAtAncestral}/24 modules ready</span>
          <span className="text-[var(--color-accent-crimson)]">
            {gemsForAncestral > 0 ? `~${gemsForAncestral.toLocaleString()} gems` : "Done!"}
          </span>
        </div>
      </div>

      <div className="bg-[var(--color-navy-600)] rounded-xl p-4">
        <h4 className="text-xs uppercase tracking-wider text-[var(--color-rarity-legendary)] font-medium mb-3">
          All 5-Star (18 copies each)
        </h4>
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
          <span className="text-gray-400">{progress.modulesAt5Star}/24 modules at 5*</span>
          <span className="text-[var(--color-accent-crimson)]">
            {gemsFor5Star > 0 ? `~${gemsFor5Star.toLocaleString()} gems` : "Done!"}
          </span>
        </div>
      </div>
    </div>
  );
}
