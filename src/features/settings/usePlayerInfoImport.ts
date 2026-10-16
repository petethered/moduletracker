/**
 * usePlayerInfoImport — state + orchestration for "Import Player Info".
 * Used ONCE, by PlayerInfoImportProvider (App root), which renders the single
 * result modal. Both buttons (header "Import Save", Settings "Import Player
 * Info") reach it through usePlayerInfoImportLauncher — never call this hook
 * from a button (it would get its own state and modal).
 *
 * Flow: file -> readImportedFile (readImportedFile.ts: playerInfo.dat or the
 * game's tool_export.json, told apart by content -> modules + pulls) ->
 *   - modules -> planModuleProgressImport -> one setModuleRarities call
 *   - pulls   -> planPullImport -> one addPulls call with `toAdd`
 *     (always empty for tool_export.json: it has no pull log)
 * Both plans are made against the CURRENT store (getState) and all reading/
 * parsing finishes before anything is written, so a bad file writes nothing.
 * NOT atomic beyond that: if addPulls throws (e.g. localStorage full) after
 * the module raises were written, those raises stay. Harmless — raising is
 * idempotent and a re-import finishes the job.
 * `unsure` pulls are NOT written; the summary offers "Add anyway" (addUnsurePulls).
 *
 * LAZY: the decoders (readImportedFile -> decodePlayerInfoFile + tds1SaveContainer,
 * toolExport, parsePlayerInfo, playerInfoPulls, nrbfReader) are loaded
 * with import() on the first file pick. This hook's provider mounts with the
 * app shell, so a static import would put the whole save decoder in the main bundle.
 *
 * Why batched store actions (not updateModuleRarity / addPull per item): one
 * persist write and one sync-subscriber pass instead of one per change. Cloud
 * sync debounces pushes either way, so the cloud still sees a single PUT.
 *
 * KNOWN LIMIT: duplicates are only detected against THIS device's pulls.
 * Importing the same save on two devices before either syncs adds the pulls
 * on both, with different ids, and sync's union-by-id merge keeps both copies.
 * Importing after a sync is fine (the plan sees the merged pulls).
 */
import { useCallback, useRef, useState } from "react";
import { useStore } from "../../store";
import { logEvent } from "../../utils/renderLog";
import type { ModuleProgressImportPlan } from "./parsePlayerInfo";
import type { SavePull } from "./playerInfoPulls";
import type { ImportedFileKind } from "./readImportedFile";

export interface PullImportOutcome {
  /** Pulls appended to the tracker (oldest first). */
  added: SavePull[];
  alreadyLogged: number;
  /** Held back; the user may add them with addUnsurePulls. */
  unsure: SavePull[];
  /** See SavePullsResult.skippedPulls (partial, or an unknown epic/rarity). */
  skippedPulls: number;
}

export type PlayerInfoImportResult =
  | {
      status: "done";
      /** Which file was imported (see readImportedFile.ts); toolExport => no pulls. */
      fileKind: ImportedFileKind;
      modules: ModuleProgressImportPlan;
      pulls: PullImportOutcome;
      /** Game numbers the tracker doesn't support (modules or pull epics), ascending. */
      unsupportedGameIndexes: number[];
    }
  | { status: "error"; message: string };

const UNEXPECTED_ERROR = "Something went wrong reading that file. Please try again.";

export function usePlayerInfoImport() {
  const setModuleRarities = useStore((s) => s.setModuleRarities);
  const addPulls = useStore((s) => s.addPulls);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PlayerInfoImportResult | null>(null);
  // The unsure pulls already added for the CURRENT result. A ref, not state:
  // two fast clicks on "Add anyway" can both run before the re-render that
  // empties `unsure`, and must not add the same pulls twice.
  const unsureAddedFor = useRef<PlayerInfoImportResult | null>(null);

  const importFile = useCallback(
    async (picked: File) => {
      setBusy(true);
      setResult(null);
      try {
        const [reader, save, pullLog] = await Promise.all([
          import("./readImportedFile"),
          import("./parsePlayerInfo"),
          import("./playerInfoPulls"),
        ]);
        const { fileKind, moduleData, pullData } = await reader.readImportedFile(
          new Uint8Array(await picked.arrayBuffer()),
        );
        // getState(), not subscribed values: plan against the store as it is
        // NOW, not as of the last render.
        const { moduleProgress, pulls } = useStore.getState();
        const modulePlan = save.planModuleProgressImport(moduleProgress, moduleData.modules);
        const pullPlan = pullLog.planPullImport(pulls, pullData.pulls);

        if (modulePlan.raises.length > 0) {
          setModuleRarities(Object.fromEntries(modulePlan.raises.map((c) => [c.moduleId, c.to])));
        }
        if (pullPlan.toAdd.length > 0) addPulls(pullPlan.toAdd.map(pullLog.savePullToPullRecord));

        setResult({
          status: "done",
          fileKind,
          modules: modulePlan,
          pulls: {
            added: pullPlan.toAdd,
            alreadyLogged: pullPlan.alreadyLogged,
            unsure: pullPlan.unsure,
            skippedPulls: pullData.skippedPulls,
          },
          unsupportedGameIndexes: [...new Set([...moduleData.unsupportedGameIndexes, ...pullData.unsupportedGameIndexes])].sort(
            (a, b) => a - b,
          ),
        });
      } catch (err) {
        // Only PlayerInfoFormatError messages are written for players. Anything
        // else (e.g. localStorage full, a stack overflow on a pathological
        // file, the lazy chunk failing to load) gets a generic message; the
        // details go to the dev log. Checked by name, not instanceof, so this
        // works even if the parser chunk never loaded.
        logEvent("PlayerInfoImport.failed", { error: String((err as Error)?.cause ?? err) });
        setResult({
          status: "error",
          message: (err as Error)?.name === "PlayerInfoFormatError" ? (err as Error).message : UNEXPECTED_ERROR,
        });
      } finally {
        setBusy(false);
      }
    },
    [setModuleRarities, addPulls],
  );

  /** The user confirmed the held-back pulls: append them (once) and move them to `added`. */
  const addUnsurePulls = useCallback(async () => {
    if (result?.status !== "done" || result.pulls.unsure.length === 0) return;
    if (unsureAddedFor.current === result) return;
    unsureAddedFor.current = result;
    // Already loaded by importFile, so this resolves from the module cache.
    const { savePullToPullRecord } = await import("./playerInfoPulls");
    addPulls(result.pulls.unsure.map(savePullToPullRecord));
    const added = [...result.pulls.added, ...result.pulls.unsure].sort((a, b) => a.obtainedAt - b.obtainedAt);
    setResult({ ...result, pulls: { ...result.pulls, added, unsure: [] } });
  }, [result, addPulls]);

  return { busy, result, importFile, addUnsurePulls };
}
