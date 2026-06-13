/** Seconds spent per hostname for a single day. Key is the bare hostname (e.g. `"github.com"`). */
export type DailyUsage = Record<string, number>;

/** The three phases of a Pomodoro cycle. */
export type PomodoroPhase = "work" | "shortBreak" | "longBreak";

/**
 * Persisted Pomodoro timer state stored in `chrome.storage.local`.
 *
 * @remarks
 * Remaining time is never stored directly. Instead, `startedAt` and
 * `elapsedSeconds` are stored so the service worker can recompute the
 * correct remaining time after being suspended and resumed by Chrome.
 *
 * Formula: `remaining = durationSeconds - (elapsedSeconds + floor((Date.now() - startedAt) / 1000))`
 */
export interface PomodoroState {
  phase: PomodoroPhase;
  /** Epoch ms when the current phase started; `null` when paused. */
  startedAt: number | null;
  /** Seconds already elapsed before the last pause. Accumulates across pauses. */
  elapsedSeconds: number;
  /** Total duration for the current phase in seconds, derived from {@link PomodoroSettings}. */
  durationSeconds: number;
  running: boolean;
  /** Number of completed work sessions today. Resets when {@link lastCompletionDate} differs from today. */
  completedToday: number;
  /** ISO date string (`YYYY-MM-DD`) of the last completed Pomodoro, used to detect day rollovers. */
  lastCompletionDate: string | null;
  /** Position within the current cycle (1 – {@link PomodoroSettings.longBreakInterval}). Resets to 1 after a long break. */
  cyclePosition: number;
}

/** User-configurable Pomodoro durations and preferences. */
export interface PomodoroSettings {
  /** Duration of a focus session in minutes. Default: 25. */
  workMinutes: number;
  /** Duration of a short break in minutes. Default: 5. */
  shortBreakMinutes: number;
  /** Duration of a long break in minutes. Default: 15. */
  longBreakMinutes: number;
  /** Number of work sessions before a long break is scheduled. Default: 4. */
  longBreakInterval: number;
  notificationsEnabled: boolean;
}

/**
 * Persisted time-tracker state so the service worker can resume
 * tracking after Chrome suspends and restarts it.
 */
export interface TrackerState {
  activeTabId: number | null;
  currentHost: string | null;
  sessionStart: number | null;
  isWindowFocused: boolean;
  /** True while Chrome's idle API reports the system as idle or locked. */
  isIdle: boolean;
}

/**
 * Typed messages sent from the popup to the background service worker.
 * All variants are handled by `src/background/messageHandler.ts`.
 */
export type PopupRequest =
  | { type: "GET_POMODORO_STATE" }
  | { type: "POMODORO_START" }
  | { type: "POMODORO_PAUSE" }
  | { type: "POMODORO_RESET" }
  | { type: "POMODORO_SKIP" }
  | { type: "UPDATE_SETTINGS"; payload: PomodoroSettings }
  | { type: "GET_USAGE"; payload: { dateKey: string } }
  /** Flushes the in-progress session to storage before reading today's usage. */
  | { type: "FLUSH_TIME" };

/** Typed responses returned by the background service worker to the popup. */
export type PopupResponse =
  | { type: "POMODORO_STATE"; payload: PomodoroState }
  | { type: "USAGE"; payload: DailyUsage }
  | { type: "OK" }
  | { type: "ERROR"; message: string };
