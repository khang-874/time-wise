import { useState, useEffect } from "react";
import type { PomodoroSettings } from "../../shared/types";
import { DEFAULT_SETTINGS } from "../../shared/constants";
import { sendMessage } from "../../shared/messages";

/**
 * Reads Pomodoro settings from `chrome.storage.local` on mount and provides
 * a `saveSettings` function that persists changes and notifies the service
 * worker so it can adjust the active timer duration.
 */
export function useSettings() {
  const [settings, setSettings] = useState<PomodoroSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    chrome.storage.local.get("settings").then((result) => {
      if (result.settings) {
        setSettings({ ...DEFAULT_SETTINGS, ...(result.settings as Partial<PomodoroSettings>) });
      }
    });
  }, []);

  /**
   * Optimistically updates local state then sends `UPDATE_SETTINGS` to the SW.
   * The SW pauses the timer if running before applying the new duration.
   */
  const saveSettings = async (updated: PomodoroSettings) => {
    setSettings(updated);
    await sendMessage({ type: "UPDATE_SETTINGS", payload: updated });
  };

  return { settings, saveSettings };
}
