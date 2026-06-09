/**
 * @file Single boundary for all `chrome.storage.local` access.
 *
 * No other file in the codebase calls `chrome.storage.local` directly.
 * Centralising I/O here means tests only need to mock this one module,
 * and a future migration to IndexedDB is a single-file change.
 */

import type { DailyUsage, PomodoroSettings, PomodoroState } from "./types";
import {
  DEFAULT_POMODORO_STATE,
  DEFAULT_SETTINGS,
  STORAGE_KEY_POMODORO,
  STORAGE_KEY_SETTINGS,
  STORAGE_KEY_USAGE_PREFIX,
} from "./constants";
import { getLast7Days } from "./timeUtils";

function usageKey(dateKey: string): string {
  return `${STORAGE_KEY_USAGE_PREFIX}${dateKey}`;
}

/**
 * Returns the time usage record for a single day.
 *
 * @param dateKey - ISO date string in `YYYY-MM-DD` format.
 * @returns An empty object when no data exists for that day.
 */
export async function getUsage(dateKey: string): Promise<DailyUsage> {
  const key = usageKey(dateKey);
  const result = await chrome.storage.local.get(key);
  return (result[key] as DailyUsage) ?? {};
}

/**
 * Overwrites the entire usage record for a single day.
 *
 * @param dateKey - ISO date string in `YYYY-MM-DD` format.
 * @param usage - Full hostname-to-seconds map to persist.
 */
export async function setUsage(
  dateKey: string,
  usage: DailyUsage
): Promise<void> {
  await chrome.storage.local.set({ [usageKey(dateKey)]: usage });
}

/**
 * Adds seconds to a hostname's total for the given day without overwriting other entries.
 *
 * @param dateKey - ISO date string in `YYYY-MM-DD` format.
 * @param host - Bare hostname (e.g. `"github.com"`).
 * @param seconds - Non-negative integer seconds to add.
 */
export async function addSeconds(
  dateKey: string,
  host: string,
  seconds: number
): Promise<void> {
  const usage = await getUsage(dateKey);
  usage[host] = (usage[host] ?? 0) + seconds;
  await setUsage(dateKey, usage);
}

/**
 * Returns usage data for the last 7 days in a single storage read.
 *
 * @returns Object keyed by `YYYY-MM-DD` date strings, oldest first.
 *   Days with no recorded data have an empty `DailyUsage` object.
 */
export async function getWeekUsage(): Promise<Record<string, DailyUsage>> {
  const days = getLast7Days();
  const keys = days.map(usageKey);
  const result = await chrome.storage.local.get(keys);
  const out: Record<string, DailyUsage> = {};
  for (const day of days) {
    out[day] = (result[usageKey(day)] as DailyUsage) ?? {};
  }
  return out;
}

/**
 * Deletes all usage data for a specific day.
 *
 * @param dateKey - ISO date string in `YYYY-MM-DD` format.
 */
export async function clearDay(dateKey: string): Promise<void> {
  await chrome.storage.local.remove(usageKey(dateKey));
}

/**
 * Returns the current Pomodoro state, falling back to {@link DEFAULT_POMODORO_STATE}
 * on first run or after storage is cleared.
 */
export async function getPomodoroState(): Promise<PomodoroState> {
  const result = await chrome.storage.local.get(STORAGE_KEY_POMODORO);
  return (result[STORAGE_KEY_POMODORO] as PomodoroState) ?? DEFAULT_POMODORO_STATE;
}

/** Persists the full Pomodoro state. Callers are responsible for computing the correct state. */
export async function setPomodoroState(state: PomodoroState): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY_POMODORO]: state });
}

/**
 * Returns current settings, merging stored values over {@link DEFAULT_SETTINGS}.
 * Partial saves are safe — any missing key falls back to the default.
 */
export async function getSettings(): Promise<PomodoroSettings> {
  const result = await chrome.storage.local.get(STORAGE_KEY_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...(result[STORAGE_KEY_SETTINGS] as Partial<PomodoroSettings>) };
}

/** Persists the full settings object. */
export async function setSettings(settings: PomodoroSettings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY_SETTINGS]: settings });
}
