import { StateCreator } from "zustand";
import { v4 as uuidv4 } from "uuid";
import type { PullRecord } from "../types";

export interface PullsSlice {
  pulls: PullRecord[];
  addPull: (pull: Omit<PullRecord, "id">) => void;
  updatePull: (id: string, pull: Partial<Omit<PullRecord, "id">>) => void;
  deletePull: (id: string) => void;
  importPulls: (pulls: PullRecord[]) => void;
  clearPulls: () => void;
}

export const createPullsSlice: StateCreator<
  PullsSlice,
  [["zustand/immer", never]],
  [],
  PullsSlice
> = (set) => ({
  pulls: [],

  addPull: (pull) =>
    set((state) => {
      state.pulls.push({ ...pull, id: uuidv4() });
    }),

  updatePull: (id, updates) =>
    set((state) => {
      const index = state.pulls.findIndex((p) => p.id === id);
      if (index !== -1) {
        Object.assign(state.pulls[index], updates);
      }
    }),

  deletePull: (id) =>
    set((state) => {
      state.pulls = state.pulls.filter((p) => p.id !== id);
    }),

  importPulls: (pulls) =>
    set((state) => {
      state.pulls = pulls;
    }),

  clearPulls: () =>
    set((state) => {
      state.pulls = [];
    }),
});
