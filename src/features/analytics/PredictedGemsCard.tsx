import { StatCard } from "../../components/ui/StatCard";
import { useStore } from "../../store";
import { selectPredictedGemsToComplete, selectGemsPerEpic } from "../../store/selectors";
import { MODULES } from "../../config/modules";

export function PredictedGemsCard() {
  const pulls = useStore((s) => s.pulls);
  const predicted = selectPredictedGemsToComplete(pulls, MODULES.length);
  const gemsPerEpic = selectGemsPerEpic(pulls);

  return (
    <div className="grid grid-cols-2 gap-3">
      <StatCard
        label="Gems/Epic"
        value={gemsPerEpic > 0 ? gemsPerEpic.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "-"}
        subtitle="Average gems per epic pull"
        color="var(--color-rarity-legendary)"
      />
      <StatCard
        label="Est. Gems to Complete"
        value={predicted > 0 ? predicted.toLocaleString() : "-"}
        subtitle="Based on current rates"
        color="var(--color-accent-crimson)"
      />
    </div>
  );
}
