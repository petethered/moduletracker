/**
 * Analytics tab — top-level container for all derived gacha-pull analytics.
 *
 * Purpose:
 *   The Tower's gacha module pull system has hidden probabilities and long-tail
 *   variance. This screen surfaces derived statistics that the game does not
 *   expose directly: pity progression, luck streaks, gem efficiency, predicted
 *   gem cost-to-merge, distributions by module type, and time-series rates.
 *
 * Composition order (top -> bottom):
 *   1. PityTracker + PredictedGemsCard  — the two highest-signal "where am I now?" cards
 *   2. LuckStreakCard                    — best/worst streak summaries
 *   3. PullRateChart + GemsPerEpicChart  — time-series trend lines
 *   4. ModuleDistributionChart + TypeBalance — categorical breakdowns
 *   5. ModuleCollectionGrid + Highlights/Calendar — collection-state views
 *
 * Empty state: Most child components also early-return when data is sparse,
 * but this top-level guard avoids rendering a wall of empty cards on first run.
 *
 * NOTE for future agents: This file is presentational only. All math lives in
 * `src/store/selectors.ts`. Do not add derived calculations here.
 */
import { useStore } from "../../store";
import { PullRateChart } from "./PullRateChart";
import { GemsPerEpicChart } from "./GemsPerEpicChart";
import { ModuleDistributionChart } from "./ModuleDistributionChart";
import { PityTracker } from "./PityTracker";
import { PredictedGemsCard } from "./PredictedGemsCard";
import { LuckStreakCard } from "./LuckStreakCard";
import { ModuleCollectionGrid } from "../dashboard/ModuleCollectionGrid";
import { TypeBalance } from "../dashboard/TypeBalance";
import { PullCalendar } from "../dashboard/PullCalendar";
import { PullHighlights } from "../dashboard/PullHighlights";

export function Analytics() {
  // Subscribe to pulls only. Selectors derive everything else; we don't read
  // moduleProgress here because no card on this tab needs it directly.
  const pulls = useStore((s) => s.pulls);

  // Empty-state short-circuit. Without at least one pull, time-series charts
  // would render axes with no line and ratio cards would divide by zero.
  if (pulls.length === 0) {
    return (
      <div>
        <h2 className="text-lg text-[var(--color-accent-gold)]/80 mb-6" style={{ fontFamily: "var(--font-display)", fontWeight: 600, letterSpacing: "0.06em" }}>Analytics</h2>
        <p className="text-gray-500">Add some pulls to see analytics.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h2 className="text-lg text-[var(--color-accent-gold)]/80" style={{ fontFamily: "var(--font-display)", fontWeight: 600, letterSpacing: "0.06em" }}>Analytics</h2>

      {/* Key Stats — pity (where am I in the dry-streak window) + predicted gems (cost to goal). */}
      {/* Two-column on md+ because both are compact summary cards of equal visual weight. */}
      <div className="grid md:grid-cols-2 gap-6">
        <PityTracker />
        <PredictedGemsCard />
      </div>
      {/* LuckStreakCard internally renders a 2-col grid of stat cards, hence full width here. */}
      <LuckStreakCard />

      {/* Charts — time-series trend lines. Full-width because XAxis density needs horizontal room. */}
      <PullRateChart />
      <GemsPerEpicChart />

      {/* Distribution — categorical (by module type). Pie + balance bars sit side-by-side. */}
      <div className="grid md:grid-cols-2 gap-6">
        <ModuleDistributionChart />
        <TypeBalance />
      </div>

      {/* Collection & Highlights — pulled from the dashboard feature for re-use; */}
      {/* keeps the analytics tab a single-scroll "everything about my pulls" view. */}
      <ModuleCollectionGrid />
      <div className="grid md:grid-cols-2 gap-6">
        <PullHighlights />
        <PullCalendar />
      </div>
    </div>
  );
}
