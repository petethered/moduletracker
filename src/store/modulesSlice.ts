import type { StateCreator } from "zustand/vanilla";
import type { ModuleProgress, ModuleRarity } from "../types";

export interface ModulesSlice {
  moduleProgress: Record<string, ModuleProgress>;
  updateModuleRarity: (moduleId: string, rarity: ModuleRarity) => void;
  importModuleProgress: (progress: Record<string, ModuleProgress>) => void;
  clearModuleProgress: () => void;
}

export const createModulesSlice: StateCreator<
  ModulesSlice,
  [["zustand/immer", never]],
  [],
  ModulesSlice
> = (set) => ({
  moduleProgress: {},

  updateModuleRarity: (moduleId, rarity) =>
    set((state) => {
      state.moduleProgress[moduleId] = { moduleId, currentRarity: rarity };
    }),

  importModuleProgress: (progress) =>
    set((state) => {
      state.moduleProgress = progress;
    }),

  clearModuleProgress: () =>
    set((state) => {
      state.moduleProgress = {};
    }),
});
