/**
 * Display metadata for the four module types: colors, canonical ordering, and
 * human-readable labels.
 *
 * WHY THIS FILE EXISTS:
 * The color map used to be copy-pasted as raw hex literals into FOUR separate
 * feature components:
 *   - src/features/dashboard/ModuleCollectionGrid.tsx
 *   - src/features/dashboard/PullHighlights.tsx
 *   - src/features/dashboard/TypeBalance.tsx
 *   - src/features/analytics/ModuleDistributionChart.tsx
 * Four copies means four places to miss when the palette changes. Per
 * CLAUDE.md, config belongs in src/config/. Import from here instead.
 *
 * -----------------------------------------------------------------------
 * WHY THESE COLORS ARE MUTED (this is the important part — do not "fix" it)
 * -----------------------------------------------------------------------
 * The old palette reused the EXACT rarity hexes:
 *   cannon    #e94560  (= brand crimson)
 *   armor     #3b82f6  (= rare blue)
 *   generator #eab308  (= legendary gold)
 *   core      #a855f7  (= epic purple)
 *
 * So purple meant "epic rarity" in one grid and "core type" in another, and
 * the two encodings collided inside a single component: ModuleCollectionGrid
 * colors a tile by rarity when the player has one, and falls back to TYPE
 * color when they don't. Same swatch, two unrelated meanings, one grid.
 *
 * The fix is to give the two encodings different CHROMA rather than different
 * hues — the rarity ladder already occupies most of the color wheel (blue,
 * purple, amber, red, green), so there are no free hues left to hand out.
 * Rarity stays vivid because it is the emotionally loaded axis in a gacha
 * tracker; module type is supporting metadata and reads as a desaturated
 * family that sits behind it. A player scanning the collection grid should
 * see rarity first and type second, and now the palette enforces that
 * ordering instead of fighting it.
 *
 * All four clear WCAG AA against the app's navy surfaces (measured against
 * --color-navy-800 #0c0c1d):
 *   cannon    6.11:1
 *   armor     6.20:1
 *   generator 7.62:1
 *   core      6.25:1
 *
 * SINGLE SOURCE: this object only. There is deliberately NO matching
 * `--color-type-*` CSS variable set — every consumer passes these into a JS
 * API (Recharts `fill`, inline `style`), so a parallel CSS declaration would
 * be a second source of truth that nothing reads and that could silently
 * drift. Contrast with MODULE_RARITY_COLORS, which genuinely needs both because
 * rarity is styled via Tailwind classes AND drawn to <canvas>.
 *
 * IF YOU ADD A MODULE TYPE: extend `ModuleType` in src/types/index.ts, add the
 * entry here AND in index.css, add it to MODULE_TYPE_ORDER below, and add the
 * grouping in MODULES_BY_TYPE (src/config/modules.ts).
 */

import type { ModuleType } from "../types";

/**
 * Hex color per module type. Muted by design — see the file header.
 *
 * Annotated `Record<ModuleType, string>` so a missing or extra key is a
 * compile error rather than a runtime `undefined`. Deliberately NOT `as const`
 * (unlike MODULE_RARITY_COLORS in moduleRarities.ts): nothing needs the literal value
 * types here, the values are consumed as plain color strings. Do not "restore"
 * an `as const` — it conflicts with the Record annotation.
 */
export const MODULE_TYPE_COLORS: Record<ModuleType, string> = {
  cannon: "#c97d6d", // muted terracotta  — offensive
  armor: "#7d93b8", // muted steel blue  — defensive
  generator: "#b8a06a", // muted brass       — energy
  core: "#9d8bb5", // muted lavender    — special
};

/**
 * Canonical display order for module types.
 *
 * USE WHEN: iterating types for a grid, legend, chart series, or breakdown so
 * every surface lists them in the same sequence. This matches the grouping
 * order of MODULES_BY_TYPE in src/config/modules.ts — keep them aligned or
 * the collection grid and the distribution chart will disagree.
 *
 * Typed as a readonly tuple so `.map()` over it stays narrowed to ModuleType
 * and indexing MODULE_TYPE_COLORS needs no cast.
 */
export const MODULE_TYPE_ORDER = [
  "cannon",
  "armor",
  "generator",
  "core",
] as const satisfies readonly ModuleType[];

/**
 * Human-readable, title-cased labels for each module type.
 *
 * USE WHEN: rendering a type name in a heading, chart legend, tooltip, or
 * table section header. Prefer this over ad-hoc `capitalize` CSS so the
 * casing is identical everywhere and stays translatable later.
 *
 * NOTE ON SCOPE: these are the short names for compact surfaces (chart
 * legends, tooltips). ModuleTable.tsx deliberately keeps its OWN longer set
 * ("Cannon (Attack)", "Armor (Defense)", ...) because that screen has room for
 * the role and players benefit from it. The two sets were never duplicates and
 * should not be merged — see the comment at ModuleTable.tsx's TYPE_LABELS.
 *
 * Kept as a separate export from MODULE_TYPE_COLORS so a future agent can
 * change wording without diff-touching the palette (and vice versa).
 */
export const MODULE_TYPE_LABELS: Record<ModuleType, string> = {
  cannon: "Cannon",
  armor: "Armor",
  generator: "Generator",
  core: "Core",
};
