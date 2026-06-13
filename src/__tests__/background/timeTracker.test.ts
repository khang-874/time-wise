import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getHost,
  flushTime,
  startTracking,
  handleTabActivated,
  handleTabUpdated,
  handleFocusChanged,
  handleIdle,
  handleTabRemoved,
  handleFlushAlarm,
  _resetState,
  _getState,
} from "../../background/timeTracker";
import { STORAGE_KEY_TRACKER } from "../../shared/constants";
import type { TrackerState } from "../../shared/types";

const mockGet = chrome.storage.local.get as ReturnType<typeof vi.fn>;
const mockSet = chrome.storage.local.set as ReturnType<typeof vi.fn>;

beforeEach(() => {
  _resetState();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2024-06-08T10:00:00.000Z"));
  mockGet.mockResolvedValue({});
  mockSet.mockResolvedValue(undefined);
});

describe("getHost", () => {
  it("extracts hostname from https URL", () => {
    expect(getHost("https://github.com/user/repo")).toBe("github.com");
  });

  it("returns null for chrome:// URLs", () => {
    expect(getHost("chrome://extensions")).toBeNull();
  });

  it("returns null for chrome-extension:// URLs", () => {
    expect(getHost("chrome-extension://abc123/popup.html")).toBeNull();
  });

  it("returns null for invalid URLs", () => {
    expect(getHost("not-a-url")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(getHost("")).toBeNull();
  });
});

describe("flushTime", () => {
  it("does nothing when currentHost is null", async () => {
    await flushTime();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("does nothing when window is not focused", async () => {
    await startTracking(1, "https://github.com");
    await handleIdle("idle"); // unfocus
    mockSet.mockClear();
    await flushTime();
    // Set may have been called during startTracking/handleIdle, not after
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("writes accumulated seconds for active session", async () => {
    await startTracking(1, "https://github.com");
    vi.advanceTimersByTime(30000); // 30 seconds
    await flushTime();
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        "usage_2024-06-08": expect.objectContaining({ "github.com": 30 }),
      })
    );
  });

  it("does nothing when elapsed is 0", async () => {
    await startTracking(1, "https://github.com");
    // No time passes
    mockSet.mockClear();
    await flushTime();
    expect(mockSet).not.toHaveBeenCalled();
  });
});

describe("startTracking", () => {
  it("flushes previous session before starting new one", async () => {
    const mockTab = { url: "https://github.com" };
    (chrome.tabs.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockTab);

    await startTracking(1, "https://github.com");
    vi.advanceTimersByTime(10000);

    await startTracking(2, "https://youtube.com");

    // Should have flushed github.com seconds
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        "usage_2024-06-08": expect.objectContaining({ "github.com": 10 }),
      })
    );
  });

  it("sets null host for chrome:// URLs", async () => {
    await startTracking(1, "chrome://extensions");
    const state = _getState();
    expect(state.currentHost).toBeNull();
    expect(state.sessionStart).toBeNull();
  });

  it("sets host and sessionStart for valid URL", async () => {
    await startTracking(1, "https://github.com");
    const state = _getState();
    expect(state.currentHost).toBe("github.com");
    expect(state.sessionStart).not.toBeNull();
  });
});

describe("handleIdle", () => {
  it("stops session on idle without losing data", async () => {
    await startTracking(1, "https://github.com");
    vi.advanceTimersByTime(15000);
    await handleIdle("idle");

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        "usage_2024-06-08": expect.objectContaining({ "github.com": 15 }),
      })
    );
    expect(_getState().sessionStart).toBeNull();
  });

  it("stops session on locked", async () => {
    await startTracking(1, "https://github.com");
    vi.advanceTimersByTime(5000);
    await handleIdle("locked");

    expect(mockSet).toHaveBeenCalled();
    expect(_getState().sessionStart).toBeNull();
  });

  it("resumes session on active when host is set", async () => {
    await startTracking(1, "https://github.com");
    await handleIdle("idle");
    const before = _getState().sessionStart;
    expect(before).toBeNull();

    await handleIdle("active");
    expect(_getState().sessionStart).not.toBeNull();
  });

  it("does not resume session on active when window is unfocused", async () => {
    // Start tracking while window is focused
    await startTracking(1, "https://github.com");
    vi.advanceTimersByTime(10000);

    // Window loses focus
    await handleFocusChanged(chrome.windows.WINDOW_ID_NONE);
    mockSet.mockClear();

    // System goes idle (while window is still unfocused)
    await handleIdle("idle");

    // System comes back active (but window still unfocused)
    await handleIdle("active");

    // Should NOT resume tracking because window is unfocused
    // (we shouldn't have any new tracking time)
    const stateAfterIdle = _getState();
    expect(stateAfterIdle.isWindowFocused).toBe(false);
    expect(stateAfterIdle.sessionStart).toBeNull();
  });
});

