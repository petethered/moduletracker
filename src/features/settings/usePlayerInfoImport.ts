/**
 * usePlayerInfoImport — state + orchestration for "Import Player Info".
 * ImportPlayerInfoButton only renders what this returns.
 *
 * Flow: file -> decompressPlayerInfo -> parsePlayerInfo -> planModuleProgressImport
 * against the CURRENT store -> one setModuleRarities call with the raises.
 * All reading/parsing finishes before anything is written, so a bad file
 * writes nothing.
 *
 * Why one batched store action (not updateModuleRarity per module): one
 * persist write and one sync-subscriber pass instead of up to 26. Cloud sync
 * debounces pushes either way, so the cloud still sees a single PUT.
 */
import { useCallback, useState } from "react";
import { useStore } from "../../store";
import { logEvent } from "../../utils/renderLog";
import {
  PlayerInfoFormatError,
  decompressPlayerInfo,
  parsePlayerInfo,
  planModuleProgressImport,
  type ModuleProgressImportPlan,
} from "./parsePlayerInfo";

export type PlayerInfoImportResult =
  | ({ status: "done"; unsupportedGameIndexes: number[] } & ModuleProgressImportPlan)
  | { status: "error"; message: string };

const UNEXPECTED_ERROR = "Something went wrong reading that file. Please try again.";

export function usePlayerInfoImport() {
  const setModuleRarities = useStore((s) => s.setModuleRarities);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PlayerInfoImportResult | null>(null);

  const importFile = useCallback(
    async (file: File) => {
      setBusy(true);
      setResult(null);
      try {
        const bytes = await decompressPlayerInfo(new Uint8Array(await file.arrayBuffer()));
        const { modules, unsupportedGameIndexes } = parsePlayerInfo(bytes);
        // getState(), not a subscribed value: plan against the store as it is
        // NOW, not as of the last render.
        const plan = planModuleProgressImport(useStore.getState().moduleProgress, modules);
        if (plan.raises.length > 0) {
          setModuleRarities(Object.fromEntries(plan.raises.map((c) => [c.moduleId, c.to])));
        }
        setResult({ status: "done", unsupportedGameIndexes, ...plan });
      } catch (err) {
        // Only PlayerInfoFormatError messages are written for players. Anything
        // else (e.g. localStorage full, a stack overflow on a pathological
        // file) gets a generic message; the details go to the dev log.
        logEvent("PlayerInfoImport.failed", { error: String((err as Error)?.cause ?? err) });
        setResult({
          status: "error",
          message: err instanceof PlayerInfoFormatError ? err.message : UNEXPECTED_ERROR,
        });
      } finally {
        setBusy(false);
      }
    },
    [setModuleRarities],
  );

  return { busy, result, importFile };
}
