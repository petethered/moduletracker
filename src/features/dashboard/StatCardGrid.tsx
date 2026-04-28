/**
 * StatCardGrid.tsx
 *
 * Role: The headline KPI strip at the top of the Dashboard. Six StatCards in
 * a responsive grid (2 cols on phones, 3 on tablets, 6 on desktop).
 *
 * Game-domain concepts visualized:
 *   - "Total Pulls"   : number of 10x pulls the user has logged.
 *   - "Gems Spent"    : derived from totalPulls * cost-per-pull, the lifetime
 *                       gem investment. Painful but motivating.
 *   - "Epic Rate"     : observed % of pulls (out of 10 modules each) that
 *                       resolved to epic. Compared against the 2.5% baseline
 *                       so the user can tell if they're hot or cold.
 *   - "Epics Found"   : raw count of epic modules pulled (NOT unique).
 *   - "Unique Epics"  : how many *distinct* epic modules the user has ever
 *                       pulled, out of the 24-module roster.
 *   - "Pity Counter"  : pulls since the last epic, max 150 before the in-game
 *                       pity guarantee triggers. Color shifts to mythic-red
 *                       past 100 to convey "we're getting close".
 *
 * Selectors consumed (one each):
 *   selectTotalPulls, selectTotalGems, selectEpicPullRate, selectRarityCounts,
 *   selectUniqueEpicsFound, selectPitySinceLastEpic
 *
 * Why a flat list of cards: each KPI is independent and orderable; promoting
 * shared formatting into StatCard keeps this component as a pure
 * declarative configuration — easy to add/remove KPIs without touching CSS.
 */

import { StatCard } from "../../components/ui/StatCard";
import { useStore } from "../../store";
import {
  selectTotalPulls,
  selectTotalGems,
  selectEpicPullRate,
  selectRarityCounts,
  selectUniqueEpicsFound,
  selectPitySinceLastEpic,
} from "../../store/selectors";

export function StatCardGrid() {
  // Single subscription to `pulls` — every selector below derives from it,
  // so we don't need to re-subscribe per KPI.
  const pulls = useStore((s) => s.pulls);
  const totalPulls = selectTotalPulls(pulls);
  const totalGems = selectTotalGems(pulls);
  const epicRate = selectEpicPullRate(pulls);
  const counts = selectRarityCounts(pulls);
  const uniqueEpics = selectUniqueEpicsFound(pulls);
  const pity = selectPitySinceLastEpic(pulls);

  return (
    // Responsive grid:
    //   - 2 cols on phones (~360px) keeps cards readable
    //   - 3 cols on tablets
    //   - 6 cols on desktop = single-row strip, the intended look
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <StatCard label="Total Pulls" value={totalPulls} subtitle="10x pulls" />
      {/* Gems use a crimson accent — it's "money spent", a costly stat. */}
      <StatCard
        label="Gems Spent"
        value={totalGems.toLocaleString()}
        color="var(--color-accent-crimson)"
      />
      {/* Epic Rate is shown to 2 decimals because it usually hovers near 2.5%
          and rounding to whole percents loses signal. The subtitle anchors
          the user to the expected baseline. */}
      <StatCard
        label="Epic Rate"
        value={`${epicRate.toFixed(2)}%`}
        subtitle="Expected: 2.5%"
        color="var(--color-rarity-epic)"
      />
      <StatCard
        label="Epics Found"
        value={counts.epic}
        color="var(--color-rarity-epic)"
      />
      {/* "/24" is the current roster size from MODULES. Hard-coded for visual
          punch (matches the "complete the dex" feeling); update if the
          module config grows. The legendary-gold color signals "completion". */}
      <StatCard
        label="Unique Epics"
        value={`${uniqueEpics}/24`}
        color="var(--color-rarity-legendary)"
      />
      {/* Pity counter conditional color:
            - <=100  -> gold (warning, not urgent)
            -  >100  -> mythic red (close to the 150 guarantee, feels tense)
          150 is the in-game threshold where an epic is forced. */}
      <StatCard
        label="Pity Counter"
        value={`${pity}/150`}
        subtitle="Pulls since last epic"
        color={pity > 100 ? "var(--color-rarity-mythic)" : "var(--color-accent-gold)"}
      />
    </div>
  );
}
