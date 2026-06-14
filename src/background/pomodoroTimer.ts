/**
 * @file Pomodoro state machine running inside the background service worker.
 *
 * @remarks
 * All state is persisted to `chrome.storage.local` after every mutation so it
 * survives service worker suspension. Phase transitions are driven by a named
 * `chrome.alarms` entry (`"pomodoro_end"`) rather than `setTimeout`, because
 * alarms survive suspension while timers do not.
 */

import type { PomodoroPhase, PomodoroSession, PomodoroSettings, PomodoroState, TaskEntry } from "../shared/types";
import {
  addSession,
  getPomodoroState,
  getSettings,
  setPomodoroState,
} from "../shared/storage";
import { ALARM_POMODORO_END } from "../shared/constants";
import { toDateKey } from "../shared/timeUtils";

/**
 * Finalizes the current task into a `TaskEntry`, computing accurate focus time.
 * Returns `null` when no task is active.
 */
function finalizeCurrentTask(state: PomodoroState, now: number): TaskEntry | null {
  if (!state.currentTask) return null;
  const runTime = state.running && state.startedAt
    ? Math.floor((now - state.startedAt) / 1000)
    : 0;
  return {
    task: state.currentTask,
    startedAt: state.currentTaskStartedAt ?? now,
    completedAt: now,
    timeSpentSeconds: state.currentTaskElapsedSeconds + runTime,
  };
}

/**
 * Records the current Pomodoro work session (with all its tasks) to storage.
 */
async function recordSession(
  state: PomodoroState,
  sessionStatus: "completed" | "abandoned",
  now: number,
): Promise<void> {
  const finalTask = finalizeCurrentTask(state, now);
  const tasks = finalTask
    ? [...state.completedTasks, finalTask]
    : [...state.completedTasks];

  const runTime = state.running && state.startedAt
    ? Math.floor((now - state.startedAt) / 1000)
    : 0;
  const elapsedSeconds = sessionStatus === "completed"
    ? state.durationSeconds
    : state.elapsedSeconds + runTime;

  const session: PomodoroSession = {
    sessionStartedAt: state.startedAt
      ? state.startedAt - state.elapsedSeconds * 1000
      : now - elapsedSeconds * 1000,
    sessionCompletedAt: now,
    durationSeconds: state.durationSeconds,
    elapsedSeconds,
    sessionStatus,
    tasks,
  };
  await addSession(toDateKey(new Date(now)), session);
}

/**
 * Returns the duration in seconds for a given phase based on current settings.
 */
function phaseDuration(phase: PomodoroPhase, settings: PomodoroSettings): number {
  switch (phase) {
    case "work": return settings.workMinutes * 60;
    case "shortBreak": return settings.shortBreakMinutes * 60;
    case "longBreak": return settings.longBreakMinutes * 60;
  }
}

/**
 * Computes the fields that change when transitioning to the next phase.
 *
 * @remarks
 * - After a work session: advances to `shortBreak`, or `longBreak` if
 *   `cyclePosition` has reached `longBreakInterval`. Resets `cyclePosition` to 1 after a long break.
 * - After any break: returns to `work`.
 * - Detects a day rollover via `lastCompletionDate` and resets `completedToday` accordingly.
 */
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

/**
 * Creates (or recreates) the `"pomodoro_end"` alarm for the given state.
 *
 * @remarks
 * The fire time is computed from `startedAt` and the remaining duration so the
 * alarm is correct even if the service worker was suspended mid-session.
 */
async function scheduleAlarm(state: PomodoroState): Promise<void> {
  if (!state.startedAt) return;
  const fireAt = state.startedAt + (state.durationSeconds - state.elapsedSeconds) * 1000;
  chrome.alarms.create(ALARM_POMODORO_END, { when: fireAt });
}

/**
 * Sends a desktop notification announcing the phase that is about to begin.
 * No-op when `notificationsEnabled` is `false`.
 *
 * @param phase - The phase the user is transitioning **into**.
 */
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

/**
 * Starts the timer for the current phase.
 * No-op if the timer is already running.
 *
 * @returns The updated {@link PomodoroState} after starting.
 */
export async function startTimer(task?: string): Promise<PomodoroState> {
  const state = await getPomodoroState();
  if (state.running) return state;

  const now = Date.now();
  const isFreshSession = state.elapsedSeconds === 0 && state.startedAt === null;
  const updated: PomodoroState = {
    ...state,
    running: true,
    startedAt: now,
    ...(isFreshSession && task !== undefined
      ? {
          currentTask: task,
          currentTaskStartedAt: now,
          currentTaskElapsedSeconds: 0,
          completedTasks: [],
        }
      : {}),
  };
  await chrome.alarms.clear(ALARM_POMODORO_END);
  await scheduleAlarm(updated);
  await setPomodoroState(updated);
  return updated;
}

/**
 * Pauses the timer, accumulating elapsed time into `elapsedSeconds`.
 * No-op if the timer is already paused.
 *
 * @returns The updated {@link PomodoroState} after pausing.
 */
export async function pauseTimer(): Promise<PomodoroState> {
  const state = await getPomodoroState();
  if (!state.running || !state.startedAt) return state;

  const additionalElapsed = Math.floor((Date.now() - state.startedAt) / 1000);
  const updated: PomodoroState = {
    ...state,
    running: false,
    startedAt: null,
    elapsedSeconds: state.elapsedSeconds + additionalElapsed,
    currentTaskElapsedSeconds: state.currentTaskElapsedSeconds + additionalElapsed,
  };
  await chrome.alarms.clear(ALARM_POMODORO_END);
  await setPomodoroState(updated);
  return updated;
}