describe("handleFlushAlarm", () => {
  it("flushes and resets sessionStart", async () => {
    await startTracking(1, "https://github.com");
    vi.advanceTimersByTime(60000);
    await handleFlushAlarm();

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        "usage_2024-06-08": expect.objectContaining({ "github.com": 60 }),
      })
    );
    const state = _getState();
    expect(state.sessionStart).not.toBeNull();
  });
});

describe("handleTabActivated", () => {
  it("calls startTracking with the tab URL", async () => {
    (chrome.tabs.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      url: "https://github.com",
    });
    await handleTabActivated(42);
    expect(_getState().currentHost).toBe("github.com");
  });

  it("handles tab with no URL", async () => {
    (chrome.tabs.get as ReturnType<typeof vi.fn>).mockResolvedValue({ url: undefined });
    await handleTabActivated(42);
    expect(_getState().currentHost).toBeNull();
  });
});

describe("handleTabUpdated", () => {
  it("ignores updates for inactive tab", async () => {
    await startTracking(1, "https://github.com");
    await handleTabUpdated(99, { status: "complete" }, { url: "https://other.com" } as chrome.tabs.Tab);
    expect(_getState().currentHost).toBe("github.com");
  });

  it("updates tracking when active tab completes navigation", async () => {
    await startTracking(1, "https://github.com");
    await handleTabUpdated(1, { status: "complete" }, { url: "https://youtube.com" } as chrome.tabs.Tab);
    expect(_getState().currentHost).toBe("youtube.com");
  });

  it("ignores non-complete status changes", async () => {
    await startTracking(1, "https://github.com");
    await handleTabUpdated(1, { status: "loading" }, { url: "https://youtube.com" } as chrome.tabs.Tab);
    expect(_getState().currentHost).toBe("github.com");
  });
});

describe("handleFocusChanged", () => {
  it("marks window as unfocused when WINDOW_ID_NONE", async () => {
    await startTracking(1, "https://github.com");
    vi.advanceTimersByTime(5000);
    await handleFocusChanged(chrome.windows.WINDOW_ID_NONE);
    expect(_getState().isWindowFocused).toBe(false);
    expect(_getState().sessionStart).toBeNull();
  });

  it("resumes tracking when window regains focus", async () => {
    (chrome.tabs.query as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 1, url: "https://github.com" },
    ]);
    await handleFocusChanged(1);
    expect(_getState().isWindowFocused).toBe(true);
    expect(_getState().currentHost).toBe("github.com");
  });

  it("flushes previous session when window regains focus on a different tab", async () => {
    // Start tracking on tab 1
    await startTracking(1, "https://github.com");
    vi.advanceTimersByTime(10000);

    // Window is still focused but we'll simulate switching tabs while refocusing
    // (This is an edge case where the tab switched before the focus event fired)
    mockSet.mockClear();

    (chrome.tabs.query as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 2, url: "https://youtube.com" },
    ]);
    await handleFocusChanged(1); // Regain focus, but now active tab is 2

    // Should have flushed github.com (10 seconds) before switching to youtube.com
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        "usage_2024-06-08": expect.objectContaining({ "github.com": 10 }),
      })
    );
    expect(_getState().currentHost).toBe("youtube.com");
  });
});

describe("handleTabRemoved", () => {
  it("flushes and clears state when active tab is removed", async () => {
    await startTracking(1, "https://github.com");
    vi.advanceTimersByTime(10000);
    await handleTabRemoved(1);

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        "usage_2024-06-08": expect.objectContaining({ "github.com": 10 }),
      })
    );
    const state = _getState();
    expect(state.currentHost).toBeNull();
    expect(state.sessionStart).toBeNull();
  });

  it("ignores removal of inactive tab", async () => {
    await startTracking(1, "https://github.com");
    mockSet.mockClear();
    await handleTabRemoved(99);
    expect(mockSet).not.toHaveBeenCalled();
  });
});

