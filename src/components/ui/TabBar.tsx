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
    <nav className="flex bg-[var(--color-navy-900)]/60 backdrop-blur-sm border-b border-[var(--color-navy-500)]/40">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
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
            <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-gradient-to-r from-transparent via-[var(--color-accent-gold)] to-transparent" />
          )}
        </button>
      ))}
    </nav>
  );
}
