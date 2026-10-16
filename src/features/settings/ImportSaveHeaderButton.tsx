/**
 * ImportSaveHeaderButton — the header's "Import Save" button, left of
 * "+ Add 10x Pull". The one-tap way to log pulls from The Tower's save
 * (playerInfo.dat) instead of typing them in.
 *
 * Same import as Settings → Import Player Info: new pulls appended,
 * already-logged ones skipped, module rarities raised. Both buttons only
 * START the import; PlayerInfoImportProvider (App.tsx) runs it and shows the
 * one "Import Save" result modal.
 */
import { useRef } from "react";
import { Button } from "../../components/ui/Button";
import { PlayerInfoFileInput } from "./PlayerInfoFileInput";
import { usePlayerInfoImportLauncher } from "./playerInfoImportContext";

export function ImportSaveHeaderButton() {
  const { busy, startImport } = usePlayerInfoImportLauncher();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        title="Import pulls and module levels from The Tower's playerInfo.dat (or module levels only from tool_export.json)"
        // aria-label fixes the accessible name at every width; on phones the
        // visible label is just an icon (a 375px header can't fit the brand,
        // two text buttons and the cog — "+ Add Pull" wrapped to 3 lines).
        aria-label="Import Save"
        className="whitespace-nowrap"
      >
        {busy ? (
          "…"
        ) : (
          <>
            <span className="hidden sm:inline">Import Save</span>
            {/* Upload-tray icon, phone widths only. */}
            <svg className="sm:hidden" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </>
        )}
      </Button>
      <PlayerInfoFileInput inputRef={inputRef} testId="player-info-header-input" onFile={startImport} />
    </>
  );
}
