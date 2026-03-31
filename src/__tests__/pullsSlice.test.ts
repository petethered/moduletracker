import { describe, it, expect, beforeEach } from "vitest";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { createPullsSlice, type PullsSlice } from "../store/pullsSlice";

function createTestStore() {
  return create<PullsSlice>()(immer((...a) => createPullsSlice(...a)));
}

describe("pullsSlice", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  it("starts with empty pulls array", () => {
    expect(store.getState().pulls).toEqual([]);
  });

  it("adds a pull with generated id", () => {
    store.getState().addPull({
      date: "2026-03-30",
      commonCount: 7,
      rareCount: 2,
      epicModules: ["death-penalty"],
      gemsSpent: 200,
      bannerType: "standard",
    });
    const pulls = store.getState().pulls;
    expect(pulls).toHaveLength(1);
    expect(pulls[0].id).toBeDefined();
    expect(pulls[0].commonCount).toBe(7);
    expect(pulls[0].epicModules).toEqual(["death-penalty"]);
  });

  it("updates a pull", () => {
    store.getState().addPull({
      date: "2026-03-30",
      commonCount: 7,
      rareCount: 2,
      epicModules: ["death-penalty"],
      gemsSpent: 200,
      bannerType: "standard",
    });
    const id = store.getState().pulls[0].id;
    store.getState().updatePull(id, { commonCount: 6, rareCount: 3 });
    const pull = store.getState().pulls[0];
    expect(pull.commonCount).toBe(6);
    expect(pull.rareCount).toBe(3);
  });

  it("deletes a pull", () => {
    store.getState().addPull({
      date: "2026-03-30",
      commonCount: 7,
      rareCount: 3,
      epicModules: [],
      gemsSpent: 200,
      bannerType: "standard",
    });
    const id = store.getState().pulls[0].id;
    store.getState().deletePull(id);
    expect(store.getState().pulls).toHaveLength(0);
  });

  it("imports pulls replacing existing", () => {
    store.getState().addPull({
      date: "2026-03-30",
      commonCount: 7,
      rareCount: 3,
      epicModules: [],
      gemsSpent: 200,
      bannerType: "standard",
    });
    const imported = [
      {
        id: "imported-1",
        date: "2026-03-01",
        commonCount: 8,
        rareCount: 2,
        epicModules: [],
        gemsSpent: 200,
        bannerType: "featured" as const,
      },
    ];
    store.getState().importPulls(imported);
    expect(store.getState().pulls).toHaveLength(1);
    expect(store.getState().pulls[0].id).toBe("imported-1");
  });

  it("clears all pulls", () => {
    store.getState().addPull({
      date: "2026-03-30",
      commonCount: 7,
      rareCount: 3,
      epicModules: [],
      gemsSpent: 200,
      bannerType: "standard",
    });
    store.getState().clearPulls();
    expect(store.getState().pulls).toHaveLength(0);
  });
});
