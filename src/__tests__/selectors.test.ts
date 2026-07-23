import { describe, it, expect } from "vitest";
import type { PullRecord } from "../types";
import {
  selectTotalPulls,
  selectTotalGems,
  selectRarityCounts,
  selectRarityPercentages,
  selectEpicPullRate,
  selectGemsPerEpic,
  selectPitySinceLastEpic,
  selectDryStreakByPullId,
  selectPityPullIds,
  selectModulePullCounts,
  selectUniqueEpicsFound,
  selectPullStreaks,
  selectPredictedGemsToComplete,
  selectStatsByBanner,
  selectPullsSinceLastDrawnForModule,
  PITY_PULL_THRESHOLD,
} from "../store/selectors";

const makePull = (overrides: Partial<PullRecord> = {}): PullRecord => ({
  id: Math.random().toString(),
  date: "2026-03-30",
  commonCount: 7,
  rareCount: 3,
  epicModules: [],
  gemsSpent: 200,
  bannerType: "standard",
  ...overrides,
});

describe("basic selectors", () => {
  it("selectTotalPulls counts 10x pulls", () => {
    const pulls = [makePull(), makePull()];
    expect(selectTotalPulls(pulls)).toBe(2);
  });

  it("selectTotalGems sums gems", () => {
    const pulls = [makePull(), makePull(), makePull()];
    expect(selectTotalGems(pulls)).toBe(600);
  });

  it("selectRarityCounts totals across pulls", () => {
    const pulls = [
      makePull({ commonCount: 7, rareCount: 2, epicModules: ["a"] }),
      makePull({ commonCount: 8, rareCount: 2, epicModules: [] }),
    ];
    const counts = selectRarityCounts(pulls);
    expect(counts.common).toBe(15);
    expect(counts.rare).toBe(4);
    expect(counts.epic).toBe(1);
    expect(counts.total).toBe(20);
  });

  it("selectRarityPercentages with data", () => {
    const pulls = [
      makePull({ commonCount: 7, rareCount: 2, epicModules: ["a"] }),
    ];
    const pcts = selectRarityPercentages(pulls);
    expect(pcts.common).toBe(70);
    expect(pcts.rare).toBe(20);
    expect(pcts.epic).toBe(10);
  });

  it("selectRarityPercentages with no data returns zeros", () => {
    const pcts = selectRarityPercentages([]);
    expect(pcts.common).toBe(0);
    expect(pcts.rare).toBe(0);
    expect(pcts.epic).toBe(0);
  });
});

describe("epic selectors", () => {
  it("selectEpicPullRate calculates correctly", () => {
    const pulls = [
      makePull({ commonCount: 7, rareCount: 2, epicModules: ["a"] }),
      makePull({ commonCount: 7, rareCount: 3, epicModules: [] }),
    ];
    expect(selectEpicPullRate(pulls)).toBeCloseTo(5);
  });

  it("selectGemsPerEpic", () => {
    const pulls = [
      makePull({ epicModules: ["a"] }),
      makePull({ epicModules: [] }),
      makePull({ epicModules: [] }),
      makePull({ epicModules: ["b"] }),
    ];
    expect(selectGemsPerEpic(pulls)).toBe(400);
  });

  it("selectGemsPerEpic returns 0 with no epics", () => {
    const pulls = [makePull()];
    expect(selectGemsPerEpic(pulls)).toBe(0);
  });

  it("selectUniqueEpicsFound counts distinct modules", () => {
    const pulls = [
      makePull({ epicModules: ["a", "b"] }),
      makePull({ epicModules: ["a", "c"] }),
    ];
    expect(selectUniqueEpicsFound(pulls)).toBe(3);
  });
});

describe("pity counter", () => {
  it("counts individual module pulls since last epic (10 per 10x pull)", () => {
    const pulls = [
      makePull({ date: "2026-03-01", epicModules: ["a"] }),
      makePull({ date: "2026-03-02", epicModules: [] }),
      makePull({ date: "2026-03-03", epicModules: [] }),
    ];
    expect(selectPitySinceLastEpic(pulls)).toBe(20);
  });

  it("counts all module pulls when no epics ever", () => {
    const pulls = [makePull(), makePull(), makePull()];
    expect(selectPitySinceLastEpic(pulls)).toBe(30);
  });

  it("returns 0 when last pull had epic", () => {
    const pulls = [
      makePull({ date: "2026-03-01", epicModules: [] }),
      makePull({ date: "2026-03-02", epicModules: ["a"] }),
    ];
    expect(selectPitySinceLastEpic(pulls)).toBe(0);
  });
});

describe("module pull counts", () => {
  it("counts per module across pulls", () => {
    const pulls = [
      makePull({ epicModules: ["a", "b"] }),
      makePull({ epicModules: ["a"] }),
    ];
    const counts = selectModulePullCounts(pulls);
    expect(counts["a"]).toBe(2);
    expect(counts["b"]).toBe(1);
  });
});

