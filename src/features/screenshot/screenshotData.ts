/**
 * screenshotData — pure aggregation: turns store state into the display-ready
 * `ScreenshotData` shape consumed by the canvas renderer.
 *
 * Role in the broader feature:
 *   The bridge between the Zustand store and the canvas. By doing all the math here we
 *   keep generateScreenshot.ts focused on drawing only and keep this file pure (no DOM,
 *   no canvas APIs). That separation makes both halves testable in isolation.
 *
 * What it builds:
 *   - One `ScreenshotTypeSection` per module type (CANNON / ARMOR / GENERATOR / CORE),
 *     each containing aggregated section totals and a sorted list of `ScreenshotModuleRow`.
 *   - A `ScreenshotStats` summary block (rarity counts/pcts, totals, gems-per-epic).
 *   - A pre-formatted `generatedAt` string for the canvas header.
 *
 * Notable decisions / gotchas:
 *   - `pctOfPulls` for sections AND module rows is computed against `totalEpics`, not
 *     total pulls. That's intentional: the screenshot's "% of pulls" column shows how
 *     much of the user's epic-rarity output came from each module/section. Common/rare
 *     don't track per-module so the percentage frame had to be epic-only.
 *     If `totalEpics === 0` we fall back to 0 (avoids divide-by-zero in the renderer).
 *   - The "last pulled" for a section is the latest date among its modules. We compute
 *     this by sorting the ISO date strings (lexicographic = chronological for ISO).
 *   - Section labels are ALL-CAPS strings here so the renderer can paint them as-is.
 *   - We rely on selectors (single source of truth) rather than re-deriving from pulls
 *     so any rule change (e.g. how rarity is counted) propagates here automatically.
 */
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

/** A single module row in the screenshot's modules table. */
export interface ScreenshotModuleRow {
  name: string;
  copies: number;
  // Tracks the user's currently-equipped/upgraded rarity for this module (per
  // moduleProgress). Null when the user has never set a rarity (renders as "-").
  currentRarity: ModuleRarity | null;
  // Percentage of EPIC pulls that this module accounts for (NOT % of all pulls).
  pctOfPulls: number;
  // Pre-formatted display date; null when never pulled.
  lastPulled: string | null;
}

/** A grouped section of modules sharing a type (cannon / armor / generator / core). */
export interface ScreenshotTypeSection {
  label: string;          // Display label, ALL-CAPS (e.g. "CANNON")
  totalCopies: number;    // Sum of copies across all modules in this section
  pctOfPulls: number;     // Sum of section copies / totalEpics * 100 (0 when totalEpics==0)
  lastPulled: string | null; // Latest pulled-date among any module in this section
  modules: ScreenshotModuleRow[];
}

/** Top-level summary stats rendered in the right-hand panel. */
export interface ScreenshotStats {
  commonCount: number;
  commonPct: number;
  rareCount: number;
  rarePct: number;
  epicCount: number;
  epicPct: number;
  totalPulls: number;
  gemsSpent: number;
  gemsPerEpic: number;   // 0 when no epics yet — renderer shows "-" in that case
}

/** Complete payload consumed by generateScreenshotImage. */
export interface ScreenshotData {
  sections: ScreenshotTypeSection[];
  stats: ScreenshotStats;
  generatedAt: string;   // Pre-formatted display date for the header
}

export function buildScreenshotData(
  pulls: PullRecord[],
  moduleProgress: Record<string, ModuleProgress>,
): ScreenshotData {
  // Pre-compute the selectors once and reuse — selectors may be expensive on large
  // pull histories and we use several of them multiple times below.
  const pullCounts = selectModulePullCounts(pulls);
  const rarityCounts = selectRarityCounts(pulls);
  const rarityPcts = selectRarityPercentages(pulls);
  // Used as the denominator for both section and per-module pctOfPulls.
  const totalEpics = rarityCounts.epic;

  // Section ordering is defined here (not by MODULES_BY_TYPE) so the canvas always
  // renders sections in the same predictable order regardless of object-key iteration.
  const typeEntries: [string, typeof MODULES_BY_TYPE.cannon][] = [
    ["CANNON", MODULES_BY_TYPE.cannon],
    ["ARMOR", MODULES_BY_TYPE.armor],
    ["GENERATOR", MODULES_BY_TYPE.generator],
    ["CORE", MODULES_BY_TYPE.core],
  ];

  const sections: ScreenshotTypeSection[] = typeEntries.map(
    ([label, modules]) => {
      // Section copies = sum of all module copies in this type.
      const sectionCopies = modules.reduce(
        (sum, m) => sum + (pullCounts[m.id] || 0),
        0,
      );
      // Collect all non-null last-pulled dates and pick the most recent. Sort works
      // chronologically because dates are stored as ISO strings (YYYY-MM-DD).
      // .reverse()[0] is equivalent to .sort().pop() — kept this way for readability.
      const lastDates = modules
        .map((m) => selectLastPullDateForModule(pulls, m.id))
        .filter((d): d is string => d !== null);
      const latestDate = lastDates.length > 0
        ? lastDates.sort().reverse()[0]
        : null;

      return {
        label,
        totalCopies: sectionCopies,
        // Guard against divide-by-zero when no epics have been pulled yet.
        pctOfPulls: totalEpics > 0 ? (sectionCopies / totalEpics) * 100 : 0,
        lastPulled: latestDate ? formatDisplayDate(latestDate) : null,
        modules: modules.map((m) => {
          const copies = pullCounts[m.id] || 0;
          const lastDate = selectLastPullDateForModule(pulls, m.id);
          return {
            name: m.name,
            copies,
            // currentRarity reflects in-game upgrade state; not derivable from pulls
            // alone — must come from moduleProgress (separately tracked by the user).
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
    // Pre-format here so the renderer doesn't need any locale logic. Uses today's
    // local date — represents when the screenshot was generated.
    generatedAt: formatDisplayDate(getLocalDateString()),
  };
}
