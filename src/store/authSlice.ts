import type { StateCreator } from "zustand/vanilla";
import type { SyncStatus } from "../services/sync";

export interface AuthSlice {
  user: { email: string } | null;
  syncEnabled: boolean;
  syncStatus: SyncStatus;
  storageChoice: "local" | "cloud" | null;

  setUser: (user: { email: string } | null) => void;
  setSyncEnabled: (enabled: boolean) => void;
  setSyncStatus: (status: SyncStatus) => void;
  setStorageChoice: (choice: "local" | "cloud") => void;
}

export const createAuthSlice: StateCreator<
  AuthSlice,
  [["zustand/immer", never]],
  [],
  AuthSlice
> = (set) => ({
  user: null,
  syncEnabled: true,
  syncStatus: "idle",
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
      state.syncStatus = status;
    }),

  setStorageChoice: (choice) =>
    set((state) => {
      state.storageChoice = choice;
    }),
});
