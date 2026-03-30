import type { StateCreator } from "zustand/vanilla";
import type { TabId } from "../types";

export interface UiSlice {
  activeTab: TabId;
  isAddPullModalOpen: boolean;
  editingPullId: string | null;
  settingsOpen: boolean;
  setActiveTab: (tab: TabId) => void;
  openAddPullModal: () => void;
  openEditPullModal: (pullId: string) => void;
  closePullModal: () => void;
  toggleSettings: () => void;
  closeSettings: () => void;
}

export const createUiSlice: StateCreator<
  UiSlice,
  [["zustand/immer", never]],
  [],
  UiSlice
> = (set) => ({
  activeTab: "dashboard",
  isAddPullModalOpen: false,
  editingPullId: null,
  settingsOpen: false,

  setActiveTab: (tab) =>
    set((state) => {
      state.activeTab = tab;
    }),

  openAddPullModal: () =>
    set((state) => {
      state.isAddPullModalOpen = true;
      state.editingPullId = null;
    }),

  openEditPullModal: (pullId) =>
    set((state) => {
      state.isAddPullModalOpen = true;
      state.editingPullId = pullId;
    }),

  closePullModal: () =>
    set((state) => {
      state.isAddPullModalOpen = false;
      state.editingPullId = null;
    }),

  toggleSettings: () =>
    set((state) => {
      state.settingsOpen = !state.settingsOpen;
    }),

  closeSettings: () =>
    set((state) => {
      state.settingsOpen = false;
    }),
});
