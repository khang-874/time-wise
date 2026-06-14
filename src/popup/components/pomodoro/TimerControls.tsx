interface Props {
  running: boolean;
  startDisabled?: boolean;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onSkip: () => void;
}

export default function TimerControls({ running, startDisabled, onStart, onPause, onReset, onSkip }: Props) {
  return (
    <div className="flex items-center justify-center gap-3 pb-4">
      <button
        onClick={onReset}
        aria-label="Reset timer"
        className="px-3 py-2 text-sm text-gray-500 rounded-lg hover:bg-gray-100 transition-colors"
      >
        Reset
      </button>

      {running ? (
        <button
          onClick={onPause}
          aria-label="Pause timer"
          className="px-6 py-2.5 bg-gray-800 text-white rounded-full text-sm font-medium hover:bg-gray-700 transition-colors"
        >
          Pause
        </button>
      ) : (
        <button
          onClick={onStart}
          aria-label="Start timer"
          disabled={startDisabled}
          className="px-6 py-2.5 bg-gray-800 text-white rounded-full text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Start
        </button>
      )}

      <button
        onClick={onSkip}
        aria-label="Skip phase"
        className="px-3 py-2 text-sm text-gray-500 rounded-lg hover:bg-gray-100 transition-colors"
      >
        Skip
      </button>
    </div>
  );
}
