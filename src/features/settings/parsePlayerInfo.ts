/**
 * parsePlayerInfo — reads module rarities out of The Tower's save file
 * (playerInfo.dat) for Settings → "Import Player Info".
 *
 * PIPELINE (usePlayerInfoImport drives it):
 *   file bytes -> decodePlayerInfoFile (decodePlayerInfoFile.ts: decrypt a
 *   game-29.1+ TDS1 container if present, then gunzip, size-capped) -> parsePlayerInfo
 *   (readNrbf: generic .NET decode, src/utils/nrbfReader.ts; then find the
 *   modules and map them to tracker ids/rarities) -> planModuleProgressImport
 *   (what to raise, what to keep) -> store.setModuleRarities.
 *
 * WHERE MODULES LIVE IN A SAVE (root class SaveLoad+PlayerData):
 *   - inventory          List<ModuleItem>: unequipped modules. Read only the
 *                        first `_size` entries of `_items` — the backing array
 *                        has spare capacity (nulls, or stale items after a remove).
 *   - moduleEquipped     ModuleItem[]: the 4 main slots. NOT duplicated in
 *                        inventory, so skipping it misses your best modules.
 *   - assistModuleSlots  AssistModuleSlot[]: each may hold `equippedModule`.
 *                        Also not in inventory; absent in older saves.
 *   Each ModuleItem has `infoIndex` (the game's module number, matched to
 *   ModuleDefinition.gameIndex) and `currentRarity` (an enum: `value__`).
 *   Other places that mention infoIndex are deliberately ignored HERE:
 *   moduleRecords (the pull log) and modulePresets (guids only) describe
 *   modules the player may have since merged away. The pull log is read
 *   separately, as pulls, by playerInfoPulls.ts.
 *
 * RULES:
 *   - A module's progress is the HIGHEST rarity among its copies (players hold
 *     unmerged fodder copies).
 *   - Copies below Epic are ignored (the tracker's ladder starts at Epic).
 *   - Common/rare-BASE modules (COMMON_AND_RARE_BASE_GAME_INDEXES) are
 *     ignored at any rarity — rare modules merge up past Epic.
 *   - A copy of a tracked module with a rarity the tracker doesn't know (a
 *     future tier) makes the whole module "unsupported": importing its lower
 *     copies would understate it.
 *   - Unsupported = an epic+ index the roster doesn't know, or the case above.
 *     Reported, never silently dropped.
 *   - RAISE ONLY (planModuleProgressImport). The import never lowers a module:
 *     in-game levels only go up, cloud sync's merge keeps the higher rarity
 *     anyway (src/services/sync.ts mergeModuleProgress) so a lowered value
 *     would come back, and a module the parser missed (e.g. after a game
 *     update reshapes a slot) must not downgrade real progress. A lower save
 *     value is reported as "kept" so the user can fix a typo by hand.
 */
import { COMMON_AND_RARE_BASE_GAME_INDEXES, MODULE_BY_GAME_INDEX, MODULES } from "../../config/modules";
import { MODULE_RARITY_ORDER } from "../../config/moduleRarities";
import type { ModuleProgress, ModuleRarity } from "../../types";
import { isNrbfObject, readNrbf, type NrbfObject, type NrbfValue } from "../../utils/nrbfReader";
import { NOT_A_SAVE, PlayerInfoFormatError, UNREADABLE_SAVE } from "./decodePlayerInfoFile";

/**
 * The game's ModuleRarity enum -> the tracker's ladder. Verified against a real
 * save (pull-history drop rates) and mytower.app's enum table: 1 Common,
 * 2 Rare, 3 Rare+ (all ignored), 4 Epic ... 10 Ancestral, 11-15 Ancestral 1★-5★.
 * Values above 15 are treated as a future tier (see RULES).
 */
const TRACKER_RARITY_BY_GAME_RARITY: Record<number, ModuleRarity> = {
  4: "epic",
  5: "epic+",
  6: "legendary",
  7: "legendary+",
  8: "mythic",
  9: "mythic+",
  10: "ancestral",
  11: "1*",
  12: "2*",
  13: "3*",
  14: "4*",
  15: "5*",
};
/**
 * The game's ModuleRarity values the readers compare against. Shared with
 * playerInfoPulls.ts (pull-log drops are only ever common, rare or epic).
 */
export const GAME_RARITY = { common: 1, rare: 2, epic: 4 } as const;

export interface PlayerInfoModules {
  /** Tracker module id -> highest rarity held in the save (epic and above). */
  modules: Record<string, ModuleRarity>;
  /** Game indexes held at epic+ that couldn't be imported (see RULES), ascending. */
  unsupportedGameIndexes: number[];
}

export interface ModuleProgressChange {
  moduleId: string;
  name: string;
  /** Rarity before import; null if the module had no progress yet. */
  from: ModuleRarity | null;
  to: ModuleRarity;
}

export interface KeptHigherRarity {
  moduleId: string;
  name: string;
  /** The (higher) value the tracker keeps. */
  tracker: ModuleRarity;
  /** The lower value found in the save. */
  save: ModuleRarity;
}