/**
 * Resets the current phase back to its full duration without advancing the cycle.
 *
 * @returns The updated {@link PomodoroState} after resetting.
 */
export async function resetTimer(): Promise<PomodoroState> {
  const state = await getPomodoroState();
  const settings = await getSettings();

  if (state.phase === "work" && (state.elapsedSeconds > 0 || state.startedAt !== null)) {
    await recordSession(state, "abandoned", Date.now());
  }

  const updated: PomodoroState = {
    ...state,
    running: false,
    startedAt: null,
    elapsedSeconds: 0,
    durationSeconds: phaseDuration(state.phase, settings),
    currentTask: "",
    currentTaskStartedAt: null,
    currentTaskElapsedSeconds: 0,
    completedTasks: [],
  };
  await chrome.alarms.clear(ALARM_POMODORO_END);
  await setPomodoroState(updated);
  return updated;
}

/**
 * Immediately advances to the next phase without waiting for the timer to expire.
 *
 * @returns The updated {@link PomodoroState} after skipping.
 */
export async function skipPhase(): Promise<PomodoroState> {
  const state = await getPomodoroState();
  const settings = await getSettings();

  if (state.phase === "work" && (state.elapsedSeconds > 0 || state.startedAt !== null)) {
    await recordSession(state, "abandoned", Date.now());
  }

  const next = nextPhase(state, settings);
  const updated: PomodoroState = {
    ...state,
    ...next,
    running: false,
    startedAt: null,
    elapsedSeconds: 0,
    durationSeconds: phaseDuration(next.phase, settings),
    currentTask: "",
    currentTaskStartedAt: null,
    currentTaskElapsedSeconds: 0,
    completedTasks: [],
  };
  await chrome.alarms.clear(ALARM_POMODORO_END);
  await setPomodoroState(updated);
  return updated;
}

/**
 * Handles the `"pomodoro_end"` alarm fired by Chrome when a phase completes.
 *
 * @remarks
 * Transitions to the next phase, sends a desktop notification, persists state,
 * and attempts a best-effort push to the popup via `chrome.runtime.sendMessage`
 * (silently ignored if the popup is closed).
 *
 * @param alarmName - Name of the fired alarm; only `"pomodoro_end"` is handled.
 */
export async function handleAlarm(alarmName: string): Promise<void> {
  if (alarmName !== ALARM_POMODORO_END) return;

  const state = await getPomodoroState();
  const settings = await getSettings();
  const now = Date.now();

  if (state.phase === "work") {
    await recordSession(state, "completed", now);
  }

  const next = nextPhase(state, settings);
  sendNotification(next.phase, settings);

  const updated: PomodoroState = {
    ...state,
    ...next,
    running: false,
    startedAt: null,
    elapsedSeconds: 0,
    durationSeconds: phaseDuration(next.phase, settings),
    currentTask: "",
    currentTaskStartedAt: null,
    currentTaskElapsedSeconds: 0,
    completedTasks: [],
  };
  await setPomodoroState(updated);

  try {
    await chrome.runtime.sendMessage({ type: "POMODORO_PHASE_CHANGE", payload: updated });
  } catch {
    // popup not open — expected
  }
}

/**
 * Sets (or replaces) the current task label without touching the timer.
 * Resets per-task elapsed tracking so the new task starts fresh.
 */
export async function setTask(task: string): Promise<PomodoroState> {
  const state = await getPomodoroState();
  const now = Date.now();
  const updated: PomodoroState = {
    ...state,
    currentTask: task,
    currentTaskStartedAt: now,
    currentTaskElapsedSeconds: 0,
  };
  await setPomodoroState(updated);
  return updated;
}

/**
 * Marks the current task as done, logs it to `completedTasks`, and clears the active task.
 * The Pomodoro timer continues running. No-op when no task is active.
 */
export async function completeTask(): Promise<PomodoroState> {
  const state = await getPomodoroState();
  if (!state.currentTask) return state;

  const now = Date.now();
  const entry = finalizeCurrentTask(state, now);
  const updated: PomodoroState = {
    ...state,
    completedTasks: entry ? [...state.completedTasks, entry] : state.completedTasks,
    currentTask: "",
    currentTaskStartedAt: null,
    currentTaskElapsedSeconds: 0,
  };
  await setPomodoroState(updated);
  return updated;
}

/**
 * Applies new settings, adjusting the active phase duration without losing elapsed progress.
 *
 * @remarks
 * If the timer is running, it is paused first. The new `durationSeconds` is
 * set, and `elapsedSeconds` is clamped to at most `newDuration - 1` to prevent
 * an immediate phase completion on the next tick.
 *
 * @param settings - The new settings to apply.
 * @returns The updated {@link PomodoroState} after applying the settings.
 */
export async function updateSettings(settings: PomodoroSettings): Promise<PomodoroState> {
  const state = await getPomodoroState();
  const wasRunning = state.running;

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

/**
 * Returns the current Pomodoro state, resetting `completedToday` if the calendar day has changed.
 *
 * @remarks
 * Called by the message handler on every `GET_POMODORO_STATE` request so the
 * popup always sees a fresh count after midnight.
 */
export async function getCurrentState(): Promise<PomodoroState> {
  const state = await getPomodoroState();
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
