import { useStore } from "../../store";
import { MODULES, MODULES_BY_TYPE } from "../../config/modules";
import { selectModulePullCounts } from "../../store/selectors";
import { getModuleRarityColor } from "../../config/rarityColors";

const TYPE_COLORS: Record<string, string> = {
  cannon: "#e94560",
  armor: "#3b82f6",
  generator: "#eab308",
  core: "#a855f7",
};

const TYPE_ORDER = ["cannon", "armor", "generator", "core"] as const;

export function ModuleCollectionGrid() {
  const pulls = useStore((s) => s.pulls);
  const moduleProgress = useStore((s) => s.moduleProgress);
  const counts = selectModulePullCounts(pulls);
  const foundCount = Object.keys(counts).length;
  const totalCount = MODULES.length;

  return (
    <div className="bg-[var(--color-navy-800)] rounded-xl p-4 border border-[var(--color-navy-500)]">
      <div className="flex justify-between items-center mb-3">
        <span className="font-semibold text-sm">Collection</span>
        <span className="text-sm text-gray-400">
          {foundCount}/{totalCount}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {TYPE_ORDER.map((type) => {
          const typeColor = TYPE_COLORS[type];
          const modules = MODULES_BY_TYPE[type];
          return (
            <div key={type}>
              <div
                className="text-[10px] uppercase tracking-wider font-semibold mb-1"
                style={{ color: typeColor }}
              >
                {type}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1.5">
                {modules.map((mod) => {
                  const found = (counts[mod.id] || 0) > 0;
                  const progress = moduleProgress[mod.id];
                  const rarity = progress?.currentRarity;
                  const rarityColor = rarity
                    ? getModuleRarityColor(rarity)
                    : typeColor;
                  const displayColor = found ? rarityColor : "#6b7280";
                  const bgColor = found
                    ? rarityColor + "33"
                    : "var(--color-navy-700)";
                  const borderColor = found
                    ? rarityColor + "88"
                    : "var(--color-navy-500)";

                  return (
                    <div
                      key={mod.id}
                      title={`${mod.name}${rarity ? ` (${rarity})` : ""}`}
                      className="rounded-lg text-center select-none px-1.5 py-1.5"
                      style={{
                        backgroundColor: bgColor,
                        border: `1px solid ${borderColor}`,
                        color: displayColor,
                      }}
                    >
                      <div className="text-[10px] sm:text-[11px] md:text-xs font-medium leading-tight truncate">
                        {mod.name}
                      </div>
                      {rarity ? (
                        <div
                          className="text-[8px] sm:text-[9px] md:text-[10px] font-semibold mt-0.5"
                          style={{ color: rarityColor }}
                        >
                          {rarity}
                        </div>
                      ) : found ? (
                        <div className="text-[8px] sm:text-[9px] md:text-[10px] text-gray-500 mt-0.5">
                          epic
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
