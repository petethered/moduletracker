/**
 * UI slice — ephemeral session UI state (active tab, modal visibility, last-used form values).
 *
 * RESPONSIBILITY:
 * Owns transient UI state that should NOT survive a reload. Co-located in the
 * global store (rather than per-component useState) so any component can
 * trigger a tab switch or open the add-pull modal — particularly important
 * for keyboard shortcuts, deep-linked actions, and the empty-state CTAs that
 * jump from one tab to opening a modal in another flow.
 *
 * DEPENDED ON BY:
 * - src/components/* tab bar + header
 * - src/features/pulls/* (modal open/close + edit-id wiring)
 * - src/features/settings/* (settingsOpen drawer/modal)
 * - Add-pull form (lastUsedDate / lastUsedBannerType prefill)
 *
 * PERSISTED: NO. None of these fields are in the partialize whitelist.
 * That is intentional:
 *   - activeTab: always start on dashboard so users see "the summary" first.
 *   - modal flags / editingPullId: half-open modals after a reload would be confusing.
 *   - lastUsedDate / lastUsedBannerType: session-scoped prefill, not a preference.
 *     The persisted equivalent for banner is settingsSlice.bannerDefault.
 *
 * INVARIANTS:
 * - editingPullId is non-null IFF the modal was opened via openEditPullModal.
 *   openAddPullModal MUST clear it; closePullModal MUST clear it. Components
 *   read editingPullId to decide between "create new" and "edit existing" mode.
 * - Only ONE of the add/edit pull modal states exists; both go through
 *   isAddPullModalOpen. The flag name is historical — it covers both add and edit.
 */

import type { StateCreator } from "zustand/vanilla";
import type { BannerType, TabId } from "../types";

/**
 * Public surface of the UI slice.
 *
 * Fields:
 *   activeTab            — which top-level tab is rendered.
 *   isAddPullModalOpen   — controls the unified add/edit pull modal.
 *   editingPullId        — non-null while editing; null while adding.
 *   settingsOpen         — controls the settings drawer/modal.
 *   lastUsedDate         — session prefill for the date field on add-pull.
 *   lastUsedBannerType   — session prefill for banner on add-pull (overrides default for next add).
 *
 * Actions:
 *   setActiveTab            — switch tabs.
 *   openAddPullModal        — open in "create" mode (clears editingPullId).
 *   openEditPullModal       — open in "edit" mode (sets editingPullId).
 *   closePullModal          — close + clear editingPullId.
 *   setLastUsedDate         — remember the date the user just submitted.
 *   setLastUsedBannerType   — remember the banner the user just submitted.
 *   toggleSettings          — flip settings drawer.
 *   closeSettings           — force-close settings drawer.
 */
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
  // Defaults — applied on every fresh session (these are not persisted).
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
      // Open the modal AND clear editingPullId so the form renders in create mode.
      // If editingPullId leaked across opens, the form would mistakenly behave as edit.
      state.isAddPullModalOpen = true;
      state.editingPullId = null;
    }),

  openEditPullModal: (pullId) =>
    set((state) => {
      // Reuses the same modal as add — components key off editingPullId !== null
      // to switch into edit mode and prefill from the matching PullRecord.
      state.isAddPullModalOpen = true;
      state.editingPullId = pullId;
    }),

  closePullModal: () =>
    set((state) => {
      // Always clear editingPullId on close so the next open starts clean.
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
