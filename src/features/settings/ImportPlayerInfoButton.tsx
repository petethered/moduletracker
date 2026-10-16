/**
 * ImportPlayerInfoButton — Settings → Data Management → "Import Player Info".
 * Same import as the header's "Import Save" button (ImportSaveHeaderButton).
 *
 * User flow:
 *   Pick The Tower's save file (playerInfo.dat, or the game-29.1+
 *   tool_export.json: module levels only) -> Settings CLOSES -> the
 *   shared "Import Save" result modal opens (PlayerInfoImportProvider) and
 *   says what changed — or that nothing did. Settings closes first because two
 *   stacked Modals fight over Escape and focus (see playerInfoImportContext.ts).
 *   Before, the summary was small text under this button and an import with
 *   nothing new looked like nothing had happened.
 *
 * Behavior (rules and reasons live in parsePlayerInfo.ts / playerInfoPulls.ts;
 * orchestration in usePlayerInfoImport.ts — this component only triggers):
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
import { useStore } from "../../store";
import { PlayerInfoFileInput } from "./PlayerInfoFileInput";
import { usePlayerInfoImportLauncher } from "./playerInfoImportContext";

export function ImportPlayerInfoButton() {
  const { busy, startImport } = usePlayerInfoImportLauncher();
  const closeSettings = useStore((s) => s.closeSettings);
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
      <PlayerInfoFileInput
        inputRef={inputRef}
        testId="player-info-input"
        onFile={(file) => {
          // Start BEFORE closing: closing Settings unmounts this component, but
          // the import runs in the app-level provider, so that's safe.
          startImport(file);
          closeSettings();
        }}
      />
    </div>
  );
}
