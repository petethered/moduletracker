import type { PullRecord } from "../types";

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
  const sorted = [...pulls].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  let count = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].epicModules.length > 0) break;
    count++;
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
  const sorted = [...pulls].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
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

  const sorted = [...pulls].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

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
  const sorted = [...pulls].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

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
  const sorted = [...pulls].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

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
