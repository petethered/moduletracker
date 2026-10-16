/**
 * playerInfoImportContext — the ONE Import Player Info instance shared by both
 * entry points (header "Import Save" button, Settings → "Import Player Info").
 * PlayerInfoImportProvider (mounted in App) owns the state and the single
 * result modal; the buttons only start imports.
 *
 * Why app-level instead of one hook per button: the Settings button lives in
 * the Settings Modal, which must CLOSE before the result shows (two stacked
 * Modals both listen for Escape on document and both trap focus). Closing
 * Settings unmounts the button, so the state can't live in it.
 *
 * Kept in a .ts file (not next to the Provider component) so the Provider file
 * only exports a component — React Fast Refresh needs that.
 */
import { createContext, useContext } from "react";

/**
 * What the buttons get: start an import, and whether one is running. Named
 * "Launcher" (not "Api"/"State") so it can't be mistaken for the internal
 * usePlayerInfoImport hook — calling THAT from a button would give it its own
 * separate state and modal again, the bug this context removes.
 */
export interface PlayerInfoImportLauncher {
  /** True while a file is being read/decoded. */
  busy: boolean;
  /** Read `file` and open the result modal (it shows once the import finishes). */
  startImport: (file: File) => void;
}

export const PlayerInfoImportContext = createContext<PlayerInfoImportLauncher | null>(null);

export function usePlayerInfoImportLauncher(): PlayerInfoImportLauncher {
  const api = useContext(PlayerInfoImportContext);
  if (!api) throw new Error("usePlayerInfoImportLauncher must be used inside <PlayerInfoImportProvider>");
  return api;
}
