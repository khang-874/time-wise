import { useState } from "react";
import { usePomodoroState } from "../../hooks/usePomodoroState";
import { useSettings } from "../../hooks/useSettings";
import TimerDisplay from "./TimerDisplay";
import TimerControls from "./TimerControls";
import TaskInput from "./TaskInput";
import SessionCounter from "./SessionCounter";
import Settings from "./Settings";

export default function PomodoroTab() {
  const { state, remainingSeconds, currentTask, setCurrentTask, start, pause, reset, skip, saveTask, completeTask } = usePomodoroState();
  const { settings, saveSettings } = useSettings();
  const [showSettings, setShowSettings] = useState(false);

  const isFresh = state.phase === "work" && state.elapsedSeconds === 0 && !state.running;
  const startDisabled = isFresh && !currentTask.trim();

  return (
    <div className="flex flex-col">
      <TimerDisplay
        remainingSeconds={remainingSeconds}
        phase={state.phase}
        durationSeconds={state.durationSeconds}
      />
      <TaskInput
        currentTask={currentTask}
        phase={state.phase}
        running={state.running}
        elapsedSeconds={state.elapsedSeconds}
        onChange={setCurrentTask}
        onSave={saveTask}
        onComplete={completeTask}
      />
      <TimerControls
        running={state.running}
        startDisabled={startDisabled}
        onStart={start}
        onPause={pause}
        onReset={reset}
        onSkip={skip}
      />
      <SessionCounter completedToday={state.completedToday} />
      <div className="flex justify-center pb-2">
        <button
          onClick={() => setShowSettings((v) => !v)}
          aria-expanded={showSettings}
          aria-label="Toggle settings"
          className="text-xs text-gray-400 hover:text-gray-600 underline"
        >
          {showSettings ? "Hide settings" : "Settings"}
        </button>
      </div>
      {showSettings && (
        <Settings
          settings={settings}
          onSave={saveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
