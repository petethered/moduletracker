import { useStore } from "../../store";
import { PullRateChart } from "./PullRateChart";
import { GemsPerEpicChart } from "./GemsPerEpicChart";
import { ModuleDistributionChart } from "./ModuleDistributionChart";
import { PityTracker } from "./PityTracker";
import { PredictedGemsCard } from "./PredictedGemsCard";
import { LuckStreakCard } from "./LuckStreakCard";

export function Analytics() {
  const pulls = useStore((s) => s.pulls);

  if (pulls.length === 0) {
    return (
      <div>
        <h2 className="text-lg font-bold mb-4">Analytics</h2>
        <p className="text-gray-500">Add some pulls to see analytics.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">Analytics</h2>
      <div className="grid md:grid-cols-2 gap-6">
        <PityTracker />
        <PredictedGemsCard />
      </div>
      <LuckStreakCard />
      <PullRateChart />
      <GemsPerEpicChart />
      <ModuleDistributionChart />
    </div>
  );
}
