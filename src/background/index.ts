import {
  ALARM_FLUSH,
  ALARM_POMODORO_END,
  IDLE_THRESHOLD_SECONDS,
} from "../shared/constants";
import {
  handleTabActivated,
  handleTabUpdated,
  handleIdle,
  handleTabRemoved,
  handleFlushAlarm,
} from "./timeTracker";
import { handleAlarm } from "./pomodoroTimer";
import { registerMessageHandler } from "./messageHandler";
import { syncDnrRulesOnStartup } from "./blockManager";

// Tab tracking
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  await handleTabActivated(tabId).catch(console.error);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  await handleTabUpdated(tabId, changeInfo, tab).catch(console.error);
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await handleTabRemoved(tabId).catch(console.error);
});

// Idle detection
chrome.idle.setDetectionInterval(IDLE_THRESHOLD_SECONDS);
chrome.idle.onStateChanged.addListener(async (state) => {
  await handleIdle(state).catch(console.error);
});

// Alarms
chrome.alarms.create(ALARM_FLUSH, { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_FLUSH) {
    await handleFlushAlarm().catch(console.error);
  } else if (alarm.name === ALARM_POMODORO_END) {
    await handleAlarm(alarm.name).catch(console.error);
  }
});

// Message handler
registerMessageHandler();

// Block feature: re-sync DNR rules on SW startup (rules are lost after extension updates)
syncDnrRulesOnStartup().catch(console.error);
