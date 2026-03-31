import { StatCardGrid } from "./StatCardGrid";
import { RecentPullsList } from "./RecentPullsList";
import { RarityBreakdownBar } from "./RarityBreakdownBar";
import { ModuleCollectionGrid } from "./ModuleCollectionGrid";
import { MergeProgressSummary } from "./MergeProgressSummary";
import { PullHighlights } from "./PullHighlights";
import { PullCalendar } from "./PullCalendar";
import { TypeBalance } from "./TypeBalance";

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
  return (
    <div className="space-y-8">
      <h2
        className="text-lg text-[var(--color-accent-gold)]/80"
        style={{ fontFamily: "var(--font-display)", fontWeight: 600, letterSpacing: "0.06em" }}
      >
        Dashboard
      </h2>
      <StatCardGrid />
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
      <ModuleCollectionGrid />
      <div className="grid md:grid-cols-2 gap-6">
        <MergeProgressSummary />
        <PullHighlights />
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <TypeBalance />
        <PullCalendar />
      </div>
    </div>
  );
}
