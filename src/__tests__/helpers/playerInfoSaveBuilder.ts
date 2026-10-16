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
 *     moduleRecords      List<ModuleRegistry> -> { _items: ModuleRegistry[], _size }
 *   ModuleItem { infoIndex: int, currentRarity: ModuleRarity { value__: int }, level: int }
 *   ModuleRegistry { infoIndex: int, rarity: ModuleRarity, dateObtained: long, origin: string | null }
 *     — one per module DROP (the game's rolling pull log). dateObtained is
 *     .NET DateTime ticks in UTC (0001-01-01 epoch, 100 ns units).
 *
 * Real saves carry hundreds of other members; the parser must not depend on
 * them, so the builder deliberately omits them.
 */
import { NrbfWriter, PrimitiveType as PT, type MemberType } from "./nrbfWriter";

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

/** One drop in the save's pull log (moduleRecords). */
export interface SavedPullDrop {
  infoIndex: number;
  /** Raw game rarity enum (drops are 1 Common, 2 Rare or 4 Epic). */
  rarity: number;
  /** When it dropped, as epoch milliseconds (converted to .NET ticks on write). */
  at: number;
  /** Banner name; real saves before ~Sept 2026 store null. */
  origin?: string | null;
}

/**
 * .NET ticks at the Unix epoch. ticks = TICKS_AT_UNIX_EPOCH + ms * 10_000.
 * Deliberately a COPY of the constant in playerInfoPulls.ts, not an import: a
 * shared constant would make the tests agree with the code by construction.
 */
const TICKS_AT_UNIX_EPOCH = 621355968000000000n;

/**
 * Build `count` ten-pulls' worth of drops, oldest first. Each pull's ten drops
 * are 1 ms apart (as in real saves); pulls start `gapMs` apart. `pulls[i]`
 * says how many commons/rares there are and which epic indexes dropped.
 */
export function buildPullDrops(
  pulls: { common: number; rare: number; epics?: number[] }[],
  startMs: number,
  origin: string | null = "Test Banner",
  gapMs = 10_000,
): SavedPullDrop[] {
  const drops: SavedPullDrop[] = [];
  pulls.forEach((p, i) => {
    const rarities = [
      ...Array<number>(p.common).fill(GameRarity.common),
      ...Array<number>(p.rare).fill(GameRarity.rare),
    ];
    const items = [
      ...rarities.map((rarity) => ({ infoIndex: rarity === GameRarity.common ? 1 : 3, rarity })),
      ...(p.epics ?? []).map((infoIndex) => ({ infoIndex, rarity: GameRarity.epic })),
    ];
    items.forEach((it, j) => drops.push({ ...it, at: startMs + i * gapMs + j, origin }));
  });
  return drops;
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
  /** The pull log (moduleRecords), oldest first. Omitted = no moduleRecords member, like very old saves. */
  pullDrops?: SavedPullDrop[];
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
  const recordsId = id();
  const drops = spec.pullDrops;
  w.classWithMembersAndTypes(1, spec.rootClass ?? "SaveLoad+PlayerData", [
    ["playerLevel", { kind: "primitive", primitive: PT.int32 }],
    ["inventory", { kind: "systemClass", className: "System.Collections.Generic.List`1[[ModuleItem]]" }],
    ["moduleEquipped", { kind: "object" }],
    ["assistModuleSlots", { kind: "object" }],
    ...(drops ? [["moduleRecords", { kind: "systemClass", className: "System.Collections.Generic.List`1[[ModuleRegistry]]" }] as [string, MemberType]] : []),
  ], LIB);
  w.primitive(PT.int32, 5);
  w.reference(inventoryId);
  w.reference(equippedId);
  w.reference(assistId);
  if (drops) w.reference(recordsId);

  // ModuleRarity enum record: a nested class whose only member is value__.
  // Negative object id on purpose: real saves give nested value-type records
  // (enums, structs) negative ids. The reader must not assume ids are positive.
  const writeRarity = (rarity: number) => {
    const rarityId = -id();
    if (rarityMeta === null) {
      rarityMeta = rarityId;
      w.classWithMembersAndTypes(rarityId, "ModuleRarity", [["value__", { kind: "primitive", primitive: PT.int32 }]], LIB);
    } else {
      w.classWithId(rarityId, rarityMeta);
    }
    w.primitive(PT.int32, rarity);
  };

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
    writeRarity(m.rarity);
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

  if (drops) {
    // moduleRecords: List<ModuleRegistry>, same _items/_size shape as inventory,
    // with a stale entry past _size (the parser must ignore it) and null padding.
    const recItemsId = id();
    w.classWithMembersAndTypes(recordsId, "System.Collections.Generic.List`1[[ModuleRegistry]]", [
      ["_items", { kind: "object" }],
      ["_size", { kind: "primitive", primitive: PT.int32 }],
      ["_version", { kind: "primitive", primitive: PT.int32 }],
    ], LIB);
    w.reference(recItemsId);
    w.primitive(PT.int32, drops.length);
    w.primitive(PT.int32, 1);
    const stale: SavedPullDrop = { infoIndex: 7, rarity: GameRarity.epic, at: 0, origin: null };
    const all = [...drops, stale];
    w.classArray(recItemsId, all.length + 2, "ModuleRegistry", LIB);
    let registryMeta: number | null = null;
    for (const d of all) {
      const regId = id();
      if (registryMeta === null) {
        registryMeta = regId;
        w.classWithMembersAndTypes(regId, "ModuleRegistry", [
          ["infoIndex", { kind: "primitive", primitive: PT.int32 }],
          ["rarity", { kind: "class", className: "ModuleRarity", libraryId: LIB }],
          ["dateObtained", { kind: "primitive", primitive: PT.int64 }],
          ["origin", { kind: "string" }],
        ], LIB);
      } else {
        w.classWithId(regId, registryMeta);
      }
      w.primitive(PT.int32, d.infoIndex);
      writeRarity(d.rarity);
      w.primitive(PT.int64, TICKS_AT_UNIX_EPOCH + BigInt(d.at) * 10_000n);
      if (d.origin == null) w.nullRecord();
      else w.string(id(), d.origin);
    }
    w.nullMultiple(2);
  }

  return w.end();
}
