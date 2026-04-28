/**
 * Root Zustand store composition + localStorage persistence boundary.
 *
 * RESPONSIBILITY:
 * Composes all slice creators (pulls, modules, ui, settings, auth) into a
 * single AppStore, wraps them with Immer (so slices can use draft mutation
 * syntax), and wraps THAT with the persist middleware so a curated subset
 * of state survives page reload.
 *
 * DEPENDED ON BY:
 * - Every component that calls useStore(...)
 * - src/services/sync.ts (cloud sync reads/writes through this same store)
 * - All selectors in src/store/selectors.ts (consumers pass store fields in)
 *
 * MIDDLEWARE ORDER (outer -> inner): persist( immer( slices ) ).
 * Persist must wrap immer so the rehydrated state is fed through the immer
 * layer; swapping the order breaks draft mutation in slice setters.
 *
 * PERSISTENCE — READ THIS BEFORE TOUCHING `partialize`:
 * Storage key: "module-tracker-storage" (localStorage). Only the keys listed
 * in `partialize` are written. Everything else (activeTab, modal state,
 * syncStatus, lastUsed*) is intentionally ephemeral. Adding a new persisted
 * key is a breaking-shape change — invoke the local-storage-safety-reviewer
 * agent (see CLAUDE.md) and consider migration for existing users.
 *
 * REJECTED ALTERNATIVES:
 * - Per-slice persist middlewares: rejected; one storage key is simpler
 *   and avoids partial-rehydrate races.
 * - Storing derived stats: forbidden by project convention — selectors only.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { createPullsSlice } from "./pullsSlice";
import type { PullsSlice } from "./pullsSlice";
import { createModulesSlice } from "./modulesSlice";
import type { ModulesSlice } from "./modulesSlice";
import { createUiSlice } from "./uiSlice";
import type { UiSlice } from "./uiSlice";
import { createSettingsSlice } from "./settingsSlice";
import type { SettingsSlice } from "./settingsSlice";
import { createAuthSlice } from "./authSlice";
import type { AuthSlice } from "./authSlice";

/**
 * Combined store shape — intersection of every slice. Components type their
 * useStore selectors against this. When adding a new slice, extend this union
 * AND add the spread to the immer initializer below.
 */
export type AppStore = PullsSlice & ModulesSlice & UiSlice & SettingsSlice & AuthSlice;

/**
 * The single global store instance. Imported by every consumer as `useStore`.
 *
 * The `(...a)` rest-args dance is required because each slice creator wants
 * its own narrow type for (set, get, api) but immer's type inference can't
 * propagate that through the spread. Casting per-call to each slice's
 * Parameters<typeof X> keeps each slice's `set` correctly typed as an
 * Immer-aware setter without disabling type-checking inside the slice files.
 * The eslint-disable lines suppress the explicit-any warnings on each cast —
 * do not remove them unless you've replaced the casts with a real fix.
 */
export const useStore = create<AppStore>()(
  persist(
    immer((...a) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...createPullsSlice(...(a as Parameters<typeof createPullsSlice>)),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...createModulesSlice(...(a as Parameters<typeof createModulesSlice>)),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...createUiSlice(...(a as Parameters<typeof createUiSlice>)),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...createSettingsSlice(...(a as Parameters<typeof createSettingsSlice>)),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...createAuthSlice(...(a as Parameters<typeof createAuthSlice>)),
    })),
    {
      // localStorage key. Changing this string orphans every existing user's data.
      name: "module-tracker-storage",
      // Whitelist of state keys to persist. Anything not listed here resets on reload.
      // Currently persisted (6 keys):
      //   - pulls:           full pull history (PullRecord[])
      //   - moduleProgress:  per-module rarity progress map
      //   - bannerDefault:   user's preferred default banner for new pulls
      //   - storageChoice:   "local" | "cloud" | null — drives cloud-sync gating
      //   - syncEnabled:     whether sync is on for this device
      //   - user:            { email } | null — minimal auth identity
      // NOT persisted by design: activeTab, modal state, syncStatus, lastUsedDate,
      // lastUsedBannerType. These are session UI state.
      partialize: (state) => ({
        pulls: state.pulls,
        moduleProgress: state.moduleProgress,
        bannerDefault: state.bannerDefault,
        storageChoice: state.storageChoice,
        syncEnabled: state.syncEnabled,
        user: state.user,
      }),
    }
  )
);
