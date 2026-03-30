import type { ModuleRarity } from "../types";

export const RARITY_COLORS = {
  common: "#ffffff",
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#eab308",
  mythic: "#ef4444",
  ancestral: "#22c55e",
} as const;

export type RarityTier = keyof typeof RARITY_COLORS;

export const MODULE_RARITY_ORDER: ModuleRarity[] = [
  "epic",
  "epic+",
  "legendary",
  "legendary+",
  "mythic",
  "mythic+",
  "ancestral",
  "1*",
  "2*",
  "3*",
  "4*",
  "5*",
];

export function getModuleRarityColor(rarity: ModuleRarity): string {
  if (rarity.startsWith("epic")) return RARITY_COLORS.epic;
  if (rarity.startsWith("legendary")) return RARITY_COLORS.legendary;
  if (rarity.startsWith("mythic")) return RARITY_COLORS.mythic;
  if (rarity === "ancestral" || rarity.endsWith("*"))
    return RARITY_COLORS.ancestral;
  return RARITY_COLORS.common;
}