describe("service worker suspension recovery", () => {
  /**
   * Simulates Chrome suspending and restarting the service worker.
   * All module-level variables are wiped (via _resetState), and
   * chrome.storage.local.get is set up to return the given persisted state.
   */
  function simulateSWRestart(saved: TrackerState) {
    _resetState();
    mockGet.mockImplementation((keys: string | string[]) => {
      const keyArr = Array.isArray(keys) ? keys : [keys];
      const result: Record<string, unknown> = {};
      for (const k of keyArr) {
        if (k === STORAGE_KEY_TRACKER) result[k] = saved;
      }
      return Promise.resolve(result);
    });
  }

  it("flush alarm recovers state and saves elapsed time after SW restart", async () => {
    // 1. Start tracking github.com
    await startTracking(1, "https://github.com");
    const sessionStartTime = Date.now();

    // 2. Advance 90 seconds — SW would normally flush at 60s, but let's
    //    simulate that Chrome suspended the SW instead
    vi.advanceTimersByTime(90_000);

    // 3. SW is killed — all module state gone
    simulateSWRestart({
      activeTabId: 1,
      currentHost: "github.com",
      sessionStart: sessionStartTime,
      isWindowFocused: true,
      isIdle: false,
    });

    // 4. Flush alarm fires, waking the SW
    await handleFlushAlarm();

    // 5. The 90 seconds of reading on github.com should be flushed
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        "usage_2024-06-08": expect.objectContaining({ "github.com": 90 }),
      })
    );
  });

  it("tab switch after SW restart flushes time for the previous host", async () => {
    await startTracking(1, "https://d2l.ai");
    const sessionStartTime = Date.now();

    vi.advanceTimersByTime(120_000);

    simulateSWRestart({
      activeTabId: 1,
      currentHost: "d2l.ai",
      sessionStart: sessionStartTime,
      isWindowFocused: true,
      isIdle: false,
    });

    // User switches to a different tab, waking the SW
    (chrome.tabs.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      url: "https://youtube.com",
    });
    await handleTabActivated(2);

    // d2l.ai should have 120 seconds flushed
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        "usage_2024-06-08": expect.objectContaining({ "d2l.ai": 120 }),
      })
    );
    // Now tracking youtube.com
    expect(_getState().currentHost).toBe("youtube.com");
  });

  it("multiple SW restarts accumulate time correctly", async () => {
    // First session: 60 seconds on github.com
    await startTracking(1, "https://github.com");
    vi.advanceTimersByTime(60_000);
    await handleFlushAlarm(); // flushes 60s, resets sessionStart

    const sessionStartAfterFlush = Date.now();
    vi.advanceTimersByTime(45_000);

    // SW restart — 45 seconds elapsed since last flush
    simulateSWRestart({
      activeTabId: 1,
      currentHost: "github.com",
      sessionStart: sessionStartAfterFlush,
      isWindowFocused: true,
      isIdle: false,
    });

    // mockGet needs to return existing usage for the addSeconds read
    mockGet.mockImplementation((keys: string | string[]) => {
      const keyArr = Array.isArray(keys) ? keys : [keys];
      const result: Record<string, unknown> = {};
      for (const k of keyArr) {
        if (k === STORAGE_KEY_TRACKER) {
          result[k] = {
            activeTabId: 1,
            currentHost: "github.com",
            sessionStart: sessionStartAfterFlush,
            isWindowFocused: true,
            isIdle: false,
          };
        } else if (k === "usage_2024-06-08") {
          result[k] = { "github.com": 60 }; // from earlier flush
        }
      }
      return Promise.resolve(result);
    });

    await handleFlushAlarm();

    // Should add 45s to existing 60s = 105s total
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        "usage_2024-06-08": expect.objectContaining({ "github.com": 105 }),
      })
    );
  });

  it("SW restart with unfocused window does not credit time", async () => {
    simulateSWRestart({
      activeTabId: 1,
      currentHost: "github.com",
      sessionStart: null,
      isWindowFocused: false,
      isIdle: false,
    });

    mockSet.mockClear();
    await handleFlushAlarm();

    // No usage data should be written — only tracker state persist
    const usageCalls = mockSet.mock.calls.filter(
      (call: unknown[]) => Object.keys(call[0] as Record<string, unknown>)[0]?.startsWith("usage_")
    );
    expect(usageCalls).toHaveLength(0);
  });

  it("handleTabUpdated restores activeTabId from storage to match correct tab", async () => {
    await startTracking(1, "https://github.com");
    const sessionStartTime = Date.now();
    vi.advanceTimersByTime(20_000);

    simulateSWRestart({
      activeTabId: 1,
      currentHost: "github.com",
      sessionStart: sessionStartTime,
      isWindowFocused: true,
      isIdle: false,
    });

    // Tab 1 finishes navigating to a new URL
    await handleTabUpdated(
      1,
      { status: "complete" },
      { url: "https://youtube.com" } as chrome.tabs.Tab
    );

    // Should flush 20s for github.com
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        "usage_2024-06-08": expect.objectContaining({ "github.com": 20 }),
      })
    );
    expect(_getState().currentHost).toBe("youtube.com");
  });

  it("handleTabRemoved restores activeTabId so it can match the removed tab", async () => {
    await startTracking(1, "https://github.com");
    const sessionStartTime = Date.now();
    vi.advanceTimersByTime(30_000);

    simulateSWRestart({
      activeTabId: 1,
      currentHost: "github.com",
      sessionStart: sessionStartTime,
      isWindowFocused: true,
      isIdle: false,
    });

    await handleTabRemoved(1);

    // Should flush 30s for github.com
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        "usage_2024-06-08": expect.objectContaining({ "github.com": 30 }),
      })
    );
    expect(_getState().currentHost).toBeNull();
    expect(_getState().sessionStart).toBeNull();
  });
});
