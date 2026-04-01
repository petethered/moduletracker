import type { PullRecord, ModuleProgress, ModuleRarity } from "../../types";
import { MODULES_BY_TYPE } from "../../config/modules";
import {
  selectRarityCounts,
  selectRarityPercentages,
  selectTotalPulls,
  selectTotalGems,
  selectGemsPerEpic,
  selectModulePullCounts,
  selectLastPullDateForModule,
} from "../../store/selectors";
import { formatDisplayDate, getLocalDateString } from "../../utils/formatDate";

export interface ScreenshotModuleRow {
  name: string;
  copies: number;
  currentRarity: ModuleRarity | null;
  pctOfPulls: number;
  lastPulled: string | null;
}

export interface ScreenshotTypeSection {
  label: string;
  pctOfPulls: number;
  modules: ScreenshotModuleRow[];
}

export interface ScreenshotStats {
  commonCount: number;
  commonPct: number;
  rareCount: number;
  rarePct: number;
  epicCount: number;
  epicPct: number;
  totalPulls: number;
  gemsSpent: number;
  gemsPerEpic: number;
}

export interface ScreenshotData {
  sections: ScreenshotTypeSection[];
  stats: ScreenshotStats;
  generatedAt: string;
}

export function buildScreenshotData(
  pulls: PullRecord[],
  moduleProgress: Record<string, ModuleProgress>,
): ScreenshotData {
  const pullCounts = selectModulePullCounts(pulls);
  const rarityCounts = selectRarityCounts(pulls);
  const rarityPcts = selectRarityPercentages(pulls);
  const totalEpics = rarityCounts.epic;

  const typeEntries: [string, typeof MODULES_BY_TYPE.cannon][] = [
    ["CANNON", MODULES_BY_TYPE.cannon],
    ["ARMOR", MODULES_BY_TYPE.armor],
    ["GENERATOR", MODULES_BY_TYPE.generator],
    ["CORE", MODULES_BY_TYPE.core],
  ];

  const sections: ScreenshotTypeSection[] = typeEntries.map(
    ([label, modules]) => {
      const sectionCopies = modules.reduce(
        (sum, m) => sum + (pullCounts[m.id] || 0),
        0,
      );
      return {
        label,
        pctOfPulls: totalEpics > 0 ? (sectionCopies / totalEpics) * 100 : 0,
        modules: modules.map((m) => {
          const copies = pullCounts[m.id] || 0;
          const lastDate = selectLastPullDateForModule(pulls, m.id);
          return {
            name: m.name,
            copies,
            currentRarity: moduleProgress[m.id]?.currentRarity ?? null,
            pctOfPulls: totalEpics > 0 ? (copies / totalEpics) * 100 : 0,
            lastPulled: lastDate ? formatDisplayDate(lastDate) : null,
          };
        }),
      };
    },
  );

  return {
    sections,
    stats: {
      commonCount: rarityCounts.common,
      commonPct: rarityPcts.common,
      rareCount: rarityCounts.rare,
      rarePct: rarityPcts.rare,
      epicCount: rarityCounts.epic,
      epicPct: rarityPcts.epic,
      totalPulls: selectTotalPulls(pulls),
      gemsSpent: selectTotalGems(pulls),
      gemsPerEpic: selectGemsPerEpic(pulls),
    },
    generatedAt: formatDisplayDate(getLocalDateString()),
  };
}
