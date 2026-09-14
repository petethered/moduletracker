import { describe, it, expect, beforeEach } from "vitest";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { createModulesSlice, type ModulesSlice } from "../store/modulesSlice";

function createTestStore() {
  return create<ModulesSlice>()(immer((...a) => createModulesSlice(...a)));
}

describe("modulesSlice", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  it("sets several module rarities in one update, leaving others untouched", () => {
    store.getState().updateModuleRarity("om-chip", "1*");
    store.getState().updateModuleRarity("death-penalty", "epic");
    store.getState().setModuleRarities({ "death-penalty": "3*", "gilded-sniper": "ancestral" });
    expect(store.getState().moduleProgress).toEqual({
      "om-chip": { moduleId: "om-chip", currentRarity: "1*" },
      "death-penalty": { moduleId: "death-penalty", currentRarity: "3*" },
      "gilded-sniper": { moduleId: "gilded-sniper", currentRarity: "ancestral" },
    });
  });

  it("starts with empty moduleProgress", () => {
    expect(store.getState().moduleProgress).toEqual({});
  });

  it("updates module rarity", () => {
    store.getState().updateModuleRarity("death-penalty", "legendary");
    expect(store.getState().moduleProgress["death-penalty"]).toEqual({
      moduleId: "death-penalty",
      currentRarity: "legendary",
    });
  });

  it("overwrites existing rarity", () => {
    store.getState().updateModuleRarity("death-penalty", "epic");
    store.getState().updateModuleRarity("death-penalty", "mythic+");
    expect(
      store.getState().moduleProgress["death-penalty"].currentRarity
    ).toBe("mythic+");
  });

  it("imports module progress replacing existing", () => {
    store.getState().updateModuleRarity("death-penalty", "epic");
    store.getState().importModuleProgress({
      "shrink-ray": { moduleId: "shrink-ray", currentRarity: "ancestral" },
    });
    expect(store.getState().moduleProgress["death-penalty"]).toBeUndefined();
    expect(
      store.getState().moduleProgress["shrink-ray"].currentRarity
    ).toBe("ancestral");
  });

  it("clears all module progress", () => {
    store.getState().updateModuleRarity("death-penalty", "epic");
    store.getState().clearModuleProgress();
    expect(store.getState().moduleProgress).toEqual({});
  });
});
