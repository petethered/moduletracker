import { StatCardGrid } from "./StatCardGrid";
import { RecentPullsList } from "./RecentPullsList";
import { RarityBreakdownBar } from "./RarityBreakdownBar";

export function Dashboard() {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">Dashboard</h2>
      <StatCardGrid />
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
            Recent Pulls
          </h3>
          <RecentPullsList />
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
            Rarity Breakdown
          </h3>
          <RarityBreakdownBar />
        </div>
      </div>
    </div>
  );
}
