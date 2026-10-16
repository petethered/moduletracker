/**
 * ImportSaveHeaderButton — the header's "Import Save" button, left of
 * "+ Add 10x Pull". The one-tap way to log pulls from The Tower's save
 * (playerInfo.dat) instead of typing them in.
 *
 * Same import as Settings → Import Player Info (usePlayerInfoImport): new
 * pulls appended, already-logged ones skipped, module rarities raised.
 * Difference is only where the summary shows: the header has no room, so a
 * Modal opens once the file has been read. Each instance owns its own hook
 * state, so the two buttons don't share a summary.
 */
import { useRef, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { PlayerInfoFileInput } from "./PlayerInfoFileInput";
import { PlayerInfoImportSummary } from "./PlayerInfoImportSummary";
import { usePlayerInfoImport } from "./usePlayerInfoImport";

export function ImportSaveHeaderButton() {
  const { busy, result, importFile, addUnsurePulls } = usePlayerInfoImport();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        title="Import pulls and module levels from The Tower's save file (playerInfo.dat)"
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
      <PlayerInfoFileInput
        inputRef={inputRef}
        testId="player-info-header-input"
        onFile={(file) => {
          // Open first: the summary renders as soon as the import resolves.
          setOpen(true);
          void importFile(file);
        }}
      />
      <Modal isOpen={open && !busy && result !== null} onClose={() => setOpen(false)} title="Import Save">
        <PlayerInfoImportSummary result={result} onAddUnsurePulls={addUnsurePulls} />
        <div className="mt-4 flex justify-end">
          <Button onClick={() => setOpen(false)}>Done</Button>
        </div>
      </Modal>
    </>
  );
}
