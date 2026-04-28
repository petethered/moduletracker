/**
 * Pure selector functions over PullRecord[] (and a couple of constants).
 *
 * RESPONSIBILITY:
 * The single home for derived stats. Per project convention (CLAUDE.md):
 * stats are NEVER stored in state — every chart/number on screen is computed
 * here from `pulls` (and occasionally moduleProgress / a totalModuleCount).
 *
 * DEPENDED ON BY:
 * - src/features/dashboard/* (totals, rates, predictions, gauges)
 * - src/features/analytics/* (over-time series, streaks, merge progress)
 * - src/features/modules/* (per-module pull counts + last-pull dates)
 * - src/features/history/* (sorted lists, dry-streak / pity badges)
 *
 * DESIGN:
 * - All functions are pure: same input -> same output, no I/O, no store reads.
 * - Selectors take `pulls` (and sometimes a totalModuleCount) explicitly so
 *   they're easy to memoize, test, and call from anywhere — they do NOT
 *   import the store. Components do `useStore(s => s.pulls)` and pass it in.
 * - Sorting helpers are isolated up top; everything else that needs ordering
 *   delegates to them so the same-date tiebreak rule is consistent.
 *
 * IMPORTANT INVARIANTS THE SELECTORS RELY ON:
 * - Each PullRecord represents exactly 10 drops:
 *     commonCount + rareCount + epicModules.length === 10.
 *   Several selectors (selectEpicRateOverTime, selectPitySinceLastEpic) use
 *   the literal 10 instead of summing — if the per-pull count ever changes,
 *   audit those selectors.
 * - Insertion order in the pulls array is meaningful: selectors break
 *   same-date ties using array index. pullsSlice carefully preserves this
 *   on update/delete.
 *
 * GAME-DOMAIN CONSTANTS:
 * - PITY_PULL_THRESHOLD = 15 — after 15 consecutive non-epic 10x pulls,
 *   the next pull is guaranteed to contain an epic.
 * - COPIES_FOR_ANCESTRAL = 8 — copies needed to merge a module to ancestral.
 * - COPIES_FOR_5_STAR = 18 — copies needed to reach 5-star tier.
 * - 200 / 0.025 — fallback gems-per-epic when we have zero data: assumes
 *   the published 2.5% epic odds and 200 gems per 10x pull. Used only as a
 *   bootstrap so prediction selectors don't return 0 with empty history.
 */

import type { PullRecord } from "../types";

/**
 * Sort pulls chronologically (oldest first).
 * Same-date pulls preserve insertion order (later entries = newer).
 *
 * IMPLEMENTATION:
 * Decorate-sort-undecorate (Schwartzian transform) — we attach the original
 * array index `i`, sort by (date asc, index asc), then strip i. Two reasons:
 *   1. Stable same-date ordering across all selectors that consume sorted lists.
 *   2. Array.prototype.sort is not guaranteed stable on every legacy engine,
 *      and we want the rule explicit anyway: "later array index wins ties".
 *
 * Returns a new array; does not mutate input.
 */
export function sortPullsChronological(pulls: PullRecord[]): PullRecord[] {
  return pulls
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      const dateCmp =
        new Date(a.p.date).getTime() - new Date(b.p.date).getTime();
      // dateCmp === 0 means same date — fall back to insertion order (smaller index = older).
      return dateCmp !== 0 ? dateCmp : a.i - b.i;
    })
    .map(({ p }) => p);
}

/**
 * Sort pulls reverse-chronologically (newest first).
 * Same-date pulls: later entries appear first.
 *
 * Mirror of sortPullsChronological with both comparators flipped — keeping
 * them as separate functions (rather than a sortPulls(direction) helper)
 * because callers are tiny and the flipped tiebreaker is easy to mis-write
 * if you try to share code.
 *
 * Returns a new array; does not mutate input.
 */
