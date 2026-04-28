/**
 * Modules slice — per-module rarity-progress tracking.
 *
 * RESPONSIBILITY:
 * Owns `state.moduleProgress: Record<moduleId, ModuleProgress>`. This is the
 * user-declared "what tier have I upgraded this module to" state. It is
 * SEPARATE from the pull history: pulls record drops, this records
 * post-merge upgrade state which the user enters manually.
 *
 * DEPENDED ON BY:
 * - src/features/modules/* (the modules grid UI)
 * - Selectors that surface "current rarity" alongside drop stats
 * - src/services/sync.ts (round-trips this map to/from the cloud)
 *
 * INVARIANTS:
 * - Map key === ModuleProgress.moduleId. The redundant id inside the value
 *   makes individual records self-describing for export, BUT updateModuleRarity
 *   is the single writer that enforces this invariant. If you add another
 *   writer, preserve it.
 * - moduleId values must match an entry in src/config/modules.ts. Stale ids
 *   (catalog entries removed) are tolerated in storage but won't render —
 *   consider a migration if/when modules are renamed.
 *
 * PERSISTED: yes — `moduleProgress` is in the partialize whitelist.
 *
 * REJECTED ALTERNATIVES:
 * - Deriving currentRarity from pulls + merge math: rejected. Players merge
 *   modules outside our tracking and need to record post-merge state directly.
 *   Pull data alone can't reconstruct user-driven upgrade decisions.
 * - Array of ModuleProgress: rejected — Record gives O(1) lookup by id and
 *   simpler merge semantics on import.
 */

import type { StateCreator } from "zustand/vanilla";
import type { ModuleProgress, ModuleRarity } from "../types";

/**
 * Public surface of the modules slice.
 *
 * Field:
 *   moduleProgress — id-keyed map of per-module rarity progress.
 *
 * Actions:
 *   updateModuleRarity    — set/overwrite a module's current rarity.
 *   importModuleProgress  — wholesale replacement (file import / sync rehydrate).
 *   clearModuleProgress   — wipe (settings -> reset).
 */
export interface ModulesSlice {
  moduleProgress: Record<string, ModuleProgress>;
  /** Set the current rarity for a module. Creates the entry if missing; overwrites if present. */
  updateModuleRarity: (moduleId: string, rarity: ModuleRarity) => void;
  /** Replace the entire progress map. Used by file import and cloud-sync rehydrate. */
  importModuleProgress: (progress: Record<string, ModuleProgress>) => void;
  /** Wipe all module progress. Triggered from settings/reset flows. */
  clearModuleProgress: () => void;
}

export const createModulesSlice: StateCreator<
  ModulesSlice,
  [["zustand/immer", never]],
  [],
  ModulesSlice
> = (set) => ({
  // Initial value. Persist middleware overwrites from localStorage on hydrate.
  moduleProgress: {},

  updateModuleRarity: (moduleId, rarity) =>
    set((state) => {
      // Always rebuild the value (not just `currentRarity = rarity`) so the
      // embedded moduleId stays consistent with the map key — preserves the
      // self-describing-record invariant required for clean export/sync.
      state.moduleProgress[moduleId] = { moduleId, currentRarity: rarity };
    }),

  importModuleProgress: (progress) =>
    set((state) => {
      // Wholesale replacement. Caller is responsible for shape validation.
      state.moduleProgress = progress;
    }),

  clearModuleProgress: () =>
    set((state) => {
      state.moduleProgress = {};
    }),
});
