/**
 * toolExportBuilder — TEST-ONLY synthetic The Tower `tool_export.json`
 * (game 29.1+), mirroring the real layout that toolExport.ts reads.
 *
 * USED BY: src/__tests__/toolExport.test.ts AND e2e/player-info-import.spec.ts.
 * No vitest / node:* imports (Playwright loads it too).
 *
 * Takes the same spec as buildPlayerInfoSave so a test can build BOTH formats
 * from one description and check they import identically. Real exports carry
 * ~240 other keys; the reader must not depend on them, so they're omitted
 * (apart from a couple, so "has unrelated keys" is exercised).
 */
import type { PlayerInfoSaveSpec, SavedModule } from "./playerInfoSaveBuilder";

const item = (m: SavedModule) => ({
  Guid: "00000000-0000-0000-0000-000000000000",
  InfoIndex: m.infoIndex,
  CurrentRarity: m.rarity,
  Level: 0,
  MaxLevelReached: 100,
  Effects: [0, 0, 0, 0, 0, 0, 0, 0],
  IsNew: false,
});

export function buildToolExportObject(spec: PlayerInfoSaveSpec): Record<string, unknown> {
  return {
    VersionNumber: 1250,
    DataVersion: 30,
    Gems: 1234,
    // Plain array: no List<T> spare capacity, unlike the binary save.
    ModuleInventory: (spec.inventory ?? []).map(item),
    ModuleEquipped: (spec.equipped ?? []).map((m) => (m ? item(m) : null)),
    AssistModuleSlots: (spec.assist ?? []).map((m, i) => ({
      Unlocked: true,
      Type: i,
      EquippedModule: m ? item(m) : null,
      Level: 1,
    })),
    BattleHistory: [],
  };
}

/** UTF-8 bytes of the export, as the game writes it (pretty-printed JSON). */
export function buildToolExport(spec: PlayerInfoSaveSpec): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(buildToolExportObject(spec), null, 2));
}