export function sortPullsNewest(pulls: PullRecord[]): PullRecord[] {
  return pulls
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      const dateCmp =
        new Date(b.p.date).getTime() - new Date(a.p.date).getTime();
      // Same-date tiebreak: larger index (later insertion) appears first.
      return dateCmp !== 0 ? dateCmp : b.i - a.i;
    })
    .map(({ p }) => p);
}

/**
 * Total number of 10x pulls the user has logged.
 * NOTE: this is the count of records (10x batches), not individual modules.
 * Multiply by 10 for "modules pulled" total.
 */
export function selectTotalPulls(pulls: PullRecord[]): number {
  return pulls.length;
}

/**
 * Sum of gems spent across every pull. Used for the dashboard total and
 * as the numerator for selectGemsPerEpic.
 */
export function selectTotalGems(pulls: PullRecord[]): number {
  return pulls.reduce((sum, p) => sum + p.gemsSpent, 0);
}

/**
 * Aggregate counts of every drop across all pulls, broken down by rarity.
 *
 * Returns:
 *   common — total commons across all pulls
 *   rare   — total rares
 *   epic   — total epic-tier drops (sum of epicModules.length per record)
 *   total  — common + rare + epic. SHOULD equal pulls.length * 10 if the
 *            10-per-pull invariant holds, but we compute it from the parts
 *            so the function is also correct for partial / corrupted data.
 *
 * Hot-path-ish: dashboard re-renders call this. Single pass for-of over the
 * array; do not replace with three reduce() calls.
 */
export function selectRarityCounts(pulls: PullRecord[]) {
  let common = 0;
  let rare = 0;
  let epic = 0;
  for (const p of pulls) {
    common += p.commonCount;
    rare += p.rareCount;
    epic += p.epicModules.length;
  }
  return { common, rare, epic, total: common + rare + epic };
}

/**
 * Same shape as selectRarityCounts but as percentages of the total drops.
 * Edge case: zero pulls -> all zeros (avoid divide-by-zero NaN bleeding into the UI).
 */
export function selectRarityPercentages(pulls: PullRecord[]) {
  const counts = selectRarityCounts(pulls);
  if (counts.total === 0) return { common: 0, rare: 0, epic: 0 };
  return {
    common: (counts.common / counts.total) * 100,
    rare: (counts.rare / counts.total) * 100,
    epic: (counts.epic / counts.total) * 100,
  };
}

/**
 * Epic drop rate as a percentage of all drops (epic / total * 100).
 * Returns 0 with an empty pull list. Reuses selectRarityCounts to keep the
 * "epic %" definition consistent with the breakdown selector above.
 */
export function selectEpicPullRate(pulls: PullRecord[]): number {
  const counts = selectRarityCounts(pulls);
  if (counts.total === 0) return 0;
  return (counts.epic / counts.total) * 100;
}

/**
 * Average gems spent per epic dropped — the "cost" of a single epic.
 *
 * Returns 0 if no epics have been pulled yet (UI treats 0 as "no data").
 * Note: prediction selectors below substitute a published-rate fallback
 * (200 / 0.025) when this returns 0 — see selectPredictedGemsToComplete /
 * selectPredictedGemsForMerge.
 */
export function selectGemsPerEpic(pulls: PullRecord[]): number {
  const totalEpics = pulls.reduce((sum, p) => sum + p.epicModules.length, 0);
  if (totalEpics === 0) return 0;
  const totalGems = selectTotalGems(pulls);
  return totalGems / totalEpics;
}

/**
 * "Pity counter" — number of individual modules pulled since the last epic.
 *
 * Walks the chronologically-sorted list backwards from the latest pull,
 * counting +10 per pull until we hit a pull that contained an epic.
 * Returns 0 if the most recent pull contained an epic, or if there are no pulls.
 *
 * GOTCHA: count is in modules (10 per pull batch), not pull batches —
 * matches how the in-game pity threshold is communicated to players.
 */
export function selectPitySinceLastEpic(pulls: PullRecord[]): number {
  const sorted = sortPullsChronological(pulls);
  let count = 0;
  // Iterate from newest to oldest. Break as soon as we find an epic-containing pull.
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].epicModules.length > 0) break;
    count += 10;
  }
  return count;
}

