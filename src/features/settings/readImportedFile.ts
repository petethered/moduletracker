/**
 * readImportedFile — "which file is this, and what's in it" for Import Player
 * Info, in one place. Returns module rarities + pulls in a format-neutral
 * shape; usePlayerInfoImport then plans and writes them.
 *
 * Formats, told apart by CONTENT (pickers and downloads rename freely):
 *   - JSON object                 => the game's tool_export.json (29.1+):
 *                                    modules only, it has no pull log.
 *   - anything else               => playerInfo.dat: gzip, or the 29.1+
 *                                    encrypted TDS1 container. Modules + pulls.
 *                                    Its reader rejects non-saves itself.
 * A new format slots in here; the hook doesn't change.
 *
 * Loaded lazily by usePlayerInfoImport (import()), with the decoders it pulls in.
 * @throws PlayerInfoFormatError (plain language) for a file that isn't either.
 */
import { decodePlayerInfoFile } from "./decodePlayerInfoFile";
import { extractSaveModules, readPlayerInfoSave, type PlayerInfoModules } from "./parsePlayerInfo";
import { extractSavePulls, type SavePullsResult } from "./playerInfoPulls";
import { extractToolExportModules, readToolExport, startsWithJsonObject } from "./toolExport";

/**
 * Which file was imported:
 *   "playerInfo" — playerInfo.dat: modules AND pulls.
 *   "toolExport" — tool_export.json: modules only (`pullData` always empty).
 */
export type ImportedFileKind = "playerInfo" | "toolExport";

export interface ImportedFileContents {
  fileKind: ImportedFileKind;
  moduleData: PlayerInfoModules;
  pullData: SavePullsResult;
}

const NO_PULL_LOG: SavePullsResult = { pulls: [], skippedPulls: 0, unsupportedGameIndexes: [] };

export async function readImportedFile(bytes: Uint8Array): Promise<ImportedFileContents> {
  if (startsWithJsonObject(bytes)) {
    return { fileKind: "toolExport", moduleData: extractToolExportModules(readToolExport(bytes)), pullData: NO_PULL_LOG };
  }
  const root = readPlayerInfoSave(await decodePlayerInfoFile(bytes));
  return { fileKind: "playerInfo", moduleData: extractSaveModules(root), pullData: extractSavePulls(root) };
}
