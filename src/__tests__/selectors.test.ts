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
  selectModulePullCounts,
  selectUniqueEpicsFound,
  selectPullStreaks,
  selectPredictedGemsToComplete,
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
  it("counts pulls since last epic", () => {
    const pulls = [
      makePull({ date: "2026-03-01", epicModules: ["a"] }),
      makePull({ date: "2026-03-02", epicModules: [] }),
      makePull({ date: "2026-03-03", epicModules: [] }),
    ];
    expect(selectPitySinceLastEpic(pulls)).toBe(2);
  });

  it("counts all pulls when no epics ever", () => {
    const pulls = [makePull(), makePull(), makePull()];
    expect(selectPitySinceLastEpic(pulls)).toBe(3);
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