describe("pull streaks", () => {
  it("finds best and worst streaks", () => {
    const pulls = [
      makePull({ date: "2026-03-01", epicModules: ["a"] }),
      makePull({ date: "2026-03-02", epicModules: ["b"] }),
      makePull({ date: "2026-03-03", epicModules: [] }),
      makePull({ date: "2026-03-04", epicModules: [] }),
      makePull({ date: "2026-03-05", epicModules: [] }),
    ];
    const streaks = selectPullStreaks(pulls);
    expect(streaks.bestEpicStreak).toBe(2);
    expect(streaks.worstDryStreak).toBe(3);
  });

  it("handles empty pulls", () => {
    const streaks = selectPullStreaks([]);
    expect(streaks.bestEpicStreak).toBe(0);
    expect(streaks.worstDryStreak).toBe(0);
  });
});

describe("predicted gems", () => {
  it("estimates gems to find remaining modules", () => {
    const pulls = [
      makePull({ epicModules: ["a"] }),
      makePull({ epicModules: ["b"] }),
    ];
    const predicted = selectPredictedGemsToComplete(pulls, 24);
    expect(predicted).toBeGreaterThan(0);
  });

  it("returns 0 when all modules found", () => {
    const moduleIds = Array.from({ length: 24 }, (_, i) => `mod-${i}`);
    const pulls = [makePull({ epicModules: moduleIds })];
    const predicted = selectPredictedGemsToComplete(pulls, 24);
    expect(predicted).toBe(0);
  });
});

describe("selectDryStreakByPullId", () => {
  it("assigns incrementing streak positions for consecutive non-epic pulls", () => {
    const pulls = [
      makePull({ id: "p1", date: "2026-03-01", epicModules: [] }),
      makePull({ id: "p2", date: "2026-03-02", epicModules: [] }),
      makePull({ id: "p3", date: "2026-03-03", epicModules: [] }),
    ];
    const counters = selectDryStreakByPullId(pulls);
    expect(counters.get("p1")).toBe(1);
    expect(counters.get("p2")).toBe(2);
    expect(counters.get("p3")).toBe(3);
  });

  it("resets streak after an epic pull", () => {
    const pulls = [
      makePull({ id: "p1", date: "2026-03-01", epicModules: [] }),
      makePull({ id: "p2", date: "2026-03-02", epicModules: [] }),
      makePull({ id: "p3", date: "2026-03-03", epicModules: ["a"] }),
      makePull({ id: "p4", date: "2026-03-04", epicModules: [] }),
    ];
    const counters = selectDryStreakByPullId(pulls);
    expect(counters.get("p1")).toBe(1);
    expect(counters.get("p2")).toBe(2);
    expect(counters.has("p3")).toBe(false);
    expect(counters.get("p4")).toBe(1);
  });

  it("does not include epic pulls in the map", () => {
    const pulls = [
      makePull({ id: "p1", date: "2026-03-01", epicModules: ["a"] }),
      makePull({ id: "p2", date: "2026-03-02", epicModules: ["b"] }),
    ];
    const counters = selectDryStreakByPullId(pulls);
    expect(counters.size).toBe(0);
  });

  it("returns empty map for no pulls", () => {
    const counters = selectDryStreakByPullId([]);
    expect(counters.size).toBe(0);
  });
});

