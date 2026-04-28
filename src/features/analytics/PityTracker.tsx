/**
 * PityTracker — progress bar showing pulls since the last epic+ drop.
 *
 * ===== GACHA "PITY" — what it means =====
 * In gacha games, a "pity counter" is a soft- or hard-guarantee mechanism
 * that protects players from extreme bad luck. After N consecutive pulls
 * with no rare-tier drop, the next pull is GUARANTEED to drop a rare-tier
 * item. The counter resets to 0 on any qualifying drop.
 *
 * In The Tower:
 *   - Counter increments by 1 for every pull WITHOUT an epic-or-better drop.
 *   - Counter resets to 0 the moment an epic+ is pulled.
 *   - Hard pity = 150 pulls. The 150th dry pull is guaranteed to yield epic+.
 *
 * ===== THE MATH =====
 *   pity        = current dry-streak length (selector-derived from pulls).
 *   pityMax     = 150 (hard pity ceiling — game constant).
 *   pct         = min(100, (pity / pityMax) * 100)
 *                 We clamp at 100% because mathematically you cannot exceed
 *                 hard pity — but defensively clamping covers any off-by-one
 *                 in the selector (e.g. logging a 151st pull before resolving).
 *
 * ===== COLOR THRESHOLDS =====
 *   Three-stage gradient signals proximity to guarantee:
 *     pity <= 80  -> epic purple    (calm, "early in the cycle")
 *     pity 81-120 -> legendary gold (warning, "getting close")
 *     pity > 120  -> mythic red     (imminent, "guaranteed soon")
 *   Thresholds (80, 120) are roughly halfway and 80% of the way to pity cap —
 *   chosen for visual feedback, not derived from any specific drop-rate math.
 *
 * NOTE for future agents: pityMax is a literal here, not pulled from config.
 * If The Tower changes its pity ceiling, update this AND any selector logic
 * that may also encode it. Search for `150` if migrating.
 */
import { useStore } from "../../store";
import { selectPitySinceLastEpic } from "../../store/selectors";

export function PityTracker() {
  const pulls = useStore((s) => s.pulls);
  // Selector walks pulls in reverse chronological order until it finds
  // the most recent epic+ drop, returning the count of pulls since then.
  const pity = selectPitySinceLastEpic(pulls);
  // Hard pity ceiling — see top-of-file note about updating this if the game changes.
  const pityMax = 150;
  // Clamp to 100% defensively. See math notes above.
  const pct = Math.min((pity / pityMax) * 100, 100);

  return (
    <div data-testid="pity-tracker" className="bg-[var(--color-navy-600)] rounded-xl p-4">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Pity Counter</h3>
      {/* Big numerator (current pity) + small denominator (max) — gives both */}
      {/* the absolute value and the "how close to guarantee" framing. */}
      <div className="text-3xl font-bold text-white mb-2">
        {pity}<span className="text-lg text-gray-400">/{pityMax}</span>
      </div>
      <div className="w-full bg-[var(--color-navy-800)] rounded-full h-4 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            // Three-stage color: epic purple -> legendary gold -> mythic red.
            // Order of ternary matters — must check highest threshold first.
            // See "COLOR THRESHOLDS" in top-of-file docblock for the why.
            backgroundColor: pity > 120 ? "var(--color-rarity-mythic)" : pity > 80 ? "var(--color-rarity-legendary)" : "var(--color-rarity-epic)",
          }}
        />
      </div>
      <p className="text-xs text-gray-500 mt-2">Pulls since last epic. Guaranteed epic at 150.</p>
    </div>
  );
}
