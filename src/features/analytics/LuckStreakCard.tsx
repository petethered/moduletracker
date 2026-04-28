/**
 * LuckStreakCard — bookend stats showing the player's best and worst runs.
 *
 * Derived stats (from selectPullStreaks):
 *   - bestEpicStreak: longest run of consecutive pull-batches that each
 *     contained at least one epic+ drop. Measures "hot streak" length.
 *   - worstDryStreak: longest run of consecutive pull-batches with zero
 *     epic+ drops. Measures "cold streak" length — psychological pity.
 *
 * Game-mechanic context:
 *   The Tower does not expose pull history server-side, so streak windows
 *   are derived purely from the locally logged pull batches. A "streak"
 *   is measured in pull-batch units (one logged Pull entry), NOT individual
 *   gem-pull units. The selector defines exactly what counts as a batch.
 *
 * Why two cards side-by-side: players want a quick "how lucky have I been
 * historically" gut-check. Best vs. worst framing makes variance obvious.
 *
 * Color choices: ancestral-green (the top-tier rarity, "best of the best")
 * for the positive streak; mythic-red (danger) for the dry streak.
 */
import { StatCard } from "../../components/ui/StatCard";
import { useStore } from "../../store";
import { selectPullStreaks } from "../../store/selectors";

export function LuckStreakCard() {
  const pulls = useStore((s) => s.pulls);
  // Single selector returns both numbers — they share a traversal of the
  // pulls array, so don't split into two selector calls.
  const streaks = selectPullStreaks(pulls);

  return (
    // 2-col grid (always — not responsive). These cards are short and meant
    // to be compared at a glance regardless of viewport.
    <div className="grid grid-cols-2 gap-3">
      {/* Green = "good streak" semantic match with the top-tier rarity color. */}
      <StatCard label="Best Epic Streak" value={streaks.bestEpicStreak} subtitle="Consecutive pulls with epics" color="var(--color-rarity-ancestral)" />
      {/* Red/mythic = "bad streak" / danger semantic. */}
      <StatCard label="Worst Dry Streak" value={streaks.worstDryStreak} subtitle="Consecutive pulls without epics" color="var(--color-rarity-mythic)" />
    </div>
  );
}
