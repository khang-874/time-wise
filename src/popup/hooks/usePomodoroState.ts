import { useState, useEffect, useRef, useCallback } from "react";
import type { PomodoroState } from "../../shared/types";
import { DEFAULT_POMODORO_STATE } from "../../shared/constants";
import { sendMessage } from "../../shared/messages";
import { computeRemainingSeconds } from "../../shared/timeUtils";

interface UsePomodoroStateResult {
  /** Full Pomodoro state synced from the service worker. */
  state: PomodoroState;
  /**
   * Display-ready remaining seconds, updated every second by a local interval.
   * Resynced from the service worker on mount and after every command.
   */
  remainingSeconds: number;
  /** Local editable copy of the current task label. Synced from SW on mount and after commands. */
  currentTask: string;
  setCurrentTask: (task: string) => void;
  start: () => Promise<void>;
  pause: () => Promise<void>;
  reset: () => Promise<void>;
  skip: () => Promise<void>;
  /** Saves the current task label to the SW without stopping the timer. */
  saveTask: (task: string) => Promise<void>;
  /** Marks the current task done, logs it, and clears the active task. */
  completeTask: () => Promise<void>;
}

/**
 * Syncs Pomodoro state with the background service worker and drives the
 * visual countdown in the popup.
 *
 * @remarks
 * **Countdown strategy:** the popup runs its own 1-second `setInterval` rather
 * than receiving per-second pushes from the SW. This avoids keeping the SW
 * awake just for ticking and handles the case where the popup is closed
 * (interval is cleared on unmount). On every open the hook fetches ground
 * truth from the SW via `GET_POMODORO_STATE`, so drift never accumulates.
 *
 * **Phase-change push:** the SW sends a best-effort `POMODORO_PHASE_CHANGE`
 * message when an alarm fires. The hook listens for this to reset the display
 * immediately without waiting for the user to reopen the popup.
 */
export function usePomodoroState(): UsePomodoroStateResult {
  const [state, setState] = useState<PomodoroState>(DEFAULT_POMODORO_STATE);
  const [remainingSeconds, setRemainingSeconds] = useState(
    DEFAULT_POMODORO_STATE.durationSeconds
  );
  const [currentTask, setCurrentTask] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const syncState = useCallback((s: PomodoroState) => {
    setState(s);
    setCurrentTask(s.currentTask);
    setRemainingSeconds(computeRemainingSeconds(s.durationSeconds, s.startedAt, s.elapsedSeconds));
  }, []);

  const syncFromSW = useCallback(async () => {
    const response = await sendMessage({ type: "GET_POMODORO_STATE" });
    if (response.type === "POMODORO_STATE") {
      syncState(response.payload);
    }
  }, [syncState]);

  useEffect(() => {
    syncFromSW();
  }, [syncFromSW]);

  // Start/stop the local 1-second countdown based on whether the timer is running.
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (state.running) {
      intervalRef.current = setInterval(() => {
        setRemainingSeconds((prev) => Math.max(0, prev - 1));
      }, 1000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state.running, state.startedAt]);

  // Listen for phase-change push from the SW so the display updates immediately.
  useEffect(() => {
    const listener = (msg: { type: string; payload?: PomodoroState }) => {
      if (msg.type === "POMODORO_PHASE_CHANGE" && msg.payload) {
        syncState(msg.payload);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const sendCommand = async (
    request:
      | { type: "POMODORO_START"; payload?: { task: string } }
      | { type: "POMODORO_PAUSE" | "POMODORO_RESET" | "POMODORO_SKIP" }
  ) => {
    const response = await sendMessage(request);
    if (response.type === "POMODORO_STATE") {
      syncState(response.payload);
    }
  };

  return {
    state,
    remainingSeconds,
    currentTask,
    setCurrentTask,
    start: () => sendCommand({ type: "POMODORO_START", payload: { task: currentTask } }),
    pause: () => sendCommand({ type: "POMODORO_PAUSE" }),
    reset: () => sendCommand({ type: "POMODORO_RESET" }),
    skip: () => sendCommand({ type: "POMODORO_SKIP" }),
    saveTask: async (task: string) => {
      const response = await sendMessage({ type: "SET_TASK", payload: { task } });
      if (response.type === "POMODORO_STATE") syncState(response.payload);
    },
    completeTask: async () => {
      const response = await sendMessage({ type: "COMPLETE_TASK" });
      if (response.type === "POMODORO_STATE") syncState(response.payload);
    },
  };
}
