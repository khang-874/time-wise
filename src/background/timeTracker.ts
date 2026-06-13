/**
 * @file Tracks how long the user spends on each website domain.
 *
 * @remarks
 * State is kept in module-level variables because the service worker is the
 * only context that touches them. All durable data is flushed to
 * `chrome.storage.local` via {@link flushTime} so nothing is lost when
 * Chrome suspends the service worker.
 */

import {
  addSeconds,
  getTrackerState,
  setTrackerState,
} from "../shared/storage";
import { toDateKey } from "../shared/timeUtils";

let activeTabId: number | null = null;
let sessionStart: number | null = null;
let currentHost: string | null = null;
let isWindowFocused = true;
let isLocked = false;
let stateLoaded = false;

/**
 * Restores in-memory tracker state from storage after SW restart.
 * No-op if state has already been loaded in this SW lifetime.
 */
async function loadState(): Promise<void> {
  if (stateLoaded) return;
  stateLoaded = true;
  const saved = await getTrackerState();
  activeTabId = saved.activeTabId;
  currentHost = saved.currentHost;
  sessionStart = saved.sessionStart;
  isWindowFocused = saved.isWindowFocused;
  isLocked = saved.isLocked;
}

/** Persists the current in-memory state to storage. */
async function persistState(): Promise<void> {
  await setTrackerState({
    activeTabId,
    currentHost,
    sessionStart,
    isWindowFocused,
    isLocked,
  });
}

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
 * @param resetTimer - When `true`, slides `sessionStart` forward to now after flushing
 *   so the next flush only counts new elapsed time. Also starts a fresh session if
 *   there was none (e.g. resuming after screen unlock). No-op when the screen is locked.
 *   When `false` (default), `sessionStart` is left for the caller to update or clear.
 *
 * @remarks
 * No-op when the window is unfocused or there is no active host.
 */
export async function flushTime(resetTimer = false): Promise<void> {
  await loadState();
  if (!currentHost || !isWindowFocused) return;

  if (sessionStart) {
    const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
    await addSeconds(toDateKey(new Date()), currentHost, elapsed);
  }

  if (!resetTimer || isLocked) return;
  sessionStart = Date.now();
  await persistState();
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
  await persistState();
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
  tab: chrome.tabs.Tab,
): Promise<void> {
  await loadState();
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
    await persistState();
  } else {
    isWindowFocused = true;
    try {
      const [tab] = await chrome.tabs.query({ active: true, windowId });
      if (tab && tab.id != null && tab.url) {
        await startTracking(tab.id, tab.url);
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
 * Only reacts to `"locked"` (screen lock) and `"active"` (unlock). The `"idle"`
 * state (no mouse movement) is intentionally ignored so that passive consumption
 * like watching a video is still tracked.
 *
 * @param state - The new idle state reported by Chrome.
 */
export async function handleIdle(state: chrome.idle.IdleState): Promise<void> {
  if (state === "locked") {
    await flushTime();
    sessionStart = null;
    isLocked = true;
    await persistState();
  } else if (state === "active") {
    isLocked = false;
    await flushTime(true);
  }
}

/**
 * Handles `chrome.tabs.onRemoved` for the active tab.
 * Flushes the session and clears all tracking state.
 *
 * @param tabId - The ID of the closed tab.
 */
export async function handleTabRemoved(tabId: number): Promise<void> {
  await loadState();
  if (tabId !== activeTabId) return;
  await flushTime();
  activeTabId = null;
  currentHost = null;
  sessionStart = null;
  await persistState();
}

/**
 * Handles the periodic `"flush"` alarm (fires every minute).
 *
 * @remarks
 * Flushes elapsed time then resets `sessionStart` to prevent double-counting
 * the same seconds on the next flush. Does NOT restart a session that was
 * paused by idle or window blur — only continues an already-active session.
 */
export async function handleFlushAlarm(): Promise<void> {
  await flushTime(true);
}

/** @internal Returns a snapshot of module state for use in tests. */
export function _getState() {
  return { activeTabId, sessionStart, currentHost, isWindowFocused, isLocked };
}

/** @internal Resets all module state to initial values for test isolation. */
export function _resetState() {
  activeTabId = null;
  sessionStart = null;
  currentHost = null;
  isWindowFocused = true;
  isLocked = false;
  stateLoaded = false;
}
