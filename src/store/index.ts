import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { createPullsSlice, PullsSlice } from "./pullsSlice";
import { createModulesSlice, ModulesSlice } from "./modulesSlice";
import { createUiSlice, UiSlice } from "./uiSlice";
import { createSettingsSlice, SettingsSlice } from "./settingsSlice";

export type AppStore = PullsSlice & ModulesSlice & UiSlice & SettingsSlice;

export const useStore = create<AppStore>()(
  persist(
    immer((...a) => ({
      ...createPullsSlice(...a),
      ...createModulesSlice(...a),
      ...createUiSlice(...a),
      ...createSettingsSlice(...a),
    })),
    {
      name: "module-tracker-storage",
      partialize: (state) => ({
        pulls: state.pulls,
        moduleProgress: state.moduleProgress,
        bannerDefault: state.bannerDefault,
      }),
    }
  )
);
