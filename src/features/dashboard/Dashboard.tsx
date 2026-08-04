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
 *   2. StatCardGrid          — six headline KPIs (total pulls, gems, epic rate, etc.).
 *   3. Two-column row        — RecentPullsList + RarityBreakdownBar (donut chart).
 *   4. BannerStatsBreakdown  — per-banner stat card (self-hides if <2 banners used).
 *   5. ModuleCollectionGrid  — every module as a tile, color-coded by rarity.
 *   6. Two-column row        — MergeProgressSummary + PullHighlights.
 *   7. Asymmetric 1fr/2fr    — TypeBalance + PullCalendar (90-day heatmap).
 *
 * Why this ordering: KPIs first (most-glanceable), then activity context, then
 * the dense collection grid, then derived analytical views. Every multi-column
 * row collapses to a single column below `md`.
 *
 * Why row 7 is asymmetric and not another 50/50: see the inline comment at the
 * row itself. Short version — the heatmap needs the width, and three identical
 * two-column bands in a row made the lower half of the page read as one
 * undifferentiated block.
 *
 * Selectors consumed: NONE directly. All store reads happen inside children.
 */

import { StatCardGrid } from "./StatCardGrid";
import { RecentPullsList } from "./RecentPullsList";
import { RarityBreakdownBar } from "./RarityBreakdownBar";
import { BannerStatsBreakdown } from "./BannerStatsBreakdown";
import { ModuleCollectionGrid } from "./ModuleCollectionGrid";
import { MergeProgressSummary } from "./MergeProgressSummary";
import { PullHighlights } from "./PullHighlights";
import { PullCalendar } from "./PullCalendar";
import { TypeBalance } from "./TypeBalance";
import { SectionHeading } from "../../components/ui/SectionHeading";

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
          <SectionHeading>Recent Pulls</SectionHeading>
          <RecentPullsList />
        </div>
        <div>
          <SectionHeading>Rarity Breakdown</SectionHeading>
          <RarityBreakdownBar />
        </div>
      </div>
      {/* Per-banner stats — self-gates to render only when the user has logged
          pulls on ≥2 distinct banner types. Sits directly above Collection so
          the two cards visually pair (matching outer shell styling). */}
      <BannerStatsBreakdown />
      {/* Full-width collection grid — every module the user has tracked. */}
      <ModuleCollectionGrid />
      {/* Progress / superlatives row. */}
      <div className="grid md:grid-cols-2 gap-6">
        <MergeProgressSummary />
        <PullHighlights />
      </div>
      {/*
        Distribution / cadence row — ASYMMETRIC 1fr / 2fr, deliberately not
        another 50/50 split.

        Two reasons:
        1. Content fit. PullCalendar is a 90-day heatmap laid out as ~13 ISO
           week columns. At half width those columns get cramped and the
           legend wraps; the extra third of the row is real estate it actually
           uses. TypeBalance is four labelled bars and reads fine narrow.
        2. Rhythm. This row previously sat directly below the
           MergeProgressSummary + PullHighlights row with identical
           `md:grid-cols-2` geometry, so the page ended on two visually
           interchangeable bands. Varying the split gives the scroll somewhere
           to land.

        Both still collapse to a single column below `md`.
      */}
      <div className="grid md:grid-cols-3 gap-6">
        <TypeBalance />
        <div className="md:col-span-2">
          <PullCalendar />
        </div>
      </div>
    </div>
  );
}
