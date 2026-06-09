import { useState, useEffect, useRef, useCallback } from "react";
import type { PomodoroState } from "../../shared/types";
import { DEFAULT_POMODORO_STATE } from "../../shared/constants";
import { sendMessage } from "../../shared/messages";
import { computeRemainingSeconds } from "../../shared/timeUtils";

interface UsePomodoroStateResult {
  state: PomodoroState;
  remainingSeconds: number;
  start: () => Promise<void>;
  pause: () => Promise<void>;
  reset: () => Promise<void>;
  skip: () => Promise<void>;
}

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

  // Sync on mount
  useEffect(() => {
    syncFromSW();
  }, [syncFromSW]);

  // 1-second local countdown
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

  // Listen for phase-change push from SW
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
