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

export type AppStore = PullsSlice & ModulesSlice & UiSlice & SettingsSlice;

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
