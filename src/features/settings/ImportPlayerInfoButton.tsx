/**
 * ImportPlayerInfoButton — Settings → Data Management → "Import Player Info".
 *
 * User flow:
 *   Pick The Tower's save file (playerInfo.dat) -> every KNOWN epic module in
 *   it is raised to the rarity the game says -> a summary lists what changed,
 *   what was kept, and anything skipped. Settings stays open so the summary
 *   can be read (unlike the JSON import, which replaces everything and closes).
 *
 * Behavior (rules and reasons live in parsePlayerInfo.ts; orchestration in
 * usePlayerInfoImport.ts — this component only renders):
 *   - Raise only. A lower rarity in the save is listed as "kept", never applied.
 *   - Modules not in the save are untouched. Pulls are never touched.
 *   - Applied immediately, no confirm step: it can only raise progress, shows
 *     every change, and re-importing the same file is a no-op.
 *
 * File input has NO `accept` filter on purpose: mobile pickers (iOS in
 * particular) grey out extensions they don't recognise, and ".dat" is one of
 * them. A wrong file is caught by the parser with a clear message instead.
 */
import { useRef } from "react";
import { Button } from "../../components/ui/Button";
import { formatInteger } from "../../utils/formatNumber";
import { usePlayerInfoImport } from "./usePlayerInfoImport";

const plural = (n: number, word: string) => `${formatInteger(n)} ${n === 1 ? word : `${word}s`}`;

export function ImportPlayerInfoButton() {
  const { busy, result, importFile } = usePlayerInfoImport();
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
      <input
        ref={inputRef}
        type="file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Reset so picking the same file again (e.g. an updated save) fires.
          e.target.value = "";
          if (file) void importFile(file);
        }}
        className="hidden"
        data-testid="player-info-input"
        aria-label="Player info save file"
      />

      {result?.status === "error" && (
        <p className="mt-2 text-xs text-red-400" data-testid="player-info-error">
          {result.message}
        </p>
      )}

      {result?.status === "done" && (
        <div className="mt-2 text-xs" data-testid="player-info-result">
          {result.raises.length === 0 ? (
            <p className="text-green-400">Module levels are already up to date.</p>
          ) : (
            <>
              <p className="text-green-400">Updated {plural(result.raises.length, "module")}:</p>
              <ul className="mt-1 space-y-0.5 text-gray-300 max-h-40 overflow-y-auto">
                {result.raises.map((c) => (
                  <li key={c.moduleId}>
                    {c.name}: <span className="text-gray-400">{c.from ?? "not set"}</span> → {c.to}
                  </li>
                ))}
              </ul>
            </>
          )}

          {result.keptHigher.length > 0 && (
            // Raise-only: the tracker is higher than the save. Most likely a
            // typo in the tracker — the user can lower it in the Modules tab.
            <div className="mt-2" data-testid="player-info-kept">
              <p className="text-yellow-400">
                Kept {plural(result.keptHigher.length, "higher value")} (the save shows lower):
              </p>
              <ul className="mt-0.5 space-y-0.5 text-gray-300">
                {result.keptHigher.map((k) => (
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
      )}
    </div>
  );
}
