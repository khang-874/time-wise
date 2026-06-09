import { ALARM_FLUSH, ALARM_POMODORO_END, IDLE_THRESHOLD_SECONDS } from "../shared/constants";
import {
  handleTabActivated,
  handleTabUpdated,
  handleFocusChanged,
  handleIdle,
  handleTabRemoved,
  handleFlushAlarm,
} from "./timeTracker";
import { handleAlarm } from "./pomodoroTimer";
import { registerMessageHandler } from "./messageHandler";

// Tab tracking
chrome.tabs.onActivated.addListener(({ tabId }) => {
  handleTabActivated(tabId).catch(console.error);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  handleTabUpdated(tabId, changeInfo, tab).catch(console.error);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  handleTabRemoved(tabId).catch(console.error);
});

// Window focus
chrome.windows.onFocusChanged.addListener((windowId) => {
  handleFocusChanged(windowId).catch(console.error);
});

// Idle detection
chrome.idle.setDetectionInterval(IDLE_THRESHOLD_SECONDS);
chrome.idle.onStateChanged.addListener((state) => {
  handleIdle(state).catch(console.error);
});

// Alarms
chrome.alarms.create(ALARM_FLUSH, { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_FLUSH) {
    handleFlushAlarm().catch(console.error);
  } else if (alarm.name === ALARM_POMODORO_END) {
    handleAlarm(alarm.name).catch(console.error);
  }
});

// Message handler
registerMessageHandler();
