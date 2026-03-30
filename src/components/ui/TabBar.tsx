import type { TabId } from "../../types";

interface Tab {
  id: TabId;
  label: string;
}

const TABS: Tab[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "history", label: "History" },
  { id: "modules", label: "Modules" },
  { id: "analytics", label: "Analytics" },
];

interface TabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <nav className="flex gap-1 px-4 border-b border-[var(--color-navy-500)]">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          data-tab={tab.id}
          className={`px-4 py-3 text-sm font-medium transition-colors rounded-t-lg ${
            activeTab === tab.id
              ? "text-[var(--color-accent-gold)] bg-[var(--color-navy-600)] border-b-2 border-[var(--color-accent-crimson)]"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
