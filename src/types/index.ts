/**
 * Core domain types for the Module Tracker app.
 *
 * RESPONSIBILITY:
 * Single source of truth for shared domain types used across the store,
 * selectors, components, and the cloud sync service. Keep this file
 * dependency-free (no React, no zustand, no services) so it can be imported
 * by anything without creating cycles.
 *
 * DEPENDED ON BY:
 * - src/store/* (slice shapes use these types)
 * - src/store/selectors.ts (operates on PullRecord arrays)
 * - src/services/sync.ts (cloud sync (de)serializes these shapes)
 * - src/features/** (UI components consume these)
 * - src/config/modules.ts (ModuleDefinition is the catalog row shape)
 *
 * INVARIANTS:
 * - PullRecord.id is a UUID (v4) generated at insert time in pullsSlice.
 * - PullRecord.epicModules contains ModuleDefinition.id values; total pull
 *   count for a record is fixed at 10 (commonCount + rareCount + epicModules.length === 10).
 *   Selectors rely on this 10-per-pull invariant when computing rates.
 * - ModuleProgress is keyed by moduleId in the store record map; the embedded
 *   moduleId field MUST match the map key (importers/updaters maintain this).
 *
 * PERSISTENCE NOTE:
 * PullRecord and ModuleProgress are the ONLY domain shapes written to
 * localStorage (via the persist middleware in store/index.ts). Any breaking
 * change here requires a migration plan and the local-storage-safety-reviewer agent.
 */

/**
 * Logical category of a Tower module. Drives module list grouping and visuals.
 * NOTE: Adding a new type requires updates to src/config/modules.ts and any
 * UI that filters/groups by type. Order is not significant here.
 */
export type ModuleType = "cannon" | "armor" | "generator" | "core";

/**
 * Banner type the pull was made on. Different banners have different odds /
 * featured pools in The Tower; we record this so analytics can segment by banner.
 * "standard" is the default for new pulls (see settingsSlice.bannerDefault).
 */
export type BannerType = "standard" | "featured" | "lucky";

/**
 * Full rarity ladder for an owned module, from initial epic drop through the
 * five star tiers reached via merges/upgrades.
 *
 * ORDERING (lowest -> highest, important for any UI that sorts):
 *   epic, epic+, legendary, legendary+, mythic, mythic+, ancestral,
 *   1*, 2*, 3*, 4*, 5*
 *
 * GOTCHA: The "+" tiers are valid string literals — do not strip them when
 * normalizing user input. The star tiers ("1*"..."5*") use a literal asterisk.
 */
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

/**
 * Static catalog row describing a single module the game offers.
 *
 * Source of truth lives in src/config/modules.ts. This is NOT persisted —
 * it ships with the build. `id` is the stable key used everywhere
 * (PullRecord.epicModules, ModuleProgress map keys, selectors, etc.).
 */
export interface ModuleDefinition {
  /** Stable string id; MUST be unique across the catalog. Referenced by PullRecord.epicModules. */
  id: string;
  /** Display name for the module. */
  name: string;
  /** Logical category — see ModuleType. */
  type: ModuleType;
  /** Free-form description of the module's unique ability; UI shows verbatim. */
  uniqueAbility: string;
}

/**
 * One row in the pull history. Represents a single 10x pull batch.
 *
 * INVARIANTS:
 * - commonCount + rareCount + epicModules.length === 10 (selectors assume this).
 * - epicModules entries are ModuleDefinition.id values (may contain duplicates
 *   if multiple copies of the same module dropped in the same 10x).
 * - id is a UUID v4 assigned by addPull; never mutated.
 * - date is an ISO date string ("YYYY-MM-DD" or full ISO); selectors parse via Date().
 *
 * PERSISTED to localStorage as part of state.pulls.
 */
export interface PullRecord {
  /** UUID v4 assigned by pullsSlice.addPull. Stable identity for edit/delete. */
  id: string;
  /** ISO date string. Used for chronological sort; same-date ties broken by insertion order. */
  date: string;
  /** Number of common-rarity drops in this 10x pull (0-10). */
  commonCount: number;
  /** Number of rare-rarity drops in this 10x pull (0-10). */
  rareCount: number;
  /** Module ids dropped at epic rarity (length == # epics in pull). May contain duplicates. */
  epicModules: string[];
  /** Gems spent on this pull. Used for gems-per-epic and prediction selectors. */
  gemsSpent: number;
  /** Banner this pull was made on; segments analytics. */
  bannerType: BannerType;
}

/**
 * User's current upgrade progress for a single module.
 *
 * The store keeps these as Record<moduleId, ModuleProgress> (see ModulesSlice).
 * The redundant moduleId field exists so individual records are self-describing
 * for export/import and sync round-trips.
 *
 * PERSISTED to localStorage as part of state.moduleProgress.
 */
export interface ModuleProgress {
  /** Must match the catalog ModuleDefinition.id and the parent map key. */
  moduleId: string;
  /** Highest rarity tier the user has reached for this module. */
  currentRarity: ModuleRarity;
}

/**
 * Top-level navigation tab id. Mirrors the feature folders under src/features/
 * (minus pulls/settings which are modal flows, not tabs).
 * Stored on UiSlice.activeTab — NOT persisted (resets to "dashboard" on reload).
 */
export type TabId = "dashboard" | "history" | "modules" | "analytics";