describe("selectStatsByBanner", () => {
  it("returns empty object for no pulls", () => {
    expect(selectStatsByBanner([])).toEqual({});
  });

  it("returns a single key when all pulls share one banner", () => {
    const pulls = [
      makePull({ bannerType: "standard", epicModules: ["a"], gemsSpent: 200 }),
      makePull({ bannerType: "standard", epicModules: [], gemsSpent: 200 }),
    ];
    const stats = selectStatsByBanner(pulls);
    expect(Object.keys(stats)).toEqual(["standard"]);
    expect(stats.standard).toEqual({
      totalPulls: 2,
      gemsSpent: 400,
      epicsFound: 1,
      // 1 epic out of 2 * 10 = 20 modules => 5%
      epicRate: 5,
    });
  });

  it("buckets stats per banner across multiple banners", () => {
    const pulls = [
      makePull({ bannerType: "standard", epicModules: ["a"], gemsSpent: 200 }),
      makePull({ bannerType: "featured", epicModules: ["b", "c"], gemsSpent: 300 }),
      makePull({ bannerType: "featured", epicModules: [], gemsSpent: 300 }),
      makePull({ bannerType: "lucky", epicModules: ["d"], gemsSpent: 100 }),
    ];
    const stats = selectStatsByBanner(pulls);
    expect(stats.standard).toEqual({
      totalPulls: 1,
      gemsSpent: 200,
      epicsFound: 1,
      epicRate: 10,
    });
    expect(stats.featured).toEqual({
      totalPulls: 2,
      gemsSpent: 600,
      epicsFound: 2,
      epicRate: 10,
    });
    expect(stats.lucky).toEqual({
      totalPulls: 1,
      gemsSpent: 100,
      epicsFound: 1,
      epicRate: 10,
    });
  });

  it("epicRate is 0 (not NaN) for a banner with zero epics", () => {
    const pulls = [
      makePull({ bannerType: "lucky", epicModules: [], gemsSpent: 100 }),
    ];
    const stats = selectStatsByBanner(pulls);
    expect(stats.lucky?.epicRate).toBe(0);
  });

  it("omits banners with no pulls", () => {
    const pulls = [makePull({ bannerType: "standard" })];
    const stats = selectStatsByBanner(pulls);
    expect(stats.featured).toBeUndefined();
    expect(stats.lucky).toBeUndefined();
  });

  it("per-banner totals sum to whole-history totals", () => {
    const pulls = [
      makePull({ bannerType: "standard", epicModules: ["a"], gemsSpent: 200 }),
      makePull({ bannerType: "featured", epicModules: ["b", "c"], gemsSpent: 300 }),
      makePull({ bannerType: "lucky", epicModules: ["d"], gemsSpent: 100 }),
    ];
    const stats = selectStatsByBanner(pulls);
    const sumPulls =
      (stats.standard?.totalPulls ?? 0) +
      (stats.featured?.totalPulls ?? 0) +
      (stats.lucky?.totalPulls ?? 0);
    const sumGems =
      (stats.standard?.gemsSpent ?? 0) +
      (stats.featured?.gemsSpent ?? 0) +
      (stats.lucky?.gemsSpent ?? 0);
    const sumEpics =
      (stats.standard?.epicsFound ?? 0) +
      (stats.featured?.epicsFound ?? 0) +
      (stats.lucky?.epicsFound ?? 0);
    expect(sumPulls).toBe(selectTotalPulls(pulls));
    expect(sumGems).toBe(selectTotalGems(pulls));
    expect(sumEpics).toBe(selectRarityCounts(pulls).epic);
  });
});

describe("selectPityPullIds", () => {
  it("marks epic pulls after 14+ consecutive non-epic pulls as pity", () => {
    const pulls: PullRecord[] = [];
    for (let i = 0; i < PITY_PULL_THRESHOLD - 1; i++) {
      pulls.push(makePull({ id: `dry-${i}`, date: `2026-03-${String(i + 1).padStart(2, "0")}`, epicModules: [] }));
    }
    pulls.push(makePull({ id: "pity-epic", date: "2026-03-16", epicModules: ["a"] }));
    const pityIds = selectPityPullIds(pulls);
    expect(pityIds.has("pity-epic")).toBe(true);
  });

  it("does not mark epic pulls with fewer than 14 preceding non-epic pulls", () => {
    const pulls = [
      makePull({ id: "p1", date: "2026-03-01", epicModules: [] }),
      makePull({ id: "p2", date: "2026-03-02", epicModules: ["a"] }),
    ];
    const pityIds = selectPityPullIds(pulls);
    expect(pityIds.has("p2")).toBe(false);
  });
});

describe("selectPullsSinceLastDrawnForModule", () => {
  it("returns 0 for empty pulls array", () => {
    expect(selectPullsSinceLastDrawnForModule([], "death-penalty")).toBe(0);
  });

  it("returns total lifetime draws when module never drawn", () => {
    // 3 batches logged, module never appeared -> drought counter = 3 * 10.
    const pulls = [
      makePull({ date: "2026-03-01", epicModules: ["a"] }),
      makePull({ date: "2026-03-02", epicModules: [] }),
      makePull({ date: "2026-03-03", epicModules: ["b"] }),
    ];
    expect(selectPullsSinceLastDrawnForModule(pulls, "never-drawn")).toBe(30);
  });

  it("returns 0 when module drawn in the newest batch", () => {
    const pulls = [
      makePull({ date: "2026-03-01", epicModules: ["target"] }),
      makePull({ date: "2026-03-05", epicModules: ["target", "other"] }),
    ];
    expect(selectPullsSinceLastDrawnForModule(pulls, "target")).toBe(0);
  });

  it("returns K * 10 when module drawn K batches ago", () => {
    // Newest-first order: 03-04, 03-03, 03-02 (target), 03-01.
    // 2 batches are strictly newer than the target's batch -> 20.
    const pulls = [
      makePull({ date: "2026-03-01", epicModules: [] }),
      makePull({ date: "2026-03-02", epicModules: ["target"] }),
      makePull({ date: "2026-03-03", epicModules: ["other"] }),
      makePull({ date: "2026-03-04", epicModules: [] }),
    ];
    expect(selectPullsSinceLastDrawnForModule(pulls, "target")).toBe(20);
  });

  it("breaks same-date ties by insertion order (later insertion = newer)", () => {
    // Both batches share a date. The SECOND array entry is treated as newer,
    // so the target (in the first entry) has 1 newer batch -> 10.
    const pulls = [
      makePull({ date: "2026-03-05", epicModules: ["target"] }),
      makePull({ date: "2026-03-05", epicModules: ["other"] }),
    ];
    expect(selectPullsSinceLastDrawnForModule(pulls, "target")).toBe(10);
  });
});
