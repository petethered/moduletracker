/**
 * PlayerInfoImportSummary — renders the outcome of an Import Player Info run
 * (see usePlayerInfoImport). Rendered by the single "Import Save" result
 * modal in PlayerInfoImportProvider, which both import buttons open.
 *
 * Sections, in order: error | pulls (added / already logged / unsure with an
 * "Add anyway" button / skipped) | modules (updated / kept higher) | unsupported.
 * Test ids (player-info-*) are the e2e contract; keep them stable.
 */
import { Button } from "../../components/ui/Button";
import { MODULE_BY_ID } from "../../config/modules";
import { formatDisplayDate } from "../../utils/formatDate";
import { formatInteger } from "../../utils/formatNumber";
import { importHeadline, isNothingChanged, nothingChangedReason, plural } from "./playerInfoImportSummaryText";
import type { SavePull } from "./playerInfoPulls";
import type { PlayerInfoImportResult } from "./usePlayerInfoImport";

/** "Oct 12, 2026 — 7 common, 2 rare, Havoc Bringer" */
function describePull(p: SavePull) {
  const epics = p.epicModules.map((id) => MODULE_BY_ID[id]?.name ?? id);
  return [
    `${formatDisplayDate(p.date)} — ${formatInteger(p.commonCount)} common`,
    `${formatInteger(p.rareCount)} rare`,
    ...epics,
  ].join(", ");
}

interface Props {
  result: PlayerInfoImportResult | null;
  /** Appends the held-back "unsure" pulls (usePlayerInfoImport.addUnsurePulls). */
  onAddUnsurePulls: () => void;
}

export function PlayerInfoImportSummary({ result, onAddUnsurePulls }: Props) {
  if (!result) return null;
  if (result.status === "error") {
    return (
      <p className="mt-2 text-xs text-red-400" data-testid="player-info-error">
        {result.message}
      </p>
    );
  }

  const { modules, pulls } = result;
  // Text rules live in playerInfoImportSummaryText.ts (unit-tested).
  const nothingChanged = isNothingChanged(result);
  const reason = nothingChangedReason(result);
  // tool_export.json has no pull log: the pulls section becomes a note.
  const modulesOnly = result.fileKind === "toolExport";
  return (
    <div className="mt-2 text-xs" data-testid="player-info-result">
      <p className="mb-2 text-sm text-gray-100" data-testid="player-info-headline">
        {importHeadline(result)}.
      </p>
      {reason && (
        <p className="mb-2 text-gray-300" data-testid="player-info-nothing-changed">
          {reason}
        </p>
      )}
      {/* --- Pulls --- */}
      <div data-testid="player-info-pulls">
        {modulesOnly ? (
          <p className="text-gray-400" data-testid="player-info-no-pull-log">
            tool_export.json doesn't include pull history, so no pulls were imported. Import playerInfo.dat to
            log new pulls.
          </p>
        ) : pulls.added.length === 0 ? (
          // Redundant with the nothing-changed line above, so only shown when
          // something ELSE changed (e.g. module levels were raised).
          !nothingChanged && <p className="text-green-400">No new pulls in the save.</p>
        ) : (
          <>
            {/* "already logged" count lives in the headline only. */}
            <p className="text-green-400">Added {plural(pulls.added.length, "pull")}:</p>
            <ul className="mt-1 space-y-0.5 text-gray-300 max-h-40 overflow-y-auto">
              {pulls.added.map((p, i) => (
                // Index in the key: older saves give a whole session ONE timestamp.
                <li key={`${p.obtainedAt}-${i}`}>{describePull(p)}</li>
              ))}
            </ul>
          </>
        )}
      </div>

      {pulls.unsure.length > 0 && (
        // A logged pull that day matched nothing in the save — maybe a typo of
        // one of these. Adding blindly could double count, so the user decides.
        <div className="mt-2" data-testid="player-info-unsure">
          <p className="text-yellow-400">
            Not added — {plural(pulls.unsure.length, "pull")} might already be logged with different numbers.
            Check History, then add if they're missing:
          </p>
          <ul className="mt-0.5 space-y-0.5 text-gray-300">
            {pulls.unsure.map((p, i) => (
              <li key={`${p.obtainedAt}-${i}`}>{describePull(p)}</li>
            ))}
          </ul>
          <Button variant="secondary" className="mt-1.5 text-xs" onClick={onAddUnsurePulls}>
            Add anyway
          </Button>
        </div>
      )}

      {pulls.skippedPulls > 0 && (
        // Usually the oldest pull, cut in half by the save's 150-drop window;
        // also pulls with an epic the tracker doesn't know (listed below).
        <p className="mt-2 text-gray-400">Skipped {plural(pulls.skippedPulls, "pull")} in the save that couldn't be read.</p>
      )}

      {/* --- Modules --- */}
      <div className="mt-3">
        {modules.raises.length === 0 ? (
          !nothingChanged && <p className="text-green-400">Module levels are already up to date.</p>
        ) : (
          <>
            <p className="text-green-400">Updated {plural(modules.raises.length, "module")}:</p>
            <ul className="mt-1 space-y-0.5 text-gray-300 max-h-40 overflow-y-auto">
              {modules.raises.map((c) => (
                <li key={c.moduleId}>
                  {c.name}: <span className="text-gray-400">{c.from ?? "not set"}</span> → {c.to}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {modules.keptHigher.length > 0 && (
        // Raise-only: the tracker is higher than the save. Most likely a
        // typo in the tracker — the user can lower it in the Modules tab.
        <div className="mt-2" data-testid="player-info-kept">
          <p className="text-yellow-400">
            Kept {plural(modules.keptHigher.length, "higher value")} (the save shows lower):
          </p>
          <ul className="mt-0.5 space-y-0.5 text-gray-300">
            {modules.keptHigher.map((k) => (
              <li key={k.moduleId}>
                {k.name}: kept {k.tracker}, save has {k.save}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.unsupportedGameIndexes.length > 0 && (
        // A newer game module or rarity tier. Not an error: everything else
        // imported. The game number is what a developer needs to add it
        // (ModuleDefinition.gameIndex in src/config/modules.ts).
        <p className="mt-2 text-yellow-400">
          Skipped modules the tracker doesn't support yet (game #
          {result.unsupportedGameIndexes.join(", #")}).
        </p>
      )}
    </div>
  );
}
