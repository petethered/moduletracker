import { lazy, Suspense } from "react";
import { useStore } from "./store";
import { TabBar } from "./components/ui/TabBar";
import { Button } from "./components/ui/Button";

const Dashboard = lazy(() => import("./features/dashboard/Dashboard").then(m => ({ default: m.Dashboard })));
const History = lazy(() => import("./features/history/History").then(m => ({ default: m.History })));
const Modules = lazy(() => import("./features/modules/Modules").then(m => ({ default: m.Modules })));
const Analytics = lazy(() => import("./features/analytics/Analytics").then(m => ({ default: m.Analytics })));
const PullModal = lazy(() => import("./features/pulls/PullModal").then(m => ({ default: m.PullModal })));
const SettingsPanel = lazy(() => import("./features/settings/SettingsPanel").then(m => ({ default: m.SettingsPanel })));

function App() {
  const activeTab = useStore((s) => s.activeTab);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const openAddPullModal = useStore((s) => s.openAddPullModal);
  const toggleSettings = useStore((s) => s.toggleSettings);

  return (
    <div className="min-h-screen bg-[var(--color-navy-900)] text-gray-200">
      {/* Header */}
      <header
        className="flex items-center justify-between px-5 py-4 bg-[var(--color-navy-800)]/80 backdrop-blur-md"
        style={{
          borderBottom: "1px solid rgba(240, 192, 64, 0.08)",
          animation: "borderGlow 8s ease-in-out infinite",
        }}
      >
        <h1
          className="text-lg text-[var(--color-accent-gold)]"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textShadow: "0 0 30px rgba(240, 192, 64, 0.15)",
          }}
        >
          Module Tracker
        </h1>
        <div className="flex items-center gap-3">
          <Button onClick={openAddPullModal}><span className="hidden sm:inline">+ Add 10x Pull</span><span className="sm:hidden">+ Add Pull</span></Button>
          <button
            onClick={toggleSettings}
            className="text-gray-500 hover:text-[var(--color-accent-gold)] text-lg transition-colors duration-200"
            aria-label="Settings"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        </div>
      </header>

      {/* Tabs */}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab Content */}
      <Suspense fallback={<div className="p-4 md:p-6 max-w-7xl mx-auto text-gray-500">Loading...</div>}>
        <main className="p-4 md:p-6 max-w-7xl mx-auto animate-fade-in" key={activeTab}>
          {activeTab === "dashboard" && <Dashboard />}
          {activeTab === "history" && <History />}
          {activeTab === "modules" && <Modules />}
          {activeTab === "analytics" && <Analytics />}
        </main>
      </Suspense>

      {/* Pull Modal */}
      <Suspense fallback={null}>
        <PullModal />
        <SettingsPanel />
      </Suspense>
    </div>
  );
}

export default App;
