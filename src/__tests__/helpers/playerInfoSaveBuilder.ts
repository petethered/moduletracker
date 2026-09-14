/**
 * playerInfoSaveBuilder — TEST-ONLY builder for a synthetic The Tower save
 * (the decompressed contents of playerInfo.dat).
 *
 * USED BY: src/__tests__/parsePlayerInfo.test.ts AND
 * e2e/player-info-import.spec.ts. Keep it free of vitest and node:* imports
 * so Playwright's runtime can load it too (callers gzip it themselves).
 *
 * Mirrors the real layout that parsePlayerInfo reads (confirmed against a
 * real save):
 *   SaveLoad+PlayerData
 *     inventory          List<ModuleItem>  -> { _items: ModuleItem[], _size }
 *     moduleEquipped     ModuleItem[]      (main slots: cannon, armor, generator, core)
 *     assistModuleSlots  AssistModuleSlot[] -> { equippedModule: ModuleItem | null }
 *   ModuleItem { infoIndex: int, currentRarity: ModuleRarity { value__: int }, level: int }
 *
 * Real saves carry hundreds of other members; the parser must not depend on
 * them, so the builder deliberately omits them.
 */
import { NrbfWriter, PrimitiveType as PT } from "./nrbfWriter";

/** The game's raw ModuleRarity enum values (see parsePlayerInfo.ts). */
export const GameRarity = {
  common: 1,
  rare: 2,
  rarePlus: 3,
  epic: 4,
  legendary: 6,
  ancestral: 10,
  oneStar: 11,
  fiveStar: 15,
} as const;

export interface SavedModule {
  /** The game's module index (ModuleDefinition.gameIndex for epics). */
  infoIndex: number;
  /** Raw game rarity enum: 1 Common, 2 Rare, 3 Rare+, 4 Epic ... 15 Ancestral 5★. */
  rarity: number;
}

export interface PlayerInfoSaveSpec {
  inventory?: SavedModule[];
  /**
   * Stale, NON-null ModuleItems left in the List's backing array beyond
   * `_size` (e.g. after a RemoveAt). The parser must ignore these.
   */
  inventoryBeyondSize?: SavedModule[];
  equipped?: (SavedModule | null)[];
  assist?: (SavedModule | null)[];
  /** Override the root class name (to simulate a non-save BinaryFormatter file). */
  rootClass?: string;
}

const LIB = 2;

export function buildPlayerInfoSave(spec: PlayerInfoSaveSpec): Uint8Array {
  const inventory = spec.inventory ?? [];
  const beyondSize = spec.inventoryBeyondSize ?? [];
  const equipped = spec.equipped ?? [];
  const assist = spec.assist ?? [];
  let nextId = 100;
  const id = () => nextId++;
  let moduleItemMeta: number | null = null;
  let rarityMeta: number | null = null;
  let assistMeta: number | null = null;

  const w = new NrbfWriter().header(1).library(LIB, "Assembly-CSharp");

  // Root members are all references to top-level records written afterwards,
  // matching how BinaryFormatter lays out real saves.
  const inventoryId = id();
  const equippedId = id();
  const assistId = id();
  w.classWithMembersAndTypes(1, spec.rootClass ?? "SaveLoad+PlayerData", [
    ["playerLevel", { kind: "primitive", primitive: PT.int32 }],
    ["inventory", { kind: "systemClass", className: "System.Collections.Generic.List`1[[ModuleItem]]" }],
    ["moduleEquipped", { kind: "object" }],
    ["assistModuleSlots", { kind: "object" }],
  ], LIB);
  w.primitive(PT.int32, 5);
  w.reference(inventoryId);
  w.reference(equippedId);
  w.reference(assistId);

  const writeModuleItem = (m: SavedModule) => {
    const itemId = id();
    if (moduleItemMeta === null) {
      moduleItemMeta = itemId;
      w.classWithMembersAndTypes(itemId, "ModuleItem", [
        ["infoIndex", { kind: "primitive", primitive: PT.int32 }],
        ["currentRarity", { kind: "class", className: "ModuleRarity", libraryId: LIB }],
        ["level", { kind: "primitive", primitive: PT.int32 }],
      ], LIB);
    } else {
      w.classWithId(itemId, moduleItemMeta);
    }
    w.primitive(PT.int32, m.infoIndex);
    // Enum member: a nested class record whose only member is value__.
    // Negative object id on purpose: real saves give nested value-type records
    // (enums, structs) negative ids. The reader must not assume ids are positive.
    const rarityId = -id();
    if (rarityMeta === null) {
      rarityMeta = rarityId;
      w.classWithMembersAndTypes(rarityId, "ModuleRarity", [["value__", { kind: "primitive", primitive: PT.int32 }]], LIB);
    } else {
      w.classWithId(rarityId, rarityMeta);
    }
    w.primitive(PT.int32, m.rarity);
    w.primitive(PT.int32, 0);
  };

  const writeItemArray = (arrayId: number, items: (SavedModule | null)[], capacity = items.length) => {
    w.classArray(arrayId, capacity, "ModuleItem", LIB);
    for (const m of items) {
      if (m) writeModuleItem(m);
      else w.nullRecord();
    }
    // Spare List<T> capacity is padded with nulls, as in real saves.
    if (capacity > items.length) w.nullMultiple(capacity - items.length);
  };

  // inventory: List<ModuleItem> with extra backing capacity beyond _size.
  const itemsId = id();
  w.classWithMembersAndTypes(inventoryId, "System.Collections.Generic.List`1[[ModuleItem]]", [
    ["_items", { kind: "object" }],
    ["_size", { kind: "primitive", primitive: PT.int32 }],
    ["_version", { kind: "primitive", primitive: PT.int32 }],
  ], LIB);
  w.reference(itemsId);
  w.primitive(PT.int32, inventory.length);
  w.primitive(PT.int32, 1);
  writeItemArray(itemsId, [...inventory, ...beyondSize], inventory.length + beyondSize.length + 2);

  writeItemArray(equippedId, equipped);

  w.arraySingleObject(assistId, assist.length);
  for (const m of assist) {
    const slotId = id();
    if (assistMeta === null) {
      assistMeta = slotId;
      w.classWithMembersAndTypes(slotId, "AssistModuleSlot", [
        ["unlocked", { kind: "primitive", primitive: PT.boolean }],
        ["equippedModule", { kind: "class", className: "ModuleItem", libraryId: LIB }],
      ], LIB);
    } else {
      w.classWithId(slotId, assistMeta);
    }
    w.primitive(PT.boolean, true);
    if (m) writeModuleItem(m);
    else w.nullRecord();
  }

  return w.end();
}
