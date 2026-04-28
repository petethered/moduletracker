/**
 * Master list of all pullable modules in The Tower (idle tower defense game).
 *
 * ROLE IN SYSTEM:
 * This is the single source of truth for which modules exist in the app. It is
 * imported by virtually every feature that lists, filters, or selects modules:
 *   - src/features/modules/* (module grids, rarity editors)
 *   - src/features/pulls/*   (the add-pull modal's module selector)
 *   - src/features/analytics/* (per-module pull stats)
 *   - src/store/selectors.ts  (joins pulls -> module metadata)
 *
 * GAME CONTEXT:
 * The Tower has 4 module slots on the player's tower: Cannon, Armor, Generator,
 * and Core. Each slot can equip exactly one module. Players acquire copies of
 * modules through gacha pulls; copies of the same module fuse to raise its
 * rarity (see src/config/rarityColors.ts for the rarity ladder).
 *
 * GOTCHAS / INVARIANTS:
 *   - `id` MUST be a stable kebab-case slug. It is persisted in localStorage as
 *     part of pull records and module progress. Renaming an id is a BREAKING
 *     change for existing user data — write a migration if you must rename.
 *   - The visual ordering inside each `type` group below is the order that
 *     appears in the UI (MODULES_BY_TYPE preserves filter order). Reorder with
 *     intent.
 *   - Adding a new module here is sufficient for it to appear in pickers and
 *     grids. No other file needs to be edited (filters/grids derive from this).
 *   - Removing a module here will orphan any existing pull records pointing at
 *     its id. Selectors must tolerate unknown ids (verify before deleting).
 *   - `uniqueAbility` strings are player-facing copy lifted from the in-game
 *     tooltips; keep them concise — they render in tight tooltip/card spaces.
 */

import type { ModuleDefinition } from "../types";

/**
 * The full module roster, grouped by `type` in source order.
 *
 * SHAPE: ModuleDefinition[] — each entry is { id, name, type, uniqueAbility }.
 *
 * ORDERING INVARIANT:
 *   Entries are grouped by `type` in this fixed order: cannon -> armor ->
 *   generator -> core. Within each group, the order matches how modules are
 *   displayed in the UI. Do not interleave types; downstream code does not
 *   assume sortedness but humans editing this file rely on the grouping.
 *
 * ADDING A NEW MODULE:
 *   1. Append the entry to the appropriate `// <type>` section below.
 *   2. Pick a unique kebab-case `id` (must not collide with any existing id —
 *      this would silently shadow data in MODULE_BY_ID).
 *   3. That's it — MODULES_BY_TYPE and MODULE_BY_ID are derived automatically,
 *      and consumers (pickers, grids, selectors) iterate this array.
 *
 * REMOVING A MODULE:
 *   Consider whether existing user pull data references the id. Prefer keeping
 *   stale entries (or marking them deprecated) over silent removal.
 */
