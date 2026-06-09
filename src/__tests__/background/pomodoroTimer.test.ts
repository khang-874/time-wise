import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  startTimer,
  pauseTimer,
  resetTimer,
  skipPhase,
  handleAlarm,
  getCurrentState,
} from "../../background/pomodoroTimer";
import { DEFAULT_POMODORO_STATE, DEFAULT_SETTINGS } from "../../shared/constants";
import type { PomodoroState } from "../../shared/types";

const mockGet = chrome.storage.local.get as ReturnType<typeof vi.fn>;
const mockSet = chrome.storage.local.set as ReturnType<typeof vi.fn>;
const mockAlarmCreate = chrome.alarms.create as ReturnType<typeof vi.fn>;
const mockAlarmClear = chrome.alarms.clear as ReturnType<typeof vi.fn>;
const mockNotificationCreate = chrome.notifications.create as ReturnType<typeof vi.fn>;

function mockState(overrides: Partial<PomodoroState> = {}): PomodoroState {
  return { ...DEFAULT_POMODORO_STATE, ...overrides };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2024-06-08T10:00:00.000Z"));
  mockGet.mockImplementation(async (key: string | string[]) => {
    const keys = Array.isArray(key) ? key : [key];
    const result: Record<string, unknown> = {};
    if (keys.includes("pomodoroState")) result.pomodoroState = mockState();
    if (keys.includes("settings")) result.settings = DEFAULT_SETTINGS;
    return result;
  });
  mockSet.mockResolvedValue(undefined);
  mockAlarmClear.mockResolvedValue(true);
});

describe("startTimer", () => {
  it("sets running to true and creates alarm", async () => {
    const result = await startTimer();
    expect(result.running).toBe(true);
    expect(result.startedAt).not.toBeNull();
    expect(mockAlarmCreate).toHaveBeenCalledWith(
      "pomodoro_end",
      expect.objectContaining({ when: expect.any(Number) })
    );
  });

  it("does nothing if already running", async () => {
    mockGet.mockImplementation(async () => ({
      pomodoroState: mockState({ running: true, startedAt: Date.now() }),
      settings: DEFAULT_SETTINGS,
    }));
    await startTimer();
    expect(mockSet).not.toHaveBeenCalled();
  });
});

describe("pauseTimer", () => {
  it("sets running to false and accumulates elapsed", async () => {
    const startedAt = Date.now() - 60000; // 60s ago
    mockGet.mockImplementation(async () => ({
      pomodoroState: mockState({ running: true, startedAt, elapsedSeconds: 0 }),
      settings: DEFAULT_SETTINGS,
    }));

    const result = await pauseTimer();
    expect(result.running).toBe(false);
    expect(result.startedAt).toBeNull();
    expect(result.elapsedSeconds).toBe(60);
  });

  it("does nothing when already paused", async () => {
    const result = await pauseTimer();
    expect(result.running).toBe(false);
    expect(mockSet).not.toHaveBeenCalled();
  });
});

describe("resetTimer", () => {
  it("resets elapsed to 0 and keeps phase", async () => {
    mockGet.mockImplementation(async () => ({
      pomodoroState: mockState({ elapsedSeconds: 300, running: false }),
      settings: DEFAULT_SETTINGS,
    }));

    const result = await resetTimer();
    expect(result.elapsedSeconds).toBe(0);
    expect(result.running).toBe(false);
    expect(result.phase).toBe("work");
    expect(result.durationSeconds).toBe(DEFAULT_SETTINGS.workMinutes * 60);
  });
});

describe("skipPhase", () => {
  it("transitions from work to shortBreak for cycles 1-3", async () => {
    mockGet.mockImplementation(async () => ({
      pomodoroState: mockState({ phase: "work", cyclePosition: 1 }),
      settings: DEFAULT_SETTINGS,
    }));

    const result = await skipPhase();
    expect(result.phase).toBe("shortBreak");
  });

  it("transitions from work to longBreak on 4th cycle", async () => {
    mockGet.mockImplementation(async () => ({
      pomodoroState: mockState({ phase: "work", cyclePosition: 4 }),
      settings: DEFAULT_SETTINGS,
    }));

    const result = await skipPhase();
    expect(result.phase).toBe("longBreak");
    expect(result.cyclePosition).toBe(1);
  });

  it("transitions from shortBreak back to work", async () => {
    mockGet.mockImplementation(async () => ({
      pomodoroState: mockState({ phase: "shortBreak", cyclePosition: 2 }),
      settings: DEFAULT_SETTINGS,
    }));

    const result = await skipPhase();
    expect(result.phase).toBe("work");
  });

  it("transitions from longBreak back to work", async () => {
    mockGet.mockImplementation(async () => ({
      pomodoroState: mockState({ phase: "longBreak", cyclePosition: 1 }),
      settings: DEFAULT_SETTINGS,
    }));

    const result = await skipPhase();
    expect(result.phase).toBe("work");
  });
});

describe("handleAlarm", () => {
  it("ignores alarms that are not pomodoro_end", async () => {
    await handleAlarm("flush");
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("transitions phase and increments completedToday", async () => {
    mockGet.mockImplementation(async () => ({
      pomodoroState: mockState({
        phase: "work",
        cyclePosition: 1,
        completedToday: 2,
        lastCompletionDate: "2024-06-08",
      }),
      settings: DEFAULT_SETTINGS,
    }));

    await handleAlarm("pomodoro_end");

    const savedState = (mockSet.mock.calls[0][0] as Record<string, PomodoroState>).pomodoroState;
    expect(savedState.completedToday).toBe(3);
    expect(savedState.phase).toBe("shortBreak");
    expect(savedState.running).toBe(false);
  });

  it("resets completedToday on a new day", async () => {
    mockGet.mockImplementation(async () => ({
      pomodoroState: mockState({
        phase: "work",
        cyclePosition: 1,
        completedToday: 5,
        lastCompletionDate: "2024-06-07", // yesterday
      }),
      settings: DEFAULT_SETTINGS,
    }));

    await handleAlarm("pomodoro_end");
    const savedState = (mockSet.mock.calls[0][0] as Record<string, PomodoroState>).pomodoroState;
    expect(savedState.completedToday).toBe(1);
  });

  it("sends desktop notification", async () => {
    await handleAlarm("pomodoro_end");
    expect(mockNotificationCreate).toHaveBeenCalled();
  });

  it("does not notify when notifications disabled", async () => {
    mockGet.mockImplementation(async () => ({
      pomodoroState: mockState({ phase: "work", cyclePosition: 1 }),
      settings: { ...DEFAULT_SETTINGS, notificationsEnabled: false },
    }));

    await handleAlarm("pomodoro_end");
    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });
});

describe("getCurrentState", () => {
  it("returns state as-is when lastCompletionDate is today", async () => {
    const state = mockState({ completedToday: 3, lastCompletionDate: "2024-06-08" });
    mockGet.mockImplementation(async () => ({ pomodoroState: state, settings: DEFAULT_SETTINGS }));

    const result = await getCurrentState();
    expect(result.completedToday).toBe(3);
  });

  it("resets completedToday when lastCompletionDate is a previous day", async () => {
    const state = mockState({ completedToday: 8, lastCompletionDate: "2024-06-07" });
    mockGet.mockImplementation(async () => ({ pomodoroState: state, settings: DEFAULT_SETTINGS }));

    const result = await getCurrentState();
    expect(result.completedToday).toBe(0);
  });
});
