import { useState, useEffect } from "react";
import type { PomodoroSettings } from "../../shared/types";
import { DEFAULT_SETTINGS } from "../../shared/constants";
import { sendMessage } from "../../shared/messages";

export function useSettings() {
  const [settings, setSettings] = useState<PomodoroSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    chrome.storage.local.get("settings").then((result) => {
      if (result.settings) {
        setSettings({ ...DEFAULT_SETTINGS, ...(result.settings as Partial<PomodoroSettings>) });
      }
    });
  }, []);

  const saveSettings = async (updated: PomodoroSettings) => {
    setSettings(updated);
    await sendMessage({ type: "UPDATE_SETTINGS", payload: updated });
  };

  return { settings, saveSettings };
}
