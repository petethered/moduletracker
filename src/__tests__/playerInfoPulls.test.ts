import { describe, it, expect } from "vitest";
import { readPlayerInfoSave } from "../features/settings/parsePlayerInfo";
import {
  extractSavePulls,
  planPullImport,
  type SavePull,
} from "../features/settings/playerInfoPulls";
import type { PullRecord } from "../types";
import {
  buildPlayerInfoSave,
  buildPullDrops,
  GameRarity as R,
  type SavedPullDrop,
} from "./helpers/playerInfoSaveBuilder";

// Local-time constructors, so the expected YYYY-MM-DD holds in any test TZ.
const OCT_12_9AM = new Date(2026, 9, 12, 9, 0).getTime();

const pullsFrom = (drops: SavedPullDrop[]) =>
  extractSavePulls(readPlayerInfoSave(buildPlayerInfoSave({ pullDrops: drops })));

describe("extractSavePulls", () => {
  it("groups the save's drops into ten-pulls with counts, epics, local date, banner and gems", () => {
    const { pulls, skippedPulls, unsupportedGameIndexes } = pullsFrom(
      buildPullDrops(
        [
          { common: 8, rare: 2 },
          { common: 7, rare: 2, epics: [7] }, // Havoc Bringer
        ],
        OCT_12_9AM,
        "Infinity Threshold Banner",
      ),
    );
    expect(skippedPulls).toBe(0);
    expect(unsupportedGameIndexes).toEqual([]);
    expect(pulls.map((p) => ({ ...p, obtainedAt: undefined }))).toEqual([
      { date: "2026-10-12", commonCount: 8, rareCount: 2, epicModules: [], gemsSpent: 200, bannerType: "standard", origin: "Infinity Threshold Banner", obtainedAt: undefined },
      { date: "2026-10-12", commonCount: 7, rareCount: 2, epicModules: ["havoc-bringer"], gemsSpent: 200, bannerType: "standard", origin: "Infinity Threshold Banner", obtainedAt: undefined },
    ]);
    expect(pulls[1].obtainedAt).toBe(OCT_12_9AM + 10_000);
  });

  it("marks a pull lucky only when its banner name says lucky (any case); null banner is standard", () => {
    const lucky = pullsFrom(buildPullDrops([{ common: 10, rare: 0 }], OCT_12_9AM, "Super LUCKY Banner"));
    const old = pullsFrom(buildPullDrops([{ common: 10, rare: 0 }], OCT_12_9AM, null));
    expect(lucky.pulls[0].bannerType).toBe("lucky");
    expect(old.pulls[0].bannerType).toBe("standard");
  });

  it("splits back-to-back pulls whose drops share one timestamp (older saves) at ten drops", () => {
    // Older saves stamped all drops of a session identically.
    const drops = buildPullDrops([{ common: 9, rare: 1 }, { common: 8, rare: 2 }], OCT_12_9AM).map((d) => ({ ...d, at: OCT_12_9AM }));
    const { pulls } = pullsFrom(drops);
    expect(pulls.map((p) => `${p.commonCount}/${p.rareCount}`)).toEqual(["9/1", "8/2"]);
  });

  it("skips (and counts) a partial pull, e.g. the oldest one cut off by the save's 150-drop window", () => {
    const drops = buildPullDrops([{ common: 8, rare: 2 }, { common: 9, rare: 1 }], OCT_12_9AM).slice(4);
    const { pulls, skippedPulls } = pullsFrom(drops);
    expect(skippedPulls).toBe(1);
    expect(pulls.map((p) => `${p.commonCount}/${p.rareCount}`)).toEqual(["9/1"]);
  });

  it("skips a pull with an epic the tracker doesn't know, and reports its game number", () => {
    const { pulls, skippedPulls, unsupportedGameIndexes } = pullsFrom(
      buildPullDrops([{ common: 9, rare: 0, epics: [999] }, { common: 10, rare: 0 }], OCT_12_9AM),
    );
    expect(pulls).toHaveLength(1);
    expect(skippedPulls).toBe(1);
    expect(unsupportedGameIndexes).toEqual([999]);
  });

  it("returns nothing for a save without a pull log", () => {
    const root = readPlayerInfoSave(buildPlayerInfoSave({ inventory: [{ infoIndex: 7, rarity: R.epic }] }));
    expect(extractSavePulls(root)).toEqual({ pulls: [], skippedPulls: 0, unsupportedGameIndexes: [] });
  });
});

// --- planPullImport -------------------------------------------------------

let n = 0;
/** A pull as the tracker stores it. `sig` is "common/rare" plus optional epics. */
const logged = (date: string, common: number, rare: number, epics: string[] = []): PullRecord => ({
  id: `id-${n++}`, date, commonCount: common, rareCount: rare, epicModules: epics, gemsSpent: 200, bannerType: "standard",
});
const fromSave = (date: string, common: number, rare: number, epics: string[] = []): SavePull => ({
  ...logged(date, common, rare, epics), obtainedAt: n++, origin: null,
});
const sigs = (ps: { commonCount: number; rareCount: number; epicModules: string[] }[]) =>
  ps.map((p) => [p.commonCount, p.rareCount, ...p.epicModules].join("/"));

