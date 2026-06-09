/**
 * @file Tracks how long the user spends on each website domain.
 *
 * @remarks
 * State is kept in module-level variables because the service worker is the
 * only context that touches them. All durable data is flushed to
 * `chrome.storage.local` via {@link flushTime} so nothing is lost when
 * Chrome suspends the service worker.
 */

import { addSeconds } from "../shared/storage";
import { toDateKey } from "../shared/timeUtils";

let activeTabId: number | null = null;
let sessionStart: number | null = null;
let currentHost: string | null = null;
let isWindowFocused = true;

/**
 * Extracts the bare hostname from a URL string.
 *
 * @returns The hostname (e.g. `"github.com"`), or `null` for invalid URLs,
 *   empty hostnames, and internal Chrome pages (`chrome://`, `chrome-extension://`).
 */
export function getHost(url: string): string | null {
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol === "chrome:" || protocol === "chrome-extension:") return null;
    return hostname || null;
  } catch {
    return null;
  }
}

/**
 * Writes elapsed seconds for the current session to storage.
 *
 * @remarks
 * No-op when the window is unfocused, there is no active host, or the session
 * just started (elapsed ≤ 0). Does NOT reset `sessionStart` — callers that
 * want to continue the same session must reset it themselves.
 */
export async function flushTime(): Promise<void> {
  if (!currentHost || !sessionStart || !isWindowFocused) return;

  const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
  if (elapsed <= 0) return;

  const today = toDateKey(new Date());
  await addSeconds(today, currentHost, elapsed);
}

/**
 * Flushes the previous session and begins tracking a new tab/URL.
 *
 * @param tabId - The Chrome tab ID to track.
 * @param url - Full URL of the page; non-trackable URLs (chrome://, invalid) result in a null host.
 */
export async function startTracking(tabId: number, url: string): Promise<void> {
  await flushTime();
  activeTabId = tabId;
  currentHost = getHost(url);
  sessionStart = currentHost ? Date.now() : null;
}

/**
 * Handles `chrome.tabs.onActivated` — resolves the tab URL then delegates to {@link startTracking}.
 *
 * @param tabId - ID of the newly active tab.
 */
export async function handleTabActivated(tabId: number): Promise<void> {
  const tab = await chrome.tabs.get(tabId);
  await startTracking(tabId, tab.url ?? "");
}

/**
 * Handles `chrome.tabs.onUpdated` — only acts when the active tab finishes navigating to a new URL.
 *
 * @param tabId - The tab that was updated.
 * @param changeInfo - Chrome change info object; only `status === "complete"` is acted on.
 * @param tab - Full tab object providing the new URL.
 */
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

/**
 * Handles `chrome.windows.onFocusChanged`.
 *
 * @remarks
 * `chrome.windows.WINDOW_ID_NONE` means all Chrome windows lost focus (e.g.
 * user switched to another app). In that case the current session is flushed
 * and paused. When focus returns, tracking resumes from the newly active tab.
 *
 * @param windowId - The focused window's ID, or `chrome.windows.WINDOW_ID_NONE`.
 */
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
      // window may have closed between the event firing and the query
    }
  }
}

/**
 * Handles `chrome.idle.onStateChanged`.
 *
 * @remarks
 * Flushes and pauses on `"idle"` or `"locked"` to avoid crediting AFK time.
 * Resumes on `"active"` only if there is a known current host.
 *
 * @param state - The new idle state reported by Chrome.
 */
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

/**
 * Handles `chrome.tabs.onRemoved` for the active tab.
 * Flushes the session and clears all tracking state.
 *
 * @param tabId - The ID of the closed tab.
 */
export async function handleTabRemoved(tabId: number): Promise<void> {
  if (tabId !== activeTabId) return;
  await flushTime();
  activeTabId = null;
  currentHost = null;
  sessionStart = null;
}

/**
 * Handles the periodic `"flush"` alarm (fires every minute).
 *
 * @remarks
 * Flushes elapsed time then resets `sessionStart` to prevent double-counting
 * the same seconds on the next flush.
 */
export async function handleFlushAlarm(): Promise<void> {
  await flushTime();
  if (currentHost && isWindowFocused) {
    sessionStart = Date.now();
  }
}

/** @internal Returns a snapshot of module state for use in tests. */
export function _getState() {
  return { activeTabId, sessionStart, currentHost, isWindowFocused };
}

/** @internal Resets all module state to initial values for test isolation. */
export function _resetState() {
  activeTabId = null;
  sessionStart = null;
  currentHost = null;
  isWindowFocused = true;
}