export interface ModuleProgressImportPlan {
  /** New or raised modules, in roster (UI) order. Apply these. */
  raises: ModuleProgressChange[];
  /** Modules where the save is LOWER than the tracker. Not applied; shown to the user. */
  keptHigher: KeptHigherRarity[];
}

/** Collect every ModuleItem the player owns: inventory (live part), main slots, assist slots. */
function collectModuleItems(root: NrbfObject): NrbfObject[] {
  const items: NrbfObject[] = [];
  const pushAll = (list: NrbfValue | undefined) => {
    if (Array.isArray(list)) for (const v of list) if (isNrbfObject(v)) items.push(v);
  };

  const inventory = root.members.inventory;
  if (isNrbfObject(inventory) && Array.isArray(inventory.members._items)) {
    const size = typeof inventory.members._size === "number" ? inventory.members._size : 0;
    pushAll(inventory.members._items.slice(0, size));
  }
  pushAll(root.members.moduleEquipped);
  const assistSlots = root.members.assistModuleSlots;
  if (Array.isArray(assistSlots)) {
    for (const slot of assistSlots) {
      if (isNrbfObject(slot) && isNrbfObject(slot.members.equippedModule)) {
        items.push(slot.members.equippedModule);
      }
    }
  }
  return items;
}

/**
 * Decode decompressed save bytes into the validated root PlayerData object.
 * Split out from parsePlayerInfo so the import decodes ONCE and hands the root
 * to both readers: extractSaveModules (here) and extractSavePulls (playerInfoPulls.ts).
 * @throws PlayerInfoFormatError if the bytes aren't a readable The Tower save.
 */
export function readPlayerInfoSave(bytes: Uint8Array): NrbfObject {
  let root: NrbfValue;
  try {
    root = readNrbf(bytes).root;
  } catch (err) {
    // Parser messages ("record type 21 at byte 1234") mean nothing to a player.
    throw new PlayerInfoFormatError(bytes[0] === 0 ? UNREADABLE_SAVE : NOT_A_SAVE, { cause: err });
  }
  // Check the root class before trusting member names: another Unity game's
  // BinaryFormatter save would otherwise parse into an empty "successful" import.
  if (!isNrbfObject(root) || root.$class !== "SaveLoad+PlayerData") {
    throw new PlayerInfoFormatError(NOT_A_SAVE);
  }
  return root;
}

/**
 * Extract module rarities from decompressed save bytes. Convenience wrapper
 * (decode + extractSaveModules) kept for the unit tests; the app's import
 * decodes once and calls the readers itself (usePlayerInfoImport).
 * @throws PlayerInfoFormatError if the bytes aren't a readable The Tower save.
 */
export function parsePlayerInfo(bytes: Uint8Array): PlayerInfoModules {
  return extractSaveModules(readPlayerInfoSave(bytes));
}

/** Module rarities from an already-decoded save root (see RULES in the header). */
export function extractSaveModules(root: NrbfObject): PlayerInfoModules {

  const best = new Map<number, number>();
  const unsupported = new Set<number>();
  for (const item of collectModuleItems(root)) {
    const index = item.members.infoIndex;
    const rarityEnum = item.members.currentRarity;
    const rarity = isNrbfObject(rarityEnum) ? rarityEnum.members.value__ : undefined;
    if (typeof index !== "number" || typeof rarity !== "number") continue;
    if (rarity < GAME_RARITY.epic || COMMON_AND_RARE_BASE_GAME_INDEXES.has(index)) continue;

    if (!MODULE_BY_GAME_INDEX.has(index) || !(rarity in TRACKER_RARITY_BY_GAME_RARITY)) {
      unsupported.add(index);
    } else {
      best.set(index, Math.max(best.get(index) ?? 0, rarity));
    }
  }

  const modules: Record<string, ModuleRarity> = {};
  for (const [index, rarity] of best) {
    if (unsupported.has(index)) continue; // a copy had a future tier — see RULES
    modules[MODULE_BY_GAME_INDEX.get(index)!.id] = TRACKER_RARITY_BY_GAME_RARITY[rarity];
  }
  return { modules, unsupportedGameIndexes: [...unsupported].sort((a, b) => a - b) };
}

/**
 * Decide what an import changes. RAISE ONLY — see RULES in the file header.
 * Modules absent from the save, or already at the save's rarity, appear in
 * neither list.
 */
export function planModuleProgressImport(
  current: Record<string, ModuleProgress>,
  imported: Record<string, ModuleRarity>,
): ModuleProgressImportPlan {
  const rank = (r: ModuleRarity) => MODULE_RARITY_ORDER.indexOf(r);
  const plan: ModuleProgressImportPlan = { raises: [], keptHigher: [] };
  for (const m of MODULES) {
    const save = imported[m.id];
    if (!save) continue;
    const from = current[m.id]?.currentRarity ?? null;
    if (from === null || rank(save) > rank(from)) {
      plan.raises.push({ moduleId: m.id, name: m.name, from, to: save });
    } else if (rank(save) < rank(from)) {
      plan.keptHigher.push({ moduleId: m.id, name: m.name, tracker: from, save });
    }
  }
  return plan;
}
