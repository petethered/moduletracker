/**
 * PlayerInfoImportProvider — owns Import Player Info for the whole app: the
 * usePlayerInfoImport state AND the single "Import Save" result modal. Mounted
 * once in App.tsx around everything, so the header button and the Settings
 * button (see playerInfoImportContext.ts for why) share one instance.
 *
 * Every finished import opens the modal, including when NOTHING changed:
 * that case used to look like the upload did nothing (user report), so the
 * summary's headline then says "Already up to date — nothing changed".
 */
import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { PlayerInfoImportContext, type PlayerInfoImportLauncher } from "./playerInfoImportContext";
import { PlayerInfoImportSummary } from "./PlayerInfoImportSummary";
import { usePlayerInfoImport } from "./usePlayerInfoImport";

export function PlayerInfoImportProvider({ children }: { children: React.ReactNode }) {
  const { busy, result, importFile, addUnsurePulls } = usePlayerInfoImport();
  const [open, setOpen] = useState(false);

  const api = useMemo<PlayerInfoImportLauncher>(
    () => ({
      busy,
      startImport: (file) => {
        // Open first: the modal renders as soon as the import resolves.
        setOpen(true);
        void importFile(file);
      },
    }),
    [busy, importFile],
  );

  return (
    <PlayerInfoImportContext.Provider value={api}>
      {children}
      <Modal isOpen={open && !busy && result !== null} onClose={() => setOpen(false)} title="Import Save">
        <PlayerInfoImportSummary result={result} onAddUnsurePulls={addUnsurePulls} />
        <div className="mt-4 flex justify-end">
          <Button onClick={() => setOpen(false)}>Done</Button>
        </div>
      </Modal>
    </PlayerInfoImportContext.Provider>
  );
}
