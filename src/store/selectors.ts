import type { PullRecord } from "../types";

/**
 * Sort pulls chronologically (oldest first).
 * Same-date pulls preserve insertion order (later entries = newer).
 */
export function sortPullsChronological(pulls: PullRecord[]): PullRecord[] {
  return pulls
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      const dateCmp =
        new Date(a.p.date).getTime() - new Date(b.p.date).getTime();
      return dateCmp !== 0 ? dateCmp : a.i - b.i;
    })
    .map(({ p }) => p);
}

/**
 * Sort pulls reverse-chronologically (newest first).
 * Same-date pulls: later entries appear first.
 */
export function sortPullsNewest(pulls: PullRecord[]): PullRecord[] {
  return pulls
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      const dateCmp =
        new Date(b.p.date).getTime() - new Date(a.p.date).getTime();
      return dateCmp !== 0 ? dateCmp : b.i - a.i;
    })
    .map(({ p }) => p);
}

export function selectTotalPulls(pulls: PullRecord[]): number {
  return pulls.length;
}

export function selectTotalGems(pulls: PullRecord[]): number {
  return pulls.reduce((sum, p) => sum + p.gemsSpent, 0);
}

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

export function selectRarityPercentages(pulls: PullRecord[]) {
  const counts = selectRarityCounts(pulls);
  if (counts.total === 0) return { common: 0, rare: 0, epic: 0 };
  return {
    common: (counts.common / counts.total) * 100,
    rare: (counts.rare / counts.total) * 100,
    epic: (counts.epic / counts.total) * 100,
  };
}

export function selectEpicPullRate(pulls: PullRecord[]): number {
  const counts = selectRarityCounts(pulls);
  if (counts.total === 0) return 0;
  return (counts.epic / counts.total) * 100;
}

export function selectGemsPerEpic(pulls: PullRecord[]): number {
  const totalEpics = pulls.reduce((sum, p) => sum + p.epicModules.length, 0);
  if (totalEpics === 0) return 0;
  const totalGems = selectTotalGems(pulls);
  return totalGems / totalEpics;
}

export function selectPitySinceLastEpic(pulls: PullRecord[]): number {
  const sorted = sortPullsChronological(pulls);
  let count = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].epicModules.length > 0) break;
    count += 10;
  }
  return count;
}

export function selectModulePullCounts(
  pulls: PullRecord[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of pulls) {
    for (const moduleId of p.epicModules) {
      counts[moduleId] = (counts[moduleId] || 0) + 1;
    }
  }
  return counts;
}

export function selectUniqueEpicsFound(pulls: PullRecord[]): number {
  const unique = new Set<string>();
  for (const p of pulls) {
    for (const moduleId of p.epicModules) {
      unique.add(moduleId);
    }
  }
  return unique.size;
}

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

export function selectModuleEpicPercentage(
  pulls: PullRecord[],
  moduleId: string
): number {
  const counts = selectModulePullCounts(pulls);
  const totalEpics = pulls.reduce((sum, p) => sum + p.epicModules.length, 0);
  if (totalEpics === 0) return 0;
  return ((counts[moduleId] || 0) / totalEpics) * 100;
}

export function selectPullStreaks(pulls: PullRecord[]) {
  if (pulls.length === 0) return { bestEpicStreak: 0, worstDryStreak: 0 };

  const sorted = sortPullsChronological(pulls);

  let bestEpicStreak = 0;
  let worstDryStreak = 0;
  let currentEpicStreak = 0;
  let currentDryStreak = 0;

  for (const p of sorted) {
    if (p.epicModules.length > 0) {
      currentEpicStreak++;
      currentDryStreak = 0;
    } else {
      currentDryStreak++;
      currentEpicStreak = 0;
    }
    bestEpicStreak = Math.max(bestEpicStreak, currentEpicStreak);
    worstDryStreak = Math.max(worstDryStreak, currentDryStreak);
  }

  return { bestEpicStreak, worstDryStreak };
}

export function selectPredictedGemsToComplete(
  pulls: PullRecord[],
  totalModuleCount: number
): number {
  const uniqueFound = selectUniqueEpicsFound(pulls);
  if (uniqueFound >= totalModuleCount) return 0;

  const remaining = totalModuleCount - uniqueFound;
  const gemsPerEpic = selectGemsPerEpic(pulls);
  const epicRate = gemsPerEpic > 0 ? gemsPerEpic : 200 / 0.025;

  let expectedPulls = 0;
  for (let i = 1; i <= remaining; i++) {
    expectedPulls += totalModuleCount / i;
  }

  return Math.round(expectedPulls * epicRate);
}

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
    if (totalEpics > 0) {
      points.push({
        date: p.date,
        gemsPerEpic: totalGems / totalEpics,
      });
    }
  }

  return points;
}

export const COPIES_FOR_ANCESTRAL = 8;
const COPIES_FOR_5_STAR = 18;

export function selectMergeProgress(
  pulls: PullRecord[],
  totalModuleCount: number
) {
  const counts = selectModulePullCounts(pulls);
  let totalCopiesForAncestral = 0;
  let totalCopiesFor5Star = 0;
  let modulesAtAncestral = 0;
  let modulesAt5Star = 0;

  const moduleIds = new Set<string>();
  for (const p of pulls) {
    for (const id of p.epicModules) moduleIds.add(id);
  }

  for (const id of moduleIds) {
    const c = counts[id] || 0;
    totalCopiesForAncestral += Math.min(c, COPIES_FOR_ANCESTRAL);
    totalCopiesFor5Star += Math.min(c, COPIES_FOR_5_STAR);
    if (c >= COPIES_FOR_ANCESTRAL) modulesAtAncestral++;
    if (c >= COPIES_FOR_5_STAR) modulesAt5Star++;
  }

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

export function selectPredictedGemsForMerge(
  pulls: PullRecord[],
  totalModuleCount: number,
  copiesPerModule: number
) {
  const counts = selectModulePullCounts(pulls);
  const gemsPerEpic = selectGemsPerEpic(pulls);
  const rate = gemsPerEpic > 0 ? gemsPerEpic : 200 / 0.025;

  let totalCopiesNeeded = 0;
  const moduleIds = new Set<string>();
  for (const p of pulls) {
    for (const id of p.epicModules) moduleIds.add(id);
  }

  // Copies still needed for modules we've already found
  for (const id of moduleIds) {
    const c = counts[id] || 0;
    totalCopiesNeeded += Math.max(0, copiesPerModule - c);
  }

  // Modules we haven't found yet need full copies
  const unfound = totalModuleCount - moduleIds.size;
  totalCopiesNeeded += unfound * copiesPerModule;

  // For unfound modules, use coupon collector for the "find" cost
  let couponCost = 0;
  for (let i = 1; i <= unfound; i++) {
    couponCost += totalModuleCount / i;
  }

  // couponCost includes the 1st copy of each unfound module
  const totalEpics = totalCopiesNeeded + couponCost - unfound;

  return Math.round(Math.max(0, totalEpics) * rate);
}
