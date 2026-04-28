/**
 * ModuleCollectionGrid.tsx
 *
 * Role: Dashboard "collection" card — a Pokedex-style grid showing every
 * module in the game, grouped by type (cannon / armor / generator / core),
 * with each tile colored by the module's *current* rarity.
 *
 * Game-domain concept:
 *   The Tower has a fixed roster of epic modules across four types. Players
 *   pull duplicates and merge them up the rarity ladder
 *   (epic -> legendary -> mythic -> ancestral, with stars beyond). This grid
 *   answers two questions at a glance:
 *     1. "Which modules have I ever pulled?"  -> `found` flag from pull counts.
 *     2. "What rarity have I gotten each one to?" -> `currentRarity` from
 *        `moduleProgress` (manually advanced by the user as they merge).
 *
 * Selectors / store reads:
 *   - `useStore.pulls`           — used by `selectModulePullCounts` to count
 *                                  how many copies of each module the user
 *                                  has pulled (>0 means "found").
 *   - `useStore.moduleProgress`  — per-module current rarity tracked manually
 *                                  by the user, persisted to localStorage.
 *
 * Why two data sources: a module appearing in `pulls` proves the user *got*
 * it once, but doesn't tell us its present merged rarity (which can only go
 * up via player action). `moduleProgress` is the source of truth for rarity.
 */

import { useStore } from "../../store";
import { MODULES, MODULES_BY_TYPE } from "../../config/modules";
import { selectModulePullCounts } from "../../store/selectors";
import { getModuleRarityColor } from "../../config/rarityColors";

// Type accent colors used for both the type heading and as a *fallback* tile
// color when a module has been found but has no recorded rarity. These are
// intentionally distinct from the rarity palette in `rarityColors.ts` so the
// type grouping reads even before any merges happen.
const TYPE_COLORS: Record<string, string> = {
  cannon: "#e94560",
  armor: "#3b82f6",
  generator: "#eab308",
  core: "#a855f7",
};

// Display order for type rows. Matches the in-game "shop" / loadout ordering
// players are used to. `as const` so TS narrows to literal string union.
const TYPE_ORDER = ["cannon", "armor", "generator", "core"] as const;

export function ModuleCollectionGrid() {
  const pulls = useStore((s) => s.pulls);
  const moduleProgress = useStore((s) => s.moduleProgress);
  // counts: { [moduleId]: numTimesPulled }. Only modules the user has *ever*
  // pulled appear as keys, so `Object.keys(counts).length` == "modules found".
  const counts = selectModulePullCounts(pulls);
  const foundCount = Object.keys(counts).length;
  const totalCount = MODULES.length;

  return (
    <div className="bg-[var(--color-navy-800)] rounded-xl p-4 border border-[var(--color-navy-500)]">
      {/* Card header with "found / total" completion fraction. */}
      <div className="flex justify-between items-center mb-3">
        <span className="font-semibold text-sm">Collection</span>
        <span className="text-sm text-gray-400">
          {foundCount}/{totalCount}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {TYPE_ORDER.map((type) => {
          const typeColor = TYPE_COLORS[type];
          // MODULES_BY_TYPE is precomputed in `config/modules.ts` to avoid
          // repeated filtering on every render.
          const modules = MODULES_BY_TYPE[type];
          return (
            <div key={type}>
              {/* Type heading — color-coded so the row is identifiable even
                  without reading the label. */}
              <div
                className="text-[10px] uppercase tracking-wider font-semibold mb-1"
                style={{ color: typeColor }}
              >
                {type}
              </div>
              {/* Responsive tile grid: 2 cols on phones, 3 on tablets, 6 on
                  desktop. Tile sizing kept tight (px-1.5 py-1.5) so the whole
                  collection fits on one screen at desktop widths. */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1.5">
                {modules.map((mod) => {
                  // "Found" = the user has pulled this module at least once.
                  const found = (counts[mod.id] || 0) > 0;
                  // Manual progress entry; may be undefined for newly-found
                  // modules where the user hasn't yet set a rarity.
                  const progress = moduleProgress[mod.id];
                  const rarity = progress?.currentRarity;
                  // Color resolution priority:
                  //   1. If we know the rarity, use the rarity color.
                  //   2. Else fall back to the *type* color (still differentiated).
                  // This keeps the grid colorful even when rarity tracking is sparse.
                  const rarityColor = rarity
                    ? getModuleRarityColor(rarity)
                    : typeColor;
                  // Final styling depends on whether the user has actually
                  // pulled this module:
                  //   - Found    -> tinted background + colored border + colored text
                  //   - Not found -> muted gray with a dim navy background
                  // The `+ "33"` / `+ "88"` are alpha hex suffixes (~20% / ~53%).
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
                      // Native tooltip on hover — cheap and accessible enough
                      // for a dashboard tile. Includes rarity if known.
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
                      {/* Rarity badge logic — three branches:
                            a) Have rarity     -> show rarity name in rarity color.
                            b) Found, no rarity-> show "epic" placeholder
                                                  (epic is the floor for tracked modules
                                                   since all roster modules are epics).
                            c) Not found       -> render nothing (clean tile). */}
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
