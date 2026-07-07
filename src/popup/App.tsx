import { useState } from "react";
import type { AppTab } from "../shared/types";
import TabBar from "./components/TabBar";
import StatsTab from "./components/stats/StatsTab";
import PomodoroTab from "./components/pomodoro/PomodoroTab";
import BlockTab from "./components/block/BlockTab";

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("stats");

  return (
    <div className="flex flex-col h-full bg-white">
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 overflow-y-auto">
        {activeTab === "stats" ? (
          <StatsTab />
        ) : activeTab === "pomodoro" ? (
          <PomodoroTab />
        ) : (
          <BlockTab />
        )}
      </div>
    </div>
  );
}
