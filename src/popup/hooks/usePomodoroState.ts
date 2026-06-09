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
  start: () => Promise<void>;
  pause: () => Promise<void>;
  reset: () => Promise<void>;
  skip: () => Promise<void>;
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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const syncFromSW = useCallback(async () => {
    const response = await sendMessage({ type: "GET_POMODORO_STATE" });
    if (response.type === "POMODORO_STATE") {
      const s = response.payload;
      setState(s);
      setRemainingSeconds(computeRemainingSeconds(s.durationSeconds, s.startedAt, s.elapsedSeconds));
    }
  }, []);

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
        const s = msg.payload;
        setState(s);
        setRemainingSeconds(
          computeRemainingSeconds(s.durationSeconds, s.startedAt, s.elapsedSeconds)
        );
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const sendCommand = async (type: "POMODORO_START" | "POMODORO_PAUSE" | "POMODORO_RESET" | "POMODORO_SKIP") => {
    const response = await sendMessage({ type });
    if (response.type === "POMODORO_STATE") {
      const s = response.payload;
      setState(s);
      setRemainingSeconds(computeRemainingSeconds(s.durationSeconds, s.startedAt, s.elapsedSeconds));
    }
  };

  return {
    state,
    remainingSeconds,
    start: () => sendCommand("POMODORO_START"),
    pause: () => sendCommand("POMODORO_PAUSE"),
    reset: () => sendCommand("POMODORO_RESET"),
    skip: () => sendCommand("POMODORO_SKIP"),
  };
}
