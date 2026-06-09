import { useTimeStats } from "../../hooks/useTimeStats";
import StatsHeader from "./StatsHeader";
import SiteList from "./SiteList";

export default function StatsTab() {
  const { usage, loading, dateKey, goToPrevDay, goToNextDay, isToday } = useTimeStats();

  return (
    <div className="flex flex-col">
      <StatsHeader
        dateKey={dateKey}
        usage={usage}
        isToday={isToday}
        onPrev={goToPrevDay}
        onNext={goToNextDay}
      />
      <SiteList usage={usage} loading={loading} />
    </div>
  );
}
