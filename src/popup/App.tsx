import { useState } from "react";
import TabBar from "./components/TabBar";
import StatsTab from "./components/stats/StatsTab";
import PomodoroTab from "./components/pomodoro/PomodoroTab";

type Tab = "stats" | "pomodoro";

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("stats");

  return (
    <div className="flex flex-col h-full bg-white">
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 overflow-y-auto">
        {activeTab === "stats" ? <StatsTab /> : <PomodoroTab />}
      </div>
    </div>
  );
}
