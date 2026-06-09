import type { DailyUsage, PomodoroSettings, PomodoroState } from "./types";
import {
  DEFAULT_POMODORO_STATE,
  DEFAULT_SETTINGS,
  STORAGE_KEY_POMODORO,
  STORAGE_KEY_SETTINGS,
  STORAGE_KEY_USAGE_PREFIX,
} from "./constants";
import { getLast7Days, toDateKey } from "./timeUtils";

function usageKey(dateKey: string): string {
  return `${STORAGE_KEY_USAGE_PREFIX}${dateKey}`;
}

export async function getUsage(dateKey: string): Promise<DailyUsage> {
  const key = usageKey(dateKey);
  const result = await chrome.storage.local.get(key);
  return (result[key] as DailyUsage) ?? {};
}

export async function setUsage(
  dateKey: string,
  usage: DailyUsage
): Promise<void> {
  await chrome.storage.local.set({ [usageKey(dateKey)]: usage });
}

export async function addSeconds(
  dateKey: string,
  host: string,
  seconds: number
): Promise<void> {
  const usage = await getUsage(dateKey);
  usage[host] = (usage[host] ?? 0) + seconds;
  await setUsage(dateKey, usage);
}

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

export async function clearDay(dateKey: string): Promise<void> {
  await chrome.storage.local.remove(usageKey(dateKey));
}

export async function getPomodoroState(): Promise<PomodoroState> {
  const result = await chrome.storage.local.get(STORAGE_KEY_POMODORO);
  return (result[STORAGE_KEY_POMODORO] as PomodoroState) ?? DEFAULT_POMODORO_STATE;
}

export async function setPomodoroState(state: PomodoroState): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY_POMODORO]: state });
}

export async function getSettings(): Promise<PomodoroSettings> {
  const result = await chrome.storage.local.get(STORAGE_KEY_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...(result[STORAGE_KEY_SETTINGS] as Partial<PomodoroSettings>) };
}

export async function setSettings(settings: PomodoroSettings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY_SETTINGS]: settings });
}
