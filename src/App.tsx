import { lazy, Suspense, useState, useEffect } from "react";
import { useStore } from "./store";
import { TabBar } from "./components/ui/TabBar";
import { Button } from "./components/ui/Button";
import { StorageChoiceModal } from "./features/auth/StorageChoiceModal";
import { AuthModal } from "./features/auth/AuthModal";
import { SyncStatus } from "./features/auth/SyncStatus";
import { SyncInitializer } from "./features/auth/SyncInitializer";
import { isAuthenticated } from "./services/api";

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
  const storageChoice = useStore((s) => s.storageChoice);
  const user = useStore((s) => s.user);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [resetToken, setResetToken] = useState<string | undefined>();
  const [authInitialView, setAuthInitialView] = useState<"login" | "reset-confirm">("login");

  // Check for password reset token in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("reset");
    if (token) {
      setResetToken(token);
      setAuthInitialView("reset-confirm");
      setAuthModalOpen(true);
      window.history.replaceState({}, "", "/");
    }
  }, []);

  // Show auth modal when cloud is chosen but not authenticated
  useEffect(() => {
    if (storageChoice === "cloud" && !user && !isAuthenticated()) {
      setAuthModalOpen(true);
    }
  }, [storageChoice, user]);

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
        <h1 className="text-lg text-[var(--color-accent-gold)]">
          <button
            onClick={() => setActiveTab("dashboard")}
            className="cursor-pointer"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              letterSpacing: "0.08em",
              textShadow: "0 0 30px rgba(240, 192, 64, 0.15)",
            }}
            aria-label="Go to dashboard"
          >
            ModuleTracker.com
          </button>
        </h1>
        <div className="flex items-center gap-3">
          <SyncStatus />
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

      {/* Footer */}
      <footer className="flex items-center justify-center gap-3 px-5 py-4 text-xs text-gray-600 border-t border-[var(--color-navy-700)]">
        <span>&copy; {new Date().getFullYear()} ModuleTracker.com</span>
        <span>Build: {__BUILD_DATE__}</span>
        <a
          href="https://github.com/petethered/moduletracker"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-600 hover:text-[var(--color-accent-gold)] transition-colors duration-200"
          aria-label="GitHub"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
          </svg>
        </a>
      </footer>

      {/* Pull Modal */}
      <Suspense fallback={null}>
        <PullModal />
        <SettingsPanel />
      </Suspense>

      {/* Auth */}
      <SyncInitializer />
      <StorageChoiceModal />
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialView={authInitialView}
        resetToken={resetToken}
      />
    </div>
  );
}

export default App;
