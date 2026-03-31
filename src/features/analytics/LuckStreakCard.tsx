import { StatCard } from "../../components/ui/StatCard";
import { useStore } from "../../store";
import { selectPullStreaks } from "../../store/selectors";

export function LuckStreakCard() {
  const pulls = useStore((s) => s.pulls);
  const streaks = selectPullStreaks(pulls);

  return (
    <div className="grid grid-cols-2 gap-3">
      <StatCard label="Best Epic Streak" value={streaks.bestEpicStreak} subtitle="Consecutive pulls with epics" color="var(--color-rarity-ancestral)" />
      <StatCard label="Worst Dry Streak" value={streaks.worstDryStreak} subtitle="Consecutive pulls without epics" color="var(--color-rarity-mythic)" />
    </div>
  );
}
