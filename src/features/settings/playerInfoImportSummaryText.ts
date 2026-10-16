/**
 * playerInfoImportSummaryText — the sentences the Import Save result modal
 * leads with, as pure functions of the import result (unit-tested in
 * src/__tests__/playerInfoImportSummaryText.test.ts). PlayerInfoImportSummary
 * only renders them.
 *
 * Copy rules (each from a real user report or review):
 *   - Nothing written => say so outright ("Already up to date — nothing
 *     changed") plus a plain reason. "Imported 0 new pulls · skipped 15" read
 *     like the upload had done nothing.
 *   - Never claim levels "match" when some tracker levels are HIGHER than the
 *     file — those are listed under "Kept" in the modal.
 *   - tool_export.json has no pull log: never talk about pulls as if they were
 *     checked (the modal says once that pulls need playerInfo.dat).
 */
import { formatInteger } from "../../utils/formatNumber";
import type { PlayerInfoImportResult } from "./usePlayerInfoImport";

/** A finished (non-error) import. */
export type FinishedImport = Extract<PlayerInfoImportResult, { status: "done" }>;

/** "1 pull" / "15 pulls", locale-formatted. */
export const plural = (n: number, word: string) => `${formatInteger(n)} ${n === 1 ? word : `${word}s`}`;

/** True when the import wrote nothing (no pulls added or held, no module raised). */
export function isNothingChanged({ pulls, modules }: FinishedImport): boolean {
  return pulls.added.length === 0 && pulls.unsure.length === 0 && modules.raises.length === 0;
}

/**
 * One-line recap of every action taken, without the final period. Each part
 * only appears when non-zero; the modal's sections give the detail.
 */
export function importHeadline(result: FinishedImport): string {
  const { pulls, modules } = result;
  if (isNothingChanged(result)) return "Already up to date — nothing changed";
  const raised = plural(modules.raises.length, "module level");
  // A modules-only file can only have raised levels.
  if (result.fileKind === "toolExport") return `Raised ${raised}`;
  return [
    `Imported ${plural(pulls.added.length, "new pull")}`,
    pulls.alreadyLogged > 0 && `skipped ${formatInteger(pulls.alreadyLogged)} already logged`,
    pulls.unsure.length > 0 && `${formatInteger(pulls.unsure.length)} held for review`,
    modules.raises.length > 0 && `raised ${raised}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Why nothing changed (full sentence), or null when something did. */
export function nothingChangedReason(result: FinishedImport): string | null {
  if (!isNothingChanged(result)) return null;
  const { pulls, modules } = result;
  const levels = modules.keptHigher.length > 0 ? "no module levels needed raising" : "your module levels already match it";
  if (result.fileKind === "toolExport") return `This export changes nothing: ${levels}.`;
  const pullPart =
    pulls.alreadyLogged > 0
      ? `All ${plural(pulls.alreadyLogged, "pull")} in this save ${pulls.alreadyLogged === 1 ? "is" : "are"} already logged`
      : "This save has no new pulls";
  return `${pullPart}, and ${levels}.`;
}
