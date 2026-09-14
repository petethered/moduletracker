import { describe, it, expect } from "vitest";
import { gzipSync } from "node:zlib";
import {
  PlayerInfoFormatError,
  decompressPlayerInfo,
  parsePlayerInfo,
  planModuleProgressImport,
} from "../features/settings/parsePlayerInfo";
import { buildPlayerInfoSave, GameRarity as R } from "./helpers/playerInfoSaveBuilder";

describe("parsePlayerInfo", () => {
  it("reads epic+ modules from inventory, equipped and assist slots", () => {
    const save = buildPlayerInfoSave({
      inventory: [{ infoIndex: 7, rarity: R.fiveStar }],        // Havoc Bringer
      equipped: [{ infoIndex: 51, rarity: R.ancestral }, null], // Gilded Sniper
      assist: [null, { infoIndex: 50, rarity: R.legendary }],   // Sentry Protocol
    });
    expect(parsePlayerInfo(save)).toEqual({
      modules: {
        "havoc-bringer": "5*",
        "gilded-sniper": "ancestral",
        "sentry-protocol": "legendary",
      },
      unsupportedGameIndexes: [],
    });
  });

  it("keeps the highest rarity when the player holds several copies", () => {
    const save = buildPlayerInfoSave({
      inventory: [
        { infoIndex: 9, rarity: R.epic },
        { infoIndex: 9, rarity: R.ancestral },
        { infoIndex: 9, rarity: R.epic },
      ],
      equipped: [{ infoIndex: 9, rarity: R.oneStar }],
    });
    expect(parsePlayerInfo(save).modules).toEqual({ "being-annihilator": "1*" });
  });

  it("ignores copies below Epic rarity, even of epic modules", () => {
    const save = buildPlayerInfoSave({
      inventory: [
        { infoIndex: 7, rarity: R.common },
        { infoIndex: 8, rarity: R.rare },
        { infoIndex: 9, rarity: R.rarePlus },
      ],
    });
    expect(parsePlayerInfo(save)).toEqual({ modules: {}, unsupportedGameIndexes: [] });
  });

  it("ignores rare-base modules even after they've been merged up to epic+", () => {
    // Rare modules (e.g. Bounce Blitzer, Diamond Nanowall) can merge past Epic.
    // They aren't epic modules: neither imported nor reported. Indexes taken
    // from a real save that showed exactly this.
    const save = buildPlayerInfoSave({
      inventory: [
        { infoIndex: 3, rarity: R.epic },       // Bounce Blitzer
        { infoIndex: 16, rarity: R.epic },      // Diamond Nanowall
        { infoIndex: 36, rarity: R.legendary }, // Matrix Sim
      ],
    });
    expect(parsePlayerInfo(save)).toEqual({ modules: {}, unsupportedGameIndexes: [] });
  });

  it("only reads the live part of the inventory list (ignores stale items past _size)", () => {
    const save = buildPlayerInfoSave({
      inventory: [{ infoIndex: 8, rarity: R.epic }],
      inventoryBeyondSize: [
        { infoIndex: 8, rarity: R.fiveStar },  // stale copy — must not raise Death Penalty
        { infoIndex: 10, rarity: R.epic },     // stale — Astral Deliverance must not appear
      ],
    });
    expect(parsePlayerInfo(save).modules).toEqual({ "death-penalty": "epic" });
  });

  it("reports modules the tracker doesn't support instead of dropping them silently", () => {
    const save = buildPlayerInfoSave({
      inventory: [
        { infoIndex: 49, rarity: R.epic },      // Acceleration Augment — not in the roster
        { infoIndex: 52, rarity: R.legendary }, // Tactical Barrage — not in the roster
        { infoIndex: 8, rarity: R.epic },       // Death Penalty
      ],
    });
    expect(parsePlayerInfo(save)).toEqual({
      modules: { "death-penalty": "epic" },
      unsupportedGameIndexes: [49, 52],
    });
  });

  it("skips (and reports) a known module holding a rarity newer than the tracker's ladder", () => {
    // e.g. a future Ancestral 6★ = 16. Importing only its lower fodder copy
    // would understate the module, so the whole module is skipped.
    const save = buildPlayerInfoSave({
      inventory: [
        { infoIndex: 7, rarity: 16 },
        { infoIndex: 7, rarity: R.epic },
        { infoIndex: 8, rarity: R.legendary },
      ],
    });
    expect(parsePlayerInfo(save)).toEqual({
      modules: { "death-penalty": "legendary" },
      unsupportedGameIndexes: [7],
    });
  });

  it("rejects a BinaryFormatter file that isn't a Tower save with a friendly error", () => {
    const notASave = buildPlayerInfoSave({ rootClass: "SomeOtherGame+Data" });
    expect(() => parsePlayerInfo(notASave)).toThrow(PlayerInfoFormatError);
    expect(() => parsePlayerInfo(notASave)).toThrow(/doesn't look like a The Tower save/i);
  });

  it("turns low-level decode failures into a friendly error (no parser internals)", () => {
    const garbage = new TextEncoder().encode('{"pulls": []}');
    expect(() => parsePlayerInfo(garbage)).toThrow(PlayerInfoFormatError);
    expect(() => parsePlayerInfo(garbage)).not.toThrow(/byte|record type|BinaryFormatter/i);
  });
});

describe("decompressPlayerInfo", () => {
  it("gunzips a compressed save", async () => {
    const save = buildPlayerInfoSave({ inventory: [{ infoIndex: 7, rarity: R.epic }] });
    const out = await decompressPlayerInfo(gzipSync(save));
    expect(Array.from(out)).toEqual(Array.from(save));
  });

  it("passes an already-decompressed save through unchanged", async () => {
    const save = buildPlayerInfoSave({});
    expect(await decompressPlayerInfo(save)).toBe(save);
  });

  it("rejects a corrupt gzip file with a friendly error", async () => {
    const corrupt = gzipSync(buildPlayerInfoSave({})).slice(0, 40);
    await expect(decompressPlayerInfo(corrupt)).rejects.toThrow(PlayerInfoFormatError);
  });

  it("stops decompressing past the size cap (gzip bomb guard)", async () => {
    const bomb = gzipSync(new Uint8Array(1_000_000)); // ~1 KB that inflates to 1 MB
    await expect(decompressPlayerInfo(bomb, 100_000)).rejects.toThrow(/too large/i);
  });
});

describe("planModuleProgressImport", () => {
  const current = {
    "havoc-bringer": { moduleId: "havoc-bringer", currentRarity: "4*" as const },
    "death-penalty": { moduleId: "death-penalty", currentRarity: "2*" as const },
    "om-chip": { moduleId: "om-chip", currentRarity: "1*" as const },
    "shrink-ray": { moduleId: "shrink-ray", currentRarity: "5*" as const },
  };

  it("raises and adds modules in roster order, never lowers, and leaves absent modules alone", () => {
    const plan = planModuleProgressImport(current, {
      "havoc-bringer": "5*",        // raised
      "death-penalty": "2*",        // unchanged
      "gilded-sniper": "ancestral", // new
      "shrink-ray": "3*",           // save is LOWER than the tracker — kept, not lowered
      // om-chip absent from the save — untouched, not listed
    });
    expect(plan.raises).toEqual([
      { moduleId: "havoc-bringer", name: "Havoc Bringer", from: "4*", to: "5*" },
      { moduleId: "gilded-sniper", name: "Gilded Sniper", from: null, to: "ancestral" },
    ]);
    expect(plan.keptHigher).toEqual([
      { moduleId: "shrink-ray", name: "Shrink Ray", tracker: "5*", save: "3*" },
    ]);
  });
});
