interface Props {
  running: boolean;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onSkip: () => void;
}

export default function TimerControls({ running, onStart, onPause, onReset, onSkip }: Props) {
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
          className="px-6 py-2.5 bg-gray-800 text-white rounded-full text-sm font-medium hover:bg-gray-700 transition-colors"
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