describe("planPullImport", () => {
  const D1 = "2026-10-12";
  const D2 = "2026-10-13";

  it("adds nothing when every save pull is already logged (the real-save case: 15 of 15)", () => {
    const save = [fromSave(D1, 8, 2), fromSave(D1, 8, 2), fromSave(D1, 6, 3, ["infinity-threshold"])];
    const existing = [logged(D1, 5, 5), logged(D1, 8, 2), logged(D1, 8, 2), logged(D1, 6, 3, ["infinity-threshold"])];
    expect(planPullImport(existing, save)).toEqual({ toAdd: [], alreadyLogged: 3, unsure: [] });
  });

  it("adds every save pull when none are logged", () => {
    const save = [fromSave(D1, 8, 2), fromSave(D2, 9, 1)];
    expect(planPullImport([logged("2026-10-01", 8, 2)], save)).toEqual({ toAdd: save, alreadyLogged: 0, unsure: [] });
  });

  it("adds the pulls after the last one logged, ignoring older same-day pulls from before the save's window", () => {
    const save = [fromSave(D1, 8, 2), fromSave(D1, 7, 3), fromSave(D1, 9, 1)];
    const existing = [logged(D1, 4, 6), logged(D1, 8, 2), logged(D1, 7, 3)]; // 4/6 predates the window
    const plan = planPullImport(existing, save);
    expect(sigs(plan.toAdd)).toEqual(["9/1"]);
    expect(plan.alreadyLogged).toBe(2);
    expect(plan.unsure).toEqual([]);
  });

  it("matches identical pulls to the LATEST logged ones, not to look-alikes from before the window", () => {
    // Real-save regression: the day starts with pre-window 8/2s, then the
    // window's pulls were logged except the newest two. Greedy first-match
    // paired the save's 8/2s with the OLD 8/2s and lost the new ones.
    const save = [fromSave(D1, 8, 2), fromSave(D1, 7, 3), fromSave(D1, 8, 2), fromSave(D1, 9, 1), fromSave(D1, 8, 2)];
    const existing = [logged(D1, 8, 2), logged(D1, 8, 2), logged(D1, 8, 2), logged(D1, 7, 3), logged(D1, 8, 2)];
    const plan = planPullImport(existing, save);
    expect(sigs(plan.toAdd)).toEqual(["9/1", "8/2"]);
    expect(plan.alreadyLogged).toBe(3);
    expect(plan.unsure).toEqual([]);
  });

  it("treats unmatched same-day pulls on the window's first day as pre-window when nothing matched there", () => {
    // Logged 2 pulls in the morning, then pulled 2 more; only the later 2 are still in the save.
    const save = [fromSave(D1, 8, 2), fromSave(D1, 9, 1)];
    const plan = planPullImport([logged(D1, 5, 5), logged(D1, 6, 4)], save);
    expect(sigs(plan.toAdd)).toEqual(["8/2", "9/1"]);
    expect(plan.unsure).toEqual([]);
  });

  it("holds back a save pull as unsure when a logged pull that day matches nothing (likely a typo)", () => {
    const save = [fromSave(D1, 8, 2), fromSave(D2, 7, 3), fromSave(D2, 9, 1)];
    // D2's 6/4 matches no save pull: it may be a mistyped 7/3 or 9/1.
    const existing = [logged(D1, 8, 2), logged(D2, 6, 4)];
    const plan = planPullImport(existing, save);
    expect(plan.toAdd).toEqual([]);
    expect(sigs(plan.unsure)).toEqual(["7/3", "9/1"]);
    expect(plan.alreadyLogged).toBe(1);
  });

  it("counts identical pulls one for one, so a repeated 8/2 is added only as often as it's missing", () => {
    const save = [fromSave(D2, 8, 2), fromSave(D2, 8, 2), fromSave(D2, 8, 2)];
    const plan = planPullImport([logged(D2, 8, 2)], save);
    expect(sigs(plan.toAdd)).toEqual(["8/2", "8/2"]);
    expect(plan.alreadyLogged).toBe(1);
  });

  it("matches epics regardless of order", () => {
    const save = [fromSave(D1, 8, 0, ["havoc-bringer", "gilded-sniper"])];
    expect(planPullImport([logged(D1, 8, 0, ["gilded-sniper", "havoc-bringer"])], save).alreadyLogged).toBe(1);
  });

  it("is a no-op on re-import once its additions are logged", () => {
    const save = [fromSave(D1, 8, 2), fromSave(D2, 9, 1), fromSave(D2, 7, 2, ["havoc-bringer"])];
    const existing = [logged(D1, 8, 2)];
    const first = planPullImport(existing, save);
    const after = [...existing, ...first.toAdd.map((p, i) => ({ ...p, id: `new-${i}` }))];
    expect(planPullImport(after, save)).toEqual({ toAdd: [], alreadyLogged: 3, unsure: [] });
  });
});
