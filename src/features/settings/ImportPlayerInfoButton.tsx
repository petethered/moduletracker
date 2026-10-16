/**
 * ImportPlayerInfoButton — Settings → Data Management → "Import Player Info".
 * (The header's "Import Save" button, ImportSaveHeaderButton, runs the same
 * import and shows the same summary in a modal.)
 *
 * User flow:
 *   Pick The Tower's save file (playerInfo.dat) -> new pulls from the save's
 *   pull log are appended, and every KNOWN epic module is raised to the
 *   rarity the game says -> PlayerInfoImportSummary lists what changed.
 *   Settings stays open so the summary can be read (unlike the JSON import,
 *   which replaces everything and closes).
 *
 * Behavior (rules and reasons live in parsePlayerInfo.ts / playerInfoPulls.ts;
 * orchestration in usePlayerInfoImport.ts — this component only renders):
 *   - Modules: raise only. A lower rarity in the save is listed as "kept".
 *   - Pulls: append only. Pulls already logged are skipped, so re-importing
 *     the same file adds nothing. Existing pulls are never edited or removed.
 *   - Applied immediately, no confirm step, except "unsure" pulls, which wait
 *     for "Add anyway".
 *
 * The hidden file input is PlayerInfoFileInput (shared with the header button).
 */
import { useRef } from "react";
import { Button } from "../../components/ui/Button";
import { PlayerInfoFileInput } from "./PlayerInfoFileInput";
import { PlayerInfoImportSummary } from "./PlayerInfoImportSummary";
import { usePlayerInfoImport } from "./usePlayerInfoImport";

export function ImportPlayerInfoButton() {
  const { busy, result, importFile, addUnsurePulls } = usePlayerInfoImport();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <Button
        variant="secondary"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="w-full"
      >
        {busy ? "Reading save…" : "Import Player Info"}
      </Button>
      <PlayerInfoFileInput inputRef={inputRef} onFile={importFile} testId="player-info-input" />
      <PlayerInfoImportSummary result={result} onAddUnsurePulls={addUnsurePulls} />
    </div>
  );
}