/** Number of consecutive non-epic 10x pulls before the pity system guarantees an epic. */
export const PITY_PULL_THRESHOLD = 15;

/**
 * Returns a Map of pull ID → dry-streak position (1-indexed)
 * for every non-epic pull that is part of a dry streak.
 * E.g. the 4th consecutive non-epic pull maps to 4.
 *
 * Used by the history list to badge each non-epic row with its position in
 * the dry streak (so the user can see "I'm 12 deep, 3 to go to pity").
 *
 * Algorithm: single pass in chronological order. Each non-epic pull
 * increments the running streak; each epic pull resets it. Every non-epic
 * pull's id is recorded with the streak value AT THAT POINT — that's why we
 * need the running counter rather than a post-hoc grouping.
 *
 * Pulls that contain an epic are NOT in the returned map (callers .get and
 * treat undefined as "not part of a streak").
 */
export function selectDryStreakByPullId(
  pulls: PullRecord[]
): Map<string, number> {
  const sorted = sortPullsChronological(pulls);
  const counters = new Map<string, number>();
  let dryStreak = 0;

  for (const p of sorted) {
    if (p.epicModules.length > 0) {
      // Epic resets the streak. We do NOT record the epic pull itself.
      dryStreak = 0;
    } else {
      dryStreak++;
      counters.set(p.id, dryStreak);
    }
  }

  return counters;
}

/**
 * Returns a Set of pull IDs that are "pity" pulls — an epic pull
 * where the previous 14+ pulls had zero epics.
 *
 * Why the magic 14? PITY_PULL_THRESHOLD is 15 (15th pull is guaranteed).
 * If `dryStreak >= 14` going INTO an epic-containing pull, that pull is
 * the 15th-or-later in the dry sequence and therefore the pity-triggered one.
 *
 * Used by the UI to highlight pity-triggered epics differently from
 * "lucky" epics that dropped before the threshold.
 */
export function selectPityPullIds(pulls: PullRecord[]): Set<string> {
  const sorted = sortPullsChronological(pulls);
  const pityIds = new Set<string>();
  let dryStreak = 0;

  for (const p of sorted) {
    if (p.epicModules.length > 0) {
      // Compare BEFORE resetting: the streak count we care about is the run
      // leading INTO this epic pull, not the run after.
      if (dryStreak >= PITY_PULL_THRESHOLD - 1) pityIds.add(p.id);
      dryStreak = 0;
    } else {
      dryStreak++;
    }
  }

  return pityIds;
}

/**
 * Per-module count of how many copies the user has pulled at epic.
 * Returned as a plain Record<moduleId, count>. Modules never pulled are absent
 * from the result (callers default to 0).
 *
 * Reused by: module grid, merge-progress selector, predicted-gems-for-merge.
 */
export function selectModulePullCounts(
  pulls: PullRecord[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of pulls) {
    for (const moduleId of p.epicModules) {
      // `(counts[moduleId] || 0) + 1` instead of a default — keeps memory
      // footprint tight (no entry for modules never seen).
      counts[moduleId] = (counts[moduleId] || 0) + 1;
    }
  }
  return counts;
}

/**
 * Number of distinct epic modules the user has pulled at least once.
 * Used by completion progress + the coupon-collector prediction.
 */
export function selectUniqueEpicsFound(pulls: PullRecord[]): number {
  const unique = new Set<string>();
  for (const p of pulls) {
    for (const moduleId of p.epicModules) {
      unique.add(moduleId);
    }
  }
  return unique.size;
}

/**
 * Returns the date string of the newest pull that included `moduleId` at
 * epic, or null if the user has never pulled it. Used by the modules grid
 * to surface "last seen on …".
 *
 * Walks newest-first and short-circuits on first match — preferred over
 * filter+max because most modules appear early in the search.
 */
