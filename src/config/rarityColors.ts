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

/** Cumulative copies of the same module needed to reach each rarity */
export const RARITY_COPY_THRESHOLDS: { rarity: ModuleRarity; copies: number }[] = [
  { rarity: "epic", copies: 1 },
  { rarity: "epic+", copies: 2 },
  { rarity: "legendary", copies: 2 },
  { rarity: "legendary+", copies: 4 },
  { rarity: "mythic", copies: 4 },
  { rarity: "mythic+", copies: 4 },
  { rarity: "ancestral", copies: 8 },
  { rarity: "1*", copies: 10 },
  { rarity: "2*", copies: 12 },
  { rarity: "3*", copies: 14 },
  { rarity: "4*", copies: 16 },
  { rarity: "5*", copies: 18 },
];

/** Given a copy count, return the highest rarity achievable */
export function getRarityForCopies(copies: number): ModuleRarity | null {
  if (copies < 1) return null;
  let best: ModuleRarity = "epic";
  for (const t of RARITY_COPY_THRESHOLDS) {
    if (copies >= t.copies) best = t.rarity;
  }
  return best;
}

export function getModuleRarityColor(rarity: ModuleRarity): string {
  if (rarity.startsWith("epic")) return RARITY_COLORS.epic;
  if (rarity.startsWith("legendary")) return RARITY_COLORS.legendary;
  if (rarity.startsWith("mythic")) return RARITY_COLORS.mythic;
  if (rarity === "ancestral" || rarity.endsWith("*"))
    return RARITY_COLORS.ancestral;
  return RARITY_COLORS.common;
}
