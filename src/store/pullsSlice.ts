/**
 * Pulls slice — CRUD over the user's 10x pull history.
 *
 * RESPONSIBILITY:
 * Owns `state.pulls: PullRecord[]`. This is the primary persisted dataset
 * and the input to virtually every selector in src/store/selectors.ts.
 *
 * DEPENDED ON BY:
 * - src/store/selectors.ts (every stat/chart derives from pulls)
 * - src/features/pulls/* (add/edit/delete UI)
 * - src/features/history/* (list view + import/export)
 * - src/services/sync.ts (cloud sync round-trips this array)
 *
 * INVARIANTS:
 * - Every record has a UUID v4 id assigned here, never by callers.
 *   Callers pass Omit<PullRecord, "id"> so they can't accidentally collide ids.
 * - Order in the array == insertion order. Selectors that need chronological
 *   order sort by date and break ties by array index — preserve insertion
 *   order on update (Object.assign in place, do NOT splice + push).
 * - The 10-per-pull invariant (commonCount + rareCount + epicModules.length === 10)
 *   is enforced at the form/validation layer, NOT here. This slice trusts callers.
 *
 * PERSISTED: yes — `pulls` is in the partialize whitelist (see store/index.ts).
 *
 * REJECTED ALTERNATIVES:
 * - Storing pulls keyed by id in a Record: rejected — order matters for the
 *   insertion-order tiebreaker, and arrays serialize cleanly to/from JSON.
 * - Caller-provided ids: rejected — too easy to collide on import/merge.
 */

import type { StateCreator } from "zustand/vanilla";
import { v4 as uuidv4 } from "uuid";
import type { PullRecord } from "../types";

/**
 * Public surface of the pulls slice.
 *
 * Field:
 *   pulls — the persisted history array (insertion-ordered).
 *
 * Actions:
 *   addPull       — append; assigns id.
 *   updatePull    — patch in place by id; preserves array position.
 *   deletePull    — remove by id.
 *   importPulls   — wholesale replacement (used by file import + cloud sync rehydrate).
 *   clearPulls    — wipe (settings -> reset).
 */
export interface PullsSlice {
  pulls: PullRecord[];
  /** Append a new pull. Caller supplies everything except `id`; we assign a UUID v4. */
  addPull: (pull: Omit<PullRecord, "id">) => void;
  /** Patch fields on an existing pull. No-ops silently if id not found (intentional — callers may race deletes). */
  updatePull: (id: string, pull: Partial<Omit<PullRecord, "id">>) => void;
  /** Remove a pull by id. */
  deletePull: (id: string) => void;
  /** Replace the entire pulls array. Used by file import and cloud-sync rehydrate. */
  importPulls: (pulls: PullRecord[]) => void;
  /** Wipe all pulls. Triggered from settings/reset flows. */
  clearPulls: () => void;
}

export const createPullsSlice: StateCreator<
  PullsSlice,
  [["zustand/immer", never]],
  [],
  PullsSlice
> = (set) => ({
  // Initial value. Persist middleware will overwrite this from localStorage on hydrate.
  pulls: [],

  addPull: (pull) =>
    set((state) => {
      // Assign UUID here (not at the call site) so callers can't collide ids by accident.
      // Push (not unshift) preserves insertion order — selectors rely on this for
      // same-date tiebreaking.
      state.pulls.push({ ...pull, id: uuidv4() });
    }),

  updatePull: (id, updates) =>
    set((state) => {
      // findIndex + Object.assign on the draft mutates in place, keeping the
      // record at its existing array position. Do NOT splice + push — that would
      // break insertion-order tiebreaking for same-date pulls.
      const index = state.pulls.findIndex((p) => p.id === id);
      if (index !== -1) {
        Object.assign(state.pulls[index], updates);
      }
      // Silent no-op if not found: protects against races where the user deletes
      // a pull while an edit modal is mid-flight.
    }),

  deletePull: (id) =>
    set((state) => {
      // Filter rebuilds the array; remaining elements keep relative order, so
      // the insertion-order tiebreaker for same-date pulls remains correct.
      state.pulls = state.pulls.filter((p) => p.id !== id);
    }),

  importPulls: (pulls) =>
    set((state) => {
      // Wholesale replacement — used by JSON import AND by sync rehydrate.
      // Caller is responsible for validating shape; this slice trusts the array.
      state.pulls = pulls;
    }),

  clearPulls: () =>
    set((state) => {
      state.pulls = [];
    }),
});
