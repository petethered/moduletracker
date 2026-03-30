import type { ModuleDefinition } from "../types";

export const MODULES: ModuleDefinition[] = [
  // Cannon
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
  // Armor
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
  // Generator
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
  // Core
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

export const MODULES_BY_TYPE = {
  cannon: MODULES.filter((m) => m.type === "cannon"),
  armor: MODULES.filter((m) => m.type === "armor"),
  generator: MODULES.filter((m) => m.type === "generator"),
  core: MODULES.filter((m) => m.type === "core"),
};

export const MODULE_BY_ID = Object.fromEntries(
  MODULES.map((m) => [m.id, m])
);