export function selectLastPullDateForModule(
  pulls: PullRecord[],
  moduleId: string
): string | null {
  const sorted = sortPullsNewest(pulls);
  for (const p of sorted) {
    if (p.epicModules.includes(moduleId)) return p.date;
  }
  return null;
}

/**
 * Per-module share of all epic drops, as a percentage.
 *
 * Numerator: this module's count (0 if never pulled).
 * Denominator: total epic drops across the whole history.
 * Returns 0 if no epics have been pulled (avoid NaN).
 */
export function selectModuleEpicPercentage(
  pulls: PullRecord[],
  moduleId: string
): number {
  const counts = selectModulePullCounts(pulls);
  const totalEpics = pulls.reduce((sum, p) => sum + p.epicModules.length, 0);
  if (totalEpics === 0) return 0;
  return ((counts[moduleId] || 0) / totalEpics) * 100;
}

/**
 * Best/worst streaks over the whole history.
 *
 * Returns:
 *   bestEpicStreak — longest run of consecutive epic-containing pulls.
 *   worstDryStreak — longest run of consecutive non-epic pulls.
 *
 * Single pass with two running counters; both maxes updated each iteration.
 * Empty input short-circuits to zeros.
 */
export function selectPullStreaks(pulls: PullRecord[]) {
  if (pulls.length === 0) return { bestEpicStreak: 0, worstDryStreak: 0 };

  const sorted = sortPullsChronological(pulls);

  let bestEpicStreak = 0;
  let worstDryStreak = 0;
  let currentEpicStreak = 0;
  let currentDryStreak = 0;

  for (const p of sorted) {
    if (p.epicModules.length > 0) {
      // Epic pull: extend epic streak, reset dry streak.
      currentEpicStreak++;
      currentDryStreak = 0;
    } else {
      // Non-epic pull: extend dry streak, reset epic streak.
      currentDryStreak++;
      currentEpicStreak = 0;
    }
    // Update maxes EVERY iteration so the single-element streak case is captured.
    bestEpicStreak = Math.max(bestEpicStreak, currentEpicStreak);
    worstDryStreak = Math.max(worstDryStreak, currentDryStreak);
  }

  return { bestEpicStreak, worstDryStreak };
}

/**
 * Predict gems still needed to find every remaining unique module
 * (i.e., to reach 100% collection — does NOT model merging up to 5*).
 *
 * Math: classic coupon-collector expectation.
 *   E[pulls to collect remaining r out of N] = sum_{i=1..r} N/i
 * Then multiply by user's measured gems-per-epic to convert "expected epic
 * pulls" into "expected gems".
 *
 * Fallback rate (200 / 0.025): when the user has zero data, use the
 * published 2.5% epic rate at 200 gems/10x. This means brand-new users see
 * a credible estimate immediately and it tightens up as they log pulls.
 *
 * Returns 0 if the collection is already complete.
 */
export function selectPredictedGemsToComplete(
  pulls: PullRecord[],
  totalModuleCount: number
): number {
  const uniqueFound = selectUniqueEpicsFound(pulls);
  if (uniqueFound >= totalModuleCount) return 0;

  const remaining = totalModuleCount - uniqueFound;
  const gemsPerEpic = selectGemsPerEpic(pulls);
  // Bootstrap: if we have no measured rate yet, fall back to published odds.
  const epicRate = gemsPerEpic > 0 ? gemsPerEpic : 200 / 0.025;

  // Coupon-collector summation: expected number of single epic draws to
  // collect the `remaining` unseen modules out of the catalog of `totalModuleCount`.
  let expectedPulls = 0;
  for (let i = 1; i <= remaining; i++) {
    expectedPulls += totalModuleCount / i;
  }

  return Math.round(expectedPulls * epicRate);
}

/**
 * Time series of the cumulative epic rate (epics / total modules) at each pull.
 *
 * Each point is computed AFTER incorporating that pull, so the first point
 * reflects post-pull-1 state, etc. UI plots this as a "is my luck regressing
 * to the mean?" line — should converge toward the published epic rate.
 *
 * Hard-coded `+= 10` reflects the 10-per-pull invariant. If pull batch size
 * ever varies, replace with `(p.commonCount + p.rareCount + p.epicModules.length)`.
 */
