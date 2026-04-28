/**
 * App.tsx — top-level application shell.
 *
 * Role:
 *   - Composes the entire single-page app: header (logo, sync status, add-pull
 *     button, settings cog), tab bar, the active tab's content, footer, and
 *     the modal layer (pull entry, settings, auth, storage choice).
 *   - Owns no domain data — all of that lives in the Zustand store. Owns only
 *     small bits of UI-local state (auth modal open, password-reset token).
 *
 * User flows it supports:
 *   - Tab navigation (dashboard / history / modules / analytics) via TabBar.
 *     Logo click also routes to dashboard as a "home" affordance.
 *   - Add 10x Pull button -> openAddPullModal() -> lazy-loaded PullModal.
 *   - Settings cog -> toggleSettings() -> lazy-loaded SettingsPanel.
 *   - First-run storage choice (local vs cloud) via StorageChoiceModal.
 *   - Auth modal: opens automatically when cloud storage is chosen but the
 *     user is not authenticated, or when a /?reset=<token> URL is detected
 *     for password reset confirmation.
 *
 * --- Top-level wiring map ---
 *   <div root>
 *     <header>           static branding, SyncStatus, add-pull, settings cog
 *     <TabBar>           routes between feature panels via store.activeTab
 *     <Suspense><main>   lazy-loaded active tab content
 *     <footer>           build date (vite-injected __BUILD_DATE__) + GitHub
 *     <Suspense>         PullModal + SettingsPanel (lazy)
 *     <SyncInitializer>  cloud sync bootstrap (no UI)
 *     <StorageChoiceModal> first-run prompt
 *     <AuthModal>        login / reset confirm
 *
 * --- Routing model (intentionally simple) ---
 *   - There is NO react-router. "Routing" is a single string: store.activeTab
 *     ("dashboard" | "history" | "modules" | "analytics"). The main element
 *     is keyed by activeTab so React fully unmounts/remounts on tab change,
 *     which (a) restarts the fade-in animation and (b) discards transient
 *     per-tab state cheaply. Don't replace this with a Router unless you
 *     actually need URL-addressable tabs.
 *   - The /?reset=<token> URL is the ONE place the URL is read. The token
 *     is consumed once on mount and the URL is cleaned up via
 *     history.replaceState so a refresh doesn't re-trigger the reset flow.
 *
 * --- Lazy loading ---
 *   - Every feature panel and the heavy modals are React.lazy() so the
 *     initial bundle stays small. Suspense fallbacks are intentionally
 *     minimal (a "Loading..." string, or null for modals). If you add a
 *     new tab, follow this pattern.
 *
 * --- Providers ---
 *   - None at this level. The Zustand store is module-scoped (see
 *     ./store/index.ts), so any descendant can call useStore directly.
 *     Tailwind theme tokens come from index.css CSS variables, not a
 *     ThemeProvider. If you ever introduce a Router or i18n provider,
 *     wrap the outermost <div> here.
 */
import { lazy, Suspense, useState, useEffect } from "react";
import { useStore } from "./store";
import { TabBar } from "./components/ui/TabBar";
import { Button } from "./components/ui/Button";
import { StorageChoiceModal } from "./features/auth/StorageChoiceModal";
import { AuthModal } from "./features/auth/AuthModal";
import { SyncStatus } from "./features/auth/SyncStatus";
import { SyncInitializer } from "./features/auth/SyncInitializer";
import { isAuthenticated } from "./services/api";
import { useRenderLog } from "./utils/renderLog";

// Lazy boundaries for code-splitting. Each .then(...) shim turns a named
// export into the default export shape that React.lazy expects. Keep the
// pattern uniform so it's grep-able and reorderable.
const Dashboard = lazy(() => import("./features/dashboard/Dashboard").then(m => ({ default: m.Dashboard })));
const History = lazy(() => import("./features/history/History").then(m => ({ default: m.History })));
const Modules = lazy(() => import("./features/modules/Modules").then(m => ({ default: m.Modules })));
const Analytics = lazy(() => import("./features/analytics/Analytics").then(m => ({ default: m.Analytics })));
const PullModal = lazy(() => import("./features/pulls/PullModal").then(m => ({ default: m.PullModal })));
const SettingsPanel = lazy(() => import("./features/settings/SettingsPanel").then(m => ({ default: m.SettingsPanel })));

