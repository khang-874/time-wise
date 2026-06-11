import type { PomodoroSettings, PomodoroState } from "./types";

export const ALARM_FLUSH = "flush";
export const ALARM_POMODORO_END = "pomodoro_end";

export const STORAGE_KEY_SETTINGS = "settings";
export const STORAGE_KEY_POMODORO = "pomodoroState";
export const STORAGE_KEY_USAGE_PREFIX = "usage_";
export const STORAGE_KEY_TRACKER = "trackerState";

export const IDLE_THRESHOLD_SECONDS = 60;

export const DEFAULT_SETTINGS: PomodoroSettings = {
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakInterval: 4,
  notificationsEnabled: true,
};

export const DEFAULT_POMODORO_STATE: PomodoroState = {
  phase: "work",
  startedAt: null,
  elapsedSeconds: 0,
  durationSeconds: DEFAULT_SETTINGS.workMinutes * 60,
  running: false,
  completedToday: 0,
  lastCompletionDate: null,
  cyclePosition: 1,
};
