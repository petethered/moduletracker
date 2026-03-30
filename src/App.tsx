import { useStore } from "./store";
import { TabBar } from "./components/ui/TabBar";
import { Button } from "./components/ui/Button";
import { PullModal } from "./features/pulls/PullModal";

function App() {
  const activeTab = useStore((s) => s.activeTab);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const openAddPullModal = useStore((s) => s.openAddPullModal);
  const settingsOpen = useStore((s) => s.settingsOpen);
  const toggleSettings = useStore((s) => s.toggleSettings);

  return (
    <div className="min-h-screen bg-[var(--color-navy-900)] text-gray-200">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-[var(--color-navy-800)] border-b border-[var(--color-navy-500)]">
        <h1 className="text-xl font-bold text-[var(--color-accent-gold)]">
          Module Tracker
        </h1>
        <div className="flex items-center gap-3">
          <Button onClick={openAddPullModal}>+ Add 10x Pull</Button>
          <button
            onClick={toggleSettings}
            className="text-gray-400 hover:text-gray-200 text-xl"
            aria-label="Settings"
          >
            ⚙
          </button>
        </div>
      </header>

      {/* Tabs */}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab Content */}
      <main className="p-4 max-w-7xl mx-auto">
        {activeTab === "dashboard" && (
          <div>
            <h2 className="text-lg font-bold mb-4">Dashboard</h2>
            <p className="text-gray-500">No pulls recorded yet. Click "Add 10x Pull" to get started.</p>
          </div>
        )}
        {activeTab === "history" && (
          <div>
            <h2 className="text-lg font-bold mb-4">Pull History</h2>
            <p className="text-gray-500">No pulls recorded yet.</p>
          </div>
        )}
        {activeTab === "modules" && (
          <div>
            <h2 className="text-lg font-bold mb-4">Module Collection</h2>
            <p className="text-gray-500">No data yet.</p>
          </div>
        )}
        {activeTab === "analytics" && (
          <div>
            <h2 className="text-lg font-bold mb-4">Analytics</h2>
            <p className="text-gray-500">No data yet.</p>
          </div>
        )}
      </main>

      {/* Pull Modal */}
      <PullModal />
    </div>
  );
}

export default App;
