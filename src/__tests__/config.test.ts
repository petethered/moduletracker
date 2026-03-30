import { describe, it, expect } from "vitest";
import { MODULES } from "../config/modules";
import { RARITY_COLORS, MODULE_RARITY_ORDER } from "../config/rarityColors";

describe("Module config", () => {
  it("has exactly 24 modules", () => {
    expect(MODULES).toHaveLength(24);
  });

  it("has 6 modules per type", () => {
    const byType = { cannon: 0, armor: 0, generator: 0, core: 0 };
    MODULES.forEach((m) => byType[m.type]++);
    expect(byType.cannon).toBe(6);
    expect(byType.armor).toBe(6);
    expect(byType.generator).toBe(6);
    expect(byType.core).toBe(6);
  });

  it("has unique IDs", () => {
    const ids = MODULES.map((m) => m.id);
    expect(new Set(ids).size).toBe(24);
  });

  it("has unique names", () => {
    const names = MODULES.map((m) => m.name);
    expect(new Set(names).size).toBe(24);
  });
});

describe("Rarity colors", () => {
  it("has all 6 rarity tiers", () => {
    expect(Object.keys(RARITY_COLORS)).toEqual(
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