function App() {
  // Store-driven UI bits — granular selectors so App only re-renders when
  // these specific fields change, not on every store mutation.
  const activeTab = useStore((s) => s.activeTab);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const openAddPullModal = useStore((s) => s.openAddPullModal);
  const toggleSettings = useStore((s) => s.toggleSettings);
  const storageChoice = useStore((s) => s.storageChoice);
  const user = useStore((s) => s.user);

  // Auth modal is local UI state, not store state, because it's only opened
  // by App-owned triggers (URL reset token, cloud-without-auth detection).
  // Promoting this to the store would require yet another slice for one bool.
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [resetToken, setResetToken] = useState<string | undefined>();
  const [authInitialView, setAuthInitialView] = useState<"login" | "reset-confirm">("login");
  useRenderLog("App", { activeTab, authModalOpen });

  // Password-reset URL handler. Runs ONCE on mount.
  // Flow: user clicks the reset link in their email -> lands on /?reset=TOKEN
  //       -> we extract the token, switch AuthModal to its reset-confirm view,
  //       open it, and scrub the token out of the URL via replaceState so a
  //       page refresh won't reopen the modal or expose the token in history.
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

  // Cloud-storage gating effect. If the user picked "cloud" in
  // StorageChoiceModal but no user is loaded AND the API has no stored
  // session, we force the AuthModal open. isAuthenticated() reads the
  // persisted token from services/api so a returning user with a valid
  // token won't see this prompt. Re-runs whenever storageChoice or user
  // changes (e.g. after a successful login user becomes truthy and the
  // condition no longer fires).
  useEffect(() => {
    if (storageChoice === "cloud" && !user && !isAuthenticated()) {
      setAuthModalOpen(true);
    }
  }, [storageChoice, user]);

  return (
    <div className="min-h-screen bg-[var(--color-navy-900)] text-gray-200">
      {/* Header */}
      <header
        className="flex items-center justify-between px-5 py-4 bg-[var(--color-navy-800)]"
        style={{
          borderBottom: "1px solid rgba(240, 192, 64, 0.08)",
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

      {/* Tabs — TabBar is purely presentational; activeTab string drives routing. */}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/*
        Tab Content. The key={activeTab} on <main> forces React to fully
        unmount the previous tab and remount the new one — this is what
        retriggers the animate-fade-in animation each switch and discards
        any transient per-tab UI state. If you remove the key, both
        behaviours go away.
      */}
      <Suspense fallback={<div className="p-4 md:p-6 max-w-7xl mx-auto text-gray-500">Loading...</div>}>
        <main className="p-4 md:p-6 max-w-7xl mx-auto animate-fade-in" key={activeTab}>
          {/* Plain string-equality routing. Add new tabs here AND in TabBar's tab list. */}
          {activeTab === "dashboard" && <Dashboard />}
          {activeTab === "history" && <History />}
          {activeTab === "modules" && <Modules />}
          {activeTab === "analytics" && <Analytics />}
        </main>
      </Suspense>

      {/*
        Footer. __BUILD_DATE__ is injected at build time by Vite's `define`
        config (see vite.config.ts). It is a global string literal, NOT a
        runtime value — `npm run build` automatically captures the current
        timestamp, so there's nothing to update manually. If TypeScript
        complains about the symbol, check src/vite-env.d.ts for its declare.
      */}
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

      {/*
        Modal layer. Both modals are lazy-loaded; `fallback={null}` is
        intentional because they are invisible until opened by store state,
        so showing a loading state would just flash a placeholder.
      */}
      <Suspense fallback={null}>
        <PullModal />
        <SettingsPanel />
      </Suspense>

      {/*
        Auth layer.
        - SyncInitializer is a render-null component that triggers cloud
          sync bootstrap on mount; mounting order matters (it must be
          inside the React tree so it can read store state).
        - StorageChoiceModal renders only on first run.
        - AuthModal is App-controlled (see useEffects above) rather than
          store-controlled because the open conditions are App-specific.
      */}
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