export function selectEpicRateOverTime(
  pulls: PullRecord[]
): { date: string; rate: number }[] {
  const sorted = sortPullsChronological(pulls);

  let totalModules = 0;
  let totalEpics = 0;
  const points: { date: string; rate: number }[] = [];

  for (const p of sorted) {
    totalModules += 10;
    totalEpics += p.epicModules.length;
    points.push({
      date: p.date,
      rate: totalModules > 0 ? (totalEpics / totalModules) * 100 : 0,
    });
  }

  return points;
}

/**
 * Time series of cumulative gems-per-epic at each pull.
 *
 * Points are only emitted ONCE the user has pulled their first epic — the
 * pre-first-epic period would be infinite/undefined gems-per-epic, which
 * would distort the chart axis. Callers should expect the series to start
 * later than the first pull date.
 */
export function selectGemsPerEpicOverTime(
  pulls: PullRecord[]
): { date: string; gemsPerEpic: number }[] {
  const sorted = sortPullsChronological(pulls);

  let totalGems = 0;
  let totalEpics = 0;
  const points: { date: string; gemsPerEpic: number }[] = [];

  for (const p of sorted) {
    totalGems += p.gemsSpent;
    totalEpics += p.epicModules.length;
    // Skip points where we'd divide by zero — series begins at the first epic-containing pull.
    if (totalEpics > 0) {
      points.push({
        date: p.date,
        gemsPerEpic: totalGems / totalEpics,
      });
    }
  }

  return points;
}

/** Copies of a single module needed to merge it to ancestral. Game-defined constant. */
export const COPIES_FOR_ANCESTRAL = 8;
/**
 * Copies needed to reach 5-star (the highest tier). Game-defined.
 * Module-private (not exported) because only selectMergeProgress uses it directly;
 * external callers should pass `copiesPerModule` to selectPredictedGemsForMerge instead.
 */
const COPIES_FOR_5_STAR = 18;

/**
 * Aggregate progress toward the two big collection goals: every module at
 * ancestral, and every module at 5-star.
 *
 * For each MODULE THE USER HAS EVER PULLED:
 *   - count its copies (cap at the goal threshold, so over-merged modules
 *     don't inflate the "copies banked" totals).
 *   - flag whether it has hit each threshold.
 *
 * The "needed" totals are computed against the FULL catalog
 * (totalModuleCount * threshold), so unfound modules contribute their full
 * copy-cost to the denominator — the progress bar reflects "of what you need
 * for ALL modules", not "of what you need for found modules".
 *
 * Returns shaped for direct dashboard binding.
 */
export function selectMergeProgress(
  pulls: PullRecord[],
  totalModuleCount: number
) {
  const counts = selectModulePullCounts(pulls);
  let totalCopiesForAncestral = 0;
  let totalCopiesFor5Star = 0;
  let modulesAtAncestral = 0;
  let modulesAt5Star = 0;

  // Build the set of module ids the user has pulled at least once. We can't
  // just iterate `Object.keys(counts)` if we wanted to include unfound modules
  // — but here we only iterate found modules and add unfound contributions
  // implicitly via the "needed" totals below.
  const moduleIds = new Set<string>();
  for (const p of pulls) {
    for (const id of p.epicModules) moduleIds.add(id);
  }

  for (const id of moduleIds) {
    const c = counts[id] || 0;
    // Cap at threshold: extra copies past 8/18 are merge fodder, not progress
    // toward THIS goal. Without the cap, a single over-pulled module would
    // drag the "copies banked" bar past 100% while other modules sit at 0.
    totalCopiesForAncestral += Math.min(c, COPIES_FOR_ANCESTRAL);
    totalCopiesFor5Star += Math.min(c, COPIES_FOR_5_STAR);
    if (c >= COPIES_FOR_ANCESTRAL) modulesAtAncestral++;
    if (c >= COPIES_FOR_5_STAR) modulesAt5Star++;
  }

  // Denominators: assumes you want EVERY module up to the tier, not just found ones.
  const neededForAllAncestral = totalModuleCount * COPIES_FOR_ANCESTRAL;
  const neededForAll5Star = totalModuleCount * COPIES_FOR_5_STAR;

  return {
    copiesForAncestral: totalCopiesForAncestral,
    neededForAllAncestral,
    modulesAtAncestral,
    copiesFor5Star: totalCopiesFor5Star,
    neededForAll5Star,
    modulesAt5Star,
  };
}

