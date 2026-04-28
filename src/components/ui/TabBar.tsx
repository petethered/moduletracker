import type { TabId } from "../../types";

/**
 * TabBar — top-level navigation strip for the four primary feature surfaces.
 *
 * Where it's used: rendered once at the top of the app shell. The list of tabs
 * is hard-coded here on purpose — tabs are a fixed app-level concern, not
 * something callers should be able to extend. To add/remove tabs:
 *   1. Add the `TabId` to `src/types/index.ts`.
 *   2. Add the entry to the `TABS` array below.
 *   3. Add a route/component for it in the app shell.
 *
 * Composition pattern: each tab is a `<button>` (not an `<a>`) because routing
 * is in-memory state, not URL-driven. The active tab gets a gold gradient
 * underline; inactive tabs are muted gray with a hover lift.
 *
 * Responsive notes: on mobile (`flex-1`) tabs share the row equally; on desktop
 * (`md:flex-none`) they shrink to content. Padding and tracking also bump up
 * on `md` so the bar feels less cramped on small screens.
 *
 * Accessibility: native buttons, keyboard activation works out of the box. The
 * `data-tab` attribute is used by Playwright E2E tests (see `e2e/`) to target
 * specific tabs — do NOT rename without updating tests.
 */

/**
 * Internal tab descriptor. Not exported because tabs are app-fixed.
 */
interface Tab {
  id: TabId;
  label: string;
}

// Source of truth for tab order and labels. Order here = render order.
const TABS: Tab[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "history", label: "History" },
  { id: "modules", label: "Modules" },
  { id: "analytics", label: "Analytics" },
];

/**
 * Props for {@link TabBar}.
 */
interface TabBarProps {
  /** Currently selected tab. Controlled by the parent app shell. */
  activeTab: TabId;
  /** Fires with the new `TabId` when the user clicks a tab. */
  onTabChange: (tab: TabId) => void;
}

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <nav className="flex bg-[var(--color-navy-900)]/60 backdrop-blur-sm border-b border-[var(--color-navy-500)]/40">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          // `data-tab` is the E2E test selector hook. Keep stable.
          data-tab={tab.id}
          className={`relative flex-1 md:flex-none px-3 md:px-5 py-3.5 text-[10px] md:text-xs tracking-wider md:tracking-widest uppercase transition-all duration-300 ${
            activeTab === tab.id
              ? "text-[var(--color-accent-gold)]"
              : "text-gray-500 hover:text-gray-300"
          }`}
          style={{ fontFamily: "var(--font-body)", fontWeight: 500 }}
        >
          {tab.label}
          {activeTab === tab.id && (
            // Gradient underline for the active tab. Inset by `left-2 right-2`
            // so it doesn't run edge-to-edge — softer visual landing.
            <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-gradient-to-r from-transparent via-[var(--color-accent-gold)] to-transparent" />
          )}
        </button>
      ))}
    </nav>
  );
}
