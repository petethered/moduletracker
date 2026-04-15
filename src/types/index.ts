export type ModuleType = "cannon" | "armor" | "generator" | "core";

export type BannerType = "standard" | "featured" | "lucky";

export type ModuleRarity =
  | "epic"
  | "epic+"
  | "legendary"
  | "legendary+"
  | "mythic"
  | "mythic+"
  | "ancestral"
  | "1*"
  | "2*"
  | "3*"
  | "4*"
  | "5*";

export interface ModuleDefinition {
  id: string;
  name: string;
  type: ModuleType;
  uniqueAbility: string;
}

export interface PullRecord {
  id: string;
  date: string;
  commonCount: number;
  rareCount: number;
  epicModules: string[];
  gemsSpent: number;
  bannerType: BannerType;
}

export interface ModuleProgress {
  moduleId: string;
  currentRarity: ModuleRarity;
}

export type TabId = "dashboard" | "history" | "modules" | "analytics";
