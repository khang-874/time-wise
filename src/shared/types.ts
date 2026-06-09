export type DailyUsage = Record<string, number>;

export type PomodoroPhase = "work" | "shortBreak" | "longBreak";

export interface PomodoroState {
  phase: PomodoroPhase;
  /** Epoch ms when current phase started; null when paused */
  startedAt: number | null;
  /** Seconds accumulated before the last pause */
  elapsedSeconds: number;
  /** Total duration for this phase in seconds */
  durationSeconds: number;
  running: boolean;
  completedToday: number;
  lastCompletionDate: string | null;
  /** Which Pomodoro in the cycle (1–longBreakInterval) */
  cyclePosition: number;
}

export interface PomodoroSettings {
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakInterval: number;
  notificationsEnabled: boolean;
}

export type PopupRequest =
  | { type: "GET_POMODORO_STATE" }
  | { type: "POMODORO_START" }
  | { type: "POMODORO_PAUSE" }
  | { type: "POMODORO_RESET" }
  | { type: "POMODORO_SKIP" }
  | { type: "UPDATE_SETTINGS"; payload: PomodoroSettings }
  | { type: "GET_USAGE"; payload: { dateKey: string } }
  | { type: "FLUSH_TIME" };

export type PopupResponse =
  | { type: "POMODORO_STATE"; payload: PomodoroState }
  | { type: "USAGE"; payload: DailyUsage }
  | { type: "OK" }
  | { type: "ERROR"; message: string };
