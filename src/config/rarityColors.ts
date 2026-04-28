/**
 * Rarity ladder, fusion thresholds, and color mapping for module rarities.
 *
 * ROLE IN SYSTEM:
 * The Tower (idle tower defense) uses a 6-tier base rarity system, with the
 * top tier (`ancestral`) extended into 5 star levels (1*-5*). Rarities are
 * also internally subdivided with a `+` plus-tier (e.g. `epic+`, `mythic+`)
 * representing a half-step inside the same color band. This file is the
 * canonical source for:
 *   - The display color for each rarity (used by chips, badges, rarity rings)
 *   - The order rarities appear in dropdowns / sort comparators
 *   - The cumulative-copies-needed table that drives the rarity progression
 *     in `src/store/modulesSlice.ts` (when a pull adds a copy, we look up the
 *     resulting rarity here)
 *
 * IMPORTERS (non-exhaustive):
 *   - src/components/ui/RarityBadge.tsx
 *   - src/features/modules/* (rarity edit controls, progression bars)
 *   - src/store/modulesSlice.ts (auto-rarity-from-copies logic)
 *   - src/store/selectors.ts
 *
 * GOTCHAS:
 *   - The 6-tier rarity color set (common-rare-epic-legendary-mythic-
 *     ancestral) is a hardcoded convention spelled out in CLAUDE.md. Don't
 *     change colors on a whim — they match the in-game palette and players
 *     pattern-match on them.
 *   - The `+` plus-tier variants share their color with the base tier — we
 *     handle that in `getModuleRarityColor` via `startsWith`.
 *   - Star levels (1*-5*) are all green/ancestral. They're treated as a
 *     single color band visually, but distinct entries in MODULE_RARITY_ORDER
 *     because they're meaningfully different progression states.
 *   - `common` and `rare` colors exist in RARITY_COLORS but no entry in
 *     MODULE_RARITY_ORDER currently uses them — modules in The Tower start
 *     at `epic`. The colors are kept for potential future use (e.g. items
 *     other than modules, or pre-epic shards if that ever ships).
 */

import type { ModuleRarity } from "../types";

/**
 * Hex color codes for each rarity tier name.
 *
 * GAME-CONVENTION COLORS (per CLAUDE.md):
 *   common     -> white   (#ffffff)
 *   rare       -> blue    (#3b82f6, tailwind blue-500)
 *   epic       -> purple  (#a855f7, tailwind purple-500)
 *   legendary  -> gold    (#eab308, tailwind yellow-500)
 *   mythic     -> red     (#ef4444, tailwind red-500)
 *   ancestral  -> green   (#22c55e, tailwind green-500)
 *
 * Frozen with `as const` so consumers can derive a literal type from the keys.
 *
 * IF YOU ADD A NEW TIER: also extend `ModuleRarity` in src/types/index.ts and
 *   update MODULE_RARITY_ORDER plus RARITY_COPY_THRESHOLDS below.
 */
export const RARITY_COLORS = {
  common: "#ffffff",
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#eab308",
  mythic: "#ef4444",
  ancestral: "#22c55e",
} as const;

/**
 * Type alias for the 6 base color-tier keys (`'common' | 'rare' | ... | 'ancestral'`).
 * NOTE: This is NOT the same as `ModuleRarity` from types/index.ts — that one
 * also includes `epic+`, `mythic+`, and the star levels `1*` through `5*`.
 */
export type RarityTier = keyof typeof RARITY_COLORS;

/**
 * Canonical ascending order of every module-rarity progression state.
 *
 * USE WHEN: sorting rarities in selectors/UI, comparing two rarities, or
 *   driving any "next/previous rarity" UI affordance (use array index).
 *
 * ORDER (low -> high progression):
 *   epic -> epic+ -> legendary -> legendary+ -> mythic -> mythic+ ->
 *   ancestral -> 1* -> 2* -> 3* -> 4* -> 5*
 *
 * INVARIANT: This order MUST match RARITY_COPY_THRESHOLDS below (same
 *   sequence). `getRarityForCopies` walks RARITY_COPY_THRESHOLDS in order
 *   and assumes monotonically-increasing thresholds.
 *
 * NOTE: Modules in The Tower do not drop below `epic` — `common` and `rare`
 *   colors exist in RARITY_COLORS but no module rarity uses them today.
 */
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

