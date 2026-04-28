/**
 * Auth slice — minimal identity + cloud-sync gating state.
 *
 * RESPONSIBILITY:
 * Holds the small surface area needed to (a) remember who the signed-in
 * user is, (b) decide whether cloud sync should run, and (c) surface
 * sync activity to the UI. Actual sync I/O lives in src/services/sync.ts —
 * this slice is purely state.
 *
 * DEPENDED ON BY:
 * - src/services/sync.ts (reads user/syncEnabled/storageChoice; writes syncStatus)
 * - Settings UI (toggles syncEnabled, displays storageChoice)
 * - First-run onboarding (sets storageChoice once the user picks local vs cloud)
 * - Header / status indicators (read syncStatus to show spinner/check/error)
 *
 * PERSISTED FIELDS (in partialize whitelist):
 *   - user           : { email } | null — minimal identity, NOT a full session token.
 *                      Tokens live in the sync service / its own secure storage.
 *   - syncEnabled    : boolean — user's on/off switch for cloud sync.
 *   - storageChoice  : "local" | "cloud" | null — first-run answer; null means
 *                      onboarding hasn't asked yet.
 *
 * NOT PERSISTED:
 *   - syncStatus     : "idle" | (etc., see SyncStatus) — transient activity
 *                      indicator, must reset on reload to avoid stale spinners.
 *
 * INVARIANTS:
 * - storageChoice transitions from null -> "local" | "cloud" once during
 *   onboarding. Subsequent changes go through setStorageChoice. The null
 *   case is the signal "show the storage-choice prompt".
 * - syncEnabled defaults TRUE; sync.ts additionally requires user !== null
 *   AND storageChoice === "cloud" before doing any network work.
 *
 * REJECTED ALTERNATIVES:
 * - Storing the auth token here: rejected — keep secrets out of the store
 *   that's mirrored to localStorage in plaintext. The sync service handles tokens.
 */

import type { StateCreator } from "zustand/vanilla";
import type { SyncStatus } from "../services/sync";

/**
 * Public surface of the auth slice.
 *
 * Fields:
 *   user            — minimal identity ({ email } only) or null when signed out.
 *   syncEnabled     — user's master toggle for cloud sync.
 *   syncStatus      — transient activity indicator (NOT persisted).
 *   storageChoice   — onboarding answer; null means "not chosen yet, ask".
 *
 * Actions:
 *   setUser            — set/clear the signed-in user (sign-in / sign-out).
 *   setSyncEnabled     — toggle the master sync switch.
 *   setSyncStatus      — written by sync.ts during sync operations.
 *   setStorageChoice   — record the user's local-vs-cloud decision.
 */
export interface AuthSlice {
  user: { email: string } | null;
  syncEnabled: boolean;
  syncStatus: SyncStatus;
  storageChoice: "local" | "cloud" | null;

  /** Set (sign-in) or clear (sign-out) the current user. Persisted. */
  setUser: (user: { email: string } | null) => void;
  /** Master on/off for cloud sync. Persisted. */
  setSyncEnabled: (enabled: boolean) => void;
  /** Transient indicator updated by sync.ts. NOT persisted (always resets on reload). */
  setSyncStatus: (status: SyncStatus) => void;
  /** First-run / settings-driven choice between "local" and "cloud" storage. Persisted. */
  setStorageChoice: (choice: "local" | "cloud") => void;
}

export const createAuthSlice: StateCreator<
  AuthSlice,
  [["zustand/immer", never]],
  [],
  AuthSlice
> = (set) => ({
  // Defaults for first-run users. Persist middleware overrides for returning users.
  user: null,
  // Default-on so existing users who sign in get sync without an extra step.
  syncEnabled: true,
  // Always starts idle on load — even if a sync was in flight when the tab closed.
  syncStatus: "idle",
  // null means "onboarding hasn't asked yet" — onboarding UI keys off this.
  storageChoice: null,

  setUser: (user) =>
    set((state) => {
      state.user = user;
    }),

  setSyncEnabled: (enabled) =>
    set((state) => {
      state.syncEnabled = enabled;
    }),

  setSyncStatus: (status) =>
    set((state) => {
      // Called frequently by sync.ts during sync lifecycle — keep this cheap.
      state.syncStatus = status;
    }),

  setStorageChoice: (choice) =>
    set((state) => {
      state.storageChoice = choice;
    }),
});
