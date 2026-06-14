import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  startTimer,
  pauseTimer,
  resetTimer,
  skipPhase,
  setTask,
  completeTask,
  handleAlarm,
  getCurrentState,
} from "../../background/pomodoroTimer";
import { DEFAULT_POMODORO_STATE, DEFAULT_SETTINGS } from "../../shared/constants";
import type { PomodoroSession, PomodoroState } from "../../shared/types";

const mockGet = chrome.storage.local.get as ReturnType<typeof vi.fn>;
const mockSet = chrome.storage.local.set as ReturnType<typeof vi.fn>;
const mockAlarmCreate = chrome.alarms.create as ReturnType<typeof vi.fn>;
const mockAlarmClear = chrome.alarms.clear as ReturnType<typeof vi.fn>;
const mockNotificationCreate = chrome.notifications.create as ReturnType<typeof vi.fn>;

function mockState(overrides: Partial<PomodoroState> = {}): PomodoroState {
  return { ...DEFAULT_POMODORO_STATE, ...overrides };
}

function getSavedPomodoroState(): PomodoroState {
  const call = mockSet.mock.calls.find(
    (c: unknown[]) => (c[0] as Record<string, unknown>).pomodoroState !== undefined
  );
  return (call?.[0] as Record<string, PomodoroState>)?.pomodoroState;
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

    const savedState = getSavedPomodoroState();
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
    const savedState = getSavedPomodoroState();
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

describe("startTimer with task", () => {
  it("sets currentTask on a fresh session", async () => {
    const result = await startTimer("Write PR");
    expect(result.currentTask).toBe("Write PR");
    expect(result.currentTaskStartedAt).not.toBeNull();
    expect(result.completedTasks).toEqual([]);
  });

  it("does not override currentTask when resuming from pause", async () => {
    mockGet.mockImplementation(async () => ({
      pomodoroState: mockState({ elapsedSeconds: 100, running: false, currentTask: "Existing task" }),
      settings: DEFAULT_SETTINGS,
    }));
    const result = await startTimer("New task");
    expect(result.currentTask).toBe("Existing task");
  });
});

describe("setTask", () => {
  it("updates currentTask without touching timer state", async () => {
    mockGet.mockImplementation(async () => ({
      pomodoroState: mockState({ running: true, startedAt: 1000, elapsedSeconds: 60 }),
      settings: DEFAULT_SETTINGS,
    }));
    const result = await setTask("New focus");
    expect(result.currentTask).toBe("New focus");
    expect(result.running).toBe(true);
    expect(result.elapsedSeconds).toBe(60);
    expect(result.currentTaskElapsedSeconds).toBe(0);
  });
});

describe("completeTask", () => {
  it("pushes a TaskEntry to completedTasks and clears currentTask", async () => {
    const now = Date.now();
    mockGet.mockImplementation(async () => ({
      pomodoroState: mockState({
        currentTask: "Write tests",
        currentTaskStartedAt: now - 5000,
        currentTaskElapsedSeconds: 5,
        running: false,
      }),
      settings: DEFAULT_SETTINGS,
    }));
    const result = await completeTask();
    expect(result.currentTask).toBe("");
    expect(result.currentTaskStartedAt).toBeNull();
    expect(result.completedTasks).toHaveLength(1);
    expect(result.completedTasks[0].task).toBe("Write tests");
    expect(result.completedTasks[0].timeSpentSeconds).toBe(5);
  });

  it("is a no-op when no currentTask is set", async () => {
    const result = await completeTask();
    expect(mockSet).not.toHaveBeenCalled();
    expect(result.completedTasks).toEqual([]);
  });
});

describe("pauseTimer accumulates currentTaskElapsedSeconds", () => {
  it("adds run time to both elapsedSeconds and currentTaskElapsedSeconds", async () => {
    const startedAt = Date.now();
    mockGet.mockImplementation(async () => ({
      pomodoroState: mockState({
        running: true,
        startedAt,
        elapsedSeconds: 10,
        currentTaskElapsedSeconds: 10,
      }),
      settings: DEFAULT_SETTINGS,
    }));
    vi.advanceTimersByTime(30000);
    const result = await pauseTimer();
    expect(result.elapsedSeconds).toBe(40);
    expect(result.currentTaskElapsedSeconds).toBe(40);
  });
});

describe("resetTimer session recording", () => {
  it("records an abandoned session when a work session was started", async () => {
    mockGet.mockImplementation(async (key: string | string[]) => {
      const keys = Array.isArray(key) ? key : [key];
      const result: Record<string, unknown> = {};
      if (keys.includes("pomodoroState"))
        result.pomodoroState = mockState({ phase: "work", elapsedSeconds: 300, currentTask: "PR review" });
      if (keys.includes("settings")) result.settings = DEFAULT_SETTINGS;
      return result;
    });
    await resetTimer();
    const sessionCall = mockSet.mock.calls.find(
      (c: unknown[]) => Object.keys(c[0] as object).some((k) => k.startsWith("sessions_"))
    );
    expect(sessionCall).toBeDefined();
    const session = (Object.values(sessionCall![0] as Record<string, PomodoroSession[]>)[0])[0];
    expect(session.sessionStatus).toBe("abandoned");
    expect(session.tasks[0].task).toBe("PR review");
  });

  it("does not record when resetting a fresh work session", async () => {
    await resetTimer();
    const sessionCall = mockSet.mock.calls.find(
      (c: unknown[]) => Object.keys(c[0] as object).some((k) => k.startsWith("sessions_"))
    );
    expect(sessionCall).toBeUndefined();
  });

  it("does not record when resetting a break phase", async () => {
    mockGet.mockImplementation(async (key: string | string[]) => {
      const keys = Array.isArray(key) ? key : [key];
      const result: Record<string, unknown> = {};
      if (keys.includes("pomodoroState"))
        result.pomodoroState = mockState({ phase: "shortBreak", elapsedSeconds: 60 });
      if (keys.includes("settings")) result.settings = DEFAULT_SETTINGS;
      return result;
    });
    await resetTimer();
    const sessionCall = mockSet.mock.calls.find(
      (c: unknown[]) => Object.keys(c[0] as object).some((k) => k.startsWith("sessions_"))
    );
    expect(sessionCall).toBeUndefined();
  });

  it("clears task fields after reset", async () => {
    const result = await resetTimer();
    expect(result.currentTask).toBe("");
    expect(result.currentTaskStartedAt).toBeNull();
    expect(result.completedTasks).toEqual([]);
  });
});

describe("handleAlarm session recording", () => {
  it("records a completed session on work alarm", async () => {
    mockGet.mockImplementation(async (key: string | string[]) => {
      const keys = Array.isArray(key) ? key : [key];
      const result: Record<string, unknown> = {};
      if (keys.includes("pomodoroState"))
        result.pomodoroState = mockState({ phase: "work", running: true, startedAt: Date.now(), currentTask: "Ship feature" });
      if (keys.includes("settings")) result.settings = DEFAULT_SETTINGS;
      return result;
    });
    await handleAlarm("pomodoro_end");
    const sessionCall = mockSet.mock.calls.find(
      (c: unknown[]) => Object.keys(c[0] as object).some((k) => k.startsWith("sessions_"))
    );
    expect(sessionCall).toBeDefined();
    const session = (Object.values(sessionCall![0] as Record<string, PomodoroSession[]>)[0])[0];
    expect(session.sessionStatus).toBe("completed");
    expect(session.tasks[0].task).toBe("Ship feature");
    expect(session.elapsedSeconds).toBe(DEFAULT_POMODORO_STATE.durationSeconds);
  });

  it("does not record a session when alarm fires during a break phase", async () => {
    mockGet.mockImplementation(async (key: string | string[]) => {
      const keys = Array.isArray(key) ? key : [key];
      const result: Record<string, unknown> = {};
      if (keys.includes("pomodoroState"))
        result.pomodoroState = mockState({ phase: "shortBreak", cyclePosition: 1 });
      if (keys.includes("settings")) result.settings = DEFAULT_SETTINGS;
      return result;
    });
    await handleAlarm("pomodoro_end");
    const sessionCall = mockSet.mock.calls.find(
      (c: unknown[]) => Object.keys(c[0] as object).some((k) => k.startsWith("sessions_"))
    );
    expect(sessionCall).toBeUndefined();
  });

  it("clears task fields after work session completes", async () => {
    mockGet.mockImplementation(async (key: string | string[]) => {
      const keys = Array.isArray(key) ? key : [key];
      const result: Record<string, unknown> = {};
      if (keys.includes("pomodoroState"))
        result.pomodoroState = mockState({ phase: "work", running: true, startedAt: Date.now(), currentTask: "Feature work" });
      if (keys.includes("settings")) result.settings = DEFAULT_SETTINGS;
      return result;
    });
    await handleAlarm("pomodoro_end");
    const savedState = getSavedPomodoroState();
    expect(savedState.currentTask).toBe("");
    expect(savedState.completedTasks).toEqual([]);
  });

  it("includes all completedTasks and the active task in the session record", async () => {
    const completedTasks = [
      { task: "Task A", startedAt: 1000, completedAt: 2000, timeSpentSeconds: 600 },
    ];
    mockGet.mockImplementation(async (key: string | string[]) => {
      const keys = Array.isArray(key) ? key : [key];
      const result: Record<string, unknown> = {};
      if (keys.includes("pomodoroState"))
        result.pomodoroState = mockState({
          phase: "work",
          running: true,
          startedAt: Date.now(),
          currentTask: "Task B",
          completedTasks,
        });
      if (keys.includes("settings")) result.settings = DEFAULT_SETTINGS;
      return result;
    });
    await handleAlarm("pomodoro_end");
    const sessionCall = mockSet.mock.calls.find(
      (c: unknown[]) => Object.keys(c[0] as object).some((k) => k.startsWith("sessions_"))
    );
    const session = (Object.values(sessionCall![0] as Record<string, PomodoroSession[]>)[0])[0];
    expect(session.tasks).toHaveLength(2);
    expect(session.tasks[0].task).toBe("Task A");
    expect(session.tasks[1].task).toBe("Task B");
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
