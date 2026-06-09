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
