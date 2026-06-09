import type { PomodoroPhase, PomodoroSettings, PomodoroState } from "../shared/types";
import {
  getPomodoroState,
  getSettings,
  setPomodoroState,
} from "../shared/storage";
import {
  ALARM_POMODORO_END,
  DEFAULT_POMODORO_STATE,
  DEFAULT_SETTINGS,
} from "../shared/constants";
import { toDateKey } from "../shared/timeUtils";

function phaseDuration(phase: PomodoroPhase, settings: PomodoroSettings): number {
  switch (phase) {
    case "work": return settings.workMinutes * 60;
    case "shortBreak": return settings.shortBreakMinutes * 60;
    case "longBreak": return settings.longBreakMinutes * 60;
  }
}

function nextPhase(
  current: PomodoroState,
  settings: PomodoroSettings
): Pick<PomodoroState, "phase" | "cyclePosition" | "completedToday" | "lastCompletionDate"> {
  const today = toDateKey(new Date());
  const completedToday =
    current.lastCompletionDate === today
      ? current.completedToday
      : 0;

  if (current.phase === "work") {
    const newCompleted = completedToday + 1;
    const newCycle = current.cyclePosition + 1;
    const isLongBreak = current.cyclePosition >= settings.longBreakInterval;
    return {
      phase: isLongBreak ? "longBreak" : "shortBreak",
      cyclePosition: isLongBreak ? 1 : newCycle,
      completedToday: newCompleted,
      lastCompletionDate: today,
    };
  }

  return {
    phase: "work",
    cyclePosition: current.cyclePosition,
    completedToday,
    lastCompletionDate: current.lastCompletionDate,
  };
}

async function scheduleAlarm(state: PomodoroState): Promise<void> {
  if (!state.startedAt) return;
  const fireAt = state.startedAt + (state.durationSeconds - state.elapsedSeconds) * 1000;
  chrome.alarms.create(ALARM_POMODORO_END, { when: fireAt });
}

function sendNotification(phase: PomodoroPhase, settings: PomodoroSettings): void {
  if (!settings.notificationsEnabled) return;
  const messages: Record<PomodoroPhase, string> = {
    work: "Break is over — back to work!",
    shortBreak: "Pomodoro done! Take a short break.",
    longBreak: "Great work! Time for a long break.",
  };
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon48.png",
    title: "TimeWise",
    message: messages[phase],
  });
}

export async function startTimer(): Promise<PomodoroState> {
  const state = await getPomodoroState();
  if (state.running) return state;

  const updated: PomodoroState = {
    ...state,
    running: true,
    startedAt: Date.now(),
  };
  await chrome.alarms.clear(ALARM_POMODORO_END);
  await scheduleAlarm(updated);
  await setPomodoroState(updated);
  return updated;
}

export async function pauseTimer(): Promise<PomodoroState> {
  const state = await getPomodoroState();
  if (!state.running || !state.startedAt) return state;

  const additionalElapsed = Math.floor((Date.now() - state.startedAt) / 1000);
  const updated: PomodoroState = {
    ...state,
    running: false,
    startedAt: null,
    elapsedSeconds: state.elapsedSeconds + additionalElapsed,
  };
  await chrome.alarms.clear(ALARM_POMODORO_END);
  await setPomodoroState(updated);
  return updated;
}

export async function resetTimer(): Promise<PomodoroState> {
  const state = await getPomodoroState();
  const settings = await getSettings();
  const updated: PomodoroState = {
    ...state,
    running: false,
    startedAt: null,
    elapsedSeconds: 0,
    durationSeconds: phaseDuration(state.phase, settings),
  };
  await chrome.alarms.clear(ALARM_POMODORO_END);
  await setPomodoroState(updated);
  return updated;
}

export async function skipPhase(): Promise<PomodoroState> {
  const state = await getPomodoroState();
  const settings = await getSettings();
  const next = nextPhase(state, settings);
  const updated: PomodoroState = {
    ...state,
    ...next,
    running: false,
    startedAt: null,
    elapsedSeconds: 0,
    durationSeconds: phaseDuration(next.phase, settings),
  };
  await chrome.alarms.clear(ALARM_POMODORO_END);
  await setPomodoroState(updated);
  return updated;
}

export async function handleAlarm(alarmName: string): Promise<void> {
  if (alarmName !== ALARM_POMODORO_END) return;

  const state = await getPomodoroState();
  const settings = await getSettings();
  const next = nextPhase(state, settings);

  sendNotification(next.phase, settings);

  const updated: PomodoroState = {
    ...state,
    ...next,
    running: false,
    startedAt: null,
    elapsedSeconds: 0,
    durationSeconds: phaseDuration(next.phase, settings),
  };
  await setPomodoroState(updated);

  // Notify popup if open (best-effort)
  try {
    await chrome.runtime.sendMessage({ type: "POMODORO_PHASE_CHANGE", payload: updated });
  } catch {
    // popup not open
  }
}

export async function updateSettings(settings: PomodoroSettings): Promise<PomodoroState> {
  const state = await getPomodoroState();
  const wasRunning = state.running;

  // Pause first if running, then update duration for current phase
  let updated = state;
  if (wasRunning) {
    updated = await pauseTimer();
  }

  const newDuration = phaseDuration(updated.phase, settings);
  const adjustedState: PomodoroState = {
    ...updated,
    durationSeconds: newDuration,
    elapsedSeconds: Math.min(updated.elapsedSeconds, newDuration - 1),
  };
  await setPomodoroState(adjustedState);
  return adjustedState;
}

export async function getCurrentState(): Promise<PomodoroState> {
  const state = await getPomodoroState();
  // Reset completedToday if it's a new day
  const today = toDateKey(new Date());
  if (state.lastCompletionDate && state.lastCompletionDate !== today) {
    const reset: PomodoroState = {
      ...state,
      completedToday: 0,
      lastCompletionDate: today,
    };
    await setPomodoroState(reset);
    return reset;
  }
  return state;
}

export { DEFAULT_SETTINGS, DEFAULT_POMODORO_STATE };