/**
 * Predict gems remaining to bring EVERY module in the catalog up to
 * `copiesPerModule` copies (e.g. 8 for ancestral, 18 for 5-star).
 *
 * The math has two pieces:
 *   1. For modules we've already pulled, we still need (target - current)
 *      copies. This is bounded above by `copiesPerModule` (already-merged
 *      surplus contributes 0 via the Math.max).
 *   2. For modules we have NOT pulled, we need (a) the FIRST copy of each
 *      (a coupon-collector problem) plus (b) `copiesPerModule - 1` additional
 *      copies. We model that as `unfound * copiesPerModule` flat copies plus
 *      `couponCost` epic-pulls to FIND them — then subtract `unfound` because
 *      `couponCost` already accounts for the first copy of each unfound
 *      module (those are the same draws).
 *
 * The result is converted from "epic pulls" to "gems" using the user's
 * measured gems-per-epic, falling back to 200 / 0.025 for empty histories.
 *
 * Returns max(0, …) rounded to a whole number; never negative.
 *
 * REJECTED ALTERNATIVE: a Monte Carlo simulation. Closed-form is fast,
 * deterministic, easy to test, and the variance on the prediction is large
 * enough that simulation precision wouldn't matter to users.
 */
export function selectPredictedGemsForMerge(
  pulls: PullRecord[],
  totalModuleCount: number,
  copiesPerModule: number
) {
  const counts = selectModulePullCounts(pulls);
  const gemsPerEpic = selectGemsPerEpic(pulls);
  // Same bootstrap fallback as selectPredictedGemsToComplete.
  const rate = gemsPerEpic > 0 ? gemsPerEpic : 200 / 0.025;

  let totalCopiesNeeded = 0;
  const moduleIds = new Set<string>();
  for (const p of pulls) {
    for (const id of p.epicModules) moduleIds.add(id);
  }

  // Copies still needed for modules we've already found
  for (const id of moduleIds) {
    const c = counts[id] || 0;
    // Math.max guards against modules already AT or ABOVE the target — they
    // contribute 0, not negative copies.
    totalCopiesNeeded += Math.max(0, copiesPerModule - c);
  }

  // Modules we haven't found yet need full copies
  const unfound = totalModuleCount - moduleIds.size;
  totalCopiesNeeded += unfound * copiesPerModule;

  // For unfound modules, use coupon collector for the "find" cost
  // Same N/i summation as selectPredictedGemsToComplete: the expected number
  // of single epic draws (assuming uniform distribution over the catalog)
  // to first-see each of the `unfound` modules.
  let couponCost = 0;
  for (let i = 1; i <= unfound; i++) {
    couponCost += totalModuleCount / i;
  }

  // couponCost includes the 1st copy of each unfound module
  // ↑ critical: those `unfound` first-copies were ALREADY counted in
  // totalCopiesNeeded (`unfound * copiesPerModule`), so we subtract `unfound`
  // here to avoid double-counting. The remaining (copiesPerModule - 1) copies
  // per unfound module are still in totalCopiesNeeded as "additional copies".
  const totalEpics = totalCopiesNeeded + couponCost - unfound;

  // Math.max guards against the (rare) goal-already-met case where the
  // arithmetic could go slightly negative due to rounding in fallback rates.
  return Math.round(Math.max(0, totalEpics) * rate);
}
