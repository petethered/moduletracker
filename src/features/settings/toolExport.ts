/**
 * toolExport — reads The Tower's official `tool_export.json` (written by game
 * 29.1+ next to playerInfo.dat; same app Documents folder) for Import Player
 * Info. It is plain UTF-8 JSON with PascalCase keys; seen on build 1250
 * (VersionNumber 1250, DataVersion 30), 2026-10-16.
 *
 * WHAT IT HAS / DOESN'T:
 *   - Module copies, same three places as the binary save, as PLAIN arrays
 *     (no NRBF List<T> `_items`/`_size` wrapper) with plain-number rarities:
 *       ModuleInventory    [{ InfoIndex, CurrentRarity, ... }]  unequipped
 *       ModuleEquipped     [{ ... }]                            4 main slots
 *       AssistModuleSlots  [{ EquippedModule: { ... } | null }]
 *     InfoIndex / CurrentRarity are the SAME numbers as the binary save's
 *     infoIndex / currentRarity.value__ (verified: identical module results
 *     from a real tool_export.json and the playerInfo.dat saved alongside it).
 *   - NO pull log: the binary save's moduleRecords has no counterpart here
 *     (only BattleHistory, which is battle runs). So this file can raise
 *     module levels but never imports pulls; the summary tells the user to
 *     use playerInfo.dat for pulls.
 *
 * Module rules are shared with the binary save via bestModuleRarities
 * (parsePlayerInfo.ts) so the two formats can't drift apart.
 */
import { NOT_A_SAVE, PlayerInfoFormatError } from "./decodePlayerInfoFile";
import { bestModuleRarities, type GameModuleCopy, type PlayerInfoModules } from "./parsePlayerInfo";

/** The parts of tool_export.json this reader uses. Everything else is ignored. */
export interface ToolExport {
  VersionNumber: number;
  ModuleInventory?: unknown[];
  ModuleEquipped?: unknown[];
  AssistModuleSlots?: unknown[];
}

/** Real exports are ~0.5 MB; the cap only stops a huge file from freezing the tab. */
const MAX_TOOL_EXPORT_BYTES = 32 * 1024 * 1024;

const TRACKER_EXPORT =
  "This is a Module Tracker export, not a game file. To restore it, use Settings → Import Data.";

/**
 * True if the file starts like a JSON OBJECT (optionally after a UTF-8 BOM or
 * whitespace). A cheap content sniff, not validation — readToolExport validates.
 */
export function startsWithJsonObject(bytes: Uint8Array): boolean {
  let i = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  while (i < bytes.length && (bytes[i] === 0x20 || bytes[i] === 0x09 || bytes[i] === 0x0a || bytes[i] === 0x0d)) i++;
  return bytes[i] === 0x7b; // "{"
}

/**
 * Parse and sanity-check a tool_export.json.
 * @throws PlayerInfoFormatError (plain language) for anything that isn't one.
 */
export function readToolExport(bytes: Uint8Array): ToolExport {
  if (bytes.length > MAX_TOOL_EXPORT_BYTES) {
    throw new PlayerInfoFormatError("This file is too large to be a The Tower save.");
  }
  let data: unknown;
  try {
    data = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (err) {
    throw new PlayerInfoFormatError(NOT_A_SAVE, { cause: err });
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) throw new PlayerInfoFormatError(NOT_A_SAVE);
  const obj = data as Record<string, unknown>;
  // Our own export (SettingsPanel handleExport) is JSON too, and it's the
  // likeliest wrong pick from a Downloads folder: say where it goes instead.
  if (Array.isArray(obj.pulls) && typeof obj.moduleProgress === "object") {
    throw new PlayerInfoFormatError(TRACKER_EXPORT);
  }
  const hasModules = Array.isArray(obj.ModuleInventory) || Array.isArray(obj.ModuleEquipped);
  if (typeof obj.VersionNumber !== "number" || !hasModules) throw new PlayerInfoFormatError(NOT_A_SAVE);
  return obj as unknown as ToolExport;
}

/** One `{ InfoIndex, CurrentRarity }` entry, or null for an empty slot / junk. */
function toGameModuleCopy(entry: unknown): GameModuleCopy | null {
  if (typeof entry !== "object" || entry === null) return null;
  const { InfoIndex, CurrentRarity } = entry as Record<string, unknown>;
  return typeof InfoIndex === "number" && typeof CurrentRarity === "number"
    ? { infoIndex: InfoIndex, rarity: CurrentRarity }
    : null;
}

/** Module rarities from a tool export: inventory + main slots + assist slots. */
export function extractToolExportModules(data: ToolExport): PlayerInfoModules {
  const entries: unknown[] = [
    ...(data.ModuleInventory ?? []),
    ...(data.ModuleEquipped ?? []),
    ...(data.AssistModuleSlots ?? []).map((slot) =>
      typeof slot === "object" && slot !== null ? (slot as Record<string, unknown>).EquippedModule : null,
    ),
  ];
  return bestModuleRarities(entries.map(toGameModuleCopy).filter((c): c is GameModuleCopy => c !== null));
}
