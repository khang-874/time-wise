/** Seconds spent per hostname for a single day. Key is the bare hostname (e.g. `"github.com"`). */
export type DailyUsage = Record<string, number>;

/** A single task worked on within a Pomodoro session. */
export interface TaskEntry {
  task: string;
  /** Epoch ms when this task became active. */
  startedAt: number;
  /** Epoch ms when Done was clicked or the session ended. */
  completedAt: number;
  /** Actual focus time in seconds, excluding any pauses while this task was active. */
  timeSpentSeconds: number;
}

/**
 * Persisted record of a completed or abandoned Pomodoro work session.
 * Stored under `sessions_YYYY-MM-DD` as an array.
 */
export interface PomodoroSession {
  sessionStartedAt: number;
  sessionCompletedAt: number;
  durationSeconds: number;
  elapsedSeconds: number;
  sessionStatus: "completed" | "abandoned";
  /** All tasks worked on during this session, in order. */
  tasks: TaskEntry[];
}

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
  /** The task currently being worked on. Empty string when no task is set. */
  currentTask: string;
  /** Epoch ms when the current task became active; `null` when no task is active. */
  currentTaskStartedAt: number | null;
  /** Focus seconds accumulated on the current task before the last pause. Mirrors `elapsedSeconds` at the task level. */
  currentTaskElapsedSeconds: number;
  /** Tasks explicitly completed (via "Done") within this Pomodoro session so far. */
  completedTasks: TaskEntry[];
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
  /** True while the screen is locked. Tracking is paused until the screen is unlocked. */
  isLocked: boolean;
  /**
   * Epoch ms of the last successful state persist. Compared against `Date.now()` in
   * `loadState` to detect browser restarts: a gap longer than the flush-alarm interval
   * means the SW was dead (browser closed / machine slept) and `sessionStart` should
   * not be trusted.
   */
  lastPersistedAt: number | null;
}

/** Platforms that content filtering understands. */
export type ContentFilterPlatform = "youtube" | "reddit" | "generic";

/** Active tab in the popup UI. */
export type AppTab = "stats" | "pomodoro" | "block";

/** A single entry in the domain blocklist. */
export interface BlockedDomain {
  /** Bare hostname, e.g. `"facebook.com"` (no `www.` prefix). */
  hostname: string;
  /** Stable integer ID of the corresponding `declarativeNetRequest` dynamic rule. */
  ruleId: number;
  /** Epoch ms when the domain was added. */
  addedAt: number;
  /** Epoch ms when removal was requested; `null` when no removal is pending. Enforces {@link REMOVAL_DELAY_MS} before removal is confirmed. */
  removalRequestedAt: number | null;
}

/** A single keyword/hashtag filter for hiding content in feeds and blocking direct navigation. */
export interface ContentFilter {
  /** Stable random ID used as React key and for removal. */
  id: string;
  platform: ContentFilterPlatform;
  /** Case-insensitive substring matched against content text. */
  keyword: string;
  /** Epoch ms when this filter was added. */
  addedAt: number;
  /** Epoch ms when removal was requested; `null` when no removal is pending. Enforces {@link REMOVAL_DELAY_MS} before removal is confirmed. */
  removalRequestedAt: number | null;
}

/** Persisted block feature configuration. */
export interface BlockSettings {
  blockedDomains: BlockedDomain[];
  contentFilters: ContentFilter[];
}

/**
 * Typed messages sent from the popup to the background service worker.
 * All variants are handled by `src/background/messageHandler.ts`.
 */
export type PopupRequest =
  | { type: "GET_POMODORO_STATE" }
  | { type: "POMODORO_START"; payload?: { task: string } }
  | { type: "POMODORO_PAUSE" }
  | { type: "POMODORO_RESET" }
  | { type: "POMODORO_SKIP" }
  | { type: "UPDATE_SETTINGS"; payload: PomodoroSettings }
  | { type: "GET_USAGE"; payload: { dateKey: string } }
  /** Flushes the in-progress session to storage before reading today's usage. */
  | { type: "FLUSH_TIME" }
  | { type: "SET_TASK"; payload: { task: string } }
  | { type: "COMPLETE_TASK" }
  | { type: "GET_BLOCK_SETTINGS" }
  | { type: "ADD_BLOCKED_DOMAIN"; payload: { hostname: string } }
  | { type: "REMOVE_BLOCKED_DOMAIN"; payload: { hostname: string } }
  | { type: "REQUEST_REMOVE_BLOCKED_DOMAIN"; payload: { hostname: string } }
  | { type: "CANCEL_REMOVE_BLOCKED_DOMAIN"; payload: { hostname: string } }
  | { type: "ADD_CONTENT_FILTER"; payload: { platform: ContentFilterPlatform; keyword: string } }
  | { type: "REMOVE_CONTENT_FILTER"; payload: { id: string } }
  | { type: "REQUEST_REMOVE_CONTENT_FILTER"; payload: { id: string } }
  | { type: "CANCEL_REMOVE_CONTENT_FILTER"; payload: { id: string } }
  | {
      type: "IMPORT_BLOCK_SETTINGS";
      payload: {
        blockedDomains?: { hostname: string }[];
        contentFilters?: { platform: ContentFilterPlatform; keyword: string }[];
      };
    };

/** Typed responses returned by the background service worker to the popup. */
export type PopupResponse =
  | { type: "POMODORO_STATE"; payload: PomodoroState }
  | { type: "USAGE"; payload: DailyUsage }
  | { type: "BLOCK_SETTINGS"; payload: BlockSettings }
  | { type: "OK" }
  | { type: "ERROR"; message: string };
