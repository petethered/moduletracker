import { useStore } from "../../store";
import { selectPitySinceLastEpic } from "../../store/selectors";

export function PityTracker() {
  const pulls = useStore((s) => s.pulls);
  const pity = selectPitySinceLastEpic(pulls);
  const pityMax = 150;
  const pct = Math.min((pity / pityMax) * 100, 100);

  return (
    <div data-testid="pity-tracker" className="bg-[var(--color-navy-600)] rounded-xl p-4">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Pity Counter</h3>
      <div className="text-3xl font-bold text-white mb-2">
        {pity}<span className="text-lg text-gray-400">/{pityMax}</span>
      </div>
      <div className="w-full bg-[var(--color-navy-800)] rounded-full h-4 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            backgroundColor: pity > 120 ? "var(--color-rarity-mythic)" : pity > 80 ? "var(--color-rarity-legendary)" : "var(--color-rarity-epic)",
          }}
        />
      </div>
      <p className="text-xs text-gray-500 mt-2">Pulls since last epic. Guaranteed epic at 150.</p>
    </div>
  );
}
