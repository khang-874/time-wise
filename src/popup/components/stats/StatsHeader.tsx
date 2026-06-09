import { formatTime, toDisplayLabel } from "../../../shared/timeUtils";
import type { DailyUsage } from "../../../shared/types";

interface Props {
  dateKey: string;
  usage: DailyUsage;
  isToday: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export default function StatsHeader({ dateKey, usage, isToday, onPrev, onNext }: Props) {
  const totalSeconds = Object.values(usage).reduce((a, b) => a + b, 0);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
      <button
        onClick={onPrev}
        aria-label="Previous day"
        className="p-1 rounded hover:bg-gray-100 text-gray-500"
      >
        ‹
      </button>
      <div className="text-center">
        <div className="text-sm font-semibold text-gray-800">{toDisplayLabel(dateKey)}</div>
        <div className="text-xs text-gray-400">
          {totalSeconds > 0 ? formatTime(totalSeconds) + " total" : "No data"}
        </div>
      </div>
      <button
        onClick={onNext}
        disabled={isToday}
        aria-label="Next day"
        className="p-1 rounded hover:bg-gray-100 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        ›
      </button>
    </div>
  );
}
