import { describe, it, expect } from "vitest";
import {
  importHeadline,
  isNothingChanged,
  nothingChangedReason,
  type FinishedImport,
} from "../features/settings/playerInfoImportSummaryText";
import type { SavePull } from "../features/settings/playerInfoPulls";

const pull = (): SavePull => ({
  date: "2026-10-12", commonCount: 8, rareCount: 2, epicModules: [], gemsSpent: 200, bannerType: "standard",
  obtainedAt: 0, origin: null,
});
const raise = { moduleId: "havoc-bringer", name: "Havoc Bringer", from: null, to: "5*" as const };
const kept = { moduleId: "havoc-bringer", name: "Havoc Bringer", tracker: "5*" as const, save: "legendary" as const };

/** A finished import; override only what a case needs. */
function result(o: {
  fileKind?: FinishedImport["fileKind"];
  added?: number;
  alreadyLogged?: number;
  unsure?: number;
  raises?: number;
  keptHigher?: number;
}): FinishedImport {
  return {
    status: "done",
    fileKind: o.fileKind ?? "playerInfo",
    modules: { raises: Array(o.raises ?? 0).fill(raise), keptHigher: Array(o.keptHigher ?? 0).fill(kept) },
    pulls: {
      added: Array.from({ length: o.added ?? 0 }, pull),
      alreadyLogged: o.alreadyLogged ?? 0,
      unsure: Array.from({ length: o.unsure ?? 0 }, pull),
      skippedPulls: 0,
    },
    unsupportedGameIndexes: [],
  };
}

describe("importHeadline", () => {
  it("recaps every action for playerInfo.dat, omitting zero parts", () => {
    expect(importHeadline(result({ added: 5, alreadyLogged: 10, raises: 1 }))).toBe(
      "Imported 5 new pulls · skipped 10 already logged · raised 1 module level",
    );
    expect(importHeadline(result({ added: 1 }))).toBe("Imported 1 new pull");
    expect(importHeadline(result({ unsure: 2, alreadyLogged: 3 }))).toBe(
      "Imported 0 new pulls · skipped 3 already logged · 2 held for review",
    );
  });

  it("only talks about module levels for tool_export.json", () => {
    expect(importHeadline(result({ fileKind: "toolExport", raises: 27 }))).toBe("Raised 27 module levels");
  });

  it("says nothing changed when nothing was written, for either file", () => {
    expect(importHeadline(result({ alreadyLogged: 15 }))).toBe("Already up to date — nothing changed");
    expect(importHeadline(result({ fileKind: "toolExport" }))).toBe("Already up to date — nothing changed");
  });
});

describe("nothingChangedReason", () => {
  it("is null when something changed", () => {
    expect(nothingChangedReason(result({ raises: 1 }))).toBeNull();
    expect(nothingChangedReason(result({ unsure: 1 }))).toBeNull();
    expect(isNothingChanged(result({ added: 1 }))).toBe(false);
  });

  it("counts already-logged pulls with the right grammar", () => {
    expect(nothingChangedReason(result({ alreadyLogged: 15 }))).toBe(
      "All 15 pulls in this save are already logged, and your module levels already match it.",
    );
    expect(nothingChangedReason(result({ alreadyLogged: 1 }))).toBe(
      "All 1 pull in this save is already logged, and your module levels already match it.",
    );
    expect(nothingChangedReason(result({}))).toBe(
      "This save has no new pulls, and your module levels already match it.",
    );
  });

  it("doesn't claim levels match when the tracker is higher than the file", () => {
    expect(nothingChangedReason(result({ keptHigher: 1 }))).toBe(
      "This save has no new pulls, and no module levels needed raising.",
    );
    expect(nothingChangedReason(result({ fileKind: "toolExport", keptHigher: 1 }))).toBe(
      "This export changes nothing: no module levels needed raising.",
    );
    expect(nothingChangedReason(result({ fileKind: "toolExport" }))).toBe(
      "This export changes nothing: your module levels already match it.",
    );
  });
});
