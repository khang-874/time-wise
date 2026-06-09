import { formatTime } from "../../../shared/timeUtils";

interface Props {
  host: string;
  seconds: number;
  maxSeconds: number;
}

export default function SiteRow({ host, seconds, maxSeconds }: Props) {
  const pct = maxSeconds > 0 ? (seconds / maxSeconds) * 100 : 0;

  return (
    <div className="px-4 py-2">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-800 truncate max-w-[200px]" title={host}>
          {host}
        </span>
        <span className="text-gray-500 ml-2 shrink-0">{formatTime(seconds)}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-400 rounded-full transition-all"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={seconds}
          aria-valuemax={maxSeconds}
          aria-label={`${host} usage`}
        />
      </div>
    </div>
  );
}
