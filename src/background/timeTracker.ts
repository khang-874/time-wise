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
let isLocked = false;
let stateLoaded = false;

// Flush alarm fires every minute; a gap longer than this means the SW was dead.
const STALE_SESSION_MS = 2 * 60 * 1000;

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
  isLocked = saved.isLocked;

  // If the SW was dead longer than the flush-alarm interval (browser closed,
  // machine slept), the entire session context is stale — discard it so the
  // flush alarm can't start tracking the wrong host and Chrome's tab ID reuse
  // can't match a different tab.
  const gap = saved.lastPersistedAt
    ? Date.now() - saved.lastPersistedAt
    : Infinity;
  if (gap > STALE_SESSION_MS) {
    activeTabId = null;
    currentHost = null;
    sessionStart = null;
  }
}

/** Persists the current in-memory state to storage. */
async function persistState(): Promise<void> {
  await setTrackerState({
    activeTabId,
    currentHost,
    sessionStart,
    isLocked,
    lastPersistedAt: Date.now(),
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
export async function flushTime(resetTimer: boolean): Promise<void> {
  await loadState();
  if (!currentHost) return;

  if (sessionStart) {
    const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
    await addSeconds(toDateKey(new Date()), currentHost, elapsed);
  }

  if (!resetTimer || isLocked) return;
  sessionStart = Date.now();
  await persistState();
}

/**
 * Flushes the previous session and switches the tracking target.
 *
 * @param tabId - The tab to track, or `null` to stop tracking entirely.
 * @param url - Full URL of the page, or `null` to stop tracking. Non-trackable URLs
 *   (chrome://, invalid) result in a null host and no active session.
 */
export async function trackTime(
  tabId: number | null,
  url: string | null,
): Promise<void> {
  await flushTime(false);
  activeTabId = tabId;
  currentHost = url ? getHost(url) : null;
  sessionStart = currentHost ? Date.now() : null;
  await persistState();
}

/**
 * Handles `chrome.tabs.onActivated` — resolves the tab URL then delegates to {@link trackTime}.
 *
 * @param tabId - ID of the newly active tab.
 */
export async function handleTabActivated(tabId: number): Promise<void> {
  const tab = await chrome.tabs.get(tabId);
  await trackTime(tabId, tab.url ?? "");
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
    await trackTime(tabId, tab.url);
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
    await flushTime(false);
    sessionStart = null;
    isLocked = true;
    await persistState();
  } else if (state === "active") {
    await loadState();
    isLocked = false;
    if (currentHost) {
      sessionStart = Date.now();
    }
    await persistState();
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
  await trackTime(null, null);
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
  return { activeTabId, sessionStart, currentHost, isLocked };
}

/** @internal Resets all module state to initial values for test isolation. */
export function _resetState() {
  activeTabId = null;
  currentHost = null;
  sessionStart = null;
  isLocked = false;
  stateLoaded = false;
}
