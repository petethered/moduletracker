/**
 * Dashboard.tsx
 *
 * Role: Top-level container for the "Dashboard" tab — the app's landing view.
 * It is a pure layout component: it owns no state, runs no selectors, and
 * delegates every piece of data to its children. Children are the units that
 * subscribe to the zustand store via `useStore` and run selectors over `pulls`
 * and `moduleProgress`.
 *
 * Game-domain concept visualized:
 *   The Tower has a gacha system where the user spends gems on 10x pulls.
 *   This dashboard summarizes the user's *entire* pull history — totals, rarity
 *   distribution, per-module collection progress, merge progress toward
 *   ancestral / 5-star, recent activity, and pull cadence over time. Think of
 *   it as the "home screen" before the user drills into per-feature tabs.
 *
 * Layout intent (top-to-bottom):
 *   1. Page title.
 *   2. StatCardGrid       — six headline KPIs (total pulls, gems, epic rate, etc.).
 *   3. Two-column row     — RecentPullsList + RarityBreakdownBar (donut chart).
 *   4. ModuleCollectionGrid — every module as a tile, color-coded by rarity.
 *   5. Two-column row     — MergeProgressSummary + PullHighlights.
 *   6. Two-column row     — TypeBalance + PullCalendar (90-day heatmap).
 *
 * Why this ordering: KPIs first (most-glanceable), then activity context, then
 * the dense collection grid, then derived analytical views. Each two-column
 * row stacks on small screens via `md:grid-cols-2`.
 *
 * Selectors consumed: NONE directly. All store reads happen inside children.
 */

import { StatCardGrid } from "./StatCardGrid";
import { RecentPullsList } from "./RecentPullsList";
import { RarityBreakdownBar } from "./RarityBreakdownBar";
import { ModuleCollectionGrid } from "./ModuleCollectionGrid";
import { MergeProgressSummary } from "./MergeProgressSummary";
import { PullHighlights } from "./PullHighlights";
import { PullCalendar } from "./PullCalendar";
import { TypeBalance } from "./TypeBalance";

/**
 * SectionLabel — small uppercase eyebrow text used to head each subsection
 * inside the two-column rows. Kept local because it's only used here and its
 * styling (tracking-[0.2em], font-body) is dashboard-specific. If a second
 * consumer ever appears, promote to `components/ui/`.
 */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="text-[10px] font-medium text-gray-500 uppercase tracking-[0.2em] mb-3"
      style={{ fontFamily: "var(--font-body)" }}
    >
      {children}
    </h3>
  );
}

export function Dashboard() {
  // `space-y-8` provides the vertical rhythm between the major dashboard
  // sections; do not collapse this into per-section margins — it keeps the
  // layout consistent if sections are reordered.
  return (
    <div className="space-y-8">
      <h2
        className="text-lg text-[var(--color-accent-gold)]/80"
        style={{ fontFamily: "var(--font-display)", fontWeight: 600, letterSpacing: "0.06em" }}
      >
        Dashboard
      </h2>
      {/* Headline KPI row. StatCardGrid handles its own responsive grid. */}
      <StatCardGrid />
      {/* Activity row: recency on the left, rarity distribution on the right. */}
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <SectionLabel>Recent Pulls</SectionLabel>
          <RecentPullsList />
        </div>
        <div>
          <SectionLabel>Rarity Breakdown</SectionLabel>
          <RarityBreakdownBar />
        </div>
      </div>
      {/* Full-width collection grid — every module the user has tracked. */}
      <ModuleCollectionGrid />
      {/* Progress / superlatives row. */}
      <div className="grid md:grid-cols-2 gap-6">
        <MergeProgressSummary />
        <PullHighlights />
      </div>
      {/* Distribution / cadence row. */}
      <div className="grid md:grid-cols-2 gap-6">
        <TypeBalance />
        <PullCalendar />
      </div>
    </div>
  );
}
