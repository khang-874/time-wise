type Tab = "stats" | "pomodoro";

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const TABS: { id: Tab; label: string }[] = [
  { id: "stats", label: "Stats" },
  { id: "pomodoro", label: "Pomodoro" },
];

export default function TabBar({ activeTab, onTabChange }: Props) {
  return (
    <div className="flex border-b border-gray-200 bg-gray-50">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          aria-selected={activeTab === tab.id}
          role="tab"
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === tab.id
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
