import { describe, it, expect, vi } from "vitest";
import {
  getUsage,
  setUsage,
  addSeconds,
  getWeekUsage,
  clearDay,
  getPomodoroState,
  setPomodoroState,
  getSettings,
  setSettings,
} from "../../shared/storage";
import { DEFAULT_POMODORO_STATE, DEFAULT_SETTINGS } from "../../shared/constants";

const mockGet = chrome.storage.local.get as ReturnType<typeof vi.fn>;
const mockSet = chrome.storage.local.set as ReturnType<typeof vi.fn>;
const mockRemove = chrome.storage.local.remove as ReturnType<typeof vi.fn>;

describe("getUsage", () => {
  it("returns existing usage for a date", async () => {
    mockGet.mockResolvedValue({ "usage_2024-06-08": { "github.com": 300 } });
    const result = await getUsage("2024-06-08");
    expect(result).toEqual({ "github.com": 300 });
  });

  it("returns empty object when no data exists", async () => {
    mockGet.mockResolvedValue({});
    const result = await getUsage("2024-06-08");
    expect(result).toEqual({});
  });
});

describe("setUsage", () => {
  it("writes with the correct key", async () => {
    mockSet.mockResolvedValue(undefined);
    await setUsage("2024-06-08", { "github.com": 100 });
    expect(mockSet).toHaveBeenCalledWith({
      "usage_2024-06-08": { "github.com": 100 },
    });
  });
});

describe("addSeconds", () => {
  it("adds to an existing host", async () => {
    mockGet.mockResolvedValue({ "usage_2024-06-08": { "github.com": 200 } });
    mockSet.mockResolvedValue(undefined);
    await addSeconds("2024-06-08", "github.com", 100);
    expect(mockSet).toHaveBeenCalledWith({
      "usage_2024-06-08": { "github.com": 300 },
    });
  });

  it("creates a new host entry without overwriting others", async () => {
    mockGet.mockResolvedValue({
      "usage_2024-06-08": { "github.com": 200 },
    });
    mockSet.mockResolvedValue(undefined);
    await addSeconds("2024-06-08", "youtube.com", 50);
    expect(mockSet).toHaveBeenCalledWith({
      "usage_2024-06-08": { "github.com": 200, "youtube.com": 50 },
    });
  });

  it("creates new day key when none exists", async () => {
    mockGet.mockResolvedValue({});
    mockSet.mockResolvedValue(undefined);
    await addSeconds("2024-06-08", "github.com", 60);
    expect(mockSet).toHaveBeenCalledWith({
      "usage_2024-06-08": { "github.com": 60 },
    });
  });

  it("does nothing when seconds is zero", async () => {
    mockSet.mockResolvedValue(undefined);
    await addSeconds("2024-06-08", "github.com", 0);
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("does nothing when seconds is negative", async () => {
    mockSet.mockResolvedValue(undefined);
    await addSeconds("2024-06-08", "github.com", -5);
    expect(mockSet).not.toHaveBeenCalled();
  });
});

describe("getWeekUsage", () => {
  it("fetches exactly 7 keys", async () => {
    mockGet.mockResolvedValue({});
    await getWeekUsage();
    const calledKeys = mockGet.mock.calls[0][0] as string[];
    expect(calledKeys).toHaveLength(7);
    expect(calledKeys.every((k) => k.startsWith("usage_"))).toBe(true);
  });

  it("returns empty objects for missing days", async () => {
    mockGet.mockResolvedValue({});
    const result = await getWeekUsage();
    const values = Object.values(result);
    expect(values.every((v) => Object.keys(v).length === 0)).toBe(true);
  });
});

describe("clearDay", () => {
  it("removes only the specified day key", async () => {
    mockRemove.mockResolvedValue(undefined);
    await clearDay("2024-06-08");
    expect(mockRemove).toHaveBeenCalledWith("usage_2024-06-08");
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });
});

describe("getPomodoroState", () => {
  it("returns stored state", async () => {
    const state = { ...DEFAULT_POMODORO_STATE, running: true };
    mockGet.mockResolvedValue({ pomodoroState: state });
    const result = await getPomodoroState();
    expect(result).toEqual(state);
  });

  it("returns default state when none stored", async () => {
    mockGet.mockResolvedValue({});
    const result = await getPomodoroState();
    expect(result).toEqual(DEFAULT_POMODORO_STATE);
  });
});

describe("setPomodoroState", () => {
  it("writes state to storage", async () => {
    mockSet.mockResolvedValue(undefined);
    const state = { ...DEFAULT_POMODORO_STATE };
    await setPomodoroState(state);
    expect(mockSet).toHaveBeenCalledWith({ pomodoroState: state });
  });
});

describe("getSettings", () => {
  it("merges stored settings with defaults", async () => {
    mockGet.mockResolvedValue({ settings: { workMinutes: 30 } });
    const result = await getSettings();
    expect(result.workMinutes).toBe(30);
    expect(result.shortBreakMinutes).toBe(DEFAULT_SETTINGS.shortBreakMinutes);
  });

  it("returns defaults when nothing stored", async () => {
    mockGet.mockResolvedValue({});
    const result = await getSettings();
    expect(result).toEqual(DEFAULT_SETTINGS);
  });
});

describe("setSettings", () => {
  it("writes settings to storage", async () => {
    mockSet.mockResolvedValue(undefined);
    await setSettings(DEFAULT_SETTINGS);
    expect(mockSet).toHaveBeenCalledWith({ settings: DEFAULT_SETTINGS });
  });
});
