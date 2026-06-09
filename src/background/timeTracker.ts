import { addSeconds } from "../shared/storage";
import { toDateKey } from "../shared/timeUtils";

let activeTabId: number | null = null;
let sessionStart: number | null = null;
let currentHost: string | null = null;
let isWindowFocused = true;

export function getHost(url: string): string | null {
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol === "chrome:" || protocol === "chrome-extension:") return null;
    return hostname || null;
  } catch {
    return null;
  }
}

export async function flushTime(): Promise<void> {
  if (!currentHost || !sessionStart || !isWindowFocused) return;

  const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
  if (elapsed <= 0) return;

  const today = toDateKey(new Date());
  await addSeconds(today, currentHost, elapsed);
}

export async function startTracking(tabId: number, url: string): Promise<void> {
  await flushTime();
  activeTabId = tabId;
  currentHost = getHost(url);
  sessionStart = currentHost ? Date.now() : null;
}

export async function handleTabActivated(tabId: number): Promise<void> {
  const tab = await chrome.tabs.get(tabId);
  await startTracking(tabId, tab.url ?? "");
}

export async function handleTabUpdated(
  tabId: number,
  changeInfo: chrome.tabs.TabChangeInfo,
  tab: chrome.tabs.Tab
): Promise<void> {
  if (tabId !== activeTabId) return;
  if (changeInfo.status === "complete" && tab.url) {
    await startTracking(tabId, tab.url);
  }
}

export async function handleFocusChanged(windowId: number): Promise<void> {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    await flushTime();
    isWindowFocused = false;
    sessionStart = null;
  } else {
    isWindowFocused = true;
    try {
      const [tab] = await chrome.tabs.query({ active: true, windowId });
      if (tab && tab.id != null) {
        activeTabId = tab.id;
        currentHost = getHost(tab.url ?? "");
        sessionStart = currentHost ? Date.now() : null;
      }
    } catch {
      // window may have closed
    }
  }
}

export async function handleIdle(state: chrome.idle.IdleState): Promise<void> {
  if (state === "idle" || state === "locked") {
    await flushTime();
    sessionStart = null;
  } else if (state === "active") {
    if (currentHost) {
      sessionStart = Date.now();
    }
  }
}

export async function handleTabRemoved(tabId: number): Promise<void> {
  if (tabId !== activeTabId) return;
  await flushTime();
  activeTabId = null;
  currentHost = null;
  sessionStart = null;
}

export async function handleFlushAlarm(): Promise<void> {
  await flushTime();
  if (currentHost && isWindowFocused) {
    sessionStart = Date.now();
  }
}

// Exposed for testing
export function _getState() {
  return { activeTabId, sessionStart, currentHost, isWindowFocused };
}

export function _resetState() {
  activeTabId = null;
  sessionStart = null;
  currentHost = null;
  isWindowFocused = true;
}
