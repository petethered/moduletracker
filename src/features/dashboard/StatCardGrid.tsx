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
  const pulls = useStore((s) => s.pulls);
  const totalPulls = selectTotalPulls(pulls);
  const totalGems = selectTotalGems(pulls);
  const epicRate = selectEpicPullRate(pulls);
  const counts = selectRarityCounts(pulls);
  const uniqueEpics = selectUniqueEpicsFound(pulls);
  const pity = selectPitySinceLastEpic(pulls);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <StatCard label="Total Pulls" value={totalPulls} subtitle="10x pulls" />
      <StatCard
        label="Gems Spent"
        value={totalGems.toLocaleString()}
        color="var(--color-accent-crimson)"
      />
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
      <StatCard
        label="Unique Epics"
        value={`${uniqueEpics}/24`}
        color="var(--color-rarity-legendary)"
      />
      <StatCard
        label="Pity Counter"
        value={`${pity}/150`}
        subtitle="Pulls since last epic"
        color={pity > 100 ? "var(--color-rarity-mythic)" : "var(--color-accent-gold)"}
      />
    </div>
  );
}
