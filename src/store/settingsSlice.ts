import type { StateCreator } from "zustand/vanilla";
import type { BannerType } from "../types";

export interface SettingsSlice {
  bannerDefault: BannerType;
  setBannerDefault: (banner: BannerType) => void;
}

export const createSettingsSlice: StateCreator<
  SettingsSlice,
  [["zustand/immer", never]],
  [],
  SettingsSlice
> = (set) => ({
  bannerDefault: "standard",

  setBannerDefault: (banner) =>
    set((state) => {
      state.bannerDefault = banner;
    }),
});
