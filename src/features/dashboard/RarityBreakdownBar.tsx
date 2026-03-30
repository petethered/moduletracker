import { useStore } from "../../store";
import { selectRarityPercentages } from "../../store/selectors";
import { RARITY_COLORS } from "../../config/rarityColors";

export function RarityBreakdownBar() {
  const pulls = useStore((s) => s.pulls);
  const pcts = selectRarityPercentages(pulls);

  if (pulls.length === 0) return null;

  return (
    <div>
      <div className="flex rounded-lg overflow-hidden h-6">
        {pcts.common > 0 && (
          <div
            style={{ width: `${pcts.common}%`, backgroundColor: RARITY_COLORS.common }}
            className="flex items-center justify-center text-xs font-bold text-black"
          >
            {pcts.common.toFixed(1)}%
          </div>
        )}
        {pcts.rare > 0 && (
          <div
            style={{ width: `${pcts.rare}%`, backgroundColor: RARITY_COLORS.rare }}
            className="flex items-center justify-center text-xs font-bold text-white"
          >
            {pcts.rare.toFixed(1)}%
          </div>
        )}
        {pcts.epic > 0 && (
          <div
            style={{ width: `${pcts.epic}%`, backgroundColor: RARITY_COLORS.epic }}
            className="flex items-center justify-center text-xs font-bold text-white"
          >
            {pcts.epic.toFixed(1)}%
          </div>
        )}
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>Common: {pcts.common.toFixed(1)}%</span>
        <span>Rare: {pcts.rare.toFixed(1)}%</span>
        <span>Epic: {pcts.epic.toFixed(1)}%</span>
      </div>
    </div>
  );
}
