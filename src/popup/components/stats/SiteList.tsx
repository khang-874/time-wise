import type { DailyUsage } from "../../../shared/types";
import SiteRow from "./SiteRow";

interface Props {
  usage: DailyUsage;
  loading: boolean;
}

export default function SiteList({ usage, loading }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
        Loading…
      </div>
    );
  }

  const entries = Object.entries(usage).sort((a, b) => b[1] - a[1]);
  const maxSeconds = entries[0]?.[1] ?? 0;

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <div className="text-3xl mb-2">📊</div>
        <div className="text-sm">No browsing data for this day</div>
      </div>
    );
  }

  return (
    <div className="py-1">
      {entries.map(([host, seconds]) => (
        <SiteRow key={host} host={host} seconds={seconds} maxSeconds={maxSeconds} />
      ))}
    </div>
  );
}
