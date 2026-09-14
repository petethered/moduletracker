import { describe, it, expect } from "vitest";
import { COMMON_AND_RARE_BASE_GAME_INDEXES, MODULES } from "../config/modules";
import { MODULE_RARITY_COLORS, MODULE_RARITY_ORDER } from "../config/moduleRarities";

describe("Module config", () => {
  it("has exactly 26 modules", () => {
    expect(MODULES).toHaveLength(26);
  });

  it("has 7 cannon, 7 armor, 6 generator and 6 core modules", () => {
    const byType = { cannon: 0, armor: 0, generator: 0, core: 0 };
    MODULES.forEach((m) => byType[m.type]++);
    expect(byType.cannon).toBe(7);
    expect(byType.armor).toBe(7);
    expect(byType.generator).toBe(6);
    expect(byType.core).toBe(6);
  });

  it("has unique IDs", () => {
    const ids = MODULES.map((m) => m.id);
    expect(new Set(ids).size).toBe(MODULES.length);
  });

  it("has unique names", () => {
    const names = MODULES.map((m) => m.name);
    expect(new Set(names).size).toBe(MODULES.length);
  });

  it("has a unique positive game index per module", () => {
    const indexes = MODULES.map((m) => m.gameIndex);
    expect(indexes.every((i) => Number.isInteger(i) && i > 0)).toBe(true);
    expect(new Set(indexes).size).toBe(MODULES.length);
  });

  // A tracked module whose gameIndex is in the common/rare-base set would be
  // silently skipped by Import Player Info forever.
  it("never gives a tracked module a common/rare-base game index", () => {
    const overlap = MODULES.filter((m) => COMMON_AND_RARE_BASE_GAME_INDEXES.has(m.gameIndex));
    expect(overlap.map((m) => m.id)).toEqual([]);
  });

  // Spot-checks against the game's own index table (verified against a real
  // playerInfo.dat and mytower.app's importer). Guards against a copy-paste
  // shifting indexes when a module is added.
  it("maps game indexes the way playerInfo.dat does", () => {
    const byIndex = Object.fromEntries(MODULES.map((m) => [m.gameIndex, m.id]));
    expect(byIndex[7]).toBe("havoc-bringer");
    expect(byIndex[20]).toBe("anti-cube-portal");
    expect(byIndex[27]).toBe("black-hole-digestor");
    expect(byIndex[40]).toBe("om-chip");
    expect(byIndex[50]).toBe("sentry-protocol");
    expect(byIndex[51]).toBe("gilded-sniper");
  });
});

describe("Rarity colors", () => {
  it("has all 6 rarity tiers", () => {
    expect(Object.keys(MODULE_RARITY_COLORS)).toEqual(
      expect.arrayContaining([
        "common",
        "rare",
        "epic",
        "legendary",
        "mythic",
        "ancestral",
      ])
    );
  });
});

describe("Module rarity order", () => {
  it("starts at epic and ends at 5*", () => {
    expect(MODULE_RARITY_ORDER[0]).toBe("epic");
    expect(MODULE_RARITY_ORDER[MODULE_RARITY_ORDER.length - 1]).toBe("5*");
  });

  it("has 12 entries", () => {
    expect(MODULE_RARITY_ORDER).toHaveLength(12);
  });
});
