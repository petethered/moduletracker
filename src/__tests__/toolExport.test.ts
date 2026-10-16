import { describe, it, expect } from "vitest";
import { PlayerInfoFormatError } from "../features/settings/decodePlayerInfoFile";
import { parsePlayerInfo } from "../features/settings/parsePlayerInfo";
import { extractToolExportModules, startsWithJsonObject, readToolExport } from "../features/settings/toolExport";
import { buildPlayerInfoSave, GameRarity as R, type PlayerInfoSaveSpec } from "./helpers/playerInfoSaveBuilder";
import { buildToolExport, buildToolExportObject } from "./helpers/toolExportBuilder";

const encode = (s: string) => new TextEncoder().encode(s);
const modulesFrom = (spec: PlayerInfoSaveSpec) => extractToolExportModules(readToolExport(buildToolExport(spec)));

describe("tool_export.json modules", () => {
  it("reads epic+ modules from inventory, main slots and assist slots", () => {
    expect(
      modulesFrom({
        inventory: [{ infoIndex: 7, rarity: R.fiveStar }],        // Havoc Bringer
        equipped: [{ infoIndex: 51, rarity: R.ancestral }, null], // Gilded Sniper
        assist: [null, { infoIndex: 50, rarity: R.legendary }],   // Sentry Protocol
      }),
    ).toEqual({
      modules: { "havoc-bringer": "5*", "gilded-sniper": "ancestral", "sentry-protocol": "legendary" },
      unsupportedGameIndexes: [],
    });
  });

  it("applies the same rules as the binary save (one spec, both formats)", () => {
    const spec: PlayerInfoSaveSpec = {
      inventory: [
        { infoIndex: 9, rarity: R.epic },
        { infoIndex: 9, rarity: R.ancestral },  // highest copy wins
        { infoIndex: 8, rarity: R.rare },       // below epic: ignored
        { infoIndex: 3, rarity: R.fiveStar },   // rare-base merged up: ignored
        { infoIndex: 999, rarity: R.epic },     // unknown module: unsupported
      ],
      equipped: [{ infoIndex: 9, rarity: R.oneStar }],
    };
    expect(modulesFrom(spec)).toEqual(parsePlayerInfo(buildPlayerInfoSave(spec)));
    expect(modulesFrom(spec).unsupportedGameIndexes).toEqual([999]);
  });

  it("skips empty slots and malformed entries instead of failing", () => {
    const obj = buildToolExportObject({ inventory: [{ infoIndex: 7, rarity: R.epic }] });
    (obj.ModuleInventory as unknown[]).push(null, "junk", { InfoIndex: "7" });
    obj.AssistModuleSlots = [null, { EquippedModule: null }];
    expect(extractToolExportModules(readToolExport(encode(JSON.stringify(obj)))).modules).toEqual({
      "havoc-bringer": "epic",
    });
  });
});

describe("readToolExport / startsWithJsonObject", () => {
  it("detects JSON by its first non-space byte, BOM allowed", () => {
    expect(startsWithJsonObject(encode('  \n{"a":1}'))).toBe(true);
    expect(startsWithJsonObject(Uint8Array.from([0xef, 0xbb, 0xbf, 0x7b, 0x7d]))).toBe(true);
    expect(startsWithJsonObject(Uint8Array.from([0x1f, 0x8b, 8, 0]))).toBe(false); // gzip save
    expect(startsWithJsonObject(encode("TDS1"))).toBe(false); // encrypted save
  });

  it("points a Module Tracker export at Settings → Import Data", () => {
    expect(() => readToolExport(encode('{"pulls": [], "moduleProgress": {}, "exportedAt": "x"}'))).toThrow(
      "This is a Module Tracker export",
    );
  });

  it("rejects other JSON and broken JSON as not a save", () => {
    for (const text of ['{"hello": 1}', '{"VersionNumber": 1}', "{not json", "[]"]) {
      expect(() => readToolExport(encode(text))).toThrow(PlayerInfoFormatError);
      expect(() => readToolExport(encode(text))).toThrow("doesn't look like a The Tower save");
    }
  });
});