export const MODULES: ModuleDefinition[] = [
  // Cannon — primary offensive slot. Module abilities here mostly modify
  // damage output, crits, or special on-hit effects.
  {
    id: "astral-deliverance",
    name: "Astral Deliverance",
    type: "cannon",
    uniqueAbility: "Bounce shot range increased by 3% of tower range. Each bounce increases damage.",
  },
  {
    id: "being-annihilator",
    name: "Being Annihilator",
    type: "cannon",
    uniqueAbility: "When you super crit, next attacks are guaranteed super crits.",
  },
  {
    id: "death-penalty",
    name: "Death Penalty",
    type: "cannon",
    uniqueAbility: "Chance to mark enemy for death on spawn, first hit destroys it.",
  },
  {
    id: "havoc-bringer",
    name: "Havoc Bringer",
    type: "cannon",
    uniqueAbility: "Chance for rend armor to instantly go to max.",
  },
  {
    id: "shrink-ray",
    name: "Shrink Ray",
    type: "cannon",
    uniqueAbility: "1% chance to decrease enemy mass.",
  },
  {
    id: "amplifying-strike",
    name: "Amplifying Strike",
    type: "cannon",
    uniqueAbility: "Killing a boss or elite increases Tower Damage by 5x temporarily.",
  },
  // Armor — defensive slot. Abilities here cluster around damage reduction,
  // walls, landmines, shockwaves, and orbiting electrons.
  {
    id: "anti-cube-portal",
    name: "Anti-Cube Portal",
    type: "armor",
    uniqueAbility: "Enemies take increased damage for 7s after hit by shockwave.",
  },
  {
    id: "negative-mass-projector",
    name: "Negative Mass Projector",
    type: "armor",
    uniqueAbility: "Orb hits apply stacking debuff reducing enemy damage and speed.",
  },
  {
    id: "wormhole-redirector",
    name: "Wormhole Redirector",
    type: "armor",
    uniqueAbility: "Health Regen can heal up to % of Package Max Recovery.",
  },
  {
    id: "space-displacer",
    name: "Space Displacer",
    type: "armor",
    uniqueAbility: "Landmines have chance to spawn as Inner Land Mines around tower.",
  },
  {
    id: "sharp-fortitude",
    name: "Sharp Fortitude",
    type: "armor",
    uniqueAbility: "Increase Wall health and regen. Enemies take more damage from wall thorns per hit.",
  },
  {
    id: "orbital-augment",
    name: "Orbital Augment",
    type: "armor",
    uniqueAbility: "Adds orbiting Electrons dealing 15% of enemy remaining health.",
  },
  // Generator — utility/economy slot. Abilities here interact with bots,
  // packages, ultimate cooldowns, and cash multipliers.
  {
    id: "singularity-harness",
    name: "Singularity Harness",
    type: "generator",
    uniqueAbility: "Increase bot range. Enemies hit by Flame Bot receive double damage.",
  },
  {
    id: "galaxy-compressor",
    name: "Galaxy Compressor",
    type: "generator",
    uniqueAbility: "Collecting recovery package reduces Ultimate Weapon cooldowns.",
  },
  {
    id: "pulsar-harvester",
    name: "Pulsar Harvester",
    type: "generator",
    uniqueAbility: "Projectile hits can reduce enemy Health and Attack level by 1.",
  },
  {
    id: "black-hole-digestor",
    name: "Black Hole Digestor",
    type: "generator",
    uniqueAbility: "Extra Coins/Kill Bonus for each free upgrade on current wave.",
  },
  {
    id: "project-funding",
    name: "Project Funding",
    type: "generator",
    uniqueAbility: "Tower damage multiplied by % of digits in current cash.",
  },
  {
    id: "restorative-bonus",
    name: "Restorative Bonus",
    type: "generator",
    uniqueAbility: "Packages grant 50% attack speed boost, decaying over 60 seconds.",
  },
  // Core — synergy slot. Abilities here amplify or combine other tower
  // systems (chain lightning, Death Wave/Golden Tower/Black Hole, etc.).
  {
    id: "om-chip",
    name: "Om Chip",
    type: "core",
    uniqueAbility: "Spotlight rotates to focus boss. Bosses reflect light increasing nearby enemy damage.",
  },
  {
    id: "harmony-conductor",
    name: "Harmony Conductor",
    type: "core",
    uniqueAbility: "Chance of poisoned enemies to miss-attack (halved for bosses).",
  },
  {
    id: "dimension-core",
    name: "Dimension Core",
    type: "core",
    uniqueAbility: "Chain lightning 60% chance to hit initial target. Shock chance and multiplier doubled.",
  },
  {
    id: "multiverse-nexus",
    name: "Multiverse Nexus",
    type: "core",
    uniqueAbility: "Death Wave, Golden Tower and Black Hole always activate together with averaged cooldown.",
  },
  {
    id: "magnetic-hook",
    name: "Magnetic Hook",
    type: "core",
    uniqueAbility: "Inner Land Mines fired at Bosses entering Tower range.",
  },
  {
    id: "primordial-collapse",
    name: "Primordial Collapse",
    type: "core",
    uniqueAbility: "Spawns additional Black Hole. Damage from enemies within decreased.",
  },
];

/**
 * Modules pre-bucketed by `type`, derived from MODULES at module-load time.
 *
 * USE WHEN: rendering the four type-grouped grids/columns (one per slot type).
 * Filter order matches MODULES source order (preserves intentional UI ordering).
 *
 * GOTCHA: This object is computed once at import. It will NOT pick up runtime
 *   mutations of MODULES (and MODULES should never be mutated at runtime —
 *   it's a const config table).
 *
 * IF YOU ADD A NEW `type`: you MUST add a new key here AND update the
 *   ModuleDefinition['type'] union in src/types/index.ts. Forgetting either
 *   will silently drop modules from grids.
 */
export const MODULES_BY_TYPE = {
  cannon: MODULES.filter((m) => m.type === "cannon"),
  armor: MODULES.filter((m) => m.type === "armor"),
  generator: MODULES.filter((m) => m.type === "generator"),
  core: MODULES.filter((m) => m.type === "core"),
};

/**
 * O(1) lookup: module id -> ModuleDefinition.
 *
 * USE WHEN: resolving a stored pull record's `moduleId` back to its display
 * name / type / ability. Selectors and any rendering of historical pulls
 * should go through this map rather than scanning MODULES.
 *
 * EDGE CASE: An id that no longer exists in MODULES (e.g. removed module,
 * older user data) returns `undefined`. Callers MUST guard for this — the
 * type is technically `Record<string, ModuleDefinition>` but in practice
 * any string key may resolve to undefined for legacy data.
 */
export const MODULE_BY_ID = Object.fromEntries(
  MODULES.map((m) => [m.id, m])
);
