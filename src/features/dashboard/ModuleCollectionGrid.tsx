/**
 * ModuleCollectionGrid.tsx
 *
 * Role: Dashboard "collection" card — a Pokedex-style grid showing every
 * module in the game, grouped by type (cannon / armor / generator / core),
 * with each tile colored by the module's *current* rarity.
 *
 * Game-domain concept:
 *   The Tower has a finite (but growing) roster of epic modules across four
 *   types — always derive counts from MODULES, never hardcode them. Players
 *   pull duplicates and merge them up the rarity ladder
 *   (epic -> legendary -> mythic -> ancestral, with stars beyond). This grid
 *   answers two questions at a glance:
 *     1. "Which modules do I have?"  -> `isCollected` from selectCollectedModuleIds:
 *        pulled at least once OR has a rarity in `moduleProgress`.
 *     2. "What rarity have I gotten each one to?" -> `currentRarity` from
 *        `moduleProgress` (set by hand, or by Import Player Info).
 *
 * Selectors / store reads:
 *   - `useStore.pulls` + `useStore.moduleProgress` -> selectCollectedModuleIds.
 *   - `useStore.moduleProgress`  — per-module current rarity, persisted.
 *
 * Why two data sources: a module appearing in `pulls` proves the user *got*
 * it once, but doesn't tell us its present merged rarity (which can only go
 * up via player action). `moduleProgress` is the source of truth for rarity,
 * AND having one proves ownership too. That second point matters after a save
 * import: rarities arrive for every owned module, but the save's pull log only
 * covers the last 15 ten-pulls. Found-by-pulls-only left those tiles grey.
 */

import { useStore } from "../../store";
import { MODULES, MODULES_BY_TYPE } from "../../config/modules";
import { selectCollectedModuleIds } from "../../store/selectors";
import { getModuleRarityColor } from "../../config/moduleRarities";
import { TEXT_MUTED } from "../../config/runtimeColors";
import { MetaLabel } from "../../components/ui/MetaLabel";
import { formatInteger } from "../../utils/formatNumber";
import {
  MODULE_TYPE_COLORS,
  MODULE_TYPE_ORDER,
} from "../../config/moduleTypes";

// This grid is the one place that renders BOTH color encodings at once: a tile
// uses its rarity color when the player has a rarity and falls back to the
// type color when they don't (see `displayColor` below). That is why the type
// palette must stay visually distinct from the rarity palette — see
// src/config/moduleTypes.ts for the full rationale.

export function ModuleCollectionGrid() {
  const pulls = useStore((s) => s.pulls);
  const moduleProgress = useStore((s) => s.moduleProgress);
  // Collected = pulled at least once OR has a rarity recorded. Rarity counts
  // because Import Player Info sets rarities for every owned module while the
  // save only brings in its last 15 pulls (see selectCollectedModuleIds).
  const collected = selectCollectedModuleIds(pulls, moduleProgress);
  // Count CATALOG modules only, not collected.size: moduleProgress can hold ids
  // that aren't in MODULES (old JSON imports, sync, a module later removed
  // from config), which would push the header past 100% (e.g. "27/26").
  const collectedCount = MODULES.filter((m) => collected.has(m.id)).length;
  const totalCount = MODULES.length;

  return (
    <div className="bg-[var(--color-navy-800)] rounded-xl p-4 border border-[var(--color-navy-500)]">
      {/* Card header with "collected / total" completion fraction. */}
      <div className="flex justify-between items-center mb-3">
        <span className="font-semibold text-sm">Collection</span>
        <span className="text-sm text-gray-400">
          {formatInteger(collectedCount)}/{formatInteger(totalCount)}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {MODULE_TYPE_ORDER.map((type) => {
          const typeColor = MODULE_TYPE_COLORS[type];
          // MODULES_BY_TYPE is precomputed in `config/modules.ts` to avoid
          // repeated filtering on every render.
          const modules = MODULES_BY_TYPE[type];
          return (
            <div key={type}>
              {/* Color-coded so the row is identifiable without reading it. */}
              <MetaLabel color={typeColor} className="mb-1">
                {type}
              </MetaLabel>
              {/* Responsive tile grid: 2 cols on phones, 3 on tablets, 6 on
                  desktop. Tile sizing kept tight (px-1.5 py-1.5) to keep the
                  collection compact at desktop widths.
                  NOTE: type groups are not uniformly 6 wide — at desktop (md+)
                  widths, any group with more than 6 modules deliberately wraps to
                  a second row rather than
                  shrinking every tile to fit. Do NOT retune the column count to
                  the current largest group; the roster changes, and each group
                  is rendered independently so wrapping is the graceful case. */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1.5">
                {modules.map((mod) => {
                  // Collected: pulled at least once, or a rarity is set.
                  const isCollected = collected.has(mod.id);
                  // Manual progress entry; may be undefined for pulled-but-unrated
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
                  // Final styling depends on whether the user has this module:
                  //   - Collected     -> tinted background + colored border + colored text
                  //   - Not collected -> muted gray with a dim navy background
                  // The `+ "33"` / `+ "88"` are alpha hex suffixes (~20% / ~53%).
                  const displayColor = isCollected ? rarityColor : TEXT_MUTED;
                  const bgColor = isCollected
                    ? rarityColor + "33"
                    : "var(--color-navy-700)";
                  const borderColor = isCollected
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
                            b) Collected, no rarity (pulled, rarity never set)
                                               -> show "epic" placeholder
                                                  (epic is the floor for tracked modules
                                                   since all roster modules are epics).
                            c) Not collected   -> render nothing (clean tile). */}
                      {rarity ? (
                        <div
                          className="text-[8px] sm:text-[9px] md:text-[10px] font-semibold mt-0.5"
                          style={{ color: rarityColor }}
                        >
                          {rarity}
                        </div>
                      ) : isCollected ? (
                        <div className="text-[8px] sm:text-[9px] md:text-[10px] text-gray-400 mt-0.5">
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
