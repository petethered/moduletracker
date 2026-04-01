import { describe, it, expect } from "vitest";
import { mergeData } from "../services/sync";
import type { SyncData } from "../services/sync";
import type { PullRecord } from "../types";

function makePull(overrides: Partial<PullRecord> = {}): PullRecord {
  return {
    id: crypto.randomUUID(),
    date: "2026-03-15",
    commonCount: 7,
    rareCount: 2,
    epicModules: [],
    gemsSpent: 2700,
    bannerType: "standard",
    ...overrides,
  };
}

function makeData(overrides: Partial<SyncData> = {}): SyncData {
  return {
    pulls: [],
    moduleProgress: {},
    bannerDefault: "standard",
    ...overrides,
  };
}

describe("mergeData", () => {
  it("returns local data when cloud is empty", () => {
    const pull = makePull();
    const local = makeData({ pulls: [pull] });
    const cloud = makeData();

    const result = mergeData(local, cloud);
    expect(result.pulls).toHaveLength(1);
    expect(result.pulls[0].id).toBe(pull.id);
  });

  it("returns cloud data when local is empty", () => {
    const pull = makePull();
    const local = makeData();
    const cloud = makeData({ pulls: [pull] });

    const result = mergeData(local, cloud);
    expect(result.pulls).toHaveLength(1);
    expect(result.pulls[0].id).toBe(pull.id);
  });

  it("unions pulls by ID — keeps unique pulls from both sides", () => {
    const pullA = makePull({ id: "aaa" });
    const pullB = makePull({ id: "bbb" });
    const pullC = makePull({ id: "ccc" });

    const local = makeData({ pulls: [pullA, pullB] });
    const cloud = makeData({ pulls: [pullB, pullC] });

    const result = mergeData(local, cloud);
    expect(result.pulls).toHaveLength(3);
    const ids = result.pulls.map((p) => p.id).sort();
    expect(ids).toEqual(["aaa", "bbb", "ccc"]);
  });

  it("local pull wins for same-ID duplicates", () => {
    const local = makeData({
      pulls: [makePull({ id: "shared", commonCount: 99 })],
    });
    const cloud = makeData({
      pulls: [makePull({ id: "shared", commonCount: 1 })],
    });

    const result = mergeData(local, cloud);
    expect(result.pulls).toHaveLength(1);
    expect(result.pulls[0].commonCount).toBe(99);
  });

  it("merges module progress — keeps modules unique to each side", () => {
    const local = makeData({
      moduleProgress: {
        "mod-a": { moduleId: "mod-a", currentRarity: "epic" },
      },
    });
    const cloud = makeData({
      moduleProgress: {
        "mod-b": { moduleId: "mod-b", currentRarity: "legendary" },
      },
    });

    const result = mergeData(local, cloud);
    expect(Object.keys(result.moduleProgress)).toHaveLength(2);
    expect(result.moduleProgress["mod-a"].currentRarity).toBe("epic");
    expect(result.moduleProgress["mod-b"].currentRarity).toBe("legendary");
  });

  it("takes higher rarity when both sides have the same module", () => {
    const local = makeData({
      moduleProgress: {
        "mod-a": { moduleId: "mod-a", currentRarity: "legendary" },
      },
    });
    const cloud = makeData({
      moduleProgress: {
        "mod-a": { moduleId: "mod-a", currentRarity: "mythic" },
      },
    });

    const result = mergeData(local, cloud);
    expect(result.moduleProgress["mod-a"].currentRarity).toBe("mythic");
  });

  it("takes local rarity when local is higher", () => {
    const local = makeData({
      moduleProgress: {
        "mod-a": { moduleId: "mod-a", currentRarity: "ancestral" },
      },
    });
    const cloud = makeData({
      moduleProgress: {
        "mod-a": { moduleId: "mod-a", currentRarity: "epic+" },
      },
    });

    const result = mergeData(local, cloud);
    expect(result.moduleProgress["mod-a"].currentRarity).toBe("ancestral");
  });

  it("local bannerDefault wins", () => {
    const local = makeData({ bannerDefault: "featured" });
    const cloud = makeData({ bannerDefault: "standard" });

    const result = mergeData(local, cloud);
    expect(result.bannerDefault).toBe("featured");
  });

  it("handles both sides empty", () => {
    const result = mergeData(makeData(), makeData());
    expect(result.pulls).toHaveLength(0);
    expect(Object.keys(result.moduleProgress)).toHaveLength(0);
    expect(result.bannerDefault).toBe("standard");
  });

  it("handles star rarities in merge comparison", () => {
    const local = makeData({
      moduleProgress: {
        "mod-a": { moduleId: "mod-a", currentRarity: "3*" },
      },
    });
    const cloud = makeData({
      moduleProgress: {
        "mod-a": { moduleId: "mod-a", currentRarity: "1*" },
      },
    });

    const result = mergeData(local, cloud);
    expect(result.moduleProgress["mod-a"].currentRarity).toBe("3*");
  });
});
