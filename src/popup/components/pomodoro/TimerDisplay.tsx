import type { PomodoroPhase } from "../../../shared/types";
import { formatCountdown } from "../../../shared/timeUtils";

interface Props {
  remainingSeconds: number;
  phase: PomodoroPhase;
  durationSeconds: number;
}

const PHASE_LABELS: Record<PomodoroPhase, string> = {
  work: "Focus",
  shortBreak: "Short Break",
  longBreak: "Long Break",
};

const PHASE_COLORS: Record<PomodoroPhase, string> = {
  work: "text-red-500",
  shortBreak: "text-green-500",
  longBreak: "text-blue-500",
};

const RING_COLORS: Record<PomodoroPhase, string> = {
  work: "stroke-red-400",
  shortBreak: "stroke-green-400",
  longBreak: "stroke-blue-400",
};

export default function TimerDisplay({ remainingSeconds, phase, durationSeconds }: Props) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const progress = durationSeconds > 0 ? remainingSeconds / durationSeconds : 0;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="flex flex-col items-center py-6">
      <div className="relative w-44 h-44">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
          <circle cx="80" cy="80" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="8" />
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className={`transition-all duration-1000 ${RING_COLORS[phase]}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-mono font-bold ${PHASE_COLORS[phase]}`}>
            {formatCountdown(remainingSeconds)}
          </span>
        </div>
      </div>
      <div className={`mt-2 text-sm font-medium ${PHASE_COLORS[phase]}`}>
        {PHASE_LABELS[phase]}
      </div>
    </div>
  );
}
