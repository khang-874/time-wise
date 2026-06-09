import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerMessageHandler } from "../../background/messageHandler";
import { DEFAULT_POMODORO_STATE, DEFAULT_SETTINGS } from "../../shared/constants";

const mockGet = chrome.storage.local.get as ReturnType<typeof vi.fn>;
const mockSet = chrome.storage.local.set as ReturnType<typeof vi.fn>;
const mockAlarmClear = chrome.alarms.clear as ReturnType<typeof vi.fn>;
const mockAlarmCreate = chrome.alarms.create as ReturnType<typeof vi.fn>;

type MessageListener = (
  request: unknown,
  sender: unknown,
  sendResponse: (r: unknown) => void
) => boolean;

function getRegisteredListener(): MessageListener {
  const calls = (chrome.runtime.onMessage.addListener as ReturnType<typeof vi.fn>).mock.calls;
  return calls[calls.length - 1][0] as MessageListener;
}

function callListener(request: unknown): Promise<unknown> {
  return new Promise((resolve) => {
    const listener = getRegisteredListener();
    listener(request, {}, resolve);
  });
}

beforeEach(() => {
  mockGet.mockImplementation(async (key: string | string[]) => {
    const keys = Array.isArray(key) ? key : [key];
    const result: Record<string, unknown> = {};
    if (keys.includes("pomodoroState")) result.pomodoroState = DEFAULT_POMODORO_STATE;
    if (keys.includes("settings")) result.settings = DEFAULT_SETTINGS;
    return result;
  });
  mockSet.mockResolvedValue(undefined);
  mockAlarmClear.mockResolvedValue(true);
  mockAlarmCreate.mockResolvedValue(undefined);
  registerMessageHandler();
});

describe("registerMessageHandler", () => {
  it("GET_POMODORO_STATE returns pomodoro state", async () => {
    const response = (await callListener({ type: "GET_POMODORO_STATE" })) as { type: string };
    expect(response.type).toBe("POMODORO_STATE");
  });

  it("GET_USAGE returns usage payload", async () => {
    mockGet.mockResolvedValue({ "usage_2024-06-08": { "github.com": 100 } });
    const response = (await callListener({
      type: "GET_USAGE",
      payload: { dateKey: "2024-06-08" },
    })) as { type: string; payload: unknown };
    expect(response.type).toBe("USAGE");
    expect(response.payload).toEqual({ "github.com": 100 });
  });

  it("FLUSH_TIME returns OK", async () => {
    const response = (await callListener({ type: "FLUSH_TIME" })) as { type: string };
    expect(response.type).toBe("OK");
  });

  it("POMODORO_PAUSE returns updated state", async () => {
    const response = (await callListener({ type: "POMODORO_PAUSE" })) as { type: string };
    expect(response.type).toBe("POMODORO_STATE");
  });

  it("POMODORO_RESET returns updated state", async () => {
    const response = (await callListener({ type: "POMODORO_RESET" })) as { type: string };
    expect(response.type).toBe("POMODORO_STATE");
  });

  it("POMODORO_SKIP returns updated state", async () => {
    const response = (await callListener({ type: "POMODORO_SKIP" })) as { type: string };
    expect(response.type).toBe("POMODORO_STATE");
  });

  it("UPDATE_SETTINGS saves settings and returns state", async () => {
    const response = (await callListener({
      type: "UPDATE_SETTINGS",
      payload: DEFAULT_SETTINGS,
    })) as { type: string };
    expect(response.type).toBe("POMODORO_STATE");
    expect(mockSet).toHaveBeenCalledWith({ settings: DEFAULT_SETTINGS });
  });
});