/**
 * Cumulative copies of the same module needed to reach each rarity.
 *
 * UNITS: `copies` is an absolute (non-additive) integer count of module
 *   copies the player has ever fused into this slot. e.g. `legendary+`
 *   requires 4 total copies — not 4 more after legendary.
 *
 * SHAPE: ordered array (NOT a map) because:
 *   1. Order matters — `getRarityForCopies` iterates and picks the highest
 *      threshold the copy count satisfies.
 *   2. Multiple rarities can share the same copy count (e.g. `epic+` and
 *      `legendary` both at 2 — the later entry wins, which is the intended
 *      "highest reachable" behavior).
 *
 * ORDERING INVARIANT: must match MODULE_RARITY_ORDER (ascending).
 * THRESHOLD INVARIANT: `copies` must be monotonically non-decreasing.
 *
 * IF YOU ADD A NEW TIER: insert it in the correct sorted position AND add
 *   the same tier to MODULE_RARITY_ORDER at the same index.
 *
 * GAME-DESIGN NOTE: thresholds reflect the in-game fusion economy (more
 *   copies needed at higher tiers). Don't tweak unless the game itself
 *   changes — these aren't UI knobs.
 */
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

/**
 * Given a cumulative copy count, return the highest rarity achievable.
 *
 * @param copies Total copies fused (>= 0).
 * @returns The highest ModuleRarity reached, or `null` if `copies < 1`
 *   (player hasn't pulled the module at all yet — there is no rarity to
 *   show).
 *
 * EDGE CASES:
 *   - `copies === 0` -> `null` (nothing pulled).
 *   - `copies === 1` -> `'epic'` (lowest module rarity in The Tower).
 *   - Very large counts plateau at `'5*'` — the loop simply never finds a
 *     higher threshold. There is no over-cap or wrap-around behavior.
 *
 * IMPLEMENTATION DETAIL: Walks RARITY_COPY_THRESHOLDS top-down and keeps
 *   the last (highest) tier whose threshold is satisfied. Relies on the
 *   ordering invariant of RARITY_COPY_THRESHOLDS — if you reorder that
 *   table, this function breaks silently.
 */
export function getRarityForCopies(copies: number): ModuleRarity | null {
  if (copies < 1) return null;
  let best: ModuleRarity = "epic";
  for (const t of RARITY_COPY_THRESHOLDS) {
    if (copies >= t.copies) best = t.rarity;
  }
  return best;
}

/**
 * Map any ModuleRarity (including `+` variants and star levels) to its
 * display hex color.
 *
 * MAPPING RULES:
 *   - `epic`, `epic+`           -> RARITY_COLORS.epic     (purple)
 *   - `legendary`, `legendary+` -> RARITY_COLORS.legendary (gold)
 *   - `mythic`, `mythic+`       -> RARITY_COLORS.mythic   (red)
 *   - `ancestral`               -> RARITY_COLORS.ancestral (green)
 *   - any `*`-suffixed star tier (`1*`-`5*`) -> RARITY_COLORS.ancestral (green)
 *   - fallthrough               -> RARITY_COLORS.common   (white)
 *
 * RATIONALE: star tiers are a sub-progression INSIDE the ancestral band, so
 *   they share the green color. The `+` plus-tiers are half-steps inside
 *   their base color band, so they also share.
 *
 * GOTCHA: The fallthrough returning `common` (white) means an unknown /
 *   misspelled rarity will silently render as white instead of throwing.
 *   This is intentional for forward-compat (new tiers added in types but
 *   not yet handled here). If you add a new color band, ADD A CASE here
 *   before the `endsWith('*')` check or it may be misclassified.
 */
export function getModuleRarityColor(rarity: ModuleRarity): string {
  if (rarity.startsWith("epic")) return RARITY_COLORS.epic;
  if (rarity.startsWith("legendary")) return RARITY_COLORS.legendary;
  if (rarity.startsWith("mythic")) return RARITY_COLORS.mythic;
  if (rarity === "ancestral" || rarity.endsWith("*"))
    return RARITY_COLORS.ancestral;
  return RARITY_COLORS.common;
}
