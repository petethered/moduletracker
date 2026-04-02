import { useStore } from "../../store";
import { sortPullsNewest, selectPityPullIds } from "../../store/selectors";
import { MODULE_BY_ID } from "../../config/modules";
import { Badge } from "../../components/ui/Badge";
import { RARITY_COLORS } from "../../config/rarityColors";

export function RecentPullsList() {
  const pulls = useStore((s) => s.pulls);
  const openEditPullModal = useStore((s) => s.openEditPullModal);
  const pityIds = selectPityPullIds(pulls);
  const sorted = sortPullsNewest(pulls).slice(0, 5);

  if (sorted.length === 0) {
    return (
      <p className="text-gray-500 text-sm">
        No pulls recorded yet. Click "Add 10x Pull" to get started.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {sorted.map((pull) => (
        <div
          key={pull.id}
          onClick={() => openEditPullModal(pull.id)}
          className="flex items-center gap-3 bg-[var(--color-navy-600)] rounded-lg px-3 py-2 text-sm cursor-pointer hover:bg-[var(--color-navy-500)] transition-colors"
        >
          <span className="text-gray-400 w-24 shrink-0">{pull.date}</span>
          <Badge color={RARITY_COLORS.common}>{pull.commonCount}C</Badge>
          <Badge color={RARITY_COLORS.rare}>{pull.rareCount}R</Badge>
          {pull.epicModules.length > 0 && (
            <Badge color={RARITY_COLORS.epic}>
              {pull.epicModules.length}E
            </Badge>
          )}
          {pull.epicModules.length > 0 && (
            <span className="text-[var(--color-rarity-epic)] text-xs truncate">
              {pull.epicModules
                .map((id) => MODULE_BY_ID[id]?.name || id)
                .join(", ")}
              {pityIds.has(pull.id) && <span className="text-red-400 ml-1">PITY :(</span>}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
