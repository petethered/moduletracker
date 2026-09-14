/**
 * epicSlots.ts — the rule for which non-epic drop an epic replaces.
 *
 * A 10x pull always has exactly 10 drops. When the user clicks "+ Add Epic",
 * one existing common or rare drop has to become that epic; when they remove
 * an epic, the slot has to go back somewhere. PullForm calls these two pure
 * functions so the rule is unit-tested (src/__tests__/epicSlots.test.ts)
 * instead of living only inside click handlers.
 *
 * THE RULE (explicit user ask, do not flip back to rare-first):
 *   - take:   COMMON first, then rare. Commons are the bulk of every 10x, so an
 *             epic almost always displaced a common. With the 7/3 default one
 *             epic gives 6 common / 3 rare, leaving the rare count, the one the
 *             user most likely already set correctly, untouched.
 *   - return: always to COMMON.
 *
 * INVARIANT: returnSlotFromEpic must undo takeSlotForEpic whenever a common
 * was available. If they disagree, repeated add/remove cycles silently move
 * drops between buckets (e.g. returning to rare turns 7/3 into 6/4 after one
 * mis-tap). The test "is the exact inverse…" enforces this. Change both or
 * neither.
 *
 * Known asymmetry: when commons were already 0 the take came from rare, but
 * the return still goes to common (0/10 -> add -> 0/9 -> remove -> 1/9).
 * Accepted: it's an edge case, and remembering per-row where each slot came
 * from would add state to every epic row for no practical gain.
 */

export interface NonEpicSplit {
  common: number;
  rare: number;
}

/** Split after converting one non-epic drop into an epic, or null if there is none to convert. */
export function takeSlotForEpic({ common, rare }: NonEpicSplit): NonEpicSplit | null {
  if (common > 0) return { common: common - 1, rare };
  if (rare > 0) return { common, rare: rare - 1 };
  return null;
}

/** Split after removing an epic; the freed slot goes back to common. */
export function returnSlotFromEpic({ common, rare }: NonEpicSplit): NonEpicSplit {
  return { common: common + 1, rare };
}
