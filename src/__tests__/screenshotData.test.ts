import { describe, it, expect } from "vitest";
import type { PullRecord, ModuleProgress } from "../types";
import { buildScreenshotData } from "../features/screenshot/screenshotData";

const makePull = (overrides: Partial<PullRecord> = {}): PullRecord => ({
  id: Math.random().toString(),
  date: "2026-03-30",
  commonCount: 7,
  rareCount: 2,
  epicModules: [],
  gemsSpent: 200,
  bannerType: "standard",
  ...overrides,
});

describe("buildScreenshotData", () => {
  it("returns 4 sections with all 24 modules when pulls are empty", () => {
    const data = buildScreenshotData([], {});
    expect(data.sections).toHaveLength(4);
    expect(data.sections.map((s) => s.label)).toEqual([
      "CANNON",
      "ARMOR",
      "GENERATOR",
      "CORE",
    ]);
    const totalModules = data.sections.reduce(
      (sum, s) => sum + s.modules.length,
      0,
    );
    expect(totalModules).toBe(24);
  });

  it("returns zeroed stats with empty pulls", () => {
    const data = buildScreenshotData([], {});
    expect(data.stats.totalPulls).toBe(0);
    expect(data.stats.gemsSpent).toBe(0);
    expect(data.stats.gemsPerEpic).toBe(0);
    expect(data.stats.commonCount).toBe(0);
    expect(data.stats.rareCount).toBe(0);
    expect(data.stats.epicCount).toBe(0);
  });

  it("all modules have 0 copies and null lastPulled with empty pulls", () => {
    const data = buildScreenshotData([], {});
    for (const section of data.sections) {
      expect(section.pctOfPulls).toBe(0);
      for (const mod of section.modules) {
        expect(mod.copies).toBe(0);
        expect(mod.lastPulled).toBeNull();
        expect(mod.pctOfPulls).toBe(0);
        expect(mod.currentRarity).toBeNull();
      }
    }
  });

  it("computes correct per-module copies, stats, and pctOfPulls", () => {
    const pulls = [
      makePull({
        epicModules: ["shrink-ray", "death-penalty"],
        commonCount: 6,
        rareCount: 2,
        gemsSpent: 200,
      }),
      makePull({
        epicModules: ["shrink-ray"],
        commonCount: 8,
        rareCount: 1,
        gemsSpent: 200,
      }),
    ];
    const data = buildScreenshotData(pulls, {});

    // Find shrink-ray in cannon section
    const cannon = data.sections.find((s) => s.label === "CANNON")!;
    const shrinkRay = cannon.modules.find((m) => m.name === "Shrink Ray")!;
    expect(shrinkRay.copies).toBe(2);
    // 2 out of 3 total epics = 66.67%
    expect(shrinkRay.pctOfPulls).toBeCloseTo(66.67, 1);

    const deathPenalty = cannon.modules.find(
      (m) => m.name === "Death Penalty",
    )!;
    expect(deathPenalty.copies).toBe(1);
    // 1 out of 3 total epics = 33.33%
    expect(deathPenalty.pctOfPulls).toBeCloseTo(33.33, 1);

    // Cannon section has all 3 epics -> 100%
    expect(cannon.pctOfPulls).toBeCloseTo(100, 1);

    // Stats
    expect(data.stats.totalPulls).toBe(2);
    expect(data.stats.gemsSpent).toBe(400);
    expect(data.stats.epicCount).toBe(3);
    expect(data.stats.commonCount).toBe(14);
    expect(data.stats.rareCount).toBe(3);
    expect(data.stats.gemsPerEpic).toBeCloseTo(133.33, 1);
  });

  it("computes section pctOfPulls across types", () => {
    const pulls = [
      makePull({
        epicModules: ["shrink-ray", "dimension-core"],
      }),
    ];
    const data = buildScreenshotData(pulls, {});
    const cannon = data.sections.find((s) => s.label === "CANNON")!;
    const core = data.sections.find((s) => s.label === "CORE")!;
    const armor = data.sections.find((s) => s.label === "ARMOR")!;
    // Each type got 1 of 2 total epics = 50%
    expect(cannon.pctOfPulls).toBeCloseTo(50, 1);
    expect(core.pctOfPulls).toBeCloseTo(50, 1);
    expect(armor.pctOfPulls).toBe(0);
  });

  it("includes current rarity from moduleProgress", () => {
    const progress: Record<string, ModuleProgress> = {
      "shrink-ray": { moduleId: "shrink-ray", currentRarity: "legendary" },
    };
    const data = buildScreenshotData([], progress);
    const cannon = data.sections.find((s) => s.label === "CANNON")!;
    const shrinkRay = cannon.modules.find((m) => m.name === "Shrink Ray")!;
    expect(shrinkRay.currentRarity).toBe("legendary");
  });

  it("formats lastPulled as a locale date string", () => {
    const pulls = [
      makePull({ date: "2026-03-17", epicModules: ["dimension-core"] }),
    ];
    const data = buildScreenshotData(pulls, {});
    const core = data.sections.find((s) => s.label === "CORE")!;
    const dim = core.modules.find((m) => m.name === "Dimension Core")!;
    expect(dim.lastPulled).toBeTruthy();
    // Should be a formatted date, not raw ISO
    expect(dim.lastPulled).not.toContain("2026-03-17");
  });

  it("includes generatedAt date", () => {
    const data = buildScreenshotData([], {});
    expect(data.generatedAt).toBeTruthy();
    expect(typeof data.generatedAt).toBe("string");
  });
});
