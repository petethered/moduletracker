/**
 * Settings slice — persistent user preferences.
 *
 * RESPONSIBILITY:
 * Holds preference values that should survive reload. Today this is just
 * `bannerDefault`, but this slice is the place to add new persistent
 * preferences (e.g., theme, default form values, feature flags).
 *
 * DEPENDED ON BY:
 * - Add-pull form (uses bannerDefault as the initial banner if
 *   uiSlice.lastUsedBannerType is null).
 * - src/features/settings/* (the settings UI binds to setBannerDefault).
 *
 * PERSISTED: yes — `bannerDefault` is in the partialize whitelist (see store/index.ts).
 * Adding any new field here AND wanting it persisted requires updating
 * partialize AND running the local-storage-safety-reviewer agent.
 *
 * INVARIANT:
 * - bannerDefault is one of BannerType ("standard" | "featured" | "lucky").
 *   The default on first run is "standard" — matches the most common in-game
 *   banner so the form's initial state is the lowest-friction choice.
 *
 * REJECTED ALTERNATIVES:
 * - Folding bannerDefault into uiSlice: rejected — uiSlice is intentionally
 *   ephemeral. Persisted preferences belong here so the persistence boundary
 *   stays a property of the slice (easier audit).
 */

import type { StateCreator } from "zustand/vanilla";
import type { BannerType } from "../types";

/**
 * Public surface of the settings slice.
 *
 * Field:
 *   bannerDefault — the user's preferred default banner for new pulls.
 *
 * Action:
 *   setBannerDefault — overwrite bannerDefault. Persisted automatically.
 */
export interface SettingsSlice {
  bannerDefault: BannerType;
  /** Overwrite the persisted default banner used as a prefill on the add-pull form. */
  setBannerDefault: (banner: BannerType) => void;
}

export const createSettingsSlice: StateCreator<
  SettingsSlice,
  [["zustand/immer", never]],
  [],
  SettingsSlice
> = (set) => ({
  // Default for first-time users. Persist middleware overwrites from
  // localStorage on hydrate for returning users.
  bannerDefault: "standard",

  setBannerDefault: (banner) =>
    set((state) => {
      state.bannerDefault = banner;
    }),
});
