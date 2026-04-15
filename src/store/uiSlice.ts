import type { StateCreator } from "zustand/vanilla";
import type { BannerType, TabId } from "../types";

export interface UiSlice {
  activeTab: TabId;
  isAddPullModalOpen: boolean;
  editingPullId: string | null;
  settingsOpen: boolean;
  lastUsedDate: string | null;
  lastUsedBannerType: BannerType | null;
  setActiveTab: (tab: TabId) => void;
  openAddPullModal: () => void;
  openEditPullModal: (pullId: string) => void;
  closePullModal: () => void;
  setLastUsedDate: (date: string) => void;
  setLastUsedBannerType: (banner: BannerType) => void;
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
  lastUsedDate: null,
  lastUsedBannerType: null,

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

  setLastUsedDate: (date) =>
    set((state) => {
      state.lastUsedDate = date;
    }),

  setLastUsedBannerType: (banner) =>
    set((state) => {
      state.lastUsedBannerType = banner;
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
