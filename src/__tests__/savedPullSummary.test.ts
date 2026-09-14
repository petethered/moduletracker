import { describe, it, expect } from "vitest";
import { summarizeSavedPull } from "../features/pulls/savedPullSummary";
import { formatDisplayDate } from "../utils/formatDate";
import type { PullRecord } from "../types";

// The date part is locale-dependent (formatDisplayDate defers to the runtime
// locale), so expectations build it with the same helper rather than a literal.
const makeData = (overrides: Partial<Omit<PullRecord, "id">> = {}): Omit<PullRecord, "id"> => ({
  date: "2026-09-14",
  commonCount: 7,
  rareCount: 3,
  epicModules: [],
  gemsSpent: 200,
  bannerType: "standard",
  ...overrides,
});

describe("summarizeSavedPull", () => {
  it("summarizes a pull with no epics", () => {
    expect(summarizeSavedPull(makeData())).toEqual({
      epics: "No epics",
      counts: "7 common · 3 rare",
      context: `${formatDisplayDate("2026-09-14")} · Standard`,
    });
  });

  it("names epic modules by display name", () => {
    const summary = summarizeSavedPull(
      makeData({ epicModules: ["sentry-protocol"], commonCount: 6 }),
    );
    expect(summary.epics).toBe("Sentry Protocol");
    expect(summary.counts).toBe("6 common · 3 rare");
  });

  it("collapses duplicate epics into a multiplier, preserving first-seen order", () => {
    const summary = summarizeSavedPull(
      makeData({
        epicModules: ["gilded-sniper", "sentry-protocol", "gilded-sniper"],
        commonCount: 4,
      }),
    );
    expect(summary.epics).toBe("Gilded Sniper ×2, Sentry Protocol");
  });

  it("falls back to the raw id for a module no longer in the roster", () => {
    const summary = summarizeSavedPull(
      makeData({ epicModules: ["retired-module"], commonCount: 6 }),
    );
    expect(summary.epics).toBe("retired-module");
  });

  it("labels each banner type", () => {
    expect(summarizeSavedPull(makeData({ bannerType: "standard" })).context).toMatch(/· Standard$/);
    expect(summarizeSavedPull(makeData({ bannerType: "featured" })).context).toMatch(/· Featured$/);
    expect(summarizeSavedPull(makeData({ bannerType: "lucky" })).context).toMatch(/· Lucky$/);
  });
});
